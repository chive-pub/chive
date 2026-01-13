# Authentication

Chive uses AT Protocol OAuth for user authentication and JWT tokens for session management. This page covers the authentication flows, token handling, and authorization.

## Authentication methods

| Method                | Use case         | How it works                                           |
| --------------------- | ---------------- | ------------------------------------------------------ |
| **AT Protocol OAuth** | User login       | OAuth 2.0 + PKCE/DPoP via `@atproto/oauth-client-node` |
| **Service auth JWT**  | Server-to-server | Signed JWTs for inter-service calls                    |
| **Session tokens**    | API requests     | Bearer tokens from OAuth flow                          |

## AT Protocol OAuth flow

Chive implements the AT Protocol OAuth specification using `@atproto/oauth-client-node`. The OAuth flow is handled by the Next.js frontend, not the API server.

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Browser │     │  Next.js │     │ User PDS │     │  User    │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │  1. Login      │                │                │
     │───────────────►│                │                │
     │                │                │                │
     │  2. Redirect to PDS             │                │
     │◄───────────────│                │                │
     │                │                │                │
     │  3. Auth at PDS                 │                │
     │────────────────────────────────►│                │
     │                │                │                │
     │                │                │  4. Consent    │
     │                │                │◄───────────────│
     │                │                │                │
     │  5. Callback with tokens        │                │
     │◄────────────────────────────────│                │
     │                │                │                │
     │  6. Session created             │                │
     │───────────────►│                │                │
     └────────────────┴────────────────┴────────────────┘
```

### Implementation

The OAuth flow is implemented in the frontend using `@atproto/oauth-client-node`:

```typescript
// web/lib/auth/oauth-client.ts
import { NodeOAuthClient } from '@atproto/oauth-client-node';

const oauthClient = new NodeOAuthClient({
  clientMetadata: {
    client_id: 'https://chive.pub/oauth/client-metadata.json',
    // ...
  },
});

// Start login
const url = await oauthClient.authorize(handle, {
  scope: 'atproto transition:generic',
});

// Handle callback
const { session } = await oauthClient.callback(params);
```

### Session tokens

After successful OAuth, the frontend receives DPoP-bound tokens that are used for API requests.

## Using access tokens

Include the access token in API requests:

```http
GET /xrpc/pub.chive.actor.getMyProfile
Authorization: Bearer eyJhbGciOiJFUzI1NiIs...
```

### Token structure

Access tokens are JWTs containing:

```json
{
  "iss": "https://api.chive.pub",
  "sub": "did:plc:abc123...",
  "aud": "https://api.chive.pub",
  "exp": 1704416400,
  "iat": 1704412800,
  "scope": "read write",
  "handle": "alice.bsky.social"
}
```

| Claim    | Description           |
| -------- | --------------------- |
| `iss`    | Token issuer (Chive)  |
| `sub`    | User's DID            |
| `aud`    | Intended audience     |
| `exp`    | Expiration timestamp  |
| `iat`    | Issued-at timestamp   |
| `scope`  | Granted permissions   |
| `handle` | User's current handle |

## Token refresh

Access tokens expire after 1 hour. Use the refresh token to get new access tokens:

```http
POST /oauth/token
Content-Type: application/json

