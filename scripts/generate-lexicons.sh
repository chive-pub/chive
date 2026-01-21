#!/bin/bash
set -e

echo "Generating TypeScript types from Lexicon schemas using @atproto/lex-cli..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

SERVER_OUTPUT_DIR="$ROOT_DIR/src/lexicons/generated"
WEB_OUTPUT_DIR="$ROOT_DIR/web/lib/api/generated"
LEXICONS_DIR="$ROOT_DIR/lexicons"
ATPROTO_LEXICONS_DIR="$ROOT_DIR/lexicons/com"

# =============================================================================
# Download ATProto base lexicons if not present
# =============================================================================

if [ ! -d "$ATPROTO_LEXICONS_DIR" ]; then
  echo "Downloading ATProto base lexicons..."
  TEMP_DIR=$(mktemp -d)
  curl -sL "https://github.com/bluesky-social/atproto/archive/refs/heads/main.zip" -o "$TEMP_DIR/atproto.zip"
  unzip -q "$TEMP_DIR/atproto.zip" -d "$TEMP_DIR"

  # Copy only the com/atproto/repo lexicons (needed for record CRUD operations)
  mkdir -p "$LEXICONS_DIR/com/atproto/repo"
  cp "$TEMP_DIR/atproto-main/lexicons/com/atproto/repo/"*.json "$LEXICONS_DIR/com/atproto/repo/"

  rm -rf "$TEMP_DIR"
  echo "✅ Downloaded ATProto base lexicons"
fi

# =============================================================================
# Generate server types
# =============================================================================

echo "Generating server types..."
rm -rf "$SERVER_OUTPUT_DIR"
mkdir -p "$SERVER_OUTPUT_DIR"

npx @atproto/lex-cli gen-server --yes "$SERVER_OUTPUT_DIR" $(find "$LEXICONS_DIR" -name "*.json" | xargs)

# Post-process server files for NodeNext module resolution
echo "Fixing server import paths for NodeNext module resolution..."
find "$SERVER_OUTPUT_DIR" -name "*.ts" -type f | while read -r file; do
  sed -i.bak -E "s/from '(\\.\\.\\/[^']+)'/from '\\1.js'/g; s/from '(\\.\\.\\/[^']+)\\.js\\.js'/from '\\1.js'/g" "$file"
  rm -f "$file.bak"
done

# Add @ts-nocheck to server files
echo "Adding @ts-nocheck to server files..."
find "$SERVER_OUTPUT_DIR" -name "*.ts" -type f | while read -r file; do
  if ! grep -q "^// @ts-nocheck" "$file"; then
    echo "// @ts-nocheck" | cat - "$file" > "$file.tmp" && mv "$file.tmp" "$file"
  fi
done

echo "✅ Server lexicon generation complete: $SERVER_OUTPUT_DIR"

# =============================================================================
# Generate web client types
# =============================================================================

echo "Generating web client types..."
rm -rf "$WEB_OUTPUT_DIR"
mkdir -p "$WEB_OUTPUT_DIR"

npx @atproto/lex-cli gen-api --yes "$WEB_OUTPUT_DIR" $(find "$LEXICONS_DIR" -name "*.json" | xargs)

# Post-process web client files for NodeNext module resolution
echo "Fixing web client import paths for NodeNext module resolution..."
find "$WEB_OUTPUT_DIR" -name "*.ts" -type f | while read -r file; do
  sed -i.bak -E "s/from '(\\.\\.\\/[^']+)'/from '\\1.js'/g; s/from '(\\.\\.\\/[^']+)\\.js\\.js'/from '\\1.js'/g" "$file"
  rm -f "$file.bak"
done

# Add @ts-nocheck to web client files to suppress strict type errors
echo "Adding @ts-nocheck to web client files..."
find "$WEB_OUTPUT_DIR" -name "*.ts" -type f | while read -r file; do
  if ! grep -q "^// @ts-nocheck" "$file"; then
    echo "// @ts-nocheck" | cat - "$file" > "$file.tmp" && mv "$file.tmp" "$file"
  fi
done

echo "✅ Web client lexicon generation complete: $WEB_OUTPUT_DIR"

# =============================================================================
# Summary
# =============================================================================

echo ""
echo "✅ Lexicon code generation complete"
echo "   Server types: $SERVER_OUTPUT_DIR"
echo "   Web client:   $WEB_OUTPUT_DIR"
