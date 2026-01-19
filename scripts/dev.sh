#!/bin/bash
# ==============================================================================
# Chive Development Script
# ==============================================================================
# Single command to start the full Chive development environment.
#
# Usage:
#   ./scripts/dev.sh [local|tunnel] [--clean]
#
# Modes:
#   local  - Default. Uses 127.0.0.1 for ATProto loopback OAuth.
#            Best for: UI development, API testing, component work.
#
#   tunnel - Uses ngrok for real OAuth with Bluesky.
#            Best for: Testing OAuth flows, integration testing.
#
# Options:
#   --clean - Force clean database start (removes all data volumes)
#
# What it starts:
#   1. Docker databases (PostgreSQL, Redis, Elasticsearch, Neo4j)
#   2. Backend API on http://127.0.0.1:3001 (with hot reload)
#   3. Frontend on http://127.0.0.1:3000 (Next.js dev server)
#   4. Tunnel (tunnel mode only)
#
# Prerequisites:
#   - Docker Desktop running
#   - Node.js 22+
#   - pnpm 9+
#   - ngrok (tunnel mode only): brew install ngrok
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
LOCKFILE="/tmp/chive-dev.lock"
PIDFILE="/tmp/chive-dev.pids"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
MODE="local"
CLEAN_FLAG=""

for arg in "$@"; do
  case $arg in
    local|tunnel)
      MODE="$arg"
      ;;
    --clean)
      CLEAN_FLAG="--clean"
      ;;
    stop)
      # Stop any running dev environment
      echo -e "${YELLOW}🛑 Stopping Chive development environment...${NC}"
      "$SCRIPT_DIR/dev.sh" --internal-stop
      exit 0
      ;;
    --internal-stop)
      # Internal: actually perform the stop
      if [ -f "$PIDFILE" ]; then
        while read -r pid; do
          kill "$pid" 2>/dev/null || true
        done < "$PIDFILE"
        rm -f "$PIDFILE"
      fi
      # Kill any orphaned processes
      pkill -f "ngrok http 3000" 2>/dev/null || true
      pkill -f "tsx watch src/index.ts" 2>/dev/null || true
      pkill -f "next dev.*3000" 2>/dev/null || true
      # Kill by port as fallback
      lsof -ti:3000 | xargs kill -9 2>/dev/null || true
      lsof -ti:3001 | xargs kill -9 2>/dev/null || true
      rm -f "$LOCKFILE" /tmp/chive-tunnel-url.env
      echo -e "${GREEN}✅ Stopped${NC}"
      exit 0
      ;;
    *)
      echo -e "${RED}❌ Unknown argument: $arg${NC}"
      echo "   Usage: ./scripts/dev.sh [local|tunnel] [--clean]"
      echo "          ./scripts/dev.sh stop"
      exit 1
      ;;
  esac
done

# =============================================================================
# Check for existing instance and clean up
# =============================================================================
if [ -f "$LOCKFILE" ]; then
  OLD_MODE=$(cat "$LOCKFILE" 2>/dev/null || echo "unknown")
  echo -e "${YELLOW}⚠️  Found existing dev environment (mode: $OLD_MODE)${NC}"
  echo "   Cleaning up before starting new instance..."
  "$SCRIPT_DIR/dev.sh" --internal-stop
  sleep 2
fi

# Create lockfile
echo "$MODE" > "$LOCKFILE"

# Track PIDs for cleanup
> "$PIDFILE"
TUNNEL_PID=""
API_PID=""
INDEXER_PID=""
WEB_PID=""

