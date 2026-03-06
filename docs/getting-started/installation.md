# Installation

Set up a local Chive development environment.

## System requirements

- Node.js 22 or later
- Docker and Docker Compose
- pnpm 8 or later
- Git

## Clone the repository

```bash
git clone https://github.com/chive-pub/chive.git
cd chive
```

## Install dependencies

```bash
pnpm install
```

## Start infrastructure

The development stack requires PostgreSQL, Elasticsearch, Neo4j, and Redis. Start these services:

```bash
pnpm dev:db
```

This starts the database containers using Docker Compose.

## Run database migrations

Apply the database schema:

```bash
pnpm db:migrate:up
```

## Start development server

Run the backend and frontend in development mode:

```bash
pnpm dev
```

The API server runs on `http://localhost:3001` and the web interface on `http://localhost:3000`.

## Verify installation

Open `http://localhost:3000` in your browser. You should see the Chive homepage.

## Optional: seed test data

For development, you may want sample data:

```bash
pnpm seed:test
```

This creates test data for local testing.

## Common issues

### Port conflicts

If ports 5432, 9200, 7474, or 6379 are in use, modify `docker-compose.yml` to use different ports.

### Elasticsearch memory

Elasticsearch requires at least 2GB of memory. If it fails to start, increase Docker's memory allocation.

### Neo4j authentication

The development Neo4j instance uses authentication. Credentials are in `.env.development`.

## Next steps

- [Developer guide](../developer-guide): architecture and design details
- [API reference](../api-reference/overview): endpoint documentation
- [Contributing guide](https://github.com/chive-pub/chive/blob/main/CONTRIBUTING.md): how to submit changes
