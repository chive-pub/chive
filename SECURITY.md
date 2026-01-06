# Security Policy

## Supported versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, report them via email to **admin@chive.pub**.

Include the following information in your report:

- Type of vulnerability (e.g., XSS, SQL injection, authentication bypass)
- Location of the affected code (file path, line number if known)
- Steps to reproduce the issue
- Proof of concept or exploit code (if available)
- Potential impact of the vulnerability

### What to expect

- **Acknowledgment**: We will acknowledge receipt within 48 hours
- **Initial assessment**: We will provide an initial assessment within 7 days
- **Resolution timeline**: We aim to resolve critical vulnerabilities within 30 days
- **Disclosure**: We will coordinate disclosure timing with you

### Recognition

We appreciate responsible disclosure. With your permission, we will acknowledge your contribution in our release notes.

## Security practices

### Architecture

Chive implements Zero Trust Architecture following NIST SP 800-207:

- Every request is authenticated and authorized
- Mutual TLS for inter-service communication
- DID-based cryptographic identity verification
- Audit logging with tamper detection

### Authentication

- OAuth 2.0 with PKCE for authorization flows
- DID-based authentication via AT Protocol
- No centralized password storage
- Scoped access tokens with automatic rotation

### Data handling

- User data lives in user-controlled PDSes, not on Chive servers
- Chive stores only indexes and cached data
- All repository records are cryptographically signed
- Content-addressed storage (CIDs) for blob integrity

### Infrastructure

- Container vulnerability scanning with Trivy
- Static analysis with Semgrep
- Dependency scanning for known vulnerabilities
- Plugin isolation using sandboxed execution environments

## Security-related configuration

### Environment variables

Never commit secrets to the repository. Use environment variables or a secrets manager:

```bash
# Example .env structure (do not commit actual values)
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=<generated-secret>
```

### Recommended practices for self-hosting

- Run behind a reverse proxy with TLS termination
- Enable rate limiting
- Use a secrets manager (HashiCorp Vault, AWS Secrets Manager)
- Keep dependencies updated
- Monitor logs for suspicious activity

## Contact

- Security issues: admin@chive.pub
- General questions: [GitHub Discussions](https://github.com/chive-pub/chive/discussions)
