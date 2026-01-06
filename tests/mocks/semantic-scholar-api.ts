/**
 * Mock responses for Semantic Scholar API.
 *
 * @remarks
 * Provides fixture data for testing S2 plugin methods without hitting the real API.
 * All data is fabricated but structurally matches the S2 API responses.
 *
 * @packageDocumentation
 */

import type {
  CitationEdge,
  SemanticScholarAuthor,
  SemanticScholarPaper,
} from '../../src/plugins/builtin/semantic-scholar.js';

/**
 * Sample paper for testing.
 */
export const mockPaper: SemanticScholarPaper = {
  paperId: '649def34f8be52c8b66281af98ae884c09aef38b',
  externalIds: {
    DOI: '10.1234/test.2024.001',
    ArXiv: '2401.12345',
    CorpusId: 123456789,
  },
  title: 'A Test Paper for Discovery Features',
  abstract: 'This is a test abstract for validating discovery feature integration.',
  venue: 'Conference on Testing',
  year: 2024,
  authors: [
    { authorId: '12345678', name: 'Alice Researcher' },
    { authorId: '87654321', name: 'Bob Scientist' },
  ],
  citationCount: 42,
  referenceCount: 23,
  influentialCitationCount: 5,
  openAccessPdf: {
    url: 'https://example.com/paper.pdf',
    status: 'GREEN',
  },
  publicationDate: '2024-01-15',
  fieldsOfStudy: ['Computer Science', 'Linguistics'],
  tldr: { text: 'This paper tests discovery features.' },
  url: 'https://www.semanticscholar.org/paper/649def34f8be52c8b66281af98ae884c09aef38b',
  source: 'semanticscholar',
};

/**
 * Sample author for testing.
 */
export const mockAuthor: SemanticScholarAuthor = {
  authorId: '12345678',
  externalIds: {
    ORCID: '0000-0001-2345-6789',
    DBLP: ['a/Alice_Researcher'],
  },
  name: 'Alice Researcher',
  aliases: ['A. Researcher', 'Alice R.'],
  affiliations: ['Test University'],
  paperCount: 50,
  citationCount: 1000,
  hIndex: 15,
  url: 'https://www.semanticscholar.org/author/12345678',
  source: 'semanticscholar',
};

/**
 * Sample papers for recommendations.
 */
export const mockRecommendations: SemanticScholarPaper[] = [
  {
    paperId: 'rec1',
    externalIds: { DOI: '10.1234/rec.001', ArXiv: '2401.11111' },
    title: 'Related Paper One',
    abstract: 'First recommended paper.',
    year: 2024,
    authors: [{ authorId: '111', name: 'Carol Author' }],
    citationCount: 10,
    referenceCount: 5,
    influentialCitationCount: 2,
    url: 'https://www.semanticscholar.org/paper/rec1',
    source: 'semanticscholar',
  },
  {
    paperId: 'rec2',
    externalIds: { DOI: '10.1234/rec.002' },
    title: 'Related Paper Two',
    abstract: 'Second recommended paper.',
    year: 2023,
    authors: [{ authorId: '222', name: 'David Writer' }],
    citationCount: 25,
    referenceCount: 12,
    influentialCitationCount: 4,
    url: 'https://www.semanticscholar.org/paper/rec2',
    source: 'semanticscholar',
  },
  {
    paperId: 'rec3',
    externalIds: { ArXiv: '2312.99999' },
    title: 'Related Paper Three',
    abstract: 'Third recommended paper with only arXiv ID.',
    year: 2023,
    authors: [{ authorId: '333', name: 'Eve Scholar' }],
    citationCount: 8,
    referenceCount: 20,
    influentialCitationCount: 1,
    url: 'https://www.semanticscholar.org/paper/rec3',
    source: 'semanticscholar',
  },
];

/**
 * Sample citation edges for testing.
 */
export const mockCitations: CitationEdge[] = [
  {
    paper: {
      paperId: 'citing1',
      externalIds: { DOI: '10.1234/citing.001' },
      title: 'A Paper That Cites Our Work',
      year: 2024,
      authors: [{ authorId: '444', name: 'Frank Citer' }],
      citationCount: 5,
      referenceCount: 30,
      influentialCitationCount: 0,
      url: 'https://www.semanticscholar.org/paper/citing1',
      source: 'semanticscholar',
    },
    isInfluential: true,
    intent: ['methodology'],
    contexts: ['We extend the approach of [cited paper] by...'],
  },
  {
    paper: {
      paperId: 'citing2',
      externalIds: { DOI: '10.1234/citing.002' },
      title: 'Another Citing Paper',
      year: 2024,
      authors: [{ authorId: '555', name: 'Grace Referencer' }],
      citationCount: 12,
      referenceCount: 45,
      influentialCitationCount: 2,
      url: 'https://www.semanticscholar.org/paper/citing2',
      source: 'semanticscholar',
    },
    isInfluential: false,
    intent: ['background'],
  },
];

/**
 * Sample references (papers cited by target).
 */
