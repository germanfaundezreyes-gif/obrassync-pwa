// Cliente de SOLO LECTURA de la API de ObrasSync. Es la única puerta de los agentes a los datos:
// solo hace GET, y rechaza rutas de sesión y notificaciones push.
import { config } from "./config.js";

const PROHIBIDAS = [/^\/auth\b/, /^\/push\b/];
const MAX_CARACTERES = 60_000;

let token = config.obrassync.token;
let tokenObtenido = 0;

async function iniciarSesion(): Promise<string> {
  const { api, email, password } = config.obrassync;
  if (!email || !password) throw new Error("Faltan OBRASSYNC_TOKEN o OBRASSYNC_EMAIL/OBRASSYNC_PASSWORD");
  const r = await fetch(`${api}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const d = (await r.json()) as { ok?: boolean; token?: string; message?: string };
  if (!r.ok || !d.ok || !d.token) throw new Error(`Login en ObrasSync rechazado: ${d.message ?? r.status}`);
  tokenObtenido = Date.now();
  return d.token;
}

async function tokenVigente(forzar = false): Promise<string> {
  const venceSesion = !config.obrassync.token && Date.now() - tokenObtenido > 50 * 60_000;
  if (!token || forzar || venceSesion) token = await iniciarSesion();
  return token;
}

export function validarRuta(ruta: string): string {
  const r = ruta.trim();
  if (!r.startsWith("/") || r.includes("..") || r.includes("://") || /\s/.test(r)) {
    throw new Error("Ruta inválida: debe empezar con / y no contener espacios ni '..'");
  }
  if (PROHIBIDAS.some((p) => p.test(r))) throw new Error("Esa ruta no está disponible para los agentes");
  return r;
}

export async function consultar(ruta: string): Promise<string> {
  const r = validarRuta(ruta);
  const pedir = async (t: string) =>
    fetch(`${config.obrassync.api}${r}`, { method: "GET", headers: { Authorization: `Bearer ${t}` } });

  let resp = await pedir(await tokenVigente());
  if (resp.status === 401 && !config.obrassync.token) resp = await pedir(await tokenVigente(true));

  const texto = await resp.text();
  if (!resp.ok) return `Error ${resp.status} en GET ${r}: ${texto.slice(0, 500)}`;
  return texto.length > MAX_CARACTERES
    ? `${texto.slice(0, MAX_CARACTERES)}\n…[respuesta recortada: ${texto.length} caracteres en total; filtra con parámetros de consulta]`
    : texto;
}
