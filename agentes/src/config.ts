// Configuración del servicio, toda desde variables de entorno (en Railway: Variables).
// Ninguna credencial vive en el repositorio.

function opcional(nombre: string, porDefecto = ""): string {
  return (process.env[nombre] ?? porDefecto).trim();
}

function lista(nombre: string): string[] {
  return opcional(nombre)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const config = {
  puerto: Number(opcional("PORT", "8080")),
  adminToken: opcional("ADMIN_TOKEN"),

  modelo: opcional("CLAUDE_MODELO", "claude-opus-5-5"),
  esfuerzoGerente: opcional("CLAUDE_ESFUERZO_GERENTE", "medium") as "low" | "medium" | "high",
  esfuerzoAreas: opcional("CLAUDE_ESFUERZO_AREAS", "low") as "low" | "medium" | "high",

  obrassync: {
    api: opcional("OBRASSYNC_API_URL", "https://obrassync-backend-production.up.railway.app"),
    token: opcional("OBRASSYNC_TOKEN"),
    email: opcional("OBRASSYNC_EMAIL"),
    password: opcional("OBRASSYNC_PASSWORD"),
  },

  whatsapp: {
    // Número de teléfono de la API oficial (WhatsApp Business Cloud API de Meta).
    phoneNumberId: opcional("WA_PHONE_NUMBER_ID"),
    accessToken: opcional("WA_ACCESS_TOKEN"),
    appSecret: opcional("WA_APP_SECRET"),
    verifyToken: opcional("WA_VERIFY_TOKEN"),
    apiVersion: opcional("WA_API_VERSION", "v23.0"),
    graphUrl: opcional("WA_GRAPH_URL", "https://graph.facebook.com"),
    // Números (formato 569XXXXXXXX, sin +) a los que el agente responde. Vacío = nadie.
    autorizados: new Set(lista("WA_NUMEROS_AUTORIZADOS").map((n) => n.replace(/\D/g, ""))),
    // En grupos solo responde si el mensaje contiene alguna de estas palabras.
    activadores: lista("WA_ACTIVADORES").length ? lista("WA_ACTIVADORES") : ["@agente", "@matfau"],
  },

  correo: {
    // Microsoft 365: app registrada en Entra ID con permisos de aplicación Mail.ReadWrite y Mail.Send.
    tenantId: opcional("M365_TENANT_ID"),
    clientId: opcional("M365_CLIENT_ID"),
    clientSecret: opcional("M365_CLIENT_SECRET"),
    buzon: opcional("M365_BUZON", "agentes@matfau.cl").toLowerCase(),
    // Solo se responde a remitentes de estos dominios (o direcciones exactas).
    permitidos: lista("CORREO_PERMITIDOS").length ? lista("CORREO_PERMITIDOS") : ["matfau.cl"],
    intervaloSegundos: Number(opcional("CORREO_INTERVALO_SEGUNDOS", "60")),
  },
};

export const whatsappActivo = () =>
  Boolean(config.whatsapp.phoneNumberId && config.whatsapp.accessToken && config.whatsapp.appSecret && config.whatsapp.verifyToken);

export const correoActivo = () =>
  Boolean(config.correo.tenantId && config.correo.clientId && config.correo.clientSecret);
