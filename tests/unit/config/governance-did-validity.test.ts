/**
 * Tests that no configuration carries an invalid governance DID.
 *
 * @remarks
 * `did:plc:chive-governance` reads like an identifier and is not one: a PLC DID
 * is `did:plc:` followed by 24 base32 characters. It resolved to nothing, so
 * the governance sync imported an empty graph.
 *
 * 0.10.0 corrected the environment files and made an ill-formed value fail at
 * startup. It missed `k8s/helm/chive/values.yaml`, which a Helm deployment
 * would still have carried — the startup check would then have refused to boot,
 * turning a silent empty graph into a crash loop. This sweeps every config
 * rather than the ones someone thought of.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** A PLC DID is `did:plc:` plus 24 base32 characters. */
const PLC_DID = /^did:plc:[a-z2-7]{24}$/;

function configFiles(): string[] {
  // Tracked files only; node_modules and build output are not configuration.
  const listed = execFileSync('git', ['ls-files'], { cwd: REPO_ROOT, encoding: 'utf8' });
  return listed
    .split('\n')
    .filter(Boolean)
    .filter((f) => /\.(ya?ml|env|example|json)$/.test(f) || f.includes('.env'))
    .filter((f) => !f.startsWith('web/tests/') && !f.startsWith('tests/'));
}

describe('governance PDS DID', () => {
  it('is a well-formed PLC identifier where it is set', () => {
    expect(PLC_DID.test('did:plc:5wzpn4a4nbqtz3q45hyud6hd')).toBe(true);
    expect(PLC_DID.test('did:plc:chive-governance')).toBe(false);
  });

  it('is not set to the invalid literal in any configuration', () => {
    // Comment lines are skipped on purpose: a config explaining why the value
    // used to be wrong is doing the reader a favour, and should not be the
    // thing that fails this test. Only a live setting counts.
    const offenders = configFiles().filter((file) => {
      const contents = readFileSync(join(REPO_ROOT, file), 'utf8');
      return contents
        .split('\n')
        .filter((line) => !/^\s*[#/]/.test(line))
        .some((line) => line.includes('did:plc:chive-governance'));
    });

    expect(offenders).toEqual([]);
  });
});
