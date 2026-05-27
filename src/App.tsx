import React from "react";
import { useState, useEffect, useRef } from "react";
import { Camera, LogOut, CheckCircle2, Mail, Lock, Trash2, FileText, Menu, Plus, ChevronLeft, FolderOpen, Home, Shield, Eye, EyeOff } from "lucide-react";

const API_URL = "https://obrassync-backend-production.up.railway.app";

const C = {
  bg: "#0A0A0A", card: "#141414", cardAlt: "#1C1C1C", border: "#2A2A2A",
  text: "#FFFFFF", muted: "#666666", mutedSoft: "#999999",
  orange: "#F97316", orangeSoft: "#FDBA74", orangeDim: "#7C3913",
  success: "#22C55E", successDim: "#14532D", danger: "#EF4444", dangerDim: "#7F1D1D",
  info: "#60A5FA", infoDim: "#0D1A2E",
};

type Screen = "inicio" | "proyectos" | "crearProyecto" | "fotos" | "admin" | "editarUsuario" | "crearUsuario";
type Project = { id: string; code: string; name: string; client_name?: string; start_date?: string; end_date?: string };
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
  { value: "administrador", label: "Admin", icon: "👑", color: "#F97316", bg: "#1A0D00", border: "#7C3913" },
  { value: "jefe_obra", label: "Jefe obra", icon: "🦺", color: "#60A5FA", bg: "#0D1A2E", border: "#1E3A5F" },
  { value: "inspector", label: "Trabajador", icon: "👷", color: "#22C55E", bg: "#14532D", border: "#14532D" },
];

const STATUS_OPTIONS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_curso", label: "En curso" },
  { value: "completada", label: "Completada" },
  { value: "atrasada", label: "Atrasada" },
];

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div onClick={onToggle} style={{ width: 44, height: 24, borderRadius: 12, background: on ? "#22C55E" : "#333", position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 0.2s" }}>
      <div style={{ width: 20, height: 20, background: "#fff", borderRadius: "50%", position: "absolute", top: 2, left: on ? 22 : 2, transition: "left 0.2s" }} />
    </div>
  );
}

