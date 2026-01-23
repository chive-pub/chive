import type {
  Author,
  AuthorMetrics,
  AuthorProfile,
  AuthorProfileResponse,
  BlobRef,
  Endorsement,
  ListEndorsementsResponse,
  EndorsementSummary,
  ExternalId,
  FacetValue,
  SearchFacetValue,
  FieldDetail,
  FieldRef,
  FieldRelationship,
  FieldSummary,
  GetTrendingResponse,
  Eprint,
  EprintMetrics,
  EprintSource,
  EprintSummary,
  EprintTagsResponse,
  Review,
  ReviewAuthorRef,
  ListReviewsResponse,
  ReviewThread,
  RichAnnotationBody,
  TagAuthorRef,
  TagSuggestion,
  TagSummary,
  UnifiedTextSpanTarget,
  TrendingEprint,
  TrendingTagsResponse,
  UserTag,
  EprintMetricsView,
  EprintVersionView,
  ProposalChanges,
  EndorsementAuthorRef,
  EprintAuthorView,
} from '@/lib/api/schema';
import type {
  ContributionTypeProposal,
  CreditContributionType,
} from '@/lib/hooks/use-contribution-types';

// =============================================================================
// LOCAL TYPE DEFINITIONS
// =============================================================================

/**
 * FacetDimension - the PMEST facet dimensions.
 */
export type FacetDimension = 'personality' | 'matter' | 'energy' | 'space' | 'time';

/**
 * ExternalMapping for knowledge graph reconciliation.
 */
export interface ExternalMapping {
  system: string;
  identifier: string;
  uri: string;
  matchType?: string;
}

/**
 * OrganizationType for organization nodes.
 */
export type OrganizationType =
  | 'university'
  | 'research-lab'
  | 'company'
  | 'government'
  | 'nonprofit'
  | 'funding-body'
  | 'publisher';

/**
 * Organization for mock data.
 */
export interface Organization {
  id: string;
  uri: string;
  name: string;
  type: OrganizationType;
  rorId?: string;
  wikidataId?: string;
  country?: string;
  city?: string;
  website?: string;
  aliases?: string[];
  parentId?: string;
  status: 'proposed' | 'provisional' | 'established' | 'deprecated';
}

/**
 * ReconciliationSystem for external identifier systems.
 */
export type ReconciliationSystem = 'wikidata' | 'ror' | 'lcsh' | 'fast' | 'openalex';

/**
 * ReconcilableEntityType for entity types that can be reconciled.
 */
export type ReconcilableEntityType = 'field' | 'organization' | 'facet' | 'author';

/**
 * ReconciliationMatchType for match confidence.
 */
export type ReconciliationMatchType =
  | 'exact-match'
  | 'close-match'
  | 'related-match'
  | 'broader-match'
  | 'narrower-match';

/**
 * Reconciliation for external identifier mappings.
 */
export interface Reconciliation {
  id: string;
  uri: string;
  sourceType: ReconcilableEntityType;
  sourceUri: string;
  sourceLabel: string;
  targetSystem: ReconciliationSystem;
  targetId: string;
  targetUri: string;
  targetLabel: string;
  matchType: ReconciliationMatchType;
  method: string;
  confidence: number;
  validatedBy?: string;
  status: 'proposed' | 'provisional' | 'established' | 'deprecated';
  createdAt: string;
}

/**
 * AuthorAffiliation for eprint authors.
 */
export interface AuthorAffiliation {
  name: string;
  rorId?: string;
  department?: string;
}

/**
 * FacetedEprintSummary for browse results.
 */
export interface FacetedEprintSummary {
  uri: string;
  cid: string;
  title: string;
  abstract: string;
  authors: Array<{
    did?: string;
    name: string;
    handle?: string;
    avatarUrl?: string;
    order: number;
    affiliations: AuthorAffiliation[];
    contributions: Array<{
      typeUri: string;
      typeId: string;
      typeLabel: string;
      degree?: string;
    }>;
    isCorrespondingAuthor?: boolean;
    isHighlighted?: boolean;
  }>;
  submittedBy: string;
  fields?: Array<{ id: string; uri: string; label: string }>;
  keywords?: string[];
  license: string;
  createdAt: string;
  indexedAt: string;
  source: {
    pdsEndpoint: string;
    recordUrl?: string;
    blobUrl?: string;
    lastVerifiedAt?: string;
    stale?: boolean;
  };
}

/**
 * Creates a mock Author (AuthorSearchResult type, for author search results).
 * Uses required `did` since authors must be authenticated.
 */
export function createMockAuthor(overrides: Partial<Author> = {}): Author {
  return {
    did: 'did:plc:test123',
    handle: 'testuser.bsky.social',
    displayName: 'Test User',
    avatar: 'https://example.com/avatar.jpg',
    ...overrides,
  };
}

/**
 * Creates a mock TagAuthorRef (for UserTag.author field).
 *
 * @remarks
 * This is specifically for the `author` field on UserTag objects.
 * Uses the TagAuthorRef type from pub.chive.tag.listForEprint.
 */
export function createMockTagAuthor(overrides: Partial<TagAuthorRef> = {}): TagAuthorRef {
  return {
    did: 'did:plc:test123',
    handle: 'testuser.bsky.social',
    displayName: 'Test User',
    avatar: 'https://example.com/avatar.jpg',
    ...overrides,
  };
}

/**
 * Creates a mock ReviewAuthorRef (for review/comment authors).
 *
 * @remarks
 * This is specifically for the `author` field on Review objects.
 * The $type is automatically set to the correct review author ref type.
 */
export function createMockReviewAuthor(overrides: Partial<ReviewAuthorRef> = {}): ReviewAuthorRef {
  return {
    did: 'did:plc:test123',
    handle: 'testuser.bsky.social',
    displayName: 'Test User',
    avatar: 'https://example.com/avatar.jpg',
    ...overrides,
  };
}

/**
 * Creates a mock EprintAuthorView (for eprint contributor lists).
 * Uses optional `did` to support external collaborators.
 */
export function createMockEprintAuthor(
  overrides: Partial<EprintAuthorView> = {}
): EprintAuthorView {
  return {
    did: 'did:plc:test123',
    name: 'Test User',
    handle: 'testuser.bsky.social',
    avatar: 'https://example.com/avatar.jpg',
    orcid: undefined,
    order: 1,
    isCorrespondingAuthor: false,
    isHighlighted: false,
    contributions: [],
    affiliations: [],
    ...overrides,
  };
}

/**
 * Creates a mock BlobRef.
 */
export function createMockBlobRef(overrides: Partial<BlobRef> = {}): BlobRef {
  return {
    ref: {
      $link: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
    } as unknown as BlobRef['ref'],
    mimeType: 'application/pdf',
    size: 1024000,
    ...overrides,
  } as BlobRef;
}

/**
 * Creates a mock FieldRef.
 */
