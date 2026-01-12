import type {
  Author,
  AuthorMetrics,
  AuthorProfile,
  AuthorProfileResponse,
  BlobRef,
  Endorsement,
  EndorsementsResponse,
  EndorsementSummary,
  ExternalId,
  ExternalMapping,
  FacetDimension,
  FacetedPreprintSummary,
  FacetedSearchResponse,
  FacetProposalChanges,
  FacetValue,
  FieldDetail,
  FieldListResponse,
  FieldRef,
  FieldRelationship,
  FieldSummary,
  GetTrendingResponse,
  Organization,
  OrganizationProposalChanges,
  OrganizationType,
  Preprint,
  PreprintAuthor,
  AuthorAffiliation,
  AuthorContribution,
  PreprintMetrics,
  PreprintSource,
  PreprintSummary,
  PreprintTagsResponse,
  Reconciliation,
  ReconciliationMatchType,
  ReconciliationProposalChanges,
  ReconciliationSystem,
  ReconcilableEntityType,
  Review,
  ReviewsResponse,
  ReviewThread,
  RichAnnotationBody,
  SearchResultsResponse,
  TagSuggestion,
  TagSummary,
  TextSpanTarget,
  TrendingPreprint,
  TrendingTagsResponse,
  UserTag,
} from '@/lib/api/schema';
import type {
  ContributionTypeProposal,
  CreditContributionType,
} from '@/lib/hooks/use-contribution-types';

/**
 * Creates a mock Author (authenticated user, e.g., for reviews).
 * Uses required `did` since reviewers must be authenticated.
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
 * Creates a mock PreprintAuthor (for preprint contributor lists).
 * Uses optional `did` to support external collaborators.
 */
export function createMockPreprintAuthor(overrides: Partial<PreprintAuthor> = {}): PreprintAuthor {
  return {
    did: 'did:plc:test123',
    name: 'Test User',
    handle: 'testuser.bsky.social',
    avatarUrl: 'https://example.com/avatar.jpg',
    orcid: undefined,
    email: undefined,
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
    $type: 'blob',
    ref: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
    mimeType: 'application/pdf',
    size: 1024000,
    ...overrides,
  };
}

/**
 * Creates a mock FieldRef.
 */
export function createMockFieldRef(overrides: Partial<FieldRef> = {}): FieldRef {
  return {
    id: 'computer-science',
    uri: 'at://did:plc:chive-governance/pub.chive.graph.field/computer-science',
    name: 'Computer Science',
    ...overrides,
  };
}

/**
 * Creates a mock PreprintSource.
 */
export function createMockPreprintSource(overrides: Partial<PreprintSource> = {}): PreprintSource {
  return {
    pdsEndpoint: 'https://bsky.social',
    recordUrl: 'at://did:plc:test123/pub.chive.preprint.submission/abc123',
    blobUrl: 'https://bsky.social/xrpc/com.atproto.sync.getBlob',
    lastVerifiedAt: '2024-01-15T10:35:00Z',
    stale: false,
    ...overrides,
  };
}

/**
 * Creates a mock PreprintMetrics.
 */
export function createMockPreprintMetrics(
  overrides: Partial<PreprintMetrics> = {}
): PreprintMetrics {
  return {
    views: 150,
    downloads: 42,
    endorsements: 5,
    ...overrides,
  };
}

/**
 * Creates a mock Preprint.
 */
export function createMockPreprint(overrides: Partial<Preprint> = {}): Preprint {
  return {
    uri: 'at://did:plc:test123/pub.chive.preprint.submission/abc123',
    cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
    title: 'A Novel Approach to Machine Learning',
    abstract:
      'This paper presents a novel approach to machine learning that improves efficiency by 50%.',
    submittedBy: 'did:plc:test123',
    authors: [
      createMockPreprintAuthor({ order: 1, isCorrespondingAuthor: true }),
      createMockPreprintAuthor({
        did: 'did:plc:coauthor1',
        name: 'Co-Author One',
        order: 2,
        isHighlighted: true,
      }),
    ],
    document: createMockBlobRef(),
    supplementaryMaterials: [],
    fields: [createMockFieldRef()],
    keywords: ['machine learning', 'artificial intelligence', 'deep learning'],
    license: 'CC-BY-4.0',
    doi: '10.1234/chive.2024.001',
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-16T14:20:00Z',
    source: createMockPreprintSource(),
    metrics: createMockPreprintMetrics(),
    versions: [
      {
        version: 1,
        cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        createdAt: '2024-01-15T10:30:00Z',
      },
    ],
    ...overrides,
  };
}