function Avatar({ name, role }: { name: string; role: string }) {
  const initials = name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
  const r = ROLES.find(r => r.value === role) || ROLES[2];
  return (
    <div style={{ width: 40, height: 40, borderRadius: "50%", background: r.bg, border: `1px solid ${r.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: r.color, flexShrink: 0 }}>
      {initials}
    </div>
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
  const [screen, setScreen] = useState<Screen>("inicio");
  const [menuOpen, setMenuOpen] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
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
  const [savingTask, setSavingTask] = useState(false);
  const [taskName, setTaskName] = useState("");

  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
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
    setProjectsLoading(true);
    try {
      const r = await fetch(`${API_URL}/projects`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setProjects(d.items || []);
    } catch { } finally { setProjectsLoading(false); }
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
      if (selectedProject?.id === id) setSelectedProject(null);
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

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const r = await fetch(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setUsers(d.items || []);
    } catch { } finally { setUsersLoading(false); }
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
  const totalPhotos = tasks.reduce((a, t) => a + (t.photo_count || 0), 0);

  const statusMap: Record<string, { label: string; color: string; bg: string }> = {
    pendiente: { label: "Pendiente", color: C.mutedSoft, bg: C.cardAlt },
    en_curso: { label: "En curso", color: C.orangeSoft, bg: C.orangeDim },
    completada: { label: "Completada", color: C.success, bg: C.successDim },
    atrasada: { label: "Atrasada", color: C.danger, bg: C.dangerDim },
  };

  if (!token) return (
    <div style={{ minHeight: "100vh", backgroundColor: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 40 }}>
          <div style={{ width: 90, height: 90, background: "#1A0D00", border: `2px solid ${C.orange}`, borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, marginBottom: 16 }}>🏗️</div>
          <div style={{ color: C.text, fontSize: 32, fontWeight: 900, letterSpacing: -0.5 }}>Obras<span style={{ color: C.orange }}>Sync</span></div>
          <div style={{ color: C.muted, fontSize: 12, fontWeight: 700, letterSpacing: 2, marginTop: 4, textTransform: "uppercase" }}>Controla · Organiza · Avanza</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "0 14px", marginBottom: 12, height: 52 }}>
          <Mail size={18} color={C.orange} />
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Correo electrónico" style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontSize: 15 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "0 14px", marginBottom: 24, height: 52 }}>
          <Lock size={18} color={C.orange} />
          <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" onKeyDown={e => e.key === "Enter" && handleLogin()} style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontSize: 15 }} />
          <div onClick={() => setShowPass(!showPass)} style={{ cursor: "pointer" }}>{showPass ? <EyeOff size={16} color={C.muted} /> : <Eye size={16} color={C.muted} />}</div>
        </div>
        <button onClick={handleLogin} disabled={loginLoading} style={{ width: "100%", height: 52, backgroundColor: C.orange, border: "none", borderRadius: 14, color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>
          {loginLoading ? "Ingresando..." : "Ingresar →"}
        </button>
        <div style={{ textAlign: "center", marginTop: 32, color: "#2A2A2A", fontSize: 11 }}>Desarrollado por <span style={{ color: C.orangeDim }}>Matfau SPA</span> · v2.0</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.bg, color: C.text, fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif", paddingBottom: 70 }}>

      {/* Modal editar partida */}
      {editingTask && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", zIndex: 300, display: "flex", alignItems: "flex-end" }}>
          <div style={{ backgroundColor: C.card, borderRadius: "20px 20px 0 0", padding: 20, width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Editar partida</div>
              <button onClick={() => deleteTask(editingTask.id)} style={{ backgroundColor: C.dangerDim, border: "none", borderRadius: 8, padding: "5px 12px", color: C.danger, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                Eliminar
              </button>
            </div>
            <input value={taskName} onChange={e => setTaskName(e.target.value)} placeholder="Nombre de la partida" style={{ width: "100%", height: 44, backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 14, padding: "0 14px", marginBottom: 12, boxSizing: "border-box" }} />
            <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 8 }}>ESTADO</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
              {STATUS_OPTIONS.map(s => (
                <button key={s.value} onClick={() => setTaskStatus(s.value)} style={{ padding: 10, borderRadius: 10, border: `1px solid ${taskStatus === s.value ? C.orange : C.border}`, background: taskStatus === s.value ? C.orangeDim : C.bg, color: taskStatus === s.value ? C.orange : C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  {s.label}
                </button>
              ))}
            </div>
            <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 8 }}>AVANCE: {taskProgress}%</div>
            <input type="range" min={0} max={100} value={taskProgress} onChange={e => setTaskProgress(Number(e.target.value))} style={{ width: "100%", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setEditingTask(null)} style={{ flex: 1, height: 46, background: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 12, color: C.muted, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
              <button onClick={saveTask} disabled={savingTask} style={{ flex: 2, height: 46, background: C.orange, border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, cursor: "pointer" }}>
                {savingTask ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, backgroundColor: C.bg, borderBottom: `1px solid ${C.border}`, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {(screen === "fotos" || screen === "editarUsuario" || screen === "crearUsuario") && (
            <button onClick={() => setScreen(screen === "fotos" ? "inicio" : "admin")} style={{ background: "none", border: "none", color: C.orange, cursor: "pointer", padding: 0, display: "flex" }}>
              <ChevronLeft size={24} />
            </button>
          )}
          <div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>Obras<span style={{ color: C.orange }}>Sync</span></div>
            {selectedProject && screen !== "editarUsuario" && screen !== "crearUsuario" && (
              <div style={{ fontSize: 11, color: C.muted }}>{selectedProject.code} · {selectedProject.name}</div>
            )}
          </div>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 10px", color: C.text, cursor: "pointer", display: "flex" }}>
          <Menu size={18} />
        </button>
      </div>

      {menuOpen && (
        <div style={{ position: "fixed", top: 60, right: 16, zIndex: 200, backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 8, minWidth: 200 }} onClick={() => setMenuOpen(false)}>
          <div style={{ padding: "8px 14px", fontSize: 13, color: C.mutedSoft, borderBottom: `1px solid ${C.border}`, marginBottom: 4 }}>
            👤 {userName} <span style={{ color: C.orange, fontSize: 11 }}>({userRole})</span>
          </div>
          <button onClick={() => { setToken(null); setTasks([]); setSelectedProject(null); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: "none", color: C.danger, padding: "10px 14px", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
            <LogOut size={14} /> Cerrar sesión
          </button>
        </div>
      )}

      <div style={{ maxWidth: 600, margin: "0 auto", padding: 16 }}>

        {/* Fotos */}
        {screen === "fotos" && selectedTask && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>📷 Fotos</div>
              <div style={{ color: C.muted, fontSize: 13 }}>{selectedTask.name}</div>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }} />
              <input ref={photoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }} />
              <button onClick={() => cameraInputRef.current?.click()} disabled={uploadingPhoto} style={{ flex: 1, height: 50, backgroundColor: C.orange, border: "none", borderRadius: 14, color: "#fff", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 15 }}>
                <Camera size={18} /> {uploadingPhoto ? "Subiendo..." : "Tomar foto"}
              </button>
              <button onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto} style={{ flex: 1, height: 50, backgroundColor: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 14, color: C.mutedSoft, fontWeight: 700, cursor: "pointer", fontSize: 15 }}>
                Galería
              </button>
            </div>
            {photosLoading ? <div style={{ color: C.muted, textAlign: "center", padding: 32 }}>Cargando...</div>
              : photos.length === 0 ? <div style={{ textAlign: "center", padding: 48, color: C.muted }}>Sin fotos todavía</div>
                : photos.map(photo => (
                  <div key={photo.id} style={{ display: "flex", alignItems: "center", gap: 12, backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 12, marginBottom: 10 }}>
                    <img src={`${API_URL}${photo.local_path}`} alt={photo.filename} style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover", backgroundColor: C.border }} />
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{photo.filename}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{new Date(photo.created_at).toLocaleString("es-CL")}</div>
                      {photo.onedrive_url && <div style={{ fontSize: 11, color: "#60A5FA", marginTop: 2 }}>☁️ OneDrive</div>}
                    </div>
                    <button onClick={() => deletePhoto(photo.id)} style={{ width: 36, height: 36, backgroundColor: C.dangerDim, border: "none", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Trash2 size={16} color={C.danger} />
                    </button>
                  </div>
                ))}
          </div>
        )}

        {/* Inicio */}
        {screen === "inicio" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
              {[
                { label: "Partidas", value: String(tasks.length), color: C.text },
                { label: "Avance", value: `${progress.toFixed(0)}%`, color: C.orange },
                { label: "Fotos", value: String(totalPhotos), color: C.text },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14 }}>
                  <div style={{ fontSize: 11, color: C.muted }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4, color }}>{value}</div>
                </div>
              ))}
            </div>

            {tasks.length > 0 && (
              <div style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 14, marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>AVANCE GENERAL</span>
                  <span style={{ fontSize: 12, color: C.orange, fontWeight: 800 }}>{progress.toFixed(1)}%</span>
                </div>
                <div style={{ width: "100%", height: 10, borderRadius: 999, backgroundColor: "#1A1A1A", overflow: "hidden" }}>
                  <div style={{ width: `${progress}%`, height: "100%", backgroundColor: C.orange, borderRadius: 999, transition: "width 0.5s" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                  {atrasadas > 0 && <span style={{ fontSize: 11, color: C.danger }}>⚠️ {atrasadas} atrasada{atrasadas > 1 ? "s" : ""}</span>}
                  {completadas > 0 && <span style={{ fontSize: 11, color: C.success }}>✓ {completadas} completada{completadas > 1 ? "s" : ""}</span>}
                </div>
              </div>
            )}

            {selectedProject && (
              <div style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Informe fotográfico</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Genera un documento Word con todas las fotos del proyecto</div>
                <button onClick={generateReport} disabled={generatingReport} style={{ width: "100%", height: 46, backgroundColor: "#1D3557", border: "1px solid #2D5F8A", borderRadius: 12, color: "#90CAF9", fontWeight: 800, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <FileText size={16} /> {generatingReport ? "Generando..." : "Descargar informe Word"}
                </button>
              </div>
            )}

            <div style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Importar carta Gantt</div>
              {!selectedProject && <div style={{ backgroundColor: "#1A1200", border: "1px solid #5C4500", borderRadius: 10, padding: 10, marginBottom: 12, color: "#FCD34D", fontSize: 13 }}>⚠️ Selecciona un proyecto primero</div>}
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={e => setGanttFile(e.target.files?.[0] || null)} />
              <button onClick={() => fileInputRef.current?.click()} style={{ width: "100%", height: 46, backgroundColor: C.bg, border: `1px solid ${ganttFile ? C.orange : C.border}`, borderRadius: 12, color: ganttFile ? C.orange : C.mutedSoft, cursor: "pointer", fontSize: 14, marginBottom: 10 }}>
                {ganttFile ? `📎 ${ganttFile.name}` : "Seleccionar archivo .xlsx"}
              </button>
              <button onClick={uploadGantt} disabled={uploadingGantt || !ganttFile || !selectedProject} style={{ width: "100%", height: 48, backgroundColor: (!ganttFile || !selectedProject) ? C.border : C.orange, border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 15 }}>
                {uploadingGantt ? "Importando..." : "Importar partidas"}
              </button>
            </div>

            {tasksLoading ? <div style={{ color: C.muted, textAlign: "center", padding: 32 }}>Cargando partidas...</div>
              : tasks.length > 0 ? (
                <div style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 14 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Partidas</div>
                  {tasks.map((task, i) => {
                    const st = statusMap[task.status || "pendiente"] || statusMap.pendiente;
                    const isLate = task.status === "atrasada";
                    return (
                      <div key={task.id || i} style={{ backgroundColor: C.bg, border: `1px solid ${isLate ? C.dangerDim : C.border}`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{task.name}</div>
                            <span style={{ backgroundColor: st.bg, color: st.color, fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>{st.label}</span>
                          </div>
                          <div style={{ display: "flex", gap: 6, marginLeft: 8 }}>
                            <button onClick={() => openPhotos(task)} style={{ width: 40, height: 40, backgroundColor: "#1A0D00", border: `1px solid ${C.orangeDim}`, borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", flexShrink: 0 }}>
                              <Camera size={17} color={C.orange} />
                              {(task.photo_count ?? 0) > 0 && (
                                <span style={{ position: "absolute", top: -5, right: -5, backgroundColor: C.orange, color: "#fff", fontSize: 10, fontWeight: 800, width: 17, height: 17, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>{task.photo_count}</span>
                              )}
                            </button>
                            <button onClick={() => { setEditingTask(task); setTaskStatus(task.status || "pendiente"); setTaskProgress(Number(task.progress_percent || 0)); setTaskName(task.name || ""); }} style={{ width: 40, height: 40, backgroundColor: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16 }}>
                              ✏️
                            </button>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                          {task.duration && <span style={{ fontSize: 11, color: C.muted }}>⏱ {task.duration}</span>}
                          {task.start_date && <span style={{ fontSize: 11, color: C.muted }}>▶ {task.start_date}</span>}
                          {task.end_date && <span style={{ fontSize: 11, color: isLate ? C.danger : C.muted }}>⬛ {task.end_date}</span>}
                        </div>
                        {Number(task.progress_percent) > 0 && (
                          <>
                            <div style={{ width: "100%", height: 6, borderRadius: 999, backgroundColor: "#1A1A1A", overflow: "hidden", marginTop: 10 }}>
                              <div style={{ width: `${task.progress_percent}%`, height: "100%", backgroundColor: isLate ? C.danger : C.orange, borderRadius: 999 }} />
                            </div>
                            <div style={{ fontSize: 11, color: isLate ? C.danger : C.orangeSoft, fontWeight: 700, marginTop: 4 }}>{task.progress_percent}%</div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : selectedProject
                ? <div style={{ textAlign: "center", padding: 32, color: C.muted }}>Sin partidas. Importa un Excel primero.</div>
                : <div style={{ textAlign: "center", padding: 32, color: C.muted }}>Selecciona un proyecto para comenzar.</div>
            }
          </>
        )}

        {/* Proyectos */}
        {screen === "proyectos" && (
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 14 }}>Proyectos</div>
            {projectsLoading ? <div style={{ color: C.muted, textAlign: "center", padding: 32 }}>Cargando...</div>
              : projects.length === 0 ? <div style={{ color: C.muted, textAlign: "center", padding: 32 }}>Sin proyectos todavía.</div>
                : projects.map(p => (
                  <div key={p.id} style={{ backgroundColor: C.card, border: `2px solid ${selectedProject?.id === p.id ? C.orange : C.border}`, borderRadius: 18, padding: 16, marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <button onClick={() => { setSelectedProject(p); setScreen("inicio"); }} style={{ flex: 1, background: "none", border: "none", textAlign: "left", cursor: "pointer", padding: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: C.orangeSoft, fontWeight: 800 }}>{p.code}</span>
                          {selectedProject?.id === p.id && <CheckCircle2 size={16} color={C.orange} />}
                        </div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{p.name}</div>
                        <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{p.client_name || "Sin cliente"}</div>
                        {(p.start_date || p.end_date) && (
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
                            {p.start_date && `▶ ${p.start_date}`}{p.end_date && ` · ⬛ ${p.end_date}`}
                          </div>
                        )}
                      </button>
                      {isAdmin && (
                        <button onClick={() => deleteProject(p.id)} style={{ width: 36, height: 36, backgroundColor: C.dangerDim, border: "none", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 10, flexShrink: 0 }}>
                          <Trash2 size={15} color={C.danger} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
          </div>
        )}

        {/* Crear Proyecto */}
        {screen === "crearProyecto" && (
          <div style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Nuevo proyecto</div>
            {[
              { val: projectCode, set: setProjectCode, ph: "Código *", key: "code" },
              { val: projectName, set: setProjectName, ph: "Nombre *", key: "name" },
              { val: clientName, set: setClientName, ph: "Cliente", key: "client" },
            ].map(({ val, set, ph, key }) => (
              <input key={key} value={val} onChange={e => set(e.target.value)} placeholder={ph} style={{ width: "100%", height: 48, backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 14, padding: "0 14px", marginBottom: 10, boxSizing: "border-box" }} />
            ))}
            <div style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>Fecha de inicio</div>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: "100%", height: 48, backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 14, padding: "0 14px", marginBottom: 10, boxSizing: "border-box" }} />
            <div style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>Fecha de término</div>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ width: "100%", height: 48, backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 14, padding: "0 14px", marginBottom: 16, boxSizing: "border-box" }} />
            <button onClick={createProject} disabled={creatingProject} style={{ width: "100%", height: 50, backgroundColor: C.orange, border: "none", borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
              {creatingProject ? "Creando..." : "Crear proyecto"}
            </button>
          </div>
        )}

        {/* Admin */}
        {screen === "admin" && isAdmin && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>Usuarios</div>
              <button onClick={() => setScreen("crearUsuario")} style={{ backgroundColor: C.orange, border: "none", borderRadius: 10, padding: "8px 14px", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <Plus size={14} /> Nuevo
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
              {[
                { label: "Total", value: users.length, color: C.text },
                { label: "Activos", value: users.filter(u => u.is_active).length, color: C.success },
                { label: "Inactivos", value: users.filter(u => !u.is_active).length, color: C.danger },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: C.muted }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color, marginTop: 4 }}>{value}</div>
                </div>
              ))}
            </div>
            {usersLoading ? <div style={{ color: C.muted, textAlign: "center", padding: 32 }}>Cargando...</div>
              : users.map(user => {
                const r = ROLES.find(r => r.value === user.role) || ROLES[2];
                return (
                  <div key={user.id} style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14, marginBottom: 10, opacity: user.is_active ? 1 : 0.6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <Avatar name={user.full_name} role={user.role} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{user.full_name}</div>
                        <div style={{ fontSize: 12, color: C.muted }}>{user.email}</div>
                      </div>
                      <Toggle on={user.is_active} onToggle={async () => {
                        await fetch(`${API_URL}/users/${user.id}/toggle`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
                        await loadUsers();
                      }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ backgroundColor: r.bg, color: r.color, border: `1px solid ${r.border}`, fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 20 }}>{r.icon} {r.label}</span>
                      <button onClick={() => openEditUser(user)} style={{ backgroundColor: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: "6px 12px", color: C.mutedSoft, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Editar</button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* Editar Usuario */}
        {screen === "editarUsuario" && editingUser && (
          <div style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Editar usuario</div>
              <button onClick={() => deleteUser(editingUser.id)} style={{ backgroundColor: C.dangerDim, border: "none", borderRadius: 10, padding: "6px 12px", color: C.danger, fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <Trash2 size={13} /> Eliminar
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
              <Avatar name={editingUser.full_name} role={editRole} />
              <div style={{ fontSize: 15, fontWeight: 800, marginTop: 8 }}>{editingUser.full_name}</div>
            </div>
            <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Información</div>
            {[
              { val: editName, set: setEditName, ph: "Nombre completo" },
              { val: editEmail, set: setEditEmail, ph: "Correo electrónico" },
            ].map(({ val, set, ph }, i) => (
              <input key={i} value={val} onChange={e => set(e.target.value)} placeholder={ph} style={{ width: "100%", height: 46, backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 14, padding: "0 14px", marginBottom: 10, boxSizing: "border-box" }} />
            ))}
            <input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="Nueva contraseña (opcional)" style={{ width: "100%", height: 46, backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 14, padding: "0 14px", marginBottom: 16, boxSizing: "border-box" }} />
            <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Rol</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
              {ROLES.map(r => (
                <button key={r.value} onClick={() => setEditRole(r.value)} style={{ backgroundColor: editRole === r.value ? r.bg : C.bg, border: `1px solid ${editRole === r.value ? r.border : C.border}`, borderRadius: 12, padding: "10px 4px", cursor: "pointer", textAlign: "center" }}>
                  <div style={{ fontSize: 20 }}>{r.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: editRole === r.value ? r.color : C.muted, marginTop: 4 }}>{r.label}</div>
                </button>
              ))}
            </div>
            <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Estado</div>
            <div style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Acceso activo</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Puede ingresar a la app</div>
              </div>
              <Toggle on={editActive} onToggle={() => setEditActive(!editActive)} />
            </div>
            <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Permisos</div>
            {PERMISSIONS.map(p => (
              <div key={p.key} style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{p.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{p.sub}</div>
                  </div>
                </div>
                <Toggle on={!!editPermissions[p.key]} onToggle={() => setEditPermissions(prev => ({ ...prev, [p.key]: !prev[p.key] }))} />
              </div>
            ))}
            <button onClick={saveUser} disabled={savingUser} style={{ width: "100%", height: 50, backgroundColor: C.orange, border: "none", borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", marginTop: 8 }}>
              {savingUser ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        )}

        {/* Crear Usuario */}
        {screen === "crearUsuario" && (
          <div style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Nuevo usuario</div>
            {[
              { val: newUserName, set: setNewUserName, ph: "Nombre completo *", type: "text" },
              { val: newUserEmail, set: setNewUserEmail, ph: "Correo electrónico *", type: "email" },
              { val: newUserPassword, set: setNewUserPassword, ph: "Contraseña *", type: "password" },
            ].map(({ val, set, ph, type }, i) => (
              <input key={i} type={type} value={val} onChange={e => set(e.target.value)} placeholder={ph} style={{ width: "100%", height: 46, backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 14, padding: "0 14px", marginBottom: 10, boxSizing: "border-box" }} />
            ))}
            <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8, marginTop: 6 }}>Rol</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
              {ROLES.map(r => (
                <button key={r.value} onClick={() => setNewUserRole(r.value)} style={{ backgroundColor: newUserRole === r.value ? r.bg : C.bg, border: `1px solid ${newUserRole === r.value ? r.border : C.border}`, borderRadius: 12, padding: "10px 4px", cursor: "pointer", textAlign: "center" }}>
                  <div style={{ fontSize: 20 }}>{r.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: newUserRole === r.value ? r.color : C.muted, marginTop: 4 }}>{r.label}</div>
                </button>
              ))}
            </div>
            <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Permisos</div>
            {PERMISSIONS.map(p => (
              <div key={p.key} style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{p.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{p.sub}</div>
                  </div>
                </div>
                <Toggle on={!!newUserPermissions[p.key]} onToggle={() => setNewUserPermissions(prev => ({ ...prev, [p.key]: !prev[p.key] }))} />
              </div>
            ))}
            <button onClick={createUser} disabled={creatingUser} style={{ width: "100%", height: 50, backgroundColor: C.orange, border: "none", borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", marginTop: 8 }}>
              {creatingUser ? "Creando..." : "Crear usuario"}
            </button>
          </div>
        )}

      </div>

      {/* Nav inferior */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, backgroundColor: C.bg, borderTop: `1px solid ${C.border}`, display: "flex", padding: "8px 0 12px", zIndex: 100 }}>
        {([
          { sc: "inicio" as Screen, icon: <Home size={20} />, label: "Inicio" },
          { sc: "proyectos" as Screen, icon: <FolderOpen size={20} />, label: "Proyectos" },
          { sc: "crearProyecto" as Screen, icon: <Plus size={20} />, label: "Crear" },
          ...(isAdmin ? [{ sc: "admin" as Screen, icon: <Shield size={20} />, label: "Admin" }] : []),
        ] as { sc: Screen; icon: React.ReactNode; label: string }[]).map(({ sc, icon, label }) => {
          const active = screen === sc;
          return (
            <button key={sc} onClick={() => setScreen(sc)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: active ? C.orange : C.muted }}>
              {icon}
              <span style={{ fontSize: 10, fontWeight: 700 }}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
