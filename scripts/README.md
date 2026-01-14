# Scripts

Utility scripts for Chive development and administration.

## Alpha Tester Administration

### `alpha-admin.ts`

Manage alpha tester applications. Supports approving/rejecting applications and sending email notifications.

#### Prerequisites

To run locally, you need SSH tunnel access to the production database:

```bash
# Terminal 1: Start SSH tunnel to forward PostgreSQL and Redis ports
# Replace <SERVER_IP> with the production server IP and <SSH_KEY> with your key path
ssh -N -L 5432:localhost:5432 -L 6379:localhost:6379 \
    -i ~/.ssh/<SSH_KEY> ubuntu@<SERVER_IP>
```

Keep this terminal open while running commands.

#### Environment Variables

```bash
# Required
export DATABASE_URL="postgresql://chive:YOUR_PASSWORD@localhost:5432/chive"
export REDIS_URL="redis://localhost:6379"

# Optional (for email notifications on approval)
export SMTP_HOST="your-smtp-host"
export SMTP_PORT="587"
export SMTP_USER="your-smtp-user"
export SMTP_PASSWORD="your-smtp-password"
export EMAIL_FROM="noreply@chive.pub"
export ZULIP_INVITE_URL="https://your-zulip-invite-link"
```

#### Commands

**List pending applications:**

```bash
pnpm tsx scripts/alpha-admin.ts list
```

**List applications by status:**

```bash
pnpm tsx scripts/alpha-admin.ts list pending
pnpm tsx scripts/alpha-admin.ts list approved
pnpm tsx scripts/alpha-admin.ts list rejected
pnpm tsx scripts/alpha-admin.ts list revoked
```

**Show detailed application info:**

```bash
pnpm tsx scripts/alpha-admin.ts show did:plc:abc123xyz
```

**Approve an application:**

```bash
# Approve and send email notification
pnpm tsx scripts/alpha-admin.ts approve did:plc:abc123xyz

# Approve without sending email
pnpm tsx scripts/alpha-admin.ts approve --skip-email did:plc:abc123xyz

# Preview what would happen (no changes made)
pnpm tsx scripts/alpha-admin.ts approve --dry-run did:plc:abc123xyz

# Set a custom reviewer name
pnpm tsx scripts/alpha-admin.ts approve --reviewer "jane@example.com" did:plc:abc123xyz
```

**Reject an application:**

```bash
pnpm tsx scripts/alpha-admin.ts reject did:plc:abc123xyz
```

**Revoke access (for previously approved users):**

```bash
pnpm tsx scripts/alpha-admin.ts revoke did:plc:abc123xyz
```

**View statistics:**

```bash
pnpm tsx scripts/alpha-admin.ts stats
```

**Export to CSV:**

```bash
pnpm tsx scripts/alpha-admin.ts export
pnpm tsx scripts/alpha-admin.ts export my-export.csv
```

#### Quick Reference

| Command         | Description                                     |
| --------------- | ----------------------------------------------- |
| `list [status]` | List applications (default: pending)            |
| `show <DID>`    | Show detailed application info                  |
| `approve <DID>` | Approve application and send email              |
| `reject <DID>`  | Reject application                              |
| `revoke <DID>`  | Revoke previously approved access               |
| `stats`         | Show application statistics                     |
| `export [file]` | Export to CSV (default: alpha_applications.csv) |

| Option              | Description                           |
| ------------------- | ------------------------------------- |
| `--dry-run`         | Preview changes without applying them |
| `--skip-email`      | Skip sending approval email           |
| `--reviewer <name>` | Set reviewer name (default: admin)    |

---

## Development Scripts

### `dev.sh`

Start the development environment with all services.

```bash
./scripts/dev.sh
```

### `dev-stop.sh`

Stop all development services.

```bash
./scripts/dev-stop.sh
```

### `dev-db.sh`

Start only the database services (PostgreSQL, Redis, Elasticsearch, Neo4j) for development.

```bash
./scripts/dev-db.sh
```

---

## Database Scripts

### `db/`

Database management scripts including migrations and seeds.

### `seed-test-data.ts`

Seed the database with test data for development.

```bash
pnpm tsx scripts/seed-test-data.ts
```

---

## Code Generation

### `generate-lexicons.sh`

Generate TypeScript types from ATProto lexicon schemas.

```bash
./scripts/generate-lexicons.sh
```

### `generate-api-types.sh`

Generate frontend API types from the OpenAPI specification.

```bash
./scripts/generate-api-types.sh
```

### `generate-zod-validators.js`

Generate Zod validators from lexicon schemas.

```bash
node scripts/generate-zod-validators.js
```

### `generate-env.sh`

Generate a `.env` file from `.env.example` with random secrets.

```bash
./scripts/generate-env.sh
```

---

## Testing Scripts

### `start-test-stack.sh`

Start the Docker test stack (databases) for running integration tests.

```bash
./scripts/start-test-stack.sh
```

### `check-compliance.sh`

Run ATProto compliance checks.

```bash
./scripts/check-compliance.sh
```

### `cleanup-test.sh`

Clean up test data and containers.

```bash
./scripts/cleanup-test.sh
```

### `test-services.ts`

Test service connectivity and health.

```bash
pnpm tsx scripts/test-services.ts
```

---

## Production Scripts

### `setup-governance-pds.sh`

Set up the governance PDS account on a new deployment.

```bash
./scripts/setup-governance-pds.sh
```

### `tunnel.sh`

Create an SSH tunnel to the production server for local database access.

```bash
./scripts/tunnel.sh
```

---

## Utility Scripts

### `bluesky-post.ts`

Post announcements to Bluesky.

```bash
pnpm tsx scripts/bluesky-post.ts "Your message here"
```

### `cleanup-pds-records.ts`

Clean up orphaned PDS records.

```bash
pnpm tsx scripts/cleanup-pds-records.ts
```

---

## Templates

### `templates/`

Contains templates for generating configuration files and other resources.
