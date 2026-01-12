/**
 * Mock data generators for the new author model.
 *
 * @remarks
 * Provides factory functions for creating test data with the new unified
 * authors array, submittedBy, and paperDid fields.
 *
 * @packageDocumentation
 */

import type { DID } from '../../src/types/atproto.js';
import type {
  PreprintAuthor,
  PreprintAuthorAffiliation,
  PreprintAuthorContribution,
  ContributionDegree,
} from '../../src/types/models/author.js';

/**
 * Creates a mock author affiliation.
 *
 * @param overrides - Optional overrides for the affiliation
 * @returns Mock affiliation
 */
export function createMockAffiliation(
  overrides: Partial<PreprintAuthorAffiliation> = {}
): PreprintAuthorAffiliation {
  return {
    name: 'University of Example',
    rorId: 'https://ror.org/02mhbdp94',
    department: 'Computer Science',
    ...overrides,
  };
}

/**
 * Creates a mock author contribution.
 *
 * @param overrides - Optional overrides for the contribution
 * @returns Mock contribution
 */
export function createMockContribution(
  overrides: Partial<PreprintAuthorContribution> = {}
): PreprintAuthorContribution {
  return {
    typeUri: 'at://did:plc:chive-governance/pub.chive.contribution.type/conceptualization' as never,
    typeId: 'conceptualization',
    typeLabel: 'Conceptualization',
    degree: 'lead' as ContributionDegree,
    ...overrides,
  };
}

/**
 * Creates a mock preprint author.
 *
 * @param overrides - Optional overrides for the author
 * @returns Mock preprint author
 */
export function createMockAuthor(overrides: Partial<PreprintAuthor> = {}): PreprintAuthor {
  return {
    did: 'did:plc:test123' as DID,
    name: 'Jane Smith',
    orcid: '0000-0001-2345-6789',
    email: 'jane@example.edu',
    order: 1,
    affiliations: [createMockAffiliation()],
    contributions: [createMockContribution()],
    isCorrespondingAuthor: true,
    isHighlighted: false,
    ...overrides,
  };
}

/**
 * Creates a mock external author (no DID).
 *
 * @param overrides - Optional overrides for the author
 * @returns Mock external author without DID
 */
export function createMockExternalAuthor(overrides: Partial<PreprintAuthor> = {}): PreprintAuthor {
  return {
    did: undefined,
    name: 'John External',
    orcid: '0000-0002-3456-7890',
    email: 'john@external.edu',
    order: 2,
    affiliations: [createMockAffiliation({ name: 'External Institute', rorId: undefined })],
    contributions: [
      createMockContribution({
        typeId: 'investigation',
        typeLabel: 'Investigation',
        degree: 'equal',
      }),
    ],
    isCorrespondingAuthor: false,
    isHighlighted: true, // Co-first author
    ...overrides,
  };
}

/**
 * Creates an array of mock authors for testing.
 *
 * @param count - Number of authors to create (default: 2)
 * @returns Array of mock authors
 */
export function createMockAuthors(count = 2): readonly PreprintAuthor[] {
  const authors: PreprintAuthor[] = [];
  for (let i = 0; i < count; i++) {
    authors.push(
      createMockAuthor({
        did: `did:plc:author${i + 1}` as DID,
        name: `Author ${i + 1}`,
        order: i + 1,
        isCorrespondingAuthor: i === 0,
        isHighlighted: i < 2, // First two authors are highlighted
      })
    );
  }
  return authors;
}

/**
 * Creates mock preprint base data with new author model.
 *
 * @param overrides - Optional overrides for the preprint data
 * @returns Mock preprint data suitable for tests
 */
interface MockPreprintData {
  readonly uri: string;
  readonly cid: string;
  readonly authors: readonly PreprintAuthor[];
  readonly submittedBy: DID;
  readonly paperDid?: DID;
  readonly title: string;
  readonly abstract: string;
  readonly license: string;
}

export function createMockPreprintData(
  overrides: {
    uri?: string;
    cid?: string;
    authors?: readonly PreprintAuthor[];
    submittedBy?: DID;
    paperDid?: DID;
    title?: string;
    abstract?: string;
    license?: string;
  } = {}
): MockPreprintData {
  const defaultAuthors = createMockAuthors(2);
  const firstAuthorDid = defaultAuthors[0]?.did;
  const submittedBy = overrides.submittedBy ?? firstAuthorDid ?? ('did:plc:submitter' as DID);

  return {
    uri: overrides.uri ?? 'at://did:plc:test123/pub.chive.preprint.submission/xyz',
    cid: overrides.cid ?? 'bafyreiabc123',
    authors: overrides.authors ?? defaultAuthors,
    submittedBy,
    paperDid: overrides.paperDid,
    title: overrides.title ?? 'Test Preprint Title',
    abstract: overrides.abstract ?? 'This is a test abstract for the preprint.',
    license: overrides.license ?? 'CC-BY-4.0',
  };
}
