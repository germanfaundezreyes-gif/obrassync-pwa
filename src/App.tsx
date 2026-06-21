import React, { useState, useEffect, useRef } from "react";
import { Camera, LogOut, Mail, Lock, Trash2, FileText, Plus, ChevronLeft, FolderOpen, Home, Shield, Eye, EyeOff, Bell, Image, MessageSquare } from "lucide-react";

const API_URL = "https://obrassync-backend-production.up.railway.app";

const C = {
  bg: "#0F0F10", card: "#171717", cardAlt: "#1D1D1D", border: "#2A2A2A",
  text: "#FFFFFF", muted: "#555555", mutedSoft: "#888888",
  orange: "#FF8A00", orangeSoft: "#FDBA74", orangeDim: "#1A0F00",
  success: "#22C55E", successDim: "#0D1A0D", danger: "#EF4444", dangerDim: "#1A0D0D",
  info: "#3B82F6", infoDim: "#0D0D1A", purple: "#A855F7", purpleDim: "#150D1A",
};

type Screen = "home" | "proyectos" | "crearProyecto" | "fotos" | "admin" | "editarUsuario" | "crearUsuario" | "partidas" | "configuracion";
type Project = { id: string; code: string; name: string; client_name?: string; start_date?: string; end_date?: string; progress_percent?: number };
type Task = { id: string; name: string; duration?: string; start_date?: string; end_date?: string; progress_percent?: number; status?: string; photo_count?: number };
type TaskPhoto = { id: string; filename: string; local_path?: string; onedrive_url?: string; created_at: string; description?: string };
type QuoteItem = { tempId: string; name: string; codigo: string; quantity: string; unit: string; start_date: string; end_date: string; selected: boolean };
type User = { id: string; full_name: string; email: string; role: string; is_active: boolean; permissions?: Record<string, boolean> };