{
  "grant_type": "refresh_token",
  "refresh_token": "eyJhbGciOiJFUzI1NiIs..."
}
```

Response:

```json
{
  "access_token": "new-access-token...",
  "refresh_token": "new-refresh-token...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### Token lifetimes

| Token type    | Lifetime | Refresh behavior           |
| ------------- | -------- | -------------------------- |
| Access token  | 1 hour   | Must refresh before expiry |
| Refresh token | 30 days  | Rotated on each use        |
| Session       | 30 days  | Extended on activity       |

## Logout

Revoke tokens when the user logs out:

```http
POST /oauth/revoke
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJFUzI1NiIs...

{
  "token": "refresh-token-to-revoke"
}
```

## Service authentication

For server-to-server communication, Chive uses service auth JWTs:

```http
POST /xrpc/pub.chive.sync.refreshRecord
Authorization: Bearer eyJhbGciOiJFUzI1NiIs...
X-Service-DID: did:plc:chive-service
```

### Service auth JWT structure

```json
{
  "iss": "did:plc:chive-service",
  "aud": "did:web:api.chive.pub",
  "exp": 1704413100,
  "iat": 1704412800,
  "lxm": "pub.chive.sync.refreshRecord"
}
```

| Claim | Description                 |
| ----- | --------------------------- |
| `iss` | Service DID (issuer)        |
| `aud` | Target service DID          |
| `lxm` | Lexicon method being called |

Service auth tokens are short-lived (5 minutes) and scoped to specific operations.

## Authorization

After authentication, Chive checks authorization using role-based access control (RBAC).

### Roles

| Role               | Description             |
| ------------------ | ----------------------- |
| `anonymous`        | Unauthenticated users   |
| `user`             | Authenticated users     |
| `researcher`       | Verified researchers    |
| `trusted_editor`   | Community moderators    |
| `authority_editor` | Library science experts |
| `admin`            | System administrators   |

### Permission matrix

| Operation                | Anonymous | User | Researcher | Editor |
| ------------------------ | --------- | ---- | ---------- | ------ |
| Read eprints             | Yes       | Yes  | Yes        | Yes    |
| Submit eprint            | No        | Yes  | Yes        | Yes    |
| Write review             | No        | Yes  | Yes        | Yes    |
| Create endorsement       | No        | Yes  | Yes        | Yes    |
| Propose field            | No        | Yes  | Yes        | Yes    |
| Vote on proposal         | No        | Yes  | Yes        | Yes    |
| Approve authority record | No        | No   | No         | Yes    |
| Moderate content         | No        | No   | No         | Yes    |

### Checking permissions

The API returns 403 Forbidden when authorization fails:

```json
{
  "error": "Forbidden",
  "message": "You do not have permission to perform this action",
  "details": {
    "required_role": "trusted_editor",
    "your_role": "user"
  }
}
```

## WebAuthn (Passkeys)

Chive supports WebAuthn for passwordless authentication and MFA:

### Register a passkey

```http
POST /auth/webauthn/register/options
Authorization: Bearer eyJhbGciOiJFUzI1NiIs...
```

Response includes WebAuthn challenge and options for `navigator.credentials.create()`.

### Authenticate with passkey

```http
POST /auth/webauthn/authenticate/options
Content-Type: application/json

{
  "handle": "alice.bsky.social"
}
```

## Multi-factor authentication

Users can enable MFA for additional security:

### MFA methods

| Method         | Description                                          |
| -------------- | ---------------------------------------------------- |
| TOTP           | Time-based one-time passwords (Google Authenticator) |
| WebAuthn       | Hardware security keys or passkeys                   |
| Recovery codes | Backup codes for account recovery                    |

### MFA challenge flow

When MFA is enabled, authentication requires a second step:

```http
POST /oauth/token
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "code": "auth-code-here",
  "code_verifier": "pkce-verifier"
}
```

Response (MFA required):

```json
{
  "error": "mfa_required",
  "mfa_token": "temporary-mfa-token",
  "allowed_methods": ["totp", "webauthn"]
}
```

Complete MFA:

```http
POST /oauth/mfa/verify
Content-Type: application/json

{
  "mfa_token": "temporary-mfa-token",
  "method": "totp",
  "code": "123456"
}
```

## Security headers

API responses include security headers:

```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

## Error responses

### Authentication errors

| Error                | HTTP Status | Meaning                       |
| -------------------- | ----------- | ----------------------------- |
| `AuthRequired`       | 401         | No authentication provided    |
| `InvalidToken`       | 401         | Token is malformed or invalid |
| `ExpiredToken`       | 401         | Token has expired             |
| `RevokedToken`       | 401         | Token was revoked             |
| `InvalidCredentials` | 401         | Wrong username/password       |

### Authorization errors

| Error               | HTTP Status | Meaning                          |
| ------------------- | ----------- | -------------------------------- |
| `Forbidden`         | 403         | Authenticated but not authorized |
| `InsufficientScope` | 403         | Token lacks required scope       |
| `AccountSuspended`  | 403         | Account is suspended             |

## Best practices

### Token storage

| Platform     | Recommended storage                      |
| ------------ | ---------------------------------------- |
| Web browsers | HttpOnly cookies or secure localStorage  |
| Mobile apps  | Secure keychain/keystore                 |
| Server-side  | Environment variables or secrets manager |

### Security recommendations

1. **Always use HTTPS**: Never transmit tokens over unencrypted connections
2. **Validate token expiry**: Check `exp` claim before using tokens
3. **Rotate refresh tokens**: Use each refresh token only once
4. **Implement PKCE**: Always use PKCE for OAuth flows
5. **Store tokens securely**: Use platform-appropriate secure storage

## Client implementation

### TypeScript example

```typescript
import { ChiveAuth } from '@chive/auth-client';

const auth = new ChiveAuth({
  clientId: 'your-client-id',
  redirectUri: 'https://yourapp.com/callback',
});

// Start login flow
const loginUrl = await auth.getLoginUrl({
  handle: 'alice.bsky.social',
});

// Handle callback
const tokens = await auth.handleCallback(callbackUrl);

// Make authenticated request
const response = await fetch('/xrpc/pub.chive.actor.getMyProfile', {
  headers: {
    Authorization: `Bearer ${tokens.accessToken}`,
  },
});

// Refresh token
const newTokens = await auth.refreshToken(tokens.refreshToken);
```

## Next steps

- [API overview](./overview.md): General API information
- [XRPC endpoints](./xrpc-endpoints.md): Endpoint reference
- [REST endpoints](./rest-endpoints.md): HTTP API reference
