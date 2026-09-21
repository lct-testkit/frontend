#!/bin/sh
# Writes /srv/config.json from the environment at container start (one image serves demo and prod).
set -eu

MODE="${APP_MODE:-demo}"

if [ "$MODE" = "prod" ]; then
	# prod: no demo accounts, no client secret — the browser only ever talks to Keycloak through the backend's OIDC redirect
	cat > /srv/config.json <<JSON
{
	"mode": "prod",
	"appName": "${APP_NAME:-CRM ИТ Школы}",
	"keycloak": { "path": "/auth", "realm": "${KEYCLOAK_REALM:-crm}", "clientId": "${KEYCLOAK_CLIENT_ID:-crm-bff}" }
}
JSON
else
	# demo: keep the baked accounts, only make the mode explicit
	sed -i 's/"mode": *"[a-z]*"/"mode": "demo"/' /srv/config.json
fi

echo "web: mode=$MODE"
exec "$@"
