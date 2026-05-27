import React, { useState, useEffect, useRef } from "react";
import { Camera, LogOut, Mail, Lock, Trash2, FileText, Plus, ChevronLeft, FolderOpen, Home, Shield, Eye, EyeOff, Bell, Filter, Upload, CheckCircle, Clock, AlertCircle, Image } from "lucide-react";

const API_URL = "https://obrassync-backend-production.up.railway.app";

const C = {
  bg: "#0F0F10",
  card: "#171717",
  cardAlt: "#1D1D1D",
  border: "#2A2A2A",
  text: "#FFFFFF",
  muted: "#555555",
  mutedSoft: "#888888",
  orange: "#FF8A00",
  orangeSoft: "#FDBA74",
  orangeDim: "#1A0F00",
  success: "#22C55E",
  successDim: "#0D1A0D",
  danger: "#EF4444",
  dangerDim: "#1A0D0D",
  info: "#3B82F6",
  infoDim: "#0D0D1A",
  purple: "#A855F7",
  purpleDim: "#150D1A",
};

type Screen = "home" | "proyectos" | "crearProyecto" | "fotos" | "admin" | "editarUsuario" | "crearUsuario" | "partidas" | "configuracion";
type Project = { id: string; code: string; name: string; client_name?: string; start_date?: string; end_date?: string; progress_percent?: number };
type Task = { id: string; name: string; duration?: string; start_date?: string; end_date?: string; progress_percent?: number; status?: string; photo_count?: number };
type TaskPhoto = { id: string; filename: string; local_path?: string; onedrive_url?: string; created_at: string };
type User = { id: string; full_name: string; email: string; role: string; is_active: boolean; permissions?: Record<string, boolean> };

const PERMISSIONS = [
  { key: "photos", label: "Fotos", sub: "Subir y ver fotos", icon: "📷" },
  { key: "projects", label: "Proyectos", sub: "Ver lista de proyectos", icon: "📁" },
  { key: "reports", label: "Informes", sub: "Generar Word", icon: "📄" },
  { key: "admin", label: "Administración", sub: "Gestionar usuarios", icon: "👤" },
];

const ROLES = [
  { value: "administrador", label: "Admin", icon: "👑", color: C.orange, bg: C.orangeDim, border: "#3A1F00" },
  { value: "jefe_obra", label: "Jefe obra", icon: "🦺", color: C.info, bg: C.infoDim, border: "#0D1A3A" },
  { value: "inspector", label: "Trabajador", icon: "👷", color: C.success, bg: C.successDim, border: "#0D3A0D" },
];

const STATUS_OPTIONS = [
  { value: "pendiente", label: "Pendiente", color: C.mutedSoft, bg: C.cardAlt, icon: Clock },
  { value: "en_curso", label: "En progreso", color: C.info, bg: C.infoDim, icon: AlertCircle },
  { value: "completada", label: "Completada", color: C.success, bg: C.successDim, icon: CheckCircle },
  { value: "atrasada", label: "Atrasada", color: C.danger, bg: C.dangerDim, icon: AlertCircle },
];

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div onClick={onToggle} style={{ width: 44, height: 24, borderRadius: 12, background: on ? C.success : "#333", position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 0.2s" }}>
      <div style={{ width: 20, height: 20, background: "#fff", borderRadius: "50%", position: "absolute", top: 2, left: on ? 22 : 2, transition: "left 0.2s" }} />
    </div>
  );
}

