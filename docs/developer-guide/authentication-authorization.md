# Authentication and Authorization Developer Guide

**Version:** 1.0.0
**Phase:** 10 - Authentication and Authorization
**Last Updated:** December 2025

---

## Overview

Chive implements a comprehensive authentication and authorization system built on ATProto's DID-based identity model. The system provides:

1. **DID-based Authentication**: Identity verification via AT Protocol DIDs
2. **JWT Session Management**: Stateless access tokens with Redis-backed sessions
3. **RBAC Authorization**: Role-based access control via Casbin
4. **OAuth 2.0 + PKCE**: Secure third-party application authorization
5. **Multi-factor Authentication**: TOTP and backup codes
6. **WebAuthn/Passkeys**: Passwordless authentication
7. **Zero Trust Architecture**: NIST SP 800-207 compliant security model

---

## Architecture

### Directory Structure

```
src/auth/
├── index.ts                       # Barrel exports
├── errors.ts                      # Auth-specific error types
├── authentication-service.ts      # Main authentication orchestration
├── did/
│   ├── did-resolver.ts            # DID document resolution
│   ├── did-verifier.ts            # Signature verification
│   └── index.ts
├── jwt/
│   ├── jwt-service.ts             # Token issuance/verification
│   ├── key-manager.ts             # ES256 key management
│   └── index.ts
├── session/
│   ├── session-manager.ts         # Redis session store
│   └── index.ts
├── authorization/
│   ├── authorization-service.ts   # Casbin RBAC
│   ├── policies/
│   │   └── model.conf             # Casbin model
│   └── index.ts
├── oauth/
│   ├── oauth-service.ts           # OAuth 2.0 flows
│   ├── pkce.ts                    # PKCE utilities
│   └── index.ts
├── webauthn/
│   ├── webauthn-service.ts        # Passkey operations
│   └── index.ts
├── mfa/
│   ├── mfa-service.ts             # MFA orchestration
│   └── index.ts
└── zero-trust/
    ├── zero-trust-service.ts      # Trust evaluation
    └── index.ts
```

---

## Quick Start

### Authenticating Users

```typescript
import { AuthenticationService } from '@/auth/authentication-service.js';
import { DIDResolver } from '@/auth/did/did-resolver.js';
import { JWTService } from '@/auth/jwt/jwt-service.js';
import { SessionManager } from '@/auth/session/session-manager.js';

// Create services
const didResolver = new DIDResolver({ redis, logger });
const jwtService = new JWTService({ keyManager, redis, logger });
const sessionManager = new SessionManager({ redis, logger });

const authService = new AuthenticationService({
  didResolver,
  jwtService,
  sessionManager,
  logger,
});

// Authenticate with DID
const result = await authService.authenticate({
  did: 'did:plc:abc123',
  credential: {
    type: 'app_password',
    value: 'xxxx-xxxx-xxxx-xxxx',
  },
  metadata: {
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...',
  },
});

// Result includes session and tokens
console.log(result.session.id);
console.log(result.accessToken);
console.log(result.refreshToken);
```

### Protecting Routes

```typescript
import { authenticate, requirePermission } from '@/api/middleware/auth.js';

const app = new Hono<ChiveEnv>();

// Require authentication
app.use('/api/*', authenticate());

// Require specific permission
app.post('/api/v1/eprints', requirePermission('eprint', 'create'), async (c) => {
  const user = c.get('user');
  // User is authenticated and has eprint:create permission
});
```

---

## DID Resolution

### Overview

Chive resolves ATProto DIDs to retrieve identity documents containing public keys for signature verification.

### Supported DID Methods

| Method    | Format                | Resolution              |
| --------- | --------------------- | ----------------------- |
| `did:plc` | `did:plc:abc123...`   | PLC Directory lookup    |
| `did:web` | `did:web:example.com` | HTTPS .well-known fetch |

### Usage

```typescript
import { DIDResolver } from '@/auth/did/did-resolver.js';

const resolver = new DIDResolver({
  redis,
  logger,
  config: {
    plcDirectoryUrl: 'https://plc.directory',
    cacheTtlSeconds: 300, // 5 minutes
  },
});

// Resolve DID document
const didDocument = await resolver.resolve('did:plc:abc123');

// Get verification methods
const verificationMethods = didDocument.verificationMethod;

// Get PDS endpoint
const pdsEndpoint = await resolver.getPDSEndpoint('did:plc:abc123');
```

