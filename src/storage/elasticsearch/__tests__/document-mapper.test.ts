/**
 * Unit tests for document mapper.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import type { AtUri, BlobRef, CID, DID, Timestamp } from '../../../types/atproto.js';
import type { Facet } from '../../../types/interfaces/graph.interface.js';
import type { Preprint } from '../../../types/models/preprint.js';
import type { EnrichmentData } from '../document-mapper.js';
import { mapPreprintToDocument } from '../document-mapper.js';

describe('mapPreprintToDocument', () => {
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

  const mockPreprint: Preprint = {
    uri: 'at://did:plc:abc123/pub.chive.preprint/3jzfcijpj2z2a' as AtUri,
    cid: 'bafyreid27zk7lbis4zw5fz4podbvbs4fc5ivwji3dmrwa6zggnj4bnd57u' as CID,
    author: 'did:plc:abc123' as DID,
    coAuthors: ['did:plc:def456' as DID, 'did:plc:ghi789' as DID],
    title: 'Advances in Neural Machine Translation',
    abstract:
      'This paper presents novel approaches to neural machine translation using transformer architectures with attention mechanisms.',
    pdfBlobRef: mockBlobRef,
    keywords: ['machine learning', 'NMT', 'transformers'],
    facets: mockFacets,
    version: 1,
    license: 'CC-BY-4.0',
    createdAt: 1704067200000 as Timestamp,
  };

  describe('basic mapping', () => {
    it('should map preprint to document', () => {
      const document = mapPreprintToDocument(mockPreprint, 'https://example.pds.host');

      expect(document.uri).toBe(mockPreprint.uri);
      expect(document.cid).toBe(mockPreprint.cid);
      expect(document.rkey).toBe('3jzfcijpj2z2a');
      expect(document.title).toBe(mockPreprint.title);
      expect(document.abstract).toBe(mockPreprint.abstract);
      expect(document.license).toBe(mockPreprint.license);
      expect(document.version).toBe(1);
      expect(document.pds_url).toBe('https://example.pds.host');
      expect(document.pds_endpoint).toBe('example.pds.host');
    });

    it('should convert timestamp to ISO 8601', () => {
      const document = mapPreprintToDocument(mockPreprint, 'https://example.pds.host');

      expect(document.created_at).toBe('2024-01-01T00:00:00.000Z');
      expect(document.updated_at).toBeUndefined();
    });

    it('should include updated timestamp if present', () => {
      const preprintWithUpdate: Preprint = {
        ...mockPreprint,
        updatedAt: 1704153600000 as Timestamp,
      };

      const document = mapPreprintToDocument(preprintWithUpdate, 'https://example.pds.host');

      expect(document.updated_at).toBe('2024-01-02T00:00:00.000Z');
    });

    it('should extract rkey from AT-URI', () => {
      const document = mapPreprintToDocument(mockPreprint, 'https://example.pds.host');

      expect(document.rkey).toBe('3jzfcijpj2z2a');
    });

    it('should handle previous version URI', () => {
      const preprintWithPrevious: Preprint = {
        ...mockPreprint,
        previousVersionUri: 'at://did:plc:abc123/pub.chive.preprint/3jzfcijpj2z2b' as AtUri,
      };

      const document = mapPreprintToDocument(preprintWithPrevious, 'https://example.pds.host');

      expect(document.previous_version).toBe(preprintWithPrevious.previousVersionUri);
    });
  });

  describe('author mapping', () => {
    it('should map primary author', () => {
      const singleAuthorPreprint: Preprint = {
        ...mockPreprint,
        coAuthors: undefined,
      };

      const document = mapPreprintToDocument(singleAuthorPreprint, 'https://example.pds.host');

      expect(document.authors).toBeDefined();
      expect(document.authors).toHaveLength(1);
      expect(document.authors?.[0]?.did).toBe('did:plc:abc123');
      expect(document.authors?.[0]?.name).toBe('did:plc:abc123');
      expect(document.authors?.[0]?.order).toBe(0);
    });

    it('should map co-authors', () => {
      const document = mapPreprintToDocument(mockPreprint, 'https://example.pds.host');

      expect(document.authors).toBeDefined();
      expect(document.authors).toHaveLength(3);

      expect(document.authors?.[0]?.did).toBe('did:plc:abc123');
      expect(document.authors?.[0]?.order).toBe(0);

      expect(document.authors?.[1]?.did).toBe('did:plc:def456');
      expect(document.authors?.[1]?.order).toBe(1);

      expect(document.authors?.[2]?.did).toBe('did:plc:ghi789');
      expect(document.authors?.[2]?.order).toBe(2);
    });

    it('should use DID as placeholder name', () => {
      const document = mapPreprintToDocument(mockPreprint, 'https://example.pds.host');

      expect(document.authors?.[0]?.name).toBe(document.authors?.[0]?.did);
      expect(document.authors?.[1]?.name).toBe(document.authors?.[1]?.did);
    });
  });

  describe('keyword mapping', () => {
    it('should map keywords', () => {
      const document = mapPreprintToDocument(mockPreprint, 'https://example.pds.host');

      expect(document.keywords).toBeDefined();
      expect(document.keywords).toHaveLength(3);
      expect(document.keywords).toContain('machine learning');
      expect(document.keywords).toContain('NMT');
      expect(document.keywords).toContain('transformers');
    });

    it('should handle empty keywords array', () => {
      const preprintNoKeywords: Preprint = {
        ...mockPreprint,
        keywords: [],
      };

      const document = mapPreprintToDocument(preprintNoKeywords, 'https://example.pds.host');

      expect(document.keywords).toEqual([]);
    });
  });

  describe('facet mapping', () => {
    it('should extract field nodes from matter and topical dimensions', () => {
      const document = mapPreprintToDocument(mockPreprint, 'https://example.pds.host');

      expect(document.field_nodes).toBeDefined();
      expect(document.field_nodes).toContain('Computer Science');
      expect(document.field_nodes).toContain('Machine Learning');
      expect(document.field_nodes).toContain('Natural Language Processing');
    });

    it('should extract primary field', () => {
      const document = mapPreprintToDocument(mockPreprint, 'https://example.pds.host');

      expect(document.primary_field).toBe('Computer Science');
    });

    it('should map facets to 10-dimensional structure', () => {
      const document = mapPreprintToDocument(mockPreprint, 'https://example.pds.host');

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
      const preprintWithGeographic: Preprint = {
        ...mockPreprint,
        facets: [{ dimension: 'geographic', value: 'North America' }],
      };

      const document = mapPreprintToDocument(preprintWithGeographic, 'https://example.pds.host');

      expect(document.facets?.space).toContain('North America');
    });

    it('should map chronological dimension to time', () => {
      const preprintWithChronological: Preprint = {
        ...mockPreprint,
        facets: [{ dimension: 'chronological', value: '21st Century' }],
      };

      const document = mapPreprintToDocument(preprintWithChronological, 'https://example.pds.host');

      expect(document.facets?.time).toContain('21st Century');
    });

    it('should map topical dimension to matter when no matter facets', () => {
      const preprintWithTopical: Preprint = {
        ...mockPreprint,
        facets: [{ dimension: 'topical', value: 'Natural Language Processing' }],
      };

      const document = mapPreprintToDocument(preprintWithTopical, 'https://example.pds.host');

      expect(document.facets?.matter).toContain('Natural Language Processing');
    });

    it('should handle empty facets', () => {
      const preprintNoFacets: Preprint = {
        ...mockPreprint,
        facets: [],
      };

      const document = mapPreprintToDocument(preprintNoFacets, 'https://example.pds.host');

      expect(document.field_nodes).toBeUndefined();
      expect(document.primary_field).toBeUndefined();
      expect(document.facets?.matter).toBeUndefined();
    });
  });

  describe('authority mapping', () => {
    it('should extract authority-controlled terms', () => {
      const document = mapPreprintToDocument(mockPreprint, 'https://example.pds.host');

      expect(document.authorities).toBeDefined();
      expect(document.authorities).toContain('Natural Language Processing');
    });

    it('should extract authority record URIs', () => {
      const document = mapPreprintToDocument(mockPreprint, 'https://example.pds.host');

      expect(document.authority_uris).toBeDefined();
      expect(document.authority_uris).toContain(
        'http://id.loc.gov/authorities/subjects/sh2007002463'
      );
    });

    it('should handle facets without authorities', () => {
      const preprintNoAuthorities: Preprint = {
        ...mockPreprint,
        facets: [{ dimension: 'matter', value: 'Computer Science' }],
      };

      const document = mapPreprintToDocument(preprintNoAuthorities, 'https://example.pds.host');

      expect(document.authorities).toBeUndefined();
      expect(document.authority_uris).toBeUndefined();
    });
  });

  describe('PDF metadata mapping', () => {
    it('should map BlobRef to PDF metadata', () => {
      const document = mapPreprintToDocument(mockPreprint, 'https://example.pds.host');

      expect(document.pdf_metadata).toBeDefined();
      expect(document.pdf_metadata?.file_size).toBe(1024000);
      expect(document.pdf_metadata?.content_type).toBe('application/pdf');
      expect(document.pdf_metadata?.page_count).toBeUndefined();
    });

    it('should map BlobRef to document structure', () => {
      const document = mapPreprintToDocument(mockPreprint, 'https://example.pds.host');

      expect(document.pdf_blob_ref).toBeDefined();
      expect(document.pdf_blob_ref?.cid).toBe(mockBlobRef.ref);
      expect(document.pdf_blob_ref?.mime_type).toBe(mockBlobRef.mimeType);
      expect(document.pdf_blob_ref?.size).toBe(mockBlobRef.size);
    });

    it('should not include blob data', () => {
      const document = mapPreprintToDocument(mockPreprint, 'https://example.pds.host');

      expect(document.pdf_base64).toBeUndefined();
    });
  });

  describe('PDS tracking', () => {
    it('should store PDS URL', () => {
      const document = mapPreprintToDocument(mockPreprint, 'https://example.pds.host:3000');

      expect(document.pds_url).toBe('https://example.pds.host:3000');
    });

    it('should extract PDS endpoint', () => {
      const document = mapPreprintToDocument(mockPreprint, 'https://example.pds.host:3000');

      expect(document.pds_endpoint).toBe('example.pds.host:3000');
    });

    it('should handle PDS URL without port', () => {
      const document = mapPreprintToDocument(mockPreprint, 'https://example.pds.host');

      expect(document.pds_endpoint).toBe('example.pds.host');
    });

    it('should handle invalid PDS URL', () => {
      const document = mapPreprintToDocument(mockPreprint, 'not-a-url');

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

      const document = mapPreprintToDocument(mockPreprint, 'https://example.pds.host', enrichment);

      expect(document.citation_count).toBe(42);
      expect(document.endorsement_count).toBe(10);
      expect(document.view_count).toBe(1000);
      expect(document.download_count).toBe(250);
    });

    it('should default counts to zero when no enrichment', () => {
      const document = mapPreprintToDocument(mockPreprint, 'https://example.pds.host');

      expect(document.citation_count).toBe(0);
      expect(document.endorsement_count).toBe(0);
      expect(document.view_count).toBe(0);
      expect(document.download_count).toBe(0);
    });

    it('should include tags from enrichment', () => {
      const enrichment: EnrichmentData = {
        tags: ['ml', 'nlp', 'transformers'],
      };

      const document = mapPreprintToDocument(mockPreprint, 'https://example.pds.host', enrichment);

      expect(document.tags).toBeDefined();
      expect(document.tags).toContain('ml');
      expect(document.tags).toContain('nlp');
      expect(document.tags).toContain('transformers');
      expect(document.tag_count).toBe(3);
    });

    it('should set tag count to zero when no tags', () => {
      const document = mapPreprintToDocument(mockPreprint, 'https://example.pds.host');

      expect(document.tags).toBeUndefined();
      expect(document.tag_count).toBe(0);
    });

    it('should include PDF base64 from enrichment', () => {
      const enrichment: EnrichmentData = {
        pdfBase64: 'JVBERi0xLjQKJeLjz9MK...',
      };

      const document = mapPreprintToDocument(mockPreprint, 'https://example.pds.host', enrichment);

      expect(document.pdf_base64).toBe('JVBERi0xLjQKJeLjz9MK...');
    });

    it('should handle partial enrichment data', () => {
      const enrichment: EnrichmentData = {
        citationCount: 5,
      };

      const document = mapPreprintToDocument(mockPreprint, 'https://example.pds.host', enrichment);

      expect(document.citation_count).toBe(5);
      expect(document.endorsement_count).toBe(0);
      expect(document.view_count).toBe(0);
      expect(document.download_count).toBe(0);
      expect(document.tags).toBeUndefined();
      expect(document.tag_count).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle minimal preprint', () => {
      const minimalPreprint: Preprint = {
        uri: 'at://did:plc:test/pub.chive.preprint/abc' as AtUri,
        cid: 'bafytest' as CID,
        author: 'did:plc:test' as DID,
        title: 'Test',
        abstract: 'Abstract',
        pdfBlobRef: mockBlobRef,
        keywords: [],
        facets: [],
        version: 1,
        license: 'CC-BY-4.0',
        createdAt: 1704067200000 as Timestamp,
      };

      const document = mapPreprintToDocument(minimalPreprint, 'https://example.pds.host');

      expect(document.uri).toBe(minimalPreprint.uri);
      expect(document.authors).toHaveLength(1);
      expect(document.keywords).toEqual([]);
      expect(document.field_nodes).toBeUndefined();
      expect(document.previous_version).toBeUndefined();
      expect(document.updated_at).toBeUndefined();
    });

    it('should handle URI with multiple slashes', () => {
      const preprintComplexUri: Preprint = {
        ...mockPreprint,
        uri: 'at://did:plc:abc123/com.example.record/pub.chive.preprint/tid' as AtUri,
      };

      const document = mapPreprintToDocument(preprintComplexUri, 'https://example.pds.host');

      expect(document.rkey).toBe('tid');
    });

    it('should handle empty rkey extraction', () => {
      const preprintNoRkey: Preprint = {
        ...mockPreprint,
        uri: 'at://did:plc:abc123/' as AtUri,
      };

      const document = mapPreprintToDocument(preprintNoRkey, 'https://example.pds.host');

      expect(document.rkey).toBe('');
    });

    it('should set DOI to undefined', () => {
      const document = mapPreprintToDocument(mockPreprint, 'https://example.pds.host');

      expect(document.doi).toBeUndefined();
    });

    it('should handle supplementary blob refs', () => {
      const preprintWithSupplementary: Preprint = {
        ...mockPreprint,
        supplementaryBlobRefs: [
          {
            $type: 'blob',
            ref: 'bafysupplementary1' as CID,
            mimeType: 'text/csv',
            size: 50000,
          },
          {
            $type: 'blob',
            ref: 'bafysupplementary2' as CID,
            mimeType: 'application/zip',
            size: 250000,
          },
        ],
      };

      const document = mapPreprintToDocument(preprintWithSupplementary, 'https://example.pds.host');

      expect(document).toBeDefined();
    });
  });
});
