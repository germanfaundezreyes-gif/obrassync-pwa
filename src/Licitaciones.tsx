// Centro de Licitaciones — Mercado Público.
//
// Busca sobre el catálogo que ObrasSync ingiere a diario: la API oficial no admite
// búsqueda por texto ni paginación, así que consultar en vivo por cada tecleo no es
// posible ni conveniente (el cupo diario es de 10.000 peticiones y no se amplía).
//
// La API tampoco permite postular. El botón final abre la licitación en el portal para
// que la persona haga el envío, que es lo único que la ley y la plataforma admiten.

import { useState, useEffect, useCallback } from "react";
import {
  Search, ExternalLink, Star, Sparkles, AlertTriangle, CheckCircle2,
  FileText, Upload, X, Building2, MapPin, Calendar, ChevronRight, Ban,
} from "lucide-react";

type Licitacion = {
  codigo: string;
  nombre: string | null;
  descripcion: string | null;
  estado: string | null;
  organismo_nombre: string | null;
  region: string | null;
  comuna: string | null;
  fecha_publicacion: string | null;
  fecha_cierre: string | null;
  monto_estimado: number | null;
  monto_publicado: boolean;
  tipo: string | null;
  es_obra: boolean;
  url_oficial: string | null;
  detalle_completo: boolean;
  favorita?: boolean | null;
  descartada?: boolean | null;
  compatibilidad?: number | null;
  recomendacion?: string | null;
  con_bases?: boolean | null;
  n_items?: number;
  postulacion_estado?: string | null;
  fuente?: string;
  rubro?: string | null;
  ofertas_recibidas?: number | null;
  items?: { orden: number; nombre: string | null; descripcion: string | null; unidad: string | null; cantidad: number | null }[];
  analisis?: Analisis | null;
  documentos?: { id: string; filename: string; tipo: string; created_at: string }[];
};

type Analisis = {
  compatibilidad: number | null;
  recomendacion: string;
  justificacion: string;
  fortalezas: string[];
  brechas: string[];
  riesgos: string[];
  documentos_exigidos: { nombre: string; obligatorio: boolean; categoria: string }[];
  requisitos: Record<string, unknown>;
  con_bases: boolean;
};

type Resumen = {
  nuevas: number; analizadas: number; recomendadas: number; en_preparacion: number;
  documentos_pendientes: number; monto_potencial: number; compatibilidad_promedio: number | null;
  cierran_pronto: number;
};

// Cada mecanismo se distingue de un vistazo: una Compra Ágil se cotiza en días y una
// licitación exige bases, garantías y plazos. Confundirlas cuesta caro.
const FUENTES: Record<string, { etiqueta: string; color: string; fondo: string; nota: string }> = {
  licitacion:  { etiqueta: "LICITACIÓN",  color: "#1D4ED8", fondo: "#EFF4FE", nota: "Requiere bases, garantías y plazos formales" },
  compra_agil: { etiqueta: "COMPRA ÁGIL", color: "#15803D", fondo: "#EAF6EE", nota: "Compra simplificada: se cotiza directo, sin bases" },
};

const RUBROS: Record<string, string> = {
  obra_construccion: "Obras y construcción",
  mantencion: "Mantención y reparación",
  servicios: "Servicios generales",
  productos_ferreteria: "Ferretería y materiales",
  productos_clinicos: "Insumos clínicos",
  equipamiento: "Equipamiento y tecnología",
  vehiculos: "Vehículos y transporte",
  alimentos: "Alimentación",
  otros: "Otros",
};

const FILTROS = [
  { v: "", etiqueta: "Todas" },
  { v: "cierra_pronto", etiqueta: "Cierran pronto" },
  { v: "recientes", etiqueta: "Recientes" },
  { v: "compatibles", etiqueta: "Alta compatibilidad" },
  { v: "analizadas", etiqueta: "Analizadas" },
  { v: "pendientes", etiqueta: "Sin analizar" },
  { v: "favoritas", etiqueta: "Favoritas" },
  { v: "en_preparacion", etiqueta: "En preparación" },
  { v: "descartadas", etiqueta: "Descartadas" },
];

// El semáforo no afirma que la empresa cumpla: resume lo que el análisis encontró y
// deja la verificación a una persona.
function semaforo(a?: { compatibilidad?: number | null; recomendacion?: string | null } | null) {
  if (!a || a.compatibilidad === null || a.compatibilidad === undefined) return null;
  if (a.recomendacion === "no_recomendable" || a.compatibilidad < 45) return { color: "#B91C1C", fondo: "#FCEDEC", texto: "No recomendable" };
  if (a.recomendacion === "con_observaciones" || a.compatibilidad < 70) return { color: "#B45309", fondo: "#FDF4E6", texto: "Con observaciones" };
  return { color: "#15803D", fondo: "#EAF6EE", texto: "Recomendable" };
}

const fmtCLP = (n: number | null) => {
  if (n === null || n === undefined) return null;
  const v = Math.round(n);
  return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("es-CL");
};

