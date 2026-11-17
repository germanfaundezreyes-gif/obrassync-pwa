// Memoria corta por conversación (un chat, un grupo o un hilo de correo) y una cola por conversación
// para que dos mensajes seguidos del mismo chat se respondan en orden.
// Vive en memoria: un reinicio del servicio olvida las conversaciones, no los datos de ObrasSync.
import type { Turno } from "./equipo.js";

const MAX_TURNOS = 20;
const VIGENCIA_MS = 24 * 60 * 60_000;

const memoria = new Map<string, { turnos: Turno[]; actualizado: number }>();
const colas = new Map<string, Promise<unknown>>();

export function historial(clave: string): Turno[] {
  const c = memoria.get(clave);
  if (!c || Date.now() - c.actualizado > VIGENCIA_MS) return [];
  return c.turnos;
}

export function recordar(clave: string, pregunta: string, respuesta: string) {
  const turnos = [...historial(clave), { role: "user" as const, content: pregunta }, { role: "assistant" as const, content: respuesta }];
  memoria.set(clave, { turnos: turnos.slice(-MAX_TURNOS), actualizado: Date.now() });
}

export function enCola<T>(clave: string, tarea: () => Promise<T>): Promise<T> {
  const anterior = colas.get(clave) ?? Promise.resolve();
  const siguiente = anterior.catch(() => {}).then(tarea);
  colas.set(clave, siguiente);
  siguiente.finally(() => { if (colas.get(clave) === siguiente) colas.delete(clave); }).catch(() => {});
  return siguiente;
}

// Meta reintenta webhooks: se recuerdan los IDs ya procesados para no responder dos veces.
const vistos = new Map<string, number>();
export function yaVisto(id: string): boolean {
  const ahora = Date.now();
  if (vistos.size > 5000) for (const [k, t] of vistos) if (ahora - t > VIGENCIA_MS) vistos.delete(k);
  if (vistos.has(id)) return true;
  vistos.set(id, ahora);
  return false;
}
