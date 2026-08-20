// Cola de operaciones sin conexión.
//
// ObrasSync se usa en obra, donde la señal se corta. Antes, una fotografía tomada sin
// cobertura simplemente se perdía. Aquí todo lo que el usuario hace se guarda primero en
// el dispositivo y solo se borra de la cola cuando el servidor confirma que lo recibió.
//
// Se usa IndexedDB y no localStorage porque las fotografías son binarios de varios
// megabytes: localStorage guarda texto y se llena a los 5 MB.

const BD = "obrassync_offline";
const VERSION = 1;
export const ALMACEN_OPS = "pending_operations";
const ALMACEN_CACHE = "cached_data";

export type EstadoOp = "pending" | "uploading" | "completed" | "failed";
export type TipoOp = "foto" | "avance";

export type Operacion = {
  id: string;
  tipo: TipoOp;
  estado: EstadoOp;
  intentos: number;
  proximoIntento: number;   // epoch ms; 0 = cuanto antes
  creado: number;
  ultimoError?: string;
  conflicto?: string;       // el servidor tenía otro valor; no se sobrescribió
  // Carga útil según el tipo
  taskId?: string;
  projectId?: string;
  blob?: Blob;
  filename?: string;
  descripcion?: string;
  takenAt?: string | null;
  progreso?: number;
  progresoPrevio?: number;
};

// Espera entre reintentos: 30 s, 2 min, 5 min. Después queda a la espera de que el
// usuario reintente a mano, para no golpear al servidor indefinidamente.
export const ESPERAS = [30_000, 120_000, 300_000];
export const MAX_INTENTOS = ESPERAS.length;

let bd: IDBDatabase | null = null;

function abrir(): Promise<IDBDatabase> {
  if (bd) return Promise.resolve(bd);
  return new Promise((ok, falla) => {
    const req = indexedDB.open(BD, VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(ALMACEN_OPS)) {
        const s = d.createObjectStore(ALMACEN_OPS, { keyPath: "id" });
        s.createIndex("estado", "estado");
        s.createIndex("taskId", "taskId");
      }
      if (!d.objectStoreNames.contains(ALMACEN_CACHE)) {
        d.createObjectStore(ALMACEN_CACHE, { keyPath: "clave" });
      }
    };
    req.onsuccess = () => { bd = req.result; ok(bd); };
    req.onerror = () => falla(req.error);
  });
}

function tx<T>(almacen: string, modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return abrir().then(d => new Promise<T>((ok, falla) => {
    const t = d.transaction(almacen, modo);
    const req = fn(t.objectStore(almacen));
    req.onsuccess = () => ok(req.result as T);
    req.onerror = () => falla(req.error);
  }));
}

export const hayIndexedDB = typeof indexedDB !== "undefined";

// ── Cola ──────────────────────────────────────────────────────────────────────

export async function encolar(op: Omit<Operacion, "id" | "estado" | "intentos" | "proximoIntento" | "creado">): Promise<Operacion> {
  const completa: Operacion = {
    ...op,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    estado: "pending",
    intentos: 0,
    proximoIntento: 0,
    creado: Date.now(),
  };
  await tx(ALMACEN_OPS, "readwrite", s => s.put(completa));
  return completa;
}

export async function listarOperaciones(): Promise<Operacion[]> {
  if (!hayIndexedDB) return [];
  try {
    const todas = await tx<Operacion[]>(ALMACEN_OPS, "readonly", s => s.getAll());
    return todas.sort((a, b) => a.creado - b.creado);
  } catch { return []; }
}

export async function operacionesDePartida(taskId: string): Promise<Operacion[]> {
  const todas = await listarOperaciones();
  return todas.filter(o => o.taskId === taskId && o.estado !== "completed");
}

export async function actualizarOperacion(id: string, cambios: Partial<Operacion>) {
  const actual = await tx<Operacion | undefined>(ALMACEN_OPS, "readonly", s => s.get(id));
  if (!actual) return;
  await tx(ALMACEN_OPS, "readwrite", s => s.put({ ...actual, ...cambios }));
}

// Solo se borra cuando el servidor confirmó. Es la regla que impide perder una fotografía.
export async function eliminarOperacion(id: string) {
  await tx(ALMACEN_OPS, "readwrite", s => s.delete(id));
}

export async function reintentarTodo() {
  const ops = await listarOperaciones();
  for (const o of ops) {
    if (o.estado === "failed" || o.estado === "pending") {
      await actualizarOperacion(o.id, { estado: "pending", intentos: 0, proximoIntento: 0, ultimoError: undefined });
    }
  }
}

