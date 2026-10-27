# =================================================================
# N5 Game Platform — Multi-Stage Production Dockerfile
# Lean, Non-Root, Secure, with Production Healthcheck & Migrations
# =================================================================

# -----------------------------------------------------------------
# Stage 1: Build React Admin Dashboard
# -----------------------------------------------------------------
FROM node:20-alpine AS admin-builder
WORKDIR /app/admin

COPY src/admin/package*.json ./
RUN npm config set fetch-retries 5 && npm ci --ignore-scripts

COPY src/admin ./
RUN npm run build

# -----------------------------------------------------------------
# Stage 2: Build TypeScript Backend & Prepare Production node_modules
# -----------------------------------------------------------------
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend

COPY src/backend/package*.json ./
RUN npm config set fetch-retries 5 && npm ci --ignore-scripts

COPY src/backend ./
RUN npm run build && npm prune --omit=dev --ignore-scripts

# -----------------------------------------------------------------
# Stage 3: Production Runner (Lean, Non-Root)
# -----------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV API_PREFIX=/api/v1
ENV MIGRATIONS_DIR=/app/database/migrations

# Copy production node_modules directly from builder (zero redundant network downloads)
COPY --from=backend-builder /app/backend/package*.json ./
COPY --from=backend-builder /app/backend/node_modules ./node_modules

# Copy compiled artifacts, web assets, and database migrations
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/public ./public
COPY --from=admin-builder /app/admin/dist ./admin/dist
COPY src/database ./database

# Enforce non-root execution for container security
RUN chown -R node:node /app
USER node

EXPOSE 8080

# Production Healthcheck using Node.js built-in HTTP client
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.PORT || 8080) + '/api/v1/health/live', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/server.js"]
