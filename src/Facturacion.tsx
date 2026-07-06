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

type Item = { name: string; qty: number; price_neto: number; unit?: string; product_id?: string };

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
            <div style={{ fontSize: 12, fontWeight: 700, minWidth: 70, textAlign: "right" }}>{fmtCLP(it.qty * it.price_neto)}</div>
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
  const [tab, setTab] = useState<"productos" | "inventario" | "cotizaciones" | "ordenes" | "sii">("productos");
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
  const [showNewQuote, setShowNewQuote] = useState(false);
  const [qForm, setQForm] = useState({ client_name: "", client_rut: "", client_email: "", notes: "" });
  const [qItems, setQItems] = useState<Item[]>([]);
  async function loadQuotes() {
    try { const d = await fetch(`${API_URL}/obs-quotes`, { headers: h }).then(r => r.json()); if (d.ok) setQuotes(d.items); } catch {}
  }
  async function createQuote() {
    const d = await fetch(`${API_URL}/obs-quotes`, { method: "POST", headers: hj, body: JSON.stringify({ ...qForm, items: qItems }) }).then(r => r.json());
    if (!d.ok) { alert(d.message); return; }
    setQForm({ client_name: "", client_rut: "", client_email: "", notes: "" }); setQItems([]); setShowNewQuote(false); loadQuotes();
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
  const [cfgForm, setCfgForm] = useState({ dte_giro: "", dte_acteco: "", dte_direccion: "", dte_comuna: "" });
  const cafRef = useRef<HTMLInputElement>(null);
  const [showEmitir, setShowEmitir] = useState(false);
  const [dForm, setDForm] = useState({ tipo_dte: "33", rut: "", rs: "", giro: "", dir: "", comuna: "" });
  const [dItems, setDItems] = useState<Item[]>([]);
  const [emitiendo, setEmitiendo] = useState(false);

  async function loadSii() {
    try {
      const [c, f, d] = await Promise.all([
        fetch(`${API_URL}/dte/config`, { headers: h }).then(r => r.json()),
        fetch(`${API_URL}/dte/cafs`, { headers: h }).then(r => r.json()),
        fetch(`${API_URL}/dte`, { headers: h }).then(r => r.json()),
      ]);
      if (c.ok) { setDteConfig(c.config); setCfgForm({ dte_giro: c.config.dte_giro || "", dte_acteco: c.config.dte_acteco || "", dte_direccion: c.config.dte_direccion || "", dte_comuna: c.config.dte_comuna || "" }); }
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
      const d = await fetch(`${API_URL}/dte/emitir`, { method: "POST", headers: hj, body: JSON.stringify({ tipo_dte: +dForm.tipo_dte, receptor: { rut: dForm.rut, rs: dForm.rs, giro: dForm.giro, dir: dForm.dir, comuna: dForm.comuna }, items: dItems }) }).then(r => r.json());
      if (!d.ok) { alert(d.message); return; }
      alert(`✅ DTE tipo ${d.item.tipo_dte} folio ${d.item.folio} generado (${d.firma})`);
      setShowEmitir(false); setDItems([]); loadSii();
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
    if (tab === "sii") loadSii();
  }, [tab]);

  const statusColor: Record<string, string> = { borrador: C.muted, enviada: C.info, aceptada: C.success, rechazada: C.danger, recibida: C.success, generado: C.muted, enviado: C.info, aceptado: C.success, rechazado: C.danger };
  const TIPOS: Record<number, string> = { 33: "Factura", 52: "Guía Despacho", 56: "N. Débito", 61: "N. Crédito" };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.bg, color: C.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif", paddingBottom: 90 }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "14px 14px 0" }}>
        <div style={{ fontSize: 11, color: C.orange, fontWeight: 800, letterSpacing: 1 }}>MÓDULO</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>Facturación</div>

        <div style={{ display: "flex", backgroundColor: C.cardAlt, borderRadius: 10, padding: 4, marginBottom: 14, gap: 3, overflowX: "auto" }}>
          {([["productos", "📦 Productos"], ["inventario", "📊 Inventario"], ["cotizaciones", "📋 Cotizaciones"], ["ordenes", "🧾 Órdenes"], ...(isAdmin ? [["sii", "🏛 SII"]] as const : [])] as [typeof tab, string][]).map(([k, l]) => (
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

        {/* ── COTIZACIONES ── */}
        {tab === "cotizaciones" && <>
          <button onClick={() => setShowNewQuote(!showNewQuote)} style={{ ...btnP, marginBottom: 12 }}>{showNewQuote ? "Cancelar" : "＋ Nueva cotización"}</button>
          {showNewQuote && (
            <div style={card}>
              <input value={qForm.client_name} onChange={e => setQForm(f => ({ ...f, client_name: e.target.value }))} placeholder="Cliente *" style={inp} />
              <div style={{ display: "flex", gap: 8 }}>
                <input value={qForm.client_rut} onChange={e => setQForm(f => ({ ...f, client_rut: e.target.value }))} placeholder="RUT" style={{ ...inp, flex: 1 }} />
                <input value={qForm.client_email} onChange={e => setQForm(f => ({ ...f, client_email: e.target.value }))} placeholder="Correo" style={{ ...inp, flex: 2 }} />
              </div>
              <ItemsEditor items={qItems} setItems={setQItems} products={products} />
              <input value={qForm.notes} onChange={e => setQForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notas / condiciones" style={inp} />
              <button onClick={createQuote} style={btnP}>Crear cotización</button>
            </div>
          )}
          {quotes.map(q => (
            <div key={q.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>COT N°{q.folio} — {q.client_name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{fmtDate(q.created_at)} · {(q.items || []).length} ítems</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{fmtCLP(+q.total)}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: statusColor[q.status] || C.muted }}>{q.status.toUpperCase()}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => sendQuote(q)} style={{ flex: 1, height: 34, backgroundColor: C.infoDim, border: "none", borderRadius: 8, color: C.info, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>📧 Enviar</button>
                {q.status === "enviada" && <>
                  <button onClick={async () => { await fetch(`${API_URL}/obs-quotes/${q.id}`, { method: "PUT", headers: hj, body: JSON.stringify({ status: "aceptada" }) }); loadQuotes(); }} style={{ height: 34, padding: "0 12px", backgroundColor: C.successDim, border: "none", borderRadius: 8, color: C.success, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>✓</button>
                  <button onClick={async () => { await fetch(`${API_URL}/obs-quotes/${q.id}`, { method: "PUT", headers: hj, body: JSON.stringify({ status: "rechazada" }) }); loadQuotes(); }} style={{ height: 34, padding: "0 12px", backgroundColor: C.dangerDim, border: "none", borderRadius: 8, color: C.danger, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>✗</button>
                </>}
                {isAdmin && <button onClick={async () => { if (!confirm("¿Eliminar?")) return; await fetch(`${API_URL}/obs-quotes/${q.id}`, { method: "DELETE", headers: h }); loadQuotes(); }} style={{ height: 34, padding: "0 12px", backgroundColor: C.cardAlt, border: "none", borderRadius: 8, color: C.muted, fontSize: 12, cursor: "pointer" }}>🗑</button>}
              </div>
            </div>
          ))}
          {quotes.length === 0 && !showNewQuote && <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Sin cotizaciones aún</div>}
        </>}

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
                <option value="52">Guía de Despacho (52)</option>
                <option value="61">Nota de Crédito (61)</option>
                <option value="56">Nota de Débito (56)</option>
              </select>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={dForm.rut} onChange={e => setDForm(f => ({ ...f, rut: e.target.value }))} placeholder="RUT receptor *" style={{ ...inp, flex: 1 }} />
                <input value={dForm.rs} onChange={e => setDForm(f => ({ ...f, rs: e.target.value }))} placeholder="Razón social *" style={{ ...inp, flex: 2 }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={dForm.giro} onChange={e => setDForm(f => ({ ...f, giro: e.target.value }))} placeholder="Giro receptor" style={{ ...inp, flex: 1 }} />
                <input value={dForm.comuna} onChange={e => setDForm(f => ({ ...f, comuna: e.target.value }))} placeholder="Comuna" style={{ ...inp, flex: 1 }} />
              </div>
              <input value={dForm.dir} onChange={e => setDForm(f => ({ ...f, dir: e.target.value }))} placeholder="Dirección receptor" style={inp} />
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
                <button onClick={async () => {
                  const r = await fetch(`${API_URL}/dte/${d.id}/xml`, { headers: h });
                  const blob = await r.blob(); const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = `DTE_${d.tipo_dte}_${d.folio}.xml`;
                  document.body.appendChild(a); a.click(); document.body.removeChild(a);
                  setTimeout(() => URL.revokeObjectURL(url), 3000);
                }} style={{ height: 34, padding: "0 12px", backgroundColor: C.cardAlt, border: "none", borderRadius: 8, color: C.muted, fontSize: 12, cursor: "pointer" }}>⬇️ XML</button>
              </div>
            </div>
          ))}
        </>}
      </div>
    </div>
  );
}
