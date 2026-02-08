# syntax=docker/dockerfile:1.6

# =============================================================================
# Chive Application Dockerfile
# =============================================================================
# Multi-stage build for Node.js 22 application
# Produces a minimal (~200MB) production image
#
# Build: docker build -t chive:latest -f docker/Dockerfile .
# Run:   docker run -p 3000:3000 --env-file .env.production chive:latest
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Base - Common setup for all stages
# -----------------------------------------------------------------------------
FROM node:22-alpine AS base

# Install pnpm globally
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# -----------------------------------------------------------------------------
# Stage 2: Dependencies - Install all dependencies
# -----------------------------------------------------------------------------
FROM base AS deps

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including devDependencies for build)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 3: Builder - Compile TypeScript
# -----------------------------------------------------------------------------
FROM base AS builder

# Install bash for scripts that require it
RUN apk add --no-cache bash

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code and scripts
COPY package.json pnpm-lock.yaml tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY scripts ./scripts
COPY lexicons ./lexicons

# Generate lexicon types from JSON schemas
RUN pnpm lexicons:generate

# Build TypeScript to JavaScript (use build config that excludes tests)
RUN pnpm exec tsc --project tsconfig.build.json

# Copy config files that TypeScript doesn't handle
# Elasticsearch templates, ILM policies, and ingest pipelines
RUN cp -r src/storage/elasticsearch/templates dist/src/storage/elasticsearch/ && \
    cp -r src/storage/elasticsearch/ilm dist/src/storage/elasticsearch/ && \
    cp -r src/storage/elasticsearch/pipelines dist/src/storage/elasticsearch/

# Neo4j schema (Cypher scripts for indexes and constraints)
RUN cp -r src/storage/neo4j/schema dist/src/storage/neo4j/

# Prune devDependencies for production (ignore-scripts to skip husky)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm prune --prod --ignore-scripts

# -----------------------------------------------------------------------------
# Stage 4: Production - Minimal runtime image
# -----------------------------------------------------------------------------
FROM node:22-alpine AS production

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup --system --gid 1001 chive && \
    adduser --system --uid 1001 --ingroup chive chive

# Set working directory
WORKDIR /app

# Copy production dependencies and built code
COPY --from=builder --chown=chive:chive /app/node_modules ./node_modules
COPY --from=builder --chown=chive:chive /app/dist ./dist
COPY --from=builder --chown=chive:chive /app/package.json ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose application port
EXPOSE 3000

# Health check - calls the /health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Switch to non-root user
USER chive

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "--enable-source-maps", "dist/src/index.js"]

# -----------------------------------------------------------------------------
# Stage 5: Development - Full development environment
# -----------------------------------------------------------------------------
FROM base AS development

# Copy all dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Set development environment
ENV NODE_ENV=development
ENV PORT=3000

# Expose application port
EXPOSE 3000

# Start with hot-reload using tsx
CMD ["pnpm", "run", "dev"]
