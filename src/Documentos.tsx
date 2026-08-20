// Control documental.
//
// El backend ya guardaba vencimientos, responsables, versiones e historial, pero solo
// eran accesibles por API. Esta pantalla es la que convierte todo eso en algo usable:
// qué hay, qué vence, quién responde y qué falta.

import { useState, useEffect, useRef } from "react";
import {
  FileText, Upload, Clock, AlertTriangle, CheckCircle2, X,
  History, RefreshCw, ChevronRight, CircleSlash,
} from "lucide-react";

type Documento = {
  id: string;
  filename: string;
  categoria: string;
  estado: string;
  version: number;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  responsable_id: string | null;
  responsable_nombre?: string | null;
  created_at: string;
  updated_at?: string | null;
  mime?: string;
};

type Faltante = { categoria: string; nombre: string };
type Conteo = { total: number; vigentes: number; por_vencer: number; vencidos: number; faltantes: number };
type EventoHistorial = { accion: string; user_email: string | null; version: number | null; created_at: string; detalle?: unknown };
type Usuario = { id: string; full_name: string };

// Los estados llevan color propio porque en una lista larga el color se lee antes que
// el texto, y lo que importa es detectar de un vistazo lo vencido.
const ESTADOS: Record<string, { etiqueta: string; color: string; fondo: string }> = {
  vigente:            { etiqueta: "Vigente",             color: "#15803D", fondo: "#EAF6EE" },
  por_vencer:         { etiqueta: "Por vencer",          color: "#B45309", fondo: "#FDF4E6" },
  vencido:            { etiqueta: "Vencido",             color: "#B91C1C", fondo: "#FCEDEC" },
  pendiente_revision: { etiqueta: "Pendiente revisión",  color: "#1D4ED8", fondo: "#EFF4FE" },
  rechazado:          { etiqueta: "Rechazado",           color: "#6B7280", fondo: "#F3F4F6" },
  faltante:           { etiqueta: "Faltante",            color: "#374151", fondo: "#E5E7EB" },
};

const CATEGORIAS = [
  { valor: "contratos", etiqueta: "Contratos" },
  { valor: "permisos", etiqueta: "Permisos" },
  { valor: "certificados", etiqueta: "Certificados" },
  { valor: "polizas", etiqueta: "Pólizas" },
  { valor: "planos", etiqueta: "Planos" },
  { valor: "actas", etiqueta: "Actas" },
  { valor: "prevencion", etiqueta: "Prevención" },
  { valor: "calidad", etiqueta: "Calidad" },
  { valor: "personal", etiqueta: "Personal" },
  { valor: "recepcion", etiqueta: "Recepción" },
  { valor: "otros", etiqueta: "Otros" },
];

const etiquetaCategoria = (v: string) => CATEGORIAS.find(c => c.valor === v)?.etiqueta || v;

const fecha = (v?: string | null) => (v ? new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString("es-CL") : "—");

// Días que faltan, en horario local, para no descontar un día por la zona horaria.
function diasRestantes(vencimiento?: string | null): number | null {
  if (!vencimiento) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const v = new Date(`${String(vencimiento).slice(0, 10)}T00:00:00`);
  return Math.round((v.getTime() - hoy.getTime()) / 86_400_000);
}

type Props = {
  API_URL: string;
  token: string;
  projectId: string;
  projectName: string;
  C: Record<string, string>;
  onCerrar: () => void;
};