/**
 * Creates a mock PreprintSummary.
 */
export function createMockPreprintSummary(
  overrides: Partial<PreprintSummary> = {}
): PreprintSummary {
  return {
    uri: 'at://did:plc:test123/pub.chive.preprint.submission/abc123',
    cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
    title: 'A Novel Approach to Machine Learning',
    abstract:
      'This paper presents a novel approach to machine learning that improves efficiency by 50%.',
    submittedBy: 'did:plc:test123',
    authors: [createMockPreprintAuthor({ order: 1, isCorrespondingAuthor: true })],
    fields: [createMockFieldRef()],
    createdAt: '2024-01-15T10:30:00Z',
    source: createMockPreprintSource(),
    ...overrides,
  };
}

/**
 * Creates a mock TrendingPreprint.
 */
export function createMockTrendingPreprint(
  overrides: Partial<TrendingPreprint> = {}
): TrendingPreprint {
  return {
    ...createMockPreprintSummary(),
    viewsInWindow: 500,
    rank: 1,
    ...overrides,
  };
}

/**
 * Creates a mock FacetedPreprintSummary for browseFaceted hits.
 */
export function createMockFacetedPreprintSummary(
  overrides: Partial<FacetedPreprintSummary> = {}
): FacetedPreprintSummary {
  return {
    uri: 'at://did:plc:test123/pub.chive.preprint.submission/abc123',
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
      { id: 'cs', uri: 'at://did:plc:chive/pub.chive.graph.field/cs', name: 'Computer Science' },
    ],
    keywords: ['machine learning', 'neural networks'],
    license: 'CC-BY-4.0',
    createdAt: '2024-01-15T10:30:00Z',
    indexedAt: '2024-01-15T10:35:00Z',
    source: {
      pdsEndpoint: 'https://bsky.social',
      recordUrl:
        'https://bsky.social/xrpc/com.atproto.sync.getRecord?did=did:plc:test123&collection=pub.chive.preprint.submission&rkey=abc123',
      blobUrl: 'https://bsky.social/xrpc/com.atproto.sync.getBlob?did=did:plc:test123&cid=...',
      lastVerifiedAt: '2024-01-15T10:35:00Z',
      stale: false,
    },
    ...overrides,
  };
}

/**
 * Creates a mock SearchResultsResponse.
 */
export function createMockSearchResults(
  overrides: Partial<SearchResultsResponse> = {}
): SearchResultsResponse {
  return {
    hits: [
      createMockFacetedPreprintSummary({
        uri: 'at://did:plc:test1/pub.chive.preprint.submission/1',
      }),
      createMockFacetedPreprintSummary({
        uri: 'at://did:plc:test2/pub.chive.preprint.submission/2',
      }),
      createMockFacetedPreprintSummary({
        uri: 'at://did:plc:test3/pub.chive.preprint.submission/3',
      }),
    ],
    cursor: 'cursor123',
    hasMore: true,
    total: 42,
    facets: {
      personality: [
        { value: 'computer-science', label: 'Computer Science', count: 15 },
        { value: 'physics', label: 'Physics', count: 10 },
      ],
    },
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
      createMockTrendingPreprint({ rank: 1, viewsInWindow: 500 }),
      createMockTrendingPreprint({
        rank: 2,
        viewsInWindow: 350,
        uri: 'at://did:plc:test2/pub.chive.preprint.submission/2',
      }),
      createMockTrendingPreprint({
        rank: 3,
        viewsInWindow: 200,
        uri: 'at://did:plc:test3/pub.chive.preprint.submission/3',
      }),
    ],
    window: '7d',
    cursor: undefined,
    hasMore: false,
    ...overrides,
  };
}

/**
 * Creates a list of mock preprint summaries.
 */
