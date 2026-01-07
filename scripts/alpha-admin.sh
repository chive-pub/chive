#!/bin/bash
set -e

# Alpha Application Administration Script
# Usage: ./scripts/alpha-admin.sh {list|approve|reject|show|stats} [DID]

# Configuration - adjust these for your environment
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-chive-postgres}"
REDIS_CONTAINER="${REDIS_CONTAINER:-chive-redis}"
DB_USER="${DB_USER:-chive}"
DB_NAME="${DB_NAME:-chive}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper function to run PostgreSQL commands
pg_exec() {
  docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "$1"
}

# Helper function to run Redis commands
redis_exec() {
  docker exec "$REDIS_CONTAINER" redis-cli "$@"
}

# List pending applications
list_pending() {
  echo -e "${BLUE}=== Pending Alpha Applications ===${NC}"
  echo ""
  pg_exec "
    SELECT
      id,
      handle,
      email,
      sector,
      career_stage,
      COALESCE(affiliation_name, '-') as affiliation,
      LEFT(research_field, 30) as research_field,
      created_at::date as applied
    FROM alpha_applications
    WHERE status = 'pending'
    ORDER BY created_at ASC;
  "
}

# List all applications with optional status filter
list_all() {
  local STATUS_FILTER="$1"
  if [ -n "$STATUS_FILTER" ]; then
    echo -e "${BLUE}=== Alpha Applications (status: $STATUS_FILTER) ===${NC}"
    pg_exec "
      SELECT
        id,
        did,
        handle,
        email,
        status,
        sector,
        career_stage,
        created_at::date as applied,
        reviewed_at::date as reviewed
      FROM alpha_applications
      WHERE status = '$STATUS_FILTER'
      ORDER BY created_at DESC
      LIMIT 50;
    "
  else
    echo -e "${BLUE}=== All Alpha Applications ===${NC}"
    pg_exec "
      SELECT
        id,
        did,
        handle,
        email,
        status,
        sector,
        career_stage,
        created_at::date as applied
      FROM alpha_applications
      ORDER BY created_at DESC
      LIMIT 50;
    "
  fi
}

# Show detailed application info
show_application() {
  local DID="$1"
  if [ -z "$DID" ]; then
    echo -e "${RED}Error: DID required${NC}"
    echo "Usage: $0 show <DID>"
    exit 1
  fi

  echo -e "${BLUE}=== Application Details ===${NC}"
  echo ""
  pg_exec "
    SELECT
      id,
      did,
      handle,
      email,
      status,
      sector,
      sector_other,
      career_stage,
      career_stage_other,
      affiliation_name,
      affiliation_ror_id,
      research_field,
      motivation,
      zulip_invited,
      reviewed_at,
      reviewed_by,
      created_at,
      updated_at
    FROM alpha_applications
    WHERE did = '$DID';
  "
}

# Approve a tester by DID
approve_tester() {
  local DID="$1"
  local REVIEWER="${2:-admin}"

  if [ -z "$DID" ]; then
    echo -e "${RED}Error: DID required${NC}"
    echo "Usage: $0 approve <DID> [reviewer]"
    exit 1
  fi

  # Check if application exists and is pending
  local STATUS
  STATUS=$(docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c \
    "SELECT status FROM alpha_applications WHERE did = '$DID'" | tr -d ' ')

  if [ -z "$STATUS" ]; then
    echo -e "${RED}Error: No application found for DID: $DID${NC}"
    exit 1
  fi

  if [ "$STATUS" != "pending" ]; then
    echo -e "${YELLOW}Warning: Application is already $STATUS${NC}"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 0
    fi
  fi

  echo -e "${YELLOW}Approving: $DID${NC}"

  # Update PostgreSQL
  pg_exec "
    UPDATE alpha_applications
    SET status = 'approved',
        reviewed_at = now(),
        reviewed_by = '$REVIEWER',
        updated_at = now()
    WHERE did = '$DID';
  "

  # Add role in Redis
  redis_exec SADD "chive:authz:roles:$DID" "alpha-tester"

  echo -e "${GREEN}✓ Approved: $DID${NC}"
  echo "  - PostgreSQL status updated to 'approved'"
  echo "  - Redis role 'alpha-tester' added"
}

# Reject an application
reject_tester() {
  local DID="$1"
  local REVIEWER="${2:-admin}"

  if [ -z "$DID" ]; then
    echo -e "${RED}Error: DID required${NC}"
    echo "Usage: $0 reject <DID> [reviewer]"
    exit 1
  fi

  # Check if application exists
  local STATUS
  STATUS=$(docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c \
    "SELECT status FROM alpha_applications WHERE did = '$DID'" | tr -d ' ')

  if [ -z "$STATUS" ]; then
    echo -e "${RED}Error: No application found for DID: $DID${NC}"
    exit 1
  fi

  echo -e "${YELLOW}Rejecting: $DID${NC}"

  # Update PostgreSQL
  pg_exec "
    UPDATE alpha_applications
    SET status = 'rejected',
        reviewed_at = now(),
        reviewed_by = '$REVIEWER',
        updated_at = now()
    WHERE did = '$DID';
  "

  # Remove role from Redis if it exists
  redis_exec SREM "chive:authz:roles:$DID" "alpha-tester" 2>/dev/null || true

  echo -e "${GREEN}✓ Rejected: $DID${NC}"
}

