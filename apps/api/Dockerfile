# CHOSN API image. Build from the REPOSITORY ROOT:
#   docker build -f apps/api/Dockerfile -t chosn-api .
# The image holds no secrets; every setting comes from the environment (see apps/api/.env.example).
# Migrations are plain SQL in apps/api/drizzle, applied at boot and by `node dist/scripts/migrate.js`.

# ---- build: install everything, compile TypeScript
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/config/package.json packages/config/
COPY packages/ui/package.json packages/ui/
RUN npm ci --ignore-scripts -w @chosn/api --include-workspace-root
COPY packages/config packages/config
COPY apps/api apps/api
RUN npm run build -w @chosn/api

# ---- deps: production dependencies only
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/config/package.json packages/config/
COPY packages/ui/package.json packages/ui/
RUN npm ci --ignore-scripts --omit=dev -w @chosn/api --include-workspace-root

# ---- runtime: small, non-root
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app/apps/api
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/drizzle ./drizzle
COPY apps/api/package.json ./package.json
# Media written by the news job and served at /media (mount a volume here, or move to object storage).
ENV MEDIA_DIR=/data/media
RUN mkdir -p /data/media && chown -R node:node /data
USER node
EXPOSE 4000
# Liveness only (no database call): the process is up and serving.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-4000}/health/live" >/dev/null || exit 1
CMD ["node", "dist/main.js"]
