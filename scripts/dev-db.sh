#!/bin/bash
# ==============================================================================
# Chive Development Database Script
# ==============================================================================
# Starts the development database stack (PostgreSQL, Redis, Elasticsearch, Neo4j).
# Handles stale volumes and authentication issues automatically.
#
# Usage:
#   ./scripts/dev-db.sh
#   ./scripts/dev-db.sh --clean    # Force clean start (removes all data)
#
# Prerequisites:
#   - Docker Desktop running
#   - docker-compose.local.yml exists in docker/
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.local.yml"

# Expected credentials (must match docker-compose.local.yml)
NEO4J_PASSWORD="chive_local_password"

clean_start=false
if [[ "$1" == "--clean" ]]; then
  clean_start=true
fi

echo "📦 Starting databases..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker Desktop."
  exit 1
fi

# Function to check Neo4j auth
check_neo4j_auth() {
  local response
  response=$(curl -s -u "neo4j:$NEO4J_PASSWORD" \
    -H "Content-Type: application/json" \
    -d '{"statements":[{"statement":"RETURN 1"}]}' \
    http://localhost:7474/db/neo4j/tx/commit 2>/dev/null)
  echo "$response" | grep -q '"errors":\[\]'
  return $?
}

# Function to clean up volumes
clean_volumes() {
  echo "🧹 Cleaning up stale volumes..."
  cd "$ROOT_DIR/docker"
  docker compose -f docker-compose.local.yml down -v 2>/dev/null || true
  echo "   Volumes cleaned."
}

# Force clean if requested
if $clean_start; then
  clean_volumes
fi

# Use docker-compose.local.yml but only the database services
cd "$ROOT_DIR/docker"
docker compose -f docker-compose.local.yml up -d postgres redis elasticsearch neo4j

# Wait for health checks
echo "⏳ Waiting for databases to be healthy..."

# PostgreSQL
echo -n "   PostgreSQL: "
for i in {1..30}; do
  if docker compose -f docker-compose.local.yml exec -T postgres pg_isready -U chive > /dev/null 2>&1; then
    echo "✓"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "✗ (timeout)"
    exit 1
  fi
  sleep 1
done

# Redis
echo -n "   Redis: "
for i in {1..30}; do
  if docker compose -f docker-compose.local.yml exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo "✓"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "✗ (timeout)"
    exit 1
  fi
  sleep 1
done

# Elasticsearch
echo -n "   Elasticsearch: "
for i in {1..60}; do
  if curl -s http://127.0.0.1:9200/_cluster/health > /dev/null 2>&1; then
    echo "✓"
    break
  fi
  if [ $i -eq 60 ]; then
    echo "✗ (timeout)"
    exit 1
  fi
  sleep 1
done

# Neo4j with auto-recovery for stale volumes
echo -n "   Neo4j: "
neo4j_restart_count=0
neo4j_wait_count=0
neo4j_ready=false

while [ $neo4j_wait_count -lt 90 ] && [ "$neo4j_ready" = "false" ]; do
  neo4j_wait_count=$((neo4j_wait_count + 1))

  if curl -s http://127.0.0.1:7474 > /dev/null 2>&1; then
    # Neo4j HTTP is up, now check authentication
    sleep 2
    if check_neo4j_auth; then
      echo "✓"
      neo4j_ready=true
    elif [ $neo4j_restart_count -eq 0 ]; then
      # Auth failed on first attempt - likely stale volume with different password
      echo ""
      echo "   ⚠️  Neo4j authentication failed - cleaning stale data..."
      docker compose -f docker-compose.local.yml stop neo4j
      docker compose -f docker-compose.local.yml rm -f neo4j
      docker volume rm docker_neo4j_data docker_neo4j_logs 2>/dev/null || true
      docker compose -f docker-compose.local.yml up -d neo4j
      neo4j_restart_count=1
      neo4j_wait_count=0
      echo -n "   Neo4j (restarted): "
    else
      echo "✗ (authentication failed)"
      echo ""
      echo "❌ Neo4j authentication still failing after restart."
      echo "   Try: ./scripts/dev-db.sh --clean"
      exit 1
    fi
  fi

  if [ $neo4j_wait_count -eq 90 ] && [ "$neo4j_ready" = "false" ]; then
    echo "✗ (timeout)"
    exit 1
  fi

  sleep 1
done

# Run migrations if clean start (tables don't exist)
if $clean_start; then
  echo ""
  echo "🔄 Running database migrations..."
  cd "$ROOT_DIR"
  export POSTGRES_HOST=127.0.0.1
  export POSTGRES_PORT=5432
  export POSTGRES_DB=chive
  export POSTGRES_USER=chive
  export POSTGRES_PASSWORD=chive_local_password
  pnpm db:migrate:up || {
    echo "❌ Migration failed"
    exit 1
  }
fi

echo ""
echo "✅ All databases ready!"
echo ""
echo "Connection details:"
echo "   PostgreSQL: postgresql://chive:chive_local_password@127.0.0.1:5432/chive"
echo "   Redis:      redis://127.0.0.1:6379"
echo "   Elasticsearch: http://127.0.0.1:9200"
echo "   Neo4j:      bolt://127.0.0.1:7687 (neo4j/chive_local_password)"
