# Agentes Matfau: WhatsApp y correo

Servicio que pone al equipo de agentes de Matfau (gerente + operaciones, finanzas, ventas, RR.HH. y prevención)
a responder por **WhatsApp** y por **correo** (`agentes@matfau.cl`).

```
WhatsApp (Meta) ─┐                        ┌─ matfau-operaciones ─┐
                 ├─► servicio ─► gerente ─┼─ matfau-finanzas     ├─► ObrasSync (solo GET)
Correo (M365) ───┘                        ├─ matfau-ventas       │
                                          ├─ matfau-rrhh         │
                                          └─ matfau-prevencion ──┘
```

- Las instrucciones de cada agente se leen de `.claude/agents/*.md`: editar un `.md` cambia al agente aquí y en Claude Code.
- Los agentes **solo leen** ObrasSync (GET). No emiten, aprueban, pagan ni borran nada.
- Usa la API de Claude con el modelo `claude-opus-5-5` y respaldo automático si el modelo rechaza una consulta.

## Seguridad
- **WhatsApp:** solo responde a los números de `WA_NUMEROS_AUTORIZADOS`; se valida la firma de cada webhook con `WA_APP_SECRET`.
- **Correo:** solo responde a remitentes de `CORREO_PERMITIDOS` (por defecto `matfau.cl`) e ignora respuestas automáticas.
- En grupos, el agente lee todo pero solo responde cuando lo mencionan (`@agente`, `@matfau`) o le responden a un mensaje suyo.
- La memoria de conversación es corta (20 mensajes, 24 h) y vive en memoria: un reinicio la borra.

## Puesta en marcha

### 1. Número de WhatsApp (Meta)
1. Crea o usa la cuenta **Meta Business** de Matfau y verifica la empresa.
2. En developers.facebook.com crea una app tipo *Business* y agrega el producto **WhatsApp**.
3. Agrega un **número nuevo** (no puede estar usándose en la app de WhatsApp normal). Anota el *Phone number ID*.
4. Crea un **usuario del sistema** con permiso `whatsapp_business_messaging` y genera un token permanente → `WA_ACCESS_TOKEN`.
5. Copia el *App Secret* de la app → `WA_APP_SECRET`.
6. Webhook: URL `https://<tu-servicio>.up.railway.app/webhooks/whatsapp`, token de verificación = `WA_VERIFY_TOKEN`,
   y suscríbete al campo `messages` (y a los de grupos, si aparecen).
7. **Grupos:** la API oficial exige *Official Business Account* (check verde) y **no permite unirse a grupos existentes**.
   El número crea sus propios grupos (máx. 8 personas) y la gente entra por enlace:
   ```bash
   curl -X POST https://<servicio>/admin/grupos -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" -d '{"nombre":"Obra Los Andes – Agentes"}'
   curl https://<servicio>/admin/grupos/<ID_GRUPO>/enlace -H "Authorization: Bearer $ADMIN_TOKEN"
   ```
   ⚠️ Estas dos llamadas y el campo `group_id` del webhook siguen la API de grupos de Meta de 2025–2026;
   confírmalas contra la documentación vigente (están aisladas en `src/whatsapp.ts`).

### 2. Buzón agentes@matfau.cl (Microsoft 365)
1. En el centro de administración de Microsoft 365 crea el buzón `agentes@matfau.cl` (usuario con licencia o buzón compartido).
2. En **Entra ID → Registros de aplicaciones** crea una app; en *Permisos de API* agrega **Microsoft Graph → permisos de aplicación**
   `Mail.ReadWrite` y `Mail.Send`, y otorga consentimiento de administrador.
3. Crea un secreto de cliente. Anota *tenant ID*, *client ID* y el secreto → `M365_*`.
4. **Recomendado:** limita la app solo a ese buzón con una *Application Access Policy* (o RBAC for Applications de Exchange),
   para que no pueda leer otros buzones de la empresa.

### 3. Despliegue en Railway
1. Nuevo servicio desde este repositorio de GitHub.
2. Variables: todas las de `.env.example`, más `RAILWAY_DOCKERFILE_PATH=agentes/Dockerfile`. **No** definas *Root Directory*
   (el build necesita `.claude/agents` de la raíz).
3. Genera un dominio público y úsalo en el webhook de Meta.
4. Prueba: `GET /salud` y luego
   ```bash
   curl -X POST https://<servicio>/admin/probar -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" -d '{"texto":"¿Qué obras están atrasadas?"}'
   ```

## Desarrollo local
```bash
cd agentes && npm install && cp .env.example .env   # completa .env
npm run dev
```
