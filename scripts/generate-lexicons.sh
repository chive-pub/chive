#!/bin/bash
set -e

echo "Generating TypeScript types from Lexicon schemas..."

# Validate all schemas
echo "Validating lexicon schemas..."
pnpm exec atproto-lexicon validate lexicons/

# Generate Zod validators
echo "Generating Zod validators..."
node scripts/generate-zod-validators.js

echo "✅ Lexicon code generation complete"
