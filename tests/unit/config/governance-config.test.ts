/**
 * Unit tests for governance configuration validation.
 *
 * @remarks
 * `GRAPH_PDS_DID` was set to `did:plc:chive-governance` in every environment
 * file — `.env.example`, the production example, and the Kubernetes configmap.
 * That is not a PLC identifier: they are `did:plc:` followed by 24
 * base32-sortable characters. The value overrode a correct code default, and
 * nothing rejected it, so the governance sync resolved a DID that does not
 * exist and imported an empty graph for as long as it was configured.
 *
 * A governance DID that cannot resolve is not a degraded mode, it is silence,
 * so the configuration now refuses the value rather than carrying it.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import { isPlcDid } from '@/types/atproto-validators.js';

const read = (relative: string): string => readFileSync(join(process.cwd(), relative), 'utf8');

const CONFIG_FILES = [
  '.env.example',
  'docker/.env.production.example',
  'k8s/base/appview/configmap.yaml',
];

describe('isPlcDid', () => {
  it('accepts a real PLC identifier', () => {
    expect(isPlcDid('did:plc:5wzpn4a4nbqtz3q45hyud6hd')).toBe(true);
  });

  it.each([
    ['did:plc:chive-governance', 'the value that was configured everywhere'],
    ['did:plc:short', 'too few characters'],
    ['did:plc:5wzpn4a4nbqtz3q45hyud6hdx', 'too many characters'],
    ['did:plc:5WZPN4A4NBQTZ3Q45HYUD6HD', 'uppercase is outside base32-sortable'],
    ['did:plc:5wzpn4a4nbqtz3q45hyud6h1', '1 is outside base32-sortable'],
    ['did:web:example.com', 'a different DID method'],
    ['', 'empty'],
  ])('rejects %s (%s)', (candidate) => {
    expect(isPlcDid(candidate)).toBe(false);
  });
});

describe('shipped governance configuration', () => {
  it.each(CONFIG_FILES)('%s does not carry the invalid governance DID', (file) => {
    expect(read(file)).not.toContain('did:plc:chive-governance');
  });

  it.each(CONFIG_FILES)('%s sets a well-formed PLC DID', (file) => {
    const match = /GRAPH_PDS_DID[=:]\s*"?(did:plc:[a-z2-7]+)"?/.exec(read(file));
    expect(match?.[1]).toBeDefined();
    expect(isPlcDid(match?.[1] ?? '')).toBe(true);
  });
});