# Cleanup handler
cleanup() {
  echo ""
  echo -e "${YELLOW}🛑 Shutting down Chive...${NC}"

  # Kill processes in reverse order
  [ -n "$WEB_PID" ] && kill $WEB_PID 2>/dev/null || true
  [ -n "$INDEXER_PID" ] && kill $INDEXER_PID 2>/dev/null || true
  [ -n "$API_PID" ] && kill $API_PID 2>/dev/null || true
  [ -n "$TUNNEL_PID" ] && kill $TUNNEL_PID 2>/dev/null || true

  # Also kill by pattern to catch any stragglers
  pkill -f "ngrok http 3000" 2>/dev/null || true
  pkill -f "tsx watch src/indexer.ts" 2>/dev/null || true

  # Clean up temp files
  rm -f "$LOCKFILE" "$PIDFILE" /tmp/chive-tunnel-url.env /tmp/lt-output.txt

  echo -e "${GREEN}   Goodbye!${NC}"
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

echo ""
echo -e "${GREEN}🚀 Starting Chive in ${BLUE}$MODE${GREEN} mode...${NC}"
if [ -n "$CLEAN_FLAG" ]; then
  echo "   (with clean database start)"
fi
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

# =============================================================================
# Step 1: Start databases
# =============================================================================
echo -e "${BLUE}📦 [1/4] Starting databases...${NC}"
"$SCRIPT_DIR/dev-db.sh" $CLEAN_FLAG
echo ""

# =============================================================================
# Step 2: Start tunnel (if tunnel mode) - BEFORE generating env
# =============================================================================
TUNNEL_URL=""
if [ "$MODE" = "tunnel" ]; then
  echo -e "${BLUE}🔗 [2/4] Starting tunnel...${NC}"

  # Check ngrok is available
  if ! command -v ngrok &> /dev/null; then
    echo -e "${RED}❌ ngrok not found!${NC}"
    echo ""
    echo "   Install ngrok:"
    echo "     brew install ngrok"
    echo "     ngrok config add-authtoken <your-token>"
    echo ""
    echo "   Get your auth token at: https://dashboard.ngrok.com/get-started/your-authtoken"
    exit 1
  fi

  # Kill any existing ngrok
  pkill -f "ngrok http 3000" 2>/dev/null || true
  sleep 1

  # Start ngrok with custom domain
  ngrok http 3000 --domain=chive.ngrok.app > /dev/null 2>&1 &
  TUNNEL_PID=$!
  echo $TUNNEL_PID >> "$PIDFILE"

  # Wait for ngrok to start and get URL
  echo "   Waiting for tunnel..."
  for i in {1..15}; do
    sleep 1
    TUNNEL_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*' | head -1 | cut -d'"' -f4 || echo "")
    if [ -n "$TUNNEL_URL" ]; then
      break
    fi
  done

  if [ -z "$TUNNEL_URL" ]; then
    echo -e "${RED}❌ Failed to get tunnel URL. Is ngrok configured?${NC}"
    echo "   Run: ngrok config add-authtoken <your-token>"
    exit 1
  fi

  echo -e "${GREEN}   ✅ Tunnel active: $TUNNEL_URL${NC}"
  echo ""
else
  echo -e "${BLUE}⏭️  [2/4] Skipping tunnel (local mode)...${NC}"
  echo ""
fi

# =============================================================================
# Step 3: Generate environment
# =============================================================================
echo -e "${BLUE}⚙️  [3/4] Generating environment...${NC}"

# Determine OAuth URL
if [ "$MODE" = "tunnel" ] && [ -n "$TUNNEL_URL" ]; then
  OAUTH_URL="$TUNNEL_URL"
else
  OAUTH_URL="http://127.0.0.1:3000"
fi

# Generate web/.env.local
cat > "$ROOT_DIR/web/.env.local" << EOF
# ==============================================================================
# Auto-generated by scripts/dev.sh
# Mode: $MODE | Generated: $(date)
# ==============================================================================
# DO NOT COMMIT THIS FILE - it's in .gitignore

# OAuth configuration
NEXT_PUBLIC_OAUTH_BASE_URL=$OAUTH_URL

# Backend API URL
NEXT_PUBLIC_API_URL=http://127.0.0.1:3001

# Development mode
NEXT_PUBLIC_DEV_MODE=$MODE
EOF

echo -e "${GREEN}   ✅ Generated web/.env.local${NC}"
echo "      OAUTH_BASE_URL: $OAUTH_URL"
echo ""

# =============================================================================
# Step 4: Start services
# =============================================================================
echo -e "${BLUE}🖥️  [4/4] Starting services...${NC}"
cd "$ROOT_DIR"

# Source .env if it exists (for API configuration)
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
fi

# Start API server
echo "   Starting API server on :3001..."
PORT=3001 npx tsx watch src/index.ts 2>&1 | sed 's/^/   [API] /' &
API_PID=$!
echo $API_PID >> "$PIDFILE"

# Wait for API to be ready
echo "   Waiting for API..."
for i in {1..30}; do
  if curl -s http://127.0.0.1:3001/health > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ API ready${NC}"
    break
  fi
  sleep 1
done

# Start firehose indexer (consumes pub.chive.* records from ATProto relay)
echo "   Starting firehose indexer..."
npx tsx watch src/indexer.ts 2>&1 | sed 's/^/   [IDX] /' &
INDEXER_PID=$!
echo $INDEXER_PID >> "$PIDFILE"
echo -e "${GREEN}   ✅ Indexer started${NC}"

# Start frontend
echo "   Starting frontend on :3000..."
cd "$ROOT_DIR/web"
pnpm dev --port 3000 --hostname 127.0.0.1 2>&1 | sed 's/^/   [WEB] /' &
WEB_PID=$!
echo $WEB_PID >> "$PIDFILE"
cd "$ROOT_DIR"

# Wait for frontend to be ready
echo "   Waiting for frontend..."
for i in {1..30}; do
  if curl -s http://127.0.0.1:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Frontend ready${NC}"
    break
  fi
  sleep 1
done

# =============================================================================
# Ready!
# =============================================================================
echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ Chive is running!${NC}"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
if [ "$MODE" = "tunnel" ]; then
  echo -e "   ${GREEN}🌐 Open: $TUNNEL_URL${NC}"
  echo "      (Use this URL for Bluesky OAuth login)"
  echo ""
fi
echo "   Local URLs:"
echo "      Frontend:  http://127.0.0.1:3000"
echo "      Backend:   http://127.0.0.1:3001"
echo "      API Docs:  http://127.0.0.1:3001/docs"
echo ""
echo "   Background Services:"
echo "      Firehose Indexer: Consuming pub.chive.* from wss://bsky.network"
echo "      PDS Scanner:      Scanning registered PDSes every 15 minutes"
echo ""
echo "   Databases:"
echo "      PostgreSQL:    postgresql://chive:chive_test_password@127.0.0.1:5432/chive"
echo "      Redis:         redis://127.0.0.1:6379"
echo "      Elasticsearch: http://127.0.0.1:9200"
echo "      Neo4j:         http://127.0.0.1:7474 (neo4j/chive_test_password)"
echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

# Wait for processes (this keeps the script running)
wait
