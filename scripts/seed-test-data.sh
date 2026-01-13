#!/bin/bash
# ==============================================================================
# Seed Test Data
# ==============================================================================
# Seeds test data into PostgreSQL, Elasticsearch, and Neo4j.
# Can be run standalone or called by start-test-stack.sh.
#
# Usage:
#   ./scripts/seed-test-data.sh
#   pnpm seed:test
#
# Prerequisites:
#   - Test stack running (./scripts/start-test-stack.sh)
#   - Migrations completed
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Database credentials (must match docker-compose.yml)
export DATABASE_URL="${DATABASE_URL:-postgresql://chive:chive_test_password@127.0.0.1:5432/chive}"
export ELASTICSEARCH_URL="${ELASTICSEARCH_URL:-http://127.0.0.1:9200}"
export NEO4J_URI="${NEO4J_URI:-bolt://127.0.0.1:7687}"
export NEO4J_USER="${NEO4J_USER:-neo4j}"
export NEO4J_PASSWORD="${NEO4J_PASSWORD:-chive_test_password}"

echo "Seeding test data..."

# Run the TypeScript seed script
cd "$ROOT_DIR"
pnpm exec tsx scripts/seed-test-data.ts

echo "✓ Test data seeding complete"