# Revoke alpha access (change approved to rejected)
revoke_tester() {
  local DID="$1"
  local REVIEWER="${2:-admin}"

  if [ -z "$DID" ]; then
    echo -e "${RED}Error: DID required${NC}"
    echo "Usage: $0 revoke <DID> [reviewer]"
    exit 1
  fi

  echo -e "${YELLOW}Revoking access for: $DID${NC}"

  # Update PostgreSQL
  pg_exec "
    UPDATE alpha_applications
    SET status = 'revoked',
        reviewed_at = now(),
        reviewed_by = '$REVIEWER',
        updated_at = now()
    WHERE did = '$DID';
  "

  # Remove role from Redis
  redis_exec SREM "chive:authz:roles:$DID" "alpha-tester"

  echo -e "${GREEN}✓ Revoked: $DID${NC}"
}

# Show statistics
show_stats() {
  echo -e "${BLUE}=== Alpha Application Statistics ===${NC}"
  echo ""

  echo "Status breakdown:"
  pg_exec "
    SELECT
      status,
      COUNT(*) as count
    FROM alpha_applications
    GROUP BY status
    ORDER BY status;
  "

  echo ""
  echo "Applications by sector:"
  pg_exec "
    SELECT
      sector,
      COUNT(*) as count
    FROM alpha_applications
    GROUP BY sector
    ORDER BY count DESC;
  "

  echo ""
  echo "Applications by career stage:"
  pg_exec "
    SELECT
      career_stage,
      COUNT(*) as count
    FROM alpha_applications
    GROUP BY career_stage
    ORDER BY count DESC;
  "

  echo ""
  echo "Applications per day (last 7 days):"
  pg_exec "
    SELECT
      created_at::date as date,
      COUNT(*) as applications
    FROM alpha_applications
    WHERE created_at > now() - interval '7 days'
    GROUP BY created_at::date
    ORDER BY date DESC;
  "
}

# Batch approve from file
batch_approve() {
  local FILE="$1"
  local REVIEWER="${2:-admin}"

  if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
    echo -e "${RED}Error: Valid file path required${NC}"
    echo "Usage: $0 batch-approve <file> [reviewer]"
    echo "File should contain one DID per line"
    exit 1
  fi

  local COUNT=0
  while IFS= read -r DID || [ -n "$DID" ]; do
    # Skip empty lines and comments
    [[ -z "$DID" || "$DID" =~ ^# ]] && continue

    echo "Processing: $DID"
    approve_tester "$DID" "$REVIEWER"
    ((COUNT++))
  done < "$FILE"

  echo ""
  echo -e "${GREEN}Batch approval complete: $COUNT applications processed${NC}"
}

# Export applications to CSV
export_csv() {
  local OUTPUT="${1:-alpha_applications.csv}"

  echo -e "${BLUE}Exporting applications to $OUTPUT...${NC}"

  docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
    COPY (
      SELECT
        id, did, handle, email, status,
        sector, sector_other, career_stage, career_stage_other,
        affiliation_name, affiliation_ror_id,
        research_field, motivation,
        zulip_invited, reviewed_at, reviewed_by,
        created_at, updated_at
      FROM alpha_applications
      ORDER BY created_at
    ) TO STDOUT WITH CSV HEADER
  " > "$OUTPUT"

  echo -e "${GREEN}✓ Exported to $OUTPUT${NC}"
}

# Print usage
print_usage() {
  echo "Alpha Application Administration"
  echo ""
  echo "Usage: $0 <command> [arguments]"
  echo ""
  echo "Commands:"
  echo "  list                    List pending applications"
  echo "  list-all [status]       List all applications (optionally filter by status)"
  echo "  show <DID>              Show detailed application info"
  echo "  approve <DID> [by]      Approve an application"
  echo "  reject <DID> [by]       Reject an application"
  echo "  revoke <DID> [by]       Revoke alpha access"
  echo "  stats                   Show application statistics"
  echo "  batch-approve <file>    Batch approve DIDs from file"
  echo "  export [filename]       Export applications to CSV"
  echo ""
  echo "Environment variables:"
  echo "  POSTGRES_CONTAINER      PostgreSQL container name (default: chive-postgres)"
  echo "  REDIS_CONTAINER         Redis container name (default: chive-redis)"
  echo "  DB_USER                 Database user (default: chive)"
  echo "  DB_NAME                 Database name (default: chive)"
  echo ""
  echo "Examples:"
  echo "  $0 list"
  echo "  $0 approve did:plc:abc123 admin@chive.pub"
  echo "  $0 show did:plc:abc123"
  echo "  $0 list-all approved"
  echo "  $0 batch-approve approved_dids.txt"
}

# Main
case "$1" in
  list)
    list_pending
    ;;
  list-all)
    list_all "$2"
    ;;
  show)
    show_application "$2"
    ;;
  approve)
    approve_tester "$2" "$3"
    ;;
  reject)
    reject_tester "$2" "$3"
    ;;
  revoke)
    revoke_tester "$2" "$3"
    ;;
  stats)
    show_stats
    ;;
  batch-approve)
    batch_approve "$2" "$3"
    ;;
  export)
    export_csv "$2"
    ;;
  -h|--help|help)
    print_usage
    ;;
  *)
    print_usage
    exit 1
    ;;
esac