export function createMockFieldRef(overrides: Partial<FieldRef> = {}): FieldRef {
  return {
    id: 'computer-science',
    uri: 'at://did:plc:chive-governance/pub.chive.graph.field/computer-science',
    label: 'Computer Science',
    kind: 'object' as const,
    status: 'established' as const,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Creates a mock EprintSource.
 */
export function createMockEprintSource(overrides: Partial<EprintSource> = {}): EprintSource {
  return {
    pdsEndpoint: 'https://bsky.social',
    recordUrl: 'at://did:plc:test123/pub.chive.eprint.submission/abc123',
    lastVerifiedAt: '2024-01-15T10:35:00Z',
    stale: false,
    ...overrides,
  };
}

/**
 * Creates a mock EprintMetrics (from metrics/getMetrics).
 * Note: The actual API returns totalViews, views7d, etc., not simple 'views'.
 */
export function createMockEprintMetrics(overrides: Partial<EprintMetrics> = {}): EprintMetrics {
  return {
    totalViews: 150,
    uniqueViews: 100,
    totalDownloads: 42,
    views24h: 10,
    views7d: 50,
    views30d: 120,
    ...overrides,
  };
}

/**
 * Creates a mock EprintMetricsView (view-layer metrics).
 */
export function createMockEprintMetricsView(
  overrides: Partial<EprintMetricsView> = {}
): EprintMetricsView {
  return {
    views: 150,
    downloads: 42,
    endorsements: 5,
    ...overrides,
  };
}

/**
 * Creates a mock Eprint.
 */
export function createMockEprint(overrides: Partial<Eprint> = {}): Eprint {
  return {
    uri: 'at://did:plc:test123/pub.chive.eprint.submission/abc123',
    cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
    $type: 'pub.chive.eprint.submission',
    title: 'A Novel Approach to Machine Learning',
    abstract:
      'This paper presents a novel approach to machine learning that improves efficiency by 50%.',
    submittedBy: 'did:plc:test123',
    authors: [
      createMockEprintAuthor({
        order: 1,
        isCorrespondingAuthor: true,
      }) as unknown as Eprint['authors'][0],
      createMockEprintAuthor({
        did: 'did:plc:coauthor1',
        name: 'Co-Author One',
        order: 2,
        isHighlighted: true,
      }) as unknown as Eprint['authors'][0],
    ],
    document: createMockBlobRef(),
    supplementaryMaterials: [],
    fields: [createMockFieldRef() as Eprint['fields'] extends (infer T)[] ? T : never],
    keywords: ['machine learning', 'artificial intelligence', 'deep learning'],
    license: 'CC-BY-4.0',
    doi: '10.1234/chive.2024.001',
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-16T14:20:00Z',
    indexedAt: '2024-01-15T10:35:00Z',
    pdsUrl: 'https://bsky.social',
    metrics: createMockEprintMetricsView(),
    versions: [
      {
        version: 1,
        uri: 'at://did:plc:test123/pub.chive.eprint.version/v1',
        cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        createdAt: '2024-01-15T10:30:00Z',
      },
    ],
    ...overrides,
  };
}

/**
 * Creates a mock EprintSummary.
 *
 * @remarks
 * EprintSummary (from listByAuthor) uses lean data:
 * - `fields` is `FieldRef[]` with uri and label
 * - `authors` is `AuthorRef[]` with only did, handle, displayName
 */
export function createMockEprintSummary(overrides: Partial<EprintSummary> = {}): EprintSummary {
  return {
    uri: 'at://did:plc:test123/pub.chive.eprint.submission/abc123',
    cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
    title: 'A Novel Approach to Machine Learning',
    abstract:
      'This paper presents a novel approach to machine learning that improves efficiency by 50%.',
    authors: [{ did: 'did:plc:test123', handle: 'testuser.bsky.social', displayName: 'Test User' }],
    fields: [
      {
        uri: 'at://did:plc:chive-governance/pub.chive.graph.field/computer-science',
        label: 'Computer Science',
      },
    ],
    indexedAt: '2024-01-15T10:35:00Z',
    ...overrides,
  };
}

/**
 * Creates a mock TrendingEprint.
 */
export function createMockTrendingEprint(overrides: Partial<TrendingEprint> = {}): TrendingEprint {
  return {
    $type: 'pub.chive.metrics.getTrending#trendingEntry',
    uri: 'at://did:plc:test123/pub.chive.eprint.submission/abc123',
    cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
    title: 'A Novel Approach to Machine Learning',
    abstract:
      'This paper presents a novel approach to machine learning that improves efficiency by 50%.',
    authors: [
      {
        did: 'did:plc:test123',
        name: 'Test User',
        order: 1,
        affiliations: [],
        contributions: [],
      },
    ],
    submittedBy: 'did:plc:test123',
    license: 'CC-BY-4.0',
    createdAt: '2024-01-15T10:30:00Z',
    indexedAt: '2024-01-15T10:35:00Z',
    source: {
      pdsEndpoint: 'https://bsky.social',
      recordUrl: 'at://did:plc:test123/pub.chive.eprint.submission/abc123',
      lastVerifiedAt: '2024-01-15T10:35:00Z',
      stale: false,
    },
    viewsInWindow: 500,
    rank: 1,
    ...overrides,
  };
}

/**
 * Creates a mock FacetedEprintSummary for browseFaceted hits.
 */
export function createMockFacetedEprintSummary(
  overrides: Partial<FacetedEprintSummary> = {}
): FacetedEprintSummary {
  return {
    uri: 'at://did:plc:test123/pub.chive.eprint.submission/abc123',
    cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
    title: 'A Novel Approach to Machine Learning',
    abstract:
      'This paper presents a novel approach to machine learning that improves efficiency by 50%.',
    authors: [
      {
        did: 'did:plc:test123',
        name: 'Test User',
        handle: 'testuser.bsky.social',
        avatarUrl: 'https://example.com/avatar.jpg',
        order: 1,
        affiliations: [],
        contributions: [],
        isCorrespondingAuthor: true,
        isHighlighted: false,
      },
    ],
    submittedBy: 'did:plc:test123',
    fields: [
      { id: 'cs', uri: 'at://did:plc:chive/pub.chive.graph.field/cs', label: 'Computer Science' },
    ],
    keywords: ['machine learning', 'neural networks'],
    license: 'CC-BY-4.0',
    createdAt: '2024-01-15T10:30:00Z',
    indexedAt: '2024-01-15T10:35:00Z',
    source: {
      pdsEndpoint: 'https://bsky.social',
      recordUrl:
        'https://bsky.social/xrpc/com.atproto.sync.getRecord?did=did:plc:test123&collection=pub.chive.eprint.submission&rkey=abc123',
      blobUrl: 'https://bsky.social/xrpc/com.atproto.sync.getBlob?did=did:plc:test123&cid=...',
      lastVerifiedAt: '2024-01-15T10:35:00Z',
      stale: false,
    },
    ...overrides,
  };
}

/**
 * Creates a mock SearchResultsResponse.
 * Note: SearchFacetValue uses 'uri' not 'value', different from browseFaceted FacetValue.
 */
export function createMockSearchResults(
  overrides: Partial<{
    hits: FacetedEprintSummary[];
    facets: Array<{
      slug: string;
      label: string;
      description?: string;
      values: SearchFacetValue[];
    }>;
    cursor?: string;
    hasMore: boolean;
    total: number;
  }> = {}
): {
  hits: FacetedEprintSummary[];
  facets: Array<{ slug: string; label: string; description?: string; values: SearchFacetValue[] }>;
  cursor?: string;
  hasMore: boolean;
  total: number;
} {
  return {
    hits: [
      createMockFacetedEprintSummary({
        uri: 'at://did:plc:test1/pub.chive.eprint.submission/1',
      }),
      createMockFacetedEprintSummary({
        uri: 'at://did:plc:test2/pub.chive.eprint.submission/2',
      }),
      createMockFacetedEprintSummary({
        uri: 'at://did:plc:test3/pub.chive.eprint.submission/3',
      }),
    ],
    cursor: 'cursor123',
    hasMore: true,
    total: 42,
    facets: [
      {
        slug: 'personality',
        label: 'Personality',
        values: [
          {
            uri: 'at://gov/pub.chive.graph.node/computer-science',
            slug: 'computer-science',
            label: 'Computer Science',
            count: 15,
          },
          {
            uri: 'at://gov/pub.chive.graph.node/physics',
            slug: 'physics',
            label: 'Physics',
            count: 10,
          },
        ],
      },
    ],
    ...overrides,
  };
}

/**
 * Creates a mock GetTrendingResponse.
 */
export function createMockTrendingResponse(
  overrides: Partial<GetTrendingResponse> = {}
): GetTrendingResponse {
  return {
    trending: [
      createMockTrendingEprint({ rank: 1, viewsInWindow: 500 }),
      createMockTrendingEprint({
        rank: 2,
        viewsInWindow: 350,
        uri: 'at://did:plc:test2/pub.chive.eprint.submission/2',
      }),
      createMockTrendingEprint({
        rank: 3,
        viewsInWindow: 200,
        uri: 'at://did:plc:test3/pub.chive.eprint.submission/3',
      }),
    ],
    window: '7d',
    cursor: undefined,
    hasMore: false,
    ...overrides,
  };
}

/**
 * Creates a list of mock eprint summaries.
 */
export function createMockEprintList(count: number = 5): EprintSummary[] {
  return Array.from({ length: count }, (_, i) =>
    createMockEprintSummary({
      uri: `at://did:plc:test${i}/pub.chive.eprint.submission/${i}`,
      title: `Test Eprint ${i + 1}`,
    })
  );
}

// ============================================================================
// Author Profile Mocks
// ============================================================================

/**
 * Creates a mock AuthorProfile.
 */
export function createMockAuthorProfile(overrides: Partial<AuthorProfile> = {}): AuthorProfile {
  return {
    did: 'did:plc:author123',
    handle: 'researcher.bsky.social',
    displayName: 'Dr. Jane Researcher',
    avatar: 'https://example.com/avatar.jpg',
    bio: 'Research scientist focusing on machine learning and artificial intelligence.',
    affiliation: 'University of Science',
    orcid: '0000-0002-1825-0097',
    website: 'https://jane-researcher.example.com',
    pdsEndpoint: 'https://bsky.social',
    ...overrides,
  };
}

/**
 * Creates a mock AuthorMetrics.
 */
export function createMockAuthorMetrics(overrides: Partial<AuthorMetrics> = {}): AuthorMetrics {
  return {
    totalEprints: 15,
    totalViews: 5000,
    totalDownloads: 1200,
    totalEndorsements: 42,
    ...overrides,
  };
}

/**
 * Creates a mock AuthorProfileResponse.
 */
export function createMockAuthorProfileResponse(
  overrides: Partial<AuthorProfileResponse> = {}
): AuthorProfileResponse {
  return {
    profile: createMockAuthorProfile(overrides.profile),
    metrics: createMockAuthorMetrics(overrides.metrics),
    ...overrides,
  };
}

// ============================================================================
// Field Mocks
// ============================================================================

/**
 * Creates a mock FieldSummary.
 */
export function createMockFieldSummary(overrides: Partial<FieldSummary> = {}): FieldSummary {
  return {
    id: 'computer-science',
    uri: 'at://did:plc:governance/pub.chive.graph.field/computer-science',
    label: 'Computer Science',
    description: 'The study of computation and information processing.',
    eprintCount: 250,
    childCount: 12,
    status: 'established',
    ...overrides,
  };
}

/**
 * Creates a mock ExternalId.
 */
export function createMockExternalId(overrides: Partial<ExternalId> = {}): ExternalId {
  return {
    system: 'wikidata',
    identifier: 'Q21198',
    uri: 'https://www.wikidata.org/wiki/Q21198',
    ...overrides,
  };
}

/**
 * Creates a mock FieldRelationship.
 */
export function createMockFieldRelationship(
  overrides: Partial<FieldRelationship> = {}
): FieldRelationship {
  return {
    type: 'broader',
    targetId: 'science',
    targetLabel: 'Science',
    strength: 0.9,
    ...overrides,
  };
}

/**
 * Creates a mock FieldDetail.
 */
export function createMockFieldDetail(overrides: Partial<FieldDetail> = {}): FieldDetail {
  return {
    id: 'machine-learning',
    uri: 'at://did:plc:chive-governance/pub.chive.graph.field/machine-learning',
    label: 'Machine Learning',
    description: 'A subset of artificial intelligence that enables systems to learn from data.',
    status: 'established',
    eprintCount: 150,
    externalIds: [
      createMockExternalId({
        system: 'wikidata',
        identifier: 'Q2539',
        uri: 'https://www.wikidata.org/wiki/Q2539',
      }),
      createMockExternalId({
        system: 'lcsh',
        identifier: 'sh85079324',
        uri: 'https://id.loc.gov/authorities/subjects/sh85079324',
      }),
    ],
    relationships: [
      createMockFieldRelationship({
        type: 'broader',
        targetId: 'artificial-intelligence',
        targetLabel: 'Artificial Intelligence',
      }),
      createMockFieldRelationship({
        type: 'related',
        targetId: 'data-science',
        targetLabel: 'Data Science',
        strength: 0.8,
      }),
    ],
    children: [
      {
        id: 'deep-learning',
        uri: 'at://did:plc:chive-governance/pub.chive.graph.node/deep-learning',
        label: 'Deep Learning',
      },
      {
        id: 'reinforcement-learning',
        uri: 'at://did:plc:chive-governance/pub.chive.graph.node/reinforcement-learning',
        label: 'Reinforcement Learning',
      },
    ],
    ancestors: [
      {
        id: 'computer-science',
        uri: 'at://did:plc:chive-governance/pub.chive.graph.node/computer-science',
        label: 'Computer Science',
      },
      {
        id: 'artificial-intelligence',
        uri: 'at://did:plc:chive-governance/pub.chive.graph.node/artificial-intelligence',
        label: 'Artificial Intelligence',
      },
    ],
    ...overrides,
  };
}

/**
 * Creates a list of mock FieldSummary objects.
 */
export function createMockFieldList(count: number = 3): FieldSummary[] {
  const fields = [
    { id: 'physics', label: 'Physics', eprintCount: 300 },
    { id: 'computer-science', label: 'Computer Science', eprintCount: 250 },
    { id: 'biology', label: 'Biology', eprintCount: 200 },
  ];
  return fields.slice(0, count).map((f) => createMockFieldSummary(f));
}

// ============================================================================
// Faceted Search Mocks
// ============================================================================

/**
 * Creates a mock SearchFacetValue (from searchSubmissions endpoint).
 * Note: SearchFacetValue uses 'uri' and 'slug', not 'value'.
 */
export function createMockSearchFacetValue(
  overrides: Partial<SearchFacetValue> = {}
): SearchFacetValue {
  return {
    uri: 'at://gov/pub.chive.graph.node/computer-science',
    slug: 'computer-science',
    count: 42,
    label: 'Computer Science',
    ...overrides,
  };
}

/**
 * Creates a mock FacetValue (from browseFaceted endpoint).
 * Note: FacetValue uses 'value', different from SearchFacetValue which uses 'uri'.
 */
export function createMockBrowseFacetValue(overrides: Partial<FacetValue> = {}): FacetValue {
  return {
    value: 'computer-science',
    count: 42,
    label: 'Computer Science',
    ...overrides,
  };
}

/**
 * Creates a mock FacetedSearchResponse.
 * Note: This uses the hook's FacetedSearchResponse format with facets as an array.
 */
export function createMockFacetedSearchResponse(
  overrides: Partial<{
    hits: FacetedEprintSummary[];
    facets: Array<{
      slug: string;
      label: string;
      description?: string;
      values: SearchFacetValue[];
    }>;
    cursor?: string;
    hasMore: boolean;
    total: number;
  }> = {}
): {
  hits: FacetedEprintSummary[];
  facets: Array<{ slug: string; label: string; description?: string; values: SearchFacetValue[] }>;
  cursor?: string;
  hasMore: boolean;
  total: number;
} {
  return {
    hits: [
      createMockFacetedEprintSummary({
        uri: 'at://did:plc:test1/pub.chive.eprint.submission/1',
      }),
      createMockFacetedEprintSummary({
        uri: 'at://did:plc:test2/pub.chive.eprint.submission/2',
      }),
    ],
    cursor: 'cursor-456',
    hasMore: true,
    total: 100,
    facets: [
      {
        slug: 'personality',
        label: 'Personality',
        values: [
          createMockSearchFacetValue({
            uri: 'at://gov/pub.chive.graph.node/research',
            slug: 'research',
            count: 50,
            label: 'Research',
          }),
          createMockSearchFacetValue({
            uri: 'at://gov/pub.chive.graph.node/review',
            slug: 'review',
            count: 30,
            label: 'Review',
          }),
        ],
      },
      {
        slug: 'matter',
        label: 'Matter',
        values: [
          createMockSearchFacetValue({
            uri: 'at://gov/pub.chive.graph.node/physics',
            slug: 'physics',
            count: 40,
            label: 'Physics',
          }),
          createMockSearchFacetValue({
            uri: 'at://gov/pub.chive.graph.node/computer-science',
            slug: 'computer-science',
            count: 35,
            label: 'Computer Science',
          }),
        ],
      },
      {
        slug: 'energy',
        label: 'Energy',
        values: [
          createMockSearchFacetValue({
            uri: 'at://gov/pub.chive.graph.node/classification',
            slug: 'classification',
            count: 25,
            label: 'Classification',
          }),
        ],
      },
      {
        slug: 'space',
        label: 'Space',
        values: [
          createMockSearchFacetValue({
            uri: 'at://gov/pub.chive.graph.node/north-america',
            slug: 'north-america',
            count: 45,
            label: 'North America',
          }),
        ],
      },
      {
        slug: 'time',
        label: 'Time',
        values: [
          createMockSearchFacetValue({
            uri: 'at://gov/pub.chive.graph.node/2024',
            slug: '2024',
            count: 60,
            label: '2024',
          }),
        ],
      },
    ],
    ...overrides,
  };
}

// ============================================================================
// Review Mocks
// ============================================================================

/**
 * Creates a mock TextSpanTarget.
 */
export function createMockTextSpanTarget(
  overrides: Partial<UnifiedTextSpanTarget> = {}
): UnifiedTextSpanTarget {
  return {
    source: 'at://did:plc:author/pub.chive.eprint.submission/abc123',
    selector: {
      type: 'TextQuoteSelector',
      exact: 'neural network architecture',
      prefix: 'We propose a novel ',
      suffix: ' that achieves state-of-the-art',
    },
    refinedBy: {
      type: 'TextPositionSelector',
      start: 1250,
      end: 1275,
      pageNumber: 3,
    },
    ...overrides,
  };
}

/**
 * Creates a mock RichAnnotationBody (FOVEA-style, frontend-only).
 */
export function createMockRichAnnotationBody(
  overrides: Partial<RichAnnotationBody> = {}
): RichAnnotationBody {
  const base = {
    type: 'RichText' as const,
    items: [
      { type: 'text' as const, content: 'This is an excellent methodology. See also ' },
      { type: 'wikidataRef' as const, qid: 'Q2539', label: 'Machine Learning' },
      { type: 'text' as const, content: ' for background.' },
    ],
    format: 'application/x-chive-gloss+json',
  };
  return { ...base, ...overrides };
}

/**
 * Creates a mock Review.
 * Note: Review is a union of ReviewView types with different $type discriminators.
 */
export function createMockReview(overrides: Partial<Review> = {}): Review {
  return {
    uri: 'at://did:plc:reviewer/pub.chive.review.comment/review123',
    cid: 'bafyreireview123',
    eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/abc123',
    author: createMockReviewAuthor({ did: 'did:plc:reviewer', displayName: 'Dr. Reviewer' }),
    content: 'This is an excellent methodology. See also Machine Learning for background.',
    body: {
      text: 'This is an excellent methodology. See also Machine Learning for background.',
      facets: [
        {
          index: { byteStart: 43, byteEnd: 59 }, // "Machine Learning"
          features: [
            {
              $type: 'app.bsky.richtext.facet#link' as const,
              uri: 'https://www.wikidata.org/wiki/Q2539',
            } as const,
          ],
        },
      ],
    },
    motivation: 'commenting',
    replyCount: 0,
    createdAt: '2024-06-15T10:30:00Z',
    indexedAt: '2024-06-15T10:35:00Z',
    ...overrides,
  } as Review;
}

/**
 * Creates a mock Review with target (inline annotation).
 * Note: TextSpanTarget type differs between listForEprint and listForAuthor.
 */
export function createMockInlineReview(overrides: Partial<Review> = {}): Review {
  const base = createMockReview(overrides);
  return {
    ...base,
    // Use provided target from overrides, or fall back to default
    target: overrides.target ?? createMockTextSpanTarget(),
  } as Review;
}

/**
 * Creates a mock ReviewThread.
 * Note: ReviewThread.parent and replies are ReviewView from getThread endpoint.
 */
export function createMockReviewThread(overrides: Partial<ReviewThread> = {}): ReviewThread {
  const parent = createMockReview();
  return {
    parent: parent as ReviewThread['parent'],
    replies: [
      createMockReview({
        uri: 'at://did:plc:replier1/pub.chive.review.comment/reply1',
        author: createMockReviewAuthor({ did: 'did:plc:replier1', displayName: 'Replier One' }),
        content: 'I agree with this assessment.',
        parentReviewUri: parent.uri,
      }) as ReviewThread['replies'][0],
      createMockReview({
        uri: 'at://did:plc:replier2/pub.chive.review.comment/reply2',
        author: createMockReviewAuthor({ did: 'did:plc:replier2', displayName: 'Replier Two' }),
        content: 'Could you elaborate on the methodology section?',
        motivation: 'questioning',
        parentReviewUri: parent.uri,
      }) as ReviewThread['replies'][0],
    ],
    totalReplies: 2,
    ...overrides,
  };
}

/**
 * Creates a mock ReviewsResponse.
 * Note: ListReviewsResponse.reviews is ReviewView[] from listForEprint endpoint.
 */
export function createMockReviewsResponse(
  overrides: Partial<ListReviewsResponse> = {}
): ListReviewsResponse {
  return {
    reviews: [
      createMockReview({
        uri: 'at://did:plc:r1/pub.chive.review.comment/1',
      }) as ListReviewsResponse['reviews'][0],
      createMockReview({
        uri: 'at://did:plc:r2/pub.chive.review.comment/2',
        motivation: 'questioning',
        content: 'How does this compare to previous approaches?',
      }) as ListReviewsResponse['reviews'][0],
      createMockInlineReview({
        uri: 'at://did:plc:r3/pub.chive.review.comment/3',
      }) as ListReviewsResponse['reviews'][0],
    ],
    cursor: 'review-cursor-123',
    hasMore: true,
    total: 15,
    ...overrides,
  };
}

// ============================================================================
// Endorsement Mocks
// ============================================================================

/**
 * Creates a mock EndorsementAuthorRef (for endorser field).
 */
export function createMockEndorsementAuthor(
  overrides: Partial<EndorsementAuthorRef> = {}
): EndorsementAuthorRef {
  return {
    did: 'did:plc:endorser',
    handle: 'endorser.bsky.social',
    displayName: 'Prof. Endorser',
    avatar: 'https://example.com/avatar.jpg',
    ...overrides,
  };
}

/**
 * Creates a mock Endorsement.
 * Note: Endorsement is actually EndorsementView from listForEprint.
 */
export function createMockEndorsement(
  overrides: Partial<Endorsement> & { endorserDid?: string } = {}
): Endorsement {
  const { endorserDid, ...rest } = overrides;
  return {
    uri: 'at://did:plc:endorser/pub.chive.review.endorsement/endorsement123',
    cid: 'bafyreiendorsement123',
    eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/abc123',
    endorser: createMockEndorsementAuthor({
      did: endorserDid ?? 'did:plc:endorser',
      displayName: 'Prof. Endorser',
    }),
    contributions: ['methodological'],
    comment: 'The experimental methodology is sound and well-documented.',
    createdAt: '2024-06-20T14:00:00Z',
    ...rest,
  };
}

/**
 * Creates a mock EndorsementSummary.
 *
 * @remarks
 * The `byType` property uses a type assertion because the generated
 * `EndorsementCountByType` is an open object that doesn't explicitly
 * define contribution type keys.
 */
export function createMockEndorsementSummary(
  overrides: Partial<EndorsementSummary> = {}
): EndorsementSummary {
  return {
    byType: {
      methodological: 5,
      empirical: 3,
      analytical: 2,
    } as EndorsementSummary['byType'],
    total: 10,
    endorserCount: 8,
    ...overrides,
  };
}

/**
 * Creates a mock EndorsementsResponse.
 */
export function createMockEndorsementsResponse(
  overrides: Partial<ListEndorsementsResponse> = {}
): ListEndorsementsResponse {
  return {
    endorsements: [
      createMockEndorsement({ contributions: ['methodological', 'analytical'] }),
      createMockEndorsement({
        uri: 'at://did:plc:e2/pub.chive.review.endorsement/2',
        contributions: ['empirical', 'data'],
        comment: 'The findings are significant and well-supported.',
      }),
      createMockEndorsement({
        uri: 'at://did:plc:e3/pub.chive.review.endorsement/3',
        contributions: ['theoretical', 'synthesis'],
        comment: 'Excellent theoretical framework.',
      }),
    ],
    summary: createMockEndorsementSummary(),
    cursor: undefined,
    hasMore: false,
    ...overrides,
  };
}

// ============================================================================
// Tag Mocks
// ============================================================================

/**
 * Creates a mock UserTag.
 */
export function createMockUserTag(overrides: Partial<UserTag> = {}): UserTag {
  return {
    uri: 'at://did:plc:tagger/pub.chive.eprint.userTag/tag123',
    cid: 'bafyreib4pff766vhpbxj6p7oysgqjaj4',
    eprintUri: 'at://did:plc:author/pub.chive.eprint.submission/abc123',
    author: createMockTagAuthor({ did: 'did:plc:tagger', displayName: 'Tagger User' }),
    normalizedForm: 'machine-learning',
    displayForm: 'Machine Learning',
    createdAt: '2024-06-10T09:00:00Z',
    ...overrides,
  };
}

/**
 * Creates a mock TagSummary.
 */
export function createMockTagSummary(overrides: Partial<TagSummary> = {}): TagSummary {
  return {
    normalizedForm: 'machine-learning',
    displayForms: ['Machine Learning', 'machine learning'],
    usageCount: 150,
    qualityScore: 0.85,
    isPromoted: false,
    ...overrides,
  };
}

/**
 * Creates a mock TagSuggestion.
 */
export function createMockTagSuggestion(overrides: Partial<TagSuggestion> = {}): TagSuggestion {
  return {
    normalizedForm: 'deep-learning',
    displayForm: 'Deep Learning',
    confidence: 0.9,
    source: 'cooccurrence',
    ...overrides,
  };
}

/**
 * Creates a mock EprintTagsResponse.
 */
export function createMockEprintTagsResponse(
  overrides: Partial<EprintTagsResponse> = {}
): EprintTagsResponse {
  return {
    tags: [
      createMockUserTag({ normalizedForm: 'machine-learning', displayForm: 'Machine Learning' }),
      createMockUserTag({
        uri: 'at://did:plc:t2/pub.chive.eprint.userTag/2',
        normalizedForm: 'neural-networks',
        displayForm: 'Neural Networks',
      }),
      createMockUserTag({
        uri: 'at://did:plc:t3/pub.chive.eprint.userTag/3',
        normalizedForm: 'deep-learning',
        displayForm: 'Deep Learning',
      }),
    ],
    suggestions: [
      createMockTagSuggestion({
        normalizedForm: 'computer-vision',
        displayForm: 'Computer Vision',
      }),
      createMockTagSuggestion({
        normalizedForm: 'transfer-learning',
        displayForm: 'Transfer Learning',
        source: 'cooccurrence',
      }),
    ],
    ...overrides,
  };
}

/**
 * Creates a mock TrendingTagsResponse.
 * Note: TrendingTagsResponse.tags expects TagSummary from getTrending endpoint.
 */
export function createMockTrendingTagsResponse(
  overrides: Partial<TrendingTagsResponse> = {}
): TrendingTagsResponse {
  return {
    tags: [
      createMockTagSummary({
        normalizedForm: 'large-language-models',
        displayForms: ['Large Language Models'],
        usageCount: 500,
      }) as TrendingTagsResponse['tags'][0],
      createMockTagSummary({
        normalizedForm: 'generative-ai',
        displayForms: ['Generative AI'],
        usageCount: 350,
      }) as TrendingTagsResponse['tags'][0],
      createMockTagSummary({
        normalizedForm: 'transformer-architecture',
        displayForms: ['Transformer Architecture'],
        usageCount: 200,
      }) as TrendingTagsResponse['tags'][0],
    ],
    timeWindow: 'week',
    ...overrides,
  };
}

// ============================================================================
// Contribution Type Mocks (Author Model Redesign)
// ============================================================================

/**
 * Creates a mock AuthorAffiliation.
 */
export function createMockAuthorAffiliation(
  overrides: Partial<AuthorAffiliation> = {}
): AuthorAffiliation {
  return {
    name: 'University of Example',
    rorId: 'https://ror.org/02mhbdp94',
    department: 'Computer Science',
    ...overrides,
  };
}

/**
 * Creates a mock AuthorContribution.
 * Note: AuthorContribution is the Main type from authorContribution.ts,
 * which is the full author entry with contributions array inside.
 * For individual contribution items, use the Contribution interface.
 */
export function createMockAuthorContribution(
  overrides: Partial<
    EprintAuthorView['contributions'] extends (infer T)[] | undefined ? T : never
  > = {}
): EprintAuthorView['contributions'] extends (infer T)[] | undefined ? T : never {
  return {
    typeUri: 'at://did:plc:chive-governance/pub.chive.graph.concept/conceptualization',
    degreeSlug: 'lead',
    ...overrides,
  } as EprintAuthorView['contributions'] extends (infer T)[] | undefined ? T : never;
}

/**
 * Creates a mock EprintAuthorView with DID (authenticated ATProto user).
 *
 * @remarks
 * Use this for authors who have an ATProto account.
 */
export function createMockEprintAuthorWithDid(
  overrides: Partial<EprintAuthorView> = {}
): EprintAuthorView {
  return {
    did: 'did:plc:test123',
    name: 'Dr. Jane Smith',
    handle: 'janesmith.bsky.social',
    avatar: 'https://example.com/avatar.jpg',
    orcid: '0000-0001-2345-6789',
    order: 1,
    affiliations: [createMockAuthorAffiliation()],
    contributions: [
      createMockAuthorContribution(),
      createMockAuthorContribution({
        typeUri: 'at://did:plc:chive-governance/pub.chive.graph.concept/writing-original-draft',
        degreeSlug: 'lead',
      }),
    ],
    isCorrespondingAuthor: true,
    isHighlighted: false,
    ...overrides,
  };
}

/**
 * Creates a mock external author (collaborator without ATProto account).
 *
 * @remarks
 * Use this for external collaborators who don't have ATProto DIDs.
 * They are identified by name, ORCID, or email instead.
 */
export function createMockExternalAuthor(
  overrides: Partial<EprintAuthorView> = {}
): EprintAuthorView {
  return {
    did: undefined,
    name: 'John External',
    handle: undefined,
    avatar: undefined,
    orcid: '0000-0002-3456-7890',
    order: 2,
    affiliations: [
      createMockAuthorAffiliation({
        name: 'External Institute',
        rorId: undefined,
        department: undefined,
      }),
    ],
    contributions: [
      createMockAuthorContribution({
        typeUri: 'at://did:plc:chive-governance/pub.chive.graph.concept/investigation',
        degreeSlug: 'equal',
      }),
    ],
    isCorrespondingAuthor: false,
    isHighlighted: true, // Co-first author
    ...overrides,
  };
}

/**
 * Creates a mock CreditContributionType (CRediT-based).
 */
export function createMockContributionType(
  overrides: Partial<CreditContributionType> = {}
): CreditContributionType {
  return {
    uri: 'at://did:plc:chive-governance/pub.chive.graph.concept/conceptualization',
    id: 'conceptualization',
    label: 'Conceptualization',
    description: 'Ideas; formulation or evolution of overarching research goals and aims',
    externalMappings: [
      {
        system: 'credit',
        identifier: 'conceptualization',
        uri: 'https://credit.niso.org/contributor-roles/conceptualization/',
        matchType: 'exact-match',
      },
    ],
    status: 'established',
    proposalUri: undefined,
    createdAt: '2025-01-08T00:00:00Z',
    ...overrides,
  };
}

/**
 * Creates a mock ContributionTypeProposal.
 */
export function createMockContributionTypeProposal(
  overrides: Partial<ContributionTypeProposal> = {}
): ContributionTypeProposal {
  return {
    uri: 'at://did:plc:user123/pub.chive.graph.conceptProposal/abc',
    proposerDid: 'did:plc:user123',
    proposerName: 'Test User',
    proposalType: 'create',
    proposedId: 'clinical-trials',
    proposedLabel: 'Clinical Trials',
    proposedDescription: 'Conducting clinical trials for medical research',
    externalMappings: [],
    rationale: 'Needed for medical research papers where clinical trials are a key contribution',
    status: 'pending',
    votes: {
      approve: 2,
      reject: 0,
      abstain: 0,
      weightedApprove: 2,
      weightedReject: 0,
      total: 2,
    },
    createdAt: '2025-01-08T00:00:00Z',
    ...overrides,
  };
}

/**
 * Creates a mock traditional Eprint (paper lives in submitter's PDS).
 *
 * @remarks
 * In the traditional model, the paper record lives in the submitter's PDS.
 * The `paperDid` field is undefined, and the record URI uses the submitter's DID.
 */
export function createMockTraditionalEprint(overrides: Partial<Eprint> = {}): Eprint {
  return {
    uri: 'at://did:plc:user123/pub.chive.eprint.submission/xyz',
    cid: 'bafyreib2a3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7',
    $type: 'pub.chive.eprint.submission',
    title: 'A Traditional Eprint',
    abstract:
      'This eprint uses the traditional submission model where the paper lives in the submitter PDS.',
    submittedBy: 'did:plc:user123',
    paperDid: undefined, // Traditional model - no paper DID
    authors: [
      createMockEprintAuthorWithDid() as unknown as Eprint['authors'][0],
      createMockExternalAuthor() as unknown as Eprint['authors'][0],
    ],
    document: createMockBlobRef(),
    supplementaryMaterials: [],
    fields: [createMockFieldRef() as Eprint['fields'] extends (infer T)[] ? T : never],
    keywords: ['traditional', 'submission', 'eprint'],
    license: 'CC-BY-4.0',
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-16T14:20:00Z',
    indexedAt: '2024-01-15T10:35:00Z',
    pdsUrl: 'https://bsky.social',
    metrics: createMockEprintMetricsView(),
    versions: [
      {
        version: 1,
        uri: 'at://did:plc:user123/pub.chive.eprint.version/v1',
        cid: 'bafyreib2a3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7',
        createdAt: '2024-01-15T10:30:00Z',
      },
    ],
    ...overrides,
  };
}

/**
 * Creates a mock paper-centric Eprint (paper has its own PDS).
 *
 * @remarks
 * In the paper-centric model, the paper has its own DID and PDS.
 * The `paperDid` field is set, and the record URI uses the paper's DID.
 * The `submittedBy` field still refers to the human who submitted.
 */
export function createMockPaperCentricEprint(overrides: Partial<Eprint> = {}): Eprint {
  return {
    uri: 'at://did:plc:paper-abc123/pub.chive.eprint.submission/xyz',
    cid: 'bafyreic3b4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z8',
    $type: 'pub.chive.eprint.submission',
    title: 'A Paper-Centric Eprint',
    abstract: 'This eprint uses the paper-centric model where the paper has its own PDS and DID.',
    submittedBy: 'did:plc:user123', // Human who submitted (same person)
    paperDid: 'did:plc:paper-abc123', // Paper's own DID
    authors: [
      createMockEprintAuthorWithDid() as unknown as Eprint['authors'][0],
      createMockExternalAuthor() as unknown as Eprint['authors'][0],
    ],
    document: createMockBlobRef(),
    supplementaryMaterials: [],
    fields: [createMockFieldRef() as Eprint['fields'] extends (infer T)[] ? T : never],
    keywords: ['paper-centric', 'submission', 'eprint'],
    license: 'CC-BY-4.0',
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-16T14:20:00Z',
    indexedAt: '2024-01-15T10:35:00Z',
    pdsUrl: 'https://paper-abc123.pds.example.com',
    metrics: createMockEprintMetricsView(),
    versions: [
      {
        version: 1,
        uri: 'at://did:plc:paper-abc123/pub.chive.eprint.version/v1',
        cid: 'bafyreic3b4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z8',
        createdAt: '2024-01-15T10:30:00Z',
      },
    ],
    ...overrides,
  };
}

/**
 * Creates a list of all 14 CRediT contribution types.
 */
export function createMockCreditContributionTypes(): CreditContributionType[] {
  const creditRoles = [
    {
      id: 'conceptualization',
      label: 'Conceptualization',
      description: 'Ideas; formulation or evolution of overarching research goals and aims',
    },
    {
      id: 'data-curation',
      label: 'Data Curation',
      description: 'Management activities to annotate, scrub data and maintain research data',
    },
    {
      id: 'formal-analysis',
      label: 'Formal Analysis',
      description:
        'Application of statistical, mathematical, computational, or other formal techniques',
    },
    {
      id: 'funding-acquisition',
      label: 'Funding Acquisition',
      description: 'Acquisition of the financial support for the project',
    },
    {
      id: 'investigation',
      label: 'Investigation',
      description: 'Conducting research and investigation process, performing experiments',
    },
    {
      id: 'methodology',
      label: 'Methodology',
      description: 'Development or design of methodology; creation of models',
    },
    {
      id: 'project-administration',
      label: 'Project Administration',
      description: 'Management and coordination responsibility for research activity',
    },
    {
      id: 'resources',
      label: 'Resources',
      description: 'Provision of study materials, reagents, materials, or other analysis tools',
    },
    {
      id: 'software',
      label: 'Software',
      description: 'Programming, software development; designing computer programs',
    },
    {
      id: 'supervision',
      label: 'Supervision',
      description: 'Oversight and leadership responsibility for research activity planning',
    },
    {
      id: 'validation',
      label: 'Validation',
      description: 'Verification of overall replication/reproducibility of results',
    },
    {
      id: 'visualization',
      label: 'Visualization',
      description: 'Preparation, creation of the published work, specifically visualization',
    },
    {
      id: 'writing-original-draft',
      label: 'Writing - Original Draft',
      description: 'Preparation and creation of the initial draft',
    },
    {
      id: 'writing-review-editing',
      label: 'Writing - Review & Editing',
      description: 'Critical review, commentary or revision of the work',
    },
  ];

  return creditRoles.map((role) =>
    createMockContributionType({
      uri: `at://did:plc:chive-governance/pub.chive.graph.concept/${role.id}`,
      id: role.id,
      label: role.label,
      description: role.description,
      externalMappings: [
        {
          system: 'credit',
          identifier: role.id,
          uri: `https://credit.niso.org/contributor-roles/${role.id}/`,
          matchType: 'exact-match',
        },
      ],
    })
  );
}

// =============================================================================
// FACET MOCK DATA
// =============================================================================

/**
 * Facet proposal type for mock data.
 */
export interface MockFacetProposal {
  uri: string;
  proposer: string;
  proposalType: 'create' | 'update' | 'deprecate';
  dimension: FacetDimension;
  proposedId: string;
  proposedLabel: string;
  proposedDescription: string;
  parentId?: string;
  externalMappings: ExternalMapping[];
  rationale: string;
  status: 'pending' | 'approved' | 'rejected';
  voteTally: {
    approve: number;
    reject: number;
    total: number;
    expertVotes: number;
    quorumMet: boolean;
    thresholdsMet: boolean;
  };
  createdAt: string;
  votingDeadline?: string;
}

/**
 * Creates a mock governance FacetValue (for knowledge graph).
 */
export function createMockGovernanceFacetValue(overrides: Partial<FacetValue> = {}): FacetValue {
  return {
    value: 'machine-learning',
    label: 'Machine Learning',
    count: 42,
    ...overrides,
  };
}

/**
 * Creates a mock Facet Proposal.
 */
export function createMockFacetProposal(
  overrides: Partial<MockFacetProposal> = {}
): MockFacetProposal {
  return {
    uri: 'at://did:plc:user123/pub.chive.graph.facetProposal/abc',
    proposer: 'did:plc:user123',
    proposalType: 'create',
    dimension: 'personality',
    proposedId: 'deep-learning',
    proposedLabel: 'Deep Learning',
    proposedDescription: 'A subset of machine learning using neural networks with multiple layers',
    parentId: 'machine-learning',
    externalMappings: [
      {
        system: 'fast',
        identifier: 'fst00890098',
        uri: 'http://id.worldcat.org/fast/890098',
      },
    ],
    rationale:
      'Deep learning has become a distinct subfield with its own methodologies and applications',
    status: 'pending',
    voteTally: {
      approve: 3,
      reject: 1,
      total: 4,
      expertVotes: 2,
      quorumMet: false,
      thresholdsMet: false,
    },
    createdAt: '2025-01-08T00:00:00Z',
    votingDeadline: '2025-01-13T00:00:00Z',
    ...overrides,
  };
}

/**
 * Creates mock PMEST facet values.
 */
export function createMockPMESTFacetValues(): FacetValue[] {
  return [
    createMockGovernanceFacetValue({
      value: 'machine-learning',
      label: 'Machine Learning',
      count: 100,
    }),
    createMockGovernanceFacetValue({
      value: 'neural-networks',
      label: 'Neural Networks',
      count: 80,
    }),
    createMockGovernanceFacetValue({
      value: 'training',
      label: 'Training',
      count: 60,
    }),
    createMockGovernanceFacetValue({
      value: 'europe',
      label: 'Europe',
      count: 40,
    }),
    createMockGovernanceFacetValue({
      value: '21st-century',
      label: '21st Century',
      count: 200,
    }),
  ];
}

// =============================================================================
// ORGANIZATION MOCK DATA
// =============================================================================

/**
 * Organization proposal type for mock data.
 */
export interface MockOrganizationProposal {
  uri: string;
  proposer: string;
  proposalType: 'create' | 'update' | 'merge' | 'deprecate';
  name: string;
  type: OrganizationType;
  rorId?: string;
  wikidataId?: string;
  country?: string;
  city?: string;
  website?: string;
  aliases?: string[];
  parentId?: string;
  mergeTargetId?: string;
  rationale: string;
  status: 'pending' | 'approved' | 'rejected';
  voteTally: {
    approve: number;
    reject: number;
    total: number;
    expertVotes: number;
    quorumMet: boolean;
    thresholdsMet: boolean;
  };
  createdAt: string;
  votingDeadline?: string;
}

/**
 * Creates a mock Organization.
 */
export function createMockOrganization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: 'mit',
    uri: 'at://did:plc:chive-governance/pub.chive.graph.organization/mit',
    name: 'Massachusetts Institute of Technology',
    type: 'university',
    rorId: 'https://ror.org/042nb2s44',
    wikidataId: 'Q49108',
    country: 'US',
    city: 'Cambridge',
    website: 'https://www.mit.edu',
    aliases: ['MIT', 'M.I.T.'],
    parentId: undefined,
    status: 'established',
    ...overrides,
  };
}

