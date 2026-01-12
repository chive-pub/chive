# Installation

Set up a local Chive development environment.

## System Requirements

- Node.js 22 or later
- Docker and Docker Compose
- pnpm 9 or later
- Git

## Clone the Repository

```bash
git clone https://github.com/chive-pub/chive.git
cd chive
```

## Install Dependencies

```bash
pnpm install
```

## Start Infrastructure

The development stack requires PostgreSQL, Elasticsearch, Neo4j, and Redis. Start these services with Docker Compose:

```bash
docker compose up -d
```

Wait for all services to become healthy:

```bash
docker compose ps
```

## Run Database Migrations

Apply the database schema:

```bash
pnpm db:migrate
```

## Start Development Server

Run the backend and frontend in development mode:

```bash
pnpm dev
```

The API server runs on `http://localhost:4000` and the web interface on `http://localhost:3000`.

## Verify Installation

Open `http://localhost:3000` in your browser. You should see the Chive homepage.

## Optional: Seed Test Data

For development, you may want sample eprints:

```bash
pnpm seed:dev
```

This creates test users and eprints for local testing.

## Common Issues

### Port Conflicts

If ports 5432, 9200, 7474, or 6379 are in use, modify `docker-compose.yml` to use different ports.

### Elasticsearch Memory

Elasticsearch requires at least 2GB of memory. If it fails to start, increase Docker's memory allocation.

### Neo4j Authentication

The development Neo4j instance uses authentication. Credentials are in `.env.development`.

## Next Steps

- [Developer Guide](../developer-guide) for architecture details
- [API Reference](../api-reference/overview) for endpoint documentation
- [Contributing Guide](https://github.com/chive-pub/chive/blob/main/CONTRIBUTING.md) for submitting changes