function diasRestantes(cierre: string | null): number | null {
  if (!cierre) return null;
  return Math.ceil((new Date(cierre).getTime() - Date.now()) / 86_400_000);
}

const fecha = (v: string | null) => v ? new Date(v).toLocaleDateString("es-CL") : "—";

type Props = { API_URL: string; token: string; C: Record<string, string>; onCerrar: () => void };

export default function LicitacionesScreen({ API_URL, token, C, onCerrar }: Props) {
  const cab = { Authorization: `Bearer ${token}` };
  const [items, setItems] = useState<Licitacion[]>([]);
  const [total, setTotal] = useState(0);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [texto, setTexto] = useState("");
  const [filtro, setFiltro] = useState("");
  const [abierta, setAbierta] = useState<Licitacion | null>(null);
  const [analizando, setAnalizando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [estadoServicio, setEstadoServicio] = useState<{ ticket_configurado: boolean; cupo_restante: number; ultima_ingesta: { fecha: string } | null } | null>(null);
  const [facetas, setFacetas] = useState<{ rubros: { id: string; nombre: string; n: number }[]; regiones: { region: string; n: number }[] } | null>(null);
  const [rubros, setRubros] = useState<string[]>([]);
  const [regiones, setRegiones] = useState<string[]>([]);
  const [fuente, setFuente] = useState("");
  const alternar = (v: string, lista: string[], set: (l: string[]) => void) =>
    set(lista.includes(v) ? lista.filter(x => x !== v) : [...lista, v]);

  const buscar = useCallback(async () => {
    setCargando(true); setError("");
    try {
      const p = new URLSearchParams();
      if (texto.trim()) p.set("texto", texto.trim());
      if (filtro) p.set("filtro", filtro);
      if (rubros.length) p.set("rubro", rubros.join(","));
      if (regiones.length) p.set("region", regiones.join(","));
      if (fuente) p.set("fuente", fuente);
      const r = await fetch(`${API_URL}/mercado-publico/licitaciones?${p}`, { headers: cab });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.message || "No se pudo consultar el catálogo");
      setItems(d.items || []); setTotal(d.total || 0);
    } catch (e) { setError((e as Error).message); setItems([]); }
    finally { setCargando(false); }
  }, [texto, filtro, rubros, regiones, fuente]);

  useEffect(() => { void buscar(); }, [filtro, rubros, regiones, fuente]);
  useEffect(() => {
    fetch(`${API_URL}/mercado-publico/resumen`, { headers: cab })
      .then(r => r.json()).then(d => { if (d.ok) setResumen(d.resumen); }).catch(() => {});
    fetch(`${API_URL}/mercado-publico/estado`, { headers: cab })
      .then(r => r.json()).then(d => { if (d.ok) setEstadoServicio(d); }).catch(() => {});
    fetch(`${API_URL}/mercado-publico/facetas`, { headers: cab })
      .then(r => r.json()).then(d => { if (d.ok) setFacetas(d); }).catch(() => {});
  }, []);

  async function abrir(codigo: string) {
    setAviso("");
    try {
      const r = await fetch(`${API_URL}/mercado-publico/licitaciones/${codigo}`, { headers: cab });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.message || "No se pudo abrir la licitación");
      setAbierta(d.licitacion);
    } catch (e) { setError((e as Error).message); }
  }

  async function marcar(codigo: string, cambios: Record<string, unknown>) {
    await fetch(`${API_URL}/mercado-publico/licitaciones/${codigo}/seguimiento`, {
      method: "PATCH", headers: { ...cab, "Content-Type": "application/json" }, body: JSON.stringify(cambios),
    }).catch(() => {});
    await buscar();
    if (abierta?.codigo === codigo) await abrir(codigo);
  }

  async function analizar(codigo: string) {
    setAnalizando(true); setAviso(""); setError("");
    try {
      const r = await fetch(`${API_URL}/mercado-publico/licitaciones/${codigo}/analizar`, { method: "POST", headers: cab });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.message || "El análisis falló");
      if (d.aviso) setAviso(d.aviso);
      await abrir(codigo); await buscar();
    } catch (e) { setError((e as Error).message); }
    finally { setAnalizando(false); }
  }

  async function subirBases(codigo: string, archivo: File) {
    setAviso(""); setError("");
    const fd = new FormData(); fd.append("file", archivo);
    try {
      const r = await fetch(`${API_URL}/mercado-publico/licitaciones/${codigo}/bases`, { method: "POST", headers: cab, body: fd });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.message || "No se pudieron subir las bases");
      setAviso(d.aviso || "Bases cargadas. Vuelve a analizar para incorporar los requisitos.");
      await abrir(codigo);
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <div style={{ padding: "16px 16px 120px" }}>
      <button onClick={onCerrar} style={{ background: "none", border: "none", color: C.orange, cursor: "pointer", padding: 0, fontSize: 14, fontWeight: 600, minHeight: 44 }}>‹ Volver</button>
      <h2 style={{ fontSize: 21, fontWeight: 800, color: C.text, margin: "4px 0 2px" }}>Mercado Público</h2>
      <p style={{ fontSize: 13, color: C.muted, margin: "0 0 16px" }}>Licitaciones del Estado</p>

      {/* Sin ticket el catálogo no se actualiza: conviene decirlo antes de que alguien
          concluya que no hay licitaciones. */}
      {estadoServicio && !estadoServicio.ticket_configurado && (
        <div style={{ padding: "11px 14px", borderRadius: 9, backgroundColor: C.warnDim || "#FDF4E6", color: "#B45309", fontSize: 12.5, marginBottom: 12 }}>
          Falta el ticket de Mercado Público. El buscador muestra lo ya almacenado, pero no se incorporan licitaciones nuevas.
        </div>
      )}
      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 8, backgroundColor: C.dangerDim, color: C.danger, fontSize: 13, marginBottom: 12, display: "flex", gap: 10 }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => { setError(""); void buscar(); }} style={{ background: "none", border: "none", color: C.danger, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Reintentar</button>
        </div>
      )}
      {aviso && (
        <div style={{ padding: "10px 14px", borderRadius: 8, backgroundColor: C.cardAlt, color: C.mutedSoft, fontSize: 12.5, marginBottom: 12 }}>{aviso}</div>
      )}

      {resumen && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 14 }}>
          {[
            { n: resumen.nuevas, t: "Nuevas esta semana", c: C.text },
            { n: resumen.cierran_pronto, t: "Cierran en 3 días", c: "#B45309" },
            { n: resumen.recomendadas, t: "Recomendadas", c: "#15803D" },
            { n: resumen.en_preparacion, t: "En preparación", c: C.orange },
          ].map(x => (
            <div key={x.t} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 13 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: x.c, lineHeight: 1 }}>{x.n}</div>
              <div style={{ fontSize: 10.5, color: C.muted, marginTop: 4 }}>{x.t}</div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={e => { e.preventDefault(); void buscar(); }} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={15} color={C.muted} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
          <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escuela, pavimentación, techumbre..."
            style={{ width: "100%", minHeight: 44, padding: "10px 12px 10px 33px", borderRadius: 9, border: `1px solid ${C.border}`, backgroundColor: C.card, color: C.text, boxSizing: "border-box" }} />
        </div>
        <button type="submit" style={{ minHeight: 44, padding: "0 18px", borderRadius: 9, border: "none", backgroundColor: C.orange, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Buscar</button>
      </form>

      {/* Mecanismo. Es la primera decisión: una Compra Ágil se cotiza en días, una
          licitación es un proceso formal con bases y garantías. */}
      <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
        {[{ v: "", e: "Ambos" }, { v: "licitacion", e: "Licitaciones" }, { v: "compra_agil", e: "Compra Ágil" }].map(x => (
          <button key={x.v} onClick={() => setFuente(x.v)}
            style={{ flex: 1, minHeight: 38, borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
              border: `1px solid ${fuente === x.v ? (x.v === "compra_agil" ? "#15803D" : x.v === "licitacion" ? "#1D4ED8" : C.orange) : C.border}`,
              backgroundColor: fuente === x.v ? (x.v === "compra_agil" ? "#EAF6EE" : x.v === "licitacion" ? "#EFF4FE" : C.orangeDim) : C.card,
              color: fuente === x.v ? (x.v === "compra_agil" ? "#15803D" : x.v === "licitacion" ? "#1D4ED8" : C.orange) : C.mutedSoft }}>
            {x.e}
          </button>
        ))}
      </div>

      {/* Rubro: es lo que reduce cinco mil licitaciones a las que son del oficio. */}
      {facetas?.rubros?.length ? (
        <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 6, marginBottom: 8 }}>
          {facetas.rubros.filter(r => r.n > 0).map(r => (
            <button key={r.id} onClick={() => alternar(r.id, rubros, setRubros)}
              style={{ flexShrink: 0, minHeight: 34, padding: "6px 12px", borderRadius: 17, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${rubros.includes(r.id) ? C.orange : C.border}`,
                backgroundColor: rubros.includes(r.id) ? C.orangeDim : C.card,
                color: rubros.includes(r.id) ? C.orange : C.mutedSoft }}>
              {RUBROS[r.id] || r.nombre} <span style={{ opacity: 0.65 }}>{r.n}</span>
            </button>
          ))}
        </div>
      ) : null}

      {/* Región: se pueden marcar varias. */}
      {facetas?.regiones?.length ? (
        <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 6, marginBottom: 12 }}>
          {facetas.regiones.slice(0, 10).map(r => (
            <button key={r.region} onClick={() => alternar(r.region, regiones, setRegiones)}
              style={{ flexShrink: 0, minHeight: 34, padding: "6px 12px", borderRadius: 17, fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${regiones.includes(r.region) ? C.orange : C.border}`,
                backgroundColor: regiones.includes(r.region) ? C.orangeDim : C.card,
                color: regiones.includes(r.region) ? C.orange : C.muted }}>
              {r.region.replace(/^Regi[oó]n\s+(de\s+|del\s+)?/i, "")} <span style={{ opacity: 0.65 }}>{r.n}</span>
            </button>
          ))}
        </div>
      ) : null}

      {(rubros.length > 0 || regiones.length > 0 || fuente) && (
        <button onClick={() => { setRubros([]); setRegiones([]); setFuente(""); }}
          style={{ background: "none", border: "none", color: C.orange, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "0 0 10px", minHeight: 32 }}>
          Quitar filtros
        </button>
      )}

      <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 6, marginBottom: 14 }}>
        {FILTROS.map(f => (
          <button key={f.v} onClick={() => setFiltro(f.v)}
            style={{ flexShrink: 0, minHeight: 36, padding: "7px 13px", borderRadius: 18, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              border: `1px solid ${filtro === f.v ? C.orange : C.border}`,
              backgroundColor: filtro === f.v ? C.orangeDim : C.card,
              color: filtro === f.v ? C.orange : C.mutedSoft }}>
            {f.etiqueta}
          </button>
        ))}
      </div>

      {cargando ? (
        <div>{[0, 1, 2].map(i => (
          <div key={i} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <div style={{ height: 13, width: `${70 - i * 9}%`, backgroundColor: C.cardAlt, borderRadius: 4, marginBottom: 9 }} />
            <div style={{ height: 10, width: "45%", backgroundColor: C.cardAlt, borderRadius: 4 }} />
          </div>
        ))}</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "44px 24px", color: C.muted }}>
          <Search size={32} style={{ opacity: 0.35, marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: C.mutedSoft, marginBottom: 4 }}>
            {texto || filtro ? "Ninguna licitación coincide" : "El catálogo está vacío"}
          </div>
          <div style={{ fontSize: 12.5 }}>
            {texto || filtro ? "Prueba con otras palabras o quita los filtros."
              : estadoServicio?.ticket_configurado ? "Se llenará con la próxima sincronización diaria."
              : "Configura el ticket de Mercado Público para empezar a recibir licitaciones."}
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10 }}>{total} licitación{total === 1 ? "" : "es"}</div>
          {items.map(l => {
            const dias = diasRestantes(l.fecha_cierre);
            const s = semaforo(l);
            return (
              <div key={l.codigo} onClick={() => abrir(l.codigo)}
                style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderLeft: `3px solid ${s?.color || C.border}`, borderRadius: 12, padding: 14, marginBottom: 10, cursor: "pointer", opacity: l.descartada ? 0.55 : 1 }}>
                <div style={{ display: "flex", gap: 10, marginBottom: 7 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: C.text }}>{l.nombre || l.codigo}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 10.5, color: C.muted, marginTop: 2 }}>{l.codigo}</div>
                  </div>
                  {l.favorita && <Star size={16} color={C.orange} fill={C.orange} style={{ flexShrink: 0 }} />}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 14px", fontSize: 11.5, color: C.muted, marginBottom: 9 }}>
                  {l.organismo_nombre && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Building2 size={11} />{l.organismo_nombre}</span>}
                  {l.comuna && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={11} />{l.comuna}</span>}
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Calendar size={11} />
                    Cierra {fecha(l.fecha_cierre)}
                    {dias !== null && (
                      <b style={{ color: dias < 0 ? C.danger : dias <= 3 ? "#B45309" : C.muted, marginLeft: 3 }}>
                        {dias < 0 ? "(cerrada)" : dias === 0 ? "(hoy)" : `(${dias} d)`}
                      </b>
                    )}
                  </span>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
                  {l.monto_publicado
                    ? <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{fmtCLP(l.monto_estimado)}</span>
                    : <span style={{ fontSize: 11.5, color: C.muted, fontStyle: "italic" }}>Monto no publicado</span>}
                  {(() => {
                    const f = FUENTES[l.fuente || "licitacion"];
                    return <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5, backgroundColor: f.fondo, color: f.color, letterSpacing: 0.3 }}>{f.etiqueta}</span>;
                  })()}
                  {l.es_obra && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, backgroundColor: C.orangeDim, color: C.orange }}>OBRA</span>}
                  {typeof l.ofertas_recibidas === "number" && l.ofertas_recibidas > 0 && (
                    <span style={{ fontSize: 10.5, color: C.muted }}>{l.ofertas_recibidas} cotizando</span>
                  )}
                  {s && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, backgroundColor: s.fondo, color: s.color }}>
                      {l.compatibilidad}% · {s.texto}
                    </span>
                  )}
                  {!s && <span style={{ fontSize: 10.5, color: C.muted }}>Sin analizar</span>}
                  {l.con_bases === false && s && (
                    <span style={{ fontSize: 10, color: C.muted, fontStyle: "italic" }}>sin bases</span>
                  )}
                  <ChevronRight size={16} color={C.muted} style={{ marginLeft: "auto" }} />
                </div>
              </div>
            );
          })}
        </>
      )}

      {abierta && (
        <Detalle
          l={abierta} C={C} API_URL={API_URL} analizando={analizando}
          onCerrar={() => setAbierta(null)}
          onAnalizar={() => analizar(abierta.codigo)}
          onMarcar={c => marcar(abierta.codigo, c)}
          onBases={f => subirBases(abierta.codigo, f)}
        />
      )}
    </div>
  );
}