// ── Caché de lectura ──────────────────────────────────────────────────────────
// Permite abrir una obra ya visitada estando sin señal. Se guarda con marca de tiempo
// para poder decirle al usuario de cuándo son los datos que está viendo.

export async function guardarCache(clave: string, datos: unknown) {
  if (!hayIndexedDB) return;
  try { await tx(ALMACEN_CACHE, "readwrite", s => s.put({ clave, datos, guardado: Date.now() })); } catch { /* sin espacio */ }
}

export async function leerCache<T>(clave: string): Promise<{ datos: T; guardado: number } | null> {
  if (!hayIndexedDB) return null;
  try {
    const r = await tx<{ clave: string; datos: T; guardado: number } | undefined>(ALMACEN_CACHE, "readonly", s => s.get(clave));
    return r ? { datos: r.datos, guardado: r.guardado } : null;
  } catch { return null; }
}

// ── Sincronización ────────────────────────────────────────────────────────────

export type ResultadoSync = { subidas: number; fallidas: number; conflictos: number; pendientes: number };

let sincronizando = false;

// Sube lo que esté listo. No corre en paralelo consigo misma: dos ejecuciones simultáneas
// subirían la misma fotografía dos veces.
export async function sincronizar(apiUrl: string, token: string, alCambiar?: () => void): Promise<ResultadoSync> {
  const vacio = { subidas: 0, fallidas: 0, conflictos: 0, pendientes: 0 };
  if (sincronizando || !hayIndexedDB || !navigator.onLine || !token) return vacio;
  sincronizando = true;
  let subidas = 0, fallidas = 0, conflictos = 0;

  try {
    const ops = await listarOperaciones();
    const ahora = Date.now();
    for (const op of ops) {
      if (op.estado === "completed") continue;
      if (op.estado === "failed") continue;            // espera reintento manual
      if (op.proximoIntento > ahora) continue;          // aún en espera

      await actualizarOperacion(op.id, { estado: "uploading" });
      alCambiar?.();

      try {
        const r = await enviarOperacion(apiUrl, token, op);
        if (r.conflicto) {
          conflictos++;
          // No se sobrescribe lo del servidor: queda marcado para que el usuario decida.
          await actualizarOperacion(op.id, { estado: "failed", conflicto: r.conflicto, intentos: MAX_INTENTOS });
        } else {
          // Recién ahora se borra la copia local.
          await eliminarOperacion(op.id);
          subidas++;
        }
      } catch (e) {
        const intentos = op.intentos + 1;
        const agotado = intentos >= MAX_INTENTOS;
        if (agotado) fallidas++;
        await actualizarOperacion(op.id, {
          estado: agotado ? "failed" : "pending",
          intentos,
          proximoIntento: agotado ? 0 : Date.now() + ESPERAS[Math.min(intentos - 1, ESPERAS.length - 1)],
          ultimoError: (e as Error).message,
        });
      }
      alCambiar?.();
    }
  } finally {
    sincronizando = false;
  }

  const restantes = (await listarOperaciones()).filter(o => o.estado !== "completed").length;
  return { subidas, fallidas, conflictos, pendientes: restantes };
}

async function enviarOperacion(apiUrl: string, token: string, op: Operacion): Promise<{ conflicto?: string }> {
  if (op.tipo === "foto") {
    const fd = new FormData();
    fd.append("photo", op.blob!, op.filename || "foto.jpg");
    if (op.descripcion) fd.append("description", op.descripcion);
    if (op.takenAt) fd.append("taken_at", op.takenAt);
    const r = await fetch(`${apiUrl}/tasks/${op.taskId}/photos`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
    });
    if (!r.ok) throw new Error(`El servidor respondió ${r.status}`);
    return {};
  }

  if (op.tipo === "avance") {
    const r = await fetch(`${apiUrl}/tasks/${op.taskId}/progress`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      // expected_progress permite al servidor detectar que alguien más lo cambió mientras
      // el teléfono estaba sin señal, en vez de pisar ese cambio en silencio.
      body: JSON.stringify({ progress_percent: op.progreso, expected_progress: op.progresoPrevio }),
    });
    if (r.status === 409) {
      const d = await r.json().catch(() => ({}));
      return { conflicto: d.message || "Otra persona cambió el avance mientras estabas sin conexión" };
    }
    if (!r.ok) throw new Error(`El servidor respondió ${r.status}`);
    return {};
  }

  throw new Error(`Tipo de operación desconocido: ${op.tipo}`);
}

// URL temporal para mostrar una fotografía que todavía no se ha subido.
export function urlLocal(blob: Blob) {
  return URL.createObjectURL(blob);
}
