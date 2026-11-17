#!/usr/bin/env bash
# Consulta de solo lectura a la API de ObrasSync para los agentes de Matfau.
#
# Uso:   scripts/obs-api.sh /ruta[?query]
# Ej.:   scripts/obs-api.sh /dashboard/kpis
#        scripts/obs-api.sh "/expenses/summary?month=2026-11"
#
# Credenciales (variables de entorno, nunca en el repo):
#   OBRASSYNC_TOKEN               token Bearer ya emitido, o bien
#   OBRASSYNC_EMAIL + OBRASSYNC_PASSWORD  para iniciar sesión y obtener uno.
#   OBRASSYNC_API_URL             opcional; por defecto producción.
#
# Solo hace GET a propósito: los agentes analizan y recomiendan; cualquier
# cambio (emitir DTE, aprobar, pagar, borrar) lo hace una persona en la app.
set -euo pipefail

API="${OBRASSYNC_API_URL:-https://obrassync-backend-production.up.railway.app}"
RUTA="${1:?Indica la ruta, por ejemplo /dashboard/kpis}"
[[ "$RUTA" == /* ]] || RUTA="/$RUTA"

CACHE="${TMPDIR:-/tmp}/.obrassync-token-$(id -u)"

obtener_token() {
  if [[ -n "${OBRASSYNC_TOKEN:-}" ]]; then printf '%s' "$OBRASSYNC_TOKEN"; return; fi
  if [[ -s "$CACHE" && $(( $(date +%s) - $(stat -c %Y "$CACHE") )) -lt 3000 ]]; then cat "$CACHE"; return; fi
  : "${OBRASSYNC_EMAIL:?Falta OBRASSYNC_EMAIL o OBRASSYNC_TOKEN}"
  : "${OBRASSYNC_PASSWORD:?Falta OBRASSYNC_PASSWORD o OBRASSYNC_TOKEN}"
  local cuerpo token
  cuerpo=$(python3 -c 'import json,os;print(json.dumps({"email":os.environ["OBRASSYNC_EMAIL"],"password":os.environ["OBRASSYNC_PASSWORD"]}))')
  token=$(curl -sS -X POST "$API/auth/login" -H 'Content-Type: application/json' -d "$cuerpo" \
    | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("token","")) if d.get("ok") else sys.exit("Login rechazado: "+str(d.get("message","")))')
  ( umask 077; printf '%s' "$token" > "$CACHE" )
  printf '%s' "$token"
}

TOKEN=$(obtener_token)
curl -sS --fail-with-body -H "Authorization: Bearer $TOKEN" "$API$RUTA"
echo