/**
 * Creates a mock Organization Proposal.
 */
export function createMockOrganizationProposal(
  overrides: Partial<MockOrganizationProposal> = {}
): MockOrganizationProposal {
  return {
    uri: 'at://did:plc:user123/pub.chive.graph.organizationProposal/abc',
    proposer: 'did:plc:user123',
    proposalType: 'create',
    name: 'Stanford Artificial Intelligence Laboratory',
    type: 'research-lab',
    rorId: undefined,
    wikidataId: 'Q7598316',
    country: 'US',
    city: 'Stanford',
    website: 'https://ai.stanford.edu',
    aliases: ['SAIL'],
    parentId: 'stanford-university',
    rationale:
      'SAIL is a major AI research lab that should be tracked separately from the university',
    status: 'pending',
    voteTally: {
      approve: 2,
      reject: 0,
      total: 2,
      expertVotes: 1,
      quorumMet: false,
      thresholdsMet: false,
    },
    createdAt: '2025-01-08T00:00:00Z',
    votingDeadline: '2025-01-13T00:00:00Z',
    ...overrides,
  };
}

/**
 * Creates a list of mock organizations.
 */
export function createMockOrganizations(): Organization[] {
  return [
    createMockOrganization(),
    createMockOrganization({
      id: 'stanford',
      uri: 'at://did:plc:chive-governance/pub.chive.graph.organization/stanford',
      name: 'Stanford University',
      type: 'university',
      rorId: 'https://ror.org/00f54p054',
      wikidataId: 'Q41506',
      country: 'US',
      city: 'Stanford',
      website: 'https://www.stanford.edu',
      aliases: ['Stanford'],
    }),
    createMockOrganization({
      id: 'nih',
      uri: 'at://did:plc:chive-governance/pub.chive.graph.organization/nih',
      name: 'National Institutes of Health',
      type: 'funding-body',
      rorId: 'https://ror.org/01cwqze88',
      wikidataId: 'Q390551',
      country: 'US',
      city: 'Bethesda',
      website: 'https://www.nih.gov',
      aliases: ['NIH'],
    }),
  ];
}

