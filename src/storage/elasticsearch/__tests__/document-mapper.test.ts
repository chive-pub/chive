/**
 * Unit tests for document mapper.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import type { AtUri, BlobRef, CID, DID, Timestamp } from '../../../types/atproto.js';
import type { Facet } from '../../../types/interfaces/graph.interface.js';
import type { EprintAuthor } from '../../../types/models/author.js';
import type { Eprint } from '../../../types/models/eprint.js';
import type { EnrichmentData } from '../document-mapper.js';
import { mapEprintToDocument } from '../document-mapper.js';

describe('mapEprintToDocument', () => {
  const mockBlobRef: BlobRef = {
    $type: 'blob',
    ref: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi' as CID,
    mimeType: 'application/pdf',
    size: 1024000,
  };

  const mockFacets: Facet[] = [
    { dimension: 'matter', value: 'Computer Science' },
    { dimension: 'matter', value: 'Machine Learning' },
    { dimension: 'energy', value: 'Neural Networks' },
    { dimension: 'space', value: 'Global' },
    { dimension: 'time', value: '2020s' },
    { dimension: 'personality', value: 'Applied' },
    { dimension: 'event', value: 'NeurIPS 2024' },
    { dimension: 'form', value: 'Research Article' },
    {
      dimension: 'topical',
      value: 'Natural Language Processing',
      authorityRecordId: 'http://id.loc.gov/authorities/subjects/sh2007002463',
    },
  ];

  const mockAuthors: EprintAuthor[] = [
    {
      did: 'did:plc:abc123' as DID,
      name: 'Jane Smith',
      orcid: '0000-0001-2345-6789',
      email: 'jane@example.edu',
      order: 1,
      affiliations: [{ name: 'University of Example', rorId: 'https://ror.org/02mhbdp94' }],
      contributions: [
        {
          typeUri: 'at://did:plc:governance/pub.chive.contribution.type/conceptualization' as AtUri,
          typeId: 'conceptualization',
          typeLabel: 'Conceptualization',
          degree: 'lead',
        },
      ],
      isCorrespondingAuthor: true,
      isHighlighted: true,
    },
    {
      did: 'did:plc:def456' as DID,
      name: 'John Doe',
      order: 2,
      affiliations: [],
      contributions: [],
      isCorrespondingAuthor: false,
      isHighlighted: false,
    },
    {
      did: 'did:plc:ghi789' as DID,
      name: 'Bob Wilson',
      order: 3,
      affiliations: [],
      contributions: [],
      isCorrespondingAuthor: false,
      isHighlighted: false,
    },
  ];

  const mockEprint: Eprint = {
    uri: 'at://did:plc:abc123/pub.chive.eprint/3jzfcijpj2z2a' as AtUri,
    cid: 'bafyreid27zk7lbis4zw5fz4podbvbs4fc5ivwji3dmrwa6zggnj4bnd57u' as CID,
    authors: mockAuthors,
    submittedBy: 'did:plc:abc123' as DID,
    title: 'Advances in Neural Machine Translation',
    abstract:
      'This paper presents novel approaches to neural machine translation using transformer architectures with attention mechanisms.',
    documentBlobRef: mockBlobRef,
    documentFormat: 'pdf',
    publicationStatus: 'eprint',
    keywords: ['machine learning', 'NMT', 'transformers'],
    facets: mockFacets,
    version: 1,
    license: 'CC-BY-4.0',
    createdAt: 1704067200000 as Timestamp,
  };

  describe('basic mapping', () => {
    it('should map eprint to document', () => {
      const document = mapEprintToDocument(mockEprint, 'https://example.pds.host');

      expect(document.uri).toBe(mockEprint.uri);
      expect(document.cid).toBe(mockEprint.cid);
      expect(document.rkey).toBe('3jzfcijpj2z2a');
      expect(document.title).toBe(mockEprint.title);
      expect(document.abstract).toBe(mockEprint.abstract);
      expect(document.license).toBe(mockEprint.license);
      expect(document.version).toBe(1);
      expect(document.pds_url).toBe('https://example.pds.host');
      expect(document.pds_endpoint).toBe('example.pds.host');
    });

    it('should convert timestamp to ISO 8601', () => {
      const document = mapEprintToDocument(mockEprint, 'https://example.pds.host');

      expect(document.created_at).toBe('2024-01-01T00:00:00.000Z');
      expect(document.updated_at).toBeUndefined();
    });

    it('should include updated timestamp if present', () => {
      const eprintWithUpdate: Eprint = {
        ...mockEprint,
        updatedAt: 1704153600000 as Timestamp,
      };

      const document = mapEprintToDocument(eprintWithUpdate, 'https://example.pds.host');

      expect(document.updated_at).toBe('2024-01-02T00:00:00.000Z');
    });

    it('should extract rkey from AT-URI', () => {
      const document = mapEprintToDocument(mockEprint, 'https://example.pds.host');

      expect(document.rkey).toBe('3jzfcijpj2z2a');
    });

    it('should handle previous version URI', () => {
      const eprintWithPrevious: Eprint = {
        ...mockEprint,
        previousVersionUri: 'at://did:plc:abc123/pub.chive.eprint/3jzfcijpj2z2b' as AtUri,
      };

      const document = mapEprintToDocument(eprintWithPrevious, 'https://example.pds.host');

      expect(document.previous_version).toBe(eprintWithPrevious.previousVersionUri);
    });
  });

  describe('author mapping', () => {
    it('should map single author', () => {
      const singleAuthor: EprintAuthor = {
        did: 'did:plc:abc123' as DID,
        name: 'Jane Smith',
        order: 1,
        affiliations: [],
        contributions: [],
        isCorrespondingAuthor: true,
        isHighlighted: false,
      };

      const singleAuthorEprint: Eprint = {
        ...mockEprint,
        authors: [singleAuthor],
      };

      const document = mapEprintToDocument(singleAuthorEprint, 'https://example.pds.host');

      expect(document.authors).toBeDefined();
      expect(document.authors).toHaveLength(1);
      expect(document.authors?.[0]?.did).toBe('did:plc:abc123');
      expect(document.authors?.[0]?.name).toBe('Jane Smith');
      expect(document.authors?.[0]?.order).toBe(1);
    });

    it('should map multiple authors', () => {
      const document = mapEprintToDocument(mockEprint, 'https://example.pds.host');

      expect(document.authors).toBeDefined();
      expect(document.authors).toHaveLength(3);

      expect(document.authors?.[0]?.did).toBe('did:plc:abc123');
      expect(document.authors?.[0]?.name).toBe('Jane Smith');
      expect(document.authors?.[0]?.order).toBe(1);

      expect(document.authors?.[1]?.did).toBe('did:plc:def456');
      expect(document.authors?.[1]?.name).toBe('John Doe');
      expect(document.authors?.[1]?.order).toBe(2);

      expect(document.authors?.[2]?.did).toBe('did:plc:ghi789');
      expect(document.authors?.[2]?.name).toBe('Bob Wilson');
      expect(document.authors?.[2]?.order).toBe(3);
    });

    it('should map author metadata', () => {
      const document = mapEprintToDocument(mockEprint, 'https://example.pds.host');

      // First author should have full metadata
      expect(document.authors?.[0]?.orcid).toBe('0000-0001-2345-6789');
      expect(document.authors?.[0]?.email).toBe('jane@example.edu');
      expect(document.authors?.[0]?.isCorrespondingAuthor).toBe(true);
      expect(document.authors?.[0]?.isHighlighted).toBe(true);
    });
  });

  describe('keyword mapping', () => {
    it('should map keywords', () => {
      const document = mapEprintToDocument(mockEprint, 'https://example.pds.host');

      expect(document.keywords).toBeDefined();
      expect(document.keywords).toHaveLength(3);
      expect(document.keywords).toContain('machine learning');
      expect(document.keywords).toContain('NMT');
      expect(document.keywords).toContain('transformers');
    });

    it('should handle empty keywords array', () => {
      const eprintNoKeywords: Eprint = {
        ...mockEprint,
        keywords: [],
      };

      const document = mapEprintToDocument(eprintNoKeywords, 'https://example.pds.host');

      expect(document.keywords).toEqual([]);
    });
  });

  describe('facet mapping', () => {
    it('should extract field nodes from matter and topical dimensions', () => {
      const document = mapEprintToDocument(mockEprint, 'https://example.pds.host');

      expect(document.field_nodes).toBeDefined();
      expect(document.field_nodes).toContain('Computer Science');
      expect(document.field_nodes).toContain('Machine Learning');
      expect(document.field_nodes).toContain('Natural Language Processing');
    });

    it('should extract primary field', () => {
      const document = mapEprintToDocument(mockEprint, 'https://example.pds.host');

      expect(document.primary_field).toBe('Computer Science');
    });

    it('should map facets to 10-dimensional structure', () => {
      const document = mapEprintToDocument(mockEprint, 'https://example.pds.host');

      expect(document.facets).toBeDefined();
      expect(document.facets?.matter).toContain('Computer Science');
      expect(document.facets?.matter).toContain('Machine Learning');
      expect(document.facets?.energy).toContain('Neural Networks');
      expect(document.facets?.space).toContain('Global');
      expect(document.facets?.time).toContain('2020s');
      expect(document.facets?.personality).toContain('Applied');
      expect(document.facets?.event).toContain('NeurIPS 2024');
      expect(document.facets?.form_genre).toContain('Research Article');
    });

    it('should map geographic dimension to space', () => {
      const eprintWithGeographic: Eprint = {
        ...mockEprint,
        facets: [{ dimension: 'geographic', value: 'North America' }],
      };

      const document = mapEprintToDocument(eprintWithGeographic, 'https://example.pds.host');

      expect(document.facets?.space).toContain('North America');
    });

    it('should map chronological dimension to time', () => {
      const eprintWithChronological: Eprint = {
        ...mockEprint,
        facets: [{ dimension: 'chronological', value: '21st Century' }],
      };

      const document = mapEprintToDocument(eprintWithChronological, 'https://example.pds.host');

      expect(document.facets?.time).toContain('21st Century');
    });

    it('should map topical dimension to matter when no matter facets', () => {
      const eprintWithTopical: Eprint = {
        ...mockEprint,
        facets: [{ dimension: 'topical', value: 'Natural Language Processing' }],
      };

      const document = mapEprintToDocument(eprintWithTopical, 'https://example.pds.host');

      expect(document.facets?.matter).toContain('Natural Language Processing');
    });

    it('should handle empty facets', () => {
      const eprintNoFacets: Eprint = {
        ...mockEprint,
        facets: [],
      };

      const document = mapEprintToDocument(eprintNoFacets, 'https://example.pds.host');

      expect(document.field_nodes).toBeUndefined();
      expect(document.primary_field).toBeUndefined();
      expect(document.facets?.matter).toBeUndefined();
    });
  });

  describe('authority mapping', () => {
    it('should extract authority-controlled terms', () => {
      const document = mapEprintToDocument(mockEprint, 'https://example.pds.host');

      expect(document.authorities).toBeDefined();
      expect(document.authorities).toContain('Natural Language Processing');
    });

    it('should extract authority record URIs', () => {
      const document = mapEprintToDocument(mockEprint, 'https://example.pds.host');

      expect(document.authority_uris).toBeDefined();
      expect(document.authority_uris).toContain(
        'http://id.loc.gov/authorities/subjects/sh2007002463'
      );
    });

    it('should handle facets without authorities', () => {
      const eprintNoAuthorities: Eprint = {
        ...mockEprint,
        facets: [{ dimension: 'matter', value: 'Computer Science' }],
      };

      const document = mapEprintToDocument(eprintNoAuthorities, 'https://example.pds.host');

      expect(document.authorities).toBeUndefined();
      expect(document.authority_uris).toBeUndefined();
    });
  });

  describe('document metadata mapping', () => {
    it('should map BlobRef to document metadata', () => {
      const document = mapEprintToDocument(mockEprint, 'https://example.pds.host');

      expect(document.document_metadata).toBeDefined();
      expect(document.document_metadata?.file_size).toBe(1024000);
      expect(document.document_metadata?.content_type).toBe('application/pdf');
      expect(document.document_metadata?.page_count).toBeUndefined();
    });

    it('should map BlobRef to document_blob_ref', () => {
      const document = mapEprintToDocument(mockEprint, 'https://example.pds.host');

      expect(document.document_blob_ref).toBeDefined();
      expect(document.document_blob_ref?.cid).toBe(mockBlobRef.ref);
      expect(document.document_blob_ref?.mime_type).toBe(mockBlobRef.mimeType);
      expect(document.document_blob_ref?.size).toBe(mockBlobRef.size);
    });

    it('should not include blob data by default', () => {
      const document = mapEprintToDocument(mockEprint, 'https://example.pds.host');

      expect(document.document_base64).toBeUndefined();
    });
  });

  describe('PDS tracking', () => {
    it('should store PDS URL', () => {
      const document = mapEprintToDocument(mockEprint, 'https://example.pds.host:3000');

      expect(document.pds_url).toBe('https://example.pds.host:3000');
    });

    it('should extract PDS endpoint', () => {
      const document = mapEprintToDocument(mockEprint, 'https://example.pds.host:3000');

      expect(document.pds_endpoint).toBe('example.pds.host:3000');
    });

    it('should handle PDS URL without port', () => {
      const document = mapEprintToDocument(mockEprint, 'https://example.pds.host');

      expect(document.pds_endpoint).toBe('example.pds.host');
    });

    it('should handle invalid PDS URL', () => {
      const document = mapEprintToDocument(mockEprint, 'not-a-url');

      expect(document.pds_endpoint).toBe('not-a-url');
    });
  });

  describe('enrichment data', () => {
    it('should include citation count from enrichment', () => {
      const enrichment: EnrichmentData = {
        citationCount: 42,
        endorsementCount: 10,
        viewCount: 1000,
        downloadCount: 250,
      };

      const document = mapEprintToDocument(mockEprint, 'https://example.pds.host', enrichment);

      expect(document.citation_count).toBe(42);
      expect(document.endorsement_count).toBe(10);
      expect(document.view_count).toBe(1000);
      expect(document.download_count).toBe(250);
    });

    it('should default counts to zero when no enrichment', () => {
      const document = mapEprintToDocument(mockEprint, 'https://example.pds.host');

      expect(document.citation_count).toBe(0);
      expect(document.endorsement_count).toBe(0);
      expect(document.view_count).toBe(0);
      expect(document.download_count).toBe(0);
    });

    it('should include tags from enrichment', () => {
      const enrichment: EnrichmentData = {
        tags: ['ml', 'nlp', 'transformers'],
      };

      const document = mapEprintToDocument(mockEprint, 'https://example.pds.host', enrichment);

      expect(document.tags).toBeDefined();
      expect(document.tags).toContain('ml');
      expect(document.tags).toContain('nlp');
      expect(document.tags).toContain('transformers');
      expect(document.tag_count).toBe(3);
    });

    it('should set tag count to zero when no tags', () => {
      const document = mapEprintToDocument(mockEprint, 'https://example.pds.host');

      expect(document.tags).toBeUndefined();
      expect(document.tag_count).toBe(0);
    });

    it('should include document base64 from enrichment', () => {
      const enrichment: EnrichmentData = {
        documentBase64: 'JVBERi0xLjQKJeLjz9MK...',
      };

      const document = mapEprintToDocument(mockEprint, 'https://example.pds.host', enrichment);

      expect(document.document_base64).toBe('JVBERi0xLjQKJeLjz9MK...');
    });

    it('should handle partial enrichment data', () => {
      const enrichment: EnrichmentData = {
        citationCount: 5,
      };

      const document = mapEprintToDocument(mockEprint, 'https://example.pds.host', enrichment);

      expect(document.citation_count).toBe(5);
      expect(document.endorsement_count).toBe(0);
      expect(document.view_count).toBe(0);
      expect(document.download_count).toBe(0);
      expect(document.tags).toBeUndefined();
      expect(document.tag_count).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle minimal eprint', () => {
      const minimalAuthor: EprintAuthor = {
        did: 'did:plc:test' as DID,
        name: 'Test Author',
        order: 1,
        affiliations: [],
        contributions: [],
        isCorrespondingAuthor: true,
        isHighlighted: false,
      };

      const minimalEprint: Eprint = {
        uri: 'at://did:plc:test/pub.chive.eprint/abc' as AtUri,
        cid: 'bafytest' as CID,
        authors: [minimalAuthor],
        submittedBy: 'did:plc:test' as DID,
        title: 'Test',
        abstract: 'Abstract',
        documentBlobRef: mockBlobRef,
        documentFormat: 'pdf',
        publicationStatus: 'eprint',
        keywords: [],
        facets: [],
        version: 1,
        license: 'CC-BY-4.0',
        createdAt: 1704067200000 as Timestamp,
      };

      const document = mapEprintToDocument(minimalEprint, 'https://example.pds.host');

      expect(document.uri).toBe(minimalEprint.uri);
      expect(document.authors).toHaveLength(1);
      expect(document.keywords).toEqual([]);
      expect(document.field_nodes).toBeUndefined();
      expect(document.previous_version).toBeUndefined();
      expect(document.updated_at).toBeUndefined();
    });

    it('should handle URI with multiple slashes', () => {
      const eprintComplexUri: Eprint = {
        ...mockEprint,
        uri: 'at://did:plc:abc123/com.example.record/pub.chive.eprint/tid' as AtUri,
      };

      const document = mapEprintToDocument(eprintComplexUri, 'https://example.pds.host');

      expect(document.rkey).toBe('tid');
    });

    it('should handle empty rkey extraction', () => {
      const eprintNoRkey: Eprint = {
        ...mockEprint,
        uri: 'at://did:plc:abc123/' as AtUri,
      };

      const document = mapEprintToDocument(eprintNoRkey, 'https://example.pds.host');

      expect(document.rkey).toBe('');
    });

    it('should set DOI to undefined', () => {
      const document = mapEprintToDocument(mockEprint, 'https://example.pds.host');

      expect(document.doi).toBeUndefined();
    });

    it('should handle supplementary materials', () => {
      const eprintWithSupplementary: Eprint = {
        ...mockEprint,
        supplementaryMaterials: [
          {
            blobRef: {
              $type: 'blob',
              ref: 'bafysupplementary1' as CID,
              mimeType: 'text/csv',
              size: 50000,
            },
            label: 'Dataset 1',
            description: 'Raw experimental data',
            category: 'dataset',
            order: 1,
          },
          {
            blobRef: {
              $type: 'blob',
              ref: 'bafysupplementary2' as CID,
              mimeType: 'application/zip',
              size: 250000,
            },
            label: 'Code Archive',
            description: 'Analysis scripts',
            category: 'code',
            order: 2,
          },
        ],
      };

      const document = mapEprintToDocument(eprintWithSupplementary, 'https://example.pds.host');

      expect(document).toBeDefined();
      expect(document.supplementary_count).toBe(2);
      expect(document.supplementary_materials).toHaveLength(2);
    });
  });
});
