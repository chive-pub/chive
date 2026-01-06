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
  FacetedPreprintSummary,
  FacetedSearchResponse,
  FacetValue,
  FieldDetail,
  FieldListResponse,
  FieldRef,
  FieldRelationship,
  FieldSummary,
  GetTrendingResponse,
  Preprint,
  PreprintMetrics,
  PreprintSource,
  PreprintSummary,
  PreprintTagsResponse,
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

/**
 * Creates a mock Author.
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
    author: createMockAuthor(),
    coAuthors: [createMockAuthor({ did: 'did:plc:coauthor1', displayName: 'Co-Author One' })],
    document: createMockBlobRef(),
    supplementary: [],
    fields: [createMockFieldRef()],
    keywords: ['machine learning', 'artificial intelligence', 'deep learning'],
    license: 'CC-BY-4.0',
    doi: '10.1234/chive.2024.001',
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-16T14:20:00Z',
    indexedAt: '2024-01-15T10:35:00Z',
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
    author: createMockAuthor(),
    fields: [createMockFieldRef()],
    license: 'CC-BY-4.0',
    createdAt: '2024-01-15T10:30:00Z',
    indexedAt: '2024-01-15T10:35:00Z',
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
    author: {
      did: 'did:plc:test123',
      handle: 'testuser.bsky.social',
      displayName: 'Test User',
      avatar: 'https://example.com/avatar.jpg',
    },
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
      createMockPreprintSummary({ uri: 'at://did:plc:test1/pub.chive.preprint.submission/1' }),
      createMockPreprintSummary({ uri: 'at://did:plc:test2/pub.chive.preprint.submission/2' }),
      createMockPreprintSummary({ uri: 'at://did:plc:test3/pub.chive.preprint.submission/3' }),
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