type Linea = {
  orden: number; descripcion: string; unidad: string | null; cantidad: number | null;
  costo_historico: number | null; precio_sugerido: number | null; total_linea: number | null;
  fuente: string | null; fuente_fecha: string | null; confianza: string | null; observacion: string;
};
type Borrador = {
  lineas: Linea[];
  resumen: { partidas: number; con_precio: number; sin_precio: number; cobertura_pct: number };
  economia: { costo_directo: number; imprevistos: number; gastos_generales: number; utilidad: number; neto: number; iva: number; total: number; margen_pct: number };
  advertencia: string | null; version: number;
};
type Requisito = { id: string; categoria: string; descripcion: string; encontrado: string | null; fuente_archivo: string | null; estado: string; accion: string | null; obligatorio: boolean };

const ESTADO_REQ: Record<string, { t: string; c: string; f: string }> = {
  cumple: { t: "Cumple", c: "#15803D", f: "#EAF6EE" },
  posible_cumplimiento: { t: "Posible — validar", c: "#B45309", f: "#FDF4E6" },
  revisar: { t: "Revisar", c: "#1D4ED8", f: "#EFF4FE" },
  falta: { t: "Falta", c: "#B91C1C", f: "#FCEDEC" },
  no_cumple: { t: "No cumple", c: "#B91C1C", f: "#FCEDEC" },
};

