#!/bin/bash
# Export OpenAPI spec from running API server
#
# Usage: ./scripts/export-openapi.sh
#
# Prerequisites: API server must be running (pnpm dev)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

API_URL="${API_URL:-http://127.0.0.1:3001/openapi.json}"
OUTPUT_FILE="$DOCS_ROOT/openapi/chive-api.json"

echo "Fetching OpenAPI spec from $API_URL..."

if ! curl -sf "$API_URL" > /dev/null 2>&1; then
  echo "Error: Cannot reach $API_URL"
  echo "Make sure the API server is running (pnpm dev)"
  exit 1
fi

curl -s "$API_URL" | jq '.' > "$OUTPUT_FILE"

echo "OpenAPI spec saved to $OUTPUT_FILE"
echo ""
echo "Now run: pnpm docusaurus gen-api-docs all"
