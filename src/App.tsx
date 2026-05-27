import { useState, useEffect, useRef } from "react";
import {
  Camera, LogOut, CheckCircle2,
  Mail, Lock, Trash2, FileText, Menu
} from "lucide-react";

const API_URL = "https://obrassync-backend-production.up.railway.app";

const C = {
  bg: "#0A0A0A",
  card: "#141414",
  cardAlt: "#1C1C1C",
  border: "#2A2A2A",
  text: "#FFFFFF",
  muted: "#666666",
  mutedSoft: "#999999",
  orange: "#F97316",
  orangeSoft: "#FDBA74",
  orangeDim: "#7C3913",
  success: "#22C55E",
  successDim: "#14532D",
  danger: "#EF4444",
  dangerDim: "#7F1D1D",
};

type Screen = "inicio" | "proyectos" | "crearProyecto" | "fotos";
type Project = { id: string; code: string; name: string; client_name?: string };
type Task = {
  id: string; name: string; duration?: string;
  start_date?: string; end_date?: string;
  progress_percent?: number; status?: string; photo_count?: number;
};
type TaskPhoto = {
  id: string; filename: string; local_path?: string;
  onedrive_url?: string; created_at: string;
};

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("admin@obrassync.cl");
  const [password, setPassword] = useState("Admin1234*");
  const [loginLoading, setLoginLoading] = useState(false);
  const [screen, setScreen] = useState<Screen>("inicio");
  const [menuOpen, setMenuOpen] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const [projectCode, setProjectCode] = useState("");
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");
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

  useEffect(() => { if (token) loadProjects(); }, [token]);
  useEffect(() => { if (selectedProject && token) loadTasks(selectedProject.id); }, [selectedProject]);

  async function handleLogin() {
    if (!email || !password) return;
    setLoginLoading(true);
    try {
      const r = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Credenciales inválidas"); return; }
      setToken(d.token);
      setUserName(d.user?.fullName || "Usuario");
      setScreen("inicio");
    } catch { alert("No se pudo conectar al servidor"); }
    finally { setLoginLoading(false); }
  }

  async function loadProjects() {
    setProjectsLoading(true);
    try {
      const r = await fetch(`${API_URL}/projects`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setProjects(d.items || []);
    } catch { alert("Error cargando proyectos"); }
    finally { setProjectsLoading(false); }
  }

  async function createProject() {
    if (!projectCode || !projectName) { alert("Código y nombre son obligatorios"); return; }
    setCreatingProject(true);
    try {
      const r = await fetch(`${API_URL}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: projectCode, name: projectName, clientName }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error creando proyecto"); return; }
      setProjectCode(""); setProjectName(""); setClientName("");
      await loadProjects();
      setScreen("proyectos");
    } catch { alert("Error creando proyecto"); }
    finally { setCreatingProject(false); }
  }

  async function loadTasks(projectId: string) {
    setTasksLoading(true);
    try {
      const r = await fetch(`${API_URL}/projects/${projectId}/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      setTasks(d.items || []);
    } catch { alert("Error cargando partidas"); }
    finally { setTasksLoading(false); }
  }

  async function uploadGantt() {
    if (!ganttFile || !selectedProject) { alert("Selecciona un proyecto y un archivo Excel"); return; }
    setUploadingGantt(true);
    try {
      const formData = new FormData();
      formData.append("file", ganttFile);
      const r = await fetch(`${API_URL}/projects/${selectedProject.id}/gantt/import-excel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error importando"); return; }
      setTasks(d.tasks || []);
      setGanttFile(null);
      alert(`✅ ${d.tasks?.length || 0} partidas importadas`);
    } catch { alert("Error importando archivo"); }
    finally { setUploadingGantt(false); }
  }

  async function openPhotos(task: Task) {
    setSelectedTask(task);
    setScreen("fotos");
    setPhotosLoading(true);
    try {
      const r = await fetch(`${API_URL}/tasks/${task.id}/photos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      setPhotos(d.items || []);
    } catch { alert("Error cargando fotos"); }
    finally { setPhotosLoading(false); }
  }

  async function uploadPhoto(file: File) {
    if (!selectedTask) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const r = await fetch(`${API_URL}/tasks/${selectedTask.id}/photos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const d = await r.json();
      if (!r.ok || !d.ok) { alert(d.message || "Error subiendo foto"); return; }
      const r2 = await fetch(`${API_URL}/tasks/${selectedTask.id}/photos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d2 = await r2.json();
      setPhotos(d2.items || []);
    } catch { alert("Error subiendo foto"); }
    finally { setUploadingPhoto(false); }
  }

  async function deletePhoto(photoId: string) {
    if (!confirm("¿Eliminar esta foto?")) return;
    try {
      await fetch(`${API_URL}/photos/${photoId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setPhotos(p => p.filter(x => x.id !== photoId));
    } catch { alert("Error eliminando foto"); }
  }

  async function generateReport() {
    if (!selectedProject) { alert("Selecciona un proyecto primero"); return; }
    setGeneratingReport(true);
    try {
      const r = await fetch(`${API_URL}/projects/${selectedProject.id}/reports/generate-word`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) { alert("Error generando informe"); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Informe_${selectedProject.code}_${new Date().toLocaleDateString("es-CL").replace(/\//g, "-")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert("Error generando informe"); }
    finally { setGeneratingReport(false); }
  }

  const progress = tasks.length > 0
    ? tasks.reduce((a, t) => a + Number(t.progress_percent || 0), 0) / tasks.length
    : 0;

  // ── Login ──
  if (!token) return (
    <div style={{ minHeight: "100vh", backgroundColor: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 400, backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 24, padding: 28 }}>
        <div style={{ color: C.orangeSoft, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>ACCESO OBRASSYNC</div>
        <div style={{ color: C.text, fontSize: 28, fontWeight: 900, marginBottom: 4 }}>Iniciar sesión</div>
        <div style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>Control de obra y partidas</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "0 14px", marginBottom: 12 }}>
          <Mail size={16} color={C.orange} />
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Correo"
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontSize: 15, height: 48 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "0 14px", marginBottom: 20 }}>
          <Lock size={16} color={C.orange} />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña"
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontSize: 15, height: 48 }} />
        </div>
        <button onClick={handleLogin} disabled={loginLoading}
          style={{ width: "100%", height: 50, backgroundColor: C.orange, border: "none", borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
          {loginLoading ? "Ingresando..." : "Ingresar"}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.bg, color: C.text, fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>

      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, backgroundColor: C.bg, borderBottom: `1px solid ${C.border}`, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {screen === "fotos" && (
            <button onClick={() => { setScreen("inicio"); setSelectedTask(null); }}
              style={{ background: "none", border: "none", color: C.orange, cursor: "pointer", fontSize: 24, lineHeight: 1, padding: 0 }}>←</button>
          )}
          <div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>ObrasSync</div>
            {selectedProject && <div style={{ fontSize: 11, color: C.muted }}>{selectedProject.code} · {selectedProject.name}</div>}
          </div>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)}
          style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 10px", color: C.text, cursor: "pointer", display: "flex" }}>
          <Menu size={18} />
        </button>
      </div>

      {/* Menú desplegable */}
      {menuOpen && (
        <div style={{ position: "fixed", top: 60, right: 16, zIndex: 200, backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 8, minWidth: 200 }}>
          {([
            { label: "🏠 Inicio", sc: "inicio" as Screen },
            { label: "📁 Proyectos", sc: "proyectos" as Screen },
            { label: "➕ Crear proyecto", sc: "crearProyecto" as Screen },
          ]).map(({ label, sc }) => (
            <button key={sc} onClick={() => { setScreen(sc); setMenuOpen(false); }}
              style={{ display: "block", width: "100%", textAlign: "left", background: screen === sc ? C.cardAlt : "none", border: "none", color: screen === sc ? C.orange : C.text, padding: "10px 14px", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
              {label}
            </button>
          ))}
          <div style={{ borderTop: `1px solid ${C.border}`, margin: "6px 0" }} />
          <div style={{ padding: "6px 14px", fontSize: 12, color: C.muted }}>{userName}</div>
          <button onClick={() => { setToken(null); setTasks([]); setSelectedProject(null); setMenuOpen(false); }}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: "none", color: C.danger, padding: "10px 14px", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
            <LogOut size={14} /> Cerrar sesión
          </button>
        </div>
      )}

      <div style={{ maxWidth: 600, margin: "0 auto", padding: 16 }}>

        {/* ── Fotos ── */}
        {screen === "fotos" && selectedTask && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>📷 Fotos</div>
              <div style={{ color: C.muted, fontSize: 13 }}>{selectedTask.name}</div>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }} />
              <input ref={photoInputRef} type="file" accept="image/*" style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }} />
              <button onClick={() => cameraInputRef.current?.click()} disabled={uploadingPhoto}
                style={{ flex: 1, height: 48, backgroundColor: C.orange, border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Camera size={18} /> {uploadingPhoto ? "Subiendo..." : "Tomar foto"}
              </button>
              <button onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}
                style={{ flex: 1, height: 48, backgroundColor: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 12, color: C.mutedSoft, fontWeight: 700, cursor: "pointer" }}>
                Galería
              </button>
            </div>
            {photosLoading
              ? <div style={{ color: C.muted, textAlign: "center", padding: 32 }}>Cargando fotos...</div>
              : photos.length === 0
                ? <div style={{ textAlign: "center", padding: 48, color: C.muted }}>Sin fotos todavía</div>
                : photos.map(photo => (
                  <div key={photo.id} style={{ display: "flex", alignItems: "center", gap: 12, backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 12, marginBottom: 10 }}>
                    <img src={`${API_URL}${photo.local_path}`} alt={photo.filename}
                      style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover", backgroundColor: C.border }} />
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{photo.filename}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{new Date(photo.created_at).toLocaleString("es-CL")}</div>
                      {photo.onedrive_url && <div style={{ fontSize: 11, color: "#60A5FA", marginTop: 2 }}>☁️ OneDrive</div>}
                    </div>
                    <button onClick={() => deletePhoto(photo.id)}
                      style={{ width: 36, height: 36, backgroundColor: C.dangerDim, border: "none", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Trash2 size={16} color={C.danger} />
                    </button>
                  </div>
                ))}
          </div>
        )}

        {/* ── Inicio ── */}
        {screen === "inicio" && (
          <>
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
              {[
                { label: "Partidas", value: String(tasks.length) },
                { label: "Avance", value: `${progress.toFixed(0)}%` },
                { label: "Proyecto", value: selectedProject?.code || "—" },
              ].map(({ label, value }) => (
                <div key={label} style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14 }}>
                  <div style={{ fontSize: 11, color: C.muted }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Importar Gantt */}
            <div style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Importar carta Gantt</div>
              {!selectedProject && (
                <div style={{ backgroundColor: "#1A1200", border: "1px solid #5C4500", borderRadius: 10, padding: 10, marginBottom: 12, color: "#FCD34D", fontSize: 13 }}>
                  ⚠️ Selecciona un proyecto primero
                </div>
              )}
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }}
                onChange={e => setGanttFile(e.target.files?.[0] || null)} />
              <button onClick={() => fileInputRef.current?.click()}
                style={{ width: "100%", height: 46, backgroundColor: C.bg, border: `1px solid ${ganttFile ? C.orange : C.border}`, borderRadius: 12, color: ganttFile ? C.orange : C.mutedSoft, cursor: "pointer", fontSize: 14, marginBottom: 10 }}>
                {ganttFile ? `📎 ${ganttFile.name}` : "Seleccionar archivo .xlsx"}
              </button>
              <button onClick={uploadGantt} disabled={uploadingGantt || !ganttFile || !selectedProject}
                style={{ width: "100%", height: 48, backgroundColor: (!ganttFile || !selectedProject) ? C.border : C.orange, border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 15 }}>
                {uploadingGantt ? "Importando..." : "Importar partidas"}
              </button>
            </div>

            {/* Informe Word */}
            {selectedProject && (
              <div style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 16, marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Informe fotográfico</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Genera un documento Word con todas las fotos del proyecto</div>
                <button onClick={generateReport} disabled={generatingReport}
                  style={{ width: "100%", height: 48, backgroundColor: "#1D3557", border: "1px solid #2D5F8A", borderRadius: 12, color: "#90CAF9", fontWeight: 800, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <FileText size={18} /> {generatingReport ? "Generando..." : "Descargar informe Word"}
                </button>
              </div>
            )}

            {/* Progreso */}
            {tasks.length > 0 && (
              <div style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 16, marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Avance general</div>
                <div style={{ width: "100%", height: 10, borderRadius: 999, backgroundColor: "#1A1A1A", overflow: "hidden" }}>
                  <div style={{ width: `${progress}%`, height: "100%", backgroundColor: C.orange, borderRadius: 999, transition: "width 0.5s" }} />
                </div>
                <div style={{ color: C.orangeSoft, fontWeight: 800, marginTop: 8, fontSize: 14 }}>{progress.toFixed(1)}%</div>
              </div>
            )}

            {/* Partidas */}
            {tasksLoading
              ? <div style={{ color: C.muted, textAlign: "center", padding: 32 }}>Cargando partidas...</div>
              : tasks.length > 0
                ? (
                  <div style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 16 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>Partidas</div>
                    {tasks.map((task, i) => {
                      const statusMap: Record<string, { label: string; color: string; bg: string }> = {
                        pendiente: { label: "Pendiente", color: C.mutedSoft, bg: C.cardAlt },
                        en_curso: { label: "En curso", color: C.orangeSoft, bg: C.orangeDim },
                        completada: { label: "Completada", color: C.success, bg: C.successDim },
                        atrasada: { label: "Atrasada", color: C.danger, bg: C.dangerDim },
                      };
                      const st = statusMap[task.status || "pendiente"] || statusMap.pendiente;
                      return (
                        <div key={task.id || i} style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{task.name}</div>
                              <span style={{ backgroundColor: st.bg, color: st.color, fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>{st.label}</span>
                            </div>
                            <button onClick={() => openPhotos(task)}
                              style={{ width: 42, height: 42, backgroundColor: "#1A0D00", border: `1px solid ${C.orangeDim}`, borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", flexShrink: 0, marginLeft: 10 }}>
                              <Camera size={18} color={C.orange} />
                              {(task.photo_count ?? 0) > 0 && (
                                <span style={{ position: "absolute", top: -5, right: -5, backgroundColor: C.orange, color: "#fff", fontSize: 10, fontWeight: 800, width: 18, height: 18, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  {task.photo_count}
                                </span>
                              )}
                            </button>
                          </div>
                          <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                            {task.duration && <span style={{ fontSize: 12, color: C.muted }}>⏱ {task.duration}</span>}
                            {task.start_date && <span style={{ fontSize: 12, color: C.muted }}>▶ {task.start_date}</span>}
                            {task.end_date && <span style={{ fontSize: 12, color: C.muted }}>⬛ {task.end_date}</span>}
                          </div>
                          {Number(task.progress_percent) > 0 && (
                            <>
                              <div style={{ width: "100%", height: 6, borderRadius: 999, backgroundColor: "#1A1A1A", overflow: "hidden", marginTop: 10 }}>
                                <div style={{ width: `${task.progress_percent}%`, height: "100%", backgroundColor: C.orange, borderRadius: 999 }} />
                              </div>
                              <div style={{ fontSize: 12, color: C.orangeSoft, fontWeight: 700, marginTop: 4 }}>{task.progress_percent}%</div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
                : selectedProject
                  ? <div style={{ textAlign: "center", padding: 32, color: C.muted }}>Sin partidas. Importa un Excel primero.</div>
                  : <div style={{ textAlign: "center", padding: 32, color: C.muted }}>Selecciona un proyecto para comenzar.</div>
            }
          </>
        )}

        {/* ── Proyectos ── */}
        {screen === "proyectos" && (
          <div style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>Proyectos</div>
            {projectsLoading
              ? <div style={{ color: C.muted, textAlign: "center", padding: 32 }}>Cargando...</div>
              : projects.length === 0
                ? <div style={{ color: C.muted, textAlign: "center", padding: 32 }}>Sin proyectos todavía.</div>
                : projects.map(p => (
                  <button key={p.id} onClick={() => { setSelectedProject(p); setScreen("inicio"); }}
                    style={{ width: "100%", backgroundColor: selectedProject?.id === p.id ? C.cardAlt : C.bg, border: `${selectedProject?.id === p.id ? 2 : 1}px solid ${selectedProject?.id === p.id ? C.orange : C.border}`, borderRadius: 14, padding: 14, marginBottom: 10, cursor: "pointer", textAlign: "left" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: C.orangeSoft, fontWeight: 800 }}>{p.code}</span>
                      {selectedProject?.id === p.id && <CheckCircle2 size={16} color={C.orange} />}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginTop: 4 }}>{p.name}</div>
                    <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{p.client_name || "Sin cliente"}</div>
                  </button>
                ))}
          </div>
        )}

        {/* ── Crear Proyecto ── */}
        {screen === "crearProyecto" && (
          <div style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>Nuevo proyecto</div>
            {([
              { val: projectCode, set: setProjectCode, ph: "Código *", key: "code" },
              { val: projectName, set: setProjectName, ph: "Nombre *", key: "name" },
              { val: clientName, set: setClientName, ph: "Cliente", key: "client" },
            ] as { val: string; set: (v: string) => void; ph: string; key: string }[]).map(({ val, set, ph, key }) => (
              <input key={key} value={val} onChange={e => set(e.target.value)} placeholder={ph}
                style={{ width: "100%", height: 48, backgroundColor: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 14, padding: "0 14px", marginBottom: 10, boxSizing: "border-box" }} />
            ))}
            <button onClick={createProject} disabled={creatingProject}
              style={{ width: "100%", height: 50, backgroundColor: C.orange, border: "none", borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", marginTop: 6 }}>
              {creatingProject ? "Creando..." : "Crear proyecto"}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
