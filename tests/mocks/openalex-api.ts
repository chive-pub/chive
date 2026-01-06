/**
 * Mock responses for OpenAlex API.
 *
 * @remarks
 * Provides fixture data for testing OpenAlex plugin methods without hitting the real API.
 * All data is fabricated but structurally matches the OpenAlex API responses.
 *
 * @packageDocumentation
 */

import type {
  OpenAlexAuthor,
  OpenAlexConcept,
  OpenAlexTopic,
  OpenAlexWork,
} from '../../src/plugins/builtin/openalex.js';

/**
 * Sample concept for testing.
 */
export const mockConcept: OpenAlexConcept = {
  id: 'https://openalex.org/C41008148',
  displayName: 'Computer Science',
  level: 0,
  score: 0.85,
  wikidata: 'Q21198',
};

/**
 * Sample topic for testing.
 */
export const mockTopic: OpenAlexTopic = {
  id: 'https://openalex.org/T10123',
  displayName: 'Natural Language Processing',
  subfield: 'Artificial Intelligence',
  field: 'Computer Science',
  domain: 'Physical Sciences',
  score: 0.92,
};

/**
 * Sample work for testing.
 */
export const mockWork: OpenAlexWork = {
  id: 'https://openalex.org/W2741809807',
  doi: '10.1234/test.2024.001',
  title: 'A Test Paper for Discovery Features',
  type: 'article',
  publicationDate: '2024-01-15',
  publicationYear: 2024,
  authorships: [
    {
      authorPosition: 'first',
      author: {
        id: 'https://openalex.org/A5023888391',
        displayName: 'Alice Researcher',
        orcid: '0000-0001-2345-6789',
      },
      institutions: [
        {
          id: 'https://openalex.org/I27837315',
          displayName: 'Test University',
          ror: 'https://ror.org/00000001',
          countryCode: 'US',
        },
      ],
      rawAffiliationString: 'Test University, Department of Computer Science',
    },
    {
      authorPosition: 'last',
      author: {
        id: 'https://openalex.org/A5023888392',
        displayName: 'Bob Scientist',
      },
      institutions: [],
    },
  ],
  primaryLocation: {
    source: {
      id: 'https://openalex.org/S4306420267',
      displayName: 'Conference on Testing',
      type: 'conference',
      issn: ['1234-5678'],
    },
    landingPageUrl: 'https://example.com/paper',
    pdfUrl: 'https://example.com/paper.pdf',
  },
  citedByCount: 42,
  referencedWorksCount: 23,
  concepts: [
    mockConcept,
    {
      id: 'https://openalex.org/C154945302',
      displayName: 'Artificial Intelligence',
      level: 1,
      score: 0.78,
      wikidata: 'Q11660',
    },
    {
      id: 'https://openalex.org/C204321447',
      displayName: 'Natural Language Processing',
      level: 2,
      score: 0.72,
      wikidata: 'Q30642',
    },
  ],
  openAccess: {
    isOa: true,
    oaUrl: 'https://example.com/paper.pdf',
    oaStatus: 'gold',
  },
  abstract: 'This is a test abstract for validating discovery feature integration.',
  source: 'openalex',
};

/**
 * Sample author for testing.
 */
export const mockAuthor: OpenAlexAuthor = {
  id: 'https://openalex.org/A5023888391',
  orcid: '0000-0001-2345-6789',
  displayName: 'Alice Researcher',
  worksCount: 50,
  citedByCount: 1000,
  affiliations: [
    {
      institution: {
        id: 'https://openalex.org/I27837315',
        displayName: 'Test University',
        ror: 'https://ror.org/00000001',
      },
      years: [2020, 2021, 2022, 2023, 2024],
    },
  ],
  topConcepts: [mockConcept],
  source: 'openalex',
};

/**
 * Sample related work IDs.
 */
export const mockRelatedWorkIds: string[] = [
  'https://openalex.org/W2741809808',
  'https://openalex.org/W2741809809',
  'https://openalex.org/W2741809810',
  'https://openalex.org/W2741809811',
  'https://openalex.org/W2741809812',
];

/**
 * Sample batch works.
 */
export const mockBatchWorks: OpenAlexWork[] = [
  {
    ...mockWork,
    id: 'https://openalex.org/W2741809808',
    doi: '10.1234/related.001',
    title: 'Related Paper One from OpenAlex',
  },
  {
    ...mockWork,
    id: 'https://openalex.org/W2741809809',
    doi: '10.1234/related.002',
    title: 'Related Paper Two from OpenAlex',
  },
];

/**
 * Sample text classification result.
 */
export const mockTextClassification = {
  topics: [
    mockTopic,
    {
      id: 'https://openalex.org/T10124',
      displayName: 'Machine Learning',
      subfield: 'Artificial Intelligence',
      field: 'Computer Science',
      domain: 'Physical Sciences',
      score: 0.88,
    },
  ],
  concepts: mockWork.concepts,
  keywords: ['natural language processing', 'machine learning', 'deep learning'],
};

/**
 * Mock OpenAlex API raw responses (before transformation).
 */
