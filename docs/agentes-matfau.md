# Agentes de Matfau

Equipo de agentes de Claude Code que analiza la operación de Matfau usando los datos de ObrasSync.

```
                    matfau-gerente  (principal)
   ┌──────────────┬───────────┼──────────┬───────────────┐
operaciones    finanzas     ventas      rrhh       prevencion
```

| Agente | Área |
|---|---|
| `matfau-gerente` | Gerencia general: coordina a los demás y entrega la síntesis ejecutiva |
| `matfau-operaciones` | Avance de obras, Gantt, atrasos, visitas, fotos, inventario |
| `matfau-finanzas` | Gastos, centros de costo, estado de resultado, DTE/SII, Nubox, rendiciones |
| `matfau-ventas` | Cotizaciones, clientes, licitaciones de Mercado Público |
| `matfau-rrhh` | Trabajadores, remuneraciones, usuarios y permisos |
| `matfau-prevencion` | Charlas, documentación de seguridad, Ley 16.744, DS 44 |

Las definiciones están en `.claude/agents/`. Todos son **de solo lectura**: consultan la API con GET
(`scripts/obs-api.sh`) y recomiendan; las acciones (emitir, aprobar, pagar, borrar) las hace una persona en la app.

## Configurar credenciales

Crea un usuario de ObrasSync para los agentes (idealmente con rol de solo consulta) y define, fuera del repositorio:

```bash
export OBRASSYNC_EMAIL="agente@matfau.cl"
export OBRASSYNC_PASSWORD="..."
# o bien un token ya emitido:
export OBRASSYNC_TOKEN="..."
```

En Claude Code en la web, ponlas como variables del entorno de la sesión, no en archivos del repo.

Prueba: `scripts/obs-api.sh /dashboard/kpis`

## Uso

Iniciar Claude Code con el gerente como agente principal (puede delegar en los cinco de área):

```bash
claude --agent matfau-gerente
```

Ejemplos:
- "¿Cómo vamos este mes? Dame el informe para el directorio."
- "¿Qué obras están en riesgo y por qué?"

En una sesión normal también puedes llamar a un área directamente:
- "Usa matfau-finanzas para ver qué facturas llevan más de 60 días sin cobrar."
- "Pídele a matfau-prevencion las charlas que faltan esta semana."

## WhatsApp y correo

El mismo equipo responde por WhatsApp (número propio, API oficial de Meta) y por correo (`asistente@matfau.cl`, Microsoft 365).
El servicio está en `agentes/`; la guía de configuración y despliegue en Railway está en `agentes/README.md`.
