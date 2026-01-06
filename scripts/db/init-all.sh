#!/bin/bash

# Initialize all databases for Chive.
#
# Runs migrations and schema setup for:
# - PostgreSQL
# - Elasticsearch
# - Neo4j
# - Redis (verification only)

set -e

echo "🗄️  Initializing Chive databases..."

# PostgreSQL migrations
echo "📊 Running PostgreSQL migrations..."
pnpm run db:migrate:up

# Elasticsearch templates
echo "🔍 Setting up Elasticsearch templates..."
pnpm exec tsx scripts/db/setup-elasticsearch.ts

# Neo4j schema
echo "🕸️  Setting up Neo4j schema..."
pnpm exec tsx scripts/db/setup-neo4j.ts

# Redis verification
echo "💾 Verifying Redis connection..."
pnpm exec tsx scripts/db/verify-redis.ts

echo "✅ All databases initialized successfully"