export default function DocumentosScreen({ API_URL, token, projectId, projectName, C, onCerrar }: Props) {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [faltantes, setFaltantes] = useState<Faltante[]>([]);
  const [conteo, setConteo] = useState<Conteo | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "vigente" | "por_vencer" | "vencido" | "faltante" | "pendiente_revision">("todos");
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [formAbierto, setFormAbierto] = useState(false);
  const [reemplazando, setReemplazando] = useState<Documento | null>(null);
  const [historialDe, setHistorialDe] = useState<Documento | null>(null);
  const [historial, setHistorial] = useState<EventoHistorial[]>([]);

  const archivoRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [fCategoria, setFCategoria] = useState("otros");
  const [fResponsable, setFResponsable] = useState("");
  const [fEmision, setFEmision] = useState("");
  const [fVencimiento, setFVencimiento] = useState("");

  const cab = { Authorization: `Bearer ${token}` };

  async function cargar() {
    setCargando(true); setError("");
    try {
      const r = await fetch(`${API_URL}/projects/${projectId}/documentos/resumen`, { headers: cab });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.message || "No se pudo cargar la documentación");
      setDocs(d.documentos || []);
      setFaltantes(d.faltantes || []);
      setConteo(d.conteo || null);
    } catch (e) {
      setError((e as Error).message);
    } finally { setCargando(false); }
  }

  useEffect(() => { void cargar(); }, [projectId]);
  useEffect(() => {
    fetch(`${API_URL}/users`, { headers: cab })
      .then(r => r.json()).then(d => setUsuarios(d.items || []))
      .catch(() => setUsuarios([]));
  }, []);

  function abrirFormulario(doc?: Documento) {
    setReemplazando(doc || null);
    setArchivo(null);
    setFCategoria(doc?.categoria || "otros");
    setFResponsable(doc?.responsable_id || "");
    setFEmision("");
    setFVencimiento("");
    setFormAbierto(true);
  }

  // Se usa XMLHttpRequest y no fetch porque es la única forma de conocer el avance real
  // de la subida: un plano o un acta escaneada pesan, y sin progreso el usuario cree
  // que la aplicación se colgó y la cierra a mitad de camino.
  function subir() {
    if (!archivo) { setError("Elige un archivo"); return; }
    setSubiendo(true); setProgreso(0); setError("");

    const fd = new FormData();
    fd.append("file", archivo);
    fd.append("categoria", fCategoria);
    if (fResponsable) fd.append("responsable_id", fResponsable);
    if (fEmision) fd.append("fecha_emision", fEmision);
    if (fVencimiento) fd.append("fecha_vencimiento", fVencimiento);
    if (reemplazando) fd.append("reemplaza_a", reemplazando.id);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/projects/${projectId}/files`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = e => { if (e.lengthComputable) setProgreso(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      setSubiendo(false);
      if (xhr.status === 413) { setError(`El archivo supera el límite permitido. Comprímelo o súbelo por partes.`); return; }
      let d: { ok?: boolean; message?: string } = {};
      try { d = JSON.parse(xhr.responseText); } catch { /* respuesta no JSON */ }
      if (xhr.status >= 400 || !d.ok) { setError(d.message || `El servidor respondió ${xhr.status}`); return; }
      setFormAbierto(false); setArchivo(null); void cargar();
    };
    xhr.onerror = () => { setSubiendo(false); setError("Se perdió la conexión durante la subida. Inténtalo de nuevo."); };
    xhr.ontimeout = () => { setSubiendo(false); setError("La subida tardó demasiado. Revisa la señal e inténtalo de nuevo."); };
    xhr.timeout = 5 * 60 * 1000;
    xhr.send(fd);
  }

  async function guardarMetadatos(doc: Documento, cambios: Record<string, string | null>) {
    try {
      const r = await fetch(`${API_URL}/project-files/${doc.id}`, {
        method: "PATCH",
        headers: { ...cab, "Content-Type": "application/json" },
        body: JSON.stringify(cambios),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.message || "No se pudo guardar");
      await cargar();
    } catch (e) { setError((e as Error).message); }
  }

  async function verHistorial(doc: Documento) {
    setHistorialDe(doc); setHistorial([]);
    try {
      const r = await fetch(`${API_URL}/project-files/${doc.id}/historial`, { headers: cab });
      const d = await r.json();
      setHistorial(d.items || []);
    } catch { setHistorial([]); }
  }

  // Las faltantes se muestran como filas del mismo listado: son parte de la documentación
  // del proyecto aunque todavía no exista el archivo.
  const visibles = filtro === "faltante" ? [] : docs.filter(d => filtro === "todos" || d.estado === filtro);
  const faltantesVisibles = filtro === "todos" || filtro === "faltante" ? faltantes : [];

  const FILTROS = [
    { v: "todos", etiqueta: "Todos", n: (conteo?.total || 0) + (conteo?.faltantes || 0) },
    { v: "vigente", etiqueta: "Vigentes", n: conteo?.vigentes || 0 },
    { v: "por_vencer", etiqueta: "Por vencer", n: conteo?.por_vencer || 0 },
    { v: "vencido", etiqueta: "Vencidos", n: conteo?.vencidos || 0 },
    { v: "faltante", etiqueta: "Faltantes", n: conteo?.faltantes || 0 },
    { v: "pendiente_revision", etiqueta: "Pendientes", n: docs.filter(d => d.estado === "pendiente_revision").length },
  ] as const;

  return (
    <div style={{ padding: "16px 16px 120px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <button onClick={onCerrar} style={{ background: "none", border: "none", color: C.orange, cursor: "pointer", padding: 0, fontSize: 14, fontWeight: 600 }}>‹ Volver</button>
      </div>
      <h2 style={{ fontSize: 21, fontWeight: 800, color: C.text, margin: "6px 0 2px" }}>Documentos</h2>
      <p style={{ fontSize: 13, color: C.muted, margin: "0 0 16px" }}>{projectName}</p>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 8, backgroundColor: C.dangerDim, color: C.danger, fontSize: 13, marginBottom: 12, display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => { setError(""); void cargar(); }} style={{ background: "none", border: "none", color: C.danger, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Reintentar</button>
        </div>
      )}

      {/* Resumen de documentación obligatoria */}
      {conteo && (
        <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 }}>Documentación obligatoria</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {[
              { n: conteo.total, t: "cargados", c: C.text },
              { n: conteo.vigentes, t: "vigentes", c: "#15803D" },
              { n: conteo.por_vencer, t: "por vencer", c: "#B45309" },
              { n: conteo.vencidos, t: "vencidos", c: "#B91C1C" },
              { n: conteo.faltantes, t: "faltantes", c: "#374151" },
            ].map(x => (
              <div key={x.t}>
                <div style={{ fontSize: 22, fontWeight: 800, color: x.c, lineHeight: 1 }}>{x.n}</div>
                <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>{x.t}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 6, marginBottom: 12 }}>
        {FILTROS.map(f => (
          <button key={f.v} onClick={() => setFiltro(f.v)}
            style={{
              flexShrink: 0, padding: "7px 13px", borderRadius: 18, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              minHeight: 36,
              border: `1px solid ${filtro === f.v ? C.orange : C.border}`,
              backgroundColor: filtro === f.v ? C.orangeDim : C.card,
              color: filtro === f.v ? C.orange : C.mutedSoft,
            }}>
            {f.etiqueta} {f.n > 0 && <span style={{ opacity: 0.7 }}>· {f.n}</span>}
          </button>
        ))}
      </div>

      <button onClick={() => abrirFormulario()}
        style={{ width: "100%", minHeight: 46, backgroundColor: C.orange, border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}>
        <Upload size={17} /> Subir documento
      </button>

      {cargando ? (
        // Esqueleto en vez de "Cargando...": deja ver la forma de lo que viene.
        <div>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <div style={{ height: 13, width: `${60 - i * 8}%`, backgroundColor: C.cardAlt, borderRadius: 4, marginBottom: 9 }} />
              <div style={{ height: 10, width: "38%", backgroundColor: C.cardAlt, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      ) : visibles.length === 0 && faltantesVisibles.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", color: C.muted }}>
          <FileText size={34} style={{ opacity: 0.35, marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: C.mutedSoft, marginBottom: 4 }}>
            {filtro === "todos" ? "Todavía no hay documentos" : `No hay documentos en «${FILTROS.find(f => f.v === filtro)?.etiqueta}»`}
          </div>
          <div style={{ fontSize: 12.5 }}>
            {filtro === "todos" ? "Sube el primero con el botón de arriba." : "Prueba con otro filtro."}
          </div>
        </div>
      ) : (
        <>
          {faltantesVisibles.map(f => (
            <div key={`falta_${f.categoria}_${f.nombre}`}
              onClick={() => { setFCategoria(f.categoria); abrirFormulario(); }}
              style={{ backgroundColor: C.card, border: `1px dashed ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
              <CircleSlash size={19} color={ESTADOS.faltante.color} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{f.nombre}</div>
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{etiquetaCategoria(f.categoria)} · obligatorio, sin cargar</div>
              </div>
              <span style={{ ...chip(ESTADOS.faltante) }}>Faltante</span>
              <ChevronRight size={17} color={C.muted} />
            </div>
          ))}

          {visibles.map(d => {
            const est = ESTADOS[d.estado] || ESTADOS.vigente;
            const dias = diasRestantes(d.fecha_vencimiento);
            return (
              <div key={d.id} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderLeft: `3px solid ${est.color}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: C.text, wordBreak: "break-word" }}>{d.filename}</div>
                    <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>
                      {etiquetaCategoria(d.categoria)}
                      {d.version > 1 && <> · <b style={{ color: C.orange }}>v{d.version}</b></>}
                      {d.responsable_nombre && <> · {d.responsable_nombre}</>}
                    </div>
                  </div>
                  <span style={chip(est)}>{est.etiqueta}</span>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", fontSize: 11.5, color: C.muted, marginBottom: 10 }}>
                  <span>Emisión: {fecha(d.fecha_emision)}</span>
                  <span>
                    Vence: {fecha(d.fecha_vencimiento)}
                    {dias !== null && (
                      <b style={{ color: est.color, marginLeft: 5 }}>
                        {dias < 0 ? `(hace ${Math.abs(dias)} d)` : dias === 0 ? "(hoy)" : `(en ${dias} d)`}
                      </b>
                    )}
                  </span>
                  <span>Actualizado: {fecha(d.updated_at || d.created_at)}</span>
                </div>

                {!d.fecha_vencimiento && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "7px 10px", backgroundColor: C.cardAlt, borderRadius: 8 }}>
                    <Clock size={13} color={C.muted} />
                    <span style={{ fontSize: 11.5, color: C.muted, flex: 1 }}>Sin fecha de vencimiento: no genera avisos</span>
                    <input type="date" onChange={e => e.target.value && guardarMetadatos(d, { fecha_vencimiento: e.target.value })}
                      style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 6px", backgroundColor: C.card, color: C.text }} />
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <a href={`${API_URL}/project-files/${d.id}/download`} target="_blank" rel="noreferrer"
                    style={{ flex: 1, minHeight: 38, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 8, color: C.mutedSoft, fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}>
                    <FileText size={14} /> Abrir
                  </a>
                  <button onClick={() => abrirFormulario(d)}
                    style={{ flex: 1, minHeight: 38, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 8, color: C.mutedSoft, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                    <RefreshCw size={14} /> Reemplazar
                  </button>
                  <button onClick={() => verHistorial(d)}
                    style={{ minHeight: 38, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 8, color: C.mutedSoft, cursor: "pointer" }}
                    aria-label="Ver historial">
                    <History size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Formulario de subida */}
      {formAbierto && (
        <>
          <div onClick={() => !subiendo && setFormAbierto(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 400 }} />
          <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, backgroundColor: C.card, borderRadius: "20px 20px 0 0", zIndex: 401, padding: "10px 16px 28px", maxHeight: "88vh", overflowY: "auto" }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, margin: "0 auto 16px" }} />
            <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
              <div style={{ flex: 1, fontSize: 17, fontWeight: 800, color: C.text }}>
                {reemplazando ? `Reemplazar · v${reemplazando.version + 1}` : "Subir documento"}
              </div>
              <button onClick={() => !subiendo && setFormAbierto(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", minHeight: 44, minWidth: 44 }}><X size={20} /></button>
            </div>

            {reemplazando && (
              <div style={{ padding: "10px 12px", backgroundColor: C.cardAlt, borderRadius: 8, fontSize: 12, color: C.muted, marginBottom: 14 }}>
                La versión actual no se borra: queda archivada y se puede consultar desde el historial.
              </div>
            )}

            <input ref={archivoRef} type="file" style={{ display: "none" }} onChange={e => setArchivo(e.target.files?.[0] || null)} />
            <button onClick={() => archivoRef.current?.click()} disabled={subiendo}
              style={{ width: "100%", minHeight: 48, backgroundColor: C.cardAlt, border: `1px dashed ${archivo ? C.orange : C.border}`, borderRadius: 10, color: archivo ? C.text : C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 12, padding: "0 12px", wordBreak: "break-all" }}>
              {archivo ? `${archivo.name} · ${(archivo.size / 1048576).toFixed(1)} MB` : "Elegir archivo"}
            </button>

            <Campo etiqueta="Categoría" C={C}>
              <select value={fCategoria} onChange={e => setFCategoria(e.target.value)} style={estiloCampo(C)}>
                {CATEGORIAS.map(c => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}
              </select>
            </Campo>

            <Campo etiqueta="Responsable" C={C}>
              <select value={fResponsable} onChange={e => setFResponsable(e.target.value)} style={estiloCampo(C)}>
                <option value="">Sin asignar</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </Campo>

            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Campo etiqueta="Fecha de emisión" C={C}>
                  <input type="date" value={fEmision} onChange={e => setFEmision(e.target.value)} style={estiloCampo(C)} />
                </Campo>
              </div>
              <div style={{ flex: 1 }}>
                <Campo etiqueta="Fecha de vencimiento" C={C}>
                  <input type="date" value={fVencimiento} onChange={e => setFVencimiento(e.target.value)} style={estiloCampo(C)} />
                </Campo>
              </div>
            </div>
            <p style={{ fontSize: 11.5, color: C.muted, margin: "0 0 16px" }}>
              Sin fecha de vencimiento el documento no genera avisos. Se puede agregar después.
            </p>

            {subiendo && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ height: 6, backgroundColor: C.cardAlt, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${progreso}%`, backgroundColor: C.orange, transition: "width .2s" }} />
                </div>
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6, textAlign: "center" }}>Subiendo… {progreso}%</div>
              </div>
            )}

            <button onClick={subir} disabled={subiendo || !archivo}
              style={{ width: "100%", minHeight: 48, backgroundColor: subiendo || !archivo ? C.border : C.orange, border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 15, cursor: subiendo || !archivo ? "default" : "pointer" }}>
              {subiendo ? "Subiendo…" : reemplazando ? "Subir nueva versión" : "Subir documento"}
            </button>
          </div>
        </>
      )}

      {/* Historial */}
      {historialDe && (
        <>
          <div onClick={() => setHistorialDe(null)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 400 }} />
          <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, backgroundColor: C.card, borderRadius: "20px 20px 0 0", zIndex: 401, padding: "10px 16px 28px", maxHeight: "78vh", overflowY: "auto" }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, margin: "0 auto 16px" }} />
            <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
              <div style={{ flex: 1, fontSize: 17, fontWeight: 800, color: C.text }}>Historial</div>
              <button onClick={() => setHistorialDe(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", minHeight: 44, minWidth: 44 }}><X size={20} /></button>
            </div>
            <p style={{ fontSize: 12.5, color: C.muted, margin: "0 0 16px", wordBreak: "break-word" }}>{historialDe.filename}</p>

            {historial.length === 0 ? (
              <div style={{ textAlign: "center", padding: 32, color: C.muted, fontSize: 13 }}>Sin movimientos registrados</div>
            ) : historial.map((h, i) => (
              <div key={i} style={{ display: "flex", gap: 12, paddingBottom: 14, marginBottom: 14, borderBottom: i < historial.length - 1 ? `0.5px solid ${C.border}` : "none" }}>
                <div style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.cardAlt, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {h.accion === "creacion" ? <Upload size={14} color={C.orange} />
                    : h.accion === "reemplazo" ? <RefreshCw size={14} color={C.orange} />
                    : h.accion === "modificacion" ? <CheckCircle2 size={14} color="#15803D" />
                    : <AlertTriangle size={14} color={C.muted} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{h.user_email || "Sistema"}</div>
                  <div style={{ fontSize: 12.5, color: C.mutedSoft, marginTop: 1 }}>
                    {({ creacion: "Subió el documento", reemplazo: "Reemplazó el documento", modificacion: "Modificó los datos", descarga: "Descargó el documento", eliminacion: "Eliminó el documento" } as Record<string, string>)[h.accion] || h.accion}
                    {h.version ? ` · v${h.version}` : ""}
                  </div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>
                    {new Date(h.created_at).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function chip(est: { color: string; fondo: string }): React.CSSProperties {
  return {
    flexShrink: 0, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: 0.4, padding: "3px 8px", borderRadius: 5,
    backgroundColor: est.fondo, color: est.color, whiteSpace: "nowrap",
  };
}

function estiloCampo(C: Record<string, string>): React.CSSProperties {
  return {
    width: "100%", minHeight: 44, padding: "10px 12px", borderRadius: 9,
    border: `1px solid ${C.border}`, backgroundColor: C.cardAlt, color: C.text,
    boxSizing: "border-box",
  };
}

function Campo({ etiqueta, C, children }: { etiqueta: string; C: Record<string, string>; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: C.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.3 }}>{etiqueta}</label>
      {children}
    </div>
  );
}
