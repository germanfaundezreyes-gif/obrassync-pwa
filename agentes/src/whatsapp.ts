// Canal WhatsApp sobre la API oficial (WhatsApp Business Cloud API de Meta).
//
// Grupos: la API oficial NO permite agregar el número a grupos existentes. El número crea sus propios
// grupos (máx. 8 participantes contando al número) y la gente entra con un enlace de invitación.
// Las llamadas de grupos (crearGrupo, enlaceDeGrupo, campo group_id del webhook) están aisladas aquí:
// verifícalas contra la documentación vigente de Meta antes de salir a producción.
import crypto from "node:crypto";
import { config } from "./config.js";
import { responder } from "./equipo.js";
import { enCola, historial, recordar, yaVisto } from "./conversaciones.js";

const graph = () => `${config.whatsapp.graphUrl}/${config.whatsapp.apiVersion}`;

async function llamarGraph(ruta: string, metodo: "GET" | "POST", cuerpo?: unknown) {
  const r = await fetch(`${graph()}${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${config.whatsapp.accessToken}`, "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) throw new Error(`Graph ${metodo} ${ruta} → ${r.status}: ${JSON.stringify(d).slice(0, 400)}`);
  return d;
}

// ---- Verificación del webhook -------------------------------------------------

export function verificarSuscripcion(q: URLSearchParams): string | null {
  return q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === config.whatsapp.verifyToken
    ? q.get("hub.challenge")
    : null;
}

export function firmaValida(cuerpo: Buffer, firma: string | undefined): boolean {
  if (!firma?.startsWith("sha256=")) return false;
  const esperada = crypto.createHmac("sha256", config.whatsapp.appSecret).update(cuerpo).digest("hex");
  const a = Buffer.from(firma.slice(7), "hex");
  const b = Buffer.from(esperada, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---- Envío --------------------------------------------------------------------

/** WhatsApp usa *negrita* con un asterisco y no muestra encabezados Markdown. */
function aFormatoWhatsapp(texto: string): string {
  return texto
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/^#{1,6}\s+(.+)$/gm, "*$1*")
    .replace(/^\s*[-*]\s+/gm, "• ");
}

function trozos(texto: string, max = 3900): string[] {
  const partes: string[] = [];
  let resto = texto;
  while (resto.length > max) {
    const corte = Math.max(resto.lastIndexOf("\n", max), max / 2);
    partes.push(resto.slice(0, corte));
    resto = resto.slice(corte).trimStart();
  }
  return [...partes, resto];
}

async function enviarTexto(destino: { grupo?: string; numero?: string }, texto: string, citar?: string) {
  for (const [i, parte] of trozos(aFormatoWhatsapp(texto)).entries()) {
    await llamarGraph(`/${config.whatsapp.phoneNumberId}/messages`, "POST", {
      messaging_product: "whatsapp",
      recipient_type: destino.grupo ? "group" : "individual",
      to: destino.grupo ?? destino.numero,
      type: "text",
      text: { body: parte, preview_url: false },
      ...(i === 0 && citar ? { context: { message_id: citar } } : {}),
    });
  }
}

async function marcarLeidoEscribiendo(idMensaje: string) {
  await llamarGraph(`/${config.whatsapp.phoneNumberId}/messages`, "POST", {
    messaging_product: "whatsapp",
    status: "read",
    message_id: idMensaje,
    typing_indicator: { type: "text" },
  }).catch((e) => console.warn("[whatsapp] no se pudo marcar como leído:", (e as Error).message));
}

// ---- Grupos (administración) ---------------------------------------------------

export function crearGrupo(nombre: string, descripcion?: string) {
  return llamarGraph(`/${config.whatsapp.phoneNumberId}/groups`, "POST", {
    messaging_product: "whatsapp",
    subject: nombre,
    ...(descripcion ? { description: descripcion } : {}),
  });
}

export function enlaceDeGrupo(idGrupo: string) {
  return llamarGraph(`/${encodeURIComponent(idGrupo)}/invite_link`, "GET");
}

// ---- Recepción -----------------------------------------------------------------

type MensajeWA = {
  id: string;
  from: string;
  type: string;
  group_id?: string;
  text?: { body: string };
  context?: { from?: string; id?: string };
};
type Valor = {
  messages?: MensajeWA[];
  contacts?: { wa_id: string; profile?: { name?: string } }[];
  [k: string]: unknown;
};

export function procesarWebhook(payload: unknown) {
  const entradas = (payload as { entry?: { changes?: { field: string; value: Valor }[] }[] }).entry ?? [];
  for (const entrada of entradas) {
    for (const cambio of entrada.changes ?? []) {
      if (cambio.field !== "messages" || !cambio.value.messages) {
        // Eventos de grupos (creación, enlaces, participantes) quedan en el registro para el administrador.
        if (cambio.field !== "messages") console.log(`[whatsapp] evento ${cambio.field}:`, JSON.stringify(cambio.value));
        continue;
      }
      for (const m of cambio.value.messages) {
        const nombre = cambio.value.contacts?.find((c) => c.wa_id === m.from)?.profile?.name;
        atender(m, nombre).catch((e) => console.error("[whatsapp] error atendiendo mensaje:", e));
      }
    }
  }
}

function esParaElAgente(m: MensajeWA, texto: string): boolean {
  if (!m.group_id) return true; // chat directo: siempre
  if (m.context?.from && m.context.from.replace(/\D/g, "") === numeroPropio) return true; // le respondieron al agente
  const t = texto.toLowerCase();
  return config.whatsapp.activadores.some((a) => t.includes(a));
}

let numeroPropio = "";
export async function cargarNumeroPropio() {
  try {
    const d = await llamarGraph(`/${config.whatsapp.phoneNumberId}?fields=display_phone_number`, "GET");
    numeroPropio = String(d.display_phone_number ?? "").replace(/\D/g, "");
    console.log(`[whatsapp] número de los agentes: +${numeroPropio}`);
  } catch (e) {
    console.warn("[whatsapp] no se pudo leer el número propio:", (e as Error).message);
  }
}

async function atender(m: MensajeWA, nombre?: string) {
  if (yaVisto(m.id)) return;
  const texto = m.text?.body?.trim() ?? "";
  const destino = m.group_id ? { grupo: m.group_id } : { numero: m.from };

  if (m.type !== "text" || !texto) {
    if (!m.group_id) await enviarTexto(destino, "Por ahora solo leo mensajes de texto. 🙏", m.id);
    return;
  }
  if (!esParaElAgente(m, texto)) return;

  if (!config.whatsapp.autorizados.has(m.from)) {
    console.warn(`[whatsapp] mensaje de número no autorizado ${m.from}`);
    if (!m.group_id) await enviarTexto(destino, "Este número no está autorizado para consultar a los agentes de Matfau. Pide acceso a la gerencia.", m.id);
    return;
  }

  const clave = m.group_id ? `wa-grupo:${m.group_id}` : `wa:${m.from}`;
  await enCola(clave, async () => {
    await marcarLeidoEscribiendo(m.id);
    const pregunta = m.group_id ? `[${nombre ?? m.from}] ${texto}` : texto;
    let respuesta: string;
    try {
      respuesta = await responder({
        canal: "whatsapp",
        historial: historial(clave),
        mensaje: pregunta,
        remitente: `${nombre ?? "sin nombre"} (+${m.from})`,
        contexto: m.group_id ? "Conversación en un grupo de trabajo de WhatsApp." : "Chat directo de WhatsApp.",
      });
      recordar(clave, pregunta, respuesta);
    } catch (e) {
      console.error("[whatsapp] el agente falló:", e);
      respuesta = "Tuve un problema para responder. Intenta de nuevo en unos minutos.";
    }
    await enviarTexto(destino, respuesta, m.id);
  });
}
