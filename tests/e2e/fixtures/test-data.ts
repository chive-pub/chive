/**
 * E2E test data fixtures.
 *
 * @remarks
 * IMPORTANT: The SEEDED_* constants must match the data in global.setup.ts.
 * The seeded data uses real researchers and papers from computational linguistics.
 */

/**
 * Test user credentials for authenticated flows.
 *
 * @remarks
 * This must match the user set up in auth.setup.ts for the
 * authenticated tests to work correctly.
 */
export const TEST_USER = {
  did: 'did:plc:e2etestuser123',
  handle: 'e2e-test.bsky.social',
  displayName: 'E2E Test User',
  description: 'Automated test user for Chive E2E tests',
  pdsEndpoint: 'https://bsky.social',
};

/**
 * Session metadata key used by the app for localStorage.
 */
export const SESSION_METADATA_KEY = 'chive_session_metadata';

/**
 * Real seeded authors from global.setup.ts.
 *
 * These are actual researchers from computational linguistics.
 */
export const SEEDED_AUTHORS = {
  white: {
    did: 'did:plc:aswhite123abc',
    handle: 'aswhite.bsky.social',
    displayName: 'Aaron Steven White',
    orcid: '0000-0002-4921-5202',
    affiliation: 'University of Rochester',
  },
  grove: {
    did: 'did:plc:jgrove456def',
    handle: 'jgrove.bsky.social',
    displayName: 'Julian Grove',
    affiliation: 'University of Florida',
  },
  charlow: {
    did: 'did:plc:scharlow789ghi',
    handle: 'scharlow.bsky.social',
    displayName: 'Simon Charlow',
    affiliation: 'Yale University',
  },
};

/**
 * Real seeded preprints from global.setup.ts.
 *
 * These are actual papers from the seeded authors.
 */
export const SEEDED_PREPRINTS = {
  white: {
    uri: 'at://did:plc:aswhite123abc/pub.chive.preprint.submission/3jt7k9xyzab01',
    title: 'Frequency, Acceptability, and Selection: A Case Study of Clause-Embedding',
    keywords: ['clause-embedding verbs', 'acceptability', 'corpus frequency'],
  },
  grove: {
    uri: 'at://did:plc:jgrove456def/pub.chive.preprint.submission/3kt8m0abcde02',
    title: 'Algebraic Effects for Extensible Dynamic Semantics',
    keywords: ['dynamic semantics', 'algebraic effects', 'Montague semantics'],
  },
  charlow: {
    uri: 'at://did:plc:scharlow789ghi/pub.chive.preprint.submission/4lu9n1bcdef03',
    title: 'On the Semantics of Exceptional Scope',
    keywords: ['scope', 'continuations', 'monads', 'indefinites'],
  },
};

/**
 * Real seeded fields from global.setup.ts.
 */
export const SEEDED_FIELDS = [
  'Linguistics',
  'Computational Linguistics',
  'Formal Semantics',
  'Psycholinguistics',
  'Dynamic Semantics',
  'Lexical Semantics',
];

/**
 * Real seeded tags from global.setup.ts.
 */
export const SEEDED_TAGS = ['monads', 'megaattitude'];

/**
 * Real seeded governance proposals from global.setup.ts.
 */
export const SEEDED_PROPOSALS = {
  quantumSemantics: {
    id: 'proposal-test-001',
    uri: 'at://did:plc:chive-governance/pub.chive.graph.proposal/proposal-test-001',
    fieldName: 'Quantum Semantics',
    status: 'pending',
    proposerDid: 'did:plc:aswhite123abc',
  },
  computationalPragmatics: {
    id: 'proposal-test-002',
    uri: 'at://did:plc:chive-governance/pub.chive.graph.proposal/proposal-test-002',
    fieldName: 'Computational Pragmatics',
    status: 'pending',
    proposerDid: 'did:plc:jgrove456def',
  },
};

/**
 * Form validation test data.
 */
export const FORM_DATA = {
  validAbstract:
    'This is a comprehensive test abstract that is at least 50 characters long for validation requirements.',
  shortAbstract: 'Too short',
  validTitle: 'Test Preprint: A Comprehensive E2E Test Case',
  validDid: 'did:plc:coauthor123abc',
  invalidDid: 'not-a-valid-did',
  validOrcid: '0000-0002-1825-0097',
  invalidOrcid: '1234',
};

/**
 * Test search queries and expected results.
 *
 * Updated to match seeded data from computational linguistics.
 */
export const SEARCH_QUERIES = {
  simple: {
    query: 'semantics',
    expectedMinResults: 1,
  },
  noResults: {
    query: 'xyznonexistent12345',
    expectedResults: 0,
  },
  exactPhrase: {
    query: '"dynamic semantics"',
    expectedMinResults: 1,
  },
};

/**
 * Routes for navigation tests.
 */
export const ROUTES = {
  home: '/',
  search: '/search',
  browse: '/browse',
  preprints: '/preprints',
  authors: '/authors',
  fields: '/fields',
  tags: '/tags',
  signIn: '/login',
  submit: '/submit',
  dashboard: '/dashboard',
  governance: '/governance',
};
