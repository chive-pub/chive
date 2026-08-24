/**
 * Unit tests for release version resolution.
 *
 * @remarks
 * Tests validate the resolution order that keeps deployed containers from
 * reporting `0.0.0`: the `npm_package_version` environment variable first, then
 * the working directory's `package.json`, then the unknown-version fallback.
 */

import { readFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAppVersion, resetAppVersionCache, UNKNOWN_APP_VERSION } from '@/utils/app-version.js';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}));

const mockReadFileSync = vi.mocked(readFileSync);

describe('getAppVersion', () => {
  const originalEnvVersion = process.env.npm_package_version;

  beforeEach(() => {
    resetAppVersionCache();
    vi.clearAllMocks();
    delete process.env.npm_package_version;
  });

  afterEach(() => {
    if (originalEnvVersion === undefined) {
      delete process.env.npm_package_version;
    } else {
      process.env.npm_package_version = originalEnvVersion;
    }
    resetAppVersionCache();
  });

  it('should prefer npm_package_version when the process was launched via a package script', () => {
    process.env.npm_package_version = '1.2.3';

    expect(getAppVersion()).toBe('1.2.3');
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it('should read package.json when npm_package_version is unset', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ name: '@chive/monorepo', version: '0.7.0' }));

    expect(getAppVersion()).toBe('0.7.0');
  });

  it('should resolve package.json relative to the working directory', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ version: '0.7.0' }));

    getAppVersion();

    const [path] = mockReadFileSync.mock.calls[0] ?? [];
    expect(String(path)).toBe(`${process.cwd()}/package.json`);
  });

  it('should cache the result so package.json is read at most once', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ version: '0.7.0' }));

    expect(getAppVersion()).toBe('0.7.0');
    expect(getAppVersion()).toBe('0.7.0');
    expect(mockReadFileSync).toHaveBeenCalledTimes(1);
  });

  it('should fall back when package.json cannot be read', () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    expect(getAppVersion()).toBe(UNKNOWN_APP_VERSION);
  });

  it('should fall back when package.json is not valid JSON', () => {
    mockReadFileSync.mockReturnValue('not json at all');

    expect(getAppVersion()).toBe(UNKNOWN_APP_VERSION);
  });

  it('should fall back when package.json carries no version field', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ name: '@chive/monorepo' }));

    expect(getAppVersion()).toBe(UNKNOWN_APP_VERSION);
  });

  it('should fall back when version is not a non-empty string', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ version: '' }));

    expect(getAppVersion()).toBe(UNKNOWN_APP_VERSION);
  });
});
