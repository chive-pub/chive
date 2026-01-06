#!/bin/bash
# ==============================================================================
# Chive Tunnel Script
# ==============================================================================
# Starts a tunnel for OAuth testing with real ATProto PDSes.
# Auto-detects ngrok or localtunnel and uses whichever is available.
#
# Usage:
#   ./scripts/tunnel.sh [port]
#
# Arguments:
#   port - Local port to tunnel (default: 3000)
#
# Prerequisites (one of):
#   - ngrok: brew install ngrok && ngrok config add-authtoken <token>
#   - localtunnel: npx localtunnel (no install required)
#
# Output:
#   Writes tunnel URL to /tmp/chive-tunnel-url.env for use by dev.sh
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=${1:-3000}

echo "🔗 Starting tunnel on port $PORT..."

# Auto-detect available tunnel tool
if command -v ngrok &> /dev/null; then
  echo "   Using ngrok..."

  # Start ngrok (check for custom config first)
  if [ -f "$SCRIPT_DIR/ngrok.yml" ]; then
    ngrok start chive-web --config "$SCRIPT_DIR/ngrok.yml" > /dev/null 2>&1 &
  else
    ngrok http $PORT > /dev/null 2>&1 &
  fi
  TUNNEL_PID=$!

  # Wait for ngrok to start
  sleep 3

  # Get URL from ngrok API
  TUNNEL_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*' | head -1 | cut -d'"' -f4)

  if [ -z "$TUNNEL_URL" ]; then
    # Try alternate parsing
    TUNNEL_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['tunnels'][0]['public_url'] if d.get('tunnels') else '')" 2>/dev/null || echo "")
  fi

elif npx localtunnel --version &> /dev/null 2>&1; then
  echo "   Using localtunnel..."

  # Start localtunnel (generates random subdomain)
  npx localtunnel --port $PORT > /tmp/lt-output.txt 2>&1 &
  TUNNEL_PID=$!

  # Wait for localtunnel to start
  sleep 5

  # Parse URL from output
  TUNNEL_URL=$(grep -o 'https://[^ ]*' /tmp/lt-output.txt 2>/dev/null | head -1)

else
  echo "❌ No tunnel tool found!"
  echo ""
  echo "Install one of the following:"
  echo ""
  echo "  Option 1: ngrok (recommended)"
  echo "    brew install ngrok"
  echo "    ngrok config add-authtoken <your-token>"
  echo ""
  echo "  Option 2: localtunnel (no install required)"
  echo "    Works automatically via npx"
  echo ""
  exit 1
fi

# Validate tunnel URL
if [ -z "$TUNNEL_URL" ] || [ "$TUNNEL_URL" = "null" ]; then
  echo "❌ Failed to get tunnel URL"
  [ -n "$TUNNEL_PID" ] && kill $TUNNEL_PID 2>/dev/null
  exit 1
fi

# Export for parent script
echo "TUNNEL_URL=$TUNNEL_URL" > /tmp/chive-tunnel-url.env
echo ""
echo "✅ Tunnel active!"
echo "   URL: $TUNNEL_URL"
echo ""

# Keep running (parent script will kill us on shutdown)
wait $TUNNEL_PID
