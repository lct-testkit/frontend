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
	# demo signs in with the password grant using the BFF client secret baked into config.json; when the stack was
	# installed with generated secrets (deploy/scripts/gen_env.sh) the secret in Keycloak differs — take it from the env.
	if [ -n "${KEYCLOAK_CLIENT_SECRET:-}" ]; then
		sed -i "s/\"clientSecret\": *\"[^\"]*\"/\"clientSecret\": \"${KEYCLOAK_CLIENT_SECRET}\"/" /srv/config.json
	fi
fi

# Mail trap of the stand (deploy: MAIL_UI_URL=/mail/ when Mailpit is on): the SPA shows a «Почта стенда» link.
if [ -n "${MAIL_UI_URL:-}" ]; then
	case "$MAIL_UI_URL" in
		/*[!A-Za-z0-9/_-]* | //*) echo "web: MAIL_UI_URL must be a plain path like /mail/, ignored" >&2 ;;
		/*) sed -i "1s#^{\$#{\n\t\"mailUrl\": \"${MAIL_UI_URL}\",#" /srv/config.json ;;
		*) echo "web: MAIL_UI_URL must be a plain path like /mail/, ignored" >&2 ;;
	esac
fi

echo "web: mode=$MODE"
exec "$@"
