#!/bin/bash
set -e

echo "Generating TypeScript types from Lexicon schemas..."

# Generate Zod validators (this script validates schemas as part of loading)
echo "Generating Zod validators..."
node scripts/generate-zod-validators.js

echo "✅ Lexicon code generation complete"
