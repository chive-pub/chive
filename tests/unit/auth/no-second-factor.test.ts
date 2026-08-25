/**
 * Unit tests asserting the second-factor layer is gone and stays gone.
 *
 * @remarks
 * Chive does not offer 2FA. A WebAuthn, TOTP and JWT-session layer existed in
 * `src/auth/` — roughly 2,300 lines plus a 688-line authentication service —
 * that nothing imported: no route, no handler, no service. Its credentials were
 * held in Redis under TTLs rather than in the tables built for them, so a Redis
 * flush would have locked users out of a factor they could never have enrolled
 * in, and none of it was rebuildable from the firehose.
 *
 * The risk in the backlog item was therefore theoretical in a specific way: no
 * user could enrol, because no endpoint existed to enrol through. It was
 * removed rather than wired up.
 *
 * This test exists so that dead auth code does not quietly return. Adding a
 * second factor is a legitimate decision someone may take later — it just has
 * to be a decision, taken against the current session model, rather than a file
 * reappearing under an old name.
 */

import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

const absent = (relative: string): boolean => !existsSync(join(process.cwd(), relative));

describe('the second-factor layer is absent', () => {
  it.each([
    ['WebAuthn service', 'src/auth/webauthn'],
    ['MFA service', 'src/auth/mfa'],
    ['JWT session layer', 'src/auth/session'],
    ['authentication service', 'src/auth/authentication-service.ts'],
  ])('%s is removed', (_label, path) => {
    expect(absent(path)).toBe(true);
  });

  it('the auth barrel no longer exports it', () => {
    const barrel = readFileSync(join(process.cwd(), 'src/auth/index.ts'), 'utf8');
    expect(barrel).not.toMatch(/from '\.\/(webauthn|mfa|session)\/index\.js'/);
    expect(barrel).not.toMatch(/authentication-service/);
  });

  it('the barrel says why, so the absence reads as a decision', () => {
    const barrel = readFileSync(join(process.cwd(), 'src/auth/index.ts'), 'utf8');
    expect(barrel).toMatch(/does not offer second-factor authentication/);
  });

  // What remains is the auth Chive actually uses.
  it.each([
    ['AT Protocol service auth', 'src/auth/service-auth'],
    ['role-based authorization', 'src/auth/authorization'],
    ['DID resolution', 'src/auth/did'],
    ['OAuth', 'src/auth/atproto-oauth'],
  ])('%s is retained', (_label, path) => {
    expect(absent(path)).toBe(false);
  });
});

describe('the 2FA tables are dropped', () => {
  const migration = readFileSync(
    join(process.cwd(), 'src/storage/postgresql/migrations/1741900000000_drop-2fa-tables.ts'),
    'utf8'
  );

  it.each([['webauthn_credentials'], ['mfa_enrollments']])('drops %s', (table) => {
    expect(migration).toMatch(new RegExp(`dropTable\\('${table}', \\{ ifExists: true \\}\\)`));
  });

  // These came from the same original migration but are not second-factor
  // state, and whether they are live is a separate question.
  it.each([['user_roles'], ['oauth_clients'], ['oauth_authorization_codes']])(
    'leaves %s alone',
    (table) => {
      expect(migration).not.toMatch(new RegExp(`dropTable\\('${table}'`));
    }
  );

  it('can be reverted', () => {
    expect(migration).toMatch(/export function down/);
    expect(migration).toMatch(/createTable\('webauthn_credentials'/);
    expect(migration).toMatch(/createTable\('mfa_enrollments'/);
  });
});
