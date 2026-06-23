import React, { useState, useEffect, useRef } from "react";
import { Camera, LogOut, Mail, Lock, Trash2, FileText, Plus, ChevronLeft, FolderOpen, Home, Shield, Eye, EyeOff, Bell, Image, MessageSquare, DollarSign, BarChart2, X, CheckCircle2, AlertTriangle } from "lucide-react";

const API_URL = "https://obrassync-backend-production.up.railway.app";

const C = {
  bg: "#0F0F10", card: "#171717", cardAlt: "#1D1D1D", border: "#2A2A2A",
  text: "#FFFFFF", muted: "#555555", mutedSoft: "#888888",
  orange: "#FF8A00", orangeSoft: "#FDBA74", orangeDim: "#1A0F00",
  success: "#22C55E", successDim: "#0D1A0D", danger: "#EF4444", dangerDim: "#1A0D0D",
  info: "#3B82F6", infoDim: "#0D0D1A", purple: "#A855F7", purpleDim: "#150D1A",
};

type Screen = "home" | "proyectos" | "crearProyecto" | "fotos" | "admin" | "editarUsuario" | "crearUsuario" | "partidas" | "configuracion" | "gastos";
type Project = { id: string; code: string; name: string; client_name?: string; start_date?: string; end_date?: string; progress_percent?: number };
type Task = { id: string; name: string; duration?: string; start_date?: string; end_date?: string; progress_percent?: number; status?: string; photo_count?: number; unit?: string; quantity?: string; codigo?: string; esquema?: string };
type TaskPhoto = { id: string; filename: string; local_path?: string; onedrive_url?: string; created_at: string; description?: string; photo_type?: string };
type QuoteItem = { tempId: string; name: string; codigo: string; quantity: string; unit: string; start_date: string; end_date: string; selected: boolean };
type User = { id: string; full_name: string; email: string; role: string; is_active: boolean; permissions?: Record<string, boolean> };
type Kpis = { proyectos: { total: number; avg_progress: number; atrasados: number }; tareas: { total: number; completadas: number; en_curso: number; atrasadas: number }; fotos: { total: number }; gastos: { total_mes: number } };
type CostCenter = { id: string; name: string; code?: string; type: string; project_name?: string; project_id?: string };
type Expense = { id: string; cost_center_id?: string; project_id?: string; category: string; supplier_name?: string; supplier_rut?: string; document_number?: string; document_type: string; amount: number; net_amount: number; tax_amount: number; expense_date: string; description?: string; project_name?: string; cost_center_name?: string; created_by_name?: string };
type ExpenseSummary = { month: string; totals: { total: number; neto: number; iva: number }; byProject: { project_name: string; total: number; count: number }[]; byCategory: { category: string; total: number; count: number }[] };

type SiiFactura = { folio: number; rut_emisor: string; razon_social: string; fecha: string; monto_neto: number; monto_iva: number; monto_total: number; tipo_dte: number; expense_id?: string; cost_center_id?: string };

const EXPENSE_CATEGORIES = [
  { value: "materiales", label: "Materiales", icon: "🧱" },
  { value: "mano_obra", label: "Mano de obra", icon: "👷" },
  { value: "combustible", label: "Combustible", icon: "⛽" },
  { value: "herramientas", label: "Herramientas", icon: "🔧" },
  { value: "transporte", label: "Transporte", icon: "🚛" },
  { value: "subcontrato", label: "Subcontrato", icon: "📋" },
  { value: "admin", label: "Administración", icon: "🏢" },
  { value: "otros", label: "Otros", icon: "📦" },
];
const fmtCLP = (n: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 }).format(n);

const PERMISSIONS = [
  { key: "photos", label: "Fotos", sub: "Subir y ver fotos de partidas", icon: "📷" },
  { key: "projects", label: "Proyectos", sub: "Ver lista de proyectos", icon: "📁" },
  { key: "reports", label: "Informes Word", sub: "Generar y descargar informes", icon: "📄" },
  { key: "kpis", label: "KPIs inicio", sub: "Ver métricas en el dashboard", icon: "📊" },
  { key: "montos", label: "Ver montos", sub: "Ver cifras y montos de dinero", icon: "💰" },
  { key: "gastos", label: "Módulo Gastos", sub: "Ver y registrar gastos", icon: "💳" },
  { key: "admin", label: "Administración", sub: "Gestionar usuarios y permisos", icon: "👤" },
];

const ROLES = [
  { value: "administrador", label: "Admin", icon: "👑", color: "#FF8A00", bg: "#1A0F00", border: "#3A1F00" },
  { value: "jefe_obra", label: "Jefe obra", icon: "🦺", color: "#3B82F6", bg: "#0D0D1A", border: "#0D1A3A" },
  { value: "inspector", label: "Trabajador", icon: "👷", color: "#22C55E", bg: "#0D1A0D", border: "#0D3A0D" },
];

