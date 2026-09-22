# Web client (SvelteKit SPA, static bundle) — the `web` image of the stack: served by Caddy on :3000 behind the main Caddy.
#
#   docker build -t rtk-crm-web .
#   docker run -p 3000:3000 -e APP_MODE=demo rtk-crm-web       # demo: account picker on the login screen
#   docker run -p 3000:3000 -e APP_MODE=prod rtk-crm-web       # prod: Keycloak sign-in only, no demo credentials shipped
#
# The build needs ./vendor/lct-testkit-rt-ui-*.tgz (private design-system package) and ./static/fonts/*.woff
# (Rostelecom Basis, licensed) — both are provided by the customer and are not in git.

# ---- build -------------------------------------------------------------------------------------------------
FROM node:22-alpine AS build
RUN npm install -g pnpm@11.13.1
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY vendor ./vendor
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ---- runtime -------------------------------------------------------------------------------------------------
# 2.11, not 2.8: Trivy (22.09.2026) found 87 CVEs in 2.8.4 (5 CRITICAL) with fixes only released in the 2.11.x
# line upstream — see .trivyignore for what's left (all transitive Go deps baked into the caddy binary itself,
# not fixable from this Dockerfile; 0 CRITICAL, 0 in the Alpine OS layer).
FROM caddy:2.11-alpine
COPY --from=build /app/build /srv
COPY deploy/Caddyfile.web /etc/caddy/Caddyfile
COPY deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -q -O /dev/null http://127.0.0.1:3000/config.json || exit 1
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
