// Servidor HTTP de los agentes de Matfau.
//   GET  /salud                          estado del servicio
//   GET  /webhooks/whatsapp              verificación del webhook (Meta)
//   POST /webhooks/whatsapp              mensajes entrantes de WhatsApp
//   POST /admin/grupos                   crea un grupo de WhatsApp   { "nombre": "...", "descripcion": "..." }
//   GET  /admin/grupos/{id}/enlace       enlace de invitación del grupo
//   POST /admin/probar                   pregunta directa al gerente  { "texto": "..." }
// Las rutas /admin exigen  Authorization: Bearer $ADMIN_TOKEN.
import http from "node:http";
import crypto from "node:crypto";
import { config, correoActivo, whatsappActivo } from "./config.js";
import { responder } from "./equipo.js";
import { cargarNumeroPropio, crearGrupo, enlaceDeGrupo, firmaValida, procesarWebhook, verificarSuscripcion } from "./whatsapp.js";
import { iniciarCorreo } from "./correo.js";

function leerCuerpo(req: http.IncomingMessage, limite = 2_000_000): Promise<Buffer> {
  return new Promise((ok, mal) => {
    const partes: Buffer[] = [];
    let total = 0;
    req.on("data", (p: Buffer) => {
      total += p.length;
      if (total > limite) { mal(new Error("Cuerpo demasiado grande")); req.destroy(); return; }
      partes.push(p);
    });
    req.on("end", () => ok(Buffer.concat(partes)));
    req.on("error", mal);
  });
}

function json(res: http.ServerResponse, estado: number, datos: unknown) {
  res.writeHead(estado, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(datos));
}

function esAdmin(req: http.IncomingMessage): boolean {
  if (!config.adminToken) return false;
  const a = Buffer.from(req.headers.authorization ?? "");
  const b = Buffer.from(`Bearer ${config.adminToken}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    if (req.method === "GET" && url.pathname === "/salud") {
      return json(res, 200, { ok: true, whatsapp: whatsappActivo(), correo: correoActivo() });
    }

    if (url.pathname === "/webhooks/whatsapp") {
      if (!whatsappActivo()) return json(res, 503, { ok: false, error: "WhatsApp no configurado" });
      if (req.method === "GET") {
        const reto = verificarSuscripcion(url.searchParams);
        if (reto === null) return json(res, 403, { ok: false });
        res.writeHead(200, { "Content-Type": "text/plain" });
        return res.end(reto);
      }
      if (req.method === "POST") {
        const cuerpo = await leerCuerpo(req);
        if (!firmaValida(cuerpo, req.headers["x-hub-signature-256"] as string | undefined)) return json(res, 401, { ok: false });
        json(res, 200, { ok: true }); // Meta exige respuesta rápida; el agente trabaja después.
        return procesarWebhook(JSON.parse(cuerpo.toString("utf8")));
      }
    }

    if (url.pathname.startsWith("/admin/")) {
      if (!esAdmin(req)) return json(res, 401, { ok: false, error: "No autorizado" });

      if (req.method === "POST" && url.pathname === "/admin/grupos") {
        const { nombre, descripcion } = JSON.parse((await leerCuerpo(req)).toString("utf8") || "{}");
        if (!nombre) return json(res, 400, { ok: false, error: "Falta nombre" });
        return json(res, 200, { ok: true, meta: await crearGrupo(nombre, descripcion) });
      }
      const enlace = url.pathname.match(/^\/admin\/grupos\/([^/]+)\/enlace$/);
      if (req.method === "GET" && enlace) {
        return json(res, 200, { ok: true, meta: await enlaceDeGrupo(decodeURIComponent(enlace[1])) });
      }
      if (req.method === "POST" && url.pathname === "/admin/probar") {
        const { texto } = JSON.parse((await leerCuerpo(req)).toString("utf8") || "{}");
        if (!texto) return json(res, 400, { ok: false, error: "Falta texto" });
        const respuesta = await responder({ canal: "whatsapp", historial: [], mensaje: texto, remitente: "administrador (prueba)" });
        return json(res, 200, { ok: true, respuesta });
      }
    }

    json(res, 404, { ok: false, error: "No encontrado" });
  } catch (e) {
    console.error("[servidor]", e);
    if (!res.headersSent) json(res, 500, { ok: false, error: (e as Error).message });
  }
});

servidor.listen(config.puerto, () => {
  console.log(`[servidor] escuchando en el puerto ${config.puerto}`);
  if (whatsappActivo()) cargarNumeroPropio();
  else console.log("[servidor] WhatsApp sin configurar (faltan variables WA_*)");
  if (correoActivo()) iniciarCorreo();
  else console.log("[servidor] correo sin configurar (faltan variables M365_*)");
  if (!config.adminToken) console.log("[servidor] ADMIN_TOKEN vacío: las rutas /admin quedan cerradas");
});
