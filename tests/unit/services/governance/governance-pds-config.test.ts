import { describe, it, expect } from 'vitest';

import { readGovernancePDSCredentials } from '../../../../src/services/governance/governance-pds-config.js';

describe('readGovernancePDSCredentials', () => {
  it('refuses to report credentials without a password', () => {
    // The gate that matters. Everything else names the same account in every
    // deployment; only the password decides whether writing is possible.
    expect(readGovernancePDSCredentials({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it('treats an empty password as unset rather than as a credential', () => {
    expect(
      readGovernancePDSCredentials({ GRAPH_PDS_PASSWORD: '' } as NodeJS.ProcessEnv)
    ).toBeNull();
  });

  it('falls back to the account every deployment shares', () => {
    const credentials = readGovernancePDSCredentials({
      GRAPH_PDS_PASSWORD: 'secret',
    } as NodeJS.ProcessEnv);

    expect(credentials).toEqual({
      pdsUrl: 'https://governance.chive.pub',
      graphPdsDid: 'did:plc:5wzpn4a4nbqtz3q45hyud6hd',
      handle: 'chive-governance.governance.chive.pub',
      password: 'secret',
    });
  });

  it('lets a deployment point at another governance account', () => {
    const credentials = readGovernancePDSCredentials({
      GRAPH_PDS_PASSWORD: 'secret',
      GRAPH_PDS_URL: 'https://governance.staging.chive.pub',
      GRAPH_PDS_DID: 'did:plc:staginggovernance',
      GRAPH_PDS_HANDLE: 'staging.governance.chive.pub',
    } as NodeJS.ProcessEnv);

    expect(credentials?.pdsUrl).toBe('https://governance.staging.chive.pub');
    expect(credentials?.graphPdsDid).toBe('did:plc:staginggovernance');
    expect(credentials?.handle).toBe('staging.governance.chive.pub');
  });

  it('does not gate on a signing key, which nothing sets and nothing used', () => {
    // The old gate. Governance writing was dead in every checked-in config
    // because of it, and the writer ignored the key even when it was supplied.
    const credentials = readGovernancePDSCredentials({
      GRAPH_PDS_SIGNING_KEY: 'a-key',
    } as NodeJS.ProcessEnv);

    expect(credentials).toBeNull();
  });
});
