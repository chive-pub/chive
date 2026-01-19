# Configuration

Configuration loading and validation for Chive.

## Overview

This directory is reserved for centralized configuration management. Currently, configuration is handled through:

- Environment variables (loaded via `process.env`)
- Module-specific config files (e.g., `src/api/config.ts`, `src/storage/postgresql/config.ts`)

## Planned Structure

```
config/
├── index.ts          # Configuration loader and validator
├── schema.ts         # Zod schemas for config validation
├── defaults.ts       # Default configuration values
└── env.ts            # Environment variable mapping
```

## Current Configuration Locations

Configuration is currently distributed across modules:

- **API**: `src/api/config.ts` (CORS, rate limits, pagination)
- **PostgreSQL**: `src/storage/postgresql/config.ts` (connection settings)
- **Elasticsearch**: `src/storage/elasticsearch/setup.ts` (index templates, ILM)
- **Neo4j**: `src/storage/neo4j/connection.ts` (connection pooling)

## Environment Variables

See `.env.example` in the project root for all available environment variables.

Key categories:

- Database connections (PostgreSQL, Elasticsearch, Neo4j, Redis)
- Authentication (JWT secrets, service DIDs)
- API settings (CORS origins, rate limits)
- Feature flags (alpha access, rate limiting toggle)
