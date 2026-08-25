/**
 * Unit tests for platform administrator resolution.
 *
 * @remarks
 * The list was previously parsed in three places with two behaviours: the two
 * seeding paths fell back to a hardcoded DID when `ADMIN_DIDS` was unset, while
 * the governance role service did not. On a deployment that never sets the
 * variable — the documented normal case — a platform admin existed while the
 * governance layer recognised no administrator, leaving every privileged
 * governance endpoint unreachable with no way to bootstrap one.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_ADMIN_DID, getAdminDids } from '@/config/admin.js';

describe('getAdminDids', () => {
  const original = process.env.ADMIN_DIDS;

  afterEach(() => {
    if (original === undefined) delete process.env.ADMIN_DIDS;
    else process.env.ADMIN_DIDS = original;
  });

  it('should parse a comma-separated list', () => {
    expect(getAdminDids('did:plc:abc,did:plc:def')).toEqual(['did:plc:abc', 'did:plc:def']);
  });

  it('should trim surrounding whitespace', () => {
    expect(getAdminDids(' did:plc:abc , did:plc:def ')).toEqual(['did:plc:abc', 'did:plc:def']);
  });

  it('should fall back when unset', () => {
    expect(getAdminDids(undefined)).toEqual([DEFAULT_ADMIN_DID]);
  });

  // An undefined deploy variable interpolates to an empty string rather than
  // being absent, and treating that as "no administrators" is what silently
  // disabled governance.
  it.each([
    ['empty string', ''],
    ['whitespace only', '   '],
    ['commas only', ',,,'],
  ])('should fall back on %s', (_name, raw) => {
    expect(getAdminDids(raw)).toEqual([DEFAULT_ADMIN_DID]);
  });

  it('should read the environment variable when no argument is given', () => {
    process.env.ADMIN_DIDS = 'did:plc:fromenv';
    expect(getAdminDids()).toEqual(['did:plc:fromenv']);
  });

  it('should fall back when the environment variable is blank', () => {
    process.env.ADMIN_DIDS = '';
    expect(getAdminDids()).toEqual([DEFAULT_ADMIN_DID]);
  });
});