const STATUS_OPTIONS = [
  { value: "pendiente", label: "Pendiente", color: "#888888", bg: "#1D1D1D" },
  { value: "en_curso", label: "En progreso", color: "#3B82F6", bg: "#0D0D1A" },
  { value: "completada", label: "Completada", color: "#22C55E", bg: "#0D1A0D" },
  { value: "atrasada", label: "Atrasada", color: "#EF4444", bg: "#1A0D0D" },
];

function fmtDate(iso?: string) { if (!iso) return ""; const d = new Date(iso.includes("T") ? iso : iso + "T12:00:00"); return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }); }
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

export default function App() {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem("obs_token"));
  const [userName, setUserName] = useState(() => localStorage.getItem("obs_name") || "");
  const [userRole, setUserRole] = useState(() => localStorage.getItem("obs_role") || "");
  const [userPerms, setUserPerms] = useState<Record<string, boolean>>(() => { try { return JSON.parse(localStorage.getItem("obs_perms") || "{}"); } catch { return {}; } });
  function setToken(t: string | null) { if (t) localStorage.setItem("obs_token", t); else { localStorage.removeItem("obs_token"); localStorage.removeItem("obs_name"); localStorage.removeItem("obs_role"); localStorage.removeItem("obs_perms"); } setTokenState(t); }
  const [email, setEmail] = useState("admin@obrassync.cl");
  const [password, setPassword] = useState("Admin1234*");
  const [showPass, setShowPass] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [screen, setScreen] = useState<Screen>("home");
  const [taskFilter, setTaskFilter] = useState("todos");

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectCode, setProjectCode] = useState("");
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);

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
  const [nuboxSummary, setNuboxSummary] = useState<any | null>(null);
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
  const [savingPhotoDesc, setSavingPhotoDesc] = useState(false);

  const isAdmin = userRole === "administrador" || userRole === "admin";
  // Permisos: admin siempre tiene todo, otros según asignación
  const canSee = (key: string) => isAdmin || userPerms[key] === true;
  const canSeeKpis = canSee("kpis");
  const canSeeMontos = canSee("montos");
  const canSeeGastos = canSee("gastos");
  const canSeeReports = canSee("reports");

  useEffect(() => { if (token) { loadProjects(); loadKpis(); if (isAdmin) { loadUsers(); loadCostCenters(); } } }, [token]);
  useEffect(() => { if (selectedProject && token) loadTasks(selectedProject.id); }, [selectedProject]);

  const inp: React.CSSProperties = { width: "100%", height: 48, backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 14, padding: "0 14px", marginBottom: 10, boxSizing: "border-box", outline: "none" };
  const btnPrimary: React.CSSProperties = { width: "100%", height: 50, backgroundColor: C.orange, border: "none", borderRadius: 12, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" };

  async function handleLogin() {
    if (!email || !password) return;
    setLoginLoading(true);
    try {
      const r = await fetch(`${API_URL}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Credenciales inválidas"); return; }
      const name = d.user?.fullName || "Usuario"; const role = d.user?.role || ""; const perms = d.user?.permissions || {};
      localStorage.setItem("obs_name", name); localStorage.setItem("obs_role", role); localStorage.setItem("obs_perms", JSON.stringify(perms));
      setToken(d.token); setUserName(name); setUserRole(role); setUserPerms(perms);
    } catch { alert("No se pudo conectar al servidor"); } finally { setLoginLoading(false); }
  }

  async function loadProjects() {
    try { const r = await fetch(`${API_URL}/projects`, { headers: { Authorization: `Bearer ${token}` } }); const d = await r.json(); setProjects(d.items || []); } catch {}
  }

  async function createProject() {
    if (!projectCode || !projectName) { alert("Código y nombre son obligatorios"); return; }
    setCreatingProject(true);
    try {
      const r = await fetch(`${API_URL}/projects`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ code: projectCode, name: projectName, clientName, startDate: startDate || null, endDate: endDate || null }) });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error"); return; }
      setProjectCode(""); setProjectName(""); setClientName(""); setStartDate(""); setEndDate("");
      await loadProjects(); setScreen("proyectos");
    } catch { alert("Error creando proyecto"); } finally { setCreatingProject(false); }
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
    catch {} finally { setTasksLoading(false); }
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

  async function saveTask() {
    if (!editingTask || !selectedProject) return;
    setSavingTask(true);
    try {
      const progress = taskStatus === "completada" ? 100 : taskStatus === "pendiente" ? 0 : taskProgress;
      const r = await fetch(`${API_URL}/tasks/${editingTask.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: taskStatus, progressPercent: progress, name: taskName, unit: taskUnit || null, quantity: taskQuantity || null }) });
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
    catch {} finally { setPhotosLoading(false); }
  }

  async function deletePhoto(id: string) {
    if (!confirm("¿Eliminar foto?")) return;
    try { await fetch(`${API_URL}/photos/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); setPhotos(p => p.filter(x => x.id !== id)); }
    catch { alert("Error"); }
  }

  async function generateReport() {
    if (!selectedProject) return;
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

  async function uploadPhotoWithDesc(file: File, description: string) {
    if (!selectedTask) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData(); fd.append("photo", file); fd.append("description", description); fd.append("photo_type", photoTypeInput);
      const r = await fetch(`${API_URL}/tasks/${selectedTask.id}/photos`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error"); return; }
      const r2 = await fetch(`${API_URL}/tasks/${selectedTask.id}/photos`, { headers: { Authorization: `Bearer ${token}` } });
      const d2 = await r2.json(); setPhotos(d2.items || []);
    } catch { alert("Error"); } finally { setUploadingPhoto(false); }
  }

  async function savePhotoDesc(photoId: string, desc: string) {
    setSavingPhotoDesc(true);
    try {
      const r = await fetch(`${API_URL}/photos/${photoId}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ description: desc }) });
      const d = await r.json();
      if (d.ok) setPhotos(ps => ps.map(p => p.id === photoId ? { ...p, description: desc } : p));
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
    try { const r = await fetch(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } }); const d = await r.json(); setUsers(d.items || []); } catch {}
  }

  async function loadKpis() {
    try { const r = await fetch(`${API_URL}/dashboard/kpis`, { headers: { Authorization: `Bearer ${token}` } }); const d = await r.json(); if (d.ok) setKpis(d); } catch {}
  }

  async function loadCostCenters() {
    try { const r = await fetch(`${API_URL}/cost-centers`, { headers: { Authorization: `Bearer ${token}` } }); const d = await r.json(); if (d.ok) setCostCenters(d.items || []); } catch {}
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

  const checkSiiStatus = async () => {
    try {
      const r = await fetch(`${API_URL}/sii/status`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (d.ok) { setSiiConfigured(d.configured); if (d.rut) setSiiConfigRut(d.rut); }
    } catch {}
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
      const [r1, r2] = await Promise.all([
        fetch(`${API_URL}/nubox/summary?period=${m}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/payroll?month=${m}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const d1 = await r1.json(); if (d1.ok) setNuboxSummary(d1.nubox);
      const d2 = await r2.json(); if (d2.ok) setPayroll(d2.current);
    } catch {}
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
      if (!r.ok || !d.ok) { alert(d.message || "Error leyendo PDF"); return; }
      setPayrollPdfResult(d.data);
      setPayroll({ total_amount: d.total_guardado, note: `${d.data.cantidad_trabajadores || "?"} trabajadores · ${d.data.resumen || ""}` });
    } catch { alert("Error subiendo PDF"); } finally { setUploadingPayrollPdf(false); }
  }

  async function assignNuboxPurchase(nuboxId: number | string, selectedValue: string) {
    setNuboxAssigning(String(nuboxId));
    try {
      // selectedValue es project_id (si viene de costCenter con project_id) o cost_center_id (si es centro manual)
      const cc = costCenters.find(c => c.project_id === selectedValue);
      const isProject = !!cc;
      const body = isProject ? { project_id: selectedValue } : { cost_center_id: selectedValue };
      const r = await fetch(`${API_URL}/nubox/purchases/${nuboxId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error"); return; }
      const ccName = cc?.name || costCenters.find(c => c.id === selectedValue)?.name || "";
      setNuboxPurchases(prev => prev.map(p => p.id === nuboxId ? { ...p, assigned: { project_id: selectedValue, project_name: ccName } } : p));
      setNuboxSelectedProject(prev => { const n = { ...prev }; delete n[String(nuboxId)]; return n; });
      await loadKpis();
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
          <div style={{ width: 72, height: 72, background: C.orangeDim, border: `1.5px solid ${C.orange}`, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 20 }}>🏗️</div>
          <div style={{ color: C.text, fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>Obras<span style={{ color: C.orange }}>Sync</span></div>
          <div style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>Control de obra inteligente</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: "0 14px", marginBottom: 10, height: 50 }}>
          <Mail size={16} color={C.orange} />
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Correo electrónico" style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontSize: 14 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: "0 14px", marginBottom: 24, height: 50 }}>
          <Lock size={16} color={C.orange} />
          <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" onKeyDown={e => e.key === "Enter" && handleLogin()} style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontSize: 14 }} />
          <div onClick={() => setShowPass(!showPass)} style={{ cursor: "pointer" }}>{showPass ? <EyeOff size={15} color={C.muted} /> : <Eye size={15} color={C.muted} />}</div>
        </div>
        <button onClick={handleLogin} disabled={loginLoading} style={btnPrimary}>{loginLoading ? "Ingresando..." : "Ingresar"}</button>
        <div style={{ textAlign: "center", marginTop: 32, color: "#333", fontSize: 12 }}>Desarrollado por <span style={{ color: "#444" }}>Matfau SPA</span> · v2.0</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.bg, color: C.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif", paddingBottom: 80 }}>

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
            {taskStatus === "completada" && <div style={{ textAlign: "center", color: C.success, fontWeight: 700, fontSize: 13, marginBottom: 16 }}>✅ Avance automático: 100%</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setEditingTask(null)} style={{ flex: 1, height: 46, background: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 12, color: C.muted, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button onClick={saveTask} disabled={savingTask} style={{ flex: 2, height: 46, background: C.orange, border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, cursor: "pointer" }}>{savingTask ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, backgroundColor: C.bg, borderBottom: `0.5px solid ${C.border}`, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {(screen === "fotos" || screen === "editarUsuario" || screen === "crearUsuario" || screen === "partidas" || screen === "crearProyecto") && (
            <button onClick={() => { if (screen === "fotos") setScreen("partidas"); else if (screen === "partidas") setScreen("home"); else if (screen === "crearProyecto") setScreen("proyectos"); else setScreen("admin"); }} style={{ background: "none", border: "none", color: C.orange, cursor: "pointer", padding: 0, display: "flex" }}>
              <ChevronLeft size={24} />
            </button>
          )}
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>Obras<span style={{ color: C.orange }}>Sync</span></div>
            {selectedProject && ["partidas", "fotos"].includes(screen) && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{selectedProject.name}</div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ width: 34, height: 34, background: C.card, border: `0.5px solid ${C.border}`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                        {t === "previa" ? "📷 Foto Previa" : "🔨 En Ejecución"}
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
                      {tipo === "previa" ? "📷 Fotos Previas" : "🔨 En Ejecución"}
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
                          {photo.onedrive_url && <div style={{ fontSize: 11, color: C.info, marginTop: 2 }}>☁️ OneDrive</div>}
                        </div>
                        <button onClick={() => deletePhoto(photo.id)} style={{ width: 30, height: 30, backgroundColor: C.dangerDim, border: "none", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: 8 }}>
                          <Trash2 size={12} color={C.danger} />
                        </button>
                      </div>
                      {/* Descripción editable */}
                      {editingPhotoId === photo.id ? (
                        <div style={{ marginTop: 8 }}>
                          <textarea value={editingPhotoDesc} onChange={e => setEditingPhotoDesc(e.target.value)} rows={2} style={{ width: "100%", backgroundColor: C.cardAlt, border: `0.5px solid ${C.orange}`, borderRadius: 8, color: C.text, fontSize: 12, padding: 8, resize: "none", boxSizing: "border-box", outline: "none", marginBottom: 6 }} />
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => setEditingPhotoId(null)} style={{ flex: 1, height: 32, background: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 8, color: C.muted, fontSize: 11, cursor: "pointer" }}>Cancelar</button>
                            <button onClick={() => savePhotoDesc(photo.id, editingPhotoDesc)} disabled={savingPhotoDesc} style={{ flex: 2, height: 32, background: C.orange, border: "none", borderRadius: 8, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{savingPhotoDesc ? "Guardando..." : "Guardar"}</button>
                          </div>
                        </div>
                      ) : (
                        <div onClick={() => { setEditingPhotoId(photo.id); setEditingPhotoDesc(photo.description || ""); }} style={{ marginTop: 8, padding: "6px 10px", borderLeft: `3px solid ${C.orange}`, backgroundColor: C.cardAlt, borderRadius: "0 6px 6px 0", cursor: "pointer" }}>
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
                    <img src={`${API_URL}${photo.local_path}`} alt={photo.filename} style={{ width: "100%", maxHeight: 300, objectFit: "cover", display: "block", backgroundColor: C.border }} />
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
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>Hola, {userName.split(" ")[0]} 👋</div>
              <div style={{ color: C.mutedSoft, fontSize: 13, marginTop: 2 }}>{new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}</div>
            </div>

            {/* KPI Cards */}
            {canSeeKpis && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              <div onClick={() => setScreen("proyectos")} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 16, padding: 16, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ width: 36, height: 36, background: C.orangeDim, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}><FolderOpen size={18} color={C.orange} /></div>
                  {(kpis?.proyectos.atrasados || 0) > 0 && <div style={{ background: C.dangerDim, border: `0.5px solid ${C.danger}`, borderRadius: 6, padding: "2px 7px", fontSize: 10, color: C.danger, fontWeight: 700 }}>{kpis?.proyectos.atrasados} atr.</div>}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: C.orange, marginTop: 10 }}>{kpis?.proyectos.total ?? projects.length}</div>
                <div style={{ fontSize: 11, color: C.mutedSoft, marginTop: 2 }}>Proyectos activos</div>
                <div style={{ height: 3, background: C.border, borderRadius: 99, marginTop: 8, overflow: "hidden" }}>
                  <div style={{ width: `${kpis?.proyectos.avg_progress || 0}%`, height: "100%", background: C.orange, borderRadius: 99 }} />
                </div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{kpis?.proyectos.avg_progress ?? 0}% avance prom.</div>
              </div>

              <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
                <div style={{ width: 36, height: 36, background: C.infoDim, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}><BarChart2 size={18} color={C.info} /></div>
                <div style={{ fontSize: 28, fontWeight: 800, color: C.info, marginTop: 10 }}>{kpis?.tareas.en_curso ?? 0}</div>
                <div style={{ fontSize: 11, color: C.mutedSoft, marginTop: 2 }}>Partidas en curso</div>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <div style={{ background: C.successDim, borderRadius: 5, padding: "2px 7px", fontSize: 10, color: C.success }}><CheckCircle2 size={9} style={{ marginRight: 3 }} />{kpis?.tareas.completadas ?? 0} ok</div>
                  {(kpis?.tareas.atrasadas || 0) > 0 && <div style={{ background: C.dangerDim, borderRadius: 5, padding: "2px 7px", fontSize: 10, color: C.danger }}><AlertTriangle size={9} style={{ marginRight: 3 }} />{kpis?.tareas.atrasadas} atr.</div>}
                </div>
              </div>

              <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
                <div style={{ width: 36, height: 36, background: C.successDim, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}><Image size={18} color={C.success} /></div>
                <div style={{ fontSize: 28, fontWeight: 800, color: C.success, marginTop: 10 }}>{kpis?.fotos.total ?? 0}</div>
                <div style={{ fontSize: 11, color: C.mutedSoft, marginTop: 2 }}>Fotos registradas</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>En todos los proyectos</div>
              </div>

              <div onClick={() => setScreen("gastos")} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 16, padding: 16, cursor: "pointer" }}>
                <div style={{ width: 36, height: 36, background: C.purpleDim, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}><DollarSign size={18} color={C.purple} /></div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.purple, marginTop: 10 }}>{canSeeMontos ? (kpis ? fmtCLP(kpis.gastos.total_mes) : "$0") : "••••••"}</div>
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
                  <span style={{ fontSize: 20 }}>🏗️</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>#{p.code}{p.client_name ? ` · ${p.client_name}` : ""}</div>
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
                📄 Cotización PDF
              </button>
              <button onClick={() => setShowGantt(!showGantt)} style={{ flex: 1, height: 44, backgroundColor: showGantt ? C.orangeDim : C.cardAlt, border: `0.5px solid ${showGantt ? C.orange : C.border}`, borderRadius: 10, color: showGantt ? C.orange : C.mutedSoft, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                📊 Excel
              </button>
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
                        <button onClick={() => { setEditingTask(task); setTaskStatus(task.status || "pendiente"); setTaskProgress(Number(task.progress_percent || 0)); setTaskName(task.name || ""); setTaskUnit(task.unit || ""); setTaskQuantity(task.quantity || ""); }} style={{ width: 38, height: 38, backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>✏️</button>
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
              <button onClick={() => setScreen("crearProyecto")} style={{ backgroundColor: C.orange, border: "none", borderRadius: 8, padding: "7px 14px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <Plus size={13} /> Nuevo
              </button>
            </div>
            {projects.map(p => (
              <div key={p.id} style={{ backgroundColor: C.card, border: `0.5px solid ${selectedProject?.id === p.id ? C.orange : C.border}`, borderRadius: 14, padding: 14, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <button onClick={() => { setSelectedProject(p); setScreen("partidas"); }} style={{ flex: 1, background: "none", border: "none", textAlign: "left", cursor: "pointer", padding: 0 }}>
                    <div style={{ fontSize: 11, color: C.orange, fontWeight: 700, marginBottom: 4 }}>#{p.code}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{p.client_name || "Sin cliente"}</div>
                    {(p.start_date || p.end_date) && <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{p.start_date && `▶ ${fmtDate(p.start_date)}`}{p.end_date && ` · 🏁 ${fmtDate(p.end_date)}`}</div>}
                    <div style={{ height: 3, background: C.border, borderRadius: 99, marginTop: 10, overflow: "hidden" }}>
                      <div style={{ width: `${p.progress_percent || 0}%`, height: "100%", background: C.orange, borderRadius: 99 }} />
                    </div>
                  </button>
                  {isAdmin && (
                    <button onClick={() => deleteProject(p.id)} style={{ width: 34, height: 34, backgroundColor: C.dangerDim, border: "none", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 10, flexShrink: 0 }}>
                      <Trash2 size={14} color={C.danger} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </>
        )}

        {/* CREAR PROYECTO */}
        {screen === "crearProyecto" && (
          <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Nuevo proyecto</div>
            {[{ val: projectCode, set: setProjectCode, ph: "Código *", key: "code" }, { val: projectName, set: setProjectName, ph: "Nombre *", key: "name" }, { val: clientName, set: setClientName, ph: "Cliente", key: "client" }].map(({ val, set, ph, key }) => (
              <input key={key} value={val} onChange={e => set(e.target.value)} placeholder={ph} style={inp} />
            ))}
            <div style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>Fecha de inicio</div>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...inp, marginBottom: 10 }} />
            <div style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>Fecha de término</div>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ ...inp, marginBottom: 16 }} />
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
                  📋 Sube el PDF de cotización MATFAU SPA. La IA extraerá las partidas automáticamente <strong style={{ color: C.text }}>sin mostrar precios</strong>.
                </div>
                <input ref={pdfInputRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={e => setPdfFile(e.target.files?.[0] || null)} />
                <button onClick={() => pdfInputRef.current?.click()} style={{ width: "100%", height: 48, backgroundColor: C.cardAlt, border: `0.5px solid ${pdfFile ? C.orange : C.border}`, borderRadius: 10, color: pdfFile ? C.orange : C.mutedSoft, cursor: "pointer", fontSize: 13, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <FileText size={16} /> {pdfFile ? `📎 ${pdfFile.name}` : "Seleccionar PDF"}
                </button>
                <button onClick={extractQuotePdf} disabled={extractingPdf || !pdfFile} style={{ width: "100%", height: 48, backgroundColor: !pdfFile ? C.cardAlt : C.orange, border: "none", borderRadius: 12, color: !pdfFile ? C.muted : "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                  {extractingPdf ? "⏳ Extrayendo con IA..." : "Extraer partidas con IA"}
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

      {/* ── GASTOS ── */}
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
                      <span>{cat.icon}</span>{cat.label}
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
                  {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.name} {cc.type === "project" ? "🏗️" : "📂"}</option>)}
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
            {(["resumen", "lista", "nubox", "centros"] as const).map(t => (
              <button key={t} onClick={() => { setGastosTab(t as typeof gastosTab); if (t === "lista" || t === "resumen") { loadExpenses(); loadNuboxSummary(); } if (t === "nubox") { loadNuboxPurchases(); loadCostCenters(); loadProjects(); } }} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", backgroundColor: gastosTab === t ? C.card : "transparent", color: gastosTab === t ? C.orange : C.muted, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>
                {t === "resumen" ? "Resumen" : t === "lista" ? "Detalle" : t === "nubox" ? "Nubox" : "Centros"}
              </button>
            ))}
          </div>

          {/* TAB: RESUMEN */}
          {gastosTab === "resumen" && (
            <>
              {/* ── SECCIÓN NUBOX ── */}
              <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>🧾 Facturas Nubox — {fmtMonth(gastosMonth)}</div>
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
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: `0.5px solid ${C.border}`, fontSize: 12 }}>
                        <span style={{ color: C.muted }}>✅ Asignadas a centros de costo</span>
                        <span style={{ fontWeight: 700, color: C.success }}>{fmtCLP(nuboxSummary.total_asignado)} ({nuboxSummary.asignadas})</span>
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

              {/* ── SECCIÓN REMUNERACIONES ── */}
              <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
                <input ref={payrollPdfRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) uploadPayrollPdf(e.target.files[0]); e.target.value = ""; }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>👥 Remuneraciones — {fmtMonth(gastosMonth)}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => payrollPdfRef.current?.click()} disabled={uploadingPayrollPdf} style={{ backgroundColor: C.infoDim, border: `0.5px solid ${C.info}`, borderRadius: 8, padding: "5px 10px", color: C.info, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>
                      {uploadingPayrollPdf ? "Leyendo..." : "📄 PDF"}
                    </button>
                    <button onClick={() => { setShowPayrollForm(true); setPayrollAmount(payroll ? String(payroll.total_amount) : ""); setPayrollNote(payroll?.note || ""); }} style={{ backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 8, padding: "5px 10px", color: C.muted, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>
                      {payroll ? "Editar" : "+ Manual"}
                    </button>
                  </div>
                </div>
                {uploadingPayrollPdf && <div style={{ fontSize: 12, color: C.info, padding: "8px 0" }}>🤖 Leyendo PDF con IA...</div>}
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

              {/* ── SECCIÓN GASTOS MANUALES ── */}
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
                          const cat = EXPENSE_CATEGORIES.find(c => c.value === row.category) || { icon: "📦", label: row.category };
                          return (
                            <div key={i} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
                              <div style={{ fontSize: 18, marginBottom: 4 }}>{cat.icon}</div>
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
                const cat = EXPENSE_CATEGORIES.find(c => c.value === exp.category) || { icon: "📦", label: exp.category };
                return (
                  <div key={exp.id} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ display: "flex", gap: 10, flex: 1, minWidth: 0 }}>
                        <div style={{ width: 38, height: 38, background: C.cardAlt, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{cat.icon}</div>
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
                  <div style={{ fontSize: 13, fontWeight: 700 }}>🏛️ Certificado SII</div>
                  {siiConfigured && <div style={{ backgroundColor: C.successDim, border: `0.5px solid ${C.success}`, borderRadius: 6, padding: "3px 10px", fontSize: 11, color: C.success, fontWeight: 700 }}>✅ Configurado</div>}
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
                  {siiP12File ? `✅ ${siiP12File.name}` : "📎 Seleccionar certificado .p12"}
                </button>
                <input type="password" value={siiPassword} onChange={e => setSiiPassword(e.target.value)} placeholder="Clave del certificado .p12" style={{ ...inp }} />
                <button onClick={uploadSiiCert} disabled={uploadingSii} style={{ ...btnPrimary, backgroundColor: siiConfigured ? C.cardAlt : C.orange, color: siiConfigured ? C.muted : "#fff" }}>{uploadingSii ? "Guardando..." : siiConfigured ? "Actualizar certificado" : "Guardar certificado SII"}</button>
              </div>

              {/* Consultar facturas */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <button onClick={loadSiiFacturas} disabled={loadingSiiFacturas} style={{ flex: 2, height: 46, backgroundColor: C.orangeDim, border: `0.5px solid ${C.orange}`, borderRadius: 10, color: C.orange, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  {loadingSiiFacturas ? "Consultando SII..." : "🔄 Consultar facturas"}
                </button>
                <button onClick={async () => {
                  try {
                    const r = await fetch(`${API_URL}/sii/diagnostico`, { headers: { Authorization: `Bearer ${token}` } });
                    const d = await r.json();
                    const msg = d.steps?.map((s: {paso: string; ok: boolean; detalle: string}) => `${s.ok ? "✅" : "❌"} ${s.paso}\n   ${s.detalle}`).join("\n") || d.error || JSON.stringify(d);
                    alert(msg);
                  } catch(e) { alert("Error de red"); }
                }} style={{ flex: 1, height: 46, backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, color: C.mutedSoft, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                  🔍 Diagnóstico
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
                    <div style={{ fontSize: 11, color: C.success, fontWeight: 600 }}>✅ Importada al módulo de gastos</div>
                  ) : (
                    <div style={{ display: "flex", gap: 8 }}>
                      <select defaultValue="" style={{ flex: 1, height: 36, backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 8, color: C.mutedSoft, fontSize: 12, padding: "0 8px" }}
                        onChange={async e => {
                          const val = e.target.value;
                          if (val) await importSiiFactura(f, val, expProjectId);
                        }}>
                        <option value="">Asignar a centro de costo...</option>
                        {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.name} {cc.type === "project" ? "🏗️" : "📂"}</option>)}
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
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <button
                  onClick={() => setNuboxShowAll(false)}
                  style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", backgroundColor: !nuboxShowAll ? C.orange : C.cardAlt, color: !nuboxShowAll ? "#fff" : C.muted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                >
                  Sin asignar
                </button>
                <button
                  onClick={() => setNuboxShowAll(true)}
                  style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", backgroundColor: nuboxShowAll ? C.orange : C.cardAlt, color: nuboxShowAll ? "#fff" : C.muted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                >
                  Todas
                </button>
                <button onClick={loadNuboxPurchases} disabled={nuboxLoading} style={{ backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 8, padding: "7px 12px", color: C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  ↻
                </button>
              </div>
              {nuboxLoading && <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Cargando facturas Nubox...</div>}
              {nuboxError && (
                <div style={{ backgroundColor: C.dangerDim, border: `0.5px solid ${C.danger}`, borderRadius: 12, padding: 14, marginBottom: 12, color: C.danger, fontSize: 13 }}>
                  ❌ {nuboxError}
                </div>
              )}
              {!nuboxLoading && !nuboxError && (() => {
                const filtered = nuboxShowAll ? nuboxPurchases : nuboxPurchases.filter(p => !p.assigned?.project_id);
                if (filtered.length === 0) return (
                  <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>
                    {nuboxShowAll ? `Sin facturas en ${fmtMonth(gastosMonth)}` : "✅ Todas las facturas están asignadas"}
                  </div>
                );
                return filtered.map(p => {
                  const isAssigned = !!p.assigned?.project_id;
                  const assignedCC = costCenters.find(cc => cc.project_id === p.assigned?.project_id);
                  const selectedCC = nuboxSelectedProject[p.id] || "";
                  return (
                    <div key={p.id} style={{ backgroundColor: C.card, border: `0.5px solid ${isAssigned ? C.success : C.border}`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{p.supplier?.tradeName || "Proveedor"}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{p.supplier?.identification?.value} · N°{p.number} · {p.emissionDate?.slice(0, 10)}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{p.type?.abbreviation}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{fmtCLP(p.totalAmount)}</div>
                          <div style={{ fontSize: 10, color: C.muted }}>Neto {fmtCLP(p.totalNetAmount)}</div>
                        </div>
                      </div>
                      {isAssigned && (
                        <div style={{ fontSize: 11, color: C.success, fontWeight: 600, marginBottom: 6 }}>
                          ✅ {assignedCC?.name || p.assigned.project_name || "Asignado"}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <select
                          value={selectedCC}
                          onChange={e => setNuboxSelectedProject(prev => ({ ...prev, [p.id]: e.target.value }))}
                          style={{ flex: 1, height: 36, borderRadius: 8, border: `0.5px solid ${C.border}`, backgroundColor: C.cardAlt, color: C.text, fontSize: 12, padding: "0 8px" }}
                        >
                          <option value="">— Seleccionar centro de costo —</option>
                          {costCenters.filter(cc => cc.project_id).length > 0 && (
                            <optgroup label="🏗️ Proyectos">
                              {costCenters.filter(cc => cc.project_id).map(cc => (
                                <option key={cc.id} value={cc.project_id!}>{cc.code ? `[${cc.code}] ` : ""}{cc.name}</option>
                              ))}
                            </optgroup>
                          )}
                          {costCenters.filter(cc => !cc.project_id).length > 0 && (
                            <optgroup label="📂 Otros centros">
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
                  );
                });
              })()}
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
                <div key={cc.id} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 12, marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, background: cc.type === "project" ? C.orangeDim : C.infoDim, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{cc.type === "project" ? "🏗️" : "📂"}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{cc.name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{cc.type === "project" ? `Proyecto · ${cc.project_name}` : "Manual"}{cc.code ? ` · #${cc.code}` : ""}</div>
                  </div>
                  {cc.type === "manual" && <button onClick={async () => { if (!confirm("¿Eliminar?")) return; await fetch(`${API_URL}/cost-centers/${cc.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); loadCostCenters(); }} style={{ backgroundColor: C.dangerDim, border: "none", borderRadius: 6, padding: "4px 10px", color: C.danger, fontSize: 11, cursor: "pointer" }}>✕</button>}
                </div>
              ))}
            </>
          )}
        </>
      )}

      {/* Nav inferior */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, backgroundColor: C.card, borderTop: `0.5px solid ${C.border}`, display: "flex", padding: "6px 0 14px", zIndex: 100 }}>
        {([
          { sc: "home" as Screen, icon: <Home size={19} />, label: "Inicio" },
          { sc: "proyectos" as Screen, icon: <FolderOpen size={19} />, label: "Proyectos" },
          { sc: "crearProyecto" as Screen, icon: null, label: "Crear" },
          ...(canSeeGastos ? [{ sc: "gastos" as Screen, icon: <DollarSign size={19} />, label: "Gastos" }] : []),
          ...(isAdmin ? [{ sc: "admin" as Screen, icon: <Shield size={19} />, label: "Admin" }] : []),
          { sc: "configuracion" as Screen, icon: <Av name={userName} size={20} />, label: "Perfil" },
        ] as { sc: Screen; icon: React.ReactNode; label: string }[]).map(({ sc, icon, label }) => {
          const active = screen === sc || (sc === "home" && (screen === "partidas" || screen === "fotos"));
          const isCreate = sc === "crearProyecto";
          return (
            <button key={sc} onClick={() => { setScreen(sc); if (sc === "gastos") { setGastosTab("resumen"); setExpenseSummary(null); setNuboxSummary(null); loadCostCenters(); loadExpenses(); loadNuboxSummary(); } }} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", color: active ? C.orange : C.muted, padding: "2px 0" }}>
              {isCreate ? (
                <div style={{ width: 42, height: 42, background: C.orange, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginTop: -18, boxShadow: `0 0 0 4px ${C.card}` }}>
                  <Plus size={19} color="#fff" />
                </div>
              ) : icon}
              <span style={{ fontSize: 9, fontWeight: 600 }}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