### Caching

DID documents are cached in Redis with configurable TTL to reduce resolution latency and external API calls.

```
Key format: chive:did:document:{did}
Default TTL: 300 seconds (5 minutes)
```

---

## JWT Service

### Token Structure

Chive issues ES256-signed JWTs with the following claims:

| Claim       | Description                        |
| ----------- | ---------------------------------- |
| `sub`       | User DID                           |
| `iss`       | Token issuer (https://chive.pub)   |
| `aud`       | Token audience (https://chive.pub) |
| `iat`       | Issued at timestamp                |
| `exp`       | Expiration timestamp               |
| `jti`       | Unique token ID                    |
| `sessionId` | Associated session ID              |
| `scope`     | Space-separated scopes             |

### Issuing Tokens

```typescript
import { JWTService } from '@/auth/jwt/jwt-service.js';
import { KeyManager } from '@/auth/jwt/key-manager.js';

const keyManager = new KeyManager({ redis, logger });
const jwtService = new JWTService({
  keyManager,
  redis,
  logger,
  config: {
    issuer: 'https://chive.pub',
    audience: 'https://chive.pub',
    accessTokenExpirationSeconds: 3600, // 1 hour
  },
});

const { token, jti, expiresAt } = await jwtService.issueToken({
  subject: 'did:plc:abc123',
  sessionId: 'sess_xyz',
  scopes: ['read:eprints', 'write:reviews'],
});
```

### Verifying Tokens

```typescript
try {
  const { claims } = await jwtService.verifyToken(token);
  console.log(claims.sub); // did:plc:abc123
  console.log(claims.sessionId); // sess_xyz
  console.log(claims.scope); // 'read:eprints write:reviews'
} catch (error) {
  if (error instanceof TokenExpiredError) {
    // Token has expired
  } else if (error instanceof TokenValidationError) {
    // Token is invalid
  }
}
```

### Token Revocation

```typescript
// Revoke a specific token
await jwtService.revokeToken(jti, expiresAt);

// Token is now blacklisted until expiration
await jwtService.verifyToken(token); // Throws TokenRevokedError
```

### Key Rotation

Keys are automatically rotated based on configuration:

```typescript
const keyManager = new KeyManager({
  redis,
  logger,
  config: {
    rotationIntervalSeconds: 7776000, // 90 days
    overlapPeriodSeconds: 86400, // 24 hours
  },
});
```

During the overlap period, both old and new keys are valid for verification, ensuring seamless rotation.

---

## Session Management

### Session Lifecycle

```
Create → Active → (Update) → Revoke
                     ↓
              Sliding Expiration
```

### Creating Sessions

```typescript
import { SessionManager } from '@/auth/session/session-manager.js';

const sessionManager = new SessionManager({
  redis,
  logger,
  config: {
    sessionExpirationSeconds: 2592000, // 30 days
    maxSessionsPerUser: 10,
  },
});

const session = await sessionManager.createSession('did:plc:abc123', {
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  deviceId: 'device_xyz',
  scope: ['read:eprints', 'write:reviews'],
});
```

### Session Operations

```typescript
// Get session
const session = await sessionManager.getSession(sessionId);

// Update session (sliding expiration)
await sessionManager.updateSession(sessionId, {
  lastActivity: new Date(),
});

// Revoke single session
await sessionManager.revokeSession(sessionId);

// Revoke all sessions (logout everywhere)
await sessionManager.revokeAllSessions('did:plc:abc123');

// List active sessions
const sessions = await sessionManager.listSessions('did:plc:abc123');
```

### Redis Storage

```
Session key:     chive:session:{sessionId}
User index:      chive:user:sessions:{did}
Token blacklist: chive:token:revoked:{jti}
```

---

## Authorization (RBAC)

### Role Hierarchy

```
admin
  ↓
moderator
  ↓
authority-editor
  ↓
author
  ↓
reader
```

### Permission Model

Permissions follow the format `{resource}:{action}`:

| Resource | Actions                                       |
| -------- | --------------------------------------------- |
| `eprint` | `create`, `read`, `update`, `delete`, `admin` |
| `review` | `create`, `read`, `update`, `delete`          |
| `graph`  | `propose`, `vote`, `approve`, `admin`         |
| `user`   | `read`, `update`, `admin`                     |

### Usage

```typescript
import { AuthorizationService } from '@/auth/authorization/authorization-service.js';

const authzService = new AuthorizationService({ redis, logger });
await authzService.initialize();

// Assign role
await authzService.assignRole('did:plc:abc123', 'author');

// Check authorization
const result = await authzService.authorize({
  subject: { did: 'did:plc:abc123', roles: ['author'] },
  action: 'create',
  resource: { type: 'eprint' },
});

if (result.allowed) {
  // Proceed with action
} else {
  // Access denied: result.reason
}

// Resource owner check
const ownerResult = await authzService.authorize({
  subject: { did: 'did:plc:abc123', roles: ['author'] },
  action: 'update',
  resource: {
    type: 'eprint',
    ownerDid: 'did:plc:abc123', // Same as subject
  },
});
// ownerResult.allowed === true
// ownerResult.reason === 'resource_owner'
```

### Casbin Policy Model

```ini
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub) && r.obj == p.obj && r.act == p.act
```

---

## OAuth 2.0 + PKCE

### Supported Flows

- Authorization Code with PKCE (recommended)
- Client Credentials (service-to-service)

### Authorization Flow

```typescript
import { OAuthService } from '@/auth/oauth/oauth-service.js';

const oauthService = new OAuthService({ redis, logger });

// 1. Generate authorization URL
const { authorizationUrl, state, codeVerifier } = await oauthService.startAuthorization({
  clientId: 'client_abc123',
  redirectUri: 'https://app.example.com/callback',
  scope: ['read:eprints'],
  codeChallengeMethod: 'S256',
});

// 2. User authorizes, receives code at callback

// 3. Exchange code for tokens
const tokens = await oauthService.exchangeCode({
  code: 'auth_code_xyz',
  clientId: 'client_abc123',
  redirectUri: 'https://app.example.com/callback',
  codeVerifier,
});
```

### Client Registration

```typescript
const client = await oauthService.registerClient({
  name: 'My Research App',
  redirectUris: ['https://app.example.com/callback'],
  clientType: 'public',
  scopes: ['read:eprints', 'write:reviews'],
  ownerDid: 'did:plc:abc123',
});
```

---

## WebAuthn (Passkeys)

### Registration Flow

```typescript
import { WebAuthnService } from '@/auth/webauthn/webauthn-service.js';

const webauthnService = new WebAuthnService({
  redis,
  logger,
  config: {
    rpId: 'chive.pub',
    rpName: 'Chive',
    origin: 'https://chive.pub',
  },
});

// 1. Generate registration challenge
const challenge = await webauthnService.generateRegistrationChallenge('did:plc:abc123');

// 2. Client creates credential (browser WebAuthn API)

// 3. Verify registration
const credential = await webauthnService.verifyRegistration('did:plc:abc123', {
  challenge,
  credential: clientResponse,
});
```

### Authentication Flow

```typescript
// 1. Generate authentication challenge
const challenge = await webauthnService.generateAuthenticationChallenge('did:plc:abc123');

// 2. Client authenticates (browser WebAuthn API)

// 3. Verify authentication
const result = await webauthnService.verifyAuthentication('did:plc:abc123', {
  challenge,
  credential: clientResponse,
});
```

---

## Multi-Factor Authentication

### TOTP Enrollment

```typescript
import { MFAService } from '@/auth/mfa/mfa-service.js';

const mfaService = new MFAService({ redis, logger });

// 1. Start enrollment
const { secret, qrCodeUri } = await mfaService.enrollTOTP('did:plc:abc123');

// 2. User scans QR code in authenticator app

// 3. Verify enrollment with code
await mfaService.verifyTOTPEnrollment('did:plc:abc123', '123456');
```

### Verification

```typescript
// Verify TOTP or backup code
const result = await mfaService.verifyMFA('did:plc:abc123', {
  type: 'totp',
  code: '123456',
});

if (!result.success) {
  console.log(result.error); // 'invalid_code' | 'expired_code' | etc.
}
```

### Backup Codes

```typescript
// Generate backup codes
const codes = await mfaService.regenerateBackupCodes('did:plc:abc123');
// Returns array of 10 single-use codes

// Verify backup code
const result = await mfaService.verifyMFA('did:plc:abc123', {
  type: 'backup_code',
  code: 'XXXX-XXXX-XXXX',
});
```

---

## Zero Trust Architecture

### Trust Evaluation

```typescript
import { ZeroTrustService } from '@/auth/zero-trust/zero-trust-service.js';

const zeroTrustService = new ZeroTrustService({ redis, logger });

const decision = await zeroTrustService.evaluate({
  subject: {
    did: 'did:plc:abc123',
    sessionId: 'sess_xyz',
    authMethod: 'webauthn',
    authTime: new Date(),
    mfaVerified: true,
    roles: ['author'],
  },
  resource: {
    type: 'eprint',
    sensitivity: 'high',
  },
  context: {
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...',
    deviceId: 'device_xyz',
    requestTime: new Date(),
    geoLocation: 'US',
  },
});

if (decision.allow) {
  // Proceed with request
} else {
  // decision.reason explains why access was denied
  // decision.requiredActions lists remediation steps
}
```

### Trust Score Components

| Component         | Weight | Description                      |
| ----------------- | ------ | -------------------------------- |
| Authentication    | 0.3    | Auth method strength, MFA status |
| Device Posture    | 0.25   | Known device, security state     |
| Behavior Analysis | 0.25   | Anomaly detection, risk signals  |
| Network Context   | 0.2    | IP reputation, geolocation       |

---

## Error Handling

### Error Types

```typescript
import {
  AuthenticationError,
  TokenValidationError,
  TokenExpiredError,
  SessionRevokedError,
  MFARequiredError,
  WebAuthnError,
} from '@/auth/errors.js';
```

### Error Codes

| Code                  | Description                       |
| --------------------- | --------------------------------- |
| `invalid_credentials` | Credentials verification failed   |
| `invalid_signature`   | JWT signature verification failed |
| `token_expired`       | JWT has expired                   |
| `token_revoked`       | JWT has been revoked              |
| `session_revoked`     | Session has been revoked          |
| `mfa_required`        | MFA verification required         |
| `invalid_code`        | MFA code is invalid               |

---

## Database Schema

### PostgreSQL Tables

```sql
-- User roles (RBAC)
CREATE TABLE user_roles (
  did TEXT NOT NULL,
  role TEXT NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by TEXT,
  expires_at TIMESTAMPTZ,
  PRIMARY KEY (did, role)
);

-- OAuth clients
CREATE TABLE oauth_clients (
  client_id TEXT PRIMARY KEY,
  client_secret_hash TEXT,
  client_type TEXT NOT NULL,
  name TEXT NOT NULL,
  redirect_uris TEXT[] NOT NULL,
  scopes TEXT[] NOT NULL,
  owner_did TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WebAuthn credentials
CREATE TABLE webauthn_credentials (
  credential_id TEXT PRIMARY KEY,
  did TEXT NOT NULL,
  public_key TEXT NOT NULL,
  counter BIGINT DEFAULT 0,
  transports TEXT[],
  nickname TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MFA enrollments
CREATE TABLE mfa_enrollments (
  did TEXT PRIMARY KEY,
  totp_secret_encrypted TEXT,
  totp_enabled BOOLEAN DEFAULT false,
  backup_codes_hash TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor_did TEXT,
  action TEXT NOT NULL,
  result TEXT NOT NULL,
  ip_address INET,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Testing

### Unit Tests

```bash
# Run auth unit tests
npm run test:unit -- tests/unit/auth/

# Test specific service
npm run test:unit -- tests/unit/auth/jwt-service.test.ts
```

### Integration Tests

```bash
# Run auth integration tests
npm run test:integration -- tests/integration/auth/
```

### Test Fixtures

```typescript
import { createMockLogger, createMockRedis } from '@tests/fixtures/mocks.js';

const logger = createMockLogger();
const redis = createMockRedis();

const service = new JWTService({ keyManager, redis, logger });
```

---

## Security Considerations

### Token Security

- Access tokens expire after 1 hour
- Refresh tokens are single-use
- Token revocation is immediate via Redis blacklist
- ES256 algorithm with 256-bit keys

### Session Security

- Sessions expire after 30 days of inactivity
- Maximum 10 sessions per user
- IP and user agent tracked for anomaly detection
- Session revocation cascades to all tokens

### MFA Security

- TOTP secrets encrypted at rest (AES-256-GCM)
- Backup codes hashed with SHA-256
- Rate limiting on verification attempts
- Lockout after repeated failures

### WebAuthn Security

- Credential counter tracking for replay detection
- Attestation verification (none, direct)
- Challenge expiration (5 minutes)

---

## Related Documentation

- [API Layer Guide](./api-layer.md): Middleware integration
- [ATProto DID Specification](https://atproto.com/specs/did): DID handling
