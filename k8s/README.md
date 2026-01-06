# Kubernetes Deployment

Kubernetes infrastructure for deploying Chive in production.

## Directory Structure

```
k8s/
├── base/                    # Kustomize base manifests
│   ├── namespace.yaml       # chive namespace
│   ├── rbac/                # Service accounts, roles, bindings
│   ├── appview/             # API server deployment
│   ├── indexer/             # Firehose consumer deployment
│   ├── frontend/            # Next.js frontend deployment
│   ├── ingress/             # Ingress and certificates
│   └── databases/           # Single-instance database StatefulSets
├── overlays/                # Environment-specific patches
│   ├── development/         # Minimal resources, single replicas
│   ├── staging/             # Moderate resources, 2 replicas
│   └── production/          # Full resources, HPA enabled, HA
├── helm/                    # Helm charts
│   └── chive/               # Main application chart
├── monitoring/              # Prometheus ServiceMonitors and alerts
├── secrets/                 # Secret templates (never commit actual secrets)
└── disaster-recovery/       # Backup CronJobs
```

## Deployment Options

### Option 1: Kustomize (Recommended for GitOps)

```bash
# Development
kubectl apply -k k8s/overlays/development/

# Staging
kubectl apply -k k8s/overlays/staging/

# Production
kubectl apply -k k8s/overlays/production/
```

### Option 2: Helm (Recommended for templated deployments)

```bash
# Install with defaults (minimal resources)
helm install chive k8s/helm/chive/

# Install with HA configuration
helm install chive k8s/helm/chive/ -f k8s/helm/chive/values-ha.yaml

# Install with custom values
helm install chive k8s/helm/chive/ --set appview.replicaCount=3
```

## Prerequisites

1. **Kubernetes cluster** (1.28+)
2. **kubectl** configured
3. **NGINX Ingress Controller**:
   ```bash
   helm install ingress-nginx ingress-nginx/ingress-nginx
   ```
4. **cert-manager** (for TLS):
   ```bash
   kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
   ```
5. **Prometheus Operator** (optional, for ServiceMonitors):
   ```bash
   helm install prometheus prometheus-community/kube-prometheus-stack
   ```

## Secrets Management

Create secrets before deploying:

```bash
# Generate secure passwords
POSTGRES_PASSWORD=$(openssl rand -base64 32)
NEO4J_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 64)
SESSION_SECRET=$(openssl rand -base64 64)

# Create Kubernetes secret
kubectl create secret generic chive-secrets \
  --from-literal=POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  --from-literal=NEO4J_AUTH="neo4j/$NEO4J_PASSWORD" \
  --from-literal=NEO4J_PASSWORD="$NEO4J_PASSWORD" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --from-literal=SESSION_SECRET="$SESSION_SECRET" \
  -n chive
```

For production, use External Secrets Operator or Sealed Secrets.
See `k8s/secrets/external-secrets.yaml` for a Vault integration example.

## Configuration

### Domain Configuration

Update ingress hosts in:

- `k8s/base/ingress/ingress.yaml`
- `k8s/base/ingress/certificate.yaml`
- `k8s/helm/chive/values.yaml`

### Resource Scaling

| Environment | AppView                     | Indexer | Frontend        | PostgreSQL   |
| ----------- | --------------------------- | ------- | --------------- | ------------ |
| Development | 1 pod, 100m/500m CPU        | 1 pod   | 1 pod           | 1Gi storage  |
| Staging     | 2 pods, 200m/1 CPU          | 1 pod   | 2 pods          | 10Gi storage |
| Production  | 3-20 pods (HPA), 500m/2 CPU | 1 pod   | 2-10 pods (HPA) | 50Gi storage |

### External Databases

To use managed databases (RDS, ElasticCloud, etc.):

1. Set database `enabled: false` in Helm values
2. Update ConfigMap with external endpoints:
   ```yaml
   POSTGRES_HOST: 'your-rds-instance.amazonaws.com'
   ELASTICSEARCH_URL: 'https://your-es-cluster.es.amazonaws.com'
   ```

## Monitoring

ServiceMonitors are in `k8s/monitoring/`:

- `servicemonitor-appview.yaml`: API metrics
- `servicemonitor-indexer.yaml`: Firehose metrics
- `servicemonitor-databases.yaml`: Database exporters

Alert rules included:

- High error rate (above 1%)
- High latency (P95 above 2s)
- Firehose lag (above 5 minutes)
- Database connection pool exhaustion
- HPA at max replicas

## Backup & Disaster Recovery

CronJobs in `k8s/disaster-recovery/backup/`:

- PostgreSQL: Daily pg_dump at 2 AM UTC
- Elasticsearch: Daily snapshots at 3 AM UTC
- Neo4j: Daily export at 4 AM UTC
- Redis: Daily RDB snapshot at 5 AM UTC

Backups stored in PVCs by default. Configure S3 upload in ConfigMaps.

## Health Checks

- Liveness: `GET /health` (process is running)
- Readiness: `GET /ready` (all dependencies connected)

## Troubleshooting

```bash
# Check pod status
kubectl get pods -n chive

# View logs
kubectl logs -f deploy/chive-appview -n chive

# Check events
kubectl get events -n chive --sort-by='.lastTimestamp'

# Describe failing pod
kubectl describe pod <pod-name> -n chive

# Check HPA status
kubectl get hpa -n chive

# Check PDB status
kubectl get pdb -n chive
```
