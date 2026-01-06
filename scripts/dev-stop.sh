#!/bin/bash
# ==============================================================================
# Chive Development Stop Script
# ==============================================================================
# Stops the development environment and cleans up.
#
# Usage:
#   ./scripts/dev-stop.sh [--all]
#
# Options:
#   --all    Also stop Docker containers (databases)
#            Without this flag, only dev processes are stopped.
#
# What it stops:
#   - Next.js dev server
#   - API server (tsx watch)
#   - ngrok tunnel (if running)
#   - Docker containers (with --all flag)
# ==============================================================================

set -e

STOP_DOCKER=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --all)
      STOP_DOCKER=true
      shift
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo "🛑 Stopping Chive development environment..."
echo ""

# Stop Node.js processes
echo "   Stopping dev servers..."
pkill -f "next dev" 2>/dev/null && echo "   ✓ Stopped Next.js" || echo "   - Next.js not running"
pkill -f "tsx.*watch.*src/index" 2>/dev/null && echo "   ✓ Stopped API server" || echo "   - API server not running"
pkill -f "tsx.*src/index" 2>/dev/null || true

# Stop tunnel
echo "   Stopping tunnel..."
pkill -f "ngrok" 2>/dev/null && echo "   ✓ Stopped ngrok" || echo "   - ngrok not running"
pkill -f "localtunnel" 2>/dev/null || true

# Clean up temp files
rm -f /tmp/chive-tunnel-url.env
rm -f /tmp/lt-output.txt

# Stop Docker containers
if [ "$STOP_DOCKER" = true ]; then
  echo "   Stopping Docker containers..."
  cd "$ROOT_DIR/docker"
  docker compose -f docker-compose.local.yml down 2>/dev/null && echo "   ✓ Stopped Docker containers" || echo "   - Docker containers not running"
else
  echo ""
  echo "   Note: Docker containers are still running."
  echo "   Use 'pnpm dev:stop --all' to also stop databases."
fi

echo ""
echo "✅ Done!"
echo ""
