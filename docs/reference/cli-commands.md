# CLI commands reference

npm/pnpm scripts and CLI tools for developing and operating Chive.

## Development

### Starting services

```bash
# Start development server (API + frontend)
pnpm dev

# Start API only
pnpm dev:api

# Start frontend only
pnpm dev:web

# Start with hot reload
pnpm dev:watch
```

### Building

```bash
# Build all packages
pnpm build

# Build specific package
pnpm build:api
pnpm build:web

# Type checking only
pnpm typecheck

# Lint code
pnpm lint
pnpm lint:fix
```

## Testing

### Running tests

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test:unit           # Unit tests only
pnpm test:integration    # Integration tests
pnpm test:e2e            # End-to-end tests
pnpm test:compliance     # ATProto compliance tests

# Run tests for specific file/pattern
pnpm test -- tests/unit/services/eprint
pnpm test -- --grep "should index eprint"

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage
```

### Test infrastructure

```bash
# Start test stack (databases in Docker)
./scripts/start-test-stack.sh

# Stop test stack
./scripts/stop-test-stack.sh

# Seed test data
pnpm seed:test

# Clean up test data
pnpm cleanup:test
```

### E2E testing

```bash
# Run Playwright tests
pnpm test:e2e

# Run with UI
pnpm test:e2e:ui

# Run specific test file
pnpm test:e2e -- tests/e2e/search.spec.ts

# Debug mode
pnpm test:e2e:debug
```

## Database

### Migrations

```bash
# Apply pending migrations
pnpm db:migrate:up

# Rollback last migration
pnpm db:migrate:down

# Rollback all migrations
pnpm db:migrate:reset

# Check migration status
pnpm db:migrate:status

# Create new migration
pnpm db:migrate:create <name>
```

### Setup

```bash
# Initialize all databases
pnpm db:init

# Setup specific database
pnpm db:setup:postgres
pnpm db:setup:elasticsearch
pnpm db:setup:neo4j

# Verify database connections
pnpm db:verify
```

### Data management

```bash
# Seed development data
pnpm db:seed

# Export data
pnpm db:export --output backup.json

# Import data
pnpm db:import --input backup.json

# Clear all data (development only)
pnpm db:clear
```

## Queue management

### BullMQ queues

```bash
# View queue status
pnpm queue:status

# View specific queue
pnpm queue:status indexing

# Retry failed jobs
pnpm queue:retry indexing

# Retry all failed jobs
pnpm queue:retry --all

# Clean completed jobs
pnpm queue:clean indexing --grace 3600

# Pause queue
pnpm queue:pause indexing

# Resume queue
pnpm queue:resume indexing
```

### Dead letter queue

```bash
# View DLQ contents
pnpm dlq:list

# Retry DLQ events
pnpm dlq:retry

# Clear old DLQ events
pnpm dlq:clear --older-than 7d
```

## Firehose

### Cursor management

```bash
# Get current cursor
pnpm firehose:cursor

# Set cursor (for replay)
pnpm firehose:cursor:set <seq>

# Reset cursor to beginning
pnpm firehose:cursor:reset
```

### Replay events

```bash
# Replay from specific cursor
pnpm firehose:replay --from <seq> --to <seq>

# Replay last N events
pnpm firehose:replay --last 1000
```

## API type generation

```bash
# Generate frontend types from OpenAPI
pnpm openapi:generate

# Verify generated types
pnpm openapi:verify
```

## Code generation

### Lexicons

```bash
# Generate TypeScript from lexicon definitions
pnpm lexicon:codegen

# Validate lexicon schemas
pnpm lexicon:validate
```

## Production

### Build for production

```bash
# Build optimized bundles
pnpm build:prod

# Build Docker images
docker compose -f docker-compose.prod.yml build
```

### Health checks

```bash
# Check API health
curl http://localhost:3000/health

# Detailed health
curl http://localhost:3000/health/ready
```

### Maintenance

```bash
# Run database maintenance
pnpm db:maintenance

# Vacuum PostgreSQL
pnpm db:vacuum

# Optimize Elasticsearch indices
pnpm es:optimize
```

## Debugging

### Logging

```bash
# Enable debug logging
DEBUG=chive:* pnpm dev

# Specific namespace
DEBUG=chive:firehose,chive:indexing pnpm dev
```

### Profiling

```bash
# CPU profiling
pnpm dev --inspect

# Memory profiling
pnpm dev --inspect --expose-gc
```

## Scripts directory

Additional scripts in `scripts/`:

| Script                              | Description                        |
| ----------------------------------- | ---------------------------------- |
| `scripts/dev.sh`                    | Start full development environment |
| `scripts/start-test-stack.sh`       | Start Docker test databases        |
| `scripts/stop-test-stack.sh`        | Stop Docker test databases         |
| `scripts/db/setup-elasticsearch.ts` | Initialize Elasticsearch           |
| `scripts/db/setup-neo4j.ts`         | Initialize Neo4j                   |
| `scripts/db/reindex-from-pg.ts`     | Rebuild ES index from PostgreSQL   |
| `scripts/db/create-index.ts`        | Create new Elasticsearch index     |
| `scripts/db/switch-alias.ts`        | Switch Elasticsearch alias         |

### Usage

```bash
# Run TypeScript script
tsx scripts/db/setup-elasticsearch.ts

# With arguments
tsx scripts/db/reindex-from-pg.ts --target eprints-new
```

## Environment-specific commands

### Development

```bash
pnpm dev              # Full dev server
pnpm dev:debug        # With Node inspector
```

### CI/CD

```bash
pnpm ci:lint          # Lint with CI reporter
pnpm ci:test          # Tests with coverage
pnpm ci:build         # Production build
```

### Production

```bash
pnpm start            # Start production server
pnpm start:cluster    # Start with PM2 clustering
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

# Clean install
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## Related documentation

- [Configuration](./configuration.md): Configuration reference
- [Environment Variables](./environment-variables.md): Env var reference
- [Deployment](../operations/deployment.md): Production setup
