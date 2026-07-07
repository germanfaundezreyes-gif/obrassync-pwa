import React, { useState, useEffect, useRef } from "react";

const C = {
  bg: "#F3F4F6", card: "#FFFFFF", cardAlt: "#E9EAEC", border: "#D1D5DB",
  text: "#111827", muted: "#6B7280", mutedSoft: "#9CA3AF",
  orange: "#F97316", orangeSoft: "#FDBA74", orangeDim: "#FFF7ED",
  success: "#16A34A", successDim: "#F0FDF4", danger: "#DC2626", dangerDim: "#FEF2F2",
  info: "#2563EB", infoDim: "#EFF6FF",
};

const inp: React.CSSProperties = { width: "100%", height: 44, borderRadius: 10, border: `0.5px solid ${C.border}`, backgroundColor: C.cardAlt, color: C.text, fontSize: 14, padding: "0 12px", marginBottom: 10, boxSizing: "border-box", outline: "none" };
const btnP: React.CSSProperties = { width: "100%", height: 46, backgroundColor: C.orange, border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 };
const card: React.CSSProperties = { backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 10 };

function fmtCLP(n: number) { return "$" + Math.round(+n || 0).toLocaleString("es-CL"); }
function fmtDate(iso?: string) { if (!iso) return ""; const p = String(iso).substring(0, 10).split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso; }

type Item = { name: string; qty: number; price_neto: number; unit?: string; product_id?: string; code?: string; description?: string; afecto?: boolean; desc_pct?: number };
type Ref = { tipo_doc: string; folio: string; fecha?: string; cod?: string; razon?: string };

// ─── Editor de ítems compartido (cotización / OC / DTE) ───
function ItemsEditor({ items, setItems, products }: { items: Item[]; setItems: (i: Item[]) => void; products: any[] }) {
  const [sel, setSel] = useState("");
  function addFromProduct(id: string) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    setItems([...items, { product_id: p.id, name: p.name, qty: 1, price_neto: +p.price_neto, unit: p.unit }]);
    setSel("");
  }
  const neto = items.reduce((s, it) => s + it.qty * it.price_neto, 0);
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <select value={sel} onChange={e => { if (e.target.value === "__custom") { setItems([...items, { name: "", qty: 1, price_neto: 0, unit: "un" }]); setSel(""); } else if (e.target.value) addFromProduct(e.target.value); }} style={{ ...inp, marginBottom: 0, flex: 1 }}>
          <option value="">＋ Agregar ítem…</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name} — {fmtCLP(+p.price_neto)}</option>)}
          <option value="__custom">✏️ Ítem manual…</option>
        </select>
      </div>
      {items.map((it, i) => (
        <div key={i} style={{ backgroundColor: C.cardAlt, borderRadius: 10, padding: 10, marginBottom: 6 }}>
          <input value={it.name} onChange={e => setItems(items.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Descripción" style={{ ...inp, height: 38, marginBottom: 6, backgroundColor: C.card }} />
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="number" value={it.qty} onChange={e => setItems(items.map((x, j) => j === i ? { ...x, qty: +e.target.value } : x))} placeholder="Cant." style={{ ...inp, height: 38, marginBottom: 0, width: 70, backgroundColor: C.card }} />
            <input value={it.unit || ""} onChange={e => setItems(items.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))} placeholder="un" style={{ ...inp, height: 38, marginBottom: 0, width: 60, backgroundColor: C.card }} />
            <input type="number" value={it.price_neto} onChange={e => setItems(items.map((x, j) => j === i ? { ...x, price_neto: +e.target.value } : x))} placeholder="P. neto" style={{ ...inp, height: 38, marginBottom: 0, flex: 1, backgroundColor: C.card }} />
            <input type="number" value={it.desc_pct || ""} onChange={e => setItems(items.map((x, j) => j === i ? { ...x, desc_pct: +e.target.value } : x))} placeholder="D%" style={{ ...inp, height: 38, marginBottom: 0, width: 52, backgroundColor: C.card }} />
            <button onClick={() => setItems(items.map((x, j) => j === i ? { ...x, afecto: x.afecto === false } : x))} style={{ height: 38, padding: "0 8px", borderRadius: 8, backgroundColor: it.afecto === false ? C.cardAlt : C.successDim, color: it.afecto === false ? C.muted : C.success, fontWeight: 700, fontSize: 9, cursor: "pointer", border: `0.5px solid ${it.afecto === false ? C.border : C.success + "50"}` }}>{it.afecto === false ? "EX" : "AF"}</button>
            <div style={{ fontSize: 12, fontWeight: 700, minWidth: 64, textAlign: "right" }}>{fmtCLP(it.qty * it.price_neto * (1 - (it.desc_pct || 0) / 100))}</div>
            <button onClick={() => setItems(items.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 14 }}>✕</button>
          </div>
        </div>
      ))}
      {items.length > 0 && (
        <div style={{ textAlign: "right", fontSize: 12, color: C.muted, marginBottom: 8 }}>
          Neto {fmtCLP(neto)} · IVA {fmtCLP(neto * 0.19)} · <b style={{ color: C.text }}>Total {fmtCLP(neto * 1.19)}</b>
        </div>
      )}
    </div>
  );
}

