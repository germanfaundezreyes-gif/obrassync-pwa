import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Camera, LogOut, Mail, Lock, Trash2, FileText, Plus, ChevronLeft, FolderOpen, Home, Eye, EyeOff, Bell, Image, MessageSquare, DollarSign, BarChart2, X, CheckCircle2, AlertTriangle, HardHat, CreditCard, Receipt, ClipboardList, Calculator, TrendingUp, Users, Settings, ChevronRight } from "lucide-react";
// Facturación se carga solo cuando se abre. Es el módulo más pesado y la mayoría de
// los usuarios en terreno nunca lo usa: no tiene por qué descargarse antes del login.
const FacturacionScreen = lazy(() => import("./Facturacion"));

// ---- Avisos de red ----------------------------------------------------------
// Antes había 18 bloques `catch (e) { console.error("[red]", e); }`: cuando una petición fallaba —lo habitual con señal
// intermitente en obra— la lista quedaba vacía y el usuario no podía distinguir "no hay
// datos" de "no hay señal". Ahora todo fallo se reporta por un canal común.
let publicarFalloRed: (mensaje: string) => void = () => {};

function avisarFalloRed(contexto: string, e: unknown) {
  console.error(`[red] ${contexto}:`, e);
  const sinConexion = typeof navigator !== "undefined" && navigator.onLine === false;
  publicarFalloRed(
    sinConexion
      ? "Sin conexión. Lo que ves puede estar incompleto."
      : `No se pudo cargar ${contexto}. Revisa la señal y reintenta.`
  );
}

// ---- Notificaciones push ----
// El navegador entrega la llave VAPID como Uint8Array, no como el base64url del servidor.
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// En iPhone el push web solo existe si la app está instalada en la pantalla de inicio.
// Safari en pestaña normal no expone PushManager, así que conviene distinguir el caso
// para poder explicárselo al usuario en vez de mostrar un error seco.
const esIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const estaInstalada = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;
const pushDisponible = () => "serviceWorker" in navigator && "PushManager" in window;


const API_URL = "https://obrassync-backend-production.up.railway.app";

const C = {
  bg: "#F3F4F6", card: "#FFFFFF", cardAlt: "#E9EAEC", border: "#D1D5DB",
  text: "#111827", muted: "#6B7280", mutedSoft: "#9CA3AF",
  orange: "#F97316", orangeSoft: "#FDBA74", orangeDim: "#FFF7ED",
  success: "#16A34A", successDim: "#F0FDF4", danger: "#DC2626", dangerDim: "#FEF2F2",
  info: "#2563EB", infoDim: "#EFF6FF", purple: "#7C3AED", purpleDim: "#F5F3FF",
};

type Screen = "home" | "proyectos" | "crearProyecto" | "fotos" | "admin" | "editarUsuario" | "crearUsuario" | "partidas" | "configuracion" | "gastos" | "cotizaciones" | "rendiciones" | "facturacion" | "estadoResultado" | "charlas";
type Rendicion = { id: string; worker_name: string; worker_email?: string; date: string; boleta_date?: string; boleta_number?: string; amount: number; vendor: string; description: string; rut_vendor?: string; category: string; image_data?: string; onedrive_url?: string; onedrive_path?: string; cost_center_id?: string; cost_center_name?: string; cost_center_code?: string; tipo?: string; doc_firmado_data?: string; doc_firmado_onedrive_url?: string; reembolso_status?: string; folio?: number; status: string; submitted_at?: string; created_at: string };
type Quotation = { id: string; client_name?: string; client_rut?: string; reference?: string; status: string; nubox_doc_number_services?: string; nubox_doc_number_materials?: string; total_services: number; total_materials: number; source_type: string; created_at: string; created_by_name?: string };
type AIQuotationResult = { client: { name: string; rut: string; email: string; address: string }; reference: string; services: AIItem[]; materials: AIItem[]; notes?: string };
type AIItem = { nubox_id: number | null; name: string; unit: string; quantity: number; price_neto: number; is_new: boolean };
type Project = { id: string; code: string; name: string; client_name?: string; start_date?: string; end_date?: string; progress_percent?: number; project_type?: string; status?: string; jefe_id?: string; supervisor_id?: string; jefe_name?: string; supervisor_name?: string; recepcion_conforme_at?: string; client_email?: string; inicio_notificado_at?: string; termino_notificado_at?: string };
type Task = { id: string; name: string; duration?: string; start_date?: string; end_date?: string; fecha_ejecucion?: string | null; progress_percent?: number; status?: string; photo_count?: number; unit?: string; quantity?: string; codigo?: string; esquema?: string };
type TaskPhoto = { id: string; filename: string; local_path?: string; onedrive_url?: string; created_at: string; taken_at?: string | null; description?: string; photo_type?: string; image_url?: string };
type QuoteItem = { tempId: string; name: string; codigo: string; quantity: string; unit: string; start_date: string; end_date: string; selected: boolean };
type User = { id: string; full_name: string; email: string; role: string; is_active: boolean; permissions?: Record<string, boolean> };
type Kpis = { proyectos: { total: number; avg_progress: number; atrasados: number }; tareas: { total: number; completadas: number; en_curso: number; atrasadas: number }; fotos: { total: number }; gastos: { total_mes: number } };
type CostCenter = { id: string; name: string; code?: string; type: string; project_name?: string; project_id?: string };
type Expense = { id: string; cost_center_id?: string; project_id?: string; category: string; supplier_name?: string; supplier_rut?: string; document_number?: string; document_type: string; amount: number; net_amount: number; tax_amount: number; expense_date: string; description?: string; project_name?: string; cost_center_name?: string; created_by_name?: string };
type ExpenseSummary = { month: string; totals: { total: number; neto: number; iva: number }; byProject: { project_name: string; total: number; count: number }[]; byCategory: { category: string; total: number; count: number }[] };

type SiiFactura = { folio: number; rut_emisor: string; razon_social: string; fecha: string; monto_neto: number; monto_iva: number; monto_total: number; tipo_dte: number; expense_id?: string; cost_center_id?: string };

const EXPENSE_CATEGORIES = [
  { value: "materiales", label: "Materiales", icon: "", color: "#B45309" },
  { value: "mano_obra", label: "Mano de obra", icon: "", color: "#1D4ED8" },
  { value: "combustible", label: "Combustible", icon: "", color: "#B91C1C" },
  { value: "herramientas", label: "Herramientas", icon: "", color: "#6D28D9" },
  { value: "transporte", label: "Transporte", icon: "", color: "#0E7490" },
  { value: "subcontrato", label: "Subcontrato", icon: "", color: "#15803D" },
  { value: "admin", label: "Administración", icon: "", color: "#4B5563" },
  { value: "otros", label: "Otros", icon: "", color: "#9CA3AF" },
];
const colorCategoria = (v?: string) => EXPENSE_CATEGORIES.find(c => c.value === v)?.color || "#9CA3AF";
// Intl con es-CL entrega "$-52.485.416", con el signo entre el peso y la cifra, que se
// lee como error tipográfico. En contabilidad chilena el menos va delante del símbolo.
const fmtCLP = (n: number) => {
  const v = Math.round(+n || 0);
  return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("es-CL");
};

const PERMISSIONS = [
  { key: "photos", label: "Fotos", sub: "Subir y ver fotos de partidas", icon: "📷" },
  { key: "projects", label: "Proyectos", sub: "Ver lista de proyectos", icon: "📁" },
  { key: "reports", label: "Informes Word", sub: "Generar y descargar informes", icon: "📄" },
  { key: "kpis", label: "KPIs inicio", sub: "Ver métricas en el dashboard", icon: "📊" },
  { key: "montos", label: "Ver montos", sub: "Ver cifras y montos de dinero", icon: "💰" },
  { key: "gastos", label: "Módulo Gastos", sub: "Ver y registrar gastos", icon: "💳" },
  { key: "gastos_resumen", label: "Gastos — Resumen", sub: "Ver pestaña de resumen y totales en Gastos", icon: "📊" },
  { key: "cotizaciones", label: "Cotizaciones", sub: "Crear y ver cotizaciones en Nubox", icon: "📋" },
  { key: "rendiciones", label: "Rendiciones", sub: "Subir boletas y rendir gastos", icon: "💰" },
  { key: "recepcion_conforme", label: "Recepción conforme", sub: "Ver proyectos completados pendientes de recepción", icon: "🟢" },
  { key: "facturacion", label: "Facturación", sub: "Productos, inventario, cotizaciones y OC", icon: "🧮" },
  { key: "estado_resultado", label: "Estado de Resultado", sub: "Ver márgenes por centro de costo (ingresos, gastos, remuneraciones)", icon: "📈" },
  { key: "admin", label: "Administración", sub: "Gestionar usuarios y permisos", icon: "👤" },
];

const ROLES = [
  { value: "administrador", label: "Admin", icon: "👑", color: "#EA580C", bg: "#FFF7ED", border: "#FDBA74" },
  { value: "jefe_obra", label: "Jefe obra", icon: "🦺", color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE" },
  { value: "inspector", label: "Trabajador", icon: "👷", color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0" },
];

const STATUS_OPTIONS = [
  { value: "pendiente", label: "Pendiente", color: "#888888", bg: "#1D1D1D" },
  { value: "en_curso", label: "En progreso", color: "#3B82F6", bg: "#0D0D1A" },
  { value: "completada", label: "Completada", color: "#22C55E", bg: "#0D1A0D" },
  { value: "atrasada", label: "Atrasada", color: "#EF4444", bg: "#1A0D0D" },
];

function fmtDate(iso?: string) { if (!iso) return ""; const p = iso.substring(0, 10).split("-"); if (p.length !== 3) return iso; return `${p[2]}/${p[1]}/${p[0]}`; }
function fmtMonth(ym: string) { const [y, m] = ym.split("-"); return new Date(+y, +m - 1).toLocaleDateString("es-CL", { month: "long", year: "numeric" }); }

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div onClick={onToggle} style={{ width: 44, height: 24, borderRadius: 12, background: on ? C.success : "#333", position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 0.2s" }}>
      <div style={{ width: 20, height: 20, background: "#fff", borderRadius: "50%", position: "absolute", top: 2, left: on ? 22 : 2, transition: "left 0.2s" }} />
    </div>
  );
}

function Av({ name, role, size = 36 }: { name: string; role?: string; size?: number }) {
  const ini = name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
  const r = role ? (ROLES.find(r => r.value === role) || ROLES[2]) : null;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: r ? r.bg : C.orangeDim, border: `1px solid ${r ? r.border : "#3A1F00"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, color: r ? r.color : C.orange, flexShrink: 0 }}>
      {ini}
    </div>
  );
}

function Badge({ status }: { status?: string }) {
  const s = STATUS_OPTIONS.find(x => x.value === (status || "pendiente")) || STATUS_OPTIONS[0];
  return <span style={{ backgroundColor: s.bg, color: s.color, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6 }}>{s.label}</span>;
}

function DraggableCreateButton({ onPress, cardColor, orangeColor }: { onPress: () => void; cardColor: string; orangeColor: string }) {
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null);
  const dragging = React.useRef(false);
  const startTouch = React.useRef<{ tx: number; ty: number; bx: number; by: number } | null>(null);
  const moved = React.useRef(false);
  const btnRef = React.useRef<HTMLDivElement>(null);

  // Posición inicial: justo encima de la barra de nav, lado derecho
  const defaultBottom = 84; // despeje sobre la barra inferior
  const defaultRight = 12;

  function getStyle(): React.CSSProperties {
    if (pos) return { position: "fixed", left: pos.x, top: pos.y, zIndex: 200, touchAction: "none" };
    return { position: "fixed", bottom: defaultBottom, right: defaultRight, zIndex: 200, touchAction: "none" };
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    const rect = btnRef.current!.getBoundingClientRect();
    dragging.current = true;
    moved.current = false;
    startTouch.current = { tx: t.clientX, ty: t.clientY, bx: rect.left, by: rect.top };
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!dragging.current || !startTouch.current) return;
    const t = e.touches[0];
    const dx = t.clientX - startTouch.current.tx;
    const dy = t.clientY - startTouch.current.ty;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved.current = true;
    if (!moved.current) return;
    e.preventDefault();
    const newX = Math.max(0, Math.min(window.innerWidth - 56, startTouch.current.bx + dx));
    const newY = Math.max(0, Math.min(window.innerHeight - 56, startTouch.current.by + dy));
    setPos({ x: newX, y: newY });
  }

  function onTouchEnd() {
    dragging.current = false;
    if (!moved.current) onPress();
  }

  return (
    <div ref={btnRef} style={getStyle()}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      onClick={() => { if (!moved.current) onPress(); }}>
      <div style={{ width: 50, height: 50, background: orangeColor, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 14px rgba(249,115,22,0.45), 0 0 0 3px ${cardColor}`, cursor: "grab" }}>
        <Plus size={22} color="#fff" />
      </div>
    </div>
  );
}

