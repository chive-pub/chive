#!/bin/bash
set -e

echo "Running ATProto compliance checks..."

# Run compliance tests
pnpm test:compliance

echo ""
echo "Compliance Check Summary:"
echo "========================"
echo ""
echo "✓ No writes to user PDSes"
echo "✓ BlobRef storage only (not blob data)"
echo "✓ All indexes rebuildable from firehose"
echo "✓ PDS source tracking enabled"
echo ""
echo "All compliance tests must pass (100% required)"
