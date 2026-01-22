# Web frontend Dockerfile for Chive
# Multi-stage build for optimized production image

FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json ./web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @chive/web

# Build the application
FROM base AS builder
RUN apk add --no-cache bash
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/web/node_modules ./web/node_modules
COPY web ./web
COPY lexicons ./lexicons
COPY scripts ./scripts
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Generate lexicon types from JSON schemas
RUN pnpm lexicons:generate

WORKDIR /app/web
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Validate required environment variables at build time
RUN if [ -z "$NEXT_PUBLIC_API_URL" ]; then \
      echo ""; \
      echo "========================================"; \
      echo "ERROR: NEXT_PUBLIC_API_URL is required"; \
      echo "========================================"; \
      echo ""; \
      echo "This variable must be set at build time."; \
      echo "Example: docker build --build-arg NEXT_PUBLIC_API_URL=https://example.com/api"; \
      echo ""; \
      exit 1; \
    fi

RUN pnpm build

# Production image
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output (includes web/server.js structure for monorepo)
COPY --from=builder --chown=nextjs:nodejs /app/web/.next/standalone ./
# Copy static files to where the server expects them (web/.next/static for monorepo)
COPY --from=builder --chown=nextjs:nodejs /app/web/.next/static ./web/.next/static
# Copy public folder to where the server expects it (web/public for monorepo)
COPY --from=builder /app/web/public ./web/public

USER nextjs

EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

CMD ["node", "web/server.js"]
