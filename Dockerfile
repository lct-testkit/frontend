# Web client (SvelteKit SPA, static bundle) — the `web` image of the stack: served by Caddy on :3000 behind the main Caddy.
#
#   docker build -t rtk-crm-web .
#   docker run -p 3000:3000 -e APP_MODE=demo rtk-crm-web       # demo: account picker on the login screen
#   docker run -p 3000:3000 -e APP_MODE=prod rtk-crm-web       # prod: Keycloak sign-in only, no demo credentials shipped
#
# The build needs read access to the private design-system package @lct-testkit/rt-ui (GitHub Packages): pass a token as the
# BuildKit secret `npm_token` (docker build --secret id=npm_token,env=NODE_AUTH_TOKEN .), and, optionally,
# ./static/fonts/*.woff (Rostelecom Basis, licensed, not in git; without it the fallback font is used).
#
# Supply chain: both base images are pinned by digest (dependabot bumps them), the package manager is
# pinned to the exact version, dependencies are installed with --frozen-lockfile.

# ---- build -------------------------------------------------------------------------------------------------
# --platform=$BUILDPLATFORM: результат сборки — статика (HTML/JS/CSS), от архитектуры не зависит, поэтому тяжёлые
# `pnpm install` и `vite build` исполняются один раз НАТИВНО на машине сборщика, а не под QEMU для каждой целевой
# платформы multi-arch образа (linux/amd64 + linux/arm64). Под эмуляцией на 2 vCPU это были бы десятки минут.
# Digest указывает на multi-arch индекс, так что подходит для любой архитектуры сборщика.
FROM --platform=$BUILDPLATFORM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS build
RUN npm install -g pnpm@11.13.1
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
# The token goes into a throw-away USER-level npmrc (pnpm 11 ignores auth in a project .npmrc) that is deleted in the same RUN.
RUN --mount=type=secret,id=npm_token \
    --mount=type=cache,target=/root/.local/share/pnpm/store \
    printf '//npm.pkg.github.com/:_authToken=%s\n' "$(cat /run/secrets/npm_token)" > /tmp/npmrc \
    && NPM_CONFIG_USERCONFIG=/tmp/npmrc pnpm install --frozen-lockfile \
    && rm -f /tmp/npmrc
COPY . .
RUN pnpm build

# ---- runtime -------------------------------------------------------------------------------------------------
# 2.11, not 2.8: Trivy (22.09.2026) found 87 CVEs in 2.8.4 (5 CRITICAL) with fixes only released in the 2.11.x
# line upstream — see .trivyignore for what's left (all transitive Go deps baked into the caddy binary itself,
# not fixable from this Dockerfile; 0 CRITICAL, 0 in the Alpine OS layer).
FROM caddy:2.11-alpine@sha256:6aeddd44c3078b0f9a35206472a11420648a79c184603ef95957d0a20044cb2b

LABEL org.opencontainers.image.source="https://github.com/lct-testkit/frontend" \
      org.opencontainers.image.title="rtk-crm-web" \
      org.opencontainers.image.description="CRM ИТ Школы Ростелекома — веб-клиент (SPA за Caddy)"

# Unprivileged user: :3000 needs no privileges. /srv is writable because the entrypoint writes /srv/config.json
# at start; /data and /config are Caddy's state directories.
RUN adduser -D -u 10001 web \
    && chown -R web:web /data /config /srv
COPY --from=build --chown=web:web /app/build /srv
COPY deploy/Caddyfile.web /etc/caddy/Caddyfile
COPY --chmod=0755 deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
USER web
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -q -O /dev/null http://127.0.0.1:3000/config.json || exit 1
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
