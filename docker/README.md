# Docker Deployment

Docker configurations for Chive development and single-server production deployments.

## Files

- `Dockerfile`: Multi-stage build for Node.js 22 application
- `docker-compose.yml`: Local development stack (databases only)
- `docker-compose.prod.yml`: Production single-server deployment
- `.env.production.example`: Environment variables template

## Quick Start

### Development (Databases Only)

```bash
# Start development databases
docker compose -f docker/docker-compose.yml up -d

# Verify services are healthy
docker compose -f docker/docker-compose.yml ps

# Run application locally
pnpm run dev
```

### Production (Single Server)

Ideal for Tier 1 deployment ($20-50/month VPS, handles 1,000+ users).

```bash
# 1. Build the application image
docker build -t chive:latest -f docker/Dockerfile .

# 2. Copy and configure environment
cp docker/.env.production.example docker/.env.production
# Edit .env.production with your values

# 3. Start all services
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.production up -d

# 4. Check status
docker compose -f docker/docker-compose.prod.yml ps
```

## Configuration

### Required Environment Variables

```bash
# Domain (for SSL certificates)
DOMAIN=chive.example.com
ACME_EMAIL=admin@example.com

# Database passwords (generate secure values!)
POSTGRES_PASSWORD=$(openssl rand -base64 32)
NEO4J_PASSWORD=$(openssl rand -base64 32)

# Security secrets (generate secure values!)
JWT_SECRET=$(openssl rand -base64 64)
SESSION_SECRET=$(openssl rand -base64 64)
```

### Traefik Dashboard

Access at `https://traefik.your-domain.com` with basic auth.

Generate password:

```bash
# Install htpasswd
apt install apache2-utils

# Generate hash
htpasswd -nb admin your-password
# Copy output to TRAEFIK_BASIC_AUTH in .env.production
```

## Services

| Service       | Port       | Description                    |
| ------------- | ---------- | ------------------------------ |
| chive-api     | 3000       | AppView API server             |
| chive-indexer | -          | Firehose consumer (background) |
| postgres      | 5432       | PostgreSQL 16                  |
| redis         | 6379       | Redis 7                        |
| elasticsearch | 9200       | Elasticsearch 8.11             |
| neo4j         | 7474, 7687 | Neo4j 5 Community              |
| traefik       | 80, 443    | Reverse proxy + SSL            |

## Resource Requirements

| Configuration | RAM  | CPU     | Disk  |
| ------------- | ---- | ------- | ----- |
| Minimum       | 4GB  | 2 cores | 50GB  |
| Recommended   | 8GB  | 4 cores | 100GB |
| Heavy load    | 16GB | 8 cores | 200GB |

## Monitoring (Optional)

Enable with the `observability` profile:

```bash
docker compose -f docker/docker-compose.prod.yml --profile observability up -d
```

This adds:

- **OpenTelemetry Collector**: Telemetry aggregation
- **Prometheus**: Metrics storage (https://prometheus.your-domain.com)
- **Grafana**: Dashboards (https://grafana.your-domain.com)

## Backups

Manual backup:

```bash
# PostgreSQL
docker exec chive-postgres pg_dump -U chive chive > backup.sql

# Redis
docker exec chive-redis redis-cli BGSAVE

# Elasticsearch
curl -X PUT "localhost:9200/_snapshot/backup/snapshot_1?wait_for_completion=true"
```

Restore:

```bash
# PostgreSQL
docker exec -i chive-postgres psql -U chive chive < backup.sql
```

## Scaling Beyond Single Server

When you outgrow single-server deployment:

1. **Tier 2**: Move to Kubernetes with `k8s/overlays/production/`
2. **Enable HPA** for automatic scaling
3. **Use managed databases** (RDS, ElasticCloud) for HA
4. See `k8s/README.md` for Kubernetes deployment

## Troubleshooting

```bash
# View logs
docker compose -f docker/docker-compose.prod.yml logs -f chive-api

# Check health
curl http://localhost:3000/health

# Restart a service
docker compose -f docker/docker-compose.prod.yml restart chive-api

# Full restart
docker compose -f docker/docker-compose.prod.yml down
docker compose -f docker/docker-compose.prod.yml up -d
```