function Avatar({ name, role, size = 36 }: { name: string; role?: string; size?: number }) {
  const initials = name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
  const r = role ? (ROLES.find(r => r.value === role) || ROLES[2]) : null;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: r ? r.bg : C.orangeDim, border: `1px solid ${r ? r.border : "#3A1F00"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, color: r ? r.color : C.orange, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const st = STATUS_OPTIONS.find(s => s.value === (status || "pendiente")) || STATUS_OPTIONS[0];
  return (
    <span style={{ backgroundColor: st.bg, color: st.color, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
      {st.label}
    </span>
  );
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

  const isAdmin = userRole === "administrador" || userRole === "admin";

  useEffect(() => { if (token) { loadProjects(); if (isAdmin) loadUsers(); } }, [token]);
  useEffect(() => { if (selectedProject && token) loadTasks(selectedProject.id); }, [selectedProject]);

  async function handleLogin() {
    if (!email || !password) return;
    setLoginLoading(true);
    try {
      const r = await fetch(`${API_URL}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Credenciales inválidas"); return; }
      setToken(d.token);
      setUserName(d.user?.fullName || "Usuario");
      setUserRole(d.user?.role || "");
    } catch { alert("No se pudo conectar al servidor"); }
    finally { setLoginLoading(false); }
  }

  async function loadProjects() {
    try {
      const r = await fetch(`${API_URL}/projects`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setProjects(d.items || []);
    } catch { }
  }

  async function createProject() {
    if (!projectCode || !projectName) { alert("Código y nombre son obligatorios"); return; }
    setCreatingProject(true);
    try {
      const r = await fetch(`${API_URL}/projects`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ code: projectCode, name: projectName, clientName, startDate: startDate || null, endDate: endDate || null }) });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error creando proyecto"); return; }
      setProjectCode(""); setProjectName(""); setClientName(""); setStartDate(""); setEndDate("");
      await loadProjects();
      setScreen("proyectos");
    } catch { alert("Error creando proyecto"); }
    finally { setCreatingProject(false); }
  }

  async function deleteProject(id: string) {
    if (!confirm("¿Eliminar este proyecto?")) return;
    try {
      await fetch(`${API_URL}/projects/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (selectedProject?.id === id) { setSelectedProject(null); setTasks([]); }
      await loadProjects();
    } catch { alert("Error eliminando proyecto"); }
  }

  async function loadTasks(projectId: string) {
    setTasksLoading(true);
    try {
      const r = await fetch(`${API_URL}/projects/${projectId}/tasks`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setTasks(d.items || []);
    } catch { } finally { setTasksLoading(false); }
  }

  async function uploadGantt() {
    if (!ganttFile || !selectedProject) { alert("Selecciona un proyecto y un archivo Excel"); return; }
    setUploadingGantt(true);
    try {
      const formData = new FormData();
      formData.append("file", ganttFile);
      const r = await fetch(`${API_URL}/projects/${selectedProject.id}/gantt/import-excel`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error importando"); return; }
      setTasks(d.tasks || []);
      setGanttFile(null);
      alert(`✅ ${d.tasks?.length || 0} partidas importadas`);
    } catch { alert("Error importando archivo"); }
    finally { setUploadingGantt(false); }
  }

  async function saveTask() {
    if (!editingTask || !selectedProject) return;
    setSavingTask(true);
    try {
      const r = await fetch(`${API_URL}/tasks/${editingTask.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: taskStatus, progressPercent: taskProgress, name: taskName }) });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert("Error guardando partida"); return; }
      setEditingTask(null);
      await loadTasks(selectedProject.id);
    } catch { alert("Error guardando partida"); }
    finally { setSavingTask(false); }
  }

  async function deleteTask(taskId: string) {
    if (!confirm("¿Eliminar esta partida?")) return;
    try {
      await fetch(`${API_URL}/tasks/${taskId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      setEditingTask(null);
      if (selectedProject) await loadTasks(selectedProject.id);
    } catch { alert("Error eliminando partida"); }
  }

  async function openPhotos(task: Task) {
    setSelectedTask(task);
    setScreen("fotos");
    setPhotosLoading(true);
    try {
      const r = await fetch(`${API_URL}/tasks/${task.id}/photos`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setPhotos(d.items || []);
    } catch { } finally { setPhotosLoading(false); }
  }

  async function uploadPhoto(file: File) {
    if (!selectedTask) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const r = await fetch(`${API_URL}/tasks/${selectedTask.id}/photos`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error subiendo foto"); return; }
      const r2 = await fetch(`${API_URL}/tasks/${selectedTask.id}/photos`, { headers: { Authorization: `Bearer ${token}` } });
      const d2 = await r2.json();
      setPhotos(d2.items || []);
    } catch { alert("Error subiendo foto"); }
    finally { setUploadingPhoto(false); }
  }

  async function deletePhoto(photoId: string) {
    if (!confirm("¿Eliminar esta foto?")) return;
    try {
      await fetch(`${API_URL}/photos/${photoId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      setPhotos(p => p.filter(x => x.id !== photoId));
    } catch { alert("Error eliminando foto"); }
  }

  async function generateReport() {
    if (!selectedProject) { alert("Selecciona un proyecto primero"); return; }
    setGeneratingReport(true);
    try {
      const r = await fetch(`${API_URL}/projects/${selectedProject.id}/reports/generate-word`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) { const d = await r.json(); alert(d.message || "Error generando informe"); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Informe_${selectedProject.name.replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/ /g, "_")}_${new Date().toLocaleDateString("es-CL").replace(/\//g, "-")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert("Error generando informe"); }
    finally { setGeneratingReport(false); }
  }

  async function uploadLogo() {
    if (!logoFile) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("logo", logoFile);
      const r = await fetch(`${API_URL}/company/logo`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error subiendo logo"); return; }
      alert("✅ Logo subido correctamente. Aparecerá en los informes Word.");
      setLogoFile(null);
    } catch { alert("Error subiendo logo"); }
    finally { setUploadingLogo(false); }
  }

  async function loadUsers() {
    try {
      const r = await fetch(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setUsers(d.items || []);
    } catch { }
  }

  function openEditUser(user: User) {
    setEditingUser(user);
    setEditName(user.full_name);
    setEditEmail(user.email);
    setEditPassword("");
    setEditRole(user.role);
    setEditActive(user.is_active);
    setEditPermissions(user.permissions || {});
    setScreen("editarUsuario");
  }

  async function saveUser() {
    if (!editingUser) return;
    setSavingUser(true);
    try {
      const r = await fetch(`${API_URL}/users/${editingUser.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ fullName: editName, email: editEmail, password: editPassword || undefined, role: editRole, isActive: editActive, permissions: editPermissions }) });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error guardando"); return; }
      await loadUsers();
      setScreen("admin");
    } catch { alert("Error guardando usuario"); }
    finally { setSavingUser(false); }
  }

  async function deleteUser(userId: string) {
    if (!confirm("¿Eliminar este usuario?")) return;
    try {
      await fetch(`${API_URL}/users/${userId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      await loadUsers();
      setScreen("admin");
    } catch { alert("Error eliminando usuario"); }
  }

  async function createUser() {
    if (!newUserName || !newUserEmail || !newUserPassword) { alert("Nombre, correo y contraseña son obligatorios"); return; }
    setCreatingUser(true);
    try {
      const r = await fetch(`${API_URL}/users`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ fullName: newUserName, email: newUserEmail, password: newUserPassword, role: newUserRole, permissions: newUserPermissions }) });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error creando usuario"); return; }
      setNewUserName(""); setNewUserEmail(""); setNewUserPassword(""); setNewUserRole("inspector"); setNewUserPermissions({ photos: true });
      await loadUsers();
      setScreen("admin");
    } catch { alert("Error creando usuario"); }
    finally { setCreatingUser(false); }
  }

  const progress = tasks.length > 0 ? tasks.reduce((a, t) => a + Number(t.progress_percent || 0), 0) / tasks.length : 0;
  const atrasadas = tasks.filter(t => t.status === "atrasada").length;
  const completadas = tasks.filter(t => t.status === "completada").length;
  const enCurso = tasks.filter(t => t.status === "en_curso").length;
  const totalPhotos = tasks.reduce((a, t) => a + (t.photo_count || 0), 0);

  const filteredTasks = taskFilter === "todos" ? tasks :
    taskFilter === "en_curso" ? tasks.filter(t => t.status === "en_curso") :
    taskFilter === "completada" ? tasks.filter(t => t.status === "completada") :
    tasks.filter(t => t.status === "pendiente" || t.status === "atrasada");

  const inp = { width: "100%", height: 48, backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 14, padding: "0 14px", marginBottom: 10, boxSizing: "border-box" as const, outline: "none" };
  const btn = { width: "100%", height: 50, backgroundColor: C.orange, border: "none", borderRadius: 12, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" };

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
        <button onClick={handleLogin} disabled={loginLoading} style={btn}>
          {loginLoading ? "Ingresando..." : "Ingresar"}
        </button>
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
            <input value={taskName} onChange={e => setTaskName(e.target.value)} placeholder="Nombre de la partida" style={{ ...inp, marginBottom: 12 }} />
            <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: 1 }}>Estado</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              {STATUS_OPTIONS.map(s => (
                <button key={s.value} onClick={() => setTaskStatus(s.value)} style={{ padding: "10px 8px", borderRadius: 10, border: `0.5px solid ${taskStatus === s.value ? C.orange : C.border}`, background: taskStatus === s.value ? C.orangeDim : C.cardAlt, color: taskStatus === s.value ? C.orange : C.muted, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                  {s.label}
                </button>
              ))}
            </div>
            <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: 1 }}>Avance: {taskProgress}%</div>
            <input type="range" min={0} max={100} value={taskProgress} onChange={e => setTaskProgress(Number(e.target.value))} style={{ width: "100%", marginBottom: 16, accentColor: C.orange }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setEditingTask(null)} style={{ flex: 1, height: 46, background: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 12, color: C.muted, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button onClick={saveTask} disabled={savingTask} style={{ flex: 2, height: 46, background: C.orange, border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                {savingTask ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, backgroundColor: C.bg, borderBottom: `0.5px solid ${C.border}`, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {(screen === "fotos" || screen === "editarUsuario" || screen === "crearUsuario" || screen === "partidas" || screen === "crearProyecto") && (
            <button onClick={() => setScreen(screen === "fotos" ? "partidas" : screen === "partidas" ? "home" : screen === "crearProyecto" ? "proyectos" : "admin")} style={{ background: "none", border: "none", color: C.orange, cursor: "pointer", padding: 0, display: "flex" }}>
              <ChevronLeft size={24} />
            </button>
          )}
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>Obras<span style={{ color: C.orange }}>Sync</span></div>
            {selectedProject && ["home", "partidas", "fotos"].includes(screen) && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{selectedProject.name}</div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative", width: 34, height: 34, background: C.card, border: `0.5px solid ${C.border}`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Bell size={16} color={C.muted} />
          </div>
          <div onClick={() => setScreen("configuracion")} style={{ cursor: "pointer" }}>
            <Avatar name={userName} size={34} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: 16 }}>

        {/* Fotos */}
        {screen === "fotos" && selectedTask && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Fotos</div>
              <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{selectedTask.name}</div>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }} />
              <input ref={photoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }} />
              <button onClick={() => cameraInputRef.current?.click()} disabled={uploadingPhoto} style={{ flex: 1, height: 46, backgroundColor: C.orange, border: "none", borderRadius: 10, color: "#fff", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 14 }}>
                <Camera size={16} /> {uploadingPhoto ? "Subiendo..." : "Tomar foto"}
              </button>
              <button onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto} style={{ flex: 1, height: 46, backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, color: C.mutedSoft, fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
                Galería
              </button>
            </div>
            {photosLoading ? <div style={{ color: C.muted, textAlign: "center", padding: 32 }}>Cargando...</div>
              : photos.length === 0 ? (
                <div style={{ textAlign: "center", padding: 48, color: C.muted }}>
                  <Camera size={40} color={C.border} style={{ margin: "0 auto 12px", display: "block" }} />
                  <div>Sin fotos todavía</div>
                </div>
              ) : photos.map(photo => (
                <div key={photo.id} style={{ display: "flex", alignItems: "center", gap: 12, backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 12, marginBottom: 8 }}>
                  <img src={`${API_URL}${photo.local_path}`} alt={photo.filename} style={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover", backgroundColor: C.border }} />
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{photo.filename}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{new Date(photo.created_at).toLocaleString("es-CL")}</div>
                    {photo.onedrive_url && <div style={{ fontSize: 11, color: C.info, marginTop: 2 }}>☁️ OneDrive</div>}
                  </div>
                  <button onClick={() => deletePhoto(photo.id)} style={{ width: 34, height: 34, backgroundColor: C.dangerDim, border: "none", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Trash2 size={14} color={C.danger} />
                  </button>
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

            {selectedProject && (
              <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Informe fotográfico</div>
                <button onClick={generateReport} disabled={generatingReport} style={{ width: "100%", height: 44, backgroundColor: "#0D1A2E", border: `0.5px solid ${C.info}30`, borderRadius: 10, color: C.info, fontWeight: 600, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <FileText size={15} /> {generatingReport ? "Generando..." : "Descargar informe Word"}
                </button>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Proyectos activos</div>
              <div onClick={() => setScreen("proyectos")} style={{ fontSize: 12, color: C.orange, cursor: "pointer" }}>Ver todos →</div>
            </div>

            {projects.slice(0, 3).map(p => (
              <div key={p.id} onClick={() => { setSelectedProject(p); setScreen("partidas"); }} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 46, height: 46, background: C.cardAlt, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🏗️</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Proyecto #{p.code} · <span style={{ color: C.success }}>En ejecución</span></div>
                  <div style={{ height: 3, background: C.border, borderRadius: 99, marginTop: 8, overflow: "hidden" }}>
                    <div style={{ width: `${p.progress_percent || 0}%`, height: "100%", background: C.orange, borderRadius: 99 }} />
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.orange }}>{Number(p.progress_percent || 0).toFixed(0)}%</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>partidas</div>
                </div>
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, marginTop: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Importar carta Gantt</div>
            </div>
            <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
              {!selectedProject && <div style={{ backgroundColor: "#1A1200", border: `0.5px solid #5C4500`, borderRadius: 8, padding: 10, marginBottom: 12, color: "#FCD34D", fontSize: 12 }}>⚠️ Selecciona un proyecto primero</div>}
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={e => setGanttFile(e.target.files?.[0] || null)} />
              <button onClick={() => fileInputRef.current?.click()} style={{ width: "100%", height: 44, backgroundColor: C.cardAlt, border: `0.5px solid ${ganttFile ? C.orange : C.border}`, borderRadius: 10, color: ganttFile ? C.orange : C.mutedSoft, cursor: "pointer", fontSize: 13, marginBottom: 8 }}>
                {ganttFile ? `📎 ${ganttFile.name}` : "Seleccionar archivo .xlsx"}
              </button>
              <button onClick={uploadGantt} disabled={uploadingGantt || !ganttFile || !selectedProject} style={{ width: "100%", height: 44, backgroundColor: (!ganttFile || !selectedProject) ? C.cardAlt : C.orange, border: "none", borderRadius: 10, color: (!ganttFile || !selectedProject) ? C.muted : "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                {uploadingGantt ? "Importando..." : "Importar partidas"}
              </button>
            </div>
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
                { label: "Completadas", value: completadas, color: C.success },
                { label: "Atrasadas", value: atrasadas, color: C.danger },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto" as const, paddingBottom: 4 }}>
              {[
                { value: "todos", label: "Todas" },
                { value: "en_curso", label: "En progreso" },
                { value: "completada", label: "Completadas" },
                { value: "pendiente", label: "Pendientes" },
              ].map(f => (
                <button key={f.value} onClick={() => setTaskFilter(f.value)} style={{ padding: "6px 14px", borderRadius: 20, border: `0.5px solid ${taskFilter === f.value ? C.orange : C.border}`, background: taskFilter === f.value ? C.orangeDim : C.card, color: taskFilter === f.value ? C.orange : C.muted, fontWeight: 600, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" as const, flexShrink: 0 }}>
                  {f.label}
                </button>
              ))}
            </div>

            {tasksLoading ? <div style={{ color: C.muted, textAlign: "center", padding: 32 }}>Cargando partidas...</div>
              : filteredTasks.map((task, i) => {
                const isLate = task.status === "atrasada";
                const barColor = task.status === "completada" ? C.success : isLate ? C.danger : task.status === "en_curso" ? C.info : C.border;
                return (
                  <div key={task.id || i} style={{ backgroundColor: C.card, border: `0.5px solid ${isLate ? C.dangerDim : C.border}`, borderRadius: 14, padding: 14, marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{task.name}</div>
                        <div style={{ marginTop: 6 }}>
                          <StatusBadge status={task.status} />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={() => openPhotos(task)} style={{ width: 38, height: 38, backgroundColor: C.orangeDim, border: `0.5px solid ${C.orange}30`, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                          <Camera size={15} color={C.orange} />
                          {(task.photo_count ?? 0) > 0 && (
                            <span style={{ position: "absolute", top: -4, right: -4, backgroundColor: C.orange, color: "#fff", fontSize: 9, fontWeight: 800, width: 16, height: 16, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>{task.photo_count}</span>
                          )}
                        </button>
                        <button onClick={() => { setEditingTask(task); setTaskStatus(task.status || "pendiente"); setTaskProgress(Number(task.progress_percent || 0)); setTaskName(task.name || ""); }} style={{ width: 38, height: 38, backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
                          ✏️
                        </button>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const, marginBottom: 8 }}>
                      {task.duration && <span style={{ fontSize: 11, color: C.muted }}>⏱ {task.duration}</span>}
                      {task.start_date && <span style={{ fontSize: 11, color: C.muted }}>▶ {task.start_date}</span>}
                      {task.end_date && <span style={{ fontSize: 11, color: isLate ? C.danger : C.muted }}>⬛ {task.end_date}</span>}
                    </div>
                    <div style={{ height: 4, background: C.cardAlt, borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ width: `${task.progress_percent || 0}%`, height: "100%", background: barColor, borderRadius: 99 }} />
                    </div>
                    {Number(task.progress_percent) > 0 && (
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 4, textAlign: "right" as const }}>{task.progress_percent}%</div>
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
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: C.orange, fontWeight: 700 }}>#{p.code}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{p.client_name || "Sin cliente"}</div>
                    {(p.start_date || p.end_date) && (
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
                        {p.start_date && `▶ ${p.start_date}`}{p.end_date && ` · ⬛ ${p.end_date}`}
                      </div>
                    )}
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
            {[
              { val: projectCode, set: setProjectCode, ph: "Código *", key: "code" },
              { val: projectName, set: setProjectName, ph: "Nombre *", key: "name" },
              { val: clientName, set: setClientName, ph: "Cliente", key: "client" },
            ].map(({ val, set, ph, key }) => (
              <input key={key} value={val} onChange={e => set(e.target.value)} placeholder={ph} style={inp} />
            ))}
            <div style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>Fecha de inicio</div>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...inp, marginBottom: 10 }} />
            <div style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>Fecha de término</div>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ ...inp, marginBottom: 16 }} />
            <button onClick={createProject} disabled={creatingProject} style={btn}>
              {creatingProject ? "Creando..." : "Crear proyecto"}
            </button>
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
              {[
                { label: "Total", value: users.length, color: C.text },
                { label: "Activos", value: users.filter(u => u.is_active).length, color: C.success },
                { label: "Inactivos", value: users.filter(u => !u.is_active).length, color: C.danger },
              ].map(({ label, value, color }) => (
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
                    <Avatar name={user.full_name} role={user.role} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{user.full_name}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{user.email}</div>
                    </div>
                    <Toggle on={user.is_active} onToggle={async () => {
                      await fetch(`${API_URL}/users/${user.id}/toggle`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
                      await loadUsers();
                    }} />
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
              <button onClick={() => deleteUser(editingUser.id)} style={{ backgroundColor: C.dangerDim, border: "none", borderRadius: 8, padding: "5px 12px", color: C.danger, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Eliminar
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16 }}>
              <Avatar name={editingUser.full_name} role={editRole} size={52} />
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 8 }}>{editingUser.full_name}</div>
            </div>
            {[
              { val: editName, set: setEditName, ph: "Nombre completo" },
              { val: editEmail, set: setEditEmail, ph: "Correo" },
            ].map(({ val, set, ph }, i) => (
              <input key={i} value={val} onChange={e => set(e.target.value)} placeholder={ph} style={inp} />
            ))}
            <input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="Nueva contraseña (opcional)" style={{ ...inp, marginBottom: 14 }} />
            <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: 1 }}>Rol</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
              {ROLES.map(r => (
                <button key={r.value} onClick={() => setEditRole(r.value)} style={{ backgroundColor: editRole === r.value ? r.bg : C.cardAlt, border: `0.5px solid ${editRole === r.value ? r.border : C.border}`, borderRadius: 10, padding: "10px 4px", cursor: "pointer", textAlign: "center" }}>
                  <div style={{ fontSize: 18 }}>{r.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: editRole === r.value ? r.color : C.muted, marginTop: 4 }}>{r.label}</div>
                </button>
              ))}
            </div>
            <div style={{ backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Acceso activo</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Puede ingresar a la app</div>
              </div>
              <Toggle on={editActive} onToggle={() => setEditActive(!editActive)} />
            </div>
            <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: 1 }}>Permisos</div>
            {PERMISSIONS.map(p => (
              <div key={p.key} style={{ backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{p.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{p.sub}</div>
                  </div>
                </div>
                <Toggle on={!!editPermissions[p.key]} onToggle={() => setEditPermissions(prev => ({ ...prev, [p.key]: !prev[p.key] }))} />
              </div>
            ))}
            <button onClick={saveUser} disabled={savingUser} style={{ ...btn, marginTop: 12 }}>
              {savingUser ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        )}

        {/* CREAR USUARIO */}
        {screen === "crearUsuario" && (
          <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Nuevo usuario</div>
            {[
              { val: newUserName, set: setNewUserName, ph: "Nombre completo *", type: "text" },
              { val: newUserEmail, set: setNewUserEmail, ph: "Correo *", type: "email" },
              { val: newUserPassword, set: setNewUserPassword, ph: "Contraseña *", type: "password" },
            ].map(({ val, set, ph, type }, i) => (
              <input key={i} type={type} value={val} onChange={e => set(e.target.value)} placeholder={ph} style={inp} />
            ))}
            <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 8, marginTop: 4, textTransform: "uppercase" as const, letterSpacing: 1 }}>Rol</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
              {ROLES.map(r => (
                <button key={r.value} onClick={() => setNewUserRole(r.value)} style={{ backgroundColor: newUserRole === r.value ? r.bg : C.cardAlt, border: `0.5px solid ${newUserRole === r.value ? r.border : C.border}`, borderRadius: 10, padding: "10px 4px", cursor: "pointer", textAlign: "center" }}>
                  <div style={{ fontSize: 18 }}>{r.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: newUserRole === r.value ? r.color : C.muted, marginTop: 4 }}>{r.label}</div>
                </button>
              ))}
            </div>
            <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: 1 }}>Permisos</div>
            {PERMISSIONS.map(p => (
              <div key={p.key} style={{ backgroundColor: C.cardAlt, border: `0.5px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{p.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{p.sub}</div>
                  </div>
                </div>
                <Toggle on={!!newUserPermissions[p.key]} onToggle={() => setNewUserPermissions(prev => ({ ...prev, [p.key]: !prev[p.key] }))} />
              </div>
            ))}
            <button onClick={createUser} disabled={creatingUser} style={{ ...btn, marginTop: 12 }}>
              {creatingUser ? "Creando..." : "Crear usuario"}
            </button>
          </div>
        )}

        {/* CONFIGURACION */}
        {screen === "configuracion" && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Configuración</div>
            <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <Avatar name={userName} size={52} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{userName}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{userRole}</div>
                </div>
              </div>
              <button onClick={() => { setToken(null); setTasks([]); setSelectedProject(null); setScreen("home"); }} style={{ width: "100%", height: 44, backgroundColor: C.dangerDim, border: `0.5px solid ${C.dangerDim}`, borderRadius: 10, color: C.danger, fontWeight: 600, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <LogOut size={15} /> Cerrar sesión
              </button>
            </div>

            <div style={{ backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Logo de empresa</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Aparecerá en los informes Word generados</div>
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

      {/* Nav inferior */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, backgroundColor: C.card, borderTop: `0.5px solid ${C.border}`, display: "flex", padding: "8px 0 16px", zIndex: 100 }}>
        {([
          { sc: "home" as Screen, icon: <Home size={22} />, label: "Inicio" },
          { sc: "proyectos" as Screen, icon: <FolderOpen size={22} />, label: "Proyectos" },
          { sc: "crearProyecto" as Screen, icon: null, label: "Crear" },
          { sc: "admin" as Screen, icon: <Shield size={22} />, label: "Admin", adminOnly: true },
          { sc: "configuracion" as Screen, icon: <Avatar name={userName} size={24} />, label: "Perfil" },
        ] as { sc: Screen; icon: React.ReactNode; label: string; adminOnly?: boolean }[]).filter(item => !item.adminOnly || isAdmin).map(({ sc, icon, label }) => {
          const active = screen === sc || (sc === "home" && screen === "partidas");
          const isCreate = sc === "crearProyecto";
          return (
            <button key={sc} onClick={() => setScreen(sc)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", color: active ? C.orange : C.muted, position: "relative" }}>
              {isCreate ? (
                <div style={{ width: 48, height: 48, background: C.orange, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginTop: -20, boxShadow: `0 0 0 4px ${C.card}` }}>
                  <Plus size={22} color="#fff" />
                </div>
              ) : icon}
              <span style={{ fontSize: 10, fontWeight: 600 }}>{label}</span>
              {active && !isCreate && <div style={{ width: 4, height: 4, borderRadius: "50%", background: C.orange, position: "absolute", bottom: -4 }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
