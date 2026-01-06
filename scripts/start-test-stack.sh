#!/bin/bash
# ==============================================================================
# Chive Test Stack Script
# ==============================================================================
# Starts the test infrastructure (PostgreSQL, Redis, Elasticsearch, Neo4j).
# Handles stale volumes and authentication issues automatically.
#
# Usage:
#   ./scripts/start-test-stack.sh
#   ./scripts/start-test-stack.sh --clean    # Force clean start
#
# Prerequisites:
#   - Docker Desktop running
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.yml"

# Expected credentials (must match docker-compose.yml)
NEO4J_PASSWORD="chive_test_password"
PG_PASSWORD="chive_test_password"

clean_start=false
if [[ "$1" == "--clean" ]]; then
  clean_start=true
fi

echo "Starting Chive test stack..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "Error: Docker is not running. Please start Docker Desktop."
  exit 1
fi

# Function to check Neo4j auth (Neo4j 5.x HTTP API)
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
  echo "Cleaning up stale volumes..."
  docker compose -f "$COMPOSE_FILE" down -v 2>/dev/null || true
  echo "Volumes cleaned."
}

# Force clean if requested
if $clean_start; then
  clean_volumes
fi

# Stop any running containers first to avoid conflicts
docker compose -f "$COMPOSE_FILE" down 2>/dev/null || true

# Start the test stack
docker compose -f "$COMPOSE_FILE" up -d

echo "Waiting for services to be ready..."

# Wait for PostgreSQL (max 30 seconds)
echo -n "  PostgreSQL: "
for i in {1..30}; do
  if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U chive > /dev/null 2>&1; then
    echo "ready"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "timeout"
    exit 1
  fi
  sleep 1
done

# Wait for Redis (max 30 seconds)
echo -n "  Redis: "
for i in {1..30}; do
  if docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo "ready"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "timeout"
    exit 1
  fi
  sleep 1
done

# Wait for Elasticsearch (max 60 seconds)
echo -n "  Elasticsearch: "
for i in {1..60}; do
  if curl -s http://localhost:9200/_cluster/health 2>/dev/null | grep -q '"status"'; then
    echo "ready"
    break
  fi
  if [ $i -eq 60 ]; then
    echo "timeout"
    exit 1
  fi
  sleep 1
done

# Wait for Neo4j (max 90 seconds, with up to 1 restart for auth issues)
echo -n "  Neo4j: "
neo4j_restart_count=0
neo4j_wait_count=0
neo4j_ready=false

while [ $neo4j_wait_count -lt 90 ] && [ "$neo4j_ready" = "false" ]; do
  neo4j_wait_count=$((neo4j_wait_count + 1))

  if curl -s http://localhost:7474 > /dev/null 2>&1; then
    # Neo4j HTTP is up, now check authentication
    sleep 2  # Give it a moment to fully initialize
    if check_neo4j_auth; then
      echo "ready"
      neo4j_ready=true
    elif [ $neo4j_restart_count -eq 0 ]; then
      # Auth failed on first attempt - likely stale volume with different password
      echo ""
      echo "  Neo4j authentication failed - cleaning stale data..."
      docker compose -f "$COMPOSE_FILE" stop neo4j
      docker compose -f "$COMPOSE_FILE" rm -f neo4j
      docker volume rm docker_neo4j_data docker_neo4j_logs 2>/dev/null || true
      docker compose -f "$COMPOSE_FILE" up -d neo4j
      neo4j_restart_count=1
      neo4j_wait_count=0  # Reset wait counter after restart
      echo -n "  Neo4j (restarted): "
    else
      # Auth still failing after restart - this is a real error
      echo "authentication failed"
      exit 1
    fi
  fi

  if [ $neo4j_wait_count -eq 90 ] && [ "$neo4j_ready" = "false" ]; then
    echo "timeout"
    exit 1
  fi

  sleep 1
done

echo ""
echo "Test stack is ready!"
echo ""
echo "Connection details:"
echo "  PostgreSQL: postgresql://chive:$PG_PASSWORD@127.0.0.1:5432/chive_test"
echo "  Redis:      redis://127.0.0.1:6379"
echo "  Elasticsearch: http://127.0.0.1:9200"
echo "  Neo4j:      bolt://127.0.0.1:7687 (neo4j/$NEO4J_PASSWORD)"
