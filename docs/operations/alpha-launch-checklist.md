# Alpha Launch Checklist

Post-deployment manual checklist for launching the Chive alpha.

## Pre-Launch Verification

### GitHub Secrets (Required)

Verify all required secrets are configured in GitHub repository settings:

- [ ] `SSH_PRIVATE_KEY` - Server access key
- [ ] `APP_HOST` - Application server IP
- [ ] `DOCS_HOST` - Docs server IP (same as APP_HOST)
- [ ] `SSH_USER` - SSH username (ubuntu)
- [ ] `POSTGRES_PASSWORD` - Database password
- [ ] `NEO4J_PASSWORD` - Graph database password
- [ ] `JWT_SECRET` - API authentication secret
- [ ] `SESSION_SECRET` - Session encryption secret
- [ ] `GOVERNANCE_PDS_JWT_SECRET` - Governance PDS auth
- [ ] `GOVERNANCE_PDS_ADMIN_PASSWORD` - Governance PDS admin
- [ ] `GOVERNANCE_PDS_ROTATION_KEY` - Governance PDS key rotation

### GitHub Variables (Required)

- [ ] `DOMAIN` - Primary domain (chive.pub)
- [ ] `ACME_EMAIL` - Let's Encrypt email
- [ ] `ATPROTO_SERVICE_DID` - ATProto service DID

### Infrastructure Verification

- [ ] Application server accessible via SSH
- [ ] DNS records configured for chive.pub, docs.chive.pub, governance.chive.pub
- [ ] SSL certificates provisioned (Traefik + Let's Encrypt)
- [ ] PostgreSQL container healthy
- [ ] Neo4j container healthy
- [ ] Redis container healthy
- [ ] Elasticsearch container healthy

## Post-Deployment Steps

### 1. Verify Services

```bash
# SSH to server (replace <SERVER_IP> with actual IP from APP_HOST secret)
ssh ubuntu@<SERVER_IP>

# Check container status
cd /opt/chive/docker
docker compose -f docker-compose.prod.yml ps

# Verify API health
curl -sf https://chive.pub/api/health

# Verify web health
curl -sf https://chive.pub/

# Verify docs health
curl -sf https://docs.chive.pub/
```

### 2. Run Database Migrations

```bash
# Migrations run automatically on deploy, verify they completed
docker compose -f docker-compose.prod.yml logs chive-api | grep -i migration
```

### 3. Change @chive.pub Handle (Task 20)

The @chive.pub Bluesky account is currently using `chive.pds.chive.pub` as its handle. Change it to `@chive.pub`:

1. Open https://bsky.app/settings
2. Log in with the Chive account credentials (from `pds.chive.pub` admin)
3. Go to **Settings** → **Handle**
4. Select **I have my own domain**
5. Enter `chive.pub`
6. Add DNS TXT record: `_atproto.chive.pub` → `did=did:plc:7natp5xae72bddaqlkef2t4e`
7. Verify handle resolves: `curl -s https://plc.directory/did:plc:7natp5xae72bddaqlkef2t4e | jq`

### 4. Post Bluesky Announcement Threads (Task 21)

Post the announcement threads from `/bluesky-threads/`:

#### Thread 1: Features Overview

- File: `bluesky-threads/thread1-features.txt`
- Post from @chive.pub account
- Include key features and invite link

#### Thread 2: Technical Architecture

- File: `bluesky-threads/thread2-technical.txt`
- Post as reply to Thread 1 or standalone
- Cover ATProto integration, decentralization

#### Thread 3: Alpha Tester Call

- File: `bluesky-threads/thread3-alpha-testers.txt`
- Quote Thread 1 when posting
- Clear CTA for researchers to apply

### 5. Test Alpha Signup Flow

1. Open https://chive.pub in incognito browser
2. Verify marketing page displays for unauthenticated users
3. Click **Sign In** → authenticate with Bluesky
4. Verify alpha signup form appears
5. Submit a test application
6. Verify pending status displays
7. Use admin script to approve:

```bash
# On server
./scripts/alpha-admin.sh list
./scripts/alpha-admin.sh approve did:plc:your-test-did admin
```

8. Verify approved user sees full application

### 6. Configure Monitoring Alerts

- [ ] Set up uptime monitoring (UptimeRobot/Pingdom)
- [ ] Configure error alerting (Sentry)
- [ ] Set up log aggregation (Grafana Loki)

## Admin Operations

### Approving Alpha Testers

```bash
# List pending applications
./scripts/alpha-admin.sh list

# Approve an application
./scripts/alpha-admin.sh approve did:plc:abc123 your-did

# Reject an application
./scripts/alpha-admin.sh reject did:plc:abc123 your-did

# View application details
./scripts/alpha-admin.sh show did:plc:abc123

# View statistics
./scripts/alpha-admin.sh stats
```

### Bulk Operations

```bash
# Export all applications to CSV
./scripts/alpha-admin.sh export applications.csv

# Batch approve from file
./scripts/alpha-admin.sh batch-approve approved-dids.txt admin
```

## Rollback Procedure

If issues are discovered:

```bash
# SSH to server
ssh ubuntu@<SERVER_IP>

# View deployment history
git log --oneline -10

# Rollback to previous commit
git reset --hard HEAD~1

# Rebuild and restart
cd docker
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

## Contact

- **Technical Issues**: File issue at https://github.com/chive-pub/chive/issues
- **Security Issues**: security@chive.pub
- **Support**: support@chive.pub
