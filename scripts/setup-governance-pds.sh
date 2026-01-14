#!/bin/bash
# =============================================================================
# Governance PDS Setup Script
# =============================================================================
# Run this script on the production server after initial deployment to:
# 1. Wait for PDS to be healthy
# 2. Create the governance account
# 3. Verify the setup
#
# Usage: ./scripts/setup-governance-pds.sh
# =============================================================================

set -e

# Configuration
PDS_CONTAINER="chive-governance-pds"
GOVERNANCE_HANDLE="governance.chive.pub"
GOVERNANCE_EMAIL="governance@chive.pub"

echo "=== Governance PDS Setup ==="
echo ""

# Check if running on server (has docker)
if ! command -v docker &> /dev/null; then
    echo "Error: Docker not found. Run this script on the production server."
    exit 1
fi

# Check if PDS container is running
echo "Checking PDS container status..."
if ! docker ps --format '{{.Names}}' | grep -q "^${PDS_CONTAINER}$"; then
    echo "Error: ${PDS_CONTAINER} container is not running."
    echo "Start the stack first: cd /opt/chive/docker && docker compose -f docker-compose.prod.yml up -d"
    exit 1
fi

# Wait for PDS to be healthy
echo "Waiting for PDS to be healthy..."
for i in {1..30}; do
    if docker exec ${PDS_CONTAINER} wget -q --spider http://localhost:3000/xrpc/_health 2>/dev/null; then
        echo "✓ PDS is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "Error: PDS failed to become healthy after 30 attempts"
        exit 1
    fi
    echo "  Waiting... ($i/30)"
    sleep 2
done

# Check if governance account already exists
echo ""
echo "Checking if governance account exists..."
EXISTING_DID=$(docker exec ${PDS_CONTAINER} sh -c "
    wget -q -O- 'http://localhost:3000/xrpc/com.atproto.identity.resolveHandle?handle=${GOVERNANCE_HANDLE}' 2>/dev/null | grep -o '\"did\":\"[^\"]*\"' | cut -d'\"' -f4
" 2>/dev/null || echo "")

if [ -n "$EXISTING_DID" ]; then
    echo "✓ Governance account already exists: ${EXISTING_DID}"
    echo ""
    echo "=== Setup Complete ==="
    echo "DID: ${EXISTING_DID}"
    echo "Handle: ${GOVERNANCE_HANDLE}"
    exit 0
fi

# Create governance account
echo "Creating governance account..."
echo "Handle: ${GOVERNANCE_HANDLE}"
echo "Email: ${GOVERNANCE_EMAIL}"
echo ""

# Use pdsadmin to create account
# The password will be auto-generated and shown
RESULT=$(docker exec ${PDS_CONTAINER} sh -c "
    /pds/pdsadmin.sh account create '${GOVERNANCE_HANDLE}' '${GOVERNANCE_EMAIL}'
" 2>&1)

echo "$RESULT"

# Extract DID from result
NEW_DID=$(echo "$RESULT" | grep -o 'did:plc:[a-z0-9]*' | head -1 || echo "")

if [ -n "$NEW_DID" ]; then
    echo ""
    echo "=== Setup Complete ==="
    echo "✓ Governance account created successfully!"
    echo "DID: ${NEW_DID}"
    echo "Handle: ${GOVERNANCE_HANDLE}"
    echo ""
    echo "IMPORTANT: Save the password shown above!"
    echo ""
    echo "Next steps:"
    echo "1. Add GOVERNANCE_DID=${NEW_DID} to your GitHub variables"
    echo "2. Update ATPROTO_SERVICE_DID if needed"
else
    echo ""
    echo "Warning: Could not extract DID from result."
    echo "Check the output above for the account details."
fi
