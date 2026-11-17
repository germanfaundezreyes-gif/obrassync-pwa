// Canal correo sobre Microsoft 365 (Microsoft Graph, credenciales de aplicación).
// Revisa el buzón de los agentes cada cierto tiempo, responde los correos no leídos de remitentes
// permitidos y los marca como leídos. Responde dentro del mismo hilo.
import { config } from "./config.js";
import { responder } from "./equipo.js";
import { enCola, historial, recordar } from "./conversaciones.js";

const GRAPH = "https://graph.microsoft.com/v1.0";
let token = "";
let vence = 0;

async function tokenGraph(): Promise<string> {
  if (token && Date.now() < vence - 60_000) return token;
  const { tenantId, clientId, clientSecret } = config.correo;
  const r = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  const d = (await r.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!r.ok || !d.access_token) throw new Error(`Token de Microsoft rechazado: ${d.error_description ?? r.status}`);
  token = d.access_token;
  vence = Date.now() + (d.expires_in ?? 3600) * 1000;
  return token;
}

async function graph(ruta: string, metodo = "GET", cuerpo?: unknown) {
  const r = await fetch(`${GRAPH}/users/${encodeURIComponent(config.correo.buzon)}${ruta}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${await tokenGraph()}`,
      "Content-Type": "application/json",
      Prefer: 'outlook.body-content-type="text"',
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  if (!r.ok) throw new Error(`Graph ${metodo} ${ruta} → ${r.status}: ${(await r.text()).slice(0, 400)}`);
  return r.status === 202 || r.status === 204 ? {} : r.json();
}

type Correo = {
  id: string;
  subject?: string;
  conversationId: string;
  from?: { emailAddress?: { address?: string; name?: string } };
  uniqueBody?: { content?: string };
  bodyPreview?: string;
};

function permitido(direccion: string): boolean {
  const d = direccion.toLowerCase();
  if (d === config.correo.buzon) return false; // nunca responderse a sí mismo
  return config.correo.permitidos.some((p) => (p.includes("@") ? d === p : d.endsWith(`@${p}`)));
}

const esAutomatico = (asunto = "") => /^(respuesta autom|automatic reply|auto:|fuera de la oficina|out of office|undeliverable|no entregable)/i.test(asunto);

function aHtml(texto: string): string {
  const esc = texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;white-space:pre-wrap">${esc}</div>`;
}

async function atender(c: Correo) {
  const de = c.from?.emailAddress?.address ?? "";
  // Se marca leído primero: si algo falla, no se reintenta en bucle cada minuto.
  await graph(`/messages/${c.id}`, "PATCH", { isRead: true });
  if (!permitido(de) || esAutomatico(c.subject)) {
    console.log(`[correo] ignorado: ${de || "sin remitente"} — ${c.subject ?? ""}`);
    return;
  }
  const clave = `correo:${c.conversationId}`;
  await enCola(clave, async () => {
    const cuerpo = (c.uniqueBody?.content ?? c.bodyPreview ?? "").trim().slice(0, 20_000);
    const pregunta = `Asunto: ${c.subject ?? "(sin asunto)"}\n\n${cuerpo}`;
    let respuesta: string;
    try {
      respuesta = await responder({
        canal: "correo",
        historial: historial(clave),
        mensaje: pregunta,
        remitente: `${c.from?.emailAddress?.name ?? ""} <${de}>`,
      });
      recordar(clave, pregunta, respuesta);
    } catch (e) {
      console.error("[correo] el agente falló:", e);
      respuesta = "Tuvimos un problema para responder tu correo. Intenta de nuevo en unos minutos.\n\nAgentes Matfau";
    }
    await graph(`/messages/${c.id}/reply`, "POST", { comment: aHtml(respuesta) });
    console.log(`[correo] respondido a ${de}: ${c.subject ?? ""}`);
  });
}

async function revisar() {
  const d = (await graph(
    "/mailFolders/inbox/messages?$filter=isRead eq false&$top=10&$orderby=receivedDateTime asc" +
      "&$select=id,subject,from,conversationId,uniqueBody,bodyPreview",
  )) as { value?: Correo[] };
  for (const c of d.value ?? []) {
    atender(c).catch((e) => console.error("[correo] error atendiendo correo:", e));
  }
}

export function iniciarCorreo() {
  const ciclo = () => revisar().catch((e) => console.error("[correo] no se pudo revisar el buzón:", (e as Error).message));
  ciclo();
  setInterval(ciclo, Math.max(30, config.correo.intervaloSegundos) * 1000);
  console.log(`[correo] revisando ${config.correo.buzon} cada ${config.correo.intervaloSegundos}s`);
}
