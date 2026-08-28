import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { TEST_STACK_DEFAULTS, applyTestStackDefaults, testStackEnv } from '../../setup/test-env.js';

const KEYS = Object.keys(TEST_STACK_DEFAULTS);

describe('testStackEnv', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('supplies the Docker test stack database name', () => {
    // The production default is `chive`; the stack creates `chive_test`, and
    // the mismatch is what made the documented local flow fail.
    expect(testStackEnv().POSTGRES_DB).toBe('chive_test');
  });

  it('supplies every key it declares', () => {
    const env = testStackEnv();
    for (const key of KEYS) {
      expect(env[key], key).toBeDefined();
    }
  });

  it('yields to a value already in the environment', () => {
    process.env.POSTGRES_DB = 'somewhere_else';
    expect(testStackEnv().POSTGRES_DB).toBe('somewhere_else');
  });

  it('yields per variable, not all or nothing', () => {
    process.env.POSTGRES_PORT = '15432';
    const env = testStackEnv();
    expect(env.POSTGRES_PORT).toBe('15432');
    expect(env.POSTGRES_DB).toBe('chive_test');
  });

  it('does not mutate the environment', () => {
    testStackEnv();
    expect(process.env.POSTGRES_DB).toBeUndefined();
  });

  it('treats an empty string as set, since an operator may mean it', () => {
    process.env.POSTGRES_PASSWORD = '';
    expect(testStackEnv().POSTGRES_PASSWORD).toBe('');
  });
});

describe('applyTestStackDefaults', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('writes the defaults onto process.env', () => {
    applyTestStackDefaults();
    expect(process.env.POSTGRES_DB).toBe('chive_test');
    expect(process.env.NEO4J_URI).toBe('bolt://127.0.0.1:7687');
  });

  it('leaves an existing value alone', () => {
    process.env.POSTGRES_DB = 'chosen_by_ci';
    applyTestStackDefaults();
    expect(process.env.POSTGRES_DB).toBe('chosen_by_ci');
  });

  it('is idempotent', () => {
    applyTestStackDefaults();
    applyTestStackDefaults();
    expect(process.env.POSTGRES_DB).toBe('chive_test');
  });
});
