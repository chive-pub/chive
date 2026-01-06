# Deployment

This guide covers deploying Chive to production using Docker and Kubernetes.

## Prerequisites

- Docker 24+ and Docker Compose
- Kubernetes 1.28+ cluster (for K8s deployment)
- Helm 3.12+ (for K8s deployment)
- Access to container registry

## Docker deployment

### Building images

```bash
# Build all images
docker compose -f docker-compose.prod.yml build

# Build specific service
docker compose -f docker-compose.prod.yml build api
```

### Image structure

| Image           | Purpose                  |
| --------------- | ------------------------ |
| `chive/api`     | API server (Hono)        |
| `chive/indexer` | Firehose consumer        |
| `chive/worker`  | Background job processor |
| `chive/web`     | Next.js frontend         |

### Running with Docker Compose

```bash
# Start all services
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Stop services
docker compose -f docker-compose.prod.yml down
```

### Production compose file

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  api:
    image: chive/api:latest
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1'
          memory: 1G
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
      interval: 30s
      timeout: 10s
      retries: 3

  indexer:
    image: chive/indexer:latest
    environment:
      - NODE_ENV=production
      - FIREHOSE_URL=${FIREHOSE_URL}
    deploy:
      replicas: 1 # Single consumer for ordering
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

  worker:
    image: chive/worker:latest
    environment:
      - NODE_ENV=production
      - REDIS_URL=${REDIS_URL}
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

  web:
    image: chive/web:latest
    ports:
      - '3001:3000'
    environment:
      - NODE_ENV=production
      - API_URL=http://api:3000
    deploy:
      replicas: 2
```

## Kubernetes deployment

### Helm chart

Chive provides a Helm chart for Kubernetes deployment:

```bash
# Add Chive Helm repo
helm repo add chive https://charts.chive.pub
helm repo update

# Install
helm install chive chive/chive \
  --namespace chive \
  --create-namespace \
  --values values.yaml
```

### Values configuration

```yaml
# values.yaml
global:
  environment: production
  domain: chive.pub

api:
  replicas: 3
  resources:
    requests:
      cpu: 500m
      memory: 512Mi
    limits:
      cpu: 1000m
      memory: 1Gi
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 10
    targetCPU: 70

indexer:
  replicas: 1 # Must be 1 for event ordering
  resources:
    requests:
      cpu: 250m
      memory: 256Mi

worker:
  replicas: 2
  resources:
    requests:
      cpu: 250m
      memory: 256Mi

web:
  replicas: 2
  resources:
    requests:
      cpu: 250m
      memory: 256Mi

postgresql:
  enabled: true
  primary:
    persistence:
      size: 100Gi

elasticsearch:
  enabled: true
  replicas: 3
  volumeClaimTemplate:
    resources:
      requests:
        storage: 100Gi

neo4j:
  enabled: true
  core:
    standalone: true
    persistentVolume:
      size: 50Gi

redis:
  enabled: true
  architecture: standalone
  persistence:
    size: 10Gi

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: chive.pub
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: chive-tls
      hosts:
        - chive.pub
```

### Secrets management

```bash
# Create secrets
kubectl create secret generic chive-secrets \
  --namespace chive \
  --from-literal=database-url='postgresql://...' \
  --from-literal=redis-url='redis://...' \
  --from-literal=jwt-secret='...'

# Or use external secrets operator
kubectl apply -f external-secrets.yaml
```

## Database setup

### PostgreSQL initialization

```bash
# Run migrations
kubectl exec -it deploy/chive-api -n chive -- \
  pnpm db:migrate:up

# Verify schema
kubectl exec -it deploy/chive-api -n chive -- \
  pnpm db:migrate:status
```

### Elasticsearch setup

```bash
# Apply templates
kubectl exec -it deploy/chive-api -n chive -- \
  tsx scripts/db/setup-elasticsearch.ts
```

### Neo4j setup

```bash
# Initialize schema
kubectl exec -it deploy/chive-api -n chive -- \
  tsx scripts/db/setup-neo4j.ts
```

## Environment variables

### Required

| Variable            | Description                  |
| ------------------- | ---------------------------- |
| `DATABASE_URL`      | PostgreSQL connection string |
| `REDIS_URL`         | Redis connection string      |
| `ELASTICSEARCH_URL` | Elasticsearch cluster URL    |
| `NEO4J_URI`         | Neo4j Bolt URI               |
| `NEO4J_PASSWORD`    | Neo4j password               |
| `JWT_SECRET`        | Secret for signing JWTs      |
| `FIREHOSE_URL`      | ATProto relay URL            |

### Optional

| Variable                      | Default       | Description            |
| ----------------------------- | ------------- | ---------------------- |
| `NODE_ENV`                    | `development` | Environment            |
| `PORT`                        | `3000`        | API server port        |
| `LOG_LEVEL`                   | `info`        | Logging level          |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | None          | OpenTelemetry endpoint |

## Health checks

### Endpoints

| Endpoint        | Purpose                        |
| --------------- | ------------------------------ |
| `/health`       | Basic liveness check           |
| `/health/ready` | Readiness (includes DB checks) |
| `/health/live`  | Liveness (process running)     |

### Kubernetes probes

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
```

## TLS and certificates

### Using cert-manager

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@chive.pub
    privateKeySecretRef:
      name: letsencrypt-prod-key
    solvers:
      - http01:
          ingress:
            class: nginx
```

## Rolling updates

### Deployment strategy

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```

### Triggering updates

```bash
# Update image tag
helm upgrade chive chive/chive \
  --namespace chive \
  --set api.image.tag=v1.2.3

# Or with kubectl
kubectl set image deployment/chive-api \
  api=chive/api:v1.2.3 -n chive
```

## Rollback

```bash
# Helm rollback
helm rollback chive 1 -n chive

# Kubernetes rollback
kubectl rollout undo deployment/chive-api -n chive

# Check rollout status
kubectl rollout status deployment/chive-api -n chive
```

## Related documentation

- [Monitoring](./monitoring.md): Observability setup
- [Scaling](./scaling.md): Horizontal and vertical scaling
- [Troubleshooting](./troubleshooting.md): Common issues