export const mockReferences: CitationEdge[] = [
  {
    paper: {
      paperId: 'ref1',
      externalIds: { DOI: '10.1234/ref.001' },
      title: 'A Foundational Work We Cite',
      year: 2020,
      authors: [{ authorId: '666', name: 'Henry Pioneer' }],
      citationCount: 500,
      referenceCount: 50,
      influentialCitationCount: 100,
      url: 'https://www.semanticscholar.org/paper/ref1',
      source: 'semanticscholar',
    },
    isInfluential: true,
    intent: ['methodology', 'background'],
  },
  {
    paper: {
      paperId: 'ref2',
      externalIds: { DOI: '10.1234/ref.002' },
      title: 'Another Referenced Work',
      year: 2019,
      authors: [{ authorId: '777', name: 'Irene Classic' }],
      citationCount: 200,
      referenceCount: 30,
      influentialCitationCount: 40,
      url: 'https://www.semanticscholar.org/paper/ref2',
      source: 'semanticscholar',
    },
    isInfluential: false,
  },
];

/**
 * Mock S2 API raw responses (before transformation).
 */
export const mockS2ApiResponses = {
  paper: {
    paperId: mockPaper.paperId,
    externalIds: mockPaper.externalIds,
    title: mockPaper.title,
    abstract: mockPaper.abstract,
    venue: mockPaper.venue,
    year: mockPaper.year,
    authors: mockPaper.authors.map((a) => ({
      authorId: a.authorId,
      name: a.name,
    })),
    citationCount: mockPaper.citationCount,
    referenceCount: mockPaper.referenceCount,
    influentialCitationCount: mockPaper.influentialCitationCount,
    openAccessPdf: mockPaper.openAccessPdf,
    publicationDate: mockPaper.publicationDate,
    fieldsOfStudy: mockPaper.fieldsOfStudy,
    tldr: mockPaper.tldr,
    url: mockPaper.url,
  },

  author: {
    authorId: mockAuthor.authorId,
    externalIds: mockAuthor.externalIds,
    name: mockAuthor.name,
    aliases: mockAuthor.aliases,
    affiliations: mockAuthor.affiliations,
    paperCount: mockAuthor.paperCount,
    citationCount: mockAuthor.citationCount,
    hIndex: mockAuthor.hIndex,
    url: mockAuthor.url,
  },

  recommendations: {
    recommendedPapers: mockRecommendations.map((p) => ({
      paperId: p.paperId,
      externalIds: p.externalIds,
      title: p.title,
      abstract: p.abstract,
      year: p.year,
      authors: p.authors,
      citationCount: p.citationCount,
      referenceCount: p.referenceCount,
      influentialCitationCount: p.influentialCitationCount,
      url: p.url,
    })),
  },

  citations: {
    offset: 0,
    next: 2,
    data: mockCitations.map((c) => ({
      citingPaper: {
        paperId: c.paper.paperId,
        externalIds: c.paper.externalIds,
        title: c.paper.title,
        year: c.paper.year,
        authors: c.paper.authors,
        citationCount: c.paper.citationCount,
        referenceCount: c.paper.referenceCount,
        influentialCitationCount: c.paper.influentialCitationCount,
        url: c.paper.url,
      },
      isInfluential: c.isInfluential,
      intents: c.intent,
      contexts: c.contexts,
    })),
  },

  references: {
    offset: 0,
    next: 2,
    data: mockReferences.map((r) => ({
      citedPaper: {
        paperId: r.paper.paperId,
        externalIds: r.paper.externalIds,
        title: r.paper.title,
        year: r.paper.year,
        authors: r.paper.authors,
        citationCount: r.paper.citationCount,
        referenceCount: r.paper.referenceCount,
        influentialCitationCount: r.paper.influentialCitationCount,
        url: r.paper.url,
      },
      isInfluential: r.isInfluential,
      intents: r.intent,
    })),
  },
};

/**
 * Creates a mock fetch function for S2 API.
 */
export function createMockS2Fetch(): (input: string | URL) => Promise<Response> {
  return (input: string | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/paper/')) {
      // Paper lookup
      if (url.includes('DOI:10.1234/test.2024.001') || url.includes(mockPaper.paperId)) {
        return Promise.resolve(
          new Response(JSON.stringify(mockS2ApiResponses.paper), { status: 200 })
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ error: 'Paper not found' }), { status: 404 })
      );
    }

    if (url.includes('/author/')) {
      // Author lookup
      if (url.includes(mockAuthor.authorId)) {
        return Promise.resolve(
          new Response(JSON.stringify(mockS2ApiResponses.author), { status: 200 })
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ error: 'Author not found' }), { status: 404 })
      );
    }

    if (url.includes('/recommendations')) {
      // Recommendations endpoint
      return Promise.resolve(
        new Response(JSON.stringify(mockS2ApiResponses.recommendations), { status: 200 })
      );
    }

    if (url.includes('/citations')) {
      return Promise.resolve(
        new Response(JSON.stringify(mockS2ApiResponses.citations), { status: 200 })
      );
    }

    if (url.includes('/references')) {
      return Promise.resolve(
        new Response(JSON.stringify(mockS2ApiResponses.references), { status: 200 })
      );
    }

    return Promise.resolve(
      new Response(JSON.stringify({ error: 'Unknown endpoint' }), { status: 404 })
    );
  };
}
