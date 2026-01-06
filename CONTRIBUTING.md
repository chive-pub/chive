# Contributing to Chive

Thank you for your interest in contributing to Chive!

## Development setup

### Prerequisites

- Node.js 22+
- pnpm 8+
- Docker and Docker Compose

### Getting started

1. Fork and clone the repository
2. Install dependencies: `pnpm install`
3. Start the test database stack: `./scripts/start-test-stack.sh`
4. Initialize databases: `pnpm db:init`
5. Start the development server: `pnpm dev`
6. Create a feature branch: `git checkout -b feature/my-feature`
7. Make your changes
8. Run tests: `pnpm test`
9. Run linters: `pnpm lint`
10. Commit your changes (see commit conventions below)
11. Push and create a pull request

## Commit conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Test additions or changes
- `chore:` Build process or auxiliary tool changes

## Code style

- TypeScript strict mode enabled
- ESLint + Prettier enforced via pre-commit hooks
- TSDoc comments for all public APIs (not JSDoc)
- Active voice preferred in documentation
- No em-dashes in documentation

## API type generation

Frontend API types are auto-generated from the backend OpenAPI specification using `openapi-typescript`. This ensures type safety between frontend and backend.

### Workflow

1. **Make API changes** in backend handlers (e.g., add/modify endpoints in `src/api/`)
2. **Start the dev server** to expose the updated OpenAPI spec:
   ```bash
   pnpm dev
   ```
3. **Regenerate types** from the running server:
   ```bash
   pnpm openapi:generate
   ```
4. **Verify** the changes:
   ```bash
   pnpm typecheck
   ```

### File structure

```
web/lib/api/
├── schema.generated.ts    # Auto-generated (DO NOT EDIT)
├── schema.d.ts            # Domain types (manually maintained)
├── client.ts              # API client using generated paths
└── query-client.ts        # TanStack Query client
```

### Key points

- **Never edit `schema.generated.ts`**: it is overwritten on regeneration
- **Domain types** (Preprint, Author, Review, etc.) are in `schema.d.ts`
- **API paths** are auto-generated from OpenAPI spec
- Run `pnpm openapi:generate` after any backend API changes
- The OpenAPI spec is available at `http://localhost:3001/openapi.json` when the dev server is running
- Interactive API docs are at `http://localhost:3001/docs`

## Testing requirements

- Unit tests for all business logic
- Integration tests for service interactions
- E2E tests for critical user flows
- **ATProto compliance tests must pass 100%**

### Test commands

```bash
pnpm test              # Run all tests
pnpm test:unit         # Unit tests only
pnpm test:e2e          # End-to-end tests
pnpm test:compliance   # ATProto compliance tests
pnpm test:coverage     # Generate coverage report
```

### Coverage thresholds

- Backend: 80% line coverage (100% for critical paths: indexing, auth, sync, validation, compliance)
- Frontend: 70% line/component coverage

## ATProto compliance

**All contributions must maintain ATProto compliance:**

- Read from firehose (relay WebSocket stream)
- Store BlobRefs (CID pointers), NEVER blob data
- All indexes must be rebuildable from firehose
- Track PDS source for staleness detection
- NEVER write to user PDSes
- NEVER store user data as source of truth
- NEVER upload blobs to Chive storage

**Run compliance checks:**

```bash
pnpm test:compliance
```

## Database migrations

```bash
# Create a new migration
pnpm db:migrate:create migration_name

# Run migrations
pnpm db:migrate:up

# Rollback migrations
pnpm db:migrate:down
```

## Pull request process

1. Update documentation for any API changes
2. Add tests for new features
3. Ensure all tests pass
4. Ensure compliance tests pass (100% required)
5. Request review from maintainers

## Code review guidelines

- PRs should be focused and atomic
- Include clear description of changes
- Reference related issues
- Respond to feedback promptly

## Questions?

- Open an issue for bugs or feature requests
- Use [GitHub Discussions](https://github.com/chive-pub/chive/discussions) for questions
- Email: admin@chive.pub

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
