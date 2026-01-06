#!/bin/bash
# Generate TypeScript types from OpenAPI spec
#
# Usage: ./scripts/generate-api-types.sh [--local]
#
# Options:
#   --local    Use local backend (http://127.0.0.1:3001/openapi.json)
#              Default: production (https://api.chive.pub/openapi.json)
#
# This script fetches the OpenAPI specification from the backend and generates
# TypeScript types for the frontend API client.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Default to local in development
API_URL="http://127.0.0.1:3001/openapi.json"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --local)
      API_URL="http://127.0.0.1:3001/openapi.json"
      shift
      ;;
    --production)
      API_URL="https://api.chive.pub/openapi.json"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

OUTPUT_FILE="$PROJECT_ROOT/web/lib/api/schema.generated.ts"

echo "📥 Fetching OpenAPI spec from $API_URL..."

# Check if the API is reachable
if ! curl -sf "$API_URL" > /dev/null 2>&1; then
  echo "❌ Error: Cannot reach $API_URL"
  echo "   Make sure the API server is running (./scripts/dev.sh)"
  exit 1
fi

echo "🔧 Generating TypeScript types..."

# Generate types using openapi-typescript
pnpm exec openapi-typescript "$API_URL" -o "$OUTPUT_FILE"

echo "✅ Types generated at $OUTPUT_FILE"
echo ""
echo "To use the generated types, update your API client imports:"
echo "  import type { paths, components } from '@/lib/api/schema.generated'"
