# CLI commands reference

npm/pnpm scripts for developing and operating Chive.

## Development

### Starting services

```bash
# Start full development environment (API + frontend)
pnpm dev

# Start API server only (on port 3001)
pnpm dev:api

# Start database containers
pnpm dev:db

# Stop development services
pnpm dev:stop

# Stop all services (including databases)
pnpm dev:stop:all
```

### Building

```bash
# Build all packages
pnpm build

# Type checking only
pnpm typecheck

# Lint code
pnpm lint
pnpm lint:fix

# Format code
pnpm format
pnpm format:check
```

## Testing

### Running tests

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test:unit           # Unit tests only
pnpm test:unit:watch     # Unit tests in watch mode
pnpm test:unit:ui        # Unit tests with Vitest UI
pnpm test:integration    # Integration tests
pnpm test:e2e            # End-to-end tests
pnpm test:compliance     # ATProto compliance tests
pnpm test:performance    # Performance tests with k6

# Coverage report
pnpm test:coverage
```

### E2E testing

```bash
# Run Playwright tests
pnpm test:e2e

# Run with UI
pnpm test:e2e:ui

# Debug mode
pnpm test:e2e:debug
```

### Test infrastructure

```bash
# Start test stack (databases in Docker)
pnpm test:stack:start

# Stop test stack
pnpm test:stack:stop

# Seed test data
pnpm seed:test

# Clean up test data
pnpm cleanup:test
```

## Database

### Migrations

```bash
# Apply pending migrations
pnpm db:migrate:up

# Rollback last migration
pnpm db:migrate:down

# Create new migration
pnpm db:migrate:create <name>
```

### Setup

```bash
# Initialize all databases (PostgreSQL, Elasticsearch, Neo4j)
pnpm db:init

# Seed knowledge graph data
pnpm db:seed:knowledge-graph
```

## Code generation

```bash
# Generate TypeScript from lexicon definitions
pnpm lexicons:generate

# Generate frontend types from OpenAPI spec
pnpm openapi:generate
```

## Health checks

```bash
# Check API health
curl http://localhost:3001/health

# Readiness check (includes database checks)
curl http://localhost:3001/health/ready

# Liveness check
curl http://localhost:3001/health/live
```

## Scripts directory

Additional scripts in `scripts/`:

| Script                          | Description                        |
| ------------------------------- | ---------------------------------- |
| `scripts/dev.sh`                | Start full development environment |
| `scripts/dev-db.sh`             | Start database containers          |
| `scripts/start-test-stack.sh`   | Start Docker test databases        |
| `scripts/generate-lexicons.sh`  | Generate TypeScript from lexicons  |
| `scripts/generate-api-types.sh` | Generate API types from OpenAPI    |
| `scripts/db/init-all.sh`        | Initialize all databases           |
| `scripts/db/migrate.ts`         | Run database migrations            |

### Usage

```bash
# Run TypeScript script
tsx scripts/db/migrate.ts up

# With arguments
tsx scripts/db/migrate.ts create migration_name
```

## Package manager

Chive uses pnpm. Common commands:

```bash
# Install dependencies
pnpm install

# Add dependency
pnpm add <package>
pnpm add -D <package>  # Dev dependency

# Update dependencies
pnpm update

# Check for outdated packages
pnpm outdated
```

## Related documentation

- [Environment Variables](./environment-variables.md): Env var reference
- [Deployment](../operations/deployment.md): Production setup