export const mockOpenAlexApiResponses = {
  work: {
    id: mockWork.id,
    doi: `https://doi.org/${mockWork.doi}`,
    title: mockWork.title,
    type: mockWork.type,
    publication_date: mockWork.publicationDate,
    publication_year: mockWork.publicationYear,
    authorships: mockWork.authorships.map((a) => ({
      author_position: a.authorPosition,
      author: {
        id: a.author.id,
        display_name: a.author.displayName,
        orcid: a.author.orcid ? `https://orcid.org/${a.author.orcid}` : undefined,
      },
      institutions: a.institutions.map((i) => ({
        id: i.id,
        display_name: i.displayName,
        ror: i.ror,
        country_code: i.countryCode,
      })),
      raw_affiliation_string: a.rawAffiliationString,
    })),
    primary_location: mockWork.primaryLocation
      ? {
          source: mockWork.primaryLocation.source
            ? {
                id: mockWork.primaryLocation.source.id,
                display_name: mockWork.primaryLocation.source.displayName,
                type: mockWork.primaryLocation.source.type,
                issn: mockWork.primaryLocation.source.issn,
              }
            : undefined,
          landing_page_url: mockWork.primaryLocation.landingPageUrl,
          pdf_url: mockWork.primaryLocation.pdfUrl,
        }
      : undefined,
    cited_by_count: mockWork.citedByCount,
    referenced_works_count: mockWork.referencedWorksCount,
    concepts: mockWork.concepts.map((c) => ({
      id: c.id,
      display_name: c.displayName,
      level: c.level,
      score: c.score,
      wikidata: c.wikidata ? `https://www.wikidata.org/wiki/${c.wikidata}` : undefined,
    })),
    open_access: mockWork.openAccess
      ? {
          is_oa: mockWork.openAccess.isOa,
          oa_url: mockWork.openAccess.oaUrl,
          oa_status: mockWork.openAccess.oaStatus,
        }
      : undefined,
    abstract_inverted_index: {
      This: [0],
      is: [1],
      a: [2],
      test: [3],
      abstract: [4],
      for: [5],
      validating: [6],
      discovery: [7],
      feature: [8],
      integration: [9],
    },
    related_works: mockRelatedWorkIds,
  },

  author: {
    id: mockAuthor.id,
    orcid: mockAuthor.orcid ? `https://orcid.org/${mockAuthor.orcid}` : undefined,
    display_name: mockAuthor.displayName,
    works_count: mockAuthor.worksCount,
    cited_by_count: mockAuthor.citedByCount,
    affiliations: mockAuthor.affiliations.map((a) => ({
      institution: {
        id: a.institution.id,
        display_name: a.institution.displayName,
        ror: a.institution.ror,
      },
      years: [...a.years],
    })),
    x_concepts: mockAuthor.topConcepts.map((c) => ({
      id: c.id,
      display_name: c.displayName,
      level: c.level,
      score: c.score,
      wikidata: c.wikidata ? `https://www.wikidata.org/wiki/${c.wikidata}` : undefined,
    })),
  },

  textClassification: {
    meta: { count: 1, db_response_time_ms: 10, page: 1, per_page: 1 },
    results: [
      {
        id: 'https://openalex.org/W0000000001',
        topics: mockTextClassification.topics.map((t) => ({
          id: t.id,
          display_name: t.displayName,
          subfield: t.subfield ? { id: `subfield-${t.id}`, display_name: t.subfield } : undefined,
          field: t.field ? { id: `field-${t.id}`, display_name: t.field } : undefined,
          domain: t.domain ? { id: `domain-${t.id}`, display_name: t.domain } : undefined,
          score: t.score,
        })),
        concepts: mockTextClassification.concepts.map((c) => ({
          id: c.id,
          display_name: c.displayName,
          level: c.level,
          score: c.score,
          wikidata: c.wikidata ? `https://www.wikidata.org/wiki/${c.wikidata}` : undefined,
        })),
        keywords: mockTextClassification.keywords.map((k) => ({
          keyword: k,
          score: 0.8,
        })),
      },
    ],
  },

  worksSearch: {
    meta: { count: 2, db_response_time_ms: 10, page: 1, per_page: 25 },
    results: mockBatchWorks.map((w) => ({
      id: w.id,
      doi: w.doi ? `https://doi.org/${w.doi}` : undefined,
      title: w.title,
      type: w.type,
      publication_date: w.publicationDate,
      publication_year: w.publicationYear,
      cited_by_count: w.citedByCount,
      referenced_works_count: w.referencedWorksCount,
      concepts: w.concepts.map((c) => ({
        id: c.id,
        display_name: c.displayName,
        level: c.level,
        score: c.score,
      })),
    })),
  },
};

/**
 * Creates a mock fetch function for OpenAlex API.
 */
export function createMockOpenAlexFetch(): (input: string | URL) => Promise<Response> {
  return (input: string | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/works/')) {
      // Single work lookup
      if (url.includes('doi:10.1234/test.2024.001') || url.includes('W2741809807')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockOpenAlexApiResponses.work), { status: 200 })
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ error: 'Work not found' }), { status: 404 })
      );
    }

    if (url.includes('/works?filter=openalex:')) {
      // Batch work lookup
      return Promise.resolve(
        new Response(JSON.stringify(mockOpenAlexApiResponses.worksSearch), { status: 200 })
      );
    }

    if (url.includes('/authors/')) {
      // Author lookup
      if (url.includes('A5023888391') || url.includes('0000-0001-2345-6789')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockOpenAlexApiResponses.author), { status: 200 })
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ error: 'Author not found' }), { status: 404 })
      );
    }

    if (url.includes('/text')) {
      // Text classification
      return Promise.resolve(
        new Response(JSON.stringify(mockOpenAlexApiResponses.textClassification), { status: 200 })
      );
    }

    return Promise.resolve(
      new Response(JSON.stringify({ error: 'Unknown endpoint' }), { status: 404 })
    );
  };
}