function Detalle({ l, C, API_URL, analizando, onCerrar, onAnalizar, onMarcar, onBases }: {
  l: Licitacion; C: Record<string, string>; API_URL: string; analizando: boolean;
  onCerrar: () => void; onAnalizar: () => void;
  onMarcar: (c: Record<string, unknown>) => void; onBases: (f: File) => void;
}) {
  const a = l.analisis;
  const s = semaforo(a);
  const dias = diasRestantes(l.fecha_cierre);
  const cab = { Authorization: `Bearer ${localStorage.getItem("obs_token")}` };

  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [requisitos, setRequisitos] = useState<Requisito[]>([]);
  const [checklist, setChecklist] = useState<{ item: string; hecho: boolean }[]>([]);
  const [trabajando, setTrabajando] = useState("");
  const [msg, setMsg] = useState("");

  const cargarExpediente = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/mercado-publico/licitaciones/${l.codigo}/postulacion`, { headers: cab });
      const d = await r.json();
      if (d.ok) setChecklist(d.checklist || []);
    } catch { /* el expediente puede no existir todavía */ }
    try {
      const r = await fetch(`${API_URL}/mercado-publico/licitaciones/${l.codigo}/requisitos`, { headers: cab });
      const d = await r.json();
      if (d.ok) setRequisitos(d.items || []);
    } catch { /* sin matriz aún */ }
  }, [l.codigo]);

  useEffect(() => { void cargarExpediente(); }, [cargarExpediente]);

  async function generarMatriz() {
    setTrabajando("matriz"); setMsg("");
    try {
      const r = await fetch(`${API_URL}/mercado-publico/licitaciones/${l.codigo}/requisitos/generar`, { method: "POST", headers: cab });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.message || "No se pudo generar la matriz");
      setRequisitos(d.items || []);
      if (d.aviso) setMsg(d.aviso);
    } catch (e) { setMsg((e as Error).message); }
    finally { setTrabajando(""); }
  }

  async function generarBorrador() {
    setTrabajando("borrador"); setMsg("");
    try {
      const r = await fetch(`${API_URL}/mercado-publico/licitaciones/${l.codigo}/borrador-economico`, { method: "POST", headers: cab });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.message || "No se pudo generar el borrador");
      setBorrador(d);
      if (d.advertencia) setMsg(d.advertencia);
      await cargarExpediente();
    } catch (e) { setMsg((e as Error).message); }
    finally { setTrabajando(""); }
  }

  async function marcarChecklist(item: string, hecho: boolean) {
    setChecklist(c => c.map(x => x.item === item ? { ...x, hecho } : x));
    await fetch(`${API_URL}/mercado-publico/licitaciones/${l.codigo}/postulacion`, {
      method: "PATCH", headers: { ...cab, "Content-Type": "application/json" },
      body: JSON.stringify({ checklist: { [item]: hecho } }),
    }).catch(() => {});
  }

  const listos = checklist.filter(c => c.hecho).length;

  return (
    <>
      <div onClick={onCerrar} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 400 }} />
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, backgroundColor: C.card, borderRadius: "20px 20px 0 0", zIndex: 401, padding: "10px 16px 28px", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, margin: "0 auto 14px" }} />
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 4 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{l.nombre || l.codigo}</div>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: C.muted, marginTop: 3 }}>{l.codigo}</div>
          </div>
          <button onClick={onCerrar} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", minHeight: 44, minWidth: 44 }}><X size={20} /></button>
        </div>

        {(() => {
          const f = FUENTES[l.fuente || "licitacion"];
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", borderRadius: 8, backgroundColor: f.fondo, marginTop: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: f.color, letterSpacing: 0.3 }}>{f.etiqueta}</span>
              <span style={{ fontSize: 11.5, color: f.color, opacity: 0.85 }}>{f.nota}</span>
            </div>
          );
        })()}

        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", fontSize: 12, color: C.muted, margin: "10px 0 14px" }}>
          {l.organismo_nombre && <span>{l.organismo_nombre}</span>}
          {l.region && <span>{l.comuna ? `${l.comuna}, ` : ""}{l.region}</span>}
          <span>Publicada {fecha(l.fecha_publicacion)}</span>
          <span>Cierra {fecha(l.fecha_cierre)}{dias !== null && dias >= 0 ? ` · ${dias} días` : ""}</span>
          {l.tipo && <span>{l.tipo}</span>}
        </div>

        {l.descripcion && (
          <p style={{ fontSize: 13.5, color: C.mutedSoft, lineHeight: 1.55, marginBottom: 14 }}>{l.descripcion}</p>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button onClick={onAnalizar} disabled={analizando}
            style={{ flex: "1 1 140px", minHeight: 46, borderRadius: 10, border: "none", backgroundColor: C.orange, color: "#fff", fontWeight: 700, fontSize: 14, cursor: analizando ? "default" : "pointer", opacity: analizando ? 0.65 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <Sparkles size={16} /> {analizando ? "Analizando…" : a ? "Volver a analizar" : "Analizar con IA"}
          </button>
          <button onClick={() => onMarcar({ favorita: !l.favorita })}
            style={{ minHeight: 46, minWidth: 46, borderRadius: 10, border: `1px solid ${C.border}`, backgroundColor: C.cardAlt, color: l.favorita ? C.orange : C.mutedSoft, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            aria-label="Marcar como favorita">
            <Star size={17} fill={l.favorita ? C.orange : "none"} />
          </button>
          <button onClick={() => onMarcar({ descartada: !l.descartada })}
            style={{ minHeight: 46, minWidth: 46, borderRadius: 10, border: `1px solid ${C.border}`, backgroundColor: C.cardAlt, color: l.descartada ? C.danger : C.mutedSoft, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            aria-label="Descartar">
            <Ban size={17} />
          </button>
        </div>

        {/* Las bases no vienen por la API: hay que descargarlas del portal y subirlas.
            Sin ellas el análisis no puede hablar de requisitos ni garantías. */}
        <Seccion titulo="Bases de la licitación" C={C}>
          {l.documentos?.length ? (
            l.documentos.map(d => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 0", fontSize: 12.5, color: C.mutedSoft }}>
                <FileText size={14} color={C.orange} />
                <span style={{ flex: 1, wordBreak: "break-word" }}>{d.filename}</span>
                <span style={{ fontSize: 11, color: C.muted }}>{fecha(d.created_at)}</span>
              </div>
            ))
          ) : (
            <p style={{ fontSize: 12.5, color: C.muted, margin: "0 0 10px" }}>
              La API de Mercado Público no entrega las bases. Descárgalas del portal y súbelas aquí —PDF, Word o Excel— para que el análisis incluya requisitos, garantías y criterios de evaluación. Si el itemizado viene en Excel, se usa para valorizar.
            </p>
          )}
          <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 42, borderRadius: 9, border: `1px dashed ${C.border}`, color: C.mutedSoft, fontSize: 12.5, fontWeight: 600, cursor: "pointer", marginTop: 6 }}>
            <Upload size={14} /> Subir bases, anexos o formularios
            <input type="file" style={{ display: "none" }} accept=".pdf,.docx,.xlsx,.xls,.csv,.txt"
              onChange={e => { const f = e.target.files?.[0]; if (f) onBases(f); e.target.value = ""; }} />
          </label>
        </Seccion>

        {a && (
          <>
            <Seccion titulo="Evaluación" C={C}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
                <div style={{ fontSize: 34, fontWeight: 800, color: s?.color || C.text, lineHeight: 1 }}>{a.compatibilidad ?? "—"}%</div>
                {s && <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6, backgroundColor: s.fondo, color: s.color }}>{s.texto}</span>}
              </div>
              {!a.con_bases && (
                <div style={{ padding: "9px 12px", borderRadius: 8, backgroundColor: C.cardAlt, fontSize: 11.5, color: C.muted, marginBottom: 11 }}>
                  Evaluación hecha solo con los datos públicos de la API. Sube las bases para incorporar requisitos y garantías.
                </div>
              )}
              <p style={{ fontSize: 13, color: C.mutedSoft, lineHeight: 1.55, margin: 0 }}>{a.justificacion}</p>
            </Seccion>

            {a.fortalezas?.length > 0 && (
              <Seccion titulo="Fortalezas" C={C}>
                {a.fortalezas.map((f, i) => (
                  <Punto key={i} icono={<CheckCircle2 size={14} color="#15803D" />} texto={f} C={C} />
                ))}
              </Seccion>
            )}
            {a.brechas?.length > 0 && (
              <Seccion titulo="Brechas" C={C}>
                {a.brechas.map((f, i) => (
                  <Punto key={i} icono={<AlertTriangle size={14} color="#B45309" />} texto={f} C={C} />
                ))}
              </Seccion>
            )}
            {a.riesgos?.length > 0 && (
              <Seccion titulo="Riesgos" C={C}>
                {a.riesgos.map((f, i) => (
                  <Punto key={i} icono={<AlertTriangle size={14} color={C.danger} />} texto={f} C={C} />
                ))}
              </Seccion>
            )}
            {a.documentos_exigidos?.length > 0 && (
              <Seccion titulo="Documentos exigidos" C={C}>
                {a.documentos_exigidos.map((d, i) => (
                  <Punto key={i} icono={<FileText size={14} color={C.muted} />} C={C}
                    texto={`${d.nombre}${d.obligatorio ? "" : " (opcional)"}`} />
                ))}
              </Seccion>
            )}
          </>
        )}

        {l.items && l.items.length > 0 && (
          <Seccion titulo={`Ítems solicitados (${l.items.length})`} C={C}>
            {l.items.slice(0, 25).map(it => (
              <div key={it.orden} style={{ display: "flex", gap: 10, padding: "7px 0", fontSize: 12.5, borderBottom: `0.5px solid ${C.border}` }}>
                <span style={{ flex: 1, color: C.mutedSoft }}>{it.nombre || it.descripcion}</span>
                <span style={{ color: C.muted, whiteSpace: "nowrap" }}>{it.cantidad ?? "?"} {it.unidad || ""}</span>
              </div>
            ))}
          </Seccion>
        )}

        {msg && (
          <div style={{ padding: "10px 13px", borderRadius: 8, backgroundColor: C.cardAlt, color: C.mutedSoft, fontSize: 12, marginBottom: 14 }}>{msg}</div>
        )}

        {/* Matriz de requisitos */}
        <Seccion titulo="Matriz de requisitos" C={C}>
          {requisitos.length === 0 ? (
            <>
              <p style={{ fontSize: 12.5, color: C.muted, margin: "0 0 9px" }}>
                Cruza lo que exige la licitación con la experiencia y los documentos de la empresa.
                {!a && " Requiere haber analizado la licitación."}
              </p>
              <button onClick={generarMatriz} disabled={!a || trabajando === "matriz"}
                style={{ width: "100%", minHeight: 42, borderRadius: 9, border: `1px solid ${C.border}`, backgroundColor: C.cardAlt, color: a ? C.text : C.muted, fontWeight: 600, fontSize: 13, cursor: a ? "pointer" : "default" }}>
                {trabajando === "matriz" ? "Generando…" : "Generar matriz"}
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 9 }}>
                Ningún estado afirma cumplimiento legal. «Posible» significa que hay evidencia candidata y requiere validación humana.
              </div>
              {requisitos.map(rq => {
                const e = ESTADO_REQ[rq.estado] || ESTADO_REQ.revisar;
                return (
                  <div key={rq.id} style={{ padding: "10px 0", borderBottom: `0.5px solid ${C.border}` }}>
                    <div style={{ display: "flex", gap: 9, alignItems: "flex-start", marginBottom: 4 }}>
                      <span style={{ flex: 1, fontSize: 12.5, color: C.text, lineHeight: 1.45 }}>{rq.descripcion}</span>
                      <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 4, backgroundColor: e.f, color: e.c, whiteSpace: "nowrap" }}>{e.t}</span>
                    </div>
                    {rq.encontrado && <div style={{ fontSize: 11.5, color: "#15803D" }}>Evidencia: {rq.encontrado}</div>}
                    {rq.fuente_archivo && <div style={{ fontSize: 11, color: C.muted }}>Fuente: {rq.fuente_archivo}</div>}
                    {rq.accion && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>Acción: {rq.accion}</div>}
                  </div>
                );
              })}
            </>
          )}
        </Seccion>

        {/* Borrador económico */}
        <Seccion titulo="Borrador económico" C={C}>
          <button onClick={generarBorrador} disabled={trabajando === "borrador"}
            style={{ width: "100%", minHeight: 44, borderRadius: 9, border: `1px solid ${C.orange}`, backgroundColor: C.orangeDim, color: C.orange, fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: borrador ? 14 : 0 }}>
            {trabajando === "borrador" ? "Calculando…" : borrador ? "Recalcular borrador" : "Generar borrador económico"}
          </button>

          {borrador && (
            <>
              <div style={{ fontSize: 11.5, color: borrador.resumen.sin_precio ? "#B45309" : C.muted, marginBottom: 10 }}>
                {borrador.resumen.con_precio} de {borrador.resumen.partidas} partidas con precio histórico ({borrador.resumen.cobertura_pct}% de cobertura)
              </div>

              {borrador.lineas.map(li => (
                <div key={li.orden} style={{ padding: "9px 0", borderBottom: `0.5px solid ${C.border}` }}>
                  <div style={{ display: "flex", gap: 9 }}>
                    <span style={{ flex: 1, fontSize: 12.5, color: C.text }}>{li.descripcion}</span>
                    <span style={{ fontSize: 11.5, color: C.muted, whiteSpace: "nowrap" }}>{li.cantidad ?? "?"} {li.unidad || ""}</span>
                  </div>
                  <div style={{ display: "flex", gap: 9, marginTop: 3, alignItems: "baseline" }}>
                    <span style={{ flex: 1, fontSize: 11, color: li.precio_sugerido === null ? C.danger : C.muted }}>
                      {li.precio_sugerido === null ? li.observacion : `${li.fuente || "sin fuente"}${li.fuente_fecha ? ` · ${String(li.fuente_fecha).slice(0, 10)}` : ""}`}
                    </span>
                    {li.confianza && (
                      <span style={{ fontSize: 9.5, fontWeight: 700, padding: "1px 6px", borderRadius: 4, whiteSpace: "nowrap",
                        backgroundColor: li.confianza === "alta" ? "#EAF6EE" : li.confianza === "media" ? "#FDF4E6" : "#F3F4F6",
                        color: li.confianza === "alta" ? "#15803D" : li.confianza === "media" ? "#B45309" : "#6B7280" }}>
                        {li.confianza}
                      </span>
                    )}
                    <span style={{ fontSize: 13, fontWeight: 700, color: li.precio_sugerido === null ? C.muted : C.text, whiteSpace: "nowrap" }}>
                      {li.precio_sugerido === null ? "—" : fmtCLP(li.precio_sugerido)}
                    </span>
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 14, padding: "12px 14px", backgroundColor: C.cardAlt, borderRadius: 10 }}>
                {[
                  ["Costo directo", borrador.economia.costo_directo],
                  ["Imprevistos", borrador.economia.imprevistos],
                  ["Gastos generales", borrador.economia.gastos_generales],
                  ["Utilidad", borrador.economia.utilidad],
                  ["Neto", borrador.economia.neto],
                  ["IVA", borrador.economia.iva],
                ].map(([t, v]) => (
                  <div key={t as string} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: C.mutedSoft, padding: "3px 0" }}>
                    <span>{t}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtCLP(v as number)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, color: C.text, paddingTop: 8, marginTop: 6, borderTop: `1px solid ${C.border}` }}>
                  <span>Total oferta</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtCLP(borrador.economia.total)}</span>
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>Margen {borrador.economia.margen_pct}% · versión {borrador.version}</div>
              </div>

              <div style={{ marginTop: 10, padding: "9px 12px", borderRadius: 8, backgroundColor: C.orangeDim, color: C.orange, fontSize: 11.5, fontWeight: 700, textAlign: "center" }}>
                BORRADOR — REQUIERE REVISIÓN HUMANA
              </div>
            </>
          )}
        </Seccion>

        {/* Checklist previo a postular */}
        {checklist.length > 0 && (
          <Seccion titulo={`Checklist de postulación (${listos}/${checklist.length})`} C={C}>
            {checklist.map(c => (
              <label key={c.item} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", minHeight: 40, fontSize: 12.5, color: c.hecho ? C.text : C.mutedSoft, cursor: "pointer" }}>
                <input type="checkbox" checked={c.hecho} onChange={e => marcarChecklist(c.item, e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: C.orange, flexShrink: 0 }} />
                <span>{c.item}</span>
              </label>
            ))}
            <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8, textAlign: "center", fontSize: 12, fontWeight: 700,
              backgroundColor: listos === checklist.length ? "#EAF6EE" : C.cardAlt,
              color: listos === checklist.length ? "#15803D" : C.muted }}>
              {listos === checklist.length ? "LISTO PARA REVISIÓN HUMANA" : `Faltan ${checklist.length - listos} puntos por revisar`}
            </div>
          </Seccion>
        )}

        {/* La API oficial no admite enviar ofertas. El envío se hace en el portal. */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 11.5, color: C.muted, margin: "0 0 10px", lineHeight: 1.5 }}>
            La postulación se realiza en el portal de Mercado Público: su API no permite enviar ofertas.
            ObrasSync prepara el análisis y la documentación; el envío lo haces tú.
          </p>
          <a href={l.url_oficial || "#"} target="_blank" rel="noreferrer"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48, borderRadius: 10, border: `1px solid ${C.orange}`, color: C.orange, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
            <ExternalLink size={16} /> ABRIR EN MERCADO PÚBLICO
          </a>
        </div>
      </div>
    </>
  );
}

function Seccion({ titulo, C, children }: { titulo: string; C: Record<string, string>; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{titulo}</div>
      {children}
    </div>
  );
}

function Punto({ icono, texto, C }: { icono: React.ReactNode; texto: string; C: Record<string, string> }) {
  return (
    <div style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "5px 0", fontSize: 12.5, color: C.mutedSoft, lineHeight: 1.5 }}>
      <span style={{ flexShrink: 0, marginTop: 2 }}>{icono}</span>
      <span>{texto}</span>
    </div>
  );
}
