#!/bin/bash
# Comprehensive documentation rebuild script
# Cleans and regenerates all documentation including TypeDoc and OpenAPI docs

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Chive Documentation Rebuild ==="
echo "Docs directory: $DOCS_DIR"
echo ""

cd "$DOCS_DIR"

# Step 1: Clean generated content
echo "Step 1: Cleaning generated documentation..."

# Clean TypeDoc generated docs
echo "  - Cleaning code-reference/backend..."
rm -rf code-reference/backend/*

echo "  - Cleaning code-reference/frontend..."
rm -rf code-reference/frontend/*

# Clean OpenAPI generated docs
echo "  - Cleaning api-docs..."
rm -rf api-docs/*

# Clean Docusaurus build artifacts
echo "  - Cleaning .docusaurus cache..."
rm -rf .docusaurus

echo "  - Cleaning build output..."
rm -rf build

echo ""

# Step 2: Regenerate OpenAPI spec (from backend)
echo "Step 2: Regenerating OpenAPI specification..."
cd "$DOCS_DIR/.."
if [ -f "package.json" ] && grep -q "openapi:generate" package.json 2>/dev/null; then
    echo "  - Running pnpm openapi:generate..."
    pnpm openapi:generate || echo "  - Warning: openapi:generate failed or not available"
else
    echo "  - Skipping OpenAPI spec generation (command not found)"
fi
cd "$DOCS_DIR"

echo ""

# Step 3: Build documentation (includes TypeDoc and OpenAPI doc generation)
echo "Step 3: Building documentation..."
echo "  - This includes TypeDoc and OpenAPI doc generation"
npm run build 2>&1

echo ""
echo "=== Documentation rebuild complete ==="
echo ""
echo "Output: $DOCS_DIR/build"
echo ""
echo "To preview locally, run:"
echo "  npm run serve"