export default function FacturacionScreen({ API_URL, token, isAdmin }: { API_URL: string; token: string; isAdmin: boolean }) {
  const [tab, setTab] = useState<"productos" | "inventario" | "cotizaciones" | "ventas" | "ordenes" | "sii">("productos");
  const h = { Authorization: `Bearer ${token}` };
  const hj = { ...h, "Content-Type": "application/json" };

  // ─── Productos ───
  const [products, setProducts] = useState<any[]>([]);
  const [showNewProd, setShowNewProd] = useState(false);
  const [pForm, setPForm] = useState({ name: "", sku: "", item_type: "producto", unit: "un", price_neto: "", stock: "" });

  async function loadProducts() {
    try { const d = await fetch(`${API_URL}/products`, { headers: h }).then(r => r.json()); if (d.ok) setProducts(d.items); } catch {}
  }

  async function createProduct() {
    if (!pForm.name.trim()) { alert("Nombre requerido"); return; }
    const d = await fetch(`${API_URL}/products`, { method: "POST", headers: hj, body: JSON.stringify({ ...pForm, price_neto: +pForm.price_neto || 0, stock: +pForm.stock || 0 }) }).then(r => r.json());
    if (!d.ok) { alert(d.message); return; }
    setPForm({ name: "", sku: "", item_type: "producto", unit: "un", price_neto: "", stock: "" });
    setShowNewProd(false); loadProducts();
  }

  // ─── Inventario ───
  const [movs, setMovs] = useState<any[]>([]);
  const [mForm, setMForm] = useState({ product_id: "", mov_type: "ingreso", quantity: "", note: "" });
  async function loadMovs() {
    try { const d = await fetch(`${API_URL}/inventory/movements`, { headers: h }).then(r => r.json()); if (d.ok) setMovs(d.items); } catch {}
  }
  async function createMov() {
    if (!mForm.product_id || !+mForm.quantity) { alert("Producto y cantidad requeridos"); return; }
    const d = await fetch(`${API_URL}/inventory/movements`, { method: "POST", headers: hj, body: JSON.stringify(mForm) }).then(r => r.json());
    if (!d.ok) { alert(d.message); return; }
    setMForm({ product_id: "", mov_type: "ingreso", quantity: "", note: "" });
    loadMovs(); loadProducts();
  }

  // ─── Cotizaciones ───
  const [quotes, setQuotes] = useState<any[]>([]);
  const [quoteView, setQuoteView] = useState<"list" | "form">("list");
  const [quoteSearch, setQuoteSearch] = useState("");
  const [openActions, setOpenActions] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const emptyQForm = { client_name: "", client_rut: "", client_email: "", client_giro: "", client_dir: "", client_ciudad: "", client_comuna: "", client_region: "", fecha_emision: today, fecha_vencimiento: in30, vendedor: "", notes: "" };
  const [qForm, setQForm] = useState(emptyQForm);
  const [qItems, setQItems] = useState<Item[]>([{ name: "", qty: 1, price_neto: 0, unit: "un", afecto: true }]);
  const [savingQuote, setSavingQuote] = useState(false);

  async function loadQuotes() {
    try { const d = await fetch(`${API_URL}/obs-quotes`, { headers: h }).then(r => r.json()); if (d.ok) setQuotes(d.items); } catch {}
  }
  const nextQuoteFolio = quotes.length > 0 ? Math.max(...quotes.map(q => +q.folio || 0)) + 1 : 1;

  async function saveQuote(mode: "borrador" | "enviar") {
    const items = qItems.filter(it => it.name.trim());
    if (!qForm.client_name.trim()) { alert("Cliente requerido"); return; }
    if (items.length === 0) { alert("Agrega al menos un ítem"); return; }
    if (mode === "enviar" && !qForm.client_email.trim()) { alert("Para enviar, ingresa el correo del cliente"); return; }
    setSavingQuote(true);
    try {
      const d = await fetch(`${API_URL}/obs-quotes`, { method: "POST", headers: hj, body: JSON.stringify({ ...qForm, items, status: mode === "borrador" ? "borrador" : "emitida" }) }).then(r => r.json());
      if (!d.ok) { alert(d.message); return; }
      if (mode === "enviar") {
        const s = await fetch(`${API_URL}/obs-quotes/${d.item.id}/send`, { method: "POST", headers: hj, body: JSON.stringify({ email: qForm.client_email }) }).then(r => r.json());
        alert(s.ok ? `✅ Cotización N°${d.item.folio} creada y enviada` : `Cotización creada pero el envío falló: ${s.message}`);
      } else {
        alert(`✅ Cotización N°${d.item.folio} guardada como borrador`);
      }
      setQForm(emptyQForm); setQItems([{ name: "", qty: 1, price_neto: 0, unit: "un", afecto: true }]);
      setQuoteView("list"); loadQuotes();
    } finally { setSavingQuote(false); }
  }

  async function sendQuote(q: any) {
    const email = q.client_email || prompt("Correo del cliente:");
    if (!email) return;
    const d = await fetch(`${API_URL}/obs-quotes/${q.id}/send`, { method: "POST", headers: hj, body: JSON.stringify({ email }) }).then(r => r.json());
    alert(d.ok ? "✅ " + d.message : d.message); if (d.ok) loadQuotes();
  }

  // ─── Órdenes de compra ───
  const [orders, setOrders] = useState<any[]>([]);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [oForm, setOForm] = useState({ supplier_name: "", supplier_rut: "", supplier_email: "", notes: "" });
  const [oItems, setOItems] = useState<Item[]>([]);
  async function loadOrders() {
    try { const d = await fetch(`${API_URL}/obs-orders`, { headers: h }).then(r => r.json()); if (d.ok) setOrders(d.items); } catch {}
  }
  async function createOrder() {
    const d = await fetch(`${API_URL}/obs-orders`, { method: "POST", headers: hj, body: JSON.stringify({ ...oForm, items: oItems }) }).then(r => r.json());
    if (!d.ok) { alert(d.message); return; }
    setOForm({ supplier_name: "", supplier_rut: "", supplier_email: "", notes: "" }); setOItems([]); setShowNewOrder(false); loadOrders();
  }
  async function sendOrder(o: any) {
    const email = o.supplier_email || prompt("Correo del proveedor:");
    if (!email) return;
    const d = await fetch(`${API_URL}/obs-orders/${o.id}/send`, { method: "POST", headers: hj, body: JSON.stringify({ email }) }).then(r => r.json());
    alert(d.ok ? "✅ " + d.message : d.message); if (d.ok) loadOrders();
  }

  // ─── SII / DTE ───
  const [dteConfig, setDteConfig] = useState<any>(null);
  const [cafs, setCafs] = useState<any[]>([]);
  const [dtes, setDtes] = useState<any[]>([]);
  const [cfgForm, setCfgForm] = useState({ dte_giro: "", dte_acteco: "", dte_direccion: "", dte_comuna: "", dte_fono: "", dte_email: "", dte_web: "" });
  const cafRef = useRef<HTMLInputElement>(null);
  const [showEmitir, setShowEmitir] = useState(false);
  const [dForm, setDForm] = useState({ tipo_dte: "33", rut: "", rs: "", giro: "", dir: "", comuna: "", fecha_vencimiento: "", forma_pago: "CRÉDITO", observaciones: "", ind_traslado: "1", descuento_global_pct: "" });
  const [dRefs, setDRefs] = useState<Ref[]>([]);
  const [dItems, setDItems] = useState<Item[]>([]);
  const [emitiendo, setEmitiendo] = useState(false);

  async function loadSii() {
    try {
      const [c, f, d] = await Promise.all([
        fetch(`${API_URL}/dte/config`, { headers: h }).then(r => r.json()),
        fetch(`${API_URL}/dte/cafs`, { headers: h }).then(r => r.json()),
        fetch(`${API_URL}/dte`, { headers: h }).then(r => r.json()),
      ]);
      if (c.ok) { setDteConfig(c.config); setCfgForm({ dte_giro: c.config.dte_giro || "", dte_acteco: c.config.dte_acteco || "", dte_direccion: c.config.dte_direccion || "", dte_comuna: c.config.dte_comuna || "", dte_fono: c.config.dte_fono || "", dte_email: c.config.dte_email || "", dte_web: c.config.dte_web || "" }); }
      if (f.ok) setCafs(f.items);
      if (d.ok) setDtes(d.items);
    } catch {}
  }
  async function saveCfg() {
    const d = await fetch(`${API_URL}/dte/config`, { method: "PUT", headers: hj, body: JSON.stringify(cfgForm) }).then(r => r.json());
    alert(d.ok ? "✅ Configuración guardada" : d.message); if (d.ok) loadSii();
  }
  async function uploadCaf(f: File) {
    const fd = new FormData(); fd.append("caf", f);
    const d = await fetch(`${API_URL}/dte/caf`, { method: "POST", headers: h, body: fd }).then(r => r.json());
    alert(d.ok ? `✅ CAF cargado: tipo ${d.item.tipo_dte}, folios ${d.item.folio_desde}-${d.item.folio_hasta}` : d.message);
    if (d.ok) loadSii();
  }
  async function emitirDte() {
    if (!dForm.rut || !dForm.rs || dItems.length === 0) { alert("Receptor e ítems requeridos"); return; }
    setEmitiendo(true);
    try {
      const d = await fetch(`${API_URL}/dte/emitir`, { method: "POST", headers: hj, body: JSON.stringify({ tipo_dte: +dForm.tipo_dte, receptor: { rut: dForm.rut, rs: dForm.rs, giro: dForm.giro, dir: dForm.dir, comuna: dForm.comuna }, items: dItems, fecha_vencimiento: dForm.fecha_vencimiento || null, forma_pago: dForm.forma_pago || null, observaciones: dForm.observaciones || null, ind_traslado: dForm.tipo_dte === "52" ? +dForm.ind_traslado : undefined, descuento_global_pct: +dForm.descuento_global_pct || 0, referencias: dRefs.filter(r => r.tipo_doc && r.folio) }) }).then(r => r.json());
      if (!d.ok) { alert(d.message); return; }
      alert(`✅ DTE tipo ${d.item.tipo_dte} folio ${d.item.folio} generado (${d.firma})`);
      setShowEmitir(false); setDItems([]); setDRefs([]); loadSii();
    } finally { setEmitiendo(false); }
  }
  async function enviarDte(id: string) {
    if (!confirm("¿Enviar este DTE al SII (ambiente certificación)?")) return;
    const d = await fetch(`${API_URL}/dte/${id}/enviar`, { method: "POST", headers: h }).then(r => r.json());
    alert(d.ok ? `✅ Enviado. Track ID: ${d.track_id}` : `Error: ${d.message || d.detalle}`);
    loadSii();
  }
  async function estadoDte(id: string) {
    const d = await fetch(`${API_URL}/dte/${id}/estado`, { headers: h }).then(r => r.json());
    alert(d.ok ? d.estado_raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 400) : d.message);
    loadSii();
  }

  useEffect(() => { loadProducts(); }, []);
  useEffect(() => {
    if (tab === "inventario") loadMovs();
    if (tab === "cotizaciones") loadQuotes();
    if (tab === "ordenes") loadOrders();
    if (tab === "sii" || tab === "ventas") loadSii();
  }, [tab]);

  async function openPdf(url: string) {
    try {
      const r = await fetch(url, { headers: h });
      if (!r.ok) { const d = await r.json().catch(() => ({}));  alert((d as any).message || "Error generando PDF"); return; }
      const blob = await r.blob();
      const u = URL.createObjectURL(blob);
      const tab2 = window.open(u, "_blank");
      if (!tab2) { const a = document.createElement("a"); a.href = u; a.download = "documento.pdf"; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
      setTimeout(() => URL.revokeObjectURL(u), 10000);
    } catch { alert("Error"); }
  }

  // Abre el XML como texto en una pestaña nueva (evita el flujo de descarga forzada,
  // que en iOS Safari/PWA dispara prompts del sistema inconsistentes)
  async function openXml(url: string, filename: string) {
    try {
      const r = await fetch(url, { headers: h });
      if (!r.ok) { const d = await r.json().catch(() => ({}));  alert((d as any).message || "Error obteniendo XML"); return; }
      const text = await r.text();
      const blob = new Blob([text], { type: "text/plain" });
      const u = URL.createObjectURL(blob);
      const tab2 = window.open(u, "_blank");
      if (!tab2) { const a = document.createElement("a"); a.href = u; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
      setTimeout(() => URL.revokeObjectURL(u), 10000);
    } catch { alert("Error"); }
  }

  function diasVenc(fv?: string) {
    if (!fv) return null;
    const d = Math.ceil((new Date(String(fv).substring(0, 10) + "T12:00:00").getTime() - Date.now()) / 86400000);
    return d;
  }

  const statusColor: Record<string, string> = { borrador: C.muted, emitida: C.success, enviada: C.info, aceptada: C.success, rechazada: C.danger, recibida: C.success, generado: C.muted, enviado: C.info, aceptado: C.success, rechazado: C.danger };
  const statusBg: Record<string, string> = { borrador: C.cardAlt, emitida: C.successDim, enviada: C.infoDim, aceptada: C.successDim, rechazada: C.dangerDim };
  const TIPOS: Record<number, string> = { 33: "Factura", 52: "Guía Despacho", 56: "N. Débito", 61: "N. Crédito" };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.bg, color: C.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif", paddingBottom: 90 }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "14px 14px 0" }}>
        <div style={{ fontSize: 11, color: C.orange, fontWeight: 800, letterSpacing: 1 }}>MÓDULO</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>Facturación</div>

        <div style={{ display: "flex", backgroundColor: C.cardAlt, borderRadius: 10, padding: 4, marginBottom: 14, gap: 3, overflowX: "auto" }}>
          {([["productos", "📦 Productos"], ["inventario", "📊 Inventario"], ["cotizaciones", "📋 Cotizaciones"], ...(isAdmin ? [["ventas", "💵 Ventas"]] as const : []), ["ordenes", "🧾 Órdenes"], ...(isAdmin ? [["sii", "🏛 SII"]] as const : [])] as [typeof tab, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: "8px 6px", borderRadius: 8, border: "none", backgroundColor: tab === k ? C.card : "transparent", color: tab === k ? C.orange : C.muted, fontWeight: 700, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>{l}</button>
          ))}
        </div>

        {/* ── PRODUCTOS ── */}
        {tab === "productos" && <>
          <button onClick={() => setShowNewProd(!showNewProd)} style={{ ...btnP, marginBottom: 12 }}>{showNewProd ? "Cancelar" : "＋ Nuevo producto o servicio"}</button>
          {showNewProd && (
            <div style={card}>
              <input value={pForm.name} onChange={e => setPForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre *" style={inp} />
              <input value={pForm.sku} onChange={e => setPForm(f => ({ ...f, sku: e.target.value }))} placeholder="Código / SKU" style={inp} />
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {(["producto", "servicio"] as const).map(t => (
                  <button key={t} onClick={() => setPForm(f => ({ ...f, item_type: t }))} style={{ flex: 1, height: 40, borderRadius: 10, border: `0.5px solid ${pForm.item_type === t ? C.orange : C.border}`, backgroundColor: pForm.item_type === t ? C.orangeDim : C.cardAlt, color: pForm.item_type === t ? C.orange : C.muted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t === "producto" ? "📦 Producto" : "🛠 Servicio"}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={pForm.unit} onChange={e => setPForm(f => ({ ...f, unit: e.target.value }))} placeholder="Unidad" style={{ ...inp, flex: 1 }} />
                <input type="number" value={pForm.price_neto} onChange={e => setPForm(f => ({ ...f, price_neto: e.target.value }))} placeholder="Precio neto" style={{ ...inp, flex: 2 }} />
              </div>
              {pForm.item_type === "producto" && <input type="number" value={pForm.stock} onChange={e => setPForm(f => ({ ...f, stock: e.target.value }))} placeholder="Stock inicial" style={inp} />}
              <button onClick={createProduct} style={btnP}>Crear</button>
            </div>
          )}
          {products.map(p => (
            <div key={p.id} style={{ ...card, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>{p.item_type === "servicio" ? "🛠" : "📦"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{p.sku ? `${p.sku} · ` : ""}{fmtCLP(+p.price_neto)} / {p.unit}{p.item_type === "producto" ? ` · Stock: ${+p.stock}` : ""}</div>
              </div>
              {isAdmin && <button onClick={async () => { if (!confirm("¿Eliminar?")) return; await fetch(`${API_URL}/products/${p.id}`, { method: "DELETE", headers: h }); loadProducts(); }} style={{ backgroundColor: C.dangerDim, border: "none", borderRadius: 6, padding: "4px 10px", color: C.danger, fontSize: 11, cursor: "pointer" }}>✕</button>}
            </div>
          ))}
          {products.length === 0 && !showNewProd && <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Sin productos aún</div>}
        </>}

        {/* ── INVENTARIO ── */}
        {tab === "inventario" && <>
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Registrar movimiento</div>
            <select value={mForm.product_id} onChange={e => setMForm(f => ({ ...f, product_id: e.target.value }))} style={inp}>
              <option value="">— Producto —</option>
              {products.filter(p => p.item_type === "producto").map(p => <option key={p.id} value={p.id}>{p.name} (stock: {+p.stock})</option>)}
            </select>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {([["ingreso", "⬆️ Ingreso"], ["salida", "⬇️ Salida"], ["ajuste", "🔧 Ajuste"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setMForm(f => ({ ...f, mov_type: k }))} style={{ flex: 1, height: 38, borderRadius: 8, border: `0.5px solid ${mForm.mov_type === k ? C.orange : C.border}`, backgroundColor: mForm.mov_type === k ? C.orangeDim : C.cardAlt, color: mForm.mov_type === k ? C.orange : C.muted, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>{l}</button>
              ))}
            </div>
            <input type="number" value={mForm.quantity} onChange={e => setMForm(f => ({ ...f, quantity: e.target.value }))} placeholder={mForm.mov_type === "ajuste" ? "Stock final" : "Cantidad"} style={inp} />
            <input value={mForm.note} onChange={e => setMForm(f => ({ ...f, note: e.target.value }))} placeholder="Nota (opcional)" style={inp} />
            <button onClick={createMov} style={btnP}>Registrar</button>
          </div>
          {movs.map(m => (
            <div key={m.id} style={{ ...card, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{m.mov_type === "ingreso" ? "⬆️" : m.mov_type === "salida" ? "⬇️" : "🔧"} {m.product_name}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: m.mov_type === "salida" ? C.danger : C.success }}>{m.mov_type === "salida" ? "-" : "+"}{+m.quantity} {m.unit}</div>
              </div>
              <div style={{ fontSize: 10, color: C.muted }}>{fmtDate(m.created_at)}{m.project_name ? ` · ${m.project_name}` : ""}{m.note ? ` · ${m.note}` : ""}</div>
            </div>
          ))}
        </>}

        {/* ── COTIZACIONES: LISTADO ── */}
        {tab === "cotizaciones" && quoteView === "list" && <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>Cotizaciones</div>
            <button onClick={() => setQuoteView("form")} style={{ backgroundColor: "#1e293b", border: "none", borderRadius: 10, padding: "10px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Crear cotización</button>
          </div>
          <input value={quoteSearch} onChange={e => setQuoteSearch(e.target.value)} placeholder="🔍 Buscar por cliente o número…" style={inp} />

          {/* Encabezado tabla */}
          <div style={{ display: "flex", padding: "8px 12px", fontSize: 10, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
            <div style={{ width: 42 }}>N°</div>
            <div style={{ width: 68 }}>Estado</div>
            <div style={{ flex: 1 }}>Cliente</div>
            <div style={{ width: 78, textAlign: "right" }}>Total</div>
            <div style={{ width: 30 }}></div>
          </div>
          {quotes
            .filter(q => !quoteSearch || (q.client_name || "").toLowerCase().includes(quoteSearch.toLowerCase()) || String(q.folio).includes(quoteSearch))
            .map(q => (
              <div key={q.id} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: "10px 12px", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ width: 42, fontSize: 13, fontWeight: 700 }}>{q.folio}</div>
                  <div style={{ width: 68 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: statusColor[q.status] || C.muted, backgroundColor: statusBg[q.status] || C.cardAlt, borderRadius: 12, padding: "3px 8px" }}>{(q.status === "emitida" ? "Emitido" : q.status).charAt(0).toUpperCase() + (q.status === "emitida" ? "Emitido" : q.status).slice(1)}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.client_name}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{fmtDate(q.fecha_emision || q.created_at)}{q.fecha_vencimiento ? ` → ${fmtDate(q.fecha_vencimiento)}` : ""}</div>
                  </div>
                  <div style={{ width: 78, textAlign: "right", fontSize: 13, fontWeight: 800 }}>{fmtCLP(+q.total)}</div>
                  <button onClick={() => setOpenActions(openActions === q.id ? null : q.id)} style={{ width: 30, background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 16 }}>⌄</button>
                </div>
                {openActions === q.id && (
                  <div style={{ display: "flex", gap: 6, marginTop: 8, paddingTop: 8, borderTop: `0.5px solid ${C.border}` }}>
                    <button onClick={() => openPdf(`${API_URL}/obs-quotes/${q.id}/pdf`)} style={{ height: 34, padding: "0 12px", backgroundColor: C.orangeDim, border: "none", borderRadius: 8, color: C.orange, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>📄 PDF</button>
                    <button onClick={() => sendQuote(q)} style={{ flex: 1, height: 34, backgroundColor: C.infoDim, border: "none", borderRadius: 8, color: C.info, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>📧 Enviar</button>
                    <button onClick={async () => { await fetch(`${API_URL}/obs-quotes/${q.id}`, { method: "PUT", headers: hj, body: JSON.stringify({ status: "aceptada" }) }); setOpenActions(null); loadQuotes(); }} style={{ height: 34, padding: "0 12px", backgroundColor: C.successDim, border: "none", borderRadius: 8, color: C.success, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>✓ Aceptada</button>
                    <button onClick={async () => { await fetch(`${API_URL}/obs-quotes/${q.id}`, { method: "PUT", headers: hj, body: JSON.stringify({ status: "rechazada" }) }); setOpenActions(null); loadQuotes(); }} style={{ height: 34, padding: "0 12px", backgroundColor: C.dangerDim, border: "none", borderRadius: 8, color: C.danger, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>✗</button>
                    {isAdmin && <button onClick={async () => { if (!confirm("¿Eliminar cotización?")) return; await fetch(`${API_URL}/obs-quotes/${q.id}`, { method: "DELETE", headers: h }); setOpenActions(null); loadQuotes(); }} style={{ height: 34, padding: "0 12px", backgroundColor: C.cardAlt, border: "none", borderRadius: 8, color: C.muted, fontSize: 12, cursor: "pointer" }}>🗑</button>}
                  </div>
                )}
              </div>
            ))}
          {quotes.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Sin cotizaciones aún</div>}
        </>}

        {/* ── COTIZACIONES: FORMULARIO (estilo Nubox) ── */}
        {tab === "cotizaciones" && quoteView === "form" && (() => {
          const validItems = qItems.filter(it => it.name.trim());
          let neto = 0, exento = 0;
          for (const it of validItems) {
            const m = Math.round(it.qty * it.price_neto);
            if (it.afecto === false) exento += m; else neto += m;
          }
          const iva = Math.round(neto * 0.19);
          const total = neto + exento + iva;
          return (
            <div style={{ ...card, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>Nueva Cotización</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>N° <b style={{ color: C.text }}>{nextQuoteFolio}</b> · automático</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: C.muted }}>Total</div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{fmtCLP(total)}</div>
                </div>
              </div>

              {/* Cliente */}
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4 }}>Cliente *</div>
              <input value={qForm.client_name} onChange={e => setQForm(f => ({ ...f, client_name: e.target.value }))} placeholder="Elige o agrega el cliente" style={inp} list="clientes-prev" />
              <datalist id="clientes-prev">
                {[...new Set(quotes.map(q => q.client_name).filter(Boolean))].map(n => <option key={n} value={n} />)}
              </datalist>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={qForm.client_rut} onChange={e => setQForm(f => ({ ...f, client_rut: e.target.value }))} placeholder="RUT" style={{ ...inp, flex: 1 }} />
                <input value={qForm.client_giro} onChange={e => setQForm(f => ({ ...f, client_giro: e.target.value }))} placeholder="Giro" style={{ ...inp, flex: 2 }} />
              </div>
              <input value={qForm.client_email} onChange={e => setQForm(f => ({ ...f, client_email: e.target.value }))} placeholder="Correo electrónico" style={inp} />
              <input value={qForm.client_dir} onChange={e => setQForm(f => ({ ...f, client_dir: e.target.value }))} placeholder="Dirección" style={inp} />
              <div style={{ display: "flex", gap: 8 }}>
                <input value={qForm.client_ciudad} onChange={e => setQForm(f => ({ ...f, client_ciudad: e.target.value }))} placeholder="Ciudad" style={{ ...inp, flex: 1 }} />
                <input value={qForm.client_comuna} onChange={e => setQForm(f => ({ ...f, client_comuna: e.target.value }))} placeholder="Comuna" style={{ ...inp, flex: 1 }} />
                <input value={qForm.client_region} onChange={e => setQForm(f => ({ ...f, client_region: e.target.value }))} placeholder="Región" style={{ ...inp, flex: 1 }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4 }}>Fecha emisión</div>
                  <input type="date" value={qForm.fecha_emision} onChange={e => setQForm(f => ({ ...f, fecha_emision: e.target.value }))} style={inp} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4 }}>Fecha vencimiento</div>
                  <input type="date" value={qForm.fecha_vencimiento} onChange={e => setQForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} style={inp} />
                </div>
              </div>
              <input value={qForm.vendedor} onChange={e => setQForm(f => ({ ...f, vendedor: e.target.value }))} placeholder="Vendedor (opcional)" style={inp} />

              {/* Ítems */}
              <div style={{ fontSize: 12, fontWeight: 800, color: C.text, margin: "10px 0 6px" }}>Ítems ({validItems.length})</div>
              {qItems.map((it, i) => (
                <div key={i} style={{ backgroundColor: C.cardAlt, borderRadius: 10, padding: 10, marginBottom: 8 }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <input value={it.code || ""} onChange={e => setQItems(qItems.map((x, j) => j === i ? { ...x, code: e.target.value } : x))} placeholder="Código" style={{ ...inp, height: 38, marginBottom: 0, width: 90, backgroundColor: C.card }} />
                    <select value={it.product_id || ""} onChange={e => {
                      const p = products.find(x => x.id === e.target.value);
                      if (p) setQItems(qItems.map((x, j) => j === i ? { ...x, product_id: p.id, name: p.name, price_neto: +p.price_neto, unit: p.unit, code: p.sku || x.code } : x));
                    }} style={{ ...inp, height: 38, marginBottom: 0, flex: 1, backgroundColor: C.card }}>
                      <option value="">Producto/servicio…</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <input value={it.name} onChange={e => setQItems(qItems.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Nombre producto / servicio *" style={{ ...inp, height: 38, marginBottom: 6, backgroundColor: C.card }} />
                  <input value={it.description || ""} onChange={e => setQItems(qItems.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="Descripción (opcional)" style={{ ...inp, height: 38, marginBottom: 6, backgroundColor: C.card }} />
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="number" value={it.qty} onChange={e => setQItems(qItems.map((x, j) => j === i ? { ...x, qty: +e.target.value } : x))} style={{ ...inp, height: 38, marginBottom: 0, width: 64, backgroundColor: C.card }} />
                    <input value={it.unit || ""} onChange={e => setQItems(qItems.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))} placeholder="un" style={{ ...inp, height: 38, marginBottom: 0, width: 52, backgroundColor: C.card }} />
                    <input type="number" value={it.price_neto || ""} onChange={e => setQItems(qItems.map((x, j) => j === i ? { ...x, price_neto: +e.target.value } : x))} placeholder="Precio" style={{ ...inp, height: 38, marginBottom: 0, flex: 1, backgroundColor: C.card }} />
                    <button onClick={() => setQItems(qItems.map((x, j) => j === i ? { ...x, afecto: x.afecto === false } : x))} style={{ height: 38, padding: "0 10px", borderRadius: 8, backgroundColor: it.afecto === false ? C.cardAlt : C.successDim, color: it.afecto === false ? C.muted : C.success, fontWeight: 700, fontSize: 10, cursor: "pointer", border: `0.5px solid ${it.afecto === false ? C.border : C.success + "50"}` }}>{it.afecto === false ? "Exento" : "Afecto"}</button>
                    <div style={{ fontSize: 12, fontWeight: 800, minWidth: 70, textAlign: "right" }}>{fmtCLP(it.qty * it.price_neto)}</div>
                    <button onClick={() => setQItems(qItems.length === 1 ? [{ name: "", qty: 1, price_neto: 0, unit: "un", afecto: true }] : qItems.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 15 }}>🗑</button>
                  </div>
                </div>
              ))}
              <button onClick={() => setQItems([...qItems, { name: "", qty: 1, price_neto: 0, unit: "un", afecto: true }])} style={{ width: "100%", height: 38, backgroundColor: C.card, border: `1px dashed ${C.border}`, borderRadius: 10, color: C.muted, fontWeight: 700, fontSize: 12, cursor: "pointer", marginBottom: 12 }}>＋ Agregar ítem</button>

              {/* Observaciones + totales */}
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4 }}>Observaciones (se incluyen en el documento)</div>
              <textarea value={qForm.notes} onChange={e => setQForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inp, height: 70, paddingTop: 10, resize: "vertical" } as React.CSSProperties} />

              <div style={{ backgroundColor: C.cardAlt, borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}><span style={{ color: C.muted }}>Neto</span><span>{fmtCLP(neto)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}><span style={{ color: C.muted }}>Exento</span><span>{fmtCLP(exento)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}><span style={{ color: C.muted }}>IVA 19%</span><span>{fmtCLP(iva)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, paddingTop: 6, borderTop: `0.5px solid ${C.border}` }}><span>Total</span><span>{fmtCLP(total)}</span></div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setQuoteView("list"); setQForm(emptyQForm); setQItems([{ name: "", qty: 1, price_neto: 0, unit: "un", afecto: true }]); }} style={{ height: 46, padding: "0 16px", backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, color: C.text, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
                <button onClick={() => saveQuote("borrador")} disabled={savingQuote} style={{ flex: 1, height: 46, backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 12, color: C.text, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{savingQuote ? "..." : "Guardar borrador"}</button>
                <button onClick={() => saveQuote("enviar")} disabled={savingQuote} style={{ flex: 1, height: 46, backgroundColor: "#1e293b", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{savingQuote ? "Guardando..." : "Guardar y enviar"}</button>
              </div>
            </div>
          );
        })()}

        {/* ── DOCUMENTOS DE VENTA ── */}
        {tab === "ventas" && isAdmin && (() => {
          const now = Date.now();
          const last30 = dtes.filter(d => now - new Date(d.created_at).getTime() < 30 * 86400000);
          const vencidos = dtes.filter(d => !d.cobrado_at && d.fecha_vencimiento && (diasVenc(d.fecha_vencimiento)! < 0));
          const porVencer = dtes.filter(d => !d.cobrado_at && d.fecha_vencimiento && (diasVenc(d.fecha_vencimiento)! >= 0) && (diasVenc(d.fecha_vencimiento)! <= 30));
          const sum = (arr: any[]) => arr.reduce((s, d) => s + (+d.total || 0), 0);
          return <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>Documentos de venta</div>
              <button onClick={() => { setTab("sii"); setShowEmitir(true); }} style={{ backgroundColor: "#1e293b", border: "none", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Registrar documento</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
              {[["Emitidos", sum(last30), last30.length, C.text, "Últimos 30 días"], ["Vencidos", sum(vencidos), vencidos.length, C.danger, "Sin cobro"], ["Por vencer", sum(porVencer), porVencer.length, "#b45309", "Próximos 30 días"]].map(([l, v, n, c, sub]) => (
                <div key={String(l)} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 10 }}>
                  <div style={{ fontSize: 10, color: C.muted }}>{l}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: c as string }}>{fmtCLP(v as number)}</div>
                  <div style={{ fontSize: 9, color: C.muted }}>{n} doc · {sub}</div>
                </div>
              ))}
            </div>
            {dtes.map(d => {
              const dv = diasVenc(d.fecha_vencimiento);
              const abrev: Record<number, string> = { 33: "FAC-EL", 52: "GD-EL", 56: "ND-EL", 61: "NC-EL" };
              return (
                <div key={d.id} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: "10px 12px", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>{abrev[d.tipo_dte] || d.tipo_dte} - {d.folio}</div>
                      <div style={{ fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.receptor_rs}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{fmtDate(d.fecha_emision || d.created_at)}
                        {dv != null && !d.cobrado_at && <span style={{ fontWeight: 700, color: dv < 0 ? C.danger : dv <= 11 ? "#b45309" : C.muted }}> · {dv < 0 ? `Vencido hace ${-dv} día${-dv !== 1 ? "s" : ""}` : `Vence en ${dv} día${dv !== 1 ? "s" : ""}`}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>{fmtCLP(+d.total)}</div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: statusColor[d.estado] || C.muted }}>{d.estado.toUpperCase()}</div>
                      {d.cobrado_at && <div style={{ fontSize: 9, fontWeight: 700, color: C.success }}>💰 COBRADO</div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    {!d.cobrado_at && <button onClick={async () => { if (!confirm("¿Registrar cobro de este documento?")) return; await fetch(`${API_URL}/dte/${d.id}/cobro`, { method: "POST", headers: h }); loadSii(); }} style={{ flex: 1, height: 32, backgroundColor: "#1e293b", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>Registrar cobro</button>}
                    <button onClick={() => openPdf(`${API_URL}/dte/${d.id}/pdf`)} style={{ height: 32, padding: "0 12px", backgroundColor: C.orangeDim, border: "none", borderRadius: 8, color: C.orange, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>📄 PDF</button>
                    {d.estado === "generado" && <button onClick={() => enviarDte(d.id)} style={{ height: 32, padding: "0 12px", backgroundColor: C.infoDim, border: "none", borderRadius: 8, color: C.info, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>📤 SII</button>}
                    {d.track_id && <button onClick={() => estadoDte(d.id)} style={{ height: 32, padding: "0 12px", backgroundColor: C.cardAlt, border: "none", borderRadius: 8, color: C.muted, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>🔍</button>}
                  </div>
                </div>
              );
            })}
            {dtes.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Sin documentos emitidos aún</div>}
          </>;
        })()}

        {/* ── ÓRDENES DE COMPRA ── */}
        {tab === "ordenes" && <>
          <button onClick={() => setShowNewOrder(!showNewOrder)} style={{ ...btnP, marginBottom: 12 }}>{showNewOrder ? "Cancelar" : "＋ Nueva orden de compra"}</button>
          {showNewOrder && (
            <div style={card}>
              <input value={oForm.supplier_name} onChange={e => setOForm(f => ({ ...f, supplier_name: e.target.value }))} placeholder="Proveedor *" style={inp} />
              <div style={{ display: "flex", gap: 8 }}>
                <input value={oForm.supplier_rut} onChange={e => setOForm(f => ({ ...f, supplier_rut: e.target.value }))} placeholder="RUT" style={{ ...inp, flex: 1 }} />
                <input value={oForm.supplier_email} onChange={e => setOForm(f => ({ ...f, supplier_email: e.target.value }))} placeholder="Correo" style={{ ...inp, flex: 2 }} />
              </div>
              <ItemsEditor items={oItems} setItems={setOItems} products={products} />
              <input value={oForm.notes} onChange={e => setOForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notas" style={inp} />
              <button onClick={createOrder} style={btnP}>Crear orden</button>
            </div>
          )}
          {orders.map(o => (
            <div key={o.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>OC N°{o.folio} — {o.supplier_name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{fmtDate(o.created_at)} · {(o.items || []).length} ítems</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{fmtCLP(+o.total)}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: statusColor[o.status] || C.muted }}>{o.status.toUpperCase()}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => sendOrder(o)} style={{ flex: 1, height: 34, backgroundColor: C.infoDim, border: "none", borderRadius: 8, color: C.info, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>📧 Enviar</button>
                {o.status === "enviada" && <button onClick={async () => { await fetch(`${API_URL}/obs-orders/${o.id}`, { method: "PUT", headers: hj, body: JSON.stringify({ status: "recibida" }) }); loadOrders(); }} style={{ height: 34, padding: "0 12px", backgroundColor: C.successDim, border: "none", borderRadius: 8, color: C.success, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>✓ Recibida</button>}
                {isAdmin && <button onClick={async () => { if (!confirm("¿Eliminar?")) return; await fetch(`${API_URL}/obs-orders/${o.id}`, { method: "DELETE", headers: h }); loadOrders(); }} style={{ height: 34, padding: "0 12px", backgroundColor: C.cardAlt, border: "none", borderRadius: 8, color: C.muted, fontSize: 12, cursor: "pointer" }}>🗑</button>}
              </div>
            </div>
          ))}
          {orders.length === 0 && !showNewOrder && <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Sin órdenes aún</div>}
        </>}

        {/* ── SII / DTE ── */}
        {tab === "sii" && isAdmin && <>
          <div style={{ backgroundColor: "#fef3c7", border: "0.5px solid #f59e0b", borderRadius: 12, padding: 12, marginBottom: 12, fontSize: 12, color: "#92400e" }}>
            ⚠️ Ambiente de <b>certificación</b> del SII (maullin.sii.cl). Los documentos emitidos aquí no tienen validez tributaria — son para el proceso de certificación.
          </div>

          {/* Configuración emisor */}
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>⚙️ Datos del emisor</div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
              RUT: <b>{dteConfig?.sii_rut || "no configurado"}</b> · Certificado: {dteConfig?.cert_ok ? "✅" : "❌ (súbelo en Gastos → SII)"}
            </div>
            <input value={cfgForm.dte_giro} onChange={e => setCfgForm(f => ({ ...f, dte_giro: e.target.value }))} placeholder="Giro (ej: Construcción y mantención)" style={inp} />
            <div style={{ display: "flex", gap: 8 }}>
              <input value={cfgForm.dte_acteco} onChange={e => setCfgForm(f => ({ ...f, dte_acteco: e.target.value }))} placeholder="Cód. actividad (ej: 429000)" style={{ ...inp, flex: 1 }} />
              <input value={cfgForm.dte_comuna} onChange={e => setCfgForm(f => ({ ...f, dte_comuna: e.target.value }))} placeholder="Comuna" style={{ ...inp, flex: 1 }} />
            </div>
            <input value={cfgForm.dte_direccion} onChange={e => setCfgForm(f => ({ ...f, dte_direccion: e.target.value }))} placeholder="Dirección casa matriz" style={inp} />
            <div style={{ display: "flex", gap: 8 }}>
              <input value={cfgForm.dte_fono} onChange={e => setCfgForm(f => ({ ...f, dte_fono: e.target.value }))} placeholder="Fono" style={{ ...inp, flex: 1 }} />
              <input value={cfgForm.dte_web} onChange={e => setCfgForm(f => ({ ...f, dte_web: e.target.value }))} placeholder="www.matfau.cl" style={{ ...inp, flex: 1 }} />
            </div>
            <input value={cfgForm.dte_email} onChange={e => setCfgForm(f => ({ ...f, dte_email: e.target.value }))} placeholder="Email (aparece en el documento)" style={inp} />
            <button onClick={saveCfg} style={btnP}>Guardar configuración</button>
          </div>

          {/* CAF */}
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>🔢 Folios CAF</div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Solicita folios en maullin.sii.cl → "Solicitud de Timbraje Electrónico" y sube aquí el XML.</div>
            <input ref={cafRef} type="file" accept=".xml" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadCaf(f); e.target.value = ""; }} />
            <button onClick={() => cafRef.current?.click()} style={{ ...btnP, marginBottom: 10 }}>⬆️ Subir archivo CAF</button>
            {cafs.map(cf => (
              <div key={cf.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderTop: `0.5px solid ${C.border}` }}>
                <span>{TIPOS[cf.tipo_dte] || cf.tipo_dte} ({cf.ambiente})</span>
                <span style={{ color: C.muted }}>folios {cf.folio_desde}-{cf.folio_hasta} · próx: <b style={{ color: cf.folio_actual > cf.folio_hasta ? C.danger : C.text }}>{cf.folio_actual > cf.folio_hasta ? "agotado" : cf.folio_actual}</b></span>
              </div>
            ))}
          </div>

          {/* Emitir */}
          <button onClick={() => setShowEmitir(!showEmitir)} style={{ ...btnP, marginBottom: 12 }}>{showEmitir ? "Cancelar" : "＋ Emitir DTE de prueba"}</button>
          {showEmitir && (
            <div style={card}>
              <select value={dForm.tipo_dte} onChange={e => setDForm(f => ({ ...f, tipo_dte: e.target.value }))} style={inp}>
                <option value="33">Factura Electrónica (33)</option>
                <option value="34">Factura Exenta (34)</option>
                <option value="46">Factura de Compra (46)</option>
                <option value="52">Guía de Despacho (52)</option>
                <option value="61">Nota de Crédito (61)</option>
                <option value="56">Nota de Débito (56)</option>
              </select>
              {dForm.tipo_dte === "52" && (
                <select value={dForm.ind_traslado} onChange={e => setDForm(f => ({ ...f, ind_traslado: e.target.value }))} style={inp}>
                  <option value="1">Traslado: Operación constituye venta</option>
                  <option value="2">Traslado: Venta por efectuar</option>
                  <option value="3">Traslado: Consignación</option>
                  <option value="5">Traslado interno (entre bodegas)</option>
                  <option value="6">Traslado: Otros no venta</option>
                </select>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <input value={dForm.rut} onChange={e => setDForm(f => ({ ...f, rut: e.target.value }))} placeholder="RUT receptor *" style={{ ...inp, flex: 1 }} />
                <input value={dForm.rs} onChange={e => setDForm(f => ({ ...f, rs: e.target.value }))} placeholder="Razón social *" style={{ ...inp, flex: 2 }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={dForm.giro} onChange={e => setDForm(f => ({ ...f, giro: e.target.value }))} placeholder="Giro receptor" style={{ ...inp, flex: 1 }} />
                <input value={dForm.comuna} onChange={e => setDForm(f => ({ ...f, comuna: e.target.value }))} placeholder="Comuna" style={{ ...inp, flex: 1 }} />
              </div>
              <input value={dForm.dir} onChange={e => setDForm(f => ({ ...f, dir: e.target.value }))} placeholder="Dirección receptor" style={inp} />
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4 }}>Vencimiento</div>
                  <input type="date" value={dForm.fecha_vencimiento} onChange={e => setDForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} style={inp} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4 }}>Forma de pago</div>
                  <select value={dForm.forma_pago} onChange={e => setDForm(f => ({ ...f, forma_pago: e.target.value }))} style={inp}>
                    <option value="CRÉDITO">Crédito</option>
                    <option value="CONTADO">Contado</option>
                    <option value="">Sin especificar</option>
                  </select>
                </div>
              </div>
              <input value={dForm.observaciones} onChange={e => setDForm(f => ({ ...f, observaciones: e.target.value }))} placeholder="Observaciones (van en el PDF)" style={inp} />
              <input type="number" value={dForm.descuento_global_pct} onChange={e => setDForm(f => ({ ...f, descuento_global_pct: e.target.value }))} placeholder="Descuento global % (ítems afectos)" style={inp} />

              {/* Referencias a otros documentos */}
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4 }}>Referencias (SET de pruebas, NC/ND → documento original)</div>
              {dRefs.map((r, i) => (
                <div key={i} style={{ backgroundColor: C.cardAlt, borderRadius: 10, padding: 8, marginBottom: 6 }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <select value={r.tipo_doc} onChange={e => setDRefs(dRefs.map((x, j) => j === i ? { ...x, tipo_doc: e.target.value } : x))} style={{ ...inp, height: 38, marginBottom: 0, flex: 2, backgroundColor: C.card }}>
                      <option value="">Tipo doc…</option>
                      <option value="SET">SET (caso de pruebas)</option>
                      <option value="33">Factura Electrónica (33)</option>
                      <option value="34">Factura Exenta (34)</option>
                      <option value="46">Factura de Compra (46)</option>
                      <option value="52">Guía Despacho (52)</option>
                      <option value="56">Nota Débito (56)</option>
                      <option value="61">Nota Crédito (61)</option>
                      <option value="801">Orden de compra (801)</option>
                    </select>
                    <input value={r.folio} onChange={e => setDRefs(dRefs.map((x, j) => j === i ? { ...x, folio: e.target.value } : x))} placeholder="Folio" style={{ ...inp, height: 38, marginBottom: 0, flex: 1, backgroundColor: C.card }} />
                    <select value={r.cod || ""} onChange={e => setDRefs(dRefs.map((x, j) => j === i ? { ...x, cod: e.target.value } : x))} style={{ ...inp, height: 38, marginBottom: 0, flex: 1, backgroundColor: C.card }}>
                      <option value="">Cód…</option>
                      <option value="1">1 Anula</option>
                      <option value="2">2 Corrige texto</option>
                      <option value="3">3 Corrige montos</option>
                    </select>
                    <button onClick={() => setDRefs(dRefs.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer" }}>✕</button>
                  </div>
                  <input value={r.razon || ""} onChange={e => setDRefs(dRefs.map((x, j) => j === i ? { ...x, razon: e.target.value } : x))} placeholder="Razón referencia (ej: CASO 4938250-1)" style={{ ...inp, height: 38, marginBottom: 0, backgroundColor: C.card }} />
                </div>
              ))}
              <button onClick={() => setDRefs([...dRefs, { tipo_doc: "", folio: "" }])} style={{ width: "100%", height: 36, backgroundColor: C.card, border: `1px dashed ${C.border}`, borderRadius: 10, color: C.muted, fontWeight: 700, fontSize: 12, cursor: "pointer", marginBottom: 10 }}>＋ Agregar referencia</button>

              <ItemsEditor items={dItems} setItems={setDItems} products={products} />
              <button onClick={emitirDte} disabled={emitiendo} style={btnP}>{emitiendo ? "Generando..." : "Generar DTE (XML + timbre + firma)"}</button>
            </div>
          )}

          {/* Listado DTE */}
          {dtes.map(d => (
            <div key={d.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{TIPOS[d.tipo_dte] || d.tipo_dte} N°{d.folio}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{d.receptor_rs} · {d.receptor_rut}</div>
                  {d.track_id && <div style={{ fontSize: 10, color: C.muted }}>Track: {d.track_id}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{fmtCLP(+d.total)}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: statusColor[d.estado] || C.muted }}>{d.estado.toUpperCase()}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {d.estado === "generado" && <button onClick={() => enviarDte(d.id)} style={{ flex: 1, height: 34, backgroundColor: C.orangeDim, border: "none", borderRadius: 8, color: C.orange, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>📤 Enviar al SII</button>}
                {d.track_id && <button onClick={() => estadoDte(d.id)} style={{ flex: 1, height: 34, backgroundColor: C.infoDim, border: "none", borderRadius: 8, color: C.info, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>🔍 Consultar estado</button>}
                <button onClick={() => openPdf(`${API_URL}/dte/${d.id}/pdf`)} style={{ height: 34, padding: "0 12px", backgroundColor: C.orangeDim, border: "none", borderRadius: 8, color: C.orange, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>📄 PDF</button>
                <button onClick={() => openXml(`${API_URL}/dte/${d.id}/xml`, `DTE_${d.tipo_dte}_${d.folio}.xml`)} style={{ height: 34, padding: "0 12px", backgroundColor: C.cardAlt, border: "none", borderRadius: 8, color: C.muted, fontSize: 12, cursor: "pointer" }}>⬇️ XML</button>
              </div>
            </div>
          ))}
        </>}
      </div>
    </div>
  );
}