export function createMockPreprintList(count: number = 5): PreprintSummary[] {
  return Array.from({ length: count }, (_, i) =>
    createMockPreprintSummary({
      uri: `at://did:plc:test${i}/pub.chive.preprint.submission/${i}`,
      title: `Test Preprint ${i + 1}`,
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
    totalPreprints: 15,
    totalViews: 5000,
    totalDownloads: 1200,
    totalEndorsements: 42,
    hIndex: 8,
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
    name: 'Computer Science',
    description: 'The study of computation and information processing.',
    preprintCount: 250,
    childCount: 12,
    status: 'approved',
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Creates a mock ExternalId.
 */
export function createMockExternalId(overrides: Partial<ExternalId> = {}): ExternalId {
  return {
    source: 'wikidata',
    id: 'Q21198',
    url: 'https://www.wikidata.org/wiki/Q21198',
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
    targetName: 'Science',
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
    name: 'Machine Learning',
    description: 'A subset of artificial intelligence that enables systems to learn from data.',
    parentId: 'computer-science',
    status: 'approved',
    preprintCount: 150,
    externalIds: [
      createMockExternalId({
        source: 'wikidata',
        id: 'Q2539',
        url: 'https://www.wikidata.org/wiki/Q2539',
      }),
      createMockExternalId({
        source: 'lcsh',
        id: 'sh85079324',
        url: 'https://id.loc.gov/authorities/subjects/sh85079324',
      }),
    ],
    relationships: [
      createMockFieldRelationship({
        type: 'broader',
        targetId: 'artificial-intelligence',
        targetName: 'Artificial Intelligence',
      }),
      createMockFieldRelationship({
        type: 'related',
        targetId: 'data-science',
        targetName: 'Data Science',
        strength: 0.8,
      }),
    ],
    children: [
      { id: 'deep-learning', name: 'Deep Learning', preprintCount: 80 },
      { id: 'reinforcement-learning', name: 'Reinforcement Learning', preprintCount: 40 },
    ],
    ancestors: [
      { id: 'computer-science', name: 'Computer Science' },
      { id: 'artificial-intelligence', name: 'Artificial Intelligence' },
    ],
    createdAt: '2023-06-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
    ...overrides,
  };
}

/**
 * Creates a mock FieldListResponse.
 */
export function createMockFieldListResponse(
  overrides: Partial<FieldListResponse> = {}
): FieldListResponse {
  return {
    fields: [
      createMockFieldSummary({ id: 'physics', name: 'Physics', preprintCount: 300 }),
      createMockFieldSummary({
        id: 'computer-science',
        name: 'Computer Science',
        preprintCount: 250,
      }),
      createMockFieldSummary({ id: 'biology', name: 'Biology', preprintCount: 200 }),
    ],
    cursor: 'cursor-123',
    hasMore: true,
    total: 50,
    ...overrides,
  };
}

// ============================================================================
// Faceted Search Mocks
// ============================================================================

/**
 * Creates a mock FacetValue.
 */
export function createMockFacetValue(overrides: Partial<FacetValue> = {}): FacetValue {
  return {
    value: 'computer-science',
    count: 42,
    label: 'Computer Science',
    ...overrides,
  };
}

/**
 * Creates a mock FacetedSearchResponse.
 */
export function createMockFacetedSearchResponse(
  overrides: Partial<FacetedSearchResponse> = {}
): FacetedSearchResponse {
  return {
    hits: [
      createMockFacetedPreprintSummary({
        uri: 'at://did:plc:test1/pub.chive.preprint.submission/1',
      }),
      createMockFacetedPreprintSummary({
        uri: 'at://did:plc:test2/pub.chive.preprint.submission/2',
      }),
    ],
    cursor: 'cursor-456',
    hasMore: true,
    total: 100,
    facets: {
      personality: [
        createMockFacetValue({ value: 'research', count: 50, label: 'Research' }),
        createMockFacetValue({ value: 'review', count: 30, label: 'Review' }),
      ],
      matter: [
        createMockFacetValue({ value: 'physics', count: 40, label: 'Physics' }),
        createMockFacetValue({ value: 'computer-science', count: 35, label: 'Computer Science' }),
      ],
      energy: [
        createMockFacetValue({ value: 'classification', count: 25, label: 'Classification' }),
      ],
      space: [createMockFacetValue({ value: 'north-america', count: 45, label: 'North America' })],
      time: [createMockFacetValue({ value: '2024', count: 60, label: '2024' })],
    },
    ...overrides,
  };
}

// ============================================================================
// Review Mocks
// ============================================================================

/**
 * Creates a mock TextSpanTarget.
 */
export function createMockTextSpanTarget(overrides: Partial<TextSpanTarget> = {}): TextSpanTarget {
  return {
    source: 'at://did:plc:author/pub.chive.preprint.submission/abc123',
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
  return {
    type: 'RichText',
    items: [
      { type: 'text', content: 'This is an excellent methodology. See also ' },
      { type: 'wikidataRef', qid: 'Q2539', label: 'Machine Learning' },
      { type: 'text', content: ' for background.' },
    ],
    format: 'application/x-chive-gloss+json',
    ...overrides,
  };
}

/**
 * Creates a mock Review.
 */
export function createMockReview(overrides: Partial<Review> = {}): Review {
  return {
    uri: 'at://did:plc:reviewer/pub.chive.review.comment/review123',
    cid: 'bafyreireview123',
    preprintUri: 'at://did:plc:author/pub.chive.preprint.submission/abc123',
    author: createMockAuthor({ did: 'did:plc:reviewer', displayName: 'Dr. Reviewer' }),
    content: 'This is an excellent methodology. See also Machine Learning for background.',
    body: {
      text: 'This is an excellent methodology. See also Machine Learning for background.',
      facets: [
        {
          index: { byteStart: 43, byteEnd: 59 }, // "Machine Learning"
          features: [
            {
              $type: 'app.bsky.richtext.facet#link',
              uri: 'https://www.wikidata.org/wiki/Q2539',
            },
          ],
        },
      ],
    },
    motivation: 'commenting',
    replyCount: 0,
    createdAt: '2024-06-15T10:30:00Z',
    indexedAt: '2024-06-15T10:35:00Z',
    ...overrides,
  };
}

/**
 * Creates a mock Review with target (inline annotation).
 */
export function createMockInlineReview(overrides: Partial<Review> = {}): Review {
  return createMockReview({
    target: createMockTextSpanTarget(),
    ...overrides,
  });
}

/**
 * Creates a mock ReviewThread.
 * Note: ReviewThread has flat replies array, not nested thread objects.
 */
export function createMockReviewThread(overrides: Partial<ReviewThread> = {}): ReviewThread {
  const parent = createMockReview();
  return {
    parent,
    replies: [
      {
        parent: createMockReview({
          uri: 'at://did:plc:replier1/pub.chive.review.comment/reply1',
          author: createMockAuthor({ did: 'did:plc:replier1', displayName: 'Replier One' }),
          content: 'I agree with this assessment.',
          parentReviewUri: parent.uri,
        }),
        replies: [],
        totalReplies: 0,
      },
      {
        parent: createMockReview({
          uri: 'at://did:plc:replier2/pub.chive.review.comment/reply2',
          author: createMockAuthor({ did: 'did:plc:replier2', displayName: 'Replier Two' }),
          content: 'Could you elaborate on the methodology section?',
          motivation: 'questioning',
          parentReviewUri: parent.uri,
        }),
        replies: [],
        totalReplies: 0,
      },
    ],
    totalReplies: 2,
    ...overrides,
  };
}

/**
 * Creates a mock ReviewsResponse.
 */
export function createMockReviewsResponse(
  overrides: Partial<ReviewsResponse> = {}
): ReviewsResponse {
  return {
    reviews: [
      createMockReview({ uri: 'at://did:plc:r1/pub.chive.review.comment/1' }),
      createMockReview({
        uri: 'at://did:plc:r2/pub.chive.review.comment/2',
        motivation: 'questioning',
        content: 'How does this compare to previous approaches?',
      }),
      createMockInlineReview({ uri: 'at://did:plc:r3/pub.chive.review.comment/3' }),
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
 * Creates a mock Endorsement.
 */
export function createMockEndorsement(
  overrides: Partial<Endorsement> & { endorserDid?: string } = {}
): Endorsement {
  const { endorserDid, ...rest } = overrides;
  return {
    uri: 'at://did:plc:endorser/pub.chive.review.endorsement/endorsement123',
    preprintUri: 'at://did:plc:author/pub.chive.preprint.submission/abc123',
    endorser: createMockAuthor({
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
 */
export function createMockEndorsementSummary(
  overrides: Partial<EndorsementSummary> = {}
): EndorsementSummary {
  return {
    byType: {
      methodological: 5,
      empirical: 3,
      analytical: 2,
    },
    total: 10,
    endorserCount: 8,
    ...overrides,
  };
}

/**
 * Creates a mock EndorsementsResponse.
 */
export function createMockEndorsementsResponse(
  overrides: Partial<EndorsementsResponse> = {}
): EndorsementsResponse {
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
    uri: 'at://did:plc:tagger/pub.chive.preprint.userTag/tag123',
    preprintUri: 'at://did:plc:author/pub.chive.preprint.submission/abc123',
    author: createMockAuthor({ did: 'did:plc:tagger', displayName: 'Tagger User' }),
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
 * Creates a mock PreprintTagsResponse.
 */
export function createMockPreprintTagsResponse(
  overrides: Partial<PreprintTagsResponse> = {}
): PreprintTagsResponse {
  return {
    tags: [
      createMockUserTag({ normalizedForm: 'machine-learning', displayForm: 'Machine Learning' }),
      createMockUserTag({
        uri: 'at://did:plc:t2/pub.chive.preprint.userTag/2',
        normalizedForm: 'neural-networks',
        displayForm: 'Neural Networks',
      }),
      createMockUserTag({
        uri: 'at://did:plc:t3/pub.chive.preprint.userTag/3',
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
        source: 'authority',
      }),
    ],
    ...overrides,
  };
}

/**
 * Creates a mock TrendingTagsResponse.
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
      }),
      createMockTagSummary({
        normalizedForm: 'generative-ai',
        displayForms: ['Generative AI'],
        usageCount: 350,
      }),
      createMockTagSummary({
        normalizedForm: 'transformer-architecture',
        displayForms: ['Transformer Architecture'],
        usageCount: 200,
      }),
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
 */
export function createMockAuthorContribution(
  overrides: Partial<AuthorContribution> = {}
): AuthorContribution {
  return {
    typeUri: 'at://did:plc:chive-governance/pub.chive.contribution.type/conceptualization',
    typeId: 'conceptualization',
    typeLabel: 'Conceptualization',
    degree: 'lead',
    ...overrides,
  };
}

/**
 * Creates a mock PreprintAuthor with DID (authenticated ATProto user).
 *
 * @remarks
 * Use this for authors who have an ATProto account.
 */
export function createMockPreprintAuthorWithDid(
  overrides: Partial<PreprintAuthor> = {}
): PreprintAuthor {
  return {
    did: 'did:plc:test123',
    name: 'Dr. Jane Smith',
    handle: 'janesmith.bsky.social',
    avatarUrl: 'https://example.com/avatar.jpg',
    orcid: '0000-0001-2345-6789',
    email: undefined,
    order: 1,
    affiliations: [createMockAuthorAffiliation()],
    contributions: [
      createMockAuthorContribution(),
      createMockAuthorContribution({
        typeUri: 'at://did:plc:chive-governance/pub.chive.contribution.type/writing-original-draft',
        typeId: 'writing-original-draft',
        typeLabel: 'Writing - Original Draft',
        degree: 'lead',
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
export function createMockExternalAuthor(overrides: Partial<PreprintAuthor> = {}): PreprintAuthor {
  return {
    did: undefined,
    name: 'John External',
    handle: undefined,
    avatarUrl: undefined,
    orcid: '0000-0002-3456-7890',
    email: 'john@external.edu',
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
        typeUri: 'at://did:plc:chive-governance/pub.chive.contribution.type/investigation',
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
 * Creates a mock CreditContributionType (CRediT-based).
 */
export function createMockContributionType(
  overrides: Partial<CreditContributionType> = {}
): CreditContributionType {
  return {
    uri: 'at://did:plc:chive-governance/pub.chive.contribution.type/conceptualization',
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
    uri: 'at://did:plc:user123/pub.chive.contribution.typeProposal/abc',
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
 * Creates a mock traditional Preprint (paper lives in submitter's PDS).
 *
 * @remarks
 * In the traditional model, the paper record lives in the submitter's PDS.
 * The `paperDid` field is undefined, and the record URI uses the submitter's DID.
 */
export function createMockTraditionalPreprint(overrides: Partial<Preprint> = {}): Preprint {
  return {
    uri: 'at://did:plc:user123/pub.chive.preprint.submission/xyz',
    cid: 'bafyreib2a3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7',
    title: 'A Traditional Preprint',
    abstract:
      'This preprint uses the traditional submission model where the paper lives in the submitter PDS.',
    submittedBy: 'did:plc:user123',
    paperDid: undefined, // Traditional model - no paper DID
    authors: [createMockPreprintAuthorWithDid(), createMockExternalAuthor()],
    document: createMockBlobRef(),
    supplementaryMaterials: [],
    fields: [createMockFieldRef()],
    keywords: ['traditional', 'submission', 'preprint'],
    license: 'CC-BY-4.0',
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-16T14:20:00Z',
    source: createMockPreprintSource({
      recordUrl: 'at://did:plc:user123/pub.chive.preprint.submission/xyz',
    }),
    metrics: createMockPreprintMetrics(),
    versions: [
      {
        version: 1,
        cid: 'bafyreib2a3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7',
        createdAt: '2024-01-15T10:30:00Z',
      },
    ],
    ...overrides,
  };
}

/**
 * Creates a mock paper-centric Preprint (paper has its own PDS).
 *
 * @remarks
 * In the paper-centric model, the paper has its own DID and PDS.
 * The `paperDid` field is set, and the record URI uses the paper's DID.
 * The `submittedBy` field still refers to the human who submitted.
 */
export function createMockPaperCentricPreprint(overrides: Partial<Preprint> = {}): Preprint {
  return {
    uri: 'at://did:plc:paper-abc123/pub.chive.preprint.submission/xyz',
    cid: 'bafyreic3b4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z8',
    title: 'A Paper-Centric Preprint',
    abstract: 'This preprint uses the paper-centric model where the paper has its own PDS and DID.',
    submittedBy: 'did:plc:user123', // Human who submitted (same person)
    paperDid: 'did:plc:paper-abc123', // Paper's own DID
    authors: [createMockPreprintAuthorWithDid(), createMockExternalAuthor()],
    document: createMockBlobRef(),
    supplementaryMaterials: [],
    fields: [createMockFieldRef()],
    keywords: ['paper-centric', 'submission', 'preprint'],
    license: 'CC-BY-4.0',
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-16T14:20:00Z',
    source: createMockPreprintSource({
      pdsEndpoint: 'https://paper-abc123.pds.example.com',
      recordUrl: 'at://did:plc:paper-abc123/pub.chive.preprint.submission/xyz',
    }),
    metrics: createMockPreprintMetrics(),
    versions: [
      {
        version: 1,
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
      uri: `at://did:plc:chive-governance/pub.chive.contribution.type/${role.id}`,
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
    id: 'machine-learning',
    label: 'Machine Learning',
    dimension: 'personality',
    description:
      'A branch of artificial intelligence focused on building systems that learn from data',
    externalMappings: [
      {
        system: 'lcsh',
        identifier: 'sh85079324',
        uri: 'http://id.loc.gov/authorities/subjects/sh85079324',
      },
    ],
    parentId: 'artificial-intelligence',
    status: 'established',
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
      id: 'machine-learning',
      label: 'Machine Learning',
      dimension: 'personality',
      description: 'What the subject is fundamentally about',
    }),
    createMockGovernanceFacetValue({
      id: 'neural-networks',
      label: 'Neural Networks',
      dimension: 'matter',
      description: 'Materials or constituents used',
    }),
    createMockGovernanceFacetValue({
      id: 'training',
      label: 'Training',
      dimension: 'energy',
      description: 'Processes or operations performed',
    }),
    createMockGovernanceFacetValue({
      id: 'europe',
      label: 'Europe',
      dimension: 'space',
      description: 'Geographic location',
    }),
    createMockGovernanceFacetValue({
      id: '21st-century',
      label: '21st Century',
      dimension: 'time',
      description: 'Temporal period',
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
