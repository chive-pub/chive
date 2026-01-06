# Chive

<p align="center">
  <img src="chive-logo.svg" alt="Chive Logo" width="200">
</p>

<p align="center">
  <strong>A decentralized preprint server built on AT Protocol</strong>
</p>

<p align="center">
  <a href="https://github.com/chive-pub/chive/actions"><img src="https://img.shields.io/github/actions/workflow/status/chive-pub/chive/ci.yml?branch=main&style=flat-square&logo=github&label=CI" alt="CI Status"></a>
  <a href="https://github.com/chive-pub/chive/blob/main/LICENSE"><img src="https://img.shields.io/github/license/chive-pub/chive?style=flat-square" alt="License"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.9-blue?style=flat-square&logo=typescript" alt="TypeScript"></a>
  <a href="https://atproto.com/"><img src="https://img.shields.io/badge/AT%20Protocol-native-blue?style=flat-square" alt="AT Protocol"></a>
</p>

<p align="center">
  <a href="https://docs.chive.pub">Documentation</a> •
  <a href="https://chive.pub">Live Demo</a> •
  <a href="https://github.com/chive-pub/chive/discussions">Discussions</a> •
  <a href="https://bsky.app/profile/chive.pub">Bluesky</a>
</p>

## What is Chive?

Chive is a scholarly preprint platform where researchers own their work. Built on [AT Protocol](https://atproto.com/), all content lives in user-controlled Personal Data Servers (PDSes), not on Chive's servers.

**Key principle**: If Chive's entire database disappears tomorrow, you lose nothing. Your preprints, reviews, and endorsements remain in your PDS, accessible via any ATProto-compatible AppView.

### Features

- **Decentralized ownership**: Your research stays in your PDS under your control
- **Open peer review**: Transparent review process with threaded discussions
- **Knowledge graph**: Community-curated field taxonomy with Wikipedia-style moderation
- **Faceted search**: Find papers by field, author, methodology, time period, and more
- **Citation tracking**: Follow how research builds on prior work
- **ATProto native**: Portable identity, cryptographic verification, federated architecture

## Architecture overview

Chive operates as an **AppView** in the AT Protocol ecosystem:

```
User → User's PDS (creates record) → Relay (firehose) → Chive AppView (indexes)
```

- Users publish preprints to their own PDSes
- Chive indexes content from the ATProto firehose
- All search and discovery happens through Chive
- Users can switch AppViews without losing data

## Technology stack

| Layer          | Technology                                           |
| -------------- | ---------------------------------------------------- |
| Runtime        | Node.js 22+, TypeScript 5.9+                         |
| API            | Hono (XRPC + REST)                                   |
| Databases      | PostgreSQL 16+, Elasticsearch 8+, Neo4j 5+, Redis 7+ |
| Frontend       | Next.js 15, React 19, Radix UI, Tailwind CSS         |
| Testing        | Vitest, Playwright, k6                               |
| Infrastructure | Kubernetes, Docker, OpenTelemetry                    |

## Getting started

### Prerequisites

- Node.js 22+
- pnpm 8+
- Docker and Docker Compose (for databases)

### Installation

```bash
# Clone the repository
git clone https://github.com/chive-pub/chive.git
cd chive

# Install dependencies
pnpm install

# Start the development database stack
./scripts/start-test-stack.sh

# Initialize databases
pnpm db:init

# Start the development server
pnpm dev
```

The API runs at `http://localhost:3001` and the web app at `http://localhost:3000`.

### Running tests

```bash
# Run all tests
pnpm test

# Unit tests only
pnpm test:unit

# End-to-end tests
pnpm test:e2e

# ATProto compliance tests
pnpm test:compliance

# With coverage
pnpm test:coverage
```

## Project structure

```
chive/
├── src/                    # Backend source code
│   ├── api/               # Hono XRPC + REST handlers
│   ├── atproto/           # ATProto client, firehose consumer
│   ├── auth/              # Authentication, OAuth, zero-trust
│   ├── plugins/           # Plugin system and builtins
│   ├── services/          # Business logic
│   └── storage/           # Database adapters
├── web/                    # Next.js frontend
│   ├── app/               # App router pages
│   ├── components/        # React components (140+)
│   └── lib/               # Hooks, API client, utilities
├── docs/                   # Docusaurus documentation
├── tests/                  # Test suites
│   ├── unit/              # Vitest unit tests
│   ├── integration/       # Integration tests
│   ├── e2e/               # Playwright E2E tests
│   └── compliance/        # ATProto compliance tests
```

## ATProto compliance

Chive follows strict ATProto compliance rules:

| Rule                | Description                                               |
| ------------------- | --------------------------------------------------------- |
| Read only           | Chive reads from the firehose, never writes to user PDSes |
| BlobRefs only       | Store CID pointers to blobs, never blob data              |
| Rebuildable indexes | All indexes can be reconstructed from the firehose        |
| PDS tracking        | Track source PDS for staleness detection                  |

Run `pnpm test:compliance` to verify compliance.

## Development

### Code style

- TypeScript with strict mode
- ESLint + Prettier for formatting
- TSDoc for documentation (not JSDoc)
- Active voice preferred

### API type generation

After modifying backend endpoints:

```bash
# Start dev server
pnpm dev

# Regenerate frontend types
pnpm openapi:generate

# Verify types compile
pnpm typecheck
```

### Database migrations

```bash
# Create a new migration
pnpm db:migrate:create migration_name

# Run migrations
pnpm db:migrate:up

# Rollback migrations
pnpm db:migrate:down
```

## Plugin system

Chive uses a hybrid plugin architecture with dependency injection (TSyringe) and event hooks (EventEmitter2).

Plugins run in isolated sandboxes with declared permissions. Built-in plugins include:

- GitHub integration
- ORCID linking
- DOI registration
- Wikidata field import

See [docs.chive.pub](https://docs.chive.pub) for plugin development details.

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) before submitting PRs.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Run tests (`pnpm test`)
5. Submit a pull request

## Security

Chive implements Zero Trust Architecture (NIST SP 800-207):

- Every request authenticated and authorized
- Mutual TLS for inter-service communication
- DID-based cryptographic identity
- Audit logging with tamper detection

Report security vulnerabilities to admin@chive.pub. See [SECURITY.md](SECURITY.md).

## License

MIT License. See [LICENSE](LICENSE) for details.

## Acknowledgments

Chive was architected and implemented with the help of Claude Code.
