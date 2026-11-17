// El equipo de agentes de Matfau sobre la API de Claude.
// Las instrucciones de cada agente se leen de .claude/agents/*.md, las mismas que usa Claude Code,
// para que haya una sola fuente de verdad: cambiar un .md cambia al agente en WhatsApp y en el correo.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import { config } from "./config.js";
import { consultar } from "./obrassync.js";

const client = new Anthropic();

const AREAS = ["operaciones", "finanzas", "ventas", "rrhh", "prevencion"] as const;
type Area = (typeof AREAS)[number];
const CON_BUSQUEDA_WEB = new Set<Area>(["ventas", "prevencion"]);

const aqui = path.dirname(fileURLToPath(import.meta.url));
const DIR_AGENTES = process.env.AGENTES_DIR ?? path.resolve(aqui, "../../.claude/agents");

function leerAgente(nombre: string): string {
  const crudo = fs.readFileSync(path.join(DIR_AGENTES, `${nombre}.md`), "utf8");
  // El frontmatter es para Claude Code; aquí solo interesa el cuerpo.
  return crudo.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
}

const NOTA_SERVICIO = `
## En este servicio
Para obtener datos de ObrasSync usa la herramienta \`consultar_obrassync\` con la misma ruta que usarías
con \`scripts/obs-api.sh\` (ese script no existe aquí). No tienes acceso al código de la app.`;

function notaCanal(canal: Canal): string {
  if (canal === "whatsapp") {
    return `
## Canal: WhatsApp
Respondes en un chat de WhatsApp, a veces en un grupo de trabajo. Sé breve: idealmente menos de 1.200 caracteres.
No uses tablas ni encabezados con #: usa *negrita* con un asterisco, listas con "•" y emojis de alerta (🔴 🟠 🟢).
Si el detalle es largo, entrega lo esencial y ofrece enviar el informe completo por correo.`;
  }
  return `
## Canal: correo electrónico
Respondes un correo. Saluda brevemente, entrega la respuesta completa y despídete como "Agentes Matfau".
Puedes usar listas y tablas simples en texto. No repitas el correo original.`;
}

export type Canal = "whatsapp" | "correo";
export type Turno = { role: "user" | "assistant"; content: string };

const herramientaObrassync = betaTool({
  name: "consultar_obrassync",
  description:
    "Hace un GET de solo lectura a la API de ObrasSync y devuelve el JSON. Ej.: /dashboard/kpis, /projects, /expenses/summary?month=2026-11.",
  inputSchema: {
    type: "object",
    properties: { ruta: { type: "string", description: "Ruta con query opcional, empezando con /" } },
    required: ["ruta"],
    additionalProperties: false,
  },
  run: async ({ ruta }) => {
    try {
      return await consultar(ruta);
    } catch (e) {
      return `No se pudo consultar ${ruta}: ${(e as Error).message}`;
    }
  },
});

const busquedaWeb = { type: "web_search_20260209", name: "web_search", max_uses: 3 } as const;

function textoFinal(m: Anthropic.Beta.BetaMessage): string {
  if (m.stop_reason === "refusal") return "No puedo ayudar con esa solicitud.";
  const texto = m.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return texto || "No obtuve una respuesta. Intenta reformular la pregunta.";
}

async function correrArea(area: Area, encargo: string, canal: Canal): Promise<string> {
  const sistema = `${leerAgente(`matfau-${area}`)}\n${NOTA_SERVICIO}\n\nTu respuesta la lee el gerente general, no el usuario final: entrega datos y hallazgos concretos.`;
  const final = await client.beta.messages.toolRunner({
    model: config.modelo,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: config.esfuerzoAreas },
    system: [{ type: "text", text: sistema, cache_control: { type: "ephemeral" } }],
    tools: CON_BUSQUEDA_WEB.has(area) ? [herramientaObrassync, busquedaWeb] : [herramientaObrassync],
    max_iterations: 15,
    messages: [{ role: "user", content: `${fechaChile()}\nCanal de origen: ${canal}.\n\nEncargo del gerente:\n${encargo}` }],
  });
  return textoFinal(final);
}

const herramientaArea = (canal: Canal) =>
  betaTool({
    name: "consultar_area",
    description:
      "Delega un encargo a un agente de área de Matfau y devuelve su informe. Llama varias en paralelo si la pregunta toca varias áreas.",
    inputSchema: {
      type: "object",
      properties: {
        area: { type: "string", enum: [...AREAS], description: "Área a consultar" },
        encargo: { type: "string", description: "Encargo concreto: periodo, obra o cliente y qué necesitas de vuelta" },
      },
      required: ["area", "encargo"],
      additionalProperties: false,
    },
    run: async ({ area, encargo }) => {
      try {
        return await correrArea(area as Area, encargo, canal);
      } catch (e) {
        console.error(`[equipo] fallo del área ${area}:`, e);
        return `El agente de ${area} no pudo responder (${(e as Error).message}).`;
      }
    },
  });

function fechaChile(): string {
  const f = new Date().toLocaleString("es-CL", { timeZone: "America/Santiago", dateStyle: "full", timeStyle: "short" });
  return `Fecha y hora en Chile: ${f}.`;
}

/** Atiende un mensaje con el gerente, que delega en las áreas que necesite. */
export async function responder(params: {
  canal: Canal;
  historial: Turno[];
  mensaje: string;
  remitente: string;
  contexto?: string;
}): Promise<string> {
  const sistema = `${leerAgente("matfau-gerente")}\n${NOTA_SERVICIO}
Para delegar usa la herramienta \`consultar_area\` (área: ${AREAS.join(", ")}) en vez de lanzar subagentes.
${notaCanal(params.canal)}`;

  const encabezado = [fechaChile(), `Remitente: ${params.remitente}.`, params.contexto].filter(Boolean).join("\n");
  const final = await client.beta.messages.toolRunner({
    model: config.modelo,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: config.esfuerzoGerente },
    system: [{ type: "text", text: sistema, cache_control: { type: "ephemeral" } }],
    tools: [herramientaArea(params.canal), herramientaObrassync],
    max_iterations: 10,
    messages: [...params.historial, { role: "user", content: `${encabezado}\n\n${params.mensaje}` }],
  });
  return textoFinal(final);
}