export default function App() {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem("obs_token"));
  const [userName, setUserName] = useState(() => localStorage.getItem("obs_name") || "");
  const [userRole, setUserRole] = useState(() => localStorage.getItem("obs_role") || "");
  const [userPerms, setUserPerms] = useState<Record<string, boolean>>(() => { try { return JSON.parse(localStorage.getItem("obs_perms") || "{}"); } catch { return {}; } });
  function setToken(t: string | null) { if (t) localStorage.setItem("obs_token", t); else { localStorage.removeItem("obs_token"); localStorage.removeItem("obs_name"); localStorage.removeItem("obs_role"); localStorage.removeItem("obs_perms"); } setTokenState(t); }
  const [email, setEmail] = useState(() => localStorage.getItem("remembered_email") || "");
  const [password, setPassword] = useState(() => localStorage.getItem("remembered_password") || "");
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem("remembered_email"));
  const [showPass, setShowPass] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginView, setLoginView] = useState<"login" | "forgot" | "reset">(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("reset") ? "reset" : "login";
  });
  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get("reset") || "");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [screen, setScreen] = useState<Screen>("home");
  const [taskFilter, setTaskFilter] = useState("todos");

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectCode, setProjectCode] = useState("");
  const [clientSuggestions, setClientSuggestions] = useState<{ name: string; rut: string | null; email: string | null; usos: number }[]>([]);
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjType, setNewProjType] = useState<"proyecto" | "mantenimiento">("proyecto");
  const [newProjJefe, setNewProjJefe] = useState("");
  const [newProjSupervisor, setNewProjSupervisor] = useState("");
  const [projTab, setProjTab] = useState<"resumen" | "proyecto" | "mantenimiento" | "equipo">("resumen");
  const [staff, setStaff] = useState<any[]>([]);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffRole, setNewStaffRole] = useState<"jefe" | "supervisor">("jefe");
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [projStaffFilter, setProjStaffFilter] = useState("");
  const [priorities, setPriorities] = useState<any[]>([]);
  const [projFiles, setProjFiles] = useState<any[]>([]);
  const [projFilesOpen, setProjFilesOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<{ files: File[]; type: "cotizacion" | "orden_compra" } | null>(null);
  const [cotVisibleTo, setCotVisibleTo] = useState<string[]>([]);
  const [sendingRecepcion, setSendingRecepcion] = useState(false);
  const [clientEmail, setClientEmail] = useState("");
  const [notifying, setNotifying] = useState<"" | "inicio" | "termino">("");
  const [notifyPanel, setNotifyPanel] = useState<{ tipo: "inicio" | "termino"; resend: boolean } | null>(null);
  const [notifyDate, setNotifyDate] = useState(new Date().toISOString().slice(0, 10));
  const [projectResultado, setProjectResultado] = useState<{ items: ERCenter[] } | null>(null);
  const [loadingProjectResultado, setLoadingProjectResultado] = useState(false);
  const cotFileRef = useRef<HTMLInputElement>(null);
  const ocFileRef = useRef<HTMLInputElement>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editProj, setEditProj] = useState<{ project_type: string; status: string; jefe_id: string; supervisor_id: string; client_email: string }>({ project_type: "proyecto", status: "activo", jefe_id: "", supervisor_id: "", client_email: "" });
  const [savingProject, setSavingProject] = useState(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [ganttFile, setGanttFile] = useState<File | null>(null);
  const [uploadingGantt, setUploadingGantt] = useState(false);
  const [showGantt, setShowGantt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [photos, setPhotos] = useState<TaskPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [generatingReport, setGeneratingReport] = useState(false);

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskStatus, setTaskStatus] = useState("pendiente");
  const [taskProgress, setTaskProgress] = useState(0);
  const [taskName, setTaskName] = useState("");
  const [taskUnit, setTaskUnit] = useState("");
  const [taskQuantity, setTaskQuantity] = useState("");
  const [taskFecha, setTaskFecha] = useState("");
  const [showVisita, setShowVisita] = useState(false);
  const [visitaVideo, setVisitaVideo] = useState<File | null>(null);
  const [visitaAudio, setVisitaAudio] = useState<File | null>(null);
  const [grabandoAudio, setGrabandoAudio] = useState(false);
  const [subiendoVisita, setSubiendoVisita] = useState(false);
  const [visitaResultado, setVisitaResultado] = useState<any>(null);
  const mediaRec = useRef<MediaRecorder | null>(null);
  const [charlaFoto, setCharlaFoto] = useState<File | null>(null);
  const [charlaNotas, setCharlaNotas] = useState("");
  const [subiendoCharla, setSubiendoCharla] = useState(false);
  const [charlas, setCharlas] = useState<any[]>([]);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [pushEstado, setPushEstado] = useState<"off" | "on" | "no-soportado" | "ios-no-instalada">("off");
  const [pushCargando, setPushCargando] = useState(false);
  const [pushMsg, setPushMsg] = useState("");
  const [falloRed, setFalloRed] = useState("");
  const [sinConexion, setSinConexion] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);

  // Canal único para los fallos de red de toda la app, incluidos los módulos que viven
  // en otros componentes y no alcanzan este estado.
  useEffect(() => {
    publicarFalloRed = (m: string) => setFalloRed(m);
    const arriba = () => { setSinConexion(false); setFalloRed(""); };
    const abajo = () => setSinConexion(true);
    window.addEventListener("online", arriba);
    window.addEventListener("offline", abajo);
    return () => {
      publicarFalloRed = () => {};
      window.removeEventListener("online", arriba);
      window.removeEventListener("offline", abajo);
    };
  }, []);

  // El aviso se retira solo: es informativo, no requiere que el usuario lo cierre.
  useEffect(() => {
    if (!falloRed) return;
    const t = setTimeout(() => setFalloRed(""), 6000);
    return () => clearTimeout(t);
  }, [falloRed]);

  // Registra el service worker al abrir la app y refleja si ya hay suscripción activa.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) { setPushEstado("no-soportado"); return; }
    navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      if (!pushDisponible()) {
        setPushEstado(esIOS() && !estaInstalada() ? "ios-no-instalada" : "no-soportado");
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      setPushEstado(sub ? "on" : "off");
    }).catch(() => setPushEstado("no-soportado"));
  }, []);

  const activarPush = async () => {
    if (!token) return;
    setPushCargando(true);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setPushMsg("❌ Permiso de notificaciones denegado. Actívalo en los ajustes del teléfono.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await fetch(`${API_URL}/push/vapid`).then(r => r.json());
      if (!publicKey) { setPushMsg("❌ El servidor aún no tiene configuradas las notificaciones."); return; }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const r = await fetch(`${API_URL}/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!r.ok) throw new Error("El servidor rechazó la suscripción");
      setPushEstado("on");
      setPushMsg("✅ Notificaciones activadas en este dispositivo.");
    } catch (e) {
      setPushMsg("❌ No se pudieron activar: " + (e as Error).message);
    } finally { setPushCargando(false); }
  };

  // Envía una notificación solo a los dispositivos de quien la pide, para comprobar
  // que el permiso quedó realmente concedido en este teléfono.
  const probarPush = async () => {
    setPushCargando(true);
    try {
      const r = await fetch(`${API_URL}/push/test`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setPushMsg(d.enviados > 0
        ? `✅ Enviada a ${d.enviados} dispositivo${d.enviados === 1 ? "" : "s"}. Debería aparecer en unos segundos.`
        : `❌ No hay dispositivos suscritos${d.motivo ? ": " + d.motivo : "."}`);
    } catch (e) {
      setPushMsg("❌ " + (e as Error).message);
    } finally { setPushCargando(false); }
  };

  const desactivarPush = async () => {
    setPushCargando(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // Se avisa al servidor antes de romper la suscripción local: si el orden se
        // invierte se pierde el endpoint y queda una fila muerta en la base.
        await fetch(`${API_URL}/push/unsubscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      setPushEstado("off");
      setPushMsg("✅ Notificaciones desactivadas en este dispositivo.");
    } catch (e) {
      setPushMsg("❌ " + (e as Error).message);
    } finally { setPushCargando(false); }
  };

  const [prevResumen, setPrevResumen] = useState<any[]>([]);
  const [savingTask, setSavingTask] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState("inspector");
  const [editActive, setEditActive] = useState(true);
  const [editPermissions, setEditPermissions] = useState<Record<string, boolean>>({});
  const [savingUser, setSavingUser] = useState(false);

  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("inspector");
  const [newUserPermissions, setNewUserPermissions] = useState<Record<string, boolean>>({ photos: true });
  const [creatingUser, setCreatingUser] = useState(false);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // PDF Quote import
  const [showQuoteImport, setShowQuoteImport] = useState(false);
  const [quoteStep, setQuoteStep] = useState<1 | 2>(1);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [extractingPdf, setExtractingPdf] = useState(false);
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [globalStartDate, setGlobalStartDate] = useState("");
  const [globalEndDate, setGlobalEndDate] = useState("");
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // KPIs
  const [kpis, setKpis] = useState<Kpis | null>(null);

  // Gastos
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseSummary, setExpenseSummary] = useState<ExpenseSummary | null>(null);
  const [gastosTab, setGastosTab] = useState<"resumen" | "lista" | "centros" | "sii" | "nubox">("resumen");
  const [nuboxPurchases, setNuboxPurchases] = useState<any[]>([]);
  const [nuboxLoading, setNuboxLoading] = useState(false);
  const [nuboxError, setNuboxError] = useState<string | null>(null);
  const [nuboxAssigning, setNuboxAssigning] = useState<string | null>(null);
  const [nuboxSelectedProject, setNuboxSelectedProject] = useState<Record<string, string>>({});
  const [nuboxShowAll, setNuboxShowAll] = useState(false);
  const [nuboxView, setNuboxView] = useState<"compras" | "ventas">("compras");
  const [nuboxExpanded, setNuboxExpanded] = useState<Record<string, boolean>>({});
  const [nuboxDetail, setNuboxDetail] = useState<Record<string, any>>({});
  const [nuboxDetailLoading, setNuboxDetailLoading] = useState<Record<string, boolean>>({});
  const [nuboxSummary, setNuboxSummary] = useState<any | null>(null);
  const [nuboxKpiExpanded, setNuboxKpiExpanded] = useState(false);
  const [nuboxSalesSummary, setNuboxSalesSummary] = useState<any | null>(null);
  const [nuboxSalesAssigning, setNuboxSalesAssigning] = useState<string | null>(null);
  const [nuboxSalesProject, setNuboxSalesProject] = useState<Record<string, string>>({});
  const [payroll, setPayroll] = useState<any | null>(null);
  const [showPayrollForm, setShowPayrollForm] = useState(false);
  const [payrollAmount, setPayrollAmount] = useState("");
  const [payrollNote, setPayrollNote] = useState("");
  const [savingPayroll, setSavingPayroll] = useState(false);
  const [uploadingPayrollPdf, setUploadingPayrollPdf] = useState(false);
  const [payrollPdfResult, setPayrollPdfResult] = useState<any | null>(null);
  const payrollPdfRef = useRef<HTMLInputElement>(null);
  const [gastosMonth, setGastosMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expCategory, setExpCategory] = useState("materiales");
  const [expSupplier, setExpSupplier] = useState("");
  const [expRut, setExpRut] = useState("");
  const [expDocNum, setExpDocNum] = useState("");
  const [expDocType, setExpDocType] = useState("factura");
  const [expAmount, setExpAmount] = useState("");
  const [expDate, setExpDate] = useState(new Date().toISOString().slice(0, 10));
  const [expDesc, setExpDesc] = useState("");
  const [expProjectId, setExpProjectId] = useState("");
  const [expCostCenterId, setExpCostCenterId] = useState("");
  const [savingExpense, setSavingExpense] = useState(false);
  const [newCCName, setNewCCName] = useState("");
  const [newCCCode, setNewCCCode] = useState("");
  const [creatingCC, setCreatingCC] = useState(false);
  const [editingCC, setEditingCC] = useState<string | null>(null);
  const [editCCName, setEditCCName] = useState("");
  const [editCCCode, setEditCCCode] = useState("");
  const [savingCC, setSavingCC] = useState(false);
  const [trashTasks, setTrashTasks] = useState<any[]>([]);
  const [trashOpen, setTrashOpen] = useState(false);

  // SII
  const [siiP12File, setSiiP12File] = useState<File | null>(null);
  const [siiPassword, setSiiPassword] = useState("");
  const [siiRut, setSiiRut] = useState("76982672-6");
  const [uploadingSii, setUploadingSii] = useState(false);
  const [siiFacturas, setSiiFacturas] = useState<SiiFactura[]>([]);
  const [loadingSiiFacturas, setLoadingSiiFacturas] = useState(false);
  const [siiConfigured, setSiiConfigured] = useState(false);
  const [siiConfigRut, setSiiConfigRut] = useState("");
  const siiP12Ref = useRef<HTMLInputElement>(null);

  // Photo description
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [photoDescInput, setPhotoDescInput] = useState("");
  const [photoTypeInput, setPhotoTypeInput] = useState<"previa" | "trabajo">("trabajo");
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [editingPhotoDesc, setEditingPhotoDesc] = useState("");
  const [editingPhotoDate, setEditingPhotoDate] = useState("");
  const [savingPhotoDesc, setSavingPhotoDesc] = useState(false);

  const isAdmin = userRole === "administrador" || userRole === "admin";
  // Permisos: admin siempre tiene todo, otros según asignación
  const canSee = (key: string) => isAdmin || userPerms[key] === true;
  const canSeeKpis = canSee("kpis");
  const canSeeMontos = canSee("montos");
  const canSeeGastos = canSee("gastos");
  const canSeeGastosResumen = canSee("gastos_resumen");
  const canSeeReports = canSee("reports");
  const canSeeCotizaciones = canSee("cotizaciones");
  const canSeeRendiciones = canSee("rendiciones");
  const canSeeRecepcion = isAdmin || canSee("recepcion_conforme");
  const canSeeFacturacion = isAdmin || canSee("facturacion");
  const canSeeEstadoResultado = isAdmin || canSee("estado_resultado");

  useEffect(() => { if (token) { loadProjects(); loadKpis(); loadStaff(); loadPriorities(); if (isAdmin) { loadUsers(); loadCostCenters(); } } }, [token]);
  // Al abrir "nuevo proyecto": sugiere el siguiente correlativo y trae los clientes ya usados.
  // Solo rellena el código si está vacío, para no pisar lo que el usuario haya escrito.
  useEffect(() => {
    if (screen !== "crearProyecto" || !token) return;
    const h = { Authorization: `Bearer ${token}` };
    fetch(`${API_URL}/projects/next-code`, { headers: h }).then(r => r.json())
      .then(r => { if (r.ok) setProjectCode(prev => prev || r.code); }).catch(() => {});
    fetch(`${API_URL}/clients/suggestions`, { headers: h }).then(r => r.json())
      .then(r => { if (r.ok) setClientSuggestions(r.items || []); }).catch(() => {});
  }, [screen, token]);
  useEffect(() => { if (selectedProject && token) { loadTasks(selectedProject.id); loadProjFiles(selectedProject.id); } }, [selectedProject]);

  // Auto-logout por inactividad (30 minutos)
  useEffect(() => {
    if (!token) return;
    const TIMEOUT = 30 * 60 * 1000;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setToken(null);
        setTasks([]); setSelectedProject(null); setScreen("home");
        alert("Sesión cerrada por inactividad.");
      }, TIMEOUT);
    };
    const events = ["mousedown", "touchstart", "keydown", "scroll", "click"];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [token]);

  const inp: React.CSSProperties = { width: "100%", height: 48, backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 14, padding: "0 14px", marginBottom: 10, boxSizing: "border-box", outline: "none" };
  const btnPrimary: React.CSSProperties = { width: "100%", height: 50, backgroundColor: C.orange, border: "none", borderRadius: 12, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" };

  async function handleLogin() {
    if (!email || !password) return;
    setLoginLoading(true);
    try {
      const r = await fetch(`${API_URL}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Credenciales inválidas"); return; }
      if (rememberMe) {
        localStorage.setItem("remembered_email", email);
        localStorage.setItem("remembered_password", password);
      } else {
        localStorage.removeItem("remembered_email");
        localStorage.removeItem("remembered_password");
      }
      const name = d.user?.fullName || "Usuario"; const role = d.user?.role || ""; const perms = d.user?.permissions || {};
      localStorage.setItem("obs_name", name); localStorage.setItem("obs_role", role); localStorage.setItem("obs_perms", JSON.stringify(perms));
      setToken(d.token); setUserName(name); setUserRole(role); setUserPerms(perms);
    } catch { alert("No se pudo conectar al servidor"); } finally { setLoginLoading(false); }
  }

  async function handleForgotPassword() {
    if (!forgotEmail) return;
    setForgotLoading(true);
    try {
      await fetch(`${API_URL}/auth/forgot-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: forgotEmail }) });
      setForgotSent(true);
    } catch { alert("No se pudo conectar al servidor"); } finally { setForgotLoading(false); }
  }

  async function handleResetPassword() {
    if (!newPassword || newPassword.length < 6) { alert("La contraseña debe tener al menos 6 caracteres"); return; }
    if (newPassword !== newPassword2) { alert("Las contraseñas no coinciden"); return; }
    setResetLoading(true);
    try {
      const r = await fetch(`${API_URL}/auth/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: resetToken, password: newPassword }) });
      const d = await r.json();
      if (!d.ok) { alert(d.message || "Link inválido o expirado"); return; }
      setResetDone(true);
      window.history.replaceState({}, "", window.location.pathname);
    } catch { alert("No se pudo conectar al servidor"); } finally { setResetLoading(false); }
  }

  async function loadProjects() {
    try { const r = await fetch(`${API_URL}/projects`, { headers: { Authorization: `Bearer ${token}` } }); const d = await r.json(); setProjects(d.items || []); } catch (e) { avisarFalloRed("los proyectos", e); }
  }

  async function createProject() {
    if (!projectCode || !projectName) { alert("Código y nombre son obligatorios"); return; }
    setCreatingProject(true);
    try {
      const r = await fetch(`${API_URL}/projects`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ code: projectCode, name: projectName, clientName, clientEmail: clientEmail || null, startDate: startDate || null, endDate: endDate || null, projectType: newProjType, jefeId: newProjJefe || null, supervisorId: newProjSupervisor || null }) });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error"); return; }
      setProjectCode(""); setProjectName(""); setClientName(""); setClientEmail(""); setStartDate(""); setEndDate(""); setNewProjJefe(""); setNewProjSupervisor("");
      await loadProjects(); setScreen("proyectos");
    } catch { alert("Error creando proyecto"); } finally { setCreatingProject(false); }
  }

  async function loadProjFiles(projectId: string) {
    try { const r = await fetch(`${API_URL}/projects/${projectId}/files`, { headers: { Authorization: `Bearer ${token}` } }); const d = await r.json(); if (d.ok) setProjFiles(d.items || []); } catch (e) { avisarFalloRed("los proyectos", e); }
  }

  async function uploadProjFiles(files: File[], fileType: "cotizacion" | "orden_compra", visibleTo: string[]) {
    if (!selectedProject || files.length === 0) return;
    setUploadingFile(true);
    try {
      const errores: string[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("file_type", fileType);
        if (visibleTo.length > 0) fd.append("visible_to", JSON.stringify(visibleTo));
        try {
          const r = await fetch(`${API_URL}/projects/${selectedProject.id}/files`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
          const d = await r.json();
          if (!d.ok) errores.push(`${file.name}: ${d.message || "Error"}`);
        } catch { errores.push(`${file.name}: error de conexión`); }
      }
      if (errores.length > 0) alert("Algunos archivos fallaron:\n" + errores.join("\n"));
      await loadProjFiles(selectedProject.id);
    } finally { setUploadingFile(false); setPendingUpload(null); setCotVisibleTo([]); }
  }

  function openNotifyPanel(tipo: "inicio" | "termino", resend: boolean) {
    if (!selectedProject) return;
    if (!selectedProject.client_email) { alert("El proyecto no tiene correo de cliente. Edítalo (✏️ en la lista de proyectos) y agrega el correo primero."); return; }
    setNotifyDate(new Date().toISOString().slice(0, 10));
    setNotifyPanel({ tipo, resend });
  }

  async function notifyClientWorks() {
    if (!selectedProject || !notifyPanel) return;
    const { tipo, resend } = notifyPanel;
    setNotifying(tipo);
    try {
      const r = await fetch(`${API_URL}/projects/${selectedProject.id}/notificar-${tipo}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ fecha: notifyDate, resend }) });
      const d = await r.json();
      if (!d.ok) { alert(d.message || "Error"); return; }
      alert("✅ " + d.message);
      const flag = tipo === "inicio" ? "inicio_notificado_at" : "termino_notificado_at";
      setSelectedProject({ ...selectedProject, [flag]: notifyDate + "T12:00:00" } as Project);
      setNotifyPanel(null);
      await loadProjects();
    } catch { alert("Error"); } finally { setNotifying(""); }
  }

  async function sendRecepcionConforme() {
    if (!selectedProject) return;
    if (!confirm("¿Confirmar recepción conforme? Se generará el informe con IA y se enviará el correo a Paulette con la cotización y orden de compra adjuntas.")) return;
    setSendingRecepcion(true);
    try {
      const r = await fetch(`${API_URL}/projects/${selectedProject.id}/recepcion-conforme`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!d.ok) { alert(d.message || "Error"); return; }
      alert("✅ " + d.message);
      setSelectedProject({ ...selectedProject, recepcion_conforme_at: new Date().toISOString() } as Project);
      await loadProjects();
    } catch { alert("Error"); } finally { setSendingRecepcion(false); }
  }

  async function downloadProjFile(f: any) {
    try {
      const r = await fetch(`${API_URL}/project-files/${f.id}/download`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) { alert("Error descargando"); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const newTab = window.open(url, "_blank");
      if (!newTab) {
        const a = document.createElement("a");
        a.href = url; a.download = f.filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch { alert("Error"); }
  }

  async function loadPriorities() {
    try { const r = await fetch(`${API_URL}/tasks/priorities`, { headers: { Authorization: `Bearer ${token}` } }); const d = await r.json(); if (d.ok) setPriorities(d.items || []); } catch (e) { avisarFalloRed("las prioridades", e); }
  }

  async function loadStaff() {
    try { const r = await fetch(`${API_URL}/staff`, { headers: { Authorization: `Bearer ${token}` } }); const d = await r.json(); if (d.ok) setStaff(d.items || []); } catch (e) { avisarFalloRed("el personal", e); }
  }

  async function createStaff() {
    if (!newStaffName.trim()) { alert("Ingresa un nombre"); return; }
    setCreatingStaff(true);
    try {
      const r = await fetch(`${API_URL}/staff`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: newStaffName, role_type: newStaffRole }) });
      const d = await r.json();
      if (!d.ok) { alert(d.message || "Error"); return; }
      setNewStaffName(""); await loadStaff();
    } catch { alert("Error"); } finally { setCreatingStaff(false); }
  }

  async function deleteStaff(id: string) {
    if (!confirm("¿Eliminar? Se quitará de los proyectos donde esté asignado.")) return;
    try { await fetch(`${API_URL}/staff/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); await loadStaff(); await loadProjects(); } catch { alert("Error"); }
  }

  async function saveProjectEdit() {
    if (!editingProject) return;
    setSavingProject(true);
    try {
      const r = await fetch(`${API_URL}/projects/${editingProject.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ project_type: editProj.project_type, status: editProj.status, jefe_id: editProj.jefe_id || null, supervisor_id: editProj.supervisor_id || null, client_email: editProj.client_email || null }) });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error"); return; }
      setEditingProject(null);
      await loadProjects();
    } catch { alert("Error"); } finally { setSavingProject(false); }
  }

  async function deleteProject(id: string) {
    if (!confirm("¿Eliminar este proyecto?")) return;
    try {
      await fetch(`${API_URL}/projects/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (selectedProject?.id === id) { setSelectedProject(null); setTasks([]); }
      await loadProjects();
    } catch { alert("Error"); }
  }

  async function loadTasks(projectId: string) {
    setTasksLoading(true);
    try { const r = await fetch(`${API_URL}/projects/${projectId}/tasks`, { headers: { Authorization: `Bearer ${token}` } }); const d = await r.json(); setTasks(d.items || []); }
    catch (e) { console.error("[red]", e); } finally { setTasksLoading(false); }
  }

  async function uploadGantt() {
    if (!ganttFile || !selectedProject) return;
    setUploadingGantt(true);
    try {
      const fd = new FormData(); fd.append("file", ganttFile);
      const r = await fetch(`${API_URL}/projects/${selectedProject.id}/gantt/import-excel`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error"); return; }
      setTasks(d.tasks || []); setGanttFile(null); setShowGantt(false);
      alert(`✅ ${d.tasks?.length || 0} partidas importadas`);
    } catch { alert("Error"); } finally { setUploadingGantt(false); }
  }

  // Graba la nota de voz dentro de la app. El formato lo elige el navegador (m4a en
  // Safari, webm en Chrome); Whisper acepta ambos, así que no se fuerza ninguno.
  async function toggleGrabacion() {
    if (grabandoAudio) { mediaRec.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const trozos: BlobPart[] = [];
      rec.ondataavailable = e => { if (e.data.size) trozos.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const tipo = rec.mimeType || "audio/webm";
        const ext = tipo.includes("mp4") ? "m4a" : tipo.includes("ogg") ? "ogg" : "webm";
        setVisitaAudio(new File([new Blob(trozos, { type: tipo })], `nota_voz.${ext}`, { type: tipo }));
        setGrabandoAudio(false);
      };
      mediaRec.current = rec;
      rec.start();
      setGrabandoAudio(true);
    } catch {
      alert("No se pudo acceder al micrófono. Revisa los permisos del navegador.");
    }
  }

  async function loadPrevencion() {
    try {
      const r = await fetch(`${API_URL}/prevencion/resumen`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setPrevResumen(d.proyectos || []);
    } catch { setPrevResumen([]); }
  }

  async function loadCharlas() {
    try {
      const r = await fetch(`${API_URL}/charlas`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setCharlas(d.items || []);
    } catch { setCharlas([]); }
  }

  async function subirCharla() {
    if (!charlaFoto) return;
    setSubiendoCharla(true);
    try {
      const comprimida = await compressImage(charlaFoto);
      const fd = new FormData();
      fd.append("photo", comprimida);
      if (charlaNotas.trim()) fd.append("notas", charlaNotas.trim());
      const r = await fetch(`${API_URL}/charlas`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error subiendo la charla"); return; }
      setCharlaFoto(null); setCharlaNotas("");
      await loadCharlas();
    } catch { alert("Error de conexión"); } finally { setSubiendoCharla(false); }
  }

  async function subirVisita() {
    if (!selectedProject || !visitaAudio) return;
    setSubiendoVisita(true);
    setVisitaResultado(null);
    try {
      const fd = new FormData();
      fd.append("audio", visitaAudio);
      if (visitaVideo) fd.append("video", visitaVideo);
      const r = await fetch(`${API_URL}/projects/${selectedProject.id}/visitas`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error registrando la visita"); return; }
      setVisitaResultado(d.visita);
      setVisitaVideo(null); setVisitaAudio(null);
    } catch { alert("Error de conexión"); } finally { setSubiendoVisita(false); }
  }

  async function aprobarVisita(id: string) {
    if (!confirm("¿Enviar este análisis a prevención? Se manda con el video y el audio adjuntos.")) return;
    try {
      const r = await fetch(`${API_URL}/visitas/${id}/aprobar`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error"); return; }
      alert(`Enviado a prevención (${d.adjuntos} adjuntos).`);
      setVisitaResultado(null); setShowVisita(false);
    } catch { alert("Error"); }
  }

  async function saveTask() {
    if (!editingTask || !selectedProject) return;
    setSavingTask(true);
    try {
      const progress = taskStatus === "completada" ? 100 : taskStatus === "pendiente" ? 0 : taskProgress;
      const r = await fetch(`${API_URL}/tasks/${editingTask.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: taskStatus, progressPercent: progress, name: taskName, unit: taskUnit || null, quantity: taskQuantity || null, fecha_ejecucion: taskFecha || null }) });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert("Error"); return; }
      setEditingTask(null); await loadTasks(selectedProject.id);
    } catch { alert("Error"); } finally { setSavingTask(false); }
  }

  async function deleteTask(taskId: string) {
    if (!confirm("¿Eliminar esta partida?")) return;
    try {
      await fetch(`${API_URL}/tasks/${taskId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      setEditingTask(null); if (selectedProject) await loadTasks(selectedProject.id);
    } catch { alert("Error"); }
  }

  async function openPhotos(task: Task) {
    setSelectedTask(task); setScreen("fotos"); setPhotosLoading(true);
    try { const r = await fetch(`${API_URL}/tasks/${task.id}/photos`, { headers: { Authorization: `Bearer ${token}` } }); const d = await r.json(); setPhotos(d.items || []); }
    catch (e) { console.error("[red]", e); } finally { setPhotosLoading(false); }
  }

  async function deletePhoto(id: string) {
    if (!confirm("¿Eliminar foto?")) return;
    try { await fetch(`${API_URL}/photos/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); setPhotos(p => p.filter(x => x.id !== id)); }
    catch { alert("Error"); }
  }

  async function generateReport() {
    if (!selectedProject) return;
    // En proyectos grandes generar y descargar en el momento tarda minutos y se corta
    // (el servidor corta a los 5). Sobre ~25 partidas con fotos se genera en segundo plano
    // y llega por correo, sin espera ni recortar las descripciones con IA.
    const partidasConFotos = tasks.filter(t => (t.photo_count || 0) > 0).length;
    if (partidasConFotos > 25) {
      if (!confirm(`Este proyecto tiene ${partidasConFotos} partidas con fotos, así que el informe demora varios minutos.\n\n¿Generarlo en segundo plano y enviarlo a tu correo cuando esté listo?`)) return;
      setGeneratingReport(true);
      try {
        const r = await fetch(`${API_URL}/projects/${selectedProject.id}/reports/generate-word-async`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        alert(d.ok ? `✅ ${d.message}` : `❌ ${d.message || "Error"}`);
      } catch { alert("Error solicitando el informe"); } finally { setGeneratingReport(false); }
      return;
    }
    setGeneratingReport(true);
    try {
      const r = await fetch(`${API_URL}/projects/${selectedProject.id}/reports/generate-word`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) {
        try { const d = await r.json(); alert(d.message || "Error generando informe"); } catch { alert("Error generando informe"); }
        return;
      }
      const blob = await r.blob();
      const contentDisposition = r.headers.get("Content-Disposition") || "";
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `Informe_${selectedProject.name}.docx`;
      const url = URL.createObjectURL(blob);
      // iOS Safari no permite a.click() en PWAs — window.open es el método que funciona
      const newTab = window.open(url, "_blank");
      if (!newTab) {
        // Fallback para cuando el popup está bloqueado
        const a = document.createElement("a");
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      alert(`✅ Informe "${filename}" generado. Si no se abrió automáticamente, revisa tus descargas.`);
    } catch { alert("Error generando informe"); } finally { setGeneratingReport(false); }
  }

  // Lee la fecha de captura del EXIF. Hay que hacerlo ANTES de comprimir: el canvas
  // descarta todos los metadatos, así que la foto que llega al servidor ya no la trae
  // y el informe terminaba mostrando la fecha de subida en vez de la de terreno.
  async function readCaptureDate(file: File): Promise<string | null> {
    try {
      const buf = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
      if (buf.byteLength < 4 || buf.getUint16(0) !== 0xffd8) return null; // no es JPEG
      let off = 2;
      while (off + 4 < buf.byteLength) {
        if (buf.getUint8(off) !== 0xff) break;
        const marker = buf.getUint8(off + 1);
        const size = buf.getUint16(off + 2);
        if (marker === 0xe1) {
          const tiff = off + 10; // salta "Exif\0\0"
          if (tiff + 8 > buf.byteLength) return null;
          const le = buf.getUint16(tiff) === 0x4949;
          const ifd0 = tiff + buf.getUint32(tiff + 4, le);
          const findTag = (dir: number, tag: number): number | null => {
            if (dir + 2 > buf.byteLength) return null;
            const n = buf.getUint16(dir, le);
            for (let i = 0; i < n; i++) {
              const e = dir + 2 + i * 12;
              if (e + 12 > buf.byteLength) return null;
              if (buf.getUint16(e, le) === tag) return buf.getUint32(e + 8, le);
            }
            return null;
          };
          // DateTimeOriginal (0x9003) vive en el sub-IFD Exif, apuntado por 0x8769.
          const exifPtr = findTag(ifd0, 0x8769);
          const dtOff = exifPtr != null ? findTag(tiff + exifPtr, 0x9003) : null;
          if (dtOff == null) return null;
          let str = "";
          for (let i = 0; i < 19 && tiff + dtOff + i < buf.byteLength; i++) {
            str += String.fromCharCode(buf.getUint8(tiff + dtOff + i));
          }
          // Formato EXIF "2026:08:06 14:30:00" -> ISO
          const m = str.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
          if (!m) return null;
          const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
          if (isNaN(d.getTime()) || d.getFullYear() < 2000 || d.getTime() > Date.now() + 86400000) return null;
          return d.toISOString();
        }
        off += 2 + size;
      }
      return null;
    } catch { return null; }
  }

  // Comprime la imagen a máx 1600px lado mayor, JPEG 80% — pasa de ~8MB a ~300KB
  async function compressImage(file: File): Promise<File> {
    try {
      const bitmap = await createImageBitmap(file);
      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const w = Math.round(bitmap.width * scale);
      const h = Math.round(bitmap.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, w, h);
      const blob: Blob | null = await new Promise(res => canvas.toBlob(res, "image/jpeg", 0.8));
      if (!blob || blob.size >= file.size) return file;
      return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
    } catch { return file; }
  }

  async function uploadPhotoWithDesc(file: File, description: string) {
    if (!selectedTask) return;
    setUploadingPhoto(true);
    try {
      const takenAt = await readCaptureDate(file);
      const compressed = await compressImage(file);
      const fd = new FormData(); fd.append("photo", compressed); fd.append("description", description); fd.append("photo_type", photoTypeInput);
      if (takenAt) fd.append("taken_at", takenAt);
      const r = await fetch(`${API_URL}/tasks/${selectedTask.id}/photos`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error"); return; }
      const r2 = await fetch(`${API_URL}/tasks/${selectedTask.id}/photos`, { headers: { Authorization: `Bearer ${token}` } });
      const d2 = await r2.json(); setPhotos(d2.items || []);
    } catch { alert("Error"); } finally { setUploadingPhoto(false); }
  }

  async function savePhotoDesc(photoId: string, desc: string, fecha: string) {
    setSavingPhotoDesc(true);
    try {
      // La fecha va como mediodía local: guardarla a las 00:00 hacía que el informe la
      // mostrara un día antes al convertir a UTC.
      const takenAt = fecha ? new Date(`${fecha}T12:00:00`).toISOString() : "";
      const r = await fetch(`${API_URL}/photos/${photoId}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ description: desc, taken_at: takenAt }) });
      const d = await r.json();
      if (!d.ok) { alert(d.message || "Error"); return; }
      setPhotos(ps => ps.map(p => p.id === photoId ? { ...p, description: desc, taken_at: d.photo?.taken_at ?? null } : p));
      setEditingPhotoId(null);
    } catch { alert("Error"); } finally { setSavingPhotoDesc(false); }
  }

  async function extractQuotePdf() {
    if (!pdfFile || !selectedProject) return;
    setExtractingPdf(true);
    try {
      const fd = new FormData(); fd.append("file", pdfFile);
      const r = await fetch(`${API_URL}/projects/${selectedProject.id}/import-quote-pdf`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error extrayendo partidas"); return; }
      const items: QuoteItem[] = (d.items || []).map((it: { name: string; codigo?: string; quantity?: string; unit?: string }, i: number) => ({ tempId: `q${i}`, name: it.name, codigo: it.codigo || "", quantity: it.quantity || "", unit: it.unit || "", start_date: "", end_date: "", selected: true }));
      setQuoteItems(items); setQuoteStep(2);
    } catch { alert("Error"); } finally { setExtractingPdf(false); }
  }

  async function bulkCreateTasks() {
    if (!selectedProject) return;
    const selected = quoteItems.filter(it => it.selected && it.name);
    if (!selected.length) { alert("Selecciona al menos una partida"); return; }
    setBulkCreating(true);
    try {
      const tasks = selected.map(it => ({ name: it.name, codigo: it.codigo, start_date: it.start_date || null, end_date: it.end_date || null }));
      const r = await fetch(`${API_URL}/projects/${selectedProject.id}/tasks/bulk`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ tasks }) });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error"); return; }
      await loadTasks(selectedProject.id);
      setShowQuoteImport(false); setPdfFile(null); setQuoteItems([]); setQuoteStep(1);
      alert(`✅ ${d.tasks?.length || selected.length} partidas creadas`);
    } catch { alert("Error"); } finally { setBulkCreating(false); }
  }

  async function uploadLogo() {
    if (!logoFile) return;
    setUploadingLogo(true);
    try {
      const fd = new FormData(); fd.append("logo", logoFile);
      const r = await fetch(`${API_URL}/companies/logo`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error"); return; }
      alert("✅ Logo subido. Aparecerá en los informes Word."); setLogoFile(null);
    } catch { alert("Error"); } finally { setUploadingLogo(false); }
  }

  async function loadUsers() {
    try { const r = await fetch(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } }); const d = await r.json(); setUsers(d.items || []); } catch (e) { avisarFalloRed("los usuarios", e); }
  }

  async function loadKpis() {
    try { const r = await fetch(`${API_URL}/dashboard/kpis`, { headers: { Authorization: `Bearer ${token}` } }); const d = await r.json(); if (d.ok) setKpis(d); } catch (e) { avisarFalloRed("el panel", e); }
  }

  async function loadCostCenters() {
    try { const r = await fetch(`${API_URL}/cost-centers`, { headers: { Authorization: `Bearer ${token}` } }); const d = await r.json(); if (d.ok) setCostCenters(d.items || []); } catch (e) { avisarFalloRed("los centros de costo", e); }
  }

  async function loadExpenses(month?: string) {
    try {
      const m = month || gastosMonth;
      const headers = { Authorization: `Bearer ${token}` };
      const [r, r2] = await Promise.all([
        fetch(`${API_URL}/expenses?month=${m}`, { headers }),
        fetch(`${API_URL}/expenses/summary?month=${m}`, { headers }),
      ]);
      const d = await r.json(); if (d.ok) setExpenses(d.items || []);
      const d2 = await r2.json(); if (d2.ok) setExpenseSummary(d2);
      else setExpenseSummary({ month: m, totals: { total: 0, neto: 0, iva: 0 }, byProject: [], byCategory: [] });
    } catch (e) {
      console.error("loadExpenses error:", e);
      const m = month || gastosMonth;
      setExpenseSummary({ month: m, totals: { total: 0, neto: 0, iva: 0 }, byProject: [], byCategory: [] });
    }
  }

  async function createExpense() {
    if (!expAmount || !expDate) { alert("Monto y fecha son obligatorios"); return; }
    setSavingExpense(true);
    try {
      const r = await fetch(`${API_URL}/expenses`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ category: expCategory, supplier_name: expSupplier || undefined, supplier_rut: expRut || undefined, document_number: expDocNum || undefined, document_type: expDocType, amount: +expAmount, expense_date: expDate, description: expDesc || undefined, project_id: expProjectId || undefined, cost_center_id: expCostCenterId || undefined }) });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error"); return; }
      setShowAddExpense(false);
      setExpAmount(""); setExpSupplier(""); setExpRut(""); setExpDocNum(""); setExpDesc(""); setExpProjectId(""); setExpCostCenterId("");
      await loadExpenses(); await loadKpis();
    } catch { alert("Error"); } finally { setSavingExpense(false); }
  }

  async function deleteExpense(id: string) {
    if (!confirm("¿Eliminar este gasto?")) return;
    try { await fetch(`${API_URL}/expenses/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); await loadExpenses(); await loadKpis(); } catch { alert("Error"); }
  }

  async function createCostCenter() {
    if (!newCCName) { alert("Ingresa un nombre"); return; }
    setCreatingCC(true);
    try {
      const r = await fetch(`${API_URL}/cost-centers`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: newCCName, code: newCCCode }) });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error"); return; }
      setNewCCName(""); setNewCCCode(""); await loadCostCenters();
    } catch { alert("Error"); } finally { setCreatingCC(false); }
  }

  async function loadTrash() {
    try { const r = await fetch(`${API_URL}/trash/tasks`, { headers: { Authorization: `Bearer ${token}` } }); const d = await r.json(); if (d.ok) setTrashTasks(d.items || []); } catch (e) { avisarFalloRed("la papelera", e); }
  }

  async function restoreTask(id: string) {
    try {
      const r = await fetch(`${API_URL}/trash/tasks/${id}/restore`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!d.ok) { alert(d.message || "Error"); return; }
      setTrashTasks(prev => prev.filter(t => t.id !== id));
      alert(`✅ Partida "${d.item.name}" restaurada`);
    } catch { alert("Error"); }
  }

  async function purgeTask(id: string) {
    if (!confirm("¿Eliminar definitivamente? Esta acción no se puede deshacer.")) return;
    try {
      await fetch(`${API_URL}/trash/tasks/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      setTrashTasks(prev => prev.filter(t => t.id !== id));
    } catch { alert("Error"); }
  }

  async function updateCostCenter() {
    if (!editingCC || !editCCName.trim()) { alert("Ingresa un nombre"); return; }
    setSavingCC(true);
    try {
      const r = await fetch(`${API_URL}/cost-centers/${editingCC}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: editCCName, code: editCCCode }) });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error"); return; }
      setEditingCC(null); await loadCostCenters();
    } catch { alert("Error"); } finally { setSavingCC(false); }
  }

  const checkSiiStatus = async () => {
    try {
      const r = await fetch(`${API_URL}/sii/status`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (d.ok) { setSiiConfigured(d.configured); if (d.rut) setSiiConfigRut(d.rut); }
    } catch (e) { console.error("[red]", e); }
  };
  void checkSiiStatus;

  async function uploadSiiCert() {
    if (!siiP12File || !siiPassword || !siiRut) { alert("Selecciona el certificado .p12, ingresa tu RUT y clave SII"); return; }
    setUploadingSii(true);
    try {
      const fd = new FormData();
      fd.append("cert", siiP12File);
      fd.append("password", siiPassword);
      fd.append("rut", siiRut);
      const r = await fetch(`${API_URL}/sii/config`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error configurando SII"); return; }
      setSiiConfigured(true); setSiiConfigRut(siiRut); setSiiPassword(""); setSiiP12File(null);
      alert("✅ Certificado SII configurado con cifrado AES-256. Ya puedes consultar facturas automáticamente.");
    } catch { alert("Error conectando con el servidor"); } finally { setUploadingSii(false); }
  }

  async function loadSiiFacturas() {
    setLoadingSiiFacturas(true);
    try {
      const r = await fetch(`${API_URL}/sii/facturas?month=${gastosMonth}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error consultando SII"); return; }
      setSiiFacturas(d.facturas || []);
    } catch { alert("Error"); } finally { setLoadingSiiFacturas(false); }
  }

  async function importSiiFactura(factura: SiiFactura, costCenterId: string, projectId: string) {
    try {
      const r = await fetch(`${API_URL}/expenses`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ category: "materiales", supplier_name: factura.razon_social, supplier_rut: factura.rut_emisor, document_number: String(factura.folio), document_type: "factura", amount: factura.monto_total, expense_date: factura.fecha, description: `DTE tipo ${factura.tipo_dte} folio ${factura.folio}`, project_id: projectId || undefined, cost_center_id: costCenterId || undefined }) });
      const d = await r.json();
      if (d.ok) { setSiiFacturas(fs => fs.map(f => f.folio === factura.folio ? { ...f, expense_id: d.item.id } : f)); await loadExpenses(); await loadKpis(); }
    } catch { alert("Error"); }
  }

  async function loadNuboxPurchases() {
    setNuboxLoading(true);
    setNuboxError(null);
    try {
      const r = await fetch(`${API_URL}/nubox/purchases?period=${gastosMonth}&size=100`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!r.ok || !d.ok) { setNuboxError(d.message || "Error consultando Nubox"); return; }
      setNuboxPurchases(d.items || []);
    } catch (e: any) { setNuboxError(e.message || "Error de conexión"); } finally { setNuboxLoading(false); }
  }

  async function loadNuboxSummary(month?: string) {
    const m = month || gastosMonth;
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch(`${API_URL}/nubox/summary?period=${m}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/payroll?month=${m}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/nubox/sales-summary?period=${m}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const d1 = await r1.json(); if (d1.ok) setNuboxSummary(d1.nubox);
      const d2 = await r2.json(); if (d2.ok) setPayroll(d2.current);
      const d3 = await r3.json(); if (d3.ok) setNuboxSalesSummary(d3);
    } catch (e) { console.error("[red]", e); }
  }

  async function assignNuboxSale(nuboxId: number | string, projectId: string, sale: any) {
    setNuboxSalesAssigning(String(nuboxId));
    const isUnassigned = projectId === "__sin_centro__";
    try {
      const r = await fetch(`${API_URL}/nubox/sales/${nuboxId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...(isUnassigned ? { unassigned: true } : { project_id: projectId }),
          client_name: sale.client_name,
          client_rut: sale.client_rut,
          number: sale.number,
          doc_type: sale.doc_type,
          emission_date: sale.emission_date,
          total_amount: sale.total_amount,
          total_net: sale.total_net,
          total_tax: sale.total_tax,
        })
      });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error"); return; }
      const assignedInfo = isUnassigned
        ? { project_id: null, cost_center_id: null, project_name: null, cc_name: "Sin centro de costo" }
        : { project_id: projectId, cost_center_id: d.expense?.cost_center_id || null, project_name: projects.find(p => p.id === projectId)?.name || "", cc_name: null };
      setNuboxSalesSummary((prev: any) => prev ? {
        ...prev,
        items: prev.items.map((s: any) => s.id === nuboxId ? { ...s, assigned: assignedInfo } : s)
      } : prev);
      setNuboxSalesProject(prev => { const n = { ...prev }; delete n[String(nuboxId)]; return n; });
    } catch { alert("Error"); } finally { setNuboxSalesAssigning(null); }
  }

  async function savePayroll() {
    if (!payrollAmount) { alert("Ingresa el monto"); return; }
    setSavingPayroll(true);
    try {
      const r = await fetch(`${API_URL}/payroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ year_month: gastosMonth, total_amount: +payrollAmount.replace(/\D/g, ""), note: payrollNote || null })
      });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error"); return; }
      setPayroll(d.item);
      setShowPayrollForm(false);
      setPayrollAmount(""); setPayrollNote("");
    } catch { alert("Error"); } finally { setSavingPayroll(false); }
  }

  async function uploadPayrollPdf(file: File) {
    setUploadingPayrollPdf(true);
    setPayrollPdfResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("year_month", gastosMonth);
      const r = await fetch(`${API_URL}/payroll/upload-pdf`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error leyendo archivo"); return; }
      setPayrollPdfResult(d.data);
      setPayroll({ total_amount: d.total_guardado, note: `${d.data.cantidad_trabajadores || "?"} trabajadores · ${d.data.resumen || ""}` });
      if (d.mes_guardado && d.mes_guardado !== gastosMonth) {
        alert(`✅ Libro guardado en ${fmtMonth(d.mes_guardado)} (período detectado del archivo).\n\nCambia el filtro de mes a ${fmtMonth(d.mes_guardado)} para verlo.`);
      }
    } catch { alert("Error subiendo PDF"); } finally { setUploadingPayrollPdf(false); }
  }

  async function assignNuboxPurchase(nuboxId: number | string, selectedValue: string, force = false) {
    setNuboxAssigning(String(nuboxId));
    try {
      const isUnassigned = selectedValue === "__sin_centro__";
      const cc = costCenters.find(c => c.project_id === selectedValue);
      const isProject = !!cc;
      const purchase = nuboxPurchases.find(p => p.id === nuboxId);
      const body = {
        ...(isUnassigned ? { unassigned: true } : isProject ? { project_id: selectedValue } : { cost_center_id: selectedValue }),
        supplier_name: purchase?.supplier?.tradeName || null,
        supplier_rut: purchase?.supplier?.identification?.value || null,
        number: purchase?.number || null,
        doc_type: purchase?.type?.abbreviation || "factura",
        emission_date: purchase?.emissionDate || null,
        total_amount: purchase?.totalAmount || 0,
        total_net: purchase?.totalNetAmount || 0,
        total_tax: purchase?.totalTaxVatAmount || 0,
        force,
      };
      const r = await fetch(`${API_URL}/nubox/purchases/${nuboxId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const d = await r.json();
      if (d.dupe) {
        setNuboxAssigning(null);
        const confirm_ = window.confirm(`⚠️ Ya existe un gasto manual con N°${purchase?.number} (${purchase?.supplier?.tradeName || purchase?.supplier?.identification?.value}).\n\n¿Asignar igual y mantener ambos registros?`);
        if (confirm_) await assignNuboxPurchase(nuboxId, selectedValue, true);
        return;
      }
      if (!r.ok || !d.ok) { alert(d.message || "Error"); return; }
      const ccName = isUnassigned ? "Sin centro de costo" : cc?.name || costCenters.find(c => c.id === selectedValue)?.name || "";
      const assignedData = isUnassigned ? { cost_center_id: null, cc_name: ccName } : cc ? { project_id: cc.project_id, cost_center_id: cc.id, project_name: ccName, cc_name: ccName } : { cost_center_id: selectedValue, cc_name: ccName };
      setNuboxPurchases(prev => prev.map(p => p.id === nuboxId ? { ...p, assigned: assignedData } : p));
      setNuboxSelectedProject(prev => { const n = { ...prev }; delete n[String(nuboxId)]; return n; });
      await Promise.all([loadKpis(), loadNuboxSummary()]);
    } catch { alert("Error"); } finally { setNuboxAssigning(null); }
  }

  function openEditUser(user: User) {
    setEditingUser(user); setEditName(user.full_name); setEditEmail(user.email);
    setEditPassword(""); setEditRole(user.role); setEditActive(user.is_active);
    setEditPermissions(user.permissions || {}); setScreen("editarUsuario");
  }

  async function saveUser() {
    if (!editingUser) return;
    setSavingUser(true);
    try {
      const r = await fetch(`${API_URL}/users/${editingUser.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ fullName: editName, email: editEmail, password: editPassword || undefined, role: editRole, isActive: editActive, permissions: editPermissions }) });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error"); return; }
      await loadUsers(); setScreen("admin");
    } catch { alert("Error"); } finally { setSavingUser(false); }
  }

  async function deleteUser(userId: string) {
    if (!confirm("¿Eliminar usuario?")) return;
    try { await fetch(`${API_URL}/users/${userId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); await loadUsers(); setScreen("admin"); }
    catch { alert("Error"); }
  }

  async function createUser() {
    if (!newUserName || !newUserEmail || !newUserPassword) { alert("Faltan datos obligatorios"); return; }
    setCreatingUser(true);
    try {
      const r = await fetch(`${API_URL}/users`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ fullName: newUserName, email: newUserEmail, password: newUserPassword, role: newUserRole, permissions: newUserPermissions }) });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error"); return; }
      setNewUserName(""); setNewUserEmail(""); setNewUserPassword(""); setNewUserRole("inspector"); setNewUserPermissions({ photos: true });
      await loadUsers(); setScreen("admin");
    } catch { alert("Error"); } finally { setCreatingUser(false); }
  }

  const progress = tasks.length > 0 ? tasks.reduce((a, t) => a + Number(t.progress_percent || 0), 0) / tasks.length : 0;
  // const totalPhotos = tasks.reduce((a, t) => a + (t.photo_count || 0), 0);
  const filteredTasks = taskFilter === "todos" ? tasks : taskFilter === "en_curso" ? tasks.filter(t => t.status === "en_curso") : taskFilter === "completada" ? tasks.filter(t => t.status === "completada") : tasks.filter(t => t.status === "pendiente" || t.status === "atrasada");

  if (!token) return (
    <div style={{ minHeight: "100vh", backgroundColor: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 48 }}>
          <div style={{ width: 80, height: 80, background: C.orange, borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, boxShadow: "0 6px 20px rgba(249,115,22,0.35)" }}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <path d="M32 14C32 14 28 11 22 12C16 13 12 17 12 22C12 27 16 29 20 30C24 31 28 32 28 36C28 40 24 42 18 41C14 40 12 38 12 38" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ color: C.text, fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>Obras<span style={{ color: C.orange }}>Sync</span></div>
          <div style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>Control de obra inteligente</div>
        </div>

        {/* ─VISTA RESET PASSWORD ── */}
        {loginView === "reset" && (
          resetDone ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}><CheckCircle2 size={40} color={C.success} /></div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>Contraseña actualizada</div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>Ya puedes ingresar con tu nueva contraseña</div>
              <button onClick={() => setLoginView("login")} style={btnPrimary}>Ir al inicio de sesión</button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>Crear nueva contraseña</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>Ingresa tu nueva contraseña (mínimo 6 caracteres)</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: "0 14px", marginBottom: 10, height: 50 }}>
                <Lock size={16} color={C.orange} />
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nueva contraseña" style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontSize: 14 }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: "0 14px", marginBottom: 20, height: 50 }}>
                <Lock size={16} color={C.orange} />
                <input type="password" value={newPassword2} onChange={e => setNewPassword2(e.target.value)} placeholder="Repetir contraseña" onKeyDown={e => e.key === "Enter" && handleResetPassword()} style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontSize: 14 }} />
              </div>
              <button onClick={handleResetPassword} disabled={resetLoading} style={btnPrimary}>{resetLoading ? "Guardando..." : "Guardar contraseña"}</button>
              <button onClick={() => setLoginView("login")} style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer" }}>← Volver</button>
            </>
          )
        )}

        {/* ─VISTA FORGOT PASSWORD ── */}
        {loginView === "forgot" && (
          forgotSent ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>Revisa tu correo</div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>Si el correo está registrado, recibirás un link para crear una nueva contraseña. El link expira en 1 hora.</div>
              <button onClick={() => { setLoginView("login"); setForgotSent(false); setForgotEmail(""); }} style={btnPrimary}>Volver al inicio</button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>Recuperar contraseña</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>Ingresa tu correo y te enviaremos un link para crear una nueva contraseña</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: "0 14px", marginBottom: 20, height: 50 }}>
                <Mail size={16} color={C.orange} />
                <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="Tu correo electrónico" onKeyDown={e => e.key === "Enter" && handleForgotPassword()} style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontSize: 14 }} />
              </div>
              <button onClick={handleForgotPassword} disabled={forgotLoading} style={btnPrimary}>{forgotLoading ? "Enviando..." : "Enviar link"}</button>
              <button onClick={() => setLoginView("login")} style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer" }}>← Volver</button>
            </>
          )
        )}

        {/* ─VISTA LOGIN NORMAL ── */}
        {loginView === "login" && (<>
        <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: "0 14px", marginBottom: 10, height: 50 }}>
          <Mail size={16} color={C.orange} />
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Correo electrónico" style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontSize: 14 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: "0 14px", marginBottom: 16, height: 50 }}>
          <Lock size={16} color={C.orange} />
          <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" onKeyDown={e => e.key === "Enter" && handleLogin()} style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontSize: 14 }} />
          <div onClick={() => setShowPass(!showPass)} style={{ cursor: "pointer" }}>{showPass ? <EyeOff size={15} color={C.muted} /> : <Eye size={15} color={C.muted} />}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div onClick={() => setRememberMe(!rememberMe)} style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${rememberMe ? C.orange : C.border}`, backgroundColor: rememberMe ? C.orange : C.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              {rememberMe && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6 L5 9 L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <span onClick={() => setRememberMe(!rememberMe)} style={{ fontSize: 12, color: C.muted, cursor: "pointer" }}>Recordar sesión</span>
          </div>
          <button onClick={() => setLoginView("forgot")} style={{ background: "none", border: "none", color: C.orange, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>¿Olvidaste tu contraseña?</button>
        </div>
        <button onClick={handleLogin} disabled={loginLoading} style={btnPrimary}>{loginLoading ? "Ingresando..." : "Ingresar"}</button>
        </>)}
        <div style={{ textAlign: "center", marginTop: 32, color: C.mutedSoft, fontSize: 12 }}>Desarrollado por <span style={{ color: C.muted }}>Matfau SPA</span> · v2.0</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.bg, color: C.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif", paddingBottom: 132 }}>

      {/* Modal editar partida */}
      {editingTask && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", zIndex: 300, display: "flex", alignItems: "flex-end" }}>
          <div style={{ backgroundColor: C.card, borderRadius: "20px 20px 0 0", padding: 20, width: "100%", maxWidth: 600, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Editar partida</div>
              <button onClick={() => deleteTask(editingTask.id)} style={{ backgroundColor: C.dangerDim, border: "none", borderRadius: 8, padding: "5px 12px", color: C.danger, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Eliminar</button>
            </div>
            <input value={taskName} onChange={e => setTaskName(e.target.value)} placeholder="Nombre de la partida" style={inp} />
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input value={taskQuantity} onChange={e => setTaskQuantity(e.target.value)} placeholder="Cantidad (ej: 150)" style={{ ...inp, flex: 1, marginBottom: 0 }} />
              <input value={taskUnit} onChange={e => setTaskUnit(e.target.value)} placeholder="Unidad (m², ml, un...)" style={{ ...inp, flex: 1, marginBottom: 0 }} />
            </div>
            <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Fecha de ejecución</div>
            <input type="date" value={taskFecha} onChange={e => setTaskFecha(e.target.value)} style={{ ...inp, marginBottom: 4 }} />
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 14 }}>Día en que se ejecutó la partida en terreno. Es la fecha que sale en el informe y en la bitácora.</div>
            <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Estado</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              {STATUS_OPTIONS.map(s => (
                <button key={s.value} onClick={() => { setTaskStatus(s.value); if (s.value === "completada") setTaskProgress(100); else if (s.value === "pendiente") setTaskProgress(0); }} style={{ padding: "10px 8px", borderRadius: 10, border: `0.5px solid ${taskStatus === s.value ? C.orange : C.border}`, background: taskStatus === s.value ? C.orangeDim : C.cardAlt, color: taskStatus === s.value ? C.orange : C.muted, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                  {s.label}
                </button>
              ))}
            </div>
            {taskStatus !== "completada" && taskStatus !== "pendiente" && (
              <>
                <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Avance: {taskProgress}%</div>
                <input type="range" min={0} max={100} value={taskProgress} onChange={e => setTaskProgress(Number(e.target.value))} style={{ width: "100%", marginBottom: 16, accentColor: C.orange }} />
              </>
            )}
            {taskStatus === "completada" && <div style={{ textAlign: "center", color: C.success, fontWeight: 700, fontSize: 13, marginBottom: 16 }}>Avance automático: 100%</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setEditingTask(null)} style={{ flex: 1, height: 46, background: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 12, color: C.muted, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button onClick={saveTask} disabled={savingTask} style={{ flex: 2, height: 46, background: C.orange, border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, cursor: "pointer" }}>{savingTask ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, backgroundColor: C.card, borderBottom: `0.5px solid ${C.border}`, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {(screen === "fotos" || screen === "editarUsuario" || screen === "crearUsuario" || screen === "partidas" || screen === "crearProyecto") && (
            <button onClick={() => { if (screen === "fotos") setScreen("partidas"); else if (screen === "partidas") setScreen("home"); else if (screen === "crearProyecto") setScreen("proyectos"); else setScreen("admin"); }} style={{ background: "none", border: "none", color: C.orange, cursor: "pointer", padding: 0, display: "flex" }}>
              <ChevronLeft size={24} />
            </button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, background: C.orange, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 40 40" fill="none">
                <path d="M8 28 C8 16 32 16 32 28 L32 33 L8 33 Z" fill="white"/>
                <rect x="5" y="31" width="30" height="4" rx="2" fill="rgba(255,255,255,0.6)"/>
                <path d="M15 22 L19 26 L26 18" stroke="#F97316" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>Obras<span style={{ color: C.orange }}>Sync</span></div>
            {selectedProject && ["partidas", "fotos"].includes(screen) && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{selectedProject.name}</div>
            )}
          </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ width: 34, height: 34, background: C.bg, border: `0.5px solid ${C.border}`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bell size={16} color={C.muted} />
          </div>
          <div onClick={() => setScreen("configuracion")} style={{ cursor: "pointer" }}>
            <Av name={userName} size={34} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: 16 }}>

        {/* FOTOS */}
        {screen === "fotos" && selectedTask && (
          <div>
            {/* Overlay: descripción antes de subir */}
            {pendingPhotoFile && (
              <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.9)", zIndex: 400, display: "flex", alignItems: "flex-end" }}>
                <div style={{ backgroundColor: C.card, borderRadius: "20px 20px 0 0", padding: 20, width: "100%", maxWidth: 600, margin: "0 auto" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Subir foto</div>
                  {/* Selector tipo de foto */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    {(["previa", "trabajo"] as const).map(t => (
                      <button key={t} onClick={() => setPhotoTypeInput(t)} style={{ flex: 1, height: 38, borderRadius: 10, border: `1.5px solid ${photoTypeInput === t ? C.orange : C.border}`, backgroundColor: photoTypeInput === t ? C.orangeDim : C.cardAlt, color: photoTypeInput === t ? C.orange : C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                        {t === "previa" ? "Foto Previa" : "En Ejecución"}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>{photoTypeInput === "previa" ? "Foto del estado inicial antes de los trabajos" : "¿Qué trabajo muestra esta foto?"}</div>
                  <textarea value={photoDescInput} onChange={e => setPhotoDescInput(e.target.value)} placeholder={photoTypeInput === "previa" ? "Ej: Estado inicial de la zona de trabajo..." : "Ej: Instalación de pilar metálico en eje A-3..."} rows={3} style={{ width: "100%", backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 14, padding: 12, resize: "none", boxSizing: "border-box", outline: "none", marginBottom: 12 }} />
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => { setPendingPhotoFile(null); setPhotoDescInput(""); setPhotoTypeInput("trabajo"); }} style={{ flex: 1, height: 46, background: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 12, color: C.muted, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
                    <button onClick={() => { uploadPhotoWithDesc(pendingPhotoFile!, photoDescInput); setPendingPhotoFile(null); setPhotoDescInput(""); }} disabled={uploadingPhoto} style={{ flex: 2, height: 46, background: C.orange, border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, cursor: "pointer" }}>{uploadingPhoto ? "Subiendo..." : "Subir foto"}</button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Fotos</div>
              <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{selectedTask.name}</div>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) { setPendingPhotoFile(f); setPhotoDescInput(""); } e.target.value = ""; }} />
              <input ref={photoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) { setPendingPhotoFile(f); setPhotoDescInput(""); } e.target.value = ""; }} />
              <button onClick={() => cameraInputRef.current?.click()} disabled={uploadingPhoto} style={{ flex: 1, height: 46, backgroundColor: C.orange, border: "none", borderRadius: 10, color: "#fff", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 14 }}>
                <Camera size={16} /> {uploadingPhoto ? "Subiendo..." : "Tomar foto"}
              </button>
              <button onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto} style={{ flex: 1, height: 46, backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, color: C.mutedSoft, fontWeight: 600, cursor: "pointer", fontSize: 14 }}>Galería</button>
            </div>
            {photosLoading ? <div style={{ color: C.muted, textAlign: "center", padding: 32 }}>Cargando...</div>
              : photos.length === 0 ? <div style={{ textAlign: "center", padding: 48, color: C.muted }}>Sin fotos todavía</div>
                : (["previa", "trabajo"] as const).map(tipo => {
                  const fotosTipo = photos.filter(p => (p.photo_type || "trabajo") === tipo);
                  if (fotosTipo.length === 0) return null;
                  return <div key={tipo}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: tipo === "previa" ? "#60a5fa" : C.orange, marginBottom: 8, marginTop: tipo === "trabajo" ? 16 : 0, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      {tipo === "previa" ? "Fotos Previas" : "En Ejecución"}
                    </div>
                    {fotosTipo.map((photo, idx) => (
                  <div key={photo.id} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, marginBottom: 14, overflow: "hidden" }}>
                    {/* Header sobre la foto */}
                    <div style={{ padding: "10px 12px 8px", borderBottom: `0.5px solid ${C.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: C.text, lineHeight: 1.3 }}>{selectedTask.name}</div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                            {new Date(photo.created_at).toLocaleString("es-CL")} · Foto {idx + 1}
                            {selectedTask.progress_percent ? ` · ${selectedTask.progress_percent}% avance` : ""}
                          </div>
                          {photo.onedrive_url && <div style={{ fontSize: 11, color: C.info, marginTop: 2 }}>OneDrive</div>}
                        </div>
                        <button onClick={() => deletePhoto(photo.id)} style={{ width: 30, height: 30, backgroundColor: C.dangerDim, border: "none", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: 8 }}>
                          <Trash2 size={12} color={C.danger} />
                        </button>
                      </div>
                      {/* Descripción editable */}
                      {editingPhotoId === photo.id ? (
                        <div style={{ marginTop: 8 }}>
                          <textarea value={editingPhotoDesc} onChange={e => setEditingPhotoDesc(e.target.value)} rows={2} style={{ width: "100%", backgroundColor: C.cardAlt, border: `0.5px solid ${C.orange}`, borderRadius: 8, color: C.text, fontSize: 12, padding: 8, resize: "none", boxSizing: "border-box", outline: "none", marginBottom: 6 }} />
                          <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>Fecha en que se tomó la fotografía</div>
                          <input type="date" value={editingPhotoDate} onChange={e => setEditingPhotoDate(e.target.value)} style={{ width: "100%", backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12, padding: 8, boxSizing: "border-box", outline: "none", marginBottom: 6 }} />
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => setEditingPhotoId(null)} style={{ flex: 1, height: 32, background: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 8, color: C.muted, fontSize: 11, cursor: "pointer" }}>Cancelar</button>
                            <button onClick={() => savePhotoDesc(photo.id, editingPhotoDesc, editingPhotoDate)} disabled={savingPhotoDesc} style={{ flex: 2, height: 32, background: C.orange, border: "none", borderRadius: 8, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{savingPhotoDesc ? "Guardando..." : "Guardar"}</button>
                          </div>
                        </div>
                      ) : (
                        <div onClick={() => { setEditingPhotoId(photo.id); setEditingPhotoDesc(photo.description || ""); setEditingPhotoDate(photo.taken_at ? String(photo.taken_at).slice(0, 10) : ""); }} style={{ marginTop: 8, padding: "6px 10px", borderLeft: `3px solid ${C.orange}`, backgroundColor: C.cardAlt, borderRadius: "0 6px 6px 0", cursor: "pointer" }}>
                          {photo.description ? (
                            <div style={{ fontSize: 12, color: C.text, fontStyle: "italic", lineHeight: 1.4 }}>{photo.description}</div>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.muted }}>
                              <MessageSquare size={12} /> Toca para agregar descripción...
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <img src={`${API_URL}${photo.image_url || `/photos/${photo.id}/image`}`} alt={photo.filename} style={{ width: "100%", maxHeight: 300, objectFit: "cover", display: "block", backgroundColor: C.border }} />
                  </div>
                ))}
                  </div>;
                })}
          </div>
        )}

        {/* HOME */}
        {screen === "home" && (
          <>
            {/* Header saludo */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: C.orange, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>Panel de Control</div>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>Hola, {userName.split(" ")[0]}</div>
              <div style={{ color: C.mutedSoft, fontSize: 13, marginTop: 2 }}>{new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}</div>
            </div>

            {/* KPI Cards */}
            {canSeeKpis && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              <div onClick={() => setScreen("proyectos")} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 16, padding: 16, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ width: 36, height: 36, background: C.orangeDim, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}><FolderOpen size={18} color={C.orange} /></div>
                  {(kpis?.proyectos.atrasados || 0) > 0 && <div style={{ background: C.dangerDim, border: `0.5px solid ${C.danger}`, borderRadius: 6, padding: "2px 7px", fontSize: 10, color: C.danger, fontWeight: 700 }}>{kpis?.proyectos.atrasados} atrasados</div>}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: C.text, marginTop: 10 }}>{kpis?.proyectos.total ?? projects.length}</div>
                <div style={{ fontSize: 11, color: C.mutedSoft, marginTop: 2 }}>Proyectos activos</div>
                <div style={{ height: 3, background: C.border, borderRadius: 99, marginTop: 8, overflow: "hidden" }}>
                  <div style={{ width: `${kpis?.proyectos.avg_progress || 0}%`, height: "100%", background: C.orange, borderRadius: 99 }} />
                </div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{kpis?.proyectos.avg_progress ?? 0}% avance prom.</div>
              </div>

              <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
                <div style={{ width: 36, height: 36, background: C.infoDim, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}><BarChart2 size={18} color={C.info} /></div>
                <div style={{ fontSize: 28, fontWeight: 800, color: C.text, marginTop: 10 }}>{kpis?.tareas.en_curso ?? 0}</div>
                <div style={{ fontSize: 11, color: C.mutedSoft, marginTop: 2 }}>{(kpis?.tareas.en_curso || 0) === 1 ? "Partida en curso" : "Partidas en curso"}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <div style={{ background: C.successDim, borderRadius: 5, padding: "2px 7px", fontSize: 10, color: C.success }}><CheckCircle2 size={9} style={{ marginRight: 3 }} />{kpis?.tareas.completadas ?? 0} completadas</div>
                  {(kpis?.tareas.atrasadas || 0) > 0 && <div style={{ background: C.dangerDim, borderRadius: 5, padding: "2px 7px", fontSize: 10, color: C.danger }}><AlertTriangle size={9} style={{ marginRight: 3 }} />{kpis?.tareas.atrasadas} atrasadas</div>}
                </div>
              </div>

              <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
                <div style={{ width: 36, height: 36, background: C.successDim, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}><Image size={18} color={C.success} /></div>
                <div style={{ fontSize: 28, fontWeight: 800, color: C.text, marginTop: 10 }}>{kpis?.fotos.total ?? 0}</div>
                <div style={{ fontSize: 11, color: C.mutedSoft, marginTop: 2 }}>Fotos registradas</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>En todos los proyectos</div>
              </div>

              <div onClick={() => setScreen("gastos")} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 16, padding: 16, cursor: "pointer" }}>
                <div style={{ width: 36, height: 36, background: C.purpleDim, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}><DollarSign size={18} color={C.purple} /></div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginTop: 10 }}>{canSeeMontos ? (kpis ? fmtCLP(kpis.gastos.total_mes) : "$0") : "••••••"}</div>
                <div style={{ fontSize: 11, color: C.mutedSoft, marginTop: 2 }}>Gastos este mes</div>
                <div style={{ fontSize: 10, color: C.orange, marginTop: 6 }}>Ver detalle →</div>
              </div>
            </div>}

            {/* Proyectos recientes */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Proyectos activos</div>
              <div onClick={() => setScreen("proyectos")} style={{ fontSize: 12, color: C.orange, cursor: "pointer" }}>Ver todos →</div>
            </div>
            {projects.length === 0 && <div style={{ color: C.muted, fontSize: 13, padding: "20px 0", textAlign: "center" }}>Sin proyectos aún. Crea el primero ↓</div>}
            {projects.slice(0, 4).map(p => (
              <div key={p.id} onClick={() => { setSelectedProject(p); setScreen("partidas"); }} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, background: C.orangeDim, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <FolderOpen size={18} color={C.orange} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2, textTransform: "none" as const, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>#{p.code}{p.client_name ? ` · ${p.client_name}` : ""}</div>
                  <div style={{ height: 4, background: C.border, borderRadius: 99, marginTop: 7, overflow: "hidden" }}>
                    <div style={{ width: `${p.progress_percent || 0}%`, height: "100%", background: `linear-gradient(90deg, ${C.orange}, #FFB347)`, borderRadius: 99, transition: "width 0.5s" }} />
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.orange }}>{Number(p.progress_percent || 0).toFixed(0)}%</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>avance</div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* PARTIDAS */}
        {screen === "partidas" && (
          <>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{selectedProject?.name}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>#{selectedProject?.code} · {tasks.length} partidas</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
              {[
                { label: "Avance", value: `${progress.toFixed(0)}%`, color: C.orange },
                { label: "Completadas", value: tasks.filter(t => t.status === "completada").length, color: C.success },
                { label: "Atrasadas", value: tasks.filter(t => t.status === "atrasada").length, color: C.danger },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Acciones del proyecto */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {canSeeReports && <button onClick={generateReport} disabled={generatingReport} style={{ flex: 1, height: 44, backgroundColor: "#0D1A2E", border: `0.5px solid ${C.info}50`, borderRadius: 10, color: C.info, fontWeight: 600, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <FileText size={15} /> {generatingReport ? "Generando..." : "Informe Word"}
              </button>}
              <button onClick={() => setShowQuoteImport(true)} style={{ flex: 1, height: 44, backgroundColor: C.orangeDim, border: `0.5px solid ${C.orange}40`, borderRadius: 10, color: C.orange, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                Cotización PDF
              </button>
              <button onClick={() => setShowGantt(!showGantt)} style={{ flex: 1, height: 44, backgroundColor: showGantt ? C.orangeDim : C.cardAlt, border: `0.5px solid ${showGantt ? C.orange : C.border}`, borderRadius: 10, color: showGantt ? C.orange : C.mutedSoft, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                Excel
              </button>
            </div>

            {/* Visita a terreno: video + nota de voz -> análisis de riesgo */}
            <button onClick={() => setShowVisita(!showVisita)} style={{ width: "100%", height: 44, marginBottom: 14, backgroundColor: showVisita ? C.orangeDim : C.cardAlt, border: `0.5px solid ${showVisita ? C.orange : C.border}`, borderRadius: 10, color: showVisita ? C.orange : C.mutedSoft, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
              Visita a terreno
            </button>

            {showVisita && (
              <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
                  Graba o sube un video de la obra y una nota de voz describiendo las condiciones. La IA transcribe el audio y genera el análisis de riesgo, que queda en borrador hasta que lo revises.
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, color: C.mutedSoft, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Video {visitaVideo ? "✓" : "(opcional)"}</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <label style={{ flex: 1, height: 40, backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    Grabar video
                    <input type="file" accept="video/*" capture="environment" onChange={e => setVisitaVideo(e.target.files?.[0] || null)} style={{ display: "none" }} />
                  </label>
                  <label style={{ flex: 1, height: 40, backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    Subir
                    <input type="file" accept="video/*" onChange={e => setVisitaVideo(e.target.files?.[0] || null)} style={{ display: "none" }} />
                  </label>
                </div>
                {visitaVideo && <div style={{ fontSize: 11, color: C.success, marginTop: -8, marginBottom: 12 }}>{visitaVideo.name} · {(visitaVideo.size / 1048576).toFixed(1)} MB</div>}

                <div style={{ fontSize: 11, fontWeight: 700, color: C.mutedSoft, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Nota de voz {visitaAudio ? "✓" : "(obligatoria)"}</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <button onClick={toggleGrabacion} style={{ flex: 1, height: 40, backgroundColor: grabandoAudio ? C.dangerDim : C.cardAlt, border: `0.5px solid ${grabandoAudio ? C.danger : C.border}`, borderRadius: 10, color: grabandoAudio ? C.danger : C.text, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {grabandoAudio ? "Detener" : "Grabar audio"}
                  </button>
                  <label style={{ flex: 1, height: 40, backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    Subir
                    <input type="file" accept="audio/*" onChange={e => setVisitaAudio(e.target.files?.[0] || null)} style={{ display: "none" }} />
                  </label>
                </div>
                {visitaAudio && <div style={{ fontSize: 11, color: C.success, marginBottom: 12 }}>{visitaAudio.name} · {(visitaAudio.size / 1024).toFixed(0)} KB</div>}

                <button onClick={subirVisita} disabled={!visitaAudio || subiendoVisita} style={{ width: "100%", height: 44, marginTop: 6, backgroundColor: !visitaAudio ? C.cardAlt : C.orange, border: "none", borderRadius: 10, color: !visitaAudio ? C.muted : "#fff", fontWeight: 700, fontSize: 13, cursor: !visitaAudio ? "default" : "pointer" }}>
                  {subiendoVisita ? "Transcribiendo y analizando..." : "Generar análisis"}
                </button>

                {visitaResultado && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: `0.5px solid ${C.border}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.mutedSoft, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Transcripción</div>
                    <div style={{ fontSize: 12, color: C.mutedSoft, fontStyle: "italic", lineHeight: 1.5, marginBottom: 12, maxHeight: 120, overflowY: "auto" }}>{visitaResultado.transcripcion}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.mutedSoft, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Análisis (borrador)</div>
                    <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5, whiteSpace: "pre-wrap", marginBottom: 12, maxHeight: 260, overflowY: "auto" }}>{visitaResultado.analisis}</div>
                    <button onClick={() => aprobarVisita(visitaResultado.id)} style={{ width: "100%", height: 44, backgroundColor: C.success, border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                      Aprobar y enviar a prevención
                    </button>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 6, textAlign: "center" }}>Revisa el análisis antes de enviarlo. Se manda con el video y el audio adjuntos.</div>
                  </div>
                )}
              </div>
            )}

            {/* Notificaciones al cliente: inicio y término de trabajos */}
            <div style={{ display: "flex", gap: 8, marginBottom: notifyPanel ? 8 : 14 }}>
              {selectedProject?.inicio_notificado_at ? (
                <div onClick={() => openNotifyPanel("inicio", true)} style={{ flex: 1, height: 44, backgroundColor: C.successDim, border: `0.5px solid ${C.success}40`, borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.success }}>Inicio notificado</div>
                  <div style={{ fontSize: 9, color: C.muted }}>{fmtDate(selectedProject.inicio_notificado_at)} · tocar para reenviar</div>
                </div>
              ) : (
                <button onClick={() => openNotifyPanel("inicio", false)} disabled={notifying !== ""} style={{ flex: 1, height: 44, backgroundColor: C.successDim, border: `0.5px solid ${C.success}`, borderRadius: 10, color: C.success, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                  Notificar inicio
                </button>
              )}
              {selectedProject?.termino_notificado_at ? (
                <div onClick={() => openNotifyPanel("termino", true)} style={{ flex: 1, height: 44, backgroundColor: C.infoDim, border: `0.5px solid ${C.info}40`, borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.info }}>Término notificado</div>
                  <div style={{ fontSize: 9, color: C.muted }}>{fmtDate(selectedProject.termino_notificado_at)} · tocar para reenviar</div>
                </div>
              ) : (
                <button onClick={() => openNotifyPanel("termino", false)} disabled={notifying !== ""} style={{ flex: 1, height: 44, backgroundColor: C.infoDim, border: `0.5px solid ${C.info}`, borderRadius: 10, color: C.info, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                  Notificar término
                </button>
              )}
            </div>

            {/* Panel de fecha para la notificación */}
            {notifyPanel && (
              <div style={{ backgroundColor: C.card, border: `0.5px solid ${notifyPanel.tipo === "inicio" ? C.success : C.info}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                  {notifyPanel.tipo === "inicio" ? "Notificar inicio de trabajos" : "Notificar término de trabajos"}{notifyPanel.resend ? " (reenvío)" : ""}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Se enviará a {selectedProject?.client_email}</div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Fecha de {notifyPanel.tipo === "inicio" ? "inicio" : "término"} de los trabajos</div>
                <input type="date" value={notifyDate} onChange={e => setNotifyDate(e.target.value)} style={{ width: "100%", height: 42, borderRadius: 10, border: `0.5px solid ${C.border}`, backgroundColor: C.cardAlt, color: C.text, fontSize: 14, padding: "0 10px", marginBottom: 10, boxSizing: "border-box" as const }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={notifyClientWorks} disabled={notifying !== ""} style={{ flex: 1, height: 40, backgroundColor: notifyPanel.tipo === "inicio" ? C.success : C.info, border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    {notifying !== "" ? "Enviando..." : "Enviar correo"}
                  </button>
                  <button onClick={() => setNotifyPanel(null)} style={{ height: 40, padding: "0 16px", backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, color: C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
                </div>
              </div>
            )}

            {/* Recepción conforme — todas las partidas completadas */}
            {tasks.length > 0 && tasks.every(t => t.status === "completada") && (
              selectedProject?.recepcion_conforme_at ? (
                <div style={{ backgroundColor: C.successDim, border: `0.5px solid ${C.success}40`, borderRadius: 12, padding: 14, marginBottom: 14, textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.success }}>Recepción conforme enviada</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Informe y correo enviados el {fmtDate(selectedProject.recepcion_conforme_at)}</div>
                  {isAdmin && (
                    <button
                      onClick={async () => {
                        if (!confirm("¿Revertir la recepción conforme? El botón volverá a quedar activo para enviar de nuevo.")) return;
                        try {
                          const r = await fetch(`${API_URL}/projects/${selectedProject.id}/revertir-recepcion`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
                          const d = await r.json();
                          if (!d.ok) { alert(d.message || "Error"); return; }
                          setSelectedProject({ ...selectedProject, recepcion_conforme_at: undefined } as Project);
                          await loadProjects();
                        } catch { alert("Error"); }
                      }}
                      style={{ marginTop: 10, height: 34, padding: "0 16px", backgroundColor: C.card, border: `0.5px solid ${C.danger}50`, borderRadius: 8, color: C.danger, fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                    >
                      ↩️ Revertir (solo admin)
                    </button>
                  )}
                  {canSeeEstadoResultado && (
                    <button
                      onClick={async () => {
                        setLoadingProjectResultado(true); setProjectResultado(null);
                        try {
                          const r = await fetch(`${API_URL}/projects/${selectedProject.id}/resultado`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
                          if (r.ok) setProjectResultado({ items: r.items || [] }); else alert(r.message || "Error");
                        } catch { alert("Error"); } finally { setLoadingProjectResultado(false); }
                      }}
                      style={{ marginTop: 10, marginLeft: 8, height: 34, padding: "0 16px", backgroundColor: C.card, border: `0.5px solid ${C.orange}50`, borderRadius: 8, color: C.orange, fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                    >
                      {loadingProjectResultado ? "Cargando..." : "Ver resultado del proyecto"}
                    </button>
                  )}
                  {projectResultado && (
                    <div style={{ marginTop: 12, textAlign: "left" }}>
                      {projectResultado.items.length === 0 ? (
                        <div style={{ fontSize: 12, color: C.muted, textAlign: "center" }}>Sin movimientos registrados en el centro de costo de este proyecto.</div>
                      ) : projectResultado.items.map(cc => (
                        <div key={cc.cost_center_id || "sin_centro"} style={{ backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Resultado completo del proyecto</div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                            <div>Ingresos: <b>{fmtCLP(cc.total.ingresos)}</b></div>
                            <div>Gastos: <b>{fmtCLP(cc.total.gastos)}</b></div>
                            <div>Boletas: <b>{fmtCLP(cc.total.boletas)}</b></div>
                            <div>Remuneraciones: <b>{fmtCLP(cc.total.remuneraciones)}</b></div>
                          </div>
                          <div style={{ marginTop: 8, fontSize: 15, fontWeight: 800, color: cc.total.margen >= 0 ? "#15803d" : "#dc2626" }}>Margen: {fmtCLP(cc.total.margen)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={sendRecepcionConforme} disabled={sendingRecepcion} style={{ width: "100%", height: 50, backgroundColor: C.success, border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", marginBottom: 14, opacity: sendingRecepcion ? 0.7 : 1 }}>
                  {sendingRecepcion ? "Enviando..." : "Recepción conforme — Generar informe y enviar correo"}
                </button>
              )
            )}

            {/* Documentos del proyecto */}
            <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, marginBottom: 14, overflow: "hidden" }}>
              <div onClick={() => setProjFilesOpen(o => !o)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", cursor: "pointer" }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Documentos{projFiles.length > 0 ? ` (${projFiles.length})` : ""}</div>
                <span style={{ fontSize: 11, color: C.muted }}>{projFilesOpen ? "▲" : "▼"}</span>
              </div>
              {projFilesOpen && (
                <div style={{ padding: "0 14px 14px" }}>
                  {isAdmin && (
                    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                      <input ref={cotFileRef} type="file" multiple style={{ display: "none" }} onChange={e => { const fs = Array.from(e.target.files || []); if (fs.length > 0) { setPendingUpload({ files: fs, type: "cotizacion" }); setCotVisibleTo([]); } e.target.value = ""; }} />
                      <input ref={ocFileRef} type="file" multiple style={{ display: "none" }} onChange={e => { const fs = Array.from(e.target.files || []); if (fs.length > 0) { setPendingUpload({ files: fs, type: "orden_compra" }); setCotVisibleTo([]); } e.target.value = ""; }} />
                      <button onClick={() => cotFileRef.current?.click()} disabled={uploadingFile} style={{ flex: 1, height: 40, backgroundColor: C.orangeDim, border: `0.5px solid ${C.orange}40`, borderRadius: 10, color: C.orange, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Subir cotización</button>
                      <button onClick={() => ocFileRef.current?.click()} disabled={uploadingFile} style={{ flex: 1, height: 40, backgroundColor: C.infoDim, border: `0.5px solid ${C.info}40`, borderRadius: 10, color: C.info, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Subir orden de compra</button>
                    </div>
                  )}

                  {/* Selector de visibilidad (cotización y orden de compra) */}
                  {pendingUpload && (
                    <div style={{ backgroundColor: C.cardAlt, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{pendingUpload.type === "cotizacion" ? "📄" : "🧾"} {pendingUpload.files.length === 1 ? pendingUpload.files[0].name : `${pendingUpload.files.length} archivos seleccionados`}</div>
                      {pendingUpload.files.length > 1 && (
                        <div style={{ fontSize: 10, color: C.muted, marginBottom: 6 }}>{pendingUpload.files.map(f => f.name).join(" · ")}</div>
                      )}
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>¿Quiénes pueden ver {pendingUpload.type === "cotizacion" ? "esta cotización" : "esta orden de compra"}? (nadie seleccionado = solo administradores)</div>
                      {users.filter(u => u.is_active && u.role !== "administrador").map(u => (
                        <label key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 12, cursor: "pointer" }}>
                          <input type="checkbox" checked={cotVisibleTo.includes(u.id)} onChange={e => setCotVisibleTo(prev => e.target.checked ? [...prev, u.id] : prev.filter(x => x !== u.id))} />
                          {u.full_name}
                        </label>
                      ))}
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button onClick={() => uploadProjFiles(pendingUpload.files, pendingUpload.type, cotVisibleTo)} disabled={uploadingFile} style={{ flex: 1, height: 36, backgroundColor: C.orange, border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{uploadingFile ? "Subiendo..." : `Subir${pendingUpload.files.length > 1 ? ` (${pendingUpload.files.length})` : ""}`}</button>
                        <button onClick={() => setPendingUpload(null)} style={{ height: 36, padding: "0 14px", backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 8, color: C.muted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Cancelar</button>
                      </div>
                    </div>
                  )}

                  {uploadingFile && !pendingUpload && <div style={{ textAlign: "center", color: C.muted, fontSize: 12, padding: 8 }}>Subiendo...</div>}

                  {projFiles.map(f => (
                    <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `0.5px solid ${C.border}` }}>
                      <span style={{ fontSize: 16 }}>{f.file_type === "cotizacion" ? "📄" : "🧾"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{f.filename}</div>
                        <div style={{ fontSize: 10, color: C.muted }}>{f.file_type === "cotizacion" ? "Cotización" : "Orden de compra"} · {fmtDate(f.created_at)}</div>
                      </div>
                      <button onClick={() => downloadProjFile(f)} style={{ backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 6, padding: "5px 10px", color: C.info, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>⬇️</button>
                      {isAdmin && <button onClick={async () => { if (!confirm("¿Eliminar documento?")) return; await fetch(`${API_URL}/project-files/${f.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); if (selectedProject) loadProjFiles(selectedProject.id); }} style={{ backgroundColor: C.dangerDim, border: "none", borderRadius: 6, padding: "5px 10px", color: C.danger, fontSize: 11, cursor: "pointer" }}>✕</button>}
                    </div>
                  ))}
                  {projFiles.length === 0 && !pendingUpload && <div style={{ textAlign: "center", color: C.muted, fontSize: 12, padding: 8 }}>Sin documentos adjuntos</div>}
                </div>
              )}
            </div>

            {/* Panel Gantt colapsable */}
            {showGantt && (
              <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, fontWeight: 600 }}>Importar Carta Gantt Excel</div>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={e => setGanttFile(e.target.files?.[0] || null)} />
                <button onClick={() => fileInputRef.current?.click()} style={{ width: "100%", height: 42, backgroundColor: C.cardAlt, border: `0.5px solid ${ganttFile ? C.orange : C.border}`, borderRadius: 10, color: ganttFile ? C.orange : C.mutedSoft, cursor: "pointer", fontSize: 13, marginBottom: 8 }}>
                  {ganttFile ? `📎 ${ganttFile.name}` : "Seleccionar archivo .xlsx"}
                </button>
                <button onClick={uploadGantt} disabled={uploadingGantt || !ganttFile} style={{ width: "100%", height: 42, backgroundColor: !ganttFile ? C.cardAlt : C.orange, border: "none", borderRadius: 10, color: !ganttFile ? C.muted : "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                  {uploadingGantt ? "Importando..." : "Importar partidas"}
                </button>
              </div>
            )}

            {/* Filtros */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
              {[{ value: "todos", label: "Todas" }, { value: "en_curso", label: "En progreso" }, { value: "completada", label: "Completadas" }, { value: "pendiente", label: "Pendientes" }].map(f => (
                <button key={f.value} onClick={() => setTaskFilter(f.value)} style={{ padding: "6px 14px", borderRadius: 20, border: `0.5px solid ${taskFilter === f.value ? C.orange : C.border}`, background: taskFilter === f.value ? C.orangeDim : C.card, color: taskFilter === f.value ? C.orange : C.muted, fontWeight: 600, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {f.label}
                </button>
              ))}
            </div>

            {tasksLoading ? <div style={{ color: C.muted, textAlign: "center", padding: 32 }}>Cargando partidas...</div>
              : filteredTasks.map((task, i) => {
                const isLate = task.status === "atrasada";
                const barColor = task.status === "completada" ? C.success : isLate ? C.danger : task.status === "en_curso" ? C.info : C.border;
                return (
                  <div key={task.id || i} style={{ backgroundColor: C.card, border: `0.5px solid ${isLate ? "#3A0D0D" : C.border}`, borderRadius: 14, padding: 14, marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, marginBottom: 4 }}>{task.esquema ? <span style={{ color: C.muted, fontSize: 11 }}>{task.esquema} · </span> : null}{task.name}</div>
                        {(task.quantity || task.unit) && (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 6, padding: "2px 8px", marginBottom: 6, fontSize: 11, color: C.mutedSoft }}>
                            <span style={{ fontWeight: 700, color: C.text }}>{task.quantity}</span>
                            {task.unit && <span style={{ color: C.muted }}>{task.unit}</span>}
                          </div>
                        )}
                        <Badge status={task.status} />
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={() => openPhotos(task)} style={{ width: 38, height: 38, backgroundColor: C.orangeDim, border: `0.5px solid ${C.orange}30`, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                          <Camera size={15} color={C.orange} />
                          {(task.photo_count ?? 0) > 0 && (
                            <span style={{ position: "absolute", top: -4, right: -4, backgroundColor: C.orange, color: "#fff", fontSize: 9, fontWeight: 800, width: 16, height: 16, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>{task.photo_count}</span>
                          )}
                        </button>
                        <button onClick={() => { setEditingTask(task); setTaskStatus(task.status || "pendiente"); setTaskProgress(Number(task.progress_percent || 0)); setTaskName(task.name || ""); setTaskUnit(task.unit || ""); setTaskQuantity(task.quantity || ""); setTaskFecha(task.fecha_ejecucion ? String(task.fecha_ejecucion).slice(0, 10) : ""); }} style={{ width: 38, height: 38, backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>✏️</button>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                      {task.duration && <span style={{ fontSize: 11, color: C.muted }}>⏱ {task.duration}</span>}
                      {task.start_date && <span style={{ fontSize: 11, color: C.muted }}>▶ {task.start_date}</span>}
                      {task.end_date && <span style={{ fontSize: 11, color: isLate ? C.danger : C.muted }}>⬛ {task.end_date}</span>}
                    </div>
                    <div style={{ height: 4, background: C.cardAlt, borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ width: `${task.progress_percent || 0}%`, height: "100%", background: barColor, borderRadius: 99 }} />
                    </div>
                    {Number(task.progress_percent) > 0 && (
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 4, textAlign: "right" }}>{task.progress_percent}%</div>
                    )}
                  </div>
                );
              })}
          </>
        )}

        {/* PROYECTOS */}
        {screen === "proyectos" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Proyectos</div>
              {isAdmin && <button onClick={() => setScreen("crearProyecto")} style={{ backgroundColor: C.orange, border: "none", borderRadius: 8, padding: "7px 14px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <Plus size={13} /> Nuevo
              </button>}
            </div>

            {/* Filtro por jefe/supervisor */}
            <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
              <select
                value={projStaffFilter}
                onChange={e => setProjStaffFilter(e.target.value)}
                style={{ flex: 1, height: 42, borderRadius: 10, border: `1.5px solid ${projStaffFilter ? C.orange : C.border}`, backgroundColor: projStaffFilter ? C.orangeDim : C.card, color: projStaffFilter ? C.orange : C.text, fontSize: 13, fontWeight: 700, padding: "0 12px", cursor: "pointer" }}
              >
                <option value="">Todos — filtrar por responsable</option>
                {staff.filter(s => s.role_type === "jefe").length > 0 && (
                  <optgroup label="Jefes a cargo">
                    {staff.filter(s => s.role_type === "jefe").map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </optgroup>
                )}
                {staff.filter(s => s.role_type === "supervisor").length > 0 && (
                  <optgroup label="Supervisores">
                    {staff.filter(s => s.role_type === "supervisor").map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </optgroup>
                )}
              </select>
              {projStaffFilter && (
                <button onClick={() => setProjStaffFilter("")} style={{ height: 42, padding: "0 14px", backgroundColor: C.orange, border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>✕</button>
              )}
            </div>

            {/* Tabs Resumen / Proyectos / Mantenimiento / Equipo */}
            <div style={{ display: "flex", backgroundColor: C.cardAlt, borderRadius: 10, padding: 4, marginBottom: 12, gap: 3 }}>
              {([["resumen", "Resumen"], ["proyecto", "Proyectos"], ["mantenimiento", "Mantenciones"], ...(isAdmin ? [["equipo", "Equipo"]] as const : [])] as [typeof projTab, string][]).map(([key, label]) => (
                <button key={key} onClick={() => { setProjTab(key); if (key === "equipo") loadStaff(); }} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", backgroundColor: projTab === key ? C.card : "transparent", color: projTab === key ? C.orange : C.muted, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>{label}</button>
              ))}
            </div>

            {/* Equipo: jefes y supervisores */}
            {projTab === "equipo" && isAdmin && (
              <>
                <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Nuevo integrante</div>
                  <input value={newStaffName} onChange={e => setNewStaffName(e.target.value)} placeholder="Nombre completo" style={inp} />
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    {([["jefe", "Jefe a cargo"], ["supervisor", "Supervisor"]] as const).map(([key, label]) => (
                      <button key={key} onClick={() => setNewStaffRole(key)} style={{ flex: 1, height: 40, borderRadius: 10, border: `0.5px solid ${newStaffRole === key ? C.orange : C.border}`, backgroundColor: newStaffRole === key ? C.orangeDim : C.cardAlt, color: newStaffRole === key ? C.orange : C.muted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{label}</button>
                    ))}
                  </div>
                  <button onClick={createStaff} disabled={creatingStaff} style={btnPrimary}>{creatingStaff ? "Creando..." : "Agregar"}</button>
                </div>
                {staff.map(s => (
                  <div key={s.id} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 12, marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, background: s.role_type === "jefe" ? C.orangeDim : C.infoDim, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{s.role_type === "jefe" ? "J" : "S"}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{s.role_type === "jefe" ? "Jefe a cargo" : "Supervisor (ingeniero)"}</div>
                    </div>
                    <button onClick={() => deleteStaff(s.id)} style={{ backgroundColor: C.dangerDim, border: "none", borderRadius: 6, padding: "4px 10px", color: C.danger, fontSize: 11, cursor: "pointer" }}>✕</button>
                  </div>
                ))}
                {staff.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: 30, fontSize: 13 }}>Sin integrantes aún</div>}
              </>
            )}

            {/* Resumen */}
            {projTab === "resumen" && (() => {
              const base = projStaffFilter ? projects.filter(p => p.jefe_id === projStaffFilter || p.supervisor_id === projStaffFilter) : projects;
              const grupos: [string, Project[]][] = [
                ["Proyectos", base.filter(p => (p.project_type || "proyecto") === "proyecto")],
                ["Mantenciones", base.filter(p => p.project_type === "mantenimiento")],
              ];
              return grupos.map(([label, items]) => {
                const activos = items.filter(p => (p.status || "activo") === "activo");
                return (
                  <div key={label} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{label}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                      {[["Total", items.length, C.text], ["Activos", activos.length, C.success]].map(([l, v, c]) => (
                        <div key={String(l)} style={{ backgroundColor: C.cardAlt, borderRadius: 10, padding: 10, textAlign: "center" }}>
                          <div style={{ fontSize: 10, color: C.muted }}>{l}</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: c as string, marginTop: 2 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {[...activos].sort((a, b) => label === "Mantenimiento" ? (a.client_name || "zzz").localeCompare(b.client_name || "zzz") : 0).map((p, i, arr) => (
                      <React.Fragment key={p.id}>
                        {label === "Mantenimiento" && (i === 0 || (arr[i - 1].client_name || "") !== (p.client_name || "")) && (
                          <div style={{ fontSize: 11, fontWeight: 800, color: C.orange, marginTop: 8, paddingTop: 6, borderTop: `0.5px solid ${C.border}` }}>{p.client_name || "Sin cliente"}</div>
                        )}
                        <div onClick={() => { setSelectedProject(p); setScreen("partidas"); }} style={{ padding: "8px 0", borderTop: label === "Mantenimiento" ? "none" : `0.5px solid ${C.border}`, cursor: "pointer" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>{p.name}</div>
                              <div style={{ fontSize: 10, color: C.muted }}>{p.jefe_name ? `Jefe: ${p.jefe_name}` : "Sin jefe"}{p.supervisor_name ? ` · Supervisor: ${p.supervisor_name}` : ""}</div>
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: C.orange, flexShrink: 0 }}>{Math.round(+(p.progress_percent || 0))}%</div>
                          </div>
                          <div style={{ height: 3, background: C.border, borderRadius: 99, marginTop: 6, overflow: "hidden" }}>
                            <div style={{ width: `${p.progress_percent || 0}%`, height: "100%", background: C.orange, borderRadius: 99 }} />
                          </div>
                        </div>
                      </React.Fragment>
                    ))}
                    {activos.length === 0 && <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: 8 }}>Sin {label.toLowerCase()} activos</div>}
                  </div>
                );
              });
            })()}

            {/* Pendientes de recepción conforme (solo supervisores/admin) */}
            {projTab === "resumen" && canSeeRecepcion && (() => {
              const base = projStaffFilter ? projects.filter(p => p.jefe_id === projStaffFilter || p.supervisor_id === projStaffFilter) : projects;
              const pendientes = base.filter(p => (p.status || "activo") === "activo" && Math.round(+(p.progress_percent || 0)) >= 100 && !p.recepcion_conforme_at);
              if (pendientes.length === 0) return null;
              return (
                <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.success}50`, borderRadius: 14, padding: 14, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>Pendientes de recepción conforme</div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.success, backgroundColor: C.successDim, borderRadius: 6, padding: "3px 8px" }}>{pendientes.length}</span>
                  </div>
                  {pendientes.map(p => (
                    <div key={p.id} onClick={() => { setSelectedProject(p); setScreen("partidas"); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 10, backgroundColor: C.successDim, marginBottom: 6, cursor: "pointer" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.success }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: C.muted }}>
                          {p.client_name || "Sin cliente"}
                          {p.jefe_name ? ` · ${p.jefe_name}` : ""}
                        </div>
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: C.success, flexShrink: 0 }}>100% ✓</div>
                    </div>
                  ))}
                  <div style={{ fontSize: 10, color: C.muted, textAlign: "center", marginTop: 4 }}>Toca un proyecto para enviar la recepción conforme</div>
                </div>
              );
            })()}

            {/* Prioridades: partidas atrasadas y por vencer */}
            {projTab === "resumen" && (() => {
              const visibleIds = new Set((projStaffFilter ? projects.filter(p => p.jefe_id === projStaffFilter || p.supervisor_id === projStaffFilter) : projects).map(p => p.id));
              const items = priorities.filter(pr => visibleIds.has(pr.project_id));
              const atrasadas = items.filter(pr => pr.prioridad === "atrasada");
              const porVencer = items.filter(pr => pr.prioridad === "por_vencer");
              if (items.length === 0) return null;
              return (
                <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>Prioridades</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {atrasadas.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: C.danger, backgroundColor: C.dangerDim, borderRadius: 6, padding: "3px 8px" }}>{atrasadas.length} atrasada{atrasadas.length !== 1 ? "s" : ""}</span>}
                      {porVencer.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#b45309", backgroundColor: "#fef3c7", borderRadius: 6, padding: "3px 8px" }}>{porVencer.length} por vencer</span>}
                    </div>
                  </div>
                  {items.map(pr => {
                    const proj = projects.find(p => p.id === pr.project_id);
                    const isLate = pr.prioridad === "atrasada";
                    return (
                      <div key={pr.id} onClick={() => { if (proj) { setSelectedProject(proj); setScreen("partidas"); } }} style={{ padding: "8px 10px", borderRadius: 10, backgroundColor: isLate ? C.dangerDim : "#fef3c7", marginBottom: 6, cursor: "pointer" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: isLate ? C.danger : "#b45309" }}>{pr.name}</div>
                            <div style={{ fontSize: 10, color: C.muted }}>
                              {pr.project_name}
                              {pr.end_date && ` · 🏁 ${fmtDate(pr.end_date)}`}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: isLate ? C.danger : "#b45309" }}>{Math.round(+(pr.progress_percent || 0))}%</div>
                            <div style={{ fontSize: 9, fontWeight: 700, color: isLate ? C.danger : "#b45309" }}>{isLate ? "ATRASADA" : "POR VENCER"}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Listado por tipo */}
            {projTab !== "resumen" && projTab !== "equipo" && projects.filter(p => (p.project_type || "proyecto") === projTab && (!projStaffFilter || ((p.jefe_id === projStaffFilter || p.supervisor_id === projStaffFilter) && (p.status || "activo") === "activo"))).sort((a, b) => projTab === "mantenimiento" ? (a.client_name || "zzz").localeCompare(b.client_name || "zzz") : 0).map((p, i, arr) => {
              const isFinished = (p.status || "activo") !== "activo";
              const showClientHeader = projTab === "mantenimiento" && (i === 0 || (arr[i - 1].client_name || "") !== (p.client_name || ""));
              return (
              <React.Fragment key={p.id}>
              {showClientHeader && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 8px", paddingBottom: 6, borderBottom: `1.5px solid ${C.orange}30` }}>
                  <span style={{ fontSize: 14 }}>🏢</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.orange, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>{p.client_name || "Sin cliente"}</span>
                  <span style={{ fontSize: 11, color: C.muted, marginLeft: "auto" }}>{arr.filter(x => (x.client_name || "") === (p.client_name || "")).length} proyecto{arr.filter(x => (x.client_name || "") === (p.client_name || "")).length !== 1 ? "s" : ""}</span>
                </div>
              )}
              <div style={{ backgroundColor: C.card, border: `0.5px solid ${selectedProject?.id === p.id ? C.orange : C.border}`, borderRadius: 14, padding: 14, marginBottom: 8, opacity: isFinished ? 0.6 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <button onClick={() => { setSelectedProject(p); setScreen("partidas"); }} style={{ flex: 1, background: "none", border: "none", textAlign: "left", cursor: "pointer", padding: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: C.orange, fontWeight: 700 }}>#{p.code}</span>
                      {isFinished && <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, backgroundColor: C.cardAlt, borderRadius: 6, padding: "2px 8px" }}>Terminado</span>}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{p.name}</div>
                    {projTab !== "mantenimiento" && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{p.client_name || "Sin cliente"}</div>}
                    {(p.jefe_name || p.supervisor_name) && (
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                        {p.jefe_name && `Jefe: ${p.jefe_name}`}{p.jefe_name && p.supervisor_name && " · "}{p.supervisor_name && `Supervisor: ${p.supervisor_name}`}
                      </div>
                    )}
                    {(p.start_date || p.end_date) && <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{p.start_date && `▶ ${fmtDate(p.start_date)}`}{p.end_date && ` · 🏁 ${fmtDate(p.end_date)}`}</div>}
                    <div style={{ height: 3, background: C.border, borderRadius: 99, marginTop: 10, overflow: "hidden" }}>
                      <div style={{ width: `${p.progress_percent || 0}%`, height: "100%", background: C.orange, borderRadius: 99 }} />
                    </div>
                  </button>
                  {isAdmin && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginLeft: 10, flexShrink: 0 }}>
                      <button onClick={() => { setEditingProject(p); setEditProj({ project_type: p.project_type || "proyecto", status: p.status || "activo", jefe_id: p.jefe_id || "", supervisor_id: p.supervisor_id || "", client_email: p.client_email || "" }); }} style={{ width: 34, height: 34, backgroundColor: C.orangeDim, border: "none", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✏️</button>
                      <button onClick={() => deleteProject(p.id)} style={{ width: 34, height: 34, backgroundColor: C.dangerDim, border: "none", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Trash2 size={14} color={C.danger} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Editor inline (admin) */}
                {editingProject?.id === p.id && (
                  <div style={{ borderTop: `0.5px solid ${C.border}`, marginTop: 10, paddingTop: 10 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <select value={editProj.project_type} onChange={e => setEditProj(f => ({ ...f, project_type: e.target.value }))} style={{ height: 38, borderRadius: 8, border: `0.5px solid ${C.border}`, backgroundColor: C.cardAlt, color: C.text, fontSize: 12, padding: "0 8px" }}>
                        <option value="proyecto">Proyecto</option>
                        <option value="mantenimiento">Mantenimiento</option>
                      </select>
                      <select value={editProj.status} onChange={e => setEditProj(f => ({ ...f, status: e.target.value }))} style={{ height: 38, borderRadius: 8, border: `0.5px solid ${C.border}`, backgroundColor: C.cardAlt, color: C.text, fontSize: 12, padding: "0 8px" }}>
                        <option value="activo">Activo</option>
                        <option value="terminado">Terminado</option>
                      </select>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Correo del cliente (notificaciones)</div>
                    <input type="email" value={editProj.client_email} onChange={e => setEditProj(f => ({ ...f, client_email: e.target.value }))} placeholder="cliente@empresa.cl" style={{ width: "100%", height: 38, borderRadius: 8, border: `0.5px solid ${C.border}`, backgroundColor: C.cardAlt, color: C.text, fontSize: 12, padding: "0 8px", marginBottom: 8, boxSizing: "border-box" as const }} />
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Jefe a cargo</div>
                    <select value={editProj.jefe_id} onChange={e => setEditProj(f => ({ ...f, jefe_id: e.target.value }))} style={{ width: "100%", height: 38, borderRadius: 8, border: `0.5px solid ${C.border}`, backgroundColor: C.cardAlt, color: C.text, fontSize: 12, padding: "0 8px", marginBottom: 8 }}>
                      <option value="">— Sin asignar —</option>
                      {staff.filter(s => s.role_type === "jefe").map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Supervisor (ingeniero)</div>
                    <select value={editProj.supervisor_id} onChange={e => setEditProj(f => ({ ...f, supervisor_id: e.target.value }))} style={{ width: "100%", height: 38, borderRadius: 8, border: `0.5px solid ${C.border}`, backgroundColor: C.cardAlt, color: C.text, fontSize: 12, padding: "0 8px", marginBottom: 10 }}>
                      <option value="">— Sin asignar —</option>
                      {staff.filter(s => s.role_type === "supervisor").map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={saveProjectEdit} disabled={savingProject} style={{ flex: 1, height: 36, backgroundColor: C.orange, border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{savingProject ? "Guardando..." : "Guardar"}</button>
                      <button onClick={() => setEditingProject(null)} style={{ height: 36, padding: "0 14px", backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 8, color: C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
              </React.Fragment>
            );})}
            {projTab !== "resumen" && projTab !== "equipo" && projects.filter(p => (p.project_type || "proyecto") === projTab && (!projStaffFilter || ((p.jefe_id === projStaffFilter || p.supervisor_id === projStaffFilter) && (p.status || "activo") === "activo"))).length === 0 && (
              <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Sin {projTab === "proyecto" ? "proyectos" : "mantenimientos"}{projStaffFilter ? " para este responsable" : ""}</div>
            )}
          </>
        )}

        {/* CREAR PROYECTO */}
        {screen === "crearProyecto" && (
          <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Nuevo proyecto</div>
            {[{ val: projectCode, set: setProjectCode, ph: "Código *", key: "code" }, { val: projectName, set: setProjectName, ph: "Nombre *", key: "name" }].map(({ val, set, ph, key }) => (
              <input key={key} value={val} onChange={e => set(e.target.value)} placeholder={ph} style={inp} />
            ))}

            {/* Cliente y correo: se puede elegir uno ya usado o escribir uno nuevo */}
            <input
              value={clientName}
              onChange={e => {
                const v = e.target.value;
                setClientName(v);
                // Al elegir un cliente conocido, autocompleta su correo si aún no hay uno escrito
                const match = clientSuggestions.find(c => c.name === v);
                if (match?.email) setClientEmail(prev => prev || match.email!);
              }}
              placeholder="Cliente"
              list="client-suggestions"
              style={inp}
            />
            <datalist id="client-suggestions">
              {clientSuggestions.map(c => <option key={c.name} value={c.name}>{c.rut ? `${c.rut}` : ""}</option>)}
            </datalist>

            <input
              value={clientEmail}
              onChange={e => setClientEmail(e.target.value)}
              placeholder="Correo del cliente (notificaciones)"
              type="email"
              list="client-email-suggestions"
              style={inp}
            />
            <datalist id="client-email-suggestions">
              {Array.from(new Set(clientSuggestions.map(c => c.email).filter(Boolean))).map(em => <option key={em!} value={em!} />)}
            </datalist>
            <div style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>Fecha de inicio</div>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...inp, marginBottom: 10 }} />
            <div style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>Fecha de término</div>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ ...inp, marginBottom: 12 }} />
            <div style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>Tipo</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {([["proyecto", "Proyecto"], ["mantenimiento", "Mantenimiento"]] as const).map(([key, label]) => (
                <button key={key} onClick={() => setNewProjType(key)} style={{ flex: 1, height: 40, borderRadius: 10, border: `0.5px solid ${newProjType === key ? C.orange : C.border}`, backgroundColor: newProjType === key ? C.orangeDim : C.cardAlt, color: newProjType === key ? C.orange : C.muted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{label}</button>
              ))}
            </div>
            {isAdmin && <>
              <div style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>Jefe a cargo</div>
              <select value={newProjJefe} onChange={e => setNewProjJefe(e.target.value)} style={{ ...inp, marginBottom: 12 }}>
                <option value="">— Sin asignar —</option>
                {staff.filter(s => s.role_type === "jefe").map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <div style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>Supervisor (ingeniero)</div>
              <select value={newProjSupervisor} onChange={e => setNewProjSupervisor(e.target.value)} style={{ ...inp, marginBottom: 16 }}>
                <option value="">— Sin asignar —</option>
                {staff.filter(s => s.role_type === "supervisor").map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </>}
            <button onClick={createProject} disabled={creatingProject} style={btnPrimary}>{creatingProject ? "Creando..." : "Crear proyecto"}</button>
          </div>
        )}

        {/* ADMIN */}
        {screen === "admin" && isAdmin && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Usuarios</div>
              <button onClick={() => setScreen("crearUsuario")} style={{ backgroundColor: C.orange, border: "none", borderRadius: 8, padding: "7px 14px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <Plus size={13} /> Nuevo
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
              {[{ label: "Total", value: users.length, color: C.text }, { label: "Activos", value: users.filter(u => u.is_active).length, color: C.success }, { label: "Inactivos", value: users.filter(u => !u.is_active).length, color: C.danger }].map(({ label, value, color }) => (
                <div key={label} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: C.muted }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
                </div>
              ))}
            </div>
            {users.map(user => {
              const r = ROLES.find(r => r.value === user.role) || ROLES[2];
              return (
                <div key={user.id} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 8, opacity: user.is_active ? 1 : 0.5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <Av name={user.full_name} role={user.role} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{user.full_name}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{user.email}</div>
                    </div>
                    <Toggle on={user.is_active} onToggle={async () => { await fetch(`${API_URL}/users/${user.id}/toggle`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } }); await loadUsers(); }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ backgroundColor: r.bg, color: r.color, border: `0.5px solid ${r.border}`, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>{r.icon} {r.label}</span>
                    <button onClick={() => openEditUser(user)} style={{ backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 8, padding: "5px 12px", color: C.mutedSoft, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Editar</button>
                  </div>
                </div>
              );
            })}

            {/* Papelera de partidas */}
            <div style={{ marginTop: 20 }}>
              <div
                onClick={() => { const next = !trashOpen; setTrashOpen(next); if (next) loadTrash(); }}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 14, cursor: "pointer" }}
              >
                <div style={{ fontSize: 14, fontWeight: 700 }}>Papelera de partidas</div>
                <span style={{ fontSize: 12, color: C.muted }}>{trashOpen ? "▲" : "▼"}</span>
              </div>
              {trashOpen && (
                <div style={{ marginTop: 8 }}>
                  {trashTasks.length === 0 && (
                    <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 20 }}>Papelera vacía</div>
                  )}
                  {trashTasks.map(t => (
                    <div key={t.id} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 12, marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
                        {t.project_name} · {t.photo_count > 0 ? `${t.photo_count} foto${t.photo_count !== 1 ? "s" : ""} · ` : ""}Eliminada {fmtDate(t.deleted_at)}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => restoreTask(t.id)} style={{ flex: 1, height: 34, backgroundColor: C.successDim, border: "none", borderRadius: 8, color: C.success, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>↩️ Restaurar</button>
                        <button onClick={() => purgeTask(t.id)} style={{ height: 34, padding: "0 14px", backgroundColor: C.dangerDim, border: "none", borderRadius: 8, color: C.danger, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Eliminar definitivo</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* EDITAR USUARIO */}
        {screen === "editarUsuario" && editingUser && (
          <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Editar usuario</div>
              <button onClick={() => deleteUser(editingUser.id)} style={{ backgroundColor: C.dangerDim, border: "none", borderRadius: 8, padding: "5px 12px", color: C.danger, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Eliminar</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16 }}>
              <Av name={editingUser.full_name} role={editRole} size={52} />
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 8 }}>{editingUser.full_name}</div>
            </div>
            {[{ val: editName, set: setEditName, ph: "Nombre" }, { val: editEmail, set: setEditEmail, ph: "Correo" }].map(({ val, set, ph }, i) => (
              <input key={i} value={val} onChange={e => set(e.target.value)} placeholder={ph} style={inp} />
            ))}
            <input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="Nueva contraseña (opcional)" style={{ ...inp, marginBottom: 14 }} />
            <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Rol</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
              {ROLES.map(r => (
                <button key={r.value} onClick={() => setEditRole(r.value)} style={{ backgroundColor: editRole === r.value ? r.bg : C.cardAlt, border: `0.5px solid ${editRole === r.value ? r.border : C.border}`, borderRadius: 10, padding: "10px 4px", cursor: "pointer", textAlign: "center" }}>
                  <div style={{ fontSize: 18 }}>{r.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: editRole === r.value ? r.color : C.muted, marginTop: 4 }}>{r.label}</div>
                </button>
              ))}
            </div>
            <div style={{ backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div><div style={{ fontSize: 13, fontWeight: 600 }}>Acceso activo</div><div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Puede ingresar a la app</div></div>
              <Toggle on={editActive} onToggle={() => setEditActive(!editActive)} />
            </div>
            <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Permisos</div>
            {PERMISSIONS.map(p => (
              <div key={p.key} style={{ backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{p.icon}</span>
                  <div><div style={{ fontSize: 13, fontWeight: 600 }}>{p.label}</div><div style={{ fontSize: 11, color: C.muted }}>{p.sub}</div></div>
                </div>
                <Toggle on={!!editPermissions[p.key]} onToggle={() => setEditPermissions(prev => ({ ...prev, [p.key]: !prev[p.key] }))} />
              </div>
            ))}
            <button onClick={saveUser} disabled={savingUser} style={{ ...btnPrimary, marginTop: 12 }}>{savingUser ? "Guardando..." : "Guardar cambios"}</button>
          </div>
        )}

        {/* CREAR USUARIO */}
        {screen === "crearUsuario" && (
          <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Nuevo usuario</div>
            {[{ val: newUserName, set: setNewUserName, ph: "Nombre completo *", type: "text" }, { val: newUserEmail, set: setNewUserEmail, ph: "Correo *", type: "email" }, { val: newUserPassword, set: setNewUserPassword, ph: "Contraseña *", type: "password" }].map(({ val, set, ph, type }, i) => (
              <input key={i} type={type} value={val} onChange={e => set(e.target.value)} placeholder={ph} style={inp} />
            ))}
            <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 8, marginTop: 4, textTransform: "uppercase", letterSpacing: 1 }}>Rol</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
              {ROLES.map(r => (
                <button key={r.value} onClick={() => setNewUserRole(r.value)} style={{ backgroundColor: newUserRole === r.value ? r.bg : C.cardAlt, border: `0.5px solid ${newUserRole === r.value ? r.border : C.border}`, borderRadius: 10, padding: "10px 4px", cursor: "pointer", textAlign: "center" }}>
                  <div style={{ fontSize: 18 }}>{r.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: newUserRole === r.value ? r.color : C.muted, marginTop: 4 }}>{r.label}</div>
                </button>
              ))}
            </div>
            <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Permisos</div>
            {PERMISSIONS.map(p => (
              <div key={p.key} style={{ backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{p.icon}</span>
                  <div><div style={{ fontSize: 13, fontWeight: 600 }}>{p.label}</div><div style={{ fontSize: 11, color: C.muted }}>{p.sub}</div></div>
                </div>
                <Toggle on={!!newUserPermissions[p.key]} onToggle={() => setNewUserPermissions(prev => ({ ...prev, [p.key]: !prev[p.key] }))} />
              </div>
            ))}
            <button onClick={createUser} disabled={creatingUser} style={{ ...btnPrimary, marginTop: 12 }}>{creatingUser ? "Creando..." : "Crear usuario"}</button>
          </div>
        )}

        {/* CONFIGURACION */}
        {screen === "configuracion" && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Configuración</div>
            <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <Av name={userName} size={52} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{userName}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{userRole}</div>
                </div>
              </div>
              <button onClick={() => { setToken(null); setTasks([]); setSelectedProject(null); setScreen("home"); }} style={{ width: "100%", height: 44, backgroundColor: C.dangerDim, border: `0.5px solid ${C.dangerDim}`, borderRadius: 10, color: C.danger, fontWeight: 600, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <LogOut size={15} /> Cerrar sesión
              </button>
            </div>
            <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Logo de empresa</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Aparecerá en los informes Word generados</div>
              <input ref={logoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => setLogoFile(e.target.files?.[0] || null)} />
              <button onClick={() => logoInputRef.current?.click()} style={{ width: "100%", height: 44, backgroundColor: C.cardAlt, border: `0.5px solid ${logoFile ? C.orange : C.border}`, borderRadius: 10, color: logoFile ? C.orange : C.mutedSoft, cursor: "pointer", fontSize: 13, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Image size={15} /> {logoFile ? logoFile.name : "Seleccionar logo"}
              </button>
              <button onClick={uploadLogo} disabled={uploadingLogo || !logoFile} style={{ width: "100%", height: 44, backgroundColor: !logoFile ? C.cardAlt : C.orange, border: "none", borderRadius: 10, color: !logoFile ? C.muted : "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                {uploadingLogo ? "Subiendo..." : "Subir logo"}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Modal importar cotización PDF */}
      {showQuoteImport && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.92)", zIndex: 500, display: "flex", alignItems: "flex-end" }}>
          <div style={{ backgroundColor: C.card, borderRadius: "20px 20px 0 0", padding: 20, width: "100%", maxWidth: 600, margin: "0 auto", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Importar Cotización PDF</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Paso {quoteStep} de 2 · {quoteStep === 1 ? "Subir PDF" : `${quoteItems.filter(i => i.selected).length} partidas seleccionadas`}</div>
              </div>
              <button onClick={() => { setShowQuoteImport(false); setQuoteStep(1); setPdfFile(null); setQuoteItems([]); }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 22, lineHeight: 1 }}>✕</button>
            </div>

            {quoteStep === 1 && (
              <>
                <div style={{ backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 12, color: C.mutedSoft, lineHeight: 1.6 }}>
                  Sube el PDF de cotización MATFAU SPA. La IA extraerá las partidas automáticamente <strong style={{ color: C.text }}>sin mostrar precios</strong>.
                </div>
                <input ref={pdfInputRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={e => setPdfFile(e.target.files?.[0] || null)} />
                <button onClick={() => pdfInputRef.current?.click()} style={{ width: "100%", height: 48, backgroundColor: C.cardAlt, border: `0.5px solid ${pdfFile ? C.orange : C.border}`, borderRadius: 10, color: pdfFile ? C.orange : C.mutedSoft, cursor: "pointer", fontSize: 13, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <FileText size={16} /> {pdfFile ? `📎 ${pdfFile.name}` : "Seleccionar PDF"}
                </button>
                <button onClick={extractQuotePdf} disabled={extractingPdf || !pdfFile} style={{ width: "100%", height: 48, backgroundColor: !pdfFile ? C.cardAlt : C.orange, border: "none", borderRadius: 12, color: !pdfFile ? C.muted : "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                  {extractingPdf ? "Extrayendo con IA..." : "Extraer partidas con IA"}
                </button>
              </>
            )}

            {quoteStep === 2 && (
              <>
                {/* Fechas globales */}
                <div style={{ backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.orange, marginBottom: 10 }}>Aplicar fechas a todas las partidas</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Inicio</div>
                      <input type="date" value={globalStartDate} onChange={e => { setGlobalStartDate(e.target.value); setQuoteItems(items => items.map(it => ({ ...it, start_date: e.target.value }))); }} style={{ width: "100%", height: 38, backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12, padding: "0 8px", boxSizing: "border-box", outline: "none" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Término</div>
                      <input type="date" value={globalEndDate} onChange={e => { setGlobalEndDate(e.target.value); setQuoteItems(items => items.map(it => ({ ...it, end_date: e.target.value }))); }} style={{ width: "100%", height: 38, backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12, padding: "0 8px", boxSizing: "border-box", outline: "none" }} />
                    </div>
                  </div>
                </div>

                {/* Lista de partidas */}
                {quoteItems.map((item, i) => (
                  <div key={item.tempId} style={{ backgroundColor: item.selected ? C.orangeDim : C.cardAlt, border: `0.5px solid ${item.selected ? C.orange + "50" : C.border}`, borderRadius: 12, padding: 12, marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div onClick={() => setQuoteItems(items => items.map((it, j) => j === i ? { ...it, selected: !it.selected } : it))} style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${item.selected ? C.orange : C.border}`, backgroundColor: item.selected ? C.orange : "transparent", flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2, fontSize: 13, color: "#fff" }}>
                        {item.selected ? "✓" : ""}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.3, marginBottom: 4 }}>{item.name}</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                          {item.codigo && <span style={{ fontSize: 11, color: C.orange, backgroundColor: C.orangeDim, padding: "2px 8px", borderRadius: 4 }}>#{item.codigo}</span>}
                          {item.quantity && <span style={{ fontSize: 11, color: C.muted }}>{item.quantity} {item.unit}</span>}
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <input type="date" value={item.start_date} onChange={e => setQuoteItems(items => items.map((it, j) => j === i ? { ...it, start_date: e.target.value } : it))} style={{ flex: 1, height: 32, backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 11, padding: "0 6px", outline: "none" }} />
                          <input type="date" value={item.end_date} onChange={e => setQuoteItems(items => items.map((it, j) => j === i ? { ...it, end_date: e.target.value } : it))} style={{ flex: 1, height: 32, backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 11, padding: "0 6px", outline: "none" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <button onClick={() => setQuoteStep(1)} style={{ flex: 1, height: 46, background: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 12, color: C.muted, fontWeight: 600, cursor: "pointer" }}>← Volver</button>
                  <button onClick={bulkCreateTasks} disabled={bulkCreating} style={{ flex: 2, height: 46, background: C.orange, border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                    {bulkCreating ? "Creando partidas..." : `Crear ${quoteItems.filter(i => i.selected).length} partidas`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─GASTOS ── */}
      {screen === "gastos" && (
        <>
          {/* Modal agregar gasto */}
          {showAddExpense && (
            <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.9)", zIndex: 400, display: "flex", alignItems: "flex-end" }}>
              <div style={{ backgroundColor: C.card, borderRadius: "20px 20px 0 0", padding: 20, width: "100%", maxWidth: 600, margin: "0 auto", maxHeight: "90vh", overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>Registrar gasto</div>
                  <button onClick={() => setShowAddExpense(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} color={C.muted} /></button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                  {EXPENSE_CATEGORIES.map(cat => (
                    <button key={cat.value} onClick={() => setExpCategory(cat.value)} style={{ padding: "10px 8px", backgroundColor: expCategory === cat.value ? C.orangeDim : C.cardAlt, border: `0.5px solid ${expCategory === cat.value ? C.orange : C.border}`, borderRadius: 10, color: expCategory === cat.value ? C.orange : C.mutedSoft, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cat.color, display: "inline-block" }} />{cat.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <input value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder="Monto total ($)" type="number" style={{ ...inp, marginBottom: 0 }} />
                  <input value={expDate} onChange={e => setExpDate(e.target.value)} type="date" style={{ ...inp, marginBottom: 0 }} />
                </div>
                <div style={{ height: 8 }} />
                <input value={expSupplier} onChange={e => setExpSupplier(e.target.value)} placeholder="Proveedor (opcional)" style={inp} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <input value={expRut} onChange={e => setExpRut(e.target.value)} placeholder="RUT proveedor" style={{ ...inp, marginBottom: 0 }} />
                  <input value={expDocNum} onChange={e => setExpDocNum(e.target.value)} placeholder="N° documento" style={{ ...inp, marginBottom: 0 }} />
                </div>
                <div style={{ height: 8 }} />
                <select value={expDocType} onChange={e => setExpDocType(e.target.value)} style={{ ...inp }}>
                  <option value="factura">Factura</option>
                  <option value="boleta">Boleta</option>
                  <option value="nota_debito">Nota de débito</option>
                  <option value="otro">Otro</option>
                </select>
                <select value={expProjectId} onChange={e => setExpProjectId(e.target.value)} style={{ ...inp }}>
                  <option value="">Sin proyecto</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={expCostCenterId} onChange={e => setExpCostCenterId(e.target.value)} style={{ ...inp }}>
                  <option value="">Sin centro de costo</option>
                  {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.name}{cc.type === "project" ? " (obra)" : ""}</option>)}
                </select>
                <input value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="Descripción (opcional)" style={inp} />
                {expAmount && <div style={{ backgroundColor: C.cardAlt, borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", fontSize: 12, color: C.mutedSoft }}>
                  <span>Neto: <b style={{ color: C.text }}>{fmtCLP(Math.round(+expAmount / 1.19))}</b></span>
                  <span>IVA 19%: <b style={{ color: C.text }}>{fmtCLP(+expAmount - Math.round(+expAmount / 1.19))}</b></span>
                  <span>Total: <b style={{ color: C.orange }}>{fmtCLP(+expAmount)}</b></span>
                </div>}
                <button onClick={createExpense} disabled={savingExpense} style={btnPrimary}>{savingExpense ? "Guardando..." : "Registrar gasto"}</button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: C.orange, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Módulo</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>Gastos</div>
            </div>
            <button onClick={() => { setShowAddExpense(true); loadCostCenters(); }} style={{ backgroundColor: C.orange, border: "none", borderRadius: 10, padding: "9px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={16} /> Agregar
            </button>
          </div>

          {/* Selector de mes */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <input type="month" value={gastosMonth} onChange={e => { setGastosMonth(e.target.value); loadExpenses(e.target.value); loadNuboxSummary(e.target.value); }} style={{ ...inp, marginBottom: 0, flex: 1 }} />
            <button onClick={() => loadExpenses()} style={{ height: 48, padding: "0 16px", backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, color: C.mutedSoft, cursor: "pointer", fontSize: 13 }}>↻</button>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", backgroundColor: C.cardAlt, borderRadius: 10, padding: 4, marginBottom: 16, gap: 3 }}>
            {(["resumen", "lista", "nubox", "centros"] as const).filter(t => t !== "resumen" || canSeeGastosResumen).map(t => (
              <button key={t} onClick={() => { setGastosTab(t as typeof gastosTab); if (t === "lista" || t === "resumen") { loadExpenses(); loadNuboxSummary(); } if (t === "nubox") { loadNuboxPurchases(); loadCostCenters(); loadProjects(); } }} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", backgroundColor: gastosTab === t ? C.card : "transparent", color: gastosTab === t ? C.orange : C.muted, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>
                {t === "resumen" ? "Resumen" : t === "lista" ? "Detalle" : t === "nubox" ? "Nubox" : "Centros"}
              </button>
            ))}
          </div>

          {/* TAB: RESUMEN */}
          {gastosTab === "resumen" && canSeeGastosResumen && (
            <>
              {/* ─SECCIÓN NUBOX ── */}
              <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Facturas Nubox — {fmtMonth(gastosMonth)}</div>
                  {!nuboxSummary && <div style={{ fontSize: 11, color: C.muted }}>Cargando...</div>}
                </div>
                {nuboxSummary && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                      <div style={{ backgroundColor: C.cardAlt, borderRadius: 10, padding: 10 }}>
                        <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>Total facturas</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: C.orange }}>{fmtCLP(nuboxSummary.total_bruto)}</div>
                        <div style={{ fontSize: 10, color: C.muted }}>{nuboxSummary.total_facturas} doc · Neto {fmtCLP(nuboxSummary.total_neto)}</div>
                      </div>
                      <div style={{ backgroundColor: C.cardAlt, borderRadius: 10, padding: 10 }}>
                        <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>Sin asignar</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: nuboxSummary.sin_asignar > 0 ? C.danger : C.success }}>
                          {fmtCLP(nuboxSummary.total_sin_asignar)}
                        </div>
                        <div style={{ fontSize: 10, color: C.muted }}>{nuboxSummary.sin_asignar} factura{nuboxSummary.sin_asignar !== 1 ? "s" : ""} pendiente{nuboxSummary.sin_asignar !== 1 ? "s" : ""}</div>
                      </div>
                    </div>
                    {nuboxSummary.asignadas > 0 && (
                      <div
                        onClick={() => setNuboxKpiExpanded(e => !e)}
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: `0.5px solid ${C.border}`, fontSize: 12, cursor: "pointer" }}
                      >
                        <span style={{ color: C.muted }}>Asignadas a centros de costo</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 700, color: C.success }}>{fmtCLP(nuboxSummary.total_asignado)} ({nuboxSummary.asignadas})</span>
                          <span style={{ fontSize: 10, color: C.muted }}>{nuboxKpiExpanded ? "▲" : "▼"}</span>
                        </span>
                      </div>
                    )}

                    {/* Desglose por centro de costo */}
                    {nuboxKpiExpanded && nuboxSummary.cost_center_breakdown?.length > 0 && (
                      <div style={{ backgroundColor: C.cardAlt, borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
                        {nuboxSummary.cost_center_breakdown.map((cc: any, i: number) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: i < nuboxSummary.cost_center_breakdown.length - 1 ? `0.5px solid ${C.border}` : "none" }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{cc.code ? `[${cc.code}] ` : ""}{cc.name}</div>
                              <div style={{ fontSize: 10, color: C.muted }}>{cc.facturas} factura{cc.facturas !== 1 ? "s" : ""}</div>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{fmtCLP(cc.total)}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {nuboxSummary.sin_asignar > 0 && (
                      <button onClick={() => setGastosTab("nubox")} style={{ width: "100%", marginTop: 8, padding: "8px 0", borderRadius: 8, border: "none", backgroundColor: C.orangeDim, color: C.orange, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        Asignar {nuboxSummary.sin_asignar} factura{nuboxSummary.sin_asignar !== 1 ? "s" : ""} pendiente{nuboxSummary.sin_asignar !== 1 ? "s" : ""} →
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* ─SECCIÓN REMUNERACIONES ── */}
              <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
                <input ref={payrollPdfRef} type="file" accept=".xlsx,.xls,.pdf" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) uploadPayrollPdf(e.target.files[0]); e.target.value = ""; }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Remuneraciones — {fmtMonth(gastosMonth)}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => payrollPdfRef.current?.click()} disabled={uploadingPayrollPdf} style={{ backgroundColor: C.infoDim, border: `0.5px solid ${C.info}`, borderRadius: 8, padding: "5px 10px", color: C.info, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>
                      {uploadingPayrollPdf ? "Leyendo..." : "Excel/PDF"}
                    </button>
                    <button onClick={() => { setShowPayrollForm(true); setPayrollAmount(payroll ? String(payroll.total_amount) : ""); setPayrollNote(payroll?.note || ""); }} style={{ backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 8, padding: "5px 10px", color: C.muted, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>
                      {payroll ? "Editar" : "+ Manual"}
                    </button>
                  </div>
                </div>
                {uploadingPayrollPdf && <div style={{ fontSize: 12, color: C.info, padding: "8px 0" }}>Leyendo PDF con IA...</div>}
                {payroll ? (
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: C.purple }}>{fmtCLP(payroll.total_amount)}</div>
                    {payroll.note && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{payroll.note}</div>}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: C.muted }}>Sin dato — sube el PDF del libro de remuneraciones o ingresa manual</div>
                )}
                {payrollPdfResult && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${C.border}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6 }}>Detalle extraído del PDF</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                      {[
                        { label: "Haberes", value: fmtCLP(payrollPdfResult.total_haberes) },
                        { label: "Descuentos", value: fmtCLP(payrollPdfResult.total_descuentos) },
                        { label: "Líquido", value: fmtCLP(payrollPdfResult.total_liquido) },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ backgroundColor: C.cardAlt, borderRadius: 8, padding: 8, textAlign: "center" }}>
                          <div style={{ fontSize: 9, color: C.muted }}>{label}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{value}</div>
                        </div>
                      ))}
                    </div>
                    {payrollPdfResult.cantidad_trabajadores > 0 && <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>👥 {payrollPdfResult.cantidad_trabajadores} trabajadores · {payrollPdfResult.periodo}</div>}
                  </div>
                )}
                {showPayrollForm && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `0.5px solid ${C.border}` }}>
                    <input
                      value={payrollAmount}
                      onChange={e => setPayrollAmount(e.target.value)}
                      placeholder="Monto total remuneraciones"
                      type="number"
                      style={{ ...inp, marginBottom: 8 }}
                    />
                    <input
                      value={payrollNote}
                      onChange={e => setPayrollNote(e.target.value)}
                      placeholder="Nota (opcional, ej: 12 trabajadores)"
                      style={{ ...inp, marginBottom: 8 }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setShowPayrollForm(false)} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: `0.5px solid ${C.border}`, backgroundColor: C.cardAlt, color: C.muted, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
                      <button onClick={savePayroll} disabled={savingPayroll} style={{ flex: 2, padding: "9px 0", borderRadius: 8, border: "none", backgroundColor: C.purple, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{savingPayroll ? "Guardando..." : "Guardar"}</button>
                    </div>
                  </div>
                )}
              </div>

              {/* ─SECCIÓN IVA ── */}
              {nuboxSalesSummary?.iva && (
                <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Estimación IVA — {fmtMonth(gastosMonth)}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                    <div style={{ backgroundColor: C.cardAlt, borderRadius: 10, padding: 10, textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: C.muted, marginBottom: 2 }}>Débito fiscal</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: C.orange }}>{fmtCLP(nuboxSalesSummary.iva.debito_fiscal)}</div>
                      <div style={{ fontSize: 9, color: C.muted }}>IVA ventas</div>
                    </div>
                    <div style={{ backgroundColor: C.cardAlt, borderRadius: 10, padding: 10, textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: C.muted, marginBottom: 2 }}>Crédito fiscal</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: C.info }}>{fmtCLP(nuboxSalesSummary.iva.credito_fiscal)}</div>
                      <div style={{ fontSize: 9, color: C.muted }}>IVA compras</div>
                    </div>
                    <div style={{ backgroundColor: nuboxSalesSummary.iva.saldo > 0 ? C.dangerDim : C.successDim, borderRadius: 10, padding: 10, textAlign: "center", border: `0.5px solid ${nuboxSalesSummary.iva.saldo > 0 ? C.danger : C.success}` }}>
                      <div style={{ fontSize: 9, color: C.muted, marginBottom: 2 }}>Saldo IVA</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: nuboxSalesSummary.iva.saldo > 0 ? C.danger : C.success }}>{fmtCLP(Math.abs(nuboxSalesSummary.iva.saldo))}</div>
                      <div style={{ fontSize: 9, color: C.muted }}>{nuboxSalesSummary.iva.saldo > 0 ? "A pagar SII" : "A favor"}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, textAlign: "center" }}>* Estimación basada en facturas Nubox. Verificar en SII.</div>
                </div>
              )}

              {/* ─SECCIÓN VENTAS NUBOX (solo admin) ── */}
              {isAdmin && <div onClick={() => { setGastosTab("nubox"); setNuboxView("ventas"); loadProjects(); if (!nuboxSalesSummary) loadNuboxSummary(); }} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 14, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Ventas emitidas — {fmtMonth(gastosMonth)}</div>
                  <div style={{ fontSize: 12, color: C.orange, fontWeight: 700 }}>Ver facturas →</div>
                </div>
                {!nuboxSalesSummary && <div style={{ fontSize: 12, color: C.muted }}>Cargando...</div>}
                {nuboxSalesSummary && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ backgroundColor: C.cardAlt, borderRadius: 10, padding: 10 }}>
                      <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>Total ventas</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: C.success }}>{fmtCLP(nuboxSalesSummary.sales?.total_ventas || 0)}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{nuboxSalesSummary.sales?.total_facturas || 0} facturas</div>
                    </div>
                    <div style={{ backgroundColor: C.cardAlt, borderRadius: 10, padding: 10 }}>
                      <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>IVA débito</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: C.orange }}>{fmtCLP(nuboxSalesSummary.sales?.iva_debito || 0)}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>IVA cobrado</div>
                    </div>
                  </div>
                )}
              </div>}

              {/* ─MARGEN ── */}
              {(() => {
                const ventasNeto = Number(nuboxSalesSummary?.sales?.total_neto) || 0;
                const comprasNeto = Number(nuboxSummary?.total_neto) || 0;
                const remuneraciones = Number(payroll?.total_amount) || 0;
                const totalGastos = comprasNeto + remuneraciones;
                const margen = ventasNeto - totalGastos;
                const margenPct = ventasNeto > 0 ? (margen / ventasNeto) * 100 : 0;
                const ivaDebito = nuboxSalesSummary?.iva?.debito_fiscal || 0;
                const ivaCredito = nuboxSalesSummary?.iva?.credito_fiscal || 0;
                const ivaNet = ivaDebito - ivaCredito;
                if (ventasNeto === 0 && totalGastos === 0) return null;
                const mc = margen >= 0 ? C.success : C.danger;
                const md = margen >= 0 ? C.successDim : C.dangerDim;
                return (
                  <>
                    {/* Margen operacional */}
                    <div style={{ backgroundColor: C.card, border: `1.5px solid ${mc}`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.mutedSoft, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Margen operacional neto</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: mc, lineHeight: 1.1 }}>{margen < 0 ? "-" : ""}{fmtCLP(Math.abs(margen))}</div>
                          <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{margen >= 0 ? "Resultado positivo" : "Resultado negativo"}</div>
                        </div>
                        <div style={{ width: 58, height: 58, flexShrink: 0, borderRadius: "50%", backgroundColor: md, border: `2px solid ${mc}`, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", marginLeft: 10 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: mc }}>{margenPct >= 0 ? "+" : ""}{margenPct.toFixed(1)}%</div>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                        {[
                          { label: "Ventas neto", value: fmtCLP(ventasNeto), color: C.success },
                          { label: "Compras neto", value: fmtCLP(comprasNeto), color: C.danger },
                          { label: "Remuner.", value: fmtCLP(remuneraciones), color: C.purple },
                        ].map(({ label, value, color }) => (
                          <div key={label} style={{ backgroundColor: C.cardAlt, borderRadius: 8, padding: "7px 6px", textAlign: "center" }}>
                            <div style={{ fontSize: 9, color: C.muted, marginBottom: 2 }}>{label}</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color }}>{value}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* IVA a compensar */}
                    {(ivaDebito > 0 || ivaCredito > 0) && (
                      <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.mutedSoft, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>IVA a compensar</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                          <div style={{ backgroundColor: C.dangerDim, borderRadius: 8, padding: "7px 6px", textAlign: "center" }}>
                            <div style={{ fontSize: 9, color: C.muted, marginBottom: 2 }}>Débito fiscal</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: C.danger }}>{fmtCLP(ivaDebito)}</div>
                            <div style={{ fontSize: 8, color: C.muted }}>IVA ventas</div>
                          </div>
                          <div style={{ backgroundColor: C.successDim, borderRadius: 8, padding: "7px 6px", textAlign: "center" }}>
                            <div style={{ fontSize: 9, color: C.muted, marginBottom: 2 }}>Crédito fiscal</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: C.success }}>{fmtCLP(ivaCredito)}</div>
                            <div style={{ fontSize: 8, color: C.muted }}>IVA compras</div>
                          </div>
                          <div style={{ backgroundColor: ivaNet > 0 ? C.dangerDim : C.successDim, border: `1px solid ${ivaNet > 0 ? C.danger : C.success}`, borderRadius: 8, padding: "7px 6px", textAlign: "center" }}>
                            <div style={{ fontSize: 9, color: C.muted, marginBottom: 2 }}>Saldo IVA</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: ivaNet > 0 ? C.danger : C.success }}>{fmtCLP(Math.abs(ivaNet))}</div>
                            <div style={{ fontSize: 8, color: C.muted }}>{ivaNet > 0 ? "A pagar SII" : "A favor"}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* ─SECCIÓN GASTOS MANUALES ── */}
              {!expenseSummary && <div style={{ textAlign: "center", color: C.muted, padding: 20, cursor: "pointer" }} onClick={() => loadExpenses()}>Toca para cargar gastos</div>}
              {expenseSummary && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.mutedSoft, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Gastos manuales registrados</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                    {[
                      { label: "Total bruto", value: fmtCLP(expenseSummary.totals.total), color: C.orange },
                      { label: "Neto", value: fmtCLP(expenseSummary.totals.neto), color: C.info },
                      { label: "IVA", value: fmtCLP(expenseSummary.totals.iva), color: C.purple },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 12, textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  {expenseSummary.byProject.length > 0 && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.mutedSoft, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Por proyecto</div>
                      {expenseSummary.byProject.map((row, i) => {
                        const maxTotal = Math.max(...expenseSummary.byProject.map(r => r.total));
                        return (
                          <div key={i} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 12, marginBottom: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>{row.project_name || "Sin proyecto"}</div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: C.orange }}>{fmtCLP(row.total)}</div>
                            </div>
                            <div style={{ height: 3, background: C.border, borderRadius: 99, overflow: "hidden" }}>
                              <div style={{ width: `${(row.total / maxTotal) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${C.orange}, #FFB347)`, borderRadius: 99 }} />
                            </div>
                            <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{row.count} documento{row.count !== 1 ? "s" : ""}</div>
                          </div>
                        );
                      })}
                    </>
                  )}
                  {expenseSummary.byCategory.length > 0 && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.mutedSoft, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 16 }}>Por categoría</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {expenseSummary.byCategory.map((row, i) => {
                          const cat = EXPENSE_CATEGORIES.find(c => c.value === row.category) || { label: row.category, color: colorCategoria(row.category) };
                          return (
                            <div key={i} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
                              <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cat.color, marginBottom: 8 }} />
                              <div style={{ fontSize: 11, color: C.muted }}>{cat.label}</div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginTop: 2 }}>{fmtCLP(row.total)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                  {expenseSummary.byProject.length === 0 && expenseSummary.byCategory.length === 0 && (
                    <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Sin gastos en {fmtMonth(gastosMonth)}</div>
                  )}
                </>
              )}
            </>
          )}

          {/* TAB: LISTA */}
          {gastosTab === "lista" && (
            <>
              {expenses.length === 0 && (
                <div style={{ textAlign: "center", padding: 40 }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
                  <div style={{ color: C.muted, fontSize: 14 }}>Sin gastos en {fmtMonth(gastosMonth)}</div>
                  <button onClick={() => setShowAddExpense(true)} style={{ ...btnPrimary, marginTop: 16, width: "auto", padding: "10px 24px" }}>+ Agregar primer gasto</button>
                </div>
              )}
              {expenses.map(exp => {
                const cat = EXPENSE_CATEGORIES.find(c => c.value === exp.category) || { label: exp.category, color: colorCategoria(exp.category) };
                return (
                  <div key={exp.id} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ display: "flex", gap: 10, flex: 1, minWidth: 0 }}>
                        <div style={{ width: 38, height: 38, background: cat.color + "1A", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cat.color }} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{exp.supplier_name || cat.label}</div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{exp.project_name || exp.cost_center_name || "Sin asignación"}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{new Date(exp.expense_date + "T12:00:00").toLocaleDateString("es-CL")} · {exp.document_type}{exp.document_number ? ` N°${exp.document_number}` : ""}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: C.orange }}>{fmtCLP(exp.amount)}</div>
                        <div style={{ fontSize: 10, color: C.muted }}>IVA: {fmtCLP(exp.tax_amount || 0)}</div>
                        <button onClick={() => deleteExpense(exp.id)} style={{ backgroundColor: C.dangerDim, border: "none", borderRadius: 6, padding: "3px 8px", color: C.danger, fontSize: 11, cursor: "pointer", marginTop: 4 }}>Eliminar</button>
                      </div>
                    </div>
                    {exp.description && <div style={{ fontSize: 11, color: C.muted, marginTop: 8, paddingTop: 8, borderTop: `0.5px solid ${C.border}` }}>{exp.description}</div>}
                  </div>
                );
              })}
            </>
          )}

          {/* TAB: SII FACTURAS */}
          {gastosTab === "sii" && (
            <>
              {/* Config certificado */}
              <div style={{ backgroundColor: C.card, border: `0.5px solid ${siiConfigured ? C.success : C.border}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Certificado SII</div>
                  {siiConfigured && <div style={{ backgroundColor: C.successDim, border: `0.5px solid ${C.success}`, borderRadius: 6, padding: "3px 10px", fontSize: 11, color: C.success, fontWeight: 700 }}>Configurado</div>}
                </div>
                {siiConfigured ? (
                  <>
                    <div style={{ fontSize: 12, color: C.mutedSoft, marginBottom: 12 }}>RUT {siiConfigRut} · Credenciales cifradas con AES-256</div>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>Para actualizar el certificado, sube uno nuevo abajo.</div>
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>Configuración única. Tus credenciales se guardan cifradas — no necesitas volver a ingresarlas.</div>
                )}
                <input value={siiRut} onChange={e => setSiiRut(e.target.value)} placeholder="RUT empresa (ej: 76982672-6)" style={{ ...inp }} />
                <input ref={siiP12Ref} type="file" accept=".p12,.pfx" style={{ display: "none" }} onChange={e => setSiiP12File(e.target.files?.[0] || null)} />
                <button onClick={() => siiP12Ref.current?.click()} style={{ width: "100%", height: 44, backgroundColor: C.cardAlt, border: `0.5px solid ${siiP12File ? C.success : C.border}`, borderRadius: 10, color: siiP12File ? C.success : C.mutedSoft, fontSize: 13, cursor: "pointer", marginBottom: 10 }}>
                  {siiP12File ? siiP12File.name : "Seleccionar certificado .p12"}
                </button>
                <input type="password" value={siiPassword} onChange={e => setSiiPassword(e.target.value)} placeholder="Clave del certificado .p12" style={{ ...inp }} />
                <button onClick={uploadSiiCert} disabled={uploadingSii} style={{ ...btnPrimary, backgroundColor: siiConfigured ? C.cardAlt : C.orange, color: siiConfigured ? C.muted : "#fff" }}>{uploadingSii ? "Guardando..." : siiConfigured ? "Actualizar certificado" : "Guardar certificado SII"}</button>
              </div>

              {/* Consultar facturas */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <button onClick={loadSiiFacturas} disabled={loadingSiiFacturas} style={{ flex: 2, height: 46, backgroundColor: C.orangeDim, border: `0.5px solid ${C.orange}`, borderRadius: 10, color: C.orange, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  {loadingSiiFacturas ? "Consultando SII..." : "Consultar facturas"}
                </button>
                <button onClick={async () => {
                  try {
                    const r = await fetch(`${API_URL}/sii/diagnostico`, { headers: { Authorization: `Bearer ${token}` } });
                    const d = await r.json();
                    const msg = d.steps?.map((s: {paso: string; ok: boolean; detalle: string}) => `${s.ok ? "✅" : "❌"} ${s.paso}\n   ${s.detalle}`).join("\n") || d.error || JSON.stringify(d);
                    alert(msg);
                  } catch(e) { alert("Error de red"); }
                }} style={{ flex: 1, height: 46, backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, color: C.mutedSoft, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                  Diagnóstico
                </button>
              </div>

              {/* Lista facturas SII */}
              {siiFacturas.length === 0 && !loadingSiiFacturas && (
                <div style={{ textAlign: "center", padding: "30px 0", color: C.muted }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🏛️</div>
                  <div style={{ fontSize: 14, marginBottom: 6 }}>Sin facturas cargadas</div>
                  <div style={{ fontSize: 12 }}>Configura el certificado y consulta el SII</div>
                </div>
              )}
              {siiFacturas.map((f, i) => (
                <div key={i} style={{ backgroundColor: C.card, border: `0.5px solid ${f.expense_id ? C.success : C.border}`, borderRadius: 14, padding: 14, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{f.razon_social}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>RUT {f.rut_emisor} · Folio N°{f.folio}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{new Date(f.fecha + "T12:00:00").toLocaleDateString("es-CL")} · DTE tipo {f.tipo_dte}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: C.orange }}>{fmtCLP(f.monto_total)}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>Neto: {fmtCLP(f.monto_neto)}</div>
                    </div>
                  </div>
                  {f.expense_id ? (
                    <div style={{ fontSize: 11, color: C.success, fontWeight: 600 }}>Importada al módulo de gastos</div>
                  ) : (
                    <div style={{ display: "flex", gap: 8 }}>
                      <select defaultValue="" style={{ flex: 1, height: 36, backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 8, color: C.mutedSoft, fontSize: 12, padding: "0 8px" }}
                        onChange={async e => {
                          const val = e.target.value;
                          if (val) await importSiiFactura(f, val, expProjectId);
                        }}>
                        <option value="">Asignar a centro de costo...</option>
                        {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.name}{cc.type === "project" ? " (obra)" : ""}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {/* TAB: NUBOX */}
          {gastosTab === "nubox" && (
            <>
              {/* Toggle Compras / Ventas */}
              <div style={{ display: "flex", backgroundColor: C.cardAlt, borderRadius: 10, padding: 4, marginBottom: 12, gap: 3 }}>
                <button onClick={() => { setNuboxView("compras"); loadNuboxPurchases(); }} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", backgroundColor: nuboxView === "compras" ? C.card : "transparent", color: nuboxView === "compras" ? C.orange : C.muted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                  Compras
                </button>
                {isAdmin && <button onClick={() => { setNuboxView("ventas"); loadNuboxSummary(); loadProjects(); }} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", backgroundColor: nuboxView === "ventas" ? C.card : "transparent", color: nuboxView === "ventas" ? C.orange : C.muted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                  Ventas
                </button>}
              </div>

              {/* ─VISTA COMPRAS ── */}
              {nuboxView === "compras" && <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <button onClick={() => setNuboxShowAll(false)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", backgroundColor: !nuboxShowAll ? C.orange : C.cardAlt, color: !nuboxShowAll ? "#fff" : C.muted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Sin asignar</button>
                <button onClick={() => setNuboxShowAll(true)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", backgroundColor: nuboxShowAll ? C.orange : C.cardAlt, color: nuboxShowAll ? "#fff" : C.muted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Todas</button>
                <button onClick={loadNuboxPurchases} disabled={nuboxLoading} style={{ backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 8, padding: "7px 12px", color: C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>↻</button>
              </div>
              {nuboxLoading && <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Cargando facturas Nubox...</div>}
              {nuboxError && (
                <div style={{ backgroundColor: C.dangerDim, border: `0.5px solid ${C.danger}`, borderRadius: 12, padding: 14, marginBottom: 12, color: C.danger, fontSize: 13 }}>
                  {nuboxError}
                </div>
              )}
              {!nuboxLoading && !nuboxError && (() => {
                const filtered = nuboxShowAll ? nuboxPurchases : nuboxPurchases.filter(p => !p.assigned);
                if (filtered.length === 0) return (
                  <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>
                    {nuboxShowAll ? `Sin facturas en ${fmtMonth(gastosMonth)}` : "Todas las facturas están asignadas"}
                  </div>
                );
                return filtered.map(p => {
                  const isAssigned = !!p.assigned;
                  const hasDupe = !!p.manual_dupe;
                  const assignedCC = p.assigned?.cost_center_id
                    ? costCenters.find(cc => cc.id === p.assigned.cost_center_id)
                    : (p.assigned?.project_id ? costCenters.find(cc => cc.project_id === p.assigned.project_id) : undefined);
                  const selectedCC = nuboxSelectedProject[p.id] || "";
                  const expanded = !!nuboxExpanded[p.id];
                  const detail = nuboxDetail[p.id];
                  const loadingDetail = !!nuboxDetailLoading[p.id];

                  async function toggleExpand() {
                    const nowExpanded = !nuboxExpanded[p.id];
                    setNuboxExpanded(prev => ({ ...prev, [p.id]: nowExpanded }));
                    if (nowExpanded && !nuboxDetail[p.id]) {
                      setNuboxDetailLoading(prev => ({ ...prev, [p.id]: true }));
                      try {
                        const r = await fetch(`${API_URL}/nubox/purchases/${p.id}`, { headers: { Authorization: `Bearer ${token}` } });
                        const d = await r.json();
                        if (d.ok) setNuboxDetail(prev => ({ ...prev, [p.id]: d.item }));
                      } catch (e) { console.error("[red]", e); }
                      finally { setNuboxDetailLoading(prev => ({ ...prev, [p.id]: false })); }
                    }
                  }

                  const src = detail || p;
                  const lines: any[] = src.lines || src.details || src.items || src.lineItems || [];

                  return (
                    <div key={p.id} style={{ backgroundColor: C.card, border: `0.5px solid ${isAssigned ? C.success : C.border}`, borderRadius: 14, marginBottom: 10, overflow: "hidden" }}>
                      {/* Cabecera — tap para expandir */}
                      <div onClick={toggleExpand} style={{ padding: 14, cursor: "pointer" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{p.supplier?.tradeName || p.supplier?.businessName || "Proveedor"}</div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{p.supplier?.identification?.value} · {p.type?.abbreviation || "Factura"} N°{p.number}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>{p.emissionDate?.slice(0, 10)}</div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{fmtCLP(p.totalAmount)}</div>
                            <div style={{ fontSize: 10, color: C.muted }}>Neto {fmtCLP(p.totalNetAmount)}</div>
                            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{expanded ? "▲" : "▼"}</div>
                          </div>
                        </div>
                        {isAssigned && (
                          <div style={{ fontSize: 11, color: C.success, fontWeight: 600 }}>
                            {assignedCC?.name || p.assigned.project_name || p.assigned.cc_name || "Asignado"}
                          </div>
                        )}
                        {hasDupe && !isAssigned && (
                          <div style={{ fontSize: 11, color: "#b45309", fontWeight: 600, marginTop: 4, backgroundColor: "#fef3c7", borderRadius: 6, padding: "3px 8px", display: "inline-block" }}>
                            Ya existe como gasto manual
                          </div>
                        )}
                      </div>

                      {/* Detalle expandido */}
                      {expanded && (
                        <div style={{ borderTop: `0.5px solid ${C.border}`, padding: "10px 14px 14px" }}>
                          {loadingDetail && <div style={{ textAlign: "center", color: C.muted, fontSize: 12, padding: "12px 0" }}>Cargando detalle...</div>}


                          {/* Líneas de detalle */}
                          {!loadingDetail && lines.length > 0 && (
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Detalle</div>
                              <div style={{ backgroundColor: C.cardAlt, borderRadius: 10, overflow: "hidden" }}>
                                {lines.map((line: any, i: number) => (
                                  <div key={i} style={{ padding: "8px 10px", borderBottom: i < lines.length - 1 ? `0.5px solid ${C.border}` : "none" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{line.product?.description || line.name || line.description || `Ítem ${i + 1}`}</div>
                                        <div style={{ fontSize: 11, color: C.muted }}>
                                          {line.quantity != null ? `${line.quantity} ${line.product?.uom || line.unit || "un"}` : ""}
                                          {(line.price ?? line.unitPrice) != null ? ` × ${fmtCLP(line.price ?? line.unitPrice)}` : ""}
                                        </div>
                                      </div>
                                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, flexShrink: 0 }}>
                                        {fmtCLP(line.totalPrice ?? line.total ?? line.totalAmount ?? line.amount ?? 0)}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Totales */}
                          {!loadingDetail && (
                            <div style={{ backgroundColor: C.cardAlt, borderRadius: 10, padding: "8px 10px", marginBottom: 12 }}>
                              {src.totalNetAmount != null && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted, marginBottom: 3 }}><span>Neto</span><span>{fmtCLP(src.totalNetAmount)}</span></div>}
                              {(src.totalTaxVatAmount ?? src.totalTaxAmount ?? src.totalIvaAmount) != null && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted, marginBottom: 3 }}><span>IVA</span><span>{fmtCLP(src.totalTaxVatAmount ?? src.totalTaxAmount ?? src.totalIvaAmount)}</span></div>}
                              {src.totalExemptAmount != null && src.totalExemptAmount > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted, marginBottom: 3 }}><span>Exento</span><span>{fmtCLP(src.totalExemptAmount)}</span></div>}
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 800, color: C.text, paddingTop: 4, borderTop: `0.5px solid ${C.border}`, marginTop: 3 }}><span>Total</span><span>{fmtCLP(src.totalAmount)}</span></div>
                            </div>
                          )}

                          {/* Asignar */}
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <select
                              value={selectedCC}
                              onChange={e => setNuboxSelectedProject(prev => ({ ...prev, [p.id]: e.target.value }))}
                              style={{ flex: 1, height: 36, borderRadius: 8, border: `0.5px solid ${C.border}`, backgroundColor: C.cardAlt, color: C.text, fontSize: 12, padding: "0 8px" }}
                            >
                              <option value="">— Seleccionar centro de costo —</option>
                              <option value="__sin_centro__">Sin centro de costo (igual queda en el informe)</option>
                              {costCenters.filter(cc => cc.project_id).length > 0 && (
                                <optgroup label="Proyectos">
                                  {costCenters.filter(cc => cc.project_id).map(cc => (
                                    <option key={cc.id} value={cc.project_id!}>{cc.code ? `[${cc.code}] ` : ""}{cc.name}</option>
                                  ))}
                                </optgroup>
                              )}
                              {costCenters.filter(cc => !cc.project_id).length > 0 && (
                                <optgroup label="Otros centros">
                                  {costCenters.filter(cc => !cc.project_id).map(cc => (
                                    <option key={cc.id} value={cc.id}>{cc.code ? `[${cc.code}] ` : ""}{cc.name}</option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                            <button
                              onClick={() => { if (!selectedCC) { alert("Selecciona un centro de costo"); return; } assignNuboxPurchase(p.id, selectedCC); }}
                              disabled={nuboxAssigning === String(p.id) || !selectedCC}
                              style={{ height: 36, padding: "0 14px", borderRadius: 8, border: "none", backgroundColor: selectedCC ? C.orange : C.cardAlt, color: selectedCC ? "#fff" : C.muted, fontWeight: 700, fontSize: 12, cursor: selectedCC ? "pointer" : "default" }}
                            >
                              {nuboxAssigning === String(p.id) ? "..." : isAssigned ? "Cambiar" : "Asignar"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </>}

              {/* ─VISTA VENTAS ── */}
              {nuboxView === "ventas" && isAdmin && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: C.muted }}>Facturas emitidas a clientes</div>
                    <button onClick={() => loadNuboxSummary()} style={{ backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", color: C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>↻</button>
                  </div>
                  {!nuboxSalesSummary && <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Cargando...</div>}
                  {nuboxSalesSummary?.items?.filter((s: any) => !s.annulled).map((sale: any) => {
                    const isNC = sale.total_amount < 0;
                    const amtColor = isNC ? C.danger : C.success;
                    const currentSelection = nuboxSalesProject[sale.id] !== undefined ? nuboxSalesProject[sale.id] : (sale.assigned?.project_id || (sale.assigned ? "__sin_centro__" : ""));
                    return (
                    <div key={sale.id} style={{ backgroundColor: C.card, border: `0.5px solid ${isNC ? C.danger : sale.assigned ? C.success : C.border}`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{sale.client_name || "Cliente"}</div>
                            {isNC && <span style={{ fontSize: 10, backgroundColor: C.dangerDim, color: C.danger, borderRadius: 6, padding: "1px 6px", fontWeight: 700 }}>N/C</span>}
                          </div>
                          <div style={{ fontSize: 11, color: C.muted }}>{sale.client_rut} · N°{sale.number} · {sale.emission_date?.slice(0,10)}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{sale.doc_type}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: amtColor }}>{isNC ? "-" : ""}{fmtCLP(Math.abs(sale.total_amount))}</div>
                          <div style={{ fontSize: 10, color: C.muted }}>Neto {isNC ? "-" : ""}{fmtCLP(Math.abs(sale.total_net))}</div>
                        </div>
                      </div>
                      {sale.assigned && <div style={{ fontSize: 11, color: C.success, fontWeight: 600, marginBottom: 6 }}>Asignado a {sale.assigned.project_name || sale.assigned.cc_name || "Sin centro de costo"}</div>}
                      {isAdmin && (
                        <div style={{ display: "flex", gap: 8 }}>
                          <select
                            value={currentSelection}
                            onChange={e => setNuboxSalesProject(prev => ({ ...prev, [sale.id]: e.target.value }))}
                            style={{ flex: 1, height: 36, borderRadius: 8, border: `0.5px solid ${C.border}`, backgroundColor: C.cardAlt, color: C.text, fontSize: 12, padding: "0 8px" }}
                          >
                            <option value="">— Seleccionar proyecto —</option>
                            <option value="__sin_centro__">Sin centro de costo (igual queda en el informe)</option>
                            {projects.map(pr => <option key={pr.id} value={pr.id}>{pr.code ? `[${pr.code}] ` : ""}{pr.name}</option>)}
                          </select>
                          <button
                            onClick={() => { if (!currentSelection) return; assignNuboxSale(sale.id, currentSelection, sale); }}
                            disabled={nuboxSalesAssigning === String(sale.id) || !currentSelection}
                            style={{ height: 36, padding: "0 14px", borderRadius: 8, border: "none", backgroundColor: currentSelection ? C.success : C.cardAlt, color: currentSelection ? "#fff" : C.muted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                          >
                            {nuboxSalesAssigning === String(sale.id) ? "..." : sale.assigned ? "Cambiar" : "Asignar"}
                          </button>
                        </div>
                      )}
                    </div>
                  );})}
                  {nuboxSalesSummary?.items?.length === 0 && (
                    <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Sin ventas en {fmtMonth(gastosMonth)}</div>
                  )}
                </>
              )}
            </>
          )}

          {/* TAB: CENTROS DE COSTO */}
          {gastosTab === "centros" && (
            <>
              <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Nuevo centro de costo</div>
                <input value={newCCName} onChange={e => setNewCCName(e.target.value)} placeholder="Nombre (ej: Bencina, Insumos)" style={inp} />
                <input value={newCCCode} onChange={e => setNewCCCode(e.target.value)} placeholder="Código (opcional)" style={inp} />
                <button onClick={createCostCenter} disabled={creatingCC} style={btnPrimary}>{creatingCC ? "Creando..." : "Crear centro de costo"}</button>
              </div>
              {costCenters.map(cc => (
                <div key={cc.id} style={{ backgroundColor: C.card, border: `0.5px solid ${editingCC === cc.id ? C.orange : C.border}`, borderRadius: 12, padding: 12, marginBottom: 8 }}>
                  {editingCC === cc.id ? (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.orange, marginBottom: 8 }}>Editar centro de costo</div>
                      <input value={editCCName} onChange={e => setEditCCName(e.target.value)} placeholder="Nombre" style={{ ...inp, marginBottom: 8 }} />
                      <input value={editCCCode} onChange={e => setEditCCCode(e.target.value)} placeholder="Código (opcional)" style={{ ...inp, marginBottom: 10 }} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={updateCostCenter} disabled={savingCC} style={{ flex: 1, height: 36, backgroundColor: C.orange, border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{savingCC ? "Guardando..." : "Guardar"}</button>
                        <button onClick={() => setEditingCC(null)} style={{ height: 36, padding: "0 14px", backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 8, color: C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, background: cc.type === "project" ? C.orangeDim : C.infoDim, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{cc.type === "project" ? "🏗️" : "📂"}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{cc.name}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{cc.type === "project" ? `Proyecto · ${cc.project_name}` : "Manual"}{cc.code ? ` · #${cc.code}` : ""}</div>
                      </div>
                      {cc.type === "manual" && (
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button onClick={() => { setEditingCC(cc.id); setEditCCName(cc.name); setEditCCCode(cc.code || ""); }} style={{ backgroundColor: C.orangeDim, border: "none", borderRadius: 6, padding: "4px 10px", color: C.orange, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✏️</button>
                          <button onClick={async () => { if (!confirm("¿Eliminar?")) return; await fetch(`${API_URL}/cost-centers/${cc.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); loadCostCenters(); }} style={{ backgroundColor: C.dangerDim, border: "none", borderRadius: 6, padding: "4px 10px", color: C.danger, fontSize: 11, cursor: "pointer" }}>✕</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </>
      )}

      {/* ─PANTALLA COTIZACIONES ─────────────────────────────────────────────── */}
      {screen === "cotizaciones" && <CotizacionesScreen token={token} isAdmin={isAdmin} />}

      {/* ─PANTALLA RENDICIONES ──────────────────────────────────────────────── */}
      {screen === "rendiciones" && canSeeRendiciones && <RendicionesScreen token={token} userName={userName} />}

      {/* ─PANTALLA FACTURACIÓN ──────────────────────────────────────────────── */}
      {screen === "facturacion" && canSeeFacturacion && (
        <Suspense fallback={<div style={{ padding: 24, textAlign: "center", color: C.muted, fontSize: 13 }}>Cargando facturación...</div>}>
          <FacturacionScreen API_URL={API_URL} token={token!} isAdmin={isAdmin} />
        </Suspense>
      )}

      {/* ─PANTALLA ESTADO DE RESULTADO ──────────────────────────────────────── */}
      {screen === "estadoResultado" && canSeeEstadoResultado && <EstadoResultadoScreen token={token!} isAdmin={isAdmin} />}

      {screen === "charlas" && (() => {
        const hoy = new Date().toLocaleDateString("en-CA");
        const deHoy = charlas.find(c => String(c.fecha).slice(0, 10) === hoy);
        return (
          <div style={{ padding: "16px 16px 90px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>Charla diaria</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>Registro de la charla de seguridad. Una por día para toda la cuadrilla.</div>

            {deHoy ? (
              <div style={{ backgroundColor: C.successDim, border: `0.5px solid ${C.success}40`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.success }}>Charla de hoy registrada</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Subida por {deHoy.subida_por || "—"}. Puedes reemplazarla subiendo otra foto.</div>
              </div>
            ) : (
              <div style={{ backgroundColor: C.dangerDim, border: `0.5px solid ${C.danger}40`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.danger }}>Falta la charla de hoy</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Si no se sube antes de las 13:00 se envía un aviso por WhatsApp.</div>
              </div>
            )}

            <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <label style={{ flex: 1, height: 42, backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  Tomar foto
                  <input type="file" accept="image/*" capture="environment" onChange={e => setCharlaFoto(e.target.files?.[0] || null)} style={{ display: "none" }} />
                </label>
                <label style={{ flex: 1, height: 42, backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  Subir
                  <input type="file" accept="image/*" onChange={e => setCharlaFoto(e.target.files?.[0] || null)} style={{ display: "none" }} />
                </label>
              </div>
              {charlaFoto && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: C.cardAlt, borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: C.success, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{charlaFoto.name}</span>
                  <button onClick={() => setCharlaFoto(null)} style={{ background: "none", border: "none", color: C.danger, fontSize: 16, cursor: "pointer", padding: "0 4px" }}>✕</button>
                </div>
              )}
              <input value={charlaNotas} onChange={e => setCharlaNotas(e.target.value)} placeholder="Tema tratado (opcional)" style={{ ...inp, marginBottom: 10 }} />
              <button onClick={subirCharla} disabled={!charlaFoto || subiendoCharla} style={{ width: "100%", height: 44, backgroundColor: !charlaFoto ? C.cardAlt : C.orange, border: "none", borderRadius: 10, color: !charlaFoto ? C.muted : "#fff", fontWeight: 700, fontSize: 13, cursor: !charlaFoto ? "default" : "pointer" }}>
                {subiendoCharla ? "Subiendo..." : "Registrar charla"}
              </button>
            </div>

            {prevResumen.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.mutedSoft, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Visitas a terreno por obra</div>
                {prevResumen.map(pr => {
                  const sinVisita = !pr.visitas;
                  return (
                    <button key={pr.id} onClick={() => { const proj = projects.find(x => x.id === pr.id); if (proj) { setSelectedProject(proj); setScreen("partidas"); loadTasks(proj.id); setShowVisita(true); } }}
                      style={{ width: "100%", textAlign: "left", backgroundColor: C.card, border: `0.5px solid ${sinVisita ? C.danger + "60" : C.border}`, borderRadius: 10, padding: 12, marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 16 }}>{sinVisita ? "⚠️" : "✓"}</span>
                      <span style={{ flex: 1 }}>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text }}>{pr.code ? `#${pr.code} ` : ""}{pr.name}</span>
                        <span style={{ display: "block", fontSize: 11, color: sinVisita ? C.danger : C.muted, marginTop: 2 }}>
                          {sinVisita ? "Sin visita registrada" : `${pr.visitas} visita${pr.visitas === 1 ? "" : "s"}${pr.ultima_visita ? ` · última ${String(pr.ultima_visita).slice(8, 10)}-${String(pr.ultima_visita).slice(5, 7)}` : ""}`}
                          {pr.borradores > 0 ? ` · ${pr.borradores} sin enviar` : ""}
                        </span>
                      </span>
                      <ChevronRight size={17} color={C.muted} />
                    </button>
                  );
                })}
                <div style={{ height: 18 }} />
              </>
            )}

            {charlas.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.mutedSoft, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Historial de charlas</div>
                {charlas.map(c => (
                  <div key={c.id} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 10, padding: 12, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{String(c.fecha).slice(8, 10)}-{String(c.fecha).slice(5, 7)}-{String(c.fecha).slice(0, 4)}</div>
                      {c.notas && <div style={{ fontSize: 11, color: C.mutedSoft, marginTop: 2 }}>{c.notas}</div>}
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{c.subida_por || ""}</div>
                    </div>
                    <button onClick={async () => { if (!confirm("¿Eliminar esta charla?")) return; await fetch(`${API_URL}/charlas/${c.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); await loadCharlas(); }} style={{ width: 32, height: 32, backgroundColor: C.dangerDim, border: "none", borderRadius: 8, cursor: "pointer" }}>
                      <Trash2 size={13} color={C.danger} />
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        );
      })()}

      {/* Aviso de conexión. Fijo arriba para que se vea sin importar en qué pantalla esté. */}
      {(sinConexion || falloRed) && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 300,
          padding: "10px 16px", fontSize: 13, fontWeight: 600, textAlign: "center",
          backgroundColor: sinConexion ? "#7C2D12" : "#B45309", color: "#fff",
        }}>
          {sinConexion ? "Sin conexión — reintentará al volver la señal" : falloRed}
        </div>
      )}

      {/* Nav inferior */}
      {/* Barra de navegación — sin botón Crear */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, backgroundColor: C.card, borderTop: `0.5px solid ${C.border}`, display: "flex", padding: "6px 0 14px", zIndex: 100 }}>
        {/* Barra corta: sólo lo de uso diario. El resto vive en el menú, que además
            se filtra por permisos, así nadie ve módulos que no puede abrir. */}
        {([
          { sc: "home" as Screen, icon: <Home size={19} />, label: "Inicio" },
          { sc: "proyectos" as Screen, icon: <FolderOpen size={19} />, label: "Proyectos" },
          { sc: "charlas" as Screen, icon: <CheckCircle2 size={19} />, label: "Prevención" },
          ...(canSeeGastos ? [{ sc: "gastos" as Screen, icon: <DollarSign size={19} />, label: "Gastos" }] : []),
        ] as { sc: Screen; icon: React.ReactNode; label: string }[]).map(({ sc, icon, label }) => {
          const active = screen === sc || (sc === "home" && (screen === "partidas" || screen === "fotos"));
          return (
            <button key={sc} onClick={() => { setScreen(sc); if (sc === "charlas") { loadCharlas(); loadPrevencion(); } if (sc === "gastos") { setGastosTab(canSeeGastosResumen ? "resumen" : "lista"); setExpenseSummary(null); setNuboxSummary(null); loadCostCenters(); loadExpenses(); loadNuboxSummary(); } }} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", color: active ? C.orange : C.muted, padding: "2px 0" }}>
              {icon}
              <span style={{ fontSize: 9, fontWeight: 600 }}>{label}</span>
            </button>
          );
        })}
        {menuAbierto && (
          <>
            <div onClick={() => setMenuAbierto(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 200 }} />
            <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, backgroundColor: C.card, borderRadius: "20px 20px 0 0", zIndex: 201, padding: "10px 16px 24px", maxHeight: "82vh", overflowY: "auto", boxShadow: "0 -8px 30px rgba(0,0,0,0.25)" }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, margin: "0 auto 16px" }} />
              <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 14 }}>Módulos</div>
              {/* El menú lista todo, incluido lo que está en la barra: abajo son atajos,
                  acá está el índice completo de lo que el usuario puede abrir. */}
              {([
                { sc: "home" as Screen, icon: <Home size={20} />, label: "Inicio", sub: "Panel de control y resumen", ver: true },
                { sc: "proyectos" as Screen, icon: <FolderOpen size={20} />, label: "Proyectos", sub: "Obras, partidas y fotografías", ver: true },
                { sc: "charlas" as Screen, icon: <HardHat size={20} />, label: "Prevención de riesgos", sub: "Charla diaria y visitas a terreno", ver: true },
                { sc: "gastos" as Screen, icon: <CreditCard size={20} />, label: "Gastos", sub: "Registrar y revisar gastos", ver: canSeeGastos },
                { sc: "rendiciones" as Screen, icon: <Receipt size={20} />, label: "Rendiciones", sub: "Subir boletas y rendir", ver: canSeeRendiciones },
                { sc: "cotizaciones" as Screen, icon: <ClipboardList size={20} />, label: "Cotizaciones", sub: "Cotizar en Nubox", ver: canSeeCotizaciones },
                { sc: "facturacion" as Screen, icon: <Calculator size={20} />, label: "Facturación", sub: "Productos, inventario y OC", ver: canSeeFacturacion },
                { sc: "estadoResultado" as Screen, icon: <TrendingUp size={20} />, label: "Estado de Resultado", sub: "Márgenes por centro de costo", ver: canSeeEstadoResultado },
                { sc: "admin" as Screen, icon: <Users size={20} />, label: "Administración", sub: "Usuarios y permisos", ver: isAdmin },
                { sc: "configuracion" as Screen, icon: <Settings size={20} />, label: "Mi perfil", sub: "Datos de la cuenta y cerrar sesión", ver: true },
              ]).filter(x => x.ver).map(({ sc, icon, label, sub }) => (
                <button key={sc} onClick={() => { setMenuAbierto(false); setScreen(sc); if (sc === "charlas") { loadCharlas(); loadPrevencion(); } if (sc === "gastos") { setGastosTab(canSeeGastosResumen ? "resumen" : "lista"); setExpenseSummary(null); setNuboxSummary(null); loadCostCenters(); loadExpenses(); loadNuboxSummary(); } }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 12px", marginBottom: 8, backgroundColor: screen === sc ? C.orangeDim : C.cardAlt, border: `0.5px solid ${screen === sc ? C.orange : C.border}`, borderRadius: 12, cursor: "pointer", textAlign: "left" }}>
                  <span style={{ color: screen === sc ? C.orange : C.mutedSoft, display: "flex" }}>{icon}</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: screen === sc ? C.orange : C.text }}>{label}</span>
                    <span style={{ display: "block", fontSize: 11, color: C.muted, marginTop: 1 }}>{sub}</span>
                  </span>
                  <span style={{ color: C.muted, fontSize: 18 }}>›</span>
                </button>
              ))}

              {/* Notificaciones del teléfono. Vive en el menú y no en Mi perfil porque
                  el permiso es por dispositivo: quien entre desde otro teléfono debe
                  activarlo ahí también, y así lo tiene a mano. */}
              <div style={{ marginTop: 6, paddingTop: 14, borderTop: `0.5px solid ${C.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "4px 12px 10px" }}>
                  <span style={{ color: pushEstado === "on" ? C.orange : C.mutedSoft, display: "flex" }}><Bell size={20} /></span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: C.text }}>Notificaciones</span>
                    <span style={{ display: "block", fontSize: 11, color: C.muted, marginTop: 1 }}>
                      {pushEstado === "on" ? "Activas en este dispositivo"
                        : pushEstado === "ios-no-instalada" ? "Agrega ObrasSync a la pantalla de inicio para recibirlas"
                        : pushEstado === "no-soportado" ? "Este navegador no las admite"
                        : "Avisos de charla diaria y recepción conforme"}
                    </span>
                  </span>
                  {pushEstado === "on" && (
                    <button onClick={probarPush} disabled={pushCargando}
                      style={{ padding: "8px 12px", marginRight: 6, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: pushCargando ? "default" : "pointer", border: `1px solid ${C.border}`, backgroundColor: C.cardAlt, color: C.text, opacity: pushCargando ? 0.6 : 1 }}>
                      Probar
                    </button>
                  )}
                  {(pushEstado === "on" || pushEstado === "off") && (
                    <button onClick={pushEstado === "on" ? desactivarPush : activarPush} disabled={pushCargando}
                      style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: pushCargando ? "default" : "pointer", border: `1px solid ${pushEstado === "on" ? C.border : C.orange}`, backgroundColor: pushEstado === "on" ? C.cardAlt : C.orange, color: pushEstado === "on" ? C.text : "#fff", opacity: pushCargando ? 0.6 : 1 }}>
                      {pushCargando ? "..." : pushEstado === "on" ? "Desactivar" : "Activar"}
                    </button>
                  )}
                </div>
                {pushMsg && (
                  <div style={{ margin: "0 12px", padding: "8px 12px", borderRadius: 8, fontSize: 12, backgroundColor: pushMsg.startsWith("✅") ? C.successDim : C.dangerDim, color: pushMsg.startsWith("✅") ? C.success : C.danger }}>
                    {pushMsg.replace(/^[✅❌⚠️]+\s*/, "")}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        <button onClick={() => setMenuAbierto(true)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", color: menuAbierto ? C.orange : C.muted, padding: "2px 0" }}>
          <div style={{ width: 19, height: 19, display: "flex", flexDirection: "column", justifyContent: "center", gap: 3 }}>
            {[0, 1, 2].map(i => <div key={i} style={{ height: 2, borderRadius: 2, backgroundColor: "currentColor" }} />)}
          </div>
          <span style={{ fontSize: 9, fontWeight: 600 }}>Menú</span>
        </button>
      </div>

      {/* Botón Crear flotante y arrastrable — oculto en Estado de Resultado: no hay nada que "crear" ahí y tapaba los montos de margen al hacer scroll */}
      {(screen === "home" || screen === "proyectos") && <DraggableCreateButton onPress={() => setScreen("crearProyecto")} cardColor={C.card} orangeColor={C.orange} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COTIZACIONES SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
function BookmarkletRenewer({ apiUrl, token, onRenewed, hasCredentials }: { apiUrl: string; token: string; onRenewed: () => void; hasCredentials?: boolean }) {
  const [step, setStep] = useState<"idle" | "form" | "loading" | "done">("idle");
  const [rut, setRut] = useState("");
  const [password, setPassword] = useState("");

  async function saveAndLogin() {
    if (!rut || !password) return;
    setStep("loading");
    try {
      const r = await fetch(`${apiUrl}/nubox/auto-login`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ rut: rut.trim(), password }),
      }).then(r => r.json());
      if (r.ok) { setStep("done"); onRenewed(); }
      else { alert("❌ " + r.message); setStep("form"); }
    } catch (e: any) { alert("❌ Error: " + e.message); setStep("form"); }
  }

  if (step === "done") return (
    <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: 12, textAlign: "center" }}>
      <div style={{ fontWeight: 700, color: "#15803d" }}>Nubox conectado y credenciales guardadas</div>
      <div style={{ fontSize: 12, color: "#16a34a", marginTop: 4 }}>El token se renovará automáticamente en el futuro</div>
      <button onClick={() => setStep("idle")} style={{ marginTop: 8, background: "none", border: "none", color: "#6b7280", fontSize: 12, cursor: "pointer" }}>Cambiar credenciales</button>
    </div>
  );

  if (step === "form" || step === "loading") return (
    <div style={{ backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: "#1e40af" }}>Conectar Nubox automáticamente</div>
      <div style={{ fontSize: 12, color: "#3b82f6", marginBottom: 10 }}>Guarda tus credenciales para que el token se renueve solo desde el celular</div>
      <input value={rut} onChange={e => setRut(e.target.value)} placeholder="RUT o email de Nubox (ej: 12345678-9)"
        disabled={step === "loading"}
        style={{ width: "100%", padding: "9px 10px", borderRadius: 7, border: "1px solid #bfdbfe", fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña de Nubox"
        disabled={step === "loading"}
        onKeyDown={e => e.key === "Enter" && saveAndLogin()}
        style={{ width: "100%", padding: "9px 10px", borderRadius: 7, border: "1px solid #bfdbfe", fontSize: 13, marginBottom: 10, boxSizing: "border-box" }} />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={saveAndLogin} disabled={step === "loading" || !rut || !password}
          style={{ flex: 1, backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: (step === "loading" || !rut || !password) ? 0.5 : 1 }}>
          {step === "loading" ? "Conectando... (puede tardar ~30s)" : "Guardar y conectar"}
        </button>
        <button onClick={() => setStep("idle")} disabled={step === "loading"} style={{ backgroundColor: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, padding: "10px 14px", fontSize: 13, cursor: "pointer" }}>
          Cancelar
        </button>
      </div>
    </div>
  );

  return (
    <button onClick={() => setStep("form")} style={{ width: "100%", backgroundColor: hasCredentials ? "#059669" : "#2563eb", color: "#fff", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}>
      {hasCredentials ? "Renovar token Nubox automáticamente" : "Configurar auto-renovación Nubox"}
    </button>
  );
}

function CotizacionesScreen({ token, isAdmin }: { token: string; isAdmin: boolean }) {
  const [tab, setTab] = useState<"lista" | "nueva" | "config">("lista");
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [nuboxStatus, setNuboxStatus] = useState<{ connected: boolean; email?: string; tokenValid?: boolean } | null>(null);
  const [nuboxJwt, setNuboxJwt] = useState("");
  const [nuboxCompanyId, setNuboxCompanyId] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [productCount, setProductCount] = useState(0);
  const [msg, setMsg] = useState("");
  const [nuboxClients, setNuboxClients] = useState<{ id: string; rut: string; name: string; nubox_id: number }[]>([]);
  const [newClientRut, setNewClientRut] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientNuboxId, setNewClientNuboxId] = useState("");
  const [projectProducts, setProjectProducts] = useState<{ id: string; nubox_code: string; name: string; unit: string; price_neto: number; category: string }[]>([]);
  const [newPP, setNewPP] = useState({ nubox_code: "", name: "", unit: "UND", price_neto: "", category: "materiales" });
  const [configSubTab, setConfigSubTab] = useState<"nubox" | "productos">("nubox");
  const [importingExcel, setImportingExcel] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  // Nueva cotización con IA
  const [uploadText, setUploadText] = useState("");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [aiResult, setAiResult] = useState<AIQuotationResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{ cotServices?: any; cotMaterials?: any; newProductsCreated?: string[]; quotation?: any } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const h = { Authorization: `Bearer ${token}` };

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [qRes, statusRes, prodRes, clientsRes, ppRes] = await Promise.all([
        fetch(`${API_URL}/quotations`, { headers: h }).then(r => r.json()),
        fetch(`${API_URL}/nubox/session-status`, { headers: h }).then(r => r.json()),
        fetch(`${API_URL}/nubox/products`, { headers: h }).then(r => r.json()),
        fetch(`${API_URL}/nubox/clients`, { headers: h }).then(r => r.json()),
        fetch(`${API_URL}/project-products`, { headers: h }).then(r => r.json()),
      ]);
      if (qRes.ok) setQuotations(qRes.quotations || []);
      if (statusRes.ok) setNuboxStatus(statusRes);
      if (prodRes.ok) setProductCount(prodRes.products?.length || 0);
      if (clientsRes.ok) setNuboxClients(clientsRes.clients || []);
      if (ppRes.ok) setProjectProducts(ppRes.products || []);
    } catch (_) {}
    setLoading(false);
  }

  async function connectNubox() {
    if (!nuboxJwt.trim()) return setMsg("Pega el token JWT de Nubox");
    setConnecting(true); setMsg("");
    try {
      const r = await fetch(`${API_URL}/nubox/connect`, {
        method: "POST", headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({ jwtToken: nuboxJwt.trim(), nuboxCompanyId: nuboxCompanyId || undefined }),
      }).then(r => r.json());
      if (r.ok) { setMsg("Nubox conectado correctamente"); setNuboxJwt(""); loadAll(); }
      else setMsg("❌ " + r.message);
    } catch (_) { setMsg("Error de conexión"); }
    setConnecting(false);
  }

  async function syncProducts() {
    setSyncing(true); setMsg("");
    try {
      const r = await fetch(`${API_URL}/nubox/products/sync`, { method: "POST", headers: h }).then(r => r.json());
      if (r.ok) { setMsg(`✅ ${r.synced} productos sincronizados desde Nubox`); loadAll(); }
      else setMsg("❌ " + r.message);
    } catch (_) { setMsg("Error al sincronizar"); }
    setSyncing(false);
  }

  async function processOT() {
    if (!uploadText && uploadFiles.length === 0) return setMsg("Sube un archivo o pega el texto de la OT");
    setProcessing(true); setMsg(""); setAiResult(null);
    try {
      const fd = new FormData();
      if (uploadText) fd.append("text", uploadText);
      uploadFiles.forEach(f => fd.append("files", f));
      const r = await fetch(`${API_URL}/quotations/process`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd }).then(r => r.json());
      if (r.ok) { setAiResult(r.result); setMsg(""); }
      else setMsg("❌ " + r.message);
    } catch (_) { setMsg("Error al procesar"); }
    setProcessing(false);
  }

  async function createQuotations() {
    if (!aiResult) return;
    setCreating(true); setMsg("");
    try {
      // 1. Pedir al backend los payloads listos (resuelve clientId, items, etc.)
      const bp = await fetch(`${API_URL}/quotations/build-payloads`, {
        method: "POST", headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({ aiResult }),
      }).then(r => r.json());
      if (!bp.ok) { setMsg("❌ " + bp.message); setCreating(false); return; }

      // 2. El browser llama a Nubox directamente (IP residencial, evita bloqueo)
      const nuboxHdrs = {
        "Authorization": `Bearer ${bp.nuboxToken}`,
        "X-Company-Id": bp.nuboxCompanyId,
        "Content-Type": "application/json",
        "Origin": "https://pyme.nubox.com",
      };
      let cotServices = null, cotMaterials = null;
      if (bp.payloadServices) {
        const rs = await fetch(bp.nuboxUrl, { method: "POST", headers: nuboxHdrs, body: JSON.stringify(bp.payloadServices) }).then(r => r.json());
        if (!rs.id && !rs.folio) {
          console.error("[NUBOX ERROR servicios]", JSON.stringify(rs, null, 2));
          const errDetail = (rs?.errors || []).map((e: any) => JSON.stringify(e)).join(" | ");
          throw new Error("Error COT servicios: " + (errDetail || JSON.stringify(rs)));
        }
        console.log("[NUBOX OK servicios]", JSON.stringify(rs));
        cotServices = rs;
      }
      if (bp.payloadMaterials) {
        const rm = await fetch(bp.nuboxUrl, { method: "POST", headers: nuboxHdrs, body: JSON.stringify(bp.payloadMaterials) }).then(r => r.json());
        if (!rm.id && !rm.folio) {
          const errDetail = (rm?.errors || []).map((e: any) => `${e.object}: ${e.message} (campo: ${e.field})`).join(" | ");
          throw new Error("Error COT materiales: " + (errDetail || JSON.stringify(rm)));
        }
        console.log("[NUBOX OK materiales]", JSON.stringify(rm));
        cotMaterials = rm;
      }

      // 3. Guardar resultado en nuestra BD
      const r = await fetch(`${API_URL}/quotations/save`, {
        method: "POST", headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({ aiResult: bp.aiResult, cotServices, cotMaterials }),
      }).then(r => r.json());
      if (r.ok) {
        setCreateResult({ ...r, cotServices, cotMaterials });
        setAiResult(null); setUploadText(""); setUploadFiles([]);
        loadAll(); setTab("lista");
        if (bp.notFoundServices?.length > 0) {
          setMsg(`COT creada. Partidas SIN código CLM (incluidas con precio estimado): ${bp.notFoundServices.join(", ")}`);
        }
      } else setMsg("❌ " + r.message);
    } catch (e: unknown) { setMsg("❌ " + (e instanceof Error ? e.message : "Error al crear")); }
    setCreating(false);
  }

  const statusColor = (s: string) => s === "created" ? C.info : s === "sent" ? C.orange : s === "approved" ? C.success : C.muted;
  const statusLabel = (s: string) => ({ created: "Creada", sent: "Enviada", approved: "Aprobada", rejected: "Rechazada" }[s] || s);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.bg, paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ backgroundColor: C.orange, padding: "52px 20px 16px", color: "#fff" }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Cotizaciones</div>
        <div style={{ fontSize: 12, opacity: 0.85 }}>
          {nuboxStatus?.connected ? `Nubox conectado · ${productCount} productos` : "Nubox no conectado"}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", backgroundColor: C.card, borderBottom: `1px solid ${C.border}` }}>
        {(["lista", "nueva", ...(isAdmin ? ["config"] : [])] as ("lista" | "nueva" | "config")[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "12px 0", border: "none", background: "none", cursor: "pointer", fontSize: 13, fontWeight: tab === t ? 700 : 400, color: tab === t ? C.orange : C.muted, borderBottom: tab === t ? `2px solid ${C.orange}` : "2px solid transparent" }}>
            {t === "lista" ? "Historial" : t === "nueva" ? "+ Nueva" : "Configuración"}
          </button>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        {msg && <div style={{ padding: "10px 14px", borderRadius: 8, backgroundColor: msg.startsWith("✅") ? C.successDim : C.dangerDim, color: msg.startsWith("✅") ? C.success : C.danger, fontSize: 13, marginBottom: 12 }}>{msg.replace(/^[✅❌⚠️]+\s*/, "")}</div>}

        {createResult && (
          <div style={{ backgroundColor: C.successDim, border: `1px solid ${C.success}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, color: C.success, marginBottom: 6 }}>Cotizaciones creadas en Nubox</div>
            {createResult.cotServices && <div style={{ fontSize: 13, color: C.text }}>Servicios — COT N°{createResult.cotServices.documentNumber || createResult.cotServices.number || createResult.cotServices.folio || createResult.cotServices.id}</div>}
            {createResult.cotMaterials && <div style={{ fontSize: 13, color: C.text }}>Materiales — COT N°{createResult.cotMaterials.documentNumber || createResult.cotMaterials.number || createResult.cotMaterials.folio || createResult.cotMaterials.id}</div>}
            {createResult.newProductsCreated && createResult.newProductsCreated.length > 0 && (
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Productos creados en Nubox: {createResult.newProductsCreated.join(", ")}</div>
            )}
            <button onClick={() => setCreateResult(null)} style={{ marginTop: 8, fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer" }}>Cerrar</button>
          </div>
        )}

        {/* ─LISTA ── */}
        {tab === "lista" && (
          <>
            {loading ? <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Cargando...</div>
              : quotations.length === 0 ? (
                <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
                  <div>No hay cotizaciones aún</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Los emails con "cotización" se procesan automáticamente</div>
                </div>
              ) : quotations.map(q => (
                <div key={q.id} style={{ backgroundColor: C.card, borderRadius: 10, padding: 14, marginBottom: 10, border: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{q.client_name || "Cliente no detectado"}</div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{q.reference}</div>
                      <div style={{ fontSize: 11, color: C.mutedSoft, marginTop: 4 }}>
                        {q.source_type === "email" ? "Email automático" : "Manual"} · {new Date(q.created_at).toLocaleDateString("es-CL")}
                      </div>
                    </div>
                    <span style={{ backgroundColor: statusColor(q.status) + "20", color: statusColor(q.status), borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600 }}>{statusLabel(q.status)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    {q.nubox_doc_number_services && (
                      <div style={{ flex: 1, backgroundColor: C.infoDim, borderRadius: 6, padding: "6px 10px" }}>
                        <div style={{ fontSize: 10, color: C.info, fontWeight: 600 }}>SERVICIOS</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>COT-{q.nubox_doc_number_services}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{fmtCLP(q.total_services)}</div>
                      </div>
                    )}
                    {q.nubox_doc_number_materials && (
                      <div style={{ flex: 1, backgroundColor: C.orangeDim, borderRadius: 6, padding: "6px 10px" }}>
                        <div style={{ fontSize: 10, color: C.orange, fontWeight: 600 }}>MATERIALES</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>COT-{q.nubox_doc_number_materials}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{fmtCLP(q.total_materials)}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </>
        )}

        {/* ─NUEVA COT MANUAL ── */}
        {tab === "nueva" && (
          <div>
            {!nuboxStatus?.connected && (
              <div style={{ backgroundColor: C.dangerDim, border: `1px solid ${C.danger}`, borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 13, color: C.danger }}>
                Nubox no está conectado. Ve a Configuración para conectarlo.
              </div>
            )}

            {!aiResult ? (
              <>
                <div style={{ backgroundColor: C.card, borderRadius: 10, padding: 16, marginBottom: 12, border: `1px solid ${C.border}` }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10, color: C.text }}>Subir OT, email o descripción</div>
                  <textarea
                    value={uploadText}
                    onChange={e => setUploadText(e.target.value)}
                    placeholder="Pega aquí el texto del email o descripción de la OT..."
                    rows={5}
                    style={{ width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
                  />
                  <div style={{ marginTop: 10 }}>
                    <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.xlsx,.xls,.csv" style={{ display: "none" }} onChange={e => setUploadFiles(Array.from(e.target.files || []))} />
                    <button onClick={() => fileRef.current?.click()} style={{ backgroundColor: C.cardAlt, border: `1px dashed ${C.border}`, borderRadius: 8, padding: "10px 16px", width: "100%", cursor: "pointer", fontSize: 13, color: C.muted }}>
                      Adjuntar itemizado, PDF o fotos {uploadFiles.length > 0 && `(${uploadFiles.length} archivos)`}
                    </button>
                  </div>
                </div>
                <button onClick={processOT} disabled={processing} style={{ width: "100%", backgroundColor: C.orange, color: "#fff", border: "none", borderRadius: 10, padding: "14px 0", fontSize: 15, fontWeight: 700, cursor: processing ? "not-allowed" : "pointer", opacity: processing ? 0.7 : 1 }}>
                  {processing ? "Analizando con IA..." : "Analizar y cubicar"}
                </button>
              </>
            ) : (
              <>
                <div style={{ backgroundColor: C.card, borderRadius: 10, padding: 14, marginBottom: 12, border: `1px solid ${C.border}` }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 8 }}>Cliente detectado</div>
                  <div style={{ fontSize: 13, color: C.text }}>{aiResult.client?.name || "—"}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{aiResult.client?.rut} · {aiResult.client?.email}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{aiResult.reference}</div>
                </div>

                {aiResult.services?.length > 0 && (
                  <div style={{ backgroundColor: C.card, borderRadius: 10, padding: 14, marginBottom: 12, border: `1px solid ${C.border}` }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.info, marginBottom: 8 }}>Servicios / Mano de obra</div>
                    {aiResult.services.map((s, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 6, marginBottom: 6, borderBottom: i < aiResult.services.length - 1 ? `1px solid ${C.border}` : "none" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: C.text }}>{s.name}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{s.quantity} {s.unit} × {fmtCLP(s.price_neto)}</div>
                          {s.is_new && <span style={{ fontSize: 10, color: C.orange, fontWeight: 600 }}>Nuevo en Nubox</span>}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{fmtCLP(s.quantity * s.price_neto)}</div>
                      </div>
                    ))}
                    <div style={{ textAlign: "right", fontWeight: 700, color: C.info, marginTop: 6 }}>
                      Neto: {fmtCLP(aiResult.services.reduce((s, i) => s + i.quantity * i.price_neto, 0))}
                    </div>
                  </div>
                )}

                {aiResult.materials?.length > 0 && (
                  <div style={{ backgroundColor: C.card, borderRadius: 10, padding: 14, marginBottom: 12, border: `1px solid ${C.border}` }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.orange, marginBottom: 8 }}>Materiales e insumos</div>
                    {aiResult.materials.map((m, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 6, marginBottom: 6, borderBottom: i < aiResult.materials.length - 1 ? `1px solid ${C.border}` : "none" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: C.text }}>{m.name}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{m.quantity} {m.unit} × {fmtCLP(m.price_neto)}</div>
                          {m.is_new && <span style={{ fontSize: 10, color: C.orange, fontWeight: 600 }}>Nuevo en Nubox</span>}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{fmtCLP(m.quantity * m.price_neto)}</div>
                      </div>
                    ))}
                    <div style={{ textAlign: "right", fontWeight: 700, color: C.orange, marginTop: 6 }}>
                      Neto: {fmtCLP(aiResult.materials.reduce((s, i) => s + i.quantity * i.price_neto, 0))}
                    </div>
                  </div>
                )}

                {aiResult.notes && <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>📝 {aiResult.notes}</div>}

                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setAiResult(null)} style={{ flex: 1, backgroundColor: C.cardAlt, color: C.muted, border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, cursor: "pointer" }}>
                    ← Editar
                  </button>
                  <button onClick={createQuotations} disabled={creating || !nuboxStatus?.connected} style={{ flex: 2, backgroundColor: C.orange, color: "#fff", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: creating ? "not-allowed" : "pointer", opacity: creating ? 0.7 : 1 }}>
                    {creating ? "Creando en Nubox..." : "Crear en Nubox"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ─CONFIG NUBOX ── */}
        {tab === "config" && isAdmin && (
          <div>
            <div style={{ backgroundColor: C.card, borderRadius: 10, padding: 16, marginBottom: 12, border: `1px solid ${C.border}` }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: C.text }}>Conexión Nubox</div>
              {nuboxStatus?.connected ? (
                <div style={{ backgroundColor: C.successDim, borderRadius: 8, padding: 10, marginBottom: 12 }}>
                  <div style={{ color: C.success, fontWeight: 600, fontSize: 13 }}>Conectado</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{nuboxStatus.email}</div>
                  <div style={{ fontSize: 11, color: nuboxStatus.tokenValid ? C.success : C.danger, marginTop: 2 }}>
                    Token: {nuboxStatus.tokenValid ? "Válido (se renueva automáticamente)" : "Expirado — se renovará en el próximo uso"}
                  </div>
                </div>
              ) : (
                <div style={{ backgroundColor: C.dangerDim, borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13, color: C.danger }}>
                  No conectado
                </div>
              )}
              {/* Renovación automática con bookmarklet */}
              <BookmarkletRenewer apiUrl={API_URL} token={token} hasCredentials={!!nuboxStatus?.email} onRenewed={() => { setMsg("Token Nubox renovado"); loadAll(); }} />

              {/* Conexión manual como respaldo */}
              <details style={{ marginTop: 12 }}>
                <summary style={{ fontSize: 13, color: C.muted, cursor: "pointer" }}>Conectar manualmente (alternativa)</summary>
                <div style={{ marginTop: 10 }}>
                  <textarea value={nuboxJwt} onChange={e => setNuboxJwt(e.target.value)} placeholder="Token JWT (empieza con eyJ...)"
                    rows={3} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 11, marginBottom: 8, boxSizing: "border-box", fontFamily: "monospace", resize: "none" }} />
                  <input value={nuboxCompanyId} onChange={e => setNuboxCompanyId(e.target.value)} placeholder="Company ID (900f9337-...)"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, marginBottom: 10, boxSizing: "border-box" }} />
                  <button onClick={connectNubox} disabled={connecting} style={{ width: "100%", backgroundColor: C.orange, color: "#fff", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: connecting ? "not-allowed" : "pointer", opacity: connecting ? 0.7 : 1 }}>
                    {connecting ? "Conectando..." : nuboxStatus?.connected ? "Actualizar token" : "Conectar Nubox"}
                  </button>
                </div>
              </details>
            </div>

            <div style={{ backgroundColor: C.card, borderRadius: 10, padding: 16, border: `1px solid ${C.border}` }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: C.text }}>Productos en Nubox</div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>
                {productCount > 0 ? `${productCount} productos sincronizados` : "Sin productos. Sincroniza para que la IA pueda mapear códigos."} La IA usa estos productos para cubicar y crear cotizaciones. El email watcher corre cada 5 minutos.
              </div>
              <button onClick={syncProducts} disabled={syncing || !nuboxStatus?.connected} style={{ width: "100%", backgroundColor: C.info, color: "#fff", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: syncing ? "not-allowed" : "pointer", opacity: (syncing || !nuboxStatus?.connected) ? 0.6 : 1 }}>
                {syncing ? "Sincronizando..." : "Sincronizar productos desde Nubox"}
              </button>

              {/* Sub-tabs config */}
              <div style={{ display: "flex", gap: 8, marginTop: 24, marginBottom: 16 }}>
                {(["nubox", "productos"] as const).map(t => (
                  <button key={t} onClick={() => setConfigSubTab(t)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `2px solid ${configSubTab === t ? C.orange : C.border}`, backgroundColor: configSubTab === t ? C.orange : "transparent", color: configSubTab === t ? "#fff" : C.text, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                    {t === "nubox" ? "Clientes Nubox" : "Catálogo Proyecto"}
                  </button>
                ))}
              </div>

              {configSubTab === "productos" && (
                <div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
                    Productos con código Nubox del contrato vigente. La IA los usará primero al cubicar. Al importar un Excel nuevo, reemplaza el catálogo completo.
                  </div>
                  <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setImportingExcel(true); setMsg("");
                    const fd = new FormData(); fd.append("file", file);
                    const r = await fetch(`${API_URL}/project-products/import-excel`, { method: "POST", headers: h, body: fd }).then(r => r.json());
                    if (r.ok) { setMsg(`✅ ${r.imported} productos importados desde ${file.name}`); loadAll(); }
                    else setMsg("❌ " + r.message);
                    setImportingExcel(false);
                    if (importRef.current) importRef.current.value = "";
                  }} />
                  <button onClick={() => importRef.current?.click()} disabled={importingExcel} style={{ width: "100%", padding: "11px 0", backgroundColor: C.info, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: importingExcel ? "not-allowed" : "pointer", opacity: importingExcel ? 0.6 : 1, marginBottom: 16 }}>
                    {importingExcel ? "Importando..." : "Importar Excel del contrato"}
                  </button>
                  {projectProducts.length === 0 && <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Sin productos en el catálogo todavía.</div>}
                  {projectProducts.map(p => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", backgroundColor: C.bg, borderRadius: 8, marginBottom: 6, fontSize: 12 }}>
                      <div style={{ flex: 1 }}>
                        <b>{p.nubox_code}</b> · {p.name} · {p.unit} · ${p.price_neto.toLocaleString("es-CL")}
                        <span style={{ marginLeft: 6, fontSize: 10, padding: "2px 6px", borderRadius: 4, backgroundColor: p.category === "servicios" ? "#e3f2fd" : "#f3e5f5", color: p.category === "servicios" ? "#1565c0" : "#6a1b9a" }}>{p.category}</span>
                      </div>
                      <button onClick={async () => {
                        await fetch(`${API_URL}/project-products/${p.id}`, { method: "DELETE", headers: h });
                        loadAll();
                      }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16 }}>✕</button>
                    </div>
                  ))}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input value={newPP.nubox_code} onChange={e => setNewPP(p => ({ ...p, nubox_code: e.target.value }))} placeholder="Código Nubox (ej: MAT001)" style={{ flex: 1, padding: "9px 10px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, backgroundColor: C.bg, color: C.text }} />
                      <input value={newPP.unit} onChange={e => setNewPP(p => ({ ...p, unit: e.target.value }))} placeholder="UN" style={{ width: 60, padding: "9px 8px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, backgroundColor: C.bg, color: C.text }} />
                    </div>
                    <input value={newPP.name} onChange={e => setNewPP(p => ({ ...p, name: e.target.value }))} placeholder="Nombre del producto" style={{ padding: "9px 10px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, backgroundColor: C.bg, color: C.text }} />
                    <div style={{ display: "flex", gap: 6 }}>
                      <input value={newPP.price_neto} onChange={e => setNewPP(p => ({ ...p, price_neto: e.target.value }))} placeholder="Precio neto ($)" type="number" style={{ flex: 1, padding: "9px 10px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, backgroundColor: C.bg, color: C.text }} />
                      <select value={newPP.category} onChange={e => setNewPP(p => ({ ...p, category: e.target.value }))} style={{ width: 120, padding: "9px 8px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, backgroundColor: C.bg, color: C.text }}>
                        <option value="materiales">Materiales</option>
                        <option value="servicios">Servicios</option>
                      </select>
                    </div>
                    <button onClick={async () => {
                      if (!newPP.name || !newPP.price_neto) return setMsg("Nombre y precio son obligatorios");
                      const r = await fetch(`${API_URL}/project-products`, { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ ...newPP, price_neto: parseInt(newPP.price_neto) }) }).then(r => r.json());
                      if (r.ok) { setMsg("Producto agregado al catálogo"); setNewPP({ nubox_code: "", name: "", unit: "UND", price_neto: "", category: "materiales" }); loadAll(); }
                      else setMsg("❌ " + r.message);
                    }} style={{ padding: "10px 0", backgroundColor: C.orange, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      + Agregar al catálogo
                    </button>
                  </div>
                </div>
              )}

              {configSubTab === "nubox" && (<>
              {/* Clientes Nubox */}
              <div style={{ marginTop: 24, fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 8 }}>Clientes Nubox registrados</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
                Para crear cotizaciones, el cliente debe estar registrado en Nubox. Agrega su RUT y el ID de Nubox (URL: pyme.nubox.com/clientes/ver/<b>ID</b>).
              </div>
              {nuboxClients.map(c => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", backgroundColor: C.bg, borderRadius: 8, marginBottom: 6, fontSize: 13 }}>
                  <div style={{ flex: 1 }}><b>{c.name || c.rut}</b> · RUT {c.rut} · ID {c.nubox_id}</div>
                  <button onClick={async () => {
                    await fetch(`${API_URL}/nubox/clients/${c.id}`, { method: "DELETE", headers: h });
                    loadAll();
                  }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16 }}>✕</button>
                </div>
              ))}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                <input value={newClientRut} onChange={e => setNewClientRut(e.target.value)} placeholder="RUT cliente (ej: 70954200-1)" style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, backgroundColor: C.bg, color: C.text }} />
                <input value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="Nombre (ej: Corporación Municipal de Lampa)" style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, backgroundColor: C.bg, color: C.text }} />
                <input value={newClientNuboxId} onChange={e => setNewClientNuboxId(e.target.value)} placeholder="ID Nubox (de la URL /clientes/ver/ID)" style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, backgroundColor: C.bg, color: C.text }} />
                <button onClick={async () => {
                  if (!newClientRut || !newClientNuboxId) return setMsg("RUT e ID Nubox son obligatorios");
                  const r = await fetch(`${API_URL}/nubox/clients`, { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ rut: newClientRut, name: newClientName, nuboxId: newClientNuboxId }) }).then(r => r.json());
                  if (r.ok) { setMsg("Cliente registrado"); setNewClientRut(""); setNewClientName(""); setNewClientNuboxId(""); loadAll(); }
                  else setMsg("❌ " + r.message);
                }} style={{ padding: "10px 0", backgroundColor: C.orange, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  + Agregar cliente
                </button>
              </div>
              </>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENTE RENDICIONES
// ══════════════════════════════════════════════════════════════
const CATEGORIAS = ["materiales","herramientas","alimentacion","transporte","combustible","servicios","otros"];
const CAT_ICON: Record<string,string> = { materiales:"🧱", herramientas:"🔧", alimentacion:"🍽️", transporte:"🚗", combustible:"⛽", servicios:"🛠️", otros:"📦" };

function RendicionesScreen({ token, userName }: { token: string; userName: string }) {
  const h = { Authorization: `Bearer ${token}` };
  const [tab, setTab] = React.useState<"lista"|"nueva">("lista");
  const [rendiciones, setRendiciones] = React.useState<Rendicion[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  // Nueva rendición
  const [scanning, setScanning] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [imagePreview, setImagePreview] = React.useState<string|null>(null);
  const [onedriveInfo, setOnedriveInfo] = React.useState<{ url: string|null; path: string|null }>({ url: null, path: null });
  const [docPreview, setDocPreview] = React.useState<string|null>(null);
  const today = new Date().toISOString().split("T")[0];
  const emptyForm = { vendor:"", rut_vendor:"", boleta_number:"", boleta_date:"", rendicion_date: today, amount:"", description:"", category:"otros", worker_name: userName, cost_center_id:"" };
  const [form, setForm] = React.useState(emptyForm);
  const [formReady, setFormReady] = React.useState(false);
  const [costCenters, setCostCenters] = React.useState<CostCenter[]>([]);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const docRef = React.useRef<HTMLInputElement>(null);
  // Historial — expand/edit/attach
  const [expandedId, setExpandedId] = React.useState<string|null>(null);
  const [editingId, setEditingId] = React.useState<string|null>(null);
  const [editForm, setEditForm] = React.useState<Partial<typeof emptyForm>>({});
  const [attachingId, setAttachingId] = React.useState<string|null>(null);

  const loadRendiciones = React.useCallback(async () => {
    setLoading(true);
    const r = await fetch(`${API_URL}/rendiciones`, { headers: h }).then(r => r.json()).catch(() => ({ rendiciones: [] }));
    setRendiciones(r.rendiciones || []);
    setLoading(false);
  }, [token]);

  React.useEffect(() => {
    loadRendiciones();
    fetch(`${API_URL}/cost-centers`, { headers: h }).then(r => r.json()).then(r => setCostCenters(r.items || r.costCenters || r.cost_centers || [])).catch(() => {});
  }, [loadRendiciones]);

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 6000); };

  // Escanear boleta con IA
  async function handleBoleta(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true); setImagePreview(null); setFormReady(false);
    const fd = new FormData();
    fd.append("image", file);
    try {
      const r = await fetch(`${API_URL}/rendiciones/scan`, { method: "POST", headers: h, body: fd }).then(r => r.json());
      if (r.ok) {
        const d = r.data || {};
        setImagePreview(r.imageBase64 || null);
        setOnedriveInfo({ url: r.onedriveUrl || null, path: r.onedrivePath || null });
        setForm(f => ({
          ...f,
          vendor: d.vendor || "",
          rut_vendor: d.rut_vendor || "",
          boleta_number: d.boleta_number || "",
          boleta_date: d.date || "",
          amount: d.amount ? String(d.amount) : "",
          description: d.description || "",
          category: d.category || "otros",
        }));
        setFormReady(true);
        showMsg(r.aiFailed
          ? "Boleta guardada. La IA no pudo leerla — completa los datos manualmente."
          : "IA leyó la boleta. Revisa y ajusta los datos.");
      } else { showMsg("❌ " + r.message); }
    } catch { showMsg("Error al analizar la imagen"); }
    setScanning(false);
  }

  // Cargar doc rendición (foto o PDF)
  function handleDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setDocPreview(ev.target?.result as string); showMsg("Documento listo."); };
    reader.readAsDataURL(file);
  }

  // Guardar rendición
  async function handleGuardar() {
    if (!form.vendor || !form.amount) { showMsg("Completa al menos proveedor y monto"); return; }
    setSaving(true);
    const body = {
      ...form,
      rendicion_date: form.rendicion_date,
      amount: parseFloat(form.amount),
      image_data: imagePreview,
      onedrive_url: onedriveInfo.url,
      onedrive_path: onedriveInfo.path,
      doc_firmado_data: docPreview || null,
    };
    const r = await fetch(`${API_URL}/rendiciones`, {
      method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify(body)
    }).then(r => r.json());
    setSaving(false);
    if (r.ok) {
      const folio = r.rendicion?.folio ? ` (REN-${String(r.rendicion.folio).padStart(4,"0")})` : "";
      const emailMsg = r.emailSent ? " · Correo enviado a Paulette" : "";
      showMsg(`Guardada${folio}${emailMsg}`);
      loadRendiciones();
      resetForm();
      setTab("lista");
    } else { showMsg("❌ " + r.message); }
  }

  // Adjuntar doc a rendición existente desde historial
  async function handleAttachDoc(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachingId(id);
    const reader = new FileReader();
    reader.onload = async ev => {
      const doc_firmado_data = ev.target?.result as string;
      const r = await fetch(`${API_URL}/rendiciones/${id}/attach-doc`, {
        method: "POST", headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({ doc_firmado_data })
      }).then(r => r.json());
      setAttachingId(null);
      if (r.ok) { showMsg(`Documento adjunto${r.folioStr ? " · " + r.folioStr : ""} · Correo enviado`); loadRendiciones(); }
      else showMsg("❌ " + r.message);
    };
    reader.readAsDataURL(file);
  }

  // Marcar como pagado
  async function handlePagado(id: string) {
    const r = await fetch(`${API_URL}/rendiciones/${id}/marcar-pagado`, { method: "POST", headers: h }).then(r => r.json());
    if (r.ok) { showMsg("Marcado como pagado"); loadRendiciones(); }
    else showMsg("❌ " + r.message);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta rendición?")) return;
    await fetch(`${API_URL}/rendiciones/${id}`, { method: "DELETE", headers: h });
    loadRendiciones(); setExpandedId(null);
  }

  async function handleEdit(id: string) {
    const r = await fetch(`${API_URL}/rendiciones/${id}`, {
      method: "PUT", headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({ ...editForm, amount: parseFloat(editForm.amount || "0") })
    }).then(r => r.json());
    if (r.ok) { showMsg("Actualizada"); setEditingId(null); loadRendiciones(); }
    else showMsg("❌ " + r.message);
  }

  function resetForm() {
    setForm({ ...emptyForm, rendicion_date: new Date().toISOString().split("T")[0] });
    setImagePreview(null); setOnedriveInfo({ url: null, path: null });
    setDocPreview(null); setFormReady(false);
    if (fileRef.current) fileRef.current.value = "";
    if (docRef.current) docRef.current.value = "";
  }

  // Status badge helper
  function StatusBadge({ status }: { status: string }) {
    const cfg: Record<string, { bg: string; color: string; label: string }> = {
      guardado:       { bg: "#f3f4f6", color: "#374151", label: "Guardado" },
      pendiente_pago: { bg: "#fef9c3", color: "#854d0e", label: "Pendiente pago" },
      pagado:         { bg: "#dcfce7", color: "#15803d", label: "Pagado" },
      borrador:       { bg: "#f3f4f6", color: "#374151", label: "Guardado" },
      enviada:        { bg: "#fef9c3", color: "#854d0e", label: "Pendiente pago" },
    };
    const s = cfg[status] || cfg.guardado;
    return <span style={{ fontSize: 11, backgroundColor: s.bg, color: s.color, padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>{s.label}</span>;
  }

  const fInp = (label: string, _key: keyof typeof emptyForm, val: string, onChange: (v: string) => void, props: any = {}) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 3, fontWeight: 600 }}>{label}</div>
      <input value={val} onChange={e => onChange(e.target.value)}
        style={{ width: "100%", padding: "9px 11px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, backgroundColor: C.bg, color: C.text, boxSizing: "border-box" }}
        {...props} />
    </div>
  );

  return (
    <div style={{ paddingBottom: 80, minHeight: "100vh", backgroundColor: C.bg }}>
      {/* Header */}
      <div style={{ backgroundColor: C.card, borderBottom: `0.5px solid ${C.border}`, padding: "16px 16px 0" }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Rendiciones</div>
        <div style={{ display: "flex", gap: 0 }}>
          {(["lista","nueva"] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); if (t === "nueva") resetForm(); }}
              style={{ flex: 1, padding: "10px 0", border: "none", background: "none", fontSize: 13, fontWeight: tab === t ? 700 : 400,
                color: tab === t ? C.orange : C.muted, borderBottom: tab === t ? `2px solid ${C.orange}` : "2px solid transparent", cursor: "pointer" }}>
              {t === "lista" ? "Historial" : "Nueva rendición"}
            </button>
          ))}
        </div>
      </div>

      {msg && <div style={{ margin: "12px 16px 0", padding: "10px 14px", backgroundColor: msg.startsWith("✅") ? "#f0fdf4" : msg.startsWith("⚠️") ? "#fffbeb" : "#fef2f2", borderRadius: 8, fontSize: 13, color: msg.startsWith("✅") ? "#15803d" : msg.startsWith("⚠️") ? "#92400e" : "#dc2626" }}>{msg.replace(/^[✅❌⚠️]+\s*/, "")}</div>}

      {/* ─TAB: HISTORIAL ── */}
      {tab === "lista" && (
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: C.muted }}>{rendiciones.length === 1 ? "1 rendición" : `${rendiciones.length} rendiciones`}</div>
            <button onClick={async () => {
                const r = await fetch(`${API_URL}/rendiciones/excel`, { headers: h });
                const b = await r.blob();
                const u = URL.createObjectURL(b);
                const a = document.createElement("a"); a.href = u;
                a.download = `rendiciones_${new Date().toISOString().split("T")[0]}.xlsx`; a.click();
              }}
              style={{ fontSize: 12, backgroundColor: "#16a34a", color: "#fff", padding: "7px 12px", borderRadius: 8, border: "none", fontWeight: 700, cursor: "pointer" }}>
              Excel
            </button>
          </div>

          {loading ? <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Cargando...</div> :
          rendiciones.length === 0 ? <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Sin rendiciones. Toca "Nueva rendición" para comenzar.</div> :
          rendiciones.map(r => {
            const isExpanded = expandedId === r.id;
            const isEditing = editingId === r.id;
            return (
              <div key={r.id} style={{ backgroundColor: C.card, border: `0.5px solid ${isExpanded ? C.orange : C.border}`, borderRadius: 14, marginBottom: 10, overflow: "hidden" }}>
                {/* Card header — tap to expand */}
                <div onClick={() => { setExpandedId(isExpanded ? null : r.id); setEditingId(null); }} style={{ padding: 14, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ fontSize: 15 }}>{CAT_ICON[r.category] || "📦"}</span>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{r.vendor || "Sin proveedor"}</span>
                        <StatusBadge status={r.status} />
                        {r.folio && <span style={{ fontSize: 11, color: "#f97316", fontWeight: 700 }}>REN-{String(r.folio).padStart(4,"0")}</span>}
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: C.orange }}>${Number(r.amount || 0).toLocaleString("es-CL")}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>👤 {r.worker_name} · 📅 {fmtDate(r.date)}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8, flexShrink: 0 }}>
                      {r.image_data && <img src={r.image_data} alt="boleta" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.border}` }} />}
                      <span style={{ color: C.muted, fontSize: 18 }}>{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>
                </div>

                {/* Detalle expandido */}
                {isExpanded && (
                  <div style={{ borderTop: `0.5px solid ${C.border}`, padding: 14, backgroundColor: C.bg }}>
                    {!isEditing ? (
                      <>
                        {/* Detalles */}
                        <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                          {r.description && <div><span style={{ color: C.muted }}>Descripción: </span>{r.description}</div>}
                          {r.rut_vendor && <div><span style={{ color: C.muted }}>RUT proveedor: </span>{r.rut_vendor}</div>}
                          {r.boleta_number && <div><span style={{ color: C.muted }}>N° Boleta: </span><strong>{r.boleta_number}</strong></div>}
                          {r.boleta_date && <div><span style={{ color: C.muted }}>Fecha boleta: </span>{fmtDate(r.boleta_date)}</div>}
                          {r.cost_center_name && <div><span style={{ color: C.muted }}>Centro de costo: </span>{r.cost_center_code ? `[${r.cost_center_code}] ` : ""}{r.cost_center_name}</div>}
                          {r.submitted_at && <div><span style={{ color: C.muted }}>Correo enviado: </span>{fmtDate(r.submitted_at)}</div>}
                        </div>
                        {/* Links OneDrive */}
                        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                          {r.onedrive_url && <a href={r.onedrive_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#0284c7", padding: "5px 10px", backgroundColor: "#f0f9ff", borderRadius: 8 }}>Ver boleta →</a>}
                          {r.doc_firmado_onedrive_url && <a href={r.doc_firmado_onedrive_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#16a34a", padding: "5px 10px", backgroundColor: "#f0fdf4", borderRadius: 8 }}>Ver doc firmado →</a>}
                        </div>
                        {/* Botones de acción */}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {r.status === "guardado" && (
                            <>
                              <label style={{ flex: 1, minWidth: 140, backgroundColor: C.orange, color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "center", display: "block", opacity: attachingId === r.id ? 0.6 : 1 }}>
                                {attachingId === r.id ? "Subiendo..." : "Adjuntar doc rendición"}
                                <input type="file" accept="image/*,application/pdf" capture="environment" style={{ display: "none" }}
                                  onChange={e => handleAttachDoc(r.id, e)} disabled={attachingId === r.id} />
                              </label>
                            </>
                          )}
                          {r.status === "pendiente_pago" && (
                            <button onClick={() => handlePagado(r.id)}
                              style={{ flex: 1, minWidth: 140, backgroundColor: "#16a34a", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                              Marcar pagado
                            </button>
                          )}
                          <button onClick={() => { setEditingId(r.id); setEditForm({ vendor: r.vendor, rut_vendor: r.rut_vendor || "", boleta_date: r.boleta_date || "", rendicion_date: r.date, amount: String(r.amount), description: r.description, category: r.category, cost_center_id: r.cost_center_id || "", worker_name: r.worker_name }); }}
                            style={{ backgroundColor: "#eff6ff", color: "#1d4ed8", border: "none", borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                            Editar
                          </button>
                          <button onClick={() => handleDelete(r.id)}
                            style={{ backgroundColor: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 8, padding: "10px 12px", fontSize: 13, cursor: "pointer" }}>
                            🗑️
                          </button>
                        </div>
                      </>
                    ) : (
                      /* Formulario de edición inline */
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Editar rendición</div>
                        {fInp("Trabajador", "worker_name", editForm.worker_name || "", v => setEditForm(f => ({ ...f, worker_name: v })))}
                        {fInp("Proveedor", "vendor", editForm.vendor || "", v => setEditForm(f => ({ ...f, vendor: v })))}
                        {fInp("RUT Proveedor", "rut_vendor", editForm.rut_vendor || "", v => setEditForm(f => ({ ...f, rut_vendor: v })))}
                        {fInp("N° Boleta / Folio", "boleta_number", editForm.boleta_number || "", v => setEditForm(f => ({ ...f, boleta_number: v })))}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                          <div>
                            <div style={{ fontSize: 11, color: C.muted, marginBottom: 3, fontWeight: 600 }}>Fecha rendición</div>
                            <input type="date" value={editForm.rendicion_date || ""} onChange={e => setEditForm(f => ({ ...f, rendicion_date: e.target.value }))}
                              style={{ width: "100%", padding: "9px 8px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, backgroundColor: C.bg, color: C.text, boxSizing: "border-box" }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: C.muted, marginBottom: 3, fontWeight: 600 }}>Fecha boleta</div>
                            <input type="date" value={editForm.boleta_date || ""} onChange={e => setEditForm(f => ({ ...f, boleta_date: e.target.value }))}
                              style={{ width: "100%", padding: "9px 8px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, backgroundColor: C.bg, color: C.text, boxSizing: "border-box" }} />
                          </div>
                        </div>
                        {fInp("Monto ($)", "amount", editForm.amount || "", v => setEditForm(f => ({ ...f, amount: v })), { type: "number" })}
                        {fInp("Descripción", "description", editForm.description || "", v => setEditForm(f => ({ ...f, description: v })))}
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11, color: C.muted, marginBottom: 3, fontWeight: 600 }}>Centro de costo</div>
                          <select value={editForm.cost_center_id || ""} onChange={e => setEditForm(f => ({ ...f, cost_center_id: e.target.value }))}
                            style={{ width: "100%", padding: "9px 11px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, backgroundColor: C.bg, color: C.text, boxSizing: "border-box" }}>
                            <option value="">— Sin centro de costo —</option>
                            {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.code ? `[${cc.code}] ` : ""}{cc.name}</option>)}
                          </select>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => handleEdit(r.id)} style={{ flex: 1, backgroundColor: C.orange, color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                            Guardar cambios
                          </button>
                          <button onClick={() => setEditingId(null)} style={{ backgroundColor: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, cursor: "pointer" }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─TAB: NUEVA ── */}
      {tab === "nueva" && (
        <div style={{ padding: 16 }}>

          {/* ──Paso 1: Dos botones naranjos ─── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {/* Botón boleta */}
            <div style={{ position: "relative" }}>
              <button onClick={() => fileRef.current?.click()}
                style={{ width: "100%", backgroundColor: C.orange, color: "#fff", border: "none", borderRadius: 14, padding: "18px 10px", fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "center", opacity: scanning ? 0.7 : 1 }}>
                {scanning ? (
                  <><div style={{ fontSize: 26, marginBottom: 4 }}>🔍</div><div>Analizando...</div></>
                ) : imagePreview ? (
                  <><div style={{ marginBottom: 4, display: "flex", justifyContent: "center" }}><CheckCircle2 size={24} /></div><div>Foto boleta</div><div style={{ fontSize: 10, marginTop: 2, opacity: 0.8 }}>Toca para cambiar</div></>
                ) : (
                  <><div style={{ fontSize: 28, marginBottom: 4 }}>📷</div><div>Foto boleta</div><div style={{ fontSize: 10, marginTop: 2, opacity: 0.8 }}>La IA lee los datos</div></>
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleBoleta} />
            </div>

            {/* Botón doc rendición */}
            <div style={{ position: "relative" }}>
              <button onClick={() => docRef.current?.click()}
                style={{ width: "100%", backgroundColor: docPreview ? "#16a34a" : C.orange, color: "#fff", border: "none", borderRadius: 14, padding: "18px 10px", fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "center" }}>
                {docPreview ? (
                  <><div style={{ marginBottom: 4, display: "flex", justifyContent: "center" }}><CheckCircle2 size={24} /></div><div>Doc rendición</div><div style={{ fontSize: 10, marginTop: 2, opacity: 0.8 }}>Toca para cambiar</div></>
                ) : (
                  <><div style={{ fontSize: 28, marginBottom: 4 }}>📄</div><div>Doc rendición</div><div style={{ fontSize: 10, marginTop: 2, opacity: 0.8 }}>Foto o PDF firmado</div></>
                )}
              </button>
              <input ref={docRef} type="file" accept="image/*,application/pdf" capture="environment" style={{ display: "none" }} onChange={handleDoc} />
            </div>
          </div>

          {/* Info sobre qué pasará al guardar */}
          {(imagePreview || docPreview) && (
            <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, backgroundColor: docPreview ? "#f0fdf4" : "#fff7ed", border: `1px solid ${docPreview ? "#86efac" : "#fed7aa"}`, fontSize: 12, color: docPreview ? "#15803d" : "#92400e" }}>
              {docPreview
                ? "Al guardar: se asignará folio correlativo y se enviará correo a Paulette con el documento adjunto. Estado: Pendiente pago."
                : "Al guardar: solo se guardará la boleta en OneDrive. Puedes adjuntar el doc firmado después desde el historial. Estado: Guardado."}
            </div>
          )}

          {/* Preview miniatura */}
          {(imagePreview || docPreview) && (
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              {imagePreview && (
                <div style={{ textAlign: "center" }}>
                  <img src={imagePreview} alt="boleta" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.border}` }} />
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Boleta</div>
                  {onedriveInfo.url && <a href={onedriveInfo.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "#0284c7" }}>OneDrive ↗</a>}
                </div>
              )}
              {docPreview && (
                <div style={{ textAlign: "center" }}>
                  {docPreview.startsWith("data:image") ? (
                    <img src={docPreview} alt="doc" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: `2px solid #16a34a` }} />
                  ) : (
                    <div style={{ width: 80, height: 80, borderRadius: 8, border: `2px solid #16a34a`, backgroundColor: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>📄</div>
                  )}
                  <div style={{ fontSize: 10, color: "#16a34a", marginTop: 2 }}>Doc firmado</div>
                </div>
              )}
            </div>
          )}

          {/* ──Paso 2: Formulario (aparece tras scan) ─── */}
          {formReady && (
            <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: C.text }}>Revisa y completa los datos</div>

              {fInp("Trabajador", "worker_name", form.worker_name, v => setForm(f => ({ ...f, worker_name: v })))}
              {fInp("Proveedor *", "vendor", form.vendor, v => setForm(f => ({ ...f, vendor: v })), { placeholder: "Sodimac, Easy, ferretería..." })}
              {fInp("RUT Proveedor", "rut_vendor", form.rut_vendor, v => setForm(f => ({ ...f, rut_vendor: v })), { placeholder: "76.123.456-7" })}
              {fInp("N° Boleta / Folio", "boleta_number", form.boleta_number, v => setForm(f => ({ ...f, boleta_number: v })), { placeholder: "Ej: 123456" })}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 3, fontWeight: 600 }}>Fecha rendición</div>
                  <input type="date" value={form.rendicion_date} onChange={e => setForm(f => ({ ...f, rendicion_date: e.target.value }))}
                    style={{ width: "100%", padding: "9px 8px", borderRadius: 8, border: `2px solid ${C.orange}`, fontSize: 13, backgroundColor: C.bg, color: C.text, boxSizing: "border-box" }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 3, fontWeight: 600 }}>Fecha boleta</div>
                  <input type="date" value={form.boleta_date} onChange={e => setForm(f => ({ ...f, boleta_date: e.target.value }))}
                    style={{ width: "100%", padding: "9px 8px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, backgroundColor: C.bg, color: C.text, boxSizing: "border-box" }} />
                </div>
              </div>

              {fInp("Monto Total ($) *", "amount", form.amount, v => setForm(f => ({ ...f, amount: v })), { type: "number", placeholder: "0" })}
              {fInp("Descripción", "description", form.description, v => setForm(f => ({ ...f, description: v })), { placeholder: "¿Qué se compró?" })}

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600 }}>Categoría</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {CATEGORIAS.map(cat => (
                    <button key={cat} onClick={() => setForm(f => ({ ...f, category: cat }))}
                      style={{ padding: "5px 10px", borderRadius: 20, border: `1px solid ${form.category === cat ? C.orange : C.border}`, backgroundColor: form.category === cat ? "#fff7ed" : C.bg, color: form.category === cat ? C.orange : C.text, fontSize: 12, cursor: "pointer", fontWeight: form.category === cat ? 700 : 400 }}>
                      {CAT_ICON[cat]} {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 3, fontWeight: 600 }}>Centro de Costo</div>
                <select value={form.cost_center_id} onChange={e => setForm(f => ({ ...f, cost_center_id: e.target.value }))}
                  style={{ width: "100%", padding: "9px 11px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, backgroundColor: C.bg, color: C.text, boxSizing: "border-box" }}>
                  <option value="">— Sin centro de costo —</option>
                  {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.code ? `[${cc.code}] ` : ""}{cc.name}{cc.project_name ? ` · ${cc.project_name}` : ""}</option>)}
                </select>
              </div>

              <button onClick={handleGuardar} disabled={saving || !form.vendor || !form.amount}
                style={{ width: "100%", backgroundColor: C.orange, color: "#fff", border: "none", borderRadius: 10, padding: "14px 0", fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: (saving || !form.vendor || !form.amount) ? 0.5 : 1 }}>
                {saving ? "Guardando..." : docPreview ? "Guardar y enviar correo" : "Guardar rendición"}
              </button>
            </div>
          )}

          {/* Si no ha escaneado boleta aún, mostrar indicación */}
          {!imagePreview && !scanning && !formReady && (
            <div style={{ textAlign: "center", padding: "20px 0", color: C.muted, fontSize: 13 }}>
              Toca <strong style={{ color: C.orange }}>Foto boleta</strong> para comenzar.<br/>
              <span style={{ fontSize: 12 }}>La IA leerá los datos automáticamente.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─ESTADO DE RESULTADO ──────────────────────────────────────────────────────
type ERMonth = { ingresos: number; gastos: number; boletas: number; remuneraciones: number; margen: number };
type ERCenter = { cost_center_id: string | null; name: string; code: string | null; months: Record<string, ERMonth>; total: ERMonth };

const ER_MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const erMonthKeys = (year: number) => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);

type PayrollWorker = { id: string; full_name: string; cost_center_id: string | null; cost_center_name?: string; is_active: boolean };
type PayrollEntryRow = { worker_id: string; full_name: string; cost_center_id: string | null; cost_center_name?: string; amount: number };

function EstadoResultadoScreen({ token, isAdmin }: { token: string; isAdmin: boolean }) {
  const h = { Authorization: `Bearer ${token}` };
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [items, setItems] = useState<ERCenter[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState("");

  // Nómina de trabajadores (admin)
  const [payrollTab, setPayrollTab] = useState<"resumen" | "nomina">("resumen");
  const [costCenters, setCostCenters] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const [workers, setWorkers] = useState<PayrollWorker[]>([]);
  const [newWorkerName, setNewWorkerName] = useState("");
  const [newWorkerCC, setNewWorkerCC] = useState("");
  const [savingWorker, setSavingWorker] = useState(false);
  const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().slice(0, 7));
  const [entries, setEntries] = useState<PayrollEntryRow[]>([]);
  const [savingEntries, setSavingEntries] = useState(false);
  const [uploadingLibro, setUploadingLibro] = useState(false);
  const libroRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, [year]);
  useEffect(() => { if (isAdmin && payrollTab === "nomina") { loadWorkers(); loadCostCentersLite(); } }, [isAdmin, payrollTab]);
  useEffect(() => { if (isAdmin && payrollTab === "nomina") loadEntries(); }, [payrollMonth, payrollTab]);

  async function loadCostCentersLite() {
    try { const r = await fetch(`${API_URL}/cost-centers`, { headers: h }).then(r => r.json()); if (r.ok) setCostCenters(r.items || []); } catch (e) { avisarFalloRed("los centros de costo", e); }
  }
  async function loadWorkers() {
    try { const r = await fetch(`${API_URL}/payroll-workers`, { headers: h }).then(r => r.json()); if (r.ok) setWorkers(r.items || []); } catch (e) { avisarFalloRed("los trabajadores", e); }
  }
  async function addWorker() {
    if (!newWorkerName.trim()) return;
    setSavingWorker(true);
    try {
      await fetch(`${API_URL}/payroll-workers`, { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ full_name: newWorkerName.trim(), cost_center_id: newWorkerCC || null }) });
      setNewWorkerName(""); setNewWorkerCC(""); await loadWorkers();
    } catch { alert("Error"); } finally { setSavingWorker(false); }
  }
  async function updateWorkerCC(workerId: string, ccId: string) {
    setWorkers(ws => ws.map(w => w.id === workerId ? { ...w, cost_center_id: ccId || null } : w));
    try { await fetch(`${API_URL}/payroll-workers/${workerId}`, { method: "PUT", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ cost_center_id: ccId || null }) }); } catch (e) { avisarFalloRed("los trabajadores", e); }
  }
  async function removeWorker(workerId: string) {
    if (!confirm("¿Quitar este trabajador de la nómina?")) return;
    try { await fetch(`${API_URL}/payroll-workers/${workerId}`, { method: "DELETE", headers: h }); await loadWorkers(); await loadEntries(); } catch (e) { avisarFalloRed("los trabajadores", e); }
  }
  async function loadEntries() {
    try {
      const r = await fetch(`${API_URL}/payroll-entries?month=${payrollMonth}`, { headers: h }).then(r => r.json());
      if (r.ok) setEntries((r.items || []).map((it: any) => ({ worker_id: it.worker_id, full_name: it.full_name, cost_center_id: it.cost_center_id, cost_center_name: it.cost_center_name, amount: Number(it.amount) || 0 })));
    } catch (e) { console.error("[red]", e); }
  }
  async function saveEntries() {
    setSavingEntries(true);
    try {
      await fetch(`${API_URL}/payroll-entries/bulk`, { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ year_month: payrollMonth, entries: entries.map(e => ({ worker_id: e.worker_id, amount: e.amount })) }) });
      setMsg(""); await load();
    } catch { alert("Error al guardar"); } finally { setSavingEntries(false); }
  }

  async function uploadLibro(file: File) {
    setUploadingLibro(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("year_month", payrollMonth);
      const r = await fetch(`${API_URL}/payroll/upload-pdf`, { method: "POST", headers: h, body: fd }).then(r => r.json());
      if (!r.ok) { alert(r.message || "Error leyendo archivo"); return; }
      if (r.trabajadores_leidos > 0) {
        alert(`✅ Se leyeron ${r.trabajadores_leidos} trabajador(es) del libro (${r.trabajadores_nuevos} nuevos). Asígnales un centro de costo abajo.`);
        if (r.mes_guardado) setPayrollMonth(r.mes_guardado);
        await loadWorkers(); await loadEntries();
      } else {
        alert(`El libro no traía desglose por trabajador — se guardó solo el total ($${(r.total_guardado || 0).toLocaleString("es-CL")}) sin asignar a un centro específico. Para repartirlo por proyecto, agrega los trabajadores manualmente arriba.`);
      }
    } catch { alert("Error subiendo el archivo"); } finally { setUploadingLibro(false); }
  }

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/estado-resultado?year=${year}`, { headers: h }).then(r => r.json());
      if (r.ok) setItems(r.items || []);
      else setMsg(r.message || "Error");
    } catch { setMsg("Error al cargar"); }
    setLoading(false);
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const r = await fetch(`${API_URL}/estado-resultado/export?year=${year}`, { headers: h });
      if (!r.ok) { alert("No se pudo generar el Excel"); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const newTab = window.open(url, "_blank");
      if (!newTab) {
        const a = document.createElement("a");
        a.href = url; a.download = `Estado_Resultado_${year}.xlsx`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch { alert("Error al descargar"); } finally { setExporting(false); }
  }

  const months = erMonthKeys(year);
  const totalGeneral = items.reduce((acc, c) => ({
    ingresos: acc.ingresos + c.total.ingresos, gastos: acc.gastos + c.total.gastos,
    boletas: acc.boletas + c.total.boletas, remuneraciones: acc.remuneraciones + c.total.remuneraciones,
    margen: acc.margen + c.total.margen,
  }), { ingresos: 0, gastos: 0, boletas: 0, remuneraciones: 0, margen: 0 });

  return (
    <div style={{ padding: 16, paddingBottom: 90 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Estado de Resultado</div>
      </div>

      {isAdmin && (
        <div style={{ display: "flex", gap: 6, marginBottom: 14, backgroundColor: C.cardAlt, borderRadius: 10, padding: 4 }}>
          {([["resumen", "Resumen"], ["nomina", "Nómina"]] as [typeof payrollTab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setPayrollTab(t)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer", backgroundColor: payrollTab === t ? C.orange : "transparent", color: payrollTab === t ? "#fff" : C.muted, fontWeight: 700, fontSize: 12 }}>{label}</button>
          ))}
        </div>
      )}

      {payrollTab === "nomina" && isAdmin ? (
        <div>
          <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Trabajadores</div>
              <div>
                <input ref={libroRef} type="file" accept=".xlsx,.xls,.pdf" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) uploadLibro(e.target.files[0]); e.target.value = ""; }} />
                <button onClick={() => libroRef.current?.click()} disabled={uploadingLibro} style={{ backgroundColor: C.infoDim, border: `0.5px solid ${C.info}`, borderRadius: 8, padding: "5px 10px", color: C.info, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>
                  {uploadingLibro ? "Leyendo..." : "Subir libro (IA)"}
                </button>
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>Sube el libro de remuneraciones (Excel/PDF) y la IA crea aquí a cada trabajador con su sueldo del mes. Solo falta asignarles el centro de costo.</div>
            {workers.map(w => (
              <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1, fontSize: 12 }}>{w.full_name}</div>
                <select value={w.cost_center_id || ""} onChange={e => updateWorkerCC(w.id, e.target.value)} style={{ fontSize: 11, padding: "5px 6px", borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: C.bg, color: C.text, maxWidth: 140 }}>
                  <option value="">— Sin centro —</option>
                  {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.code ? `[${cc.code}] ` : ""}{cc.name}</option>)}
                </select>
                <button onClick={() => removeWorker(w.id)} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 14 }}>✕</button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <input value={newWorkerName} onChange={e => setNewWorkerName(e.target.value)} placeholder="Nombre del trabajador" style={{ flex: 1, fontSize: 12, padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.bg, color: C.text }} />
              <select value={newWorkerCC} onChange={e => setNewWorkerCC(e.target.value)} style={{ fontSize: 11, padding: "8px 6px", borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.bg, color: C.text, maxWidth: 130 }}>
                <option value="">— Sin centro —</option>
                {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.code ? `[${cc.code}] ` : ""}{cc.name}</option>)}
              </select>
              <button onClick={addWorker} disabled={savingWorker || !newWorkerName.trim()} style={{ padding: "0 14px", borderRadius: 8, border: "none", backgroundColor: C.orange, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>+</button>
            </div>
          </div>

          <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Sueldos del mes</div>
              <input type="month" value={payrollMonth} onChange={e => setPayrollMonth(e.target.value)} style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: C.bg, color: C.text }} />
            </div>
            {entries.length === 0 ? (
              <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: 10 }}>Agrega trabajadores arriba primero.</div>
            ) : entries.map((e, i) => (
              <div key={e.worker_id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12 }}>{e.full_name}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>{e.cost_center_name || "Sin centro de costo"}</div>
                </div>
                <input type="number" value={e.amount || ""} onChange={ev => setEntries(rows => rows.map((r, j) => j === i ? { ...r, amount: +ev.target.value } : r))}
                  placeholder="0" style={{ width: 110, fontSize: 12, padding: "7px 8px", borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: C.bg, color: C.text, textAlign: "right" }} />
              </div>
            ))}
            {entries.length > 0 && (
              <button onClick={saveEntries} disabled={savingEntries} style={{ width: "100%", marginTop: 10, height: 40, backgroundColor: C.orange, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: savingEntries ? 0.6 : 1 }}>
                {savingEntries ? "Guardando..." : "Guardar sueldos del mes"}
              </button>
            )}
          </div>
        </div>
      ) : (
      <>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <button onClick={() => setYear(y => y - 1)} style={{ width: 34, height: 34, borderRadius: 8, border: `0.5px solid ${C.border}`, backgroundColor: C.card, cursor: "pointer", fontSize: 15 }}>‹</button>
        <div style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: 700, backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 8, padding: "7px 0" }}>{year}</div>
        <button onClick={() => setYear(y => y + 1)} disabled={year >= currentYear} style={{ width: 34, height: 34, borderRadius: 8, border: `0.5px solid ${C.border}`, backgroundColor: C.card, cursor: year >= currentYear ? "not-allowed" : "pointer", opacity: year >= currentYear ? 0.4 : 1, fontSize: 15 }}>›</button>
        <button onClick={exportExcel} disabled={exporting || loading} style={{ height: 34, padding: "0 14px", borderRadius: 8, border: "none", backgroundColor: "#16a34a", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: exporting ? 0.6 : 1, whiteSpace: "nowrap" }}>
          {exporting ? "..." : "Excel"}
        </button>
      </div>

      {msg && <div style={{ color: C.danger, fontSize: 12, marginBottom: 10 }}>{msg}</div>}
      {loading ? (
        <div style={{ textAlign: "center", padding: 30, color: C.muted }}>Cargando...</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: 30, color: C.muted, fontSize: 13 }}>Sin datos para {year}.</div>
      ) : (
        <>
          {/* Resumen general */}
          <div style={{ backgroundColor: totalGeneral.margen >= 0 ? "#f0fdf4" : "#fef2f2", border: `0.5px solid ${totalGeneral.margen >= 0 ? "#86efac" : "#fecaca"}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Margen total {year}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: totalGeneral.margen >= 0 ? "#15803d" : "#dc2626" }}>{fmtCLP(totalGeneral.margen)}</div>
            <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap", fontSize: 11, color: C.muted }}>
              <span>Ingresos: <b style={{ color: C.text }}>{fmtCLP(totalGeneral.ingresos)}</b></span>
              <span>Gastos: <b style={{ color: C.text }}>{fmtCLP(totalGeneral.gastos)}</b></span>
              <span>Boletas: <b style={{ color: C.text }}>{fmtCLP(totalGeneral.boletas)}</b></span>
              <span>Remuneraciones: <b style={{ color: C.text }}>{fmtCLP(totalGeneral.remuneraciones)}</b></span>
            </div>
          </div>

          {/* EBITDA mensual: gráfico de barras en vez de tabla. La tabla exigía scroll
              horizontal y se veía cortada al entrar, sin señal de que había más columnas. */}
          <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>EBITDA mensual {year}</div>
            {(() => {
              const valores = months.map(ym => items.reduce((s, cc) => s + (cc.months[ym]?.margen || 0), 0));
              const tope = Math.max(1, ...valores.map(v => Math.abs(v)));
              return (
                <>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 110, marginBottom: 6 }}>
                    {valores.map((v, i) => {
                      const alto = Math.round((Math.abs(v) / tope) * 100);
                      return (
                        <div key={i} title={`${ER_MESES[i]}: ${fmtCLP(v)}`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                          <div style={{ height: `${alto}%`, minHeight: v === 0 ? 2 : 4, backgroundColor: v >= 0 ? "#16A34A" : "#DC2626", opacity: v === 0 ? 0.18 : 1, borderRadius: "3px 3px 0 0" }} />
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 3, marginBottom: 10 }}>
                    {ER_MESES.map(m => <div key={m} style={{ flex: 1, textAlign: "center", fontSize: 8, color: C.muted }}>{m}</div>)}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted, borderTop: `0.5px solid ${C.border}`, paddingTop: 8 }}>
                    <span>Mejor mes: <b style={{ color: "#15803d" }}>{ER_MESES[valores.indexOf(Math.max(...valores))]}</b></span>
                    <span>Peor mes: <b style={{ color: "#dc2626" }}>{ER_MESES[valores.indexOf(Math.min(...valores))]}</b></span>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Por centro de costo */}
          {items.map(cc => {
            const key = cc.cost_center_id || "sin_centro";
            const isOpen = expanded === key;
            return (
              <div key={key} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, marginBottom: 10, overflow: "hidden" }}>
                <div onClick={() => setExpanded(isOpen ? null : key)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 14, cursor: "pointer" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{cc.code ? `[${cc.code}] ` : ""}{cc.name}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Toca para {isOpen ? "cerrar" : "ver detalle mensual"}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: cc.total.margen >= 0 ? "#15803d" : "#dc2626" }}>{fmtCLP(cc.total.margen)}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>margen</div>
                  </div>
                </div>
                {isOpen && (
                  <div style={{ padding: "0 14px 14px", overflowX: "auto" }}>
                    <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11, minWidth: 640 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: "4px 6px", color: C.muted, borderBottom: `1px solid ${C.border}` }}>Concepto</th>
                          {ER_MESES.map(m => <th key={m} style={{ textAlign: "right", padding: "4px 6px", color: C.muted, borderBottom: `1px solid ${C.border}` }}>{m}</th>)}
                          <th style={{ textAlign: "right", padding: "4px 6px", color: C.muted, borderBottom: `1px solid ${C.border}`, fontWeight: 800 }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {([["Ingresos","ingresos"],["Gastos","gastos"],["Boletas","boletas"],["Remuneraciones","remuneraciones"]] as [string, keyof ERMonth][]).map(([label, k]) => (
                          <tr key={k}>
                            <td style={{ padding: "4px 6px", color: C.muted }}>{label}</td>
                            {months.map(ym => <td key={ym} style={{ textAlign: "right", padding: "4px 6px" }}>{fmtCLP(cc.months[ym]?.[k] || 0)}</td>)}
                            <td style={{ textAlign: "right", padding: "4px 6px", fontWeight: 700 }}>{fmtCLP(cc.total[k])}</td>
                          </tr>
                        ))}
                        <tr>
                          <td style={{ padding: "6px 6px", fontWeight: 800, borderTop: `1px solid ${C.border}` }}>Margen</td>
                          {months.map(ym => {
                            const v = cc.months[ym]?.margen || 0;
                            return <td key={ym} style={{ textAlign: "right", padding: "6px 6px", fontWeight: 800, borderTop: `1px solid ${C.border}`, color: v >= 0 ? "#15803d" : "#dc2626" }}>{fmtCLP(v)}</td>;
                          })}
                          <td style={{ textAlign: "right", padding: "6px 6px", fontWeight: 800, borderTop: `1px solid ${C.border}`, color: cc.total.margen >= 0 ? "#15803d" : "#dc2626" }}>{fmtCLP(cc.total.margen)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
      </>
      )}
    </div>
  );
}