// =============================================================================
// RECONCILIATION MOCK DATA
// =============================================================================

/**
 * Reconciliation proposal type for mock data.
 */
export interface MockReconciliationProposal {
  uri: string;
  proposer: string;
  proposalType: 'create' | 'update' | 'remove';
  sourceType: ReconcilableEntityType;
  sourceUri: string;
  sourceLabel: string;
  targetSystem: ReconciliationSystem;
  targetId: string;
  targetUri: string;
  targetLabel: string;
  matchType: ReconciliationMatchType;
  confidence?: number;
  rationale: string;
  status: 'pending' | 'approved' | 'rejected';
  voteTally: {
    approve: number;
    reject: number;
    total: number;
    expertVotes: number;
    quorumMet: boolean;
    thresholdsMet: boolean;
  };
  createdAt: string;
  votingDeadline?: string;
}

/**
 * Creates a mock Reconciliation.
 */
export function createMockReconciliation(overrides: Partial<Reconciliation> = {}): Reconciliation {
  return {
    id: 'ml-wikidata',
    uri: 'at://did:plc:chive-governance/pub.chive.graph.reconciliation/ml-wikidata',
    sourceType: 'field',
    sourceUri: 'at://did:plc:chive-governance/pub.chive.graph.field/machine-learning',
    sourceLabel: 'Machine Learning',
    targetSystem: 'wikidata',
    targetId: 'Q2539',
    targetUri: 'https://www.wikidata.org/wiki/Q2539',
    targetLabel: 'machine learning',
    matchType: 'exact-match',
    method: 'expert-validation',
    confidence: 0.98,
    validatedBy: 'did:plc:expert123',
    status: 'established',
    createdAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Creates a mock Reconciliation Proposal.
 */
export function createMockReconciliationProposal(
  overrides: Partial<MockReconciliationProposal> = {}
): MockReconciliationProposal {
  return {
    uri: 'at://did:plc:user123/pub.chive.graph.reconciliationProposal/abc',
    proposer: 'did:plc:user123',
    proposalType: 'create',
    sourceType: 'field',
    sourceUri: 'at://did:plc:chive-governance/pub.chive.graph.field/deep-learning',
    sourceLabel: 'Deep Learning',
    targetSystem: 'wikidata',
    targetId: 'Q197536',
    targetUri: 'https://www.wikidata.org/wiki/Q197536',
    targetLabel: 'deep learning',
    matchType: 'exact-match',
    confidence: 0.95,
    rationale: 'Direct mapping to Wikidata concept for deep learning',
    status: 'pending',
    voteTally: {
      approve: 4,
      reject: 0,
      total: 4,
      expertVotes: 2,
      quorumMet: true,
      thresholdsMet: false,
    },
    createdAt: '2025-01-08T00:00:00Z',
    votingDeadline: '2025-01-13T00:00:00Z',
    ...overrides,
  };
}

/**
 * Creates a list of mock reconciliations.
 */
export function createMockReconciliations(): Reconciliation[] {
  return [
    createMockReconciliation(),
    createMockReconciliation({
      id: 'mit-ror',
      uri: 'at://did:plc:chive-governance/pub.chive.graph.reconciliation/mit-ror',
      sourceType: 'organization',
      sourceUri: 'at://did:plc:chive-governance/pub.chive.graph.organization/mit',
      sourceLabel: 'Massachusetts Institute of Technology',
      targetSystem: 'ror',
      targetId: '042nb2s44',
      targetUri: 'https://ror.org/042nb2s44',
      targetLabel: 'Massachusetts Institute of Technology',
      matchType: 'exact-match',
      confidence: 1.0,
    }),
    createMockReconciliation({
      id: 'cs-lcsh',
      uri: 'at://did:plc:chive-governance/pub.chive.graph.reconciliation/cs-lcsh',
      sourceType: 'field',
      sourceUri: 'at://did:plc:chive-governance/pub.chive.graph.field/computer-science',
      sourceLabel: 'Computer Science',
      targetSystem: 'lcsh',
      targetId: 'sh85029552',
      targetUri: 'http://id.loc.gov/authorities/subjects/sh85029552',
      targetLabel: 'Computer science',
      matchType: 'exact-match',
      confidence: 0.99,
    }),
  ];
}
