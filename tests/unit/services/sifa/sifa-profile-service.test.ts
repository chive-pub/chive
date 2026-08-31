/**
 * Tests for reading sifa.id profiles.
 *
 * @remarks
 * The record shapes here are taken from the lexicons sifa.id publishes at
 * `did:plc:2f2ahswozqy4v5lvu676375y`, resolved through the `_lexicon.sifa.id`
 * DNS TXT record — not invented. `position` requires `title`, `startedAt` and
 * `createdAt`; `education` requires `institution` and `createdAt`; `self` is
 * keyed `literal:self`.
 *
 * @packageDocumentation
 */

import { describe, expect, it, vi } from 'vitest';

import {
  SifaProfileService,
  SIFA_COLLECTIONS,
} from '../../../../src/services/sifa/sifa-profile-service.js';
import type { DID } from '../../../../src/types/atproto.js';
import type { ILogger } from '../../../../src/types/interfaces/logger.interface.js';
import type { IRepository } from '../../../../src/types/interfaces/repository.interface.js';

const DID_UNDER_TEST = 'did:plc:aswhite123abc' as DID;

const logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as ILogger;

/**
 * Builds a repository whose `listRecords` serves the given values per collection.
 */
function repositoryWith(collections: Record<string, unknown[]>): IRepository {
  return {
    // eslint-disable-next-line @typescript-eslint/require-await
    listRecords: async function* (_did: DID, collection: string) {
      for (const value of collections[collection] ?? []) {
        yield { uri: 'at://x/y/z', cid: 'bafy', value, author: _did, indexedAt: '' };
      }
    },
  } as unknown as IRepository;
}

describe('SifaProfileService', () => {
  it('splits positions into current and previous by whether they ended', () => {
    const repository = repositoryWith({
      [SIFA_COLLECTIONS.position]: [
        {
          title: 'Associate Professor',
          company: 'University of Rochester',
          startedAt: '2021-07-01',
        },
        {
          title: 'Assistant Professor',
          company: 'University of Rochester',
          startedAt: '2016-07-01',
          endedAt: '2021-06-30',
        },
      ],
    });

    return new SifaProfileService(repository, logger).getProfile(DID_UNDER_TEST).then((profile) => {
      expect(profile.hasProfile).toBe(true);
      expect(profile.currentRoles.map((r) => r.title)).toEqual(['Associate Professor']);
      expect(profile.previousRoles.map((r) => r.title)).toEqual(['Assistant Professor']);
    });
  });

  it('puts the primary position first among current roles', async () => {
    const repository = repositoryWith({
      [SIFA_COLLECTIONS.position]: [
        { title: 'Visiting Fellow', company: 'Santa Fe Institute', startedAt: '2024-01-01' },
        {
          title: 'Associate Professor',
          company: 'University of Rochester',
          startedAt: '2021-07-01',
          isPrimary: true,
        },
      ],
    });

    const profile = await new SifaProfileService(repository, logger).getProfile(DID_UNDER_TEST);

    expect(profile.currentRoles[0]?.institution).toBe('University of Rochester');
  });

  it('reads education as a role, using the degree as the title', async () => {
    const repository = repositoryWith({
      [SIFA_COLLECTIONS.education]: [
        {
          institution: 'Johns Hopkins University',
          degree: 'PhD',
          fieldOfStudy: 'Cognitive Science',
          endedAt: '2016-05-01',
        },
      ],
    });

    const profile = await new SifaProfileService(repository, logger).getProfile(DID_UNDER_TEST);

    expect(profile.previousRoles).toHaveLength(1);
    expect(profile.previousRoles[0]).toMatchObject({
      institution: 'Johns Hopkins University',
      title: 'PhD, Cognitive Science',
      source: 'education',
    });
  });

  it('orders previous roles most recently ended first', async () => {
    const repository = repositoryWith({
      [SIFA_COLLECTIONS.position]: [
        { title: 'Postdoc', company: 'A', startedAt: '2016-01-01', endedAt: '2018-01-01' },
        { title: 'Lecturer', company: 'B', startedAt: '2018-01-01', endedAt: '2021-01-01' },
      ],
    });

    const profile = await new SifaProfileService(repository, logger).getProfile(DID_UNDER_TEST);

    expect(profile.previousRoles.map((r) => r.institution)).toEqual(['B', 'A']);
  });

  it('takes the display name from self, falling back to given and family names', async () => {
    const withDisplay = repositoryWith({
      [SIFA_COLLECTIONS.self]: [{ displayName: 'Aaron Steven White', headline: 'Semanticist' }],
    });
    const withNames = repositoryWith({
      [SIFA_COLLECTIONS.self]: [{ givenName: 'Aaron', familyName: 'White' }],
    });

    const service = new SifaProfileService(withDisplay, logger);
    expect((await service.getProfile(DID_UNDER_TEST)).displayName).toBe('Aaron Steven White');
    expect((await service.getProfile(DID_UNDER_TEST)).headline).toBe('Semanticist');

    expect(
      (await new SifaProfileService(withNames, logger).getProfile(DID_UNDER_TEST)).displayName
    ).toBe('Aaron White');
  });

  it('reports no profile for a researcher who has none', async () => {
    const profile = await new SifaProfileService(repositoryWith({}), logger).getProfile(
      DID_UNDER_TEST
    );

    expect(profile.hasProfile).toBe(false);
    expect(profile.currentRoles).toEqual([]);
    expect(profile.previousRoles).toEqual([]);
  });

  it('treats an unreachable repository as no profile rather than an error', async () => {
    const repository = {
      // eslint-disable-next-line require-yield, @typescript-eslint/require-await
      listRecords: async function* () {
        throw new Error('PDS unreachable');
      },
    } as unknown as IRepository;

    // An optional enrichment must not be able to fail the author profile.
    await expect(
      new SifaProfileService(repository, logger).getProfile(DID_UNDER_TEST)
    ).resolves.toMatchObject({ hasProfile: false });
  });

  it('skips positions with no employer, which the lexicon permits', async () => {
    const repository = repositoryWith({
      [SIFA_COLLECTIONS.position]: [
        { title: 'Independent researcher', startedAt: '2020-01-01' },
        { title: 'Professor', company: 'University of Rochester', startedAt: '2021-01-01' },
      ],
    });

    const profile = await new SifaProfileService(repository, logger).getProfile(DID_UNDER_TEST);

    // `company` is optional in id.sifa.profile.position; without it there is no
    // institution to show, and an affiliation with an empty name is worse than
    // none.
    expect(profile.currentRoles).toHaveLength(1);
    expect(profile.currentRoles[0]?.institution).toBe('University of Rochester');
  });

  it('collapses several roles at one institution into a single affiliation', () => {
    const service = new SifaProfileService(repositoryWith({}), logger);

    const affiliations = service.toAffiliations([
      { institution: 'University of Rochester', title: 'Associate Professor', source: 'position' },
      { institution: 'University of Rochester', title: 'Assistant Professor', source: 'position' },
      { institution: 'Santa Fe Institute', source: 'position' },
    ]);

    // A job title is not a sub-unit, so titles do not become children.
    expect(affiliations).toEqual([
      { name: 'University of Rochester' },
      { name: 'Santa Fe Institute' },
    ]);
  });
});
