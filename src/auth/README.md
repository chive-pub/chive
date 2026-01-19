# Authentication and Authorization

Authentication, authorization, and identity resolution for Chive.

## Overview

This module implements AT Protocol OAuth authentication, service-to-service authentication, and role-based authorization following Zero Trust principles (NIST SP 800-207).

## Directory Structure

```
auth/
├── index.ts                     # Module exports
├── errors.ts                    # Auth-specific error types
├── authentication-service.ts    # Main authentication orchestration
├── atproto-oauth/               # AT Protocol OAuth 2.0 implementation
│   ├── index.ts                 # Barrel exports
│   ├── node-oauth-client.ts     # OAuth client for Node.js
│   ├── session-store.ts         # OAuth session persistence
│   └── state-store.ts           # OAuth state management
├── authorization/               # Role-based access control
│   ├── index.ts                 # Barrel exports
│   ├── authorization-service.ts # RBAC implementation
│   ├── casbin-model.conf        # Casbin policy model
│   └── default-policy.csv       # Default permission policies
├── did/                         # DID (Decentralized Identifier) handling
│   ├── index.ts                 # Barrel exports
│   ├── did-resolver.ts          # DID resolution (did:plc, did:web)
│   └── did-verifier.ts          # DID signature verification
├── jwt/                         # JSON Web Token utilities
│   ├── index.ts                 # Barrel exports
│   ├── jwt-service.ts           # JWT creation and validation
│   └── key-manager.ts           # Cryptographic key management
├── mfa/                         # Multi-factor authentication
│   ├── index.ts                 # Barrel exports
│   └── mfa-service.ts           # TOTP/backup code implementation
├── service-auth/                # Service-to-service authentication
│   ├── index.ts                 # Barrel exports
│   └── service-auth-verifier.ts # ATProto service JWT verification
├── session/                     # Session management
│   ├── index.ts                 # Barrel exports
│   ├── session-manager.ts       # User session handling
│   └── refresh-token-manager.ts # Token refresh logic
├── webauthn/                    # WebAuthn/passkey support
│   ├── index.ts                 # Barrel exports
│   └── webauthn-service.ts      # FIDO2/WebAuthn implementation
└── zero-trust/                  # Zero Trust architecture
    ├── index.ts                 # Barrel exports
    └── zero-trust-service.ts    # Continuous verification
```

## Key Components

### ATProto OAuth

OAuth 2.0 implementation for AT Protocol, handling:

- Authorization code flow with PKCE
- Token exchange and refresh
- Session persistence in Redis

### Service Authentication

Verifies inter-service JWTs per AT Protocol specification:

- DID-based audience validation
- Signature verification against DID documents
- Token expiration and replay protection

### Authorization (Casbin)

Role-based access control using Casbin:

- Policy model in `casbin-model.conf`
- Default permissions in `default-policy.csv`
- Roles: anonymous, authenticated, trusted_editor, admin

### DID Resolution

Resolves AT Protocol DIDs:

- `did:plc` via PLC directory
- `did:web` via .well-known endpoints
- Caches results in Redis

## Usage Example

```typescript
import { AuthenticationService } from './authentication-service.js';
import { ServiceAuthVerifier } from './service-auth/index.js';

// Verify service-to-service auth
const verifier = new ServiceAuthVerifier({
  logger,
  config: {
    serviceDid: 'did:web:chive.pub',
    plcDirectoryUrl: 'https://plc.directory',
  },
});

const result = await verifier.verify(authHeader);
if (result.valid) {
  const { iss, aud, lxm } = result.payload;
  // Process authenticated request
}
```

## Environment Variables

- `JWT_SECRET`: Secret for signing internal JWTs
- `PLC_DIRECTORY_URL`: PLC directory for DID resolution (default: https://plc.directory)
- `SERVICE_DID`: Chive's service DID for auth verification