const PERMISSIONS = [
  { key: "photos", label: "Fotos", sub: "Subir y ver fotos", icon: "📷" },
  { key: "projects", label: "Proyectos", sub: "Ver lista de proyectos", icon: "📁" },
  { key: "reports", label: "Informes", sub: "Generar Word", icon: "📄" },
  { key: "admin", label: "Administración", sub: "Gestionar usuarios", icon: "👤" },
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
  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
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

  // Photo description
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [photoDescInput, setPhotoDescInput] = useState("");
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [editingPhotoDesc, setEditingPhotoDesc] = useState("");
  const [savingPhotoDesc, setSavingPhotoDesc] = useState(false);

  const isAdmin = userRole === "administrador" || userRole === "admin";

  useEffect(() => { if (token) { loadProjects(); if (isAdmin) loadUsers(); } }, [token]);
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
      setToken(d.token); setUserName(d.user?.fullName || "Usuario"); setUserRole(d.user?.role || "");
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
      const r = await fetch(`${API_URL}/tasks/${editingTask.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: taskStatus, progressPercent: taskProgress, name: taskName }) });
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
      const fd = new FormData(); fd.append("photo", file); fd.append("description", description);
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
  const totalPhotos = tasks.reduce((a, t) => a + (t.photo_count || 0), 0);
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
            <input value={taskName} onChange={e => setTaskName(e.target.value)} placeholder="Nombre" style={inp} />
            <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Estado</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              {STATUS_OPTIONS.map(s => (
                <button key={s.value} onClick={() => setTaskStatus(s.value)} style={{ padding: "10px 8px", borderRadius: 10, border: `0.5px solid ${taskStatus === s.value ? C.orange : C.border}`, background: taskStatus === s.value ? C.orangeDim : C.cardAlt, color: taskStatus === s.value ? C.orange : C.muted, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                  {s.label}
                </button>
              ))}
            </div>
            <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Avance: {taskProgress}%</div>
            <input type="range" min={0} max={100} value={taskProgress} onChange={e => setTaskProgress(Number(e.target.value))} style={{ width: "100%", marginBottom: 16, accentColor: C.orange }} />
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
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Describir foto</div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>¿Qué trabajo muestra esta foto?</div>
                  <textarea value={photoDescInput} onChange={e => setPhotoDescInput(e.target.value)} placeholder="Ej: Instalación de pilar metálico en eje A-3, nivel 1..." rows={3} style={{ width: "100%", backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 14, padding: 12, resize: "none", boxSizing: "border-box", outline: "none", marginBottom: 12 }} />
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => { setPendingPhotoFile(null); setPhotoDescInput(""); }} style={{ flex: 1, height: 46, background: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 12, color: C.muted, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
                    <button onClick={() => { uploadPhotoWithDesc(pendingPhotoFile, photoDescInput); setPendingPhotoFile(null); setPhotoDescInput(""); }} disabled={uploadingPhoto} style={{ flex: 2, height: 46, background: C.orange, border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, cursor: "pointer" }}>{uploadingPhoto ? "Subiendo..." : "Subir foto"}</button>
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
                : photos.map((photo, idx) => (
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
          </div>
        )}

        {/* HOME */}
        {screen === "home" && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>Hola, {userName.split(" ")[0]} 👋</div>
              <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Aquí tienes el resumen de tus proyectos</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              {[
                { icon: "📁", label: "Proyectos activos", value: projects.length, color: C.orange, bg: C.orangeDim },
                { icon: "📋", label: "Partidas pendientes", value: tasks.filter(t => t.status === "pendiente").length, color: C.info, bg: C.infoDim },
                { icon: "👷", label: "Usuarios activos", value: users.filter(u => u.is_active).length, color: C.purple, bg: C.purpleDim },
                { icon: "📷", label: "Fotos subidas", value: totalPhotos, color: C.success, bg: C.successDim },
              ].map(({ icon, label, value, color, bg }) => (
                <div key={label} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
                  <div style={{ width: 34, height: 34, background: bg, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, marginBottom: 10 }}>{icon}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
                  <div style={{ fontSize: 11, color: C.orange, marginTop: 4 }}>Ver todos →</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Proyectos activos</div>
              <div onClick={() => setScreen("proyectos")} style={{ fontSize: 12, color: C.orange, cursor: "pointer" }}>Ver todos →</div>
            </div>
            {projects.slice(0, 4).map(p => (
              <div key={p.id} onClick={() => { setSelectedProject(p); setScreen("partidas"); }} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 46, height: 46, background: C.cardAlt, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🏗️</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>#{p.code} · <span style={{ color: C.success }}>En ejecución</span></div>
                  <div style={{ height: 3, background: C.border, borderRadius: 99, marginTop: 8, overflow: "hidden" }}>
                    <div style={{ width: `${p.progress_percent || 0}%`, height: "100%", background: C.orange, borderRadius: 99 }} />
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.orange }}>{Number(p.progress_percent || 0).toFixed(0)}%</div>
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
              <button onClick={generateReport} disabled={generatingReport} style={{ flex: 1, height: 44, backgroundColor: "#0D1A2E", border: `0.5px solid ${C.info}50`, borderRadius: 10, color: C.info, fontWeight: 600, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <FileText size={15} /> {generatingReport ? "Generando..." : "Informe Word"}
              </button>
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
                        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, marginBottom: 6 }}>{task.name}</div>
                        <Badge status={task.status} />
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={() => openPhotos(task)} style={{ width: 38, height: 38, backgroundColor: C.orangeDim, border: `0.5px solid ${C.orange}30`, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                          <Camera size={15} color={C.orange} />
                          {(task.photo_count ?? 0) > 0 && (
                            <span style={{ position: "absolute", top: -4, right: -4, backgroundColor: C.orange, color: "#fff", fontSize: 9, fontWeight: 800, width: 16, height: 16, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>{task.photo_count}</span>
                          )}
                        </button>
                        <button onClick={() => { setEditingTask(task); setTaskStatus(task.status || "pendiente"); setTaskProgress(Number(task.progress_percent || 0)); setTaskName(task.name || ""); }} style={{ width: 38, height: 38, backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>✏️</button>
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
                    {(p.start_date || p.end_date) && <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{p.start_date && `▶ ${p.start_date}`}{p.end_date && ` · ⬛ ${p.end_date}`}</div>}
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

      {/* Nav inferior */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, backgroundColor: C.card, borderTop: `0.5px solid ${C.border}`, display: "flex", padding: "8px 0 16px", zIndex: 100 }}>
        {([
          { sc: "home" as Screen, icon: <Home size={22} />, label: "Inicio" },
          { sc: "proyectos" as Screen, icon: <FolderOpen size={22} />, label: "Proyectos" },
          { sc: "crearProyecto" as Screen, icon: null, label: "Crear" },
          ...(isAdmin ? [{ sc: "admin" as Screen, icon: <Shield size={22} />, label: "Admin" }] : []),
          { sc: "configuracion" as Screen, icon: <Av name={userName} size={24} />, label: "Perfil" },
        ] as { sc: Screen; icon: React.ReactNode; label: string }[]).map(({ sc, icon, label }) => {
          const active = screen === sc || (sc === "home" && screen === "partidas");
          const isCreate = sc === "crearProyecto";
          return (
            <button key={sc} onClick={() => setScreen(sc)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", color: active ? C.orange : C.muted }}>
              {isCreate ? (
                <div style={{ width: 48, height: 48, background: C.orange, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginTop: -20, boxShadow: `0 0 0 4px ${C.card}` }}>
                  <Plus size={22} color="#fff" />
                </div>
              ) : icon}
              <span style={{ fontSize: 10, fontWeight: 600 }}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
