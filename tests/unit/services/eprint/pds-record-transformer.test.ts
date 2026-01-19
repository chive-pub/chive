/**
 * Unit tests for PDS record transformer.
 *
 * @remarks
 * Tests the transformation from PDS eprint records (what frontend writes)
 * to the internal Eprint domain model (what backend expects).
 */

import { describe, it, expect } from 'vitest';

import { transformPDSRecord, isPDSEprintRecord } from '@/services/eprint/pds-record-transformer.js';
import type { AtUri, CID } from '@/types/atproto.js';
import { ValidationError } from '@/types/errors.js';

// =============================================================================
// TEST DATA
// =============================================================================

/**
 * Creates a minimal valid PDS eprint record.
 */
function createMockPDSRecord(overrides?: Record<string, unknown>) {
  return {
    $type: 'pub.chive.eprint.submission',
    title: 'Test Paper: A Study in Testing',
    document: {
      $type: 'blob',
      ref: { $link: 'bafkreiabc123def456' },
      mimeType: 'application/pdf',
      size: 1234567,
    },
    authors: [
      {
        name: 'Alice Researcher',
        order: 1,
        did: 'did:plc:author123',
        email: 'alice@example.com',
        orcid: '0000-0002-1825-0097',
        affiliations: [
          {
            name: 'University of Testing',
            rorId: 'https://ror.org/03yrm5c26',
            department: 'Department of Verification',
          },
        ],
        contributions: [
          {
            typeUri: 'at://did:plc:gov/pub.chive.graph.concept/conceptualization',
            typeId: 'conceptualization',
            typeLabel: 'Conceptualization',
            degree: 'lead',
          },
        ],
        isCorrespondingAuthor: true,
        isHighlighted: false,
      },
    ],
    createdAt: '2026-01-18T12:00:00.000Z',
    submittedBy: 'did:plc:submitter456',
    abstract: 'This is a test abstract for a test paper.',
    documentFormat: 'pdf',
    keywords: ['testing', 'unit tests', 'vitest'],
    license: 'CC-BY-4.0',
    facets: [
      { dimension: 'matter', label: 'Computer Science', value: 'computer-science' },
      { dimension: 'personality', label: 'Testing', value: 'testing' },
    ],
    ...overrides,
  };
}

const mockUri = 'at://did:plc:test/pub.chive.eprint.submission/abc123' as AtUri;
const mockCid = 'bafyreicid123456789' as CID;

// =============================================================================
// TRANSFORMATION TESTS
// =============================================================================

describe('transformPDSRecord', () => {
  describe('required fields', () => {
    it('transforms document to documentBlobRef', () => {
      const pdsRecord = createMockPDSRecord();
      const result = transformPDSRecord(pdsRecord, mockUri, mockCid);

      expect(result.documentBlobRef).toBeDefined();
      expect(result.documentBlobRef.$type).toBe('blob');
      expect(result.documentBlobRef.ref).toBe('bafkreiabc123def456');
      expect(result.documentBlobRef.mimeType).toBe('application/pdf');
      expect(result.documentBlobRef.size).toBe(1234567);
    });

    it('preserves title', () => {
      const pdsRecord = createMockPDSRecord();
      const result = transformPDSRecord(pdsRecord, mockUri, mockCid);

      expect(result.title).toBe('Test Paper: A Study in Testing');
    });

    it('preserves uri and cid', () => {
      const pdsRecord = createMockPDSRecord();
      const result = transformPDSRecord(pdsRecord, mockUri, mockCid);

      expect(result.uri).toBe(mockUri);
      expect(result.cid).toBe(mockCid);
    });

    it('converts createdAt ISO string to Timestamp (milliseconds)', () => {
      const pdsRecord = createMockPDSRecord();
      const result = transformPDSRecord(pdsRecord, mockUri, mockCid);

      // createdAt should be converted from ISO string to Unix timestamp in milliseconds
      const expectedTimestamp = new Date('2026-01-18T12:00:00.000Z').getTime();
      expect(result.createdAt).toBe(expectedTimestamp);
    });
  });

  describe('abstract transformation', () => {
    it('transforms abstract string to RichTextBody', () => {
      const pdsRecord = createMockPDSRecord();
      const result = transformPDSRecord(pdsRecord, mockUri, mockCid);

      expect(result.abstract).toBeDefined();
      expect(result.abstract.type).toBe('RichText');
      expect(result.abstract.items).toHaveLength(1);
      expect(result.abstract.items[0]).toEqual({
        type: 'text',
        content: 'This is a test abstract for a test paper.',
      });
      expect(result.abstractPlainText).toBe('This is a test abstract for a test paper.');
    });

    it('handles empty abstract', () => {
      const pdsRecord = createMockPDSRecord({ abstract: undefined });
      const result = transformPDSRecord(pdsRecord, mockUri, mockCid);

      expect(result.abstract).toBeDefined();
      expect(result.abstract.type).toBe('RichText');
      expect(result.abstract.items).toHaveLength(0);
      expect(result.abstractPlainText).toBeUndefined();
    });
  });

  describe('author transformation', () => {
    it('transforms authors with all fields', () => {
      const pdsRecord = createMockPDSRecord();
      const result = transformPDSRecord(pdsRecord, mockUri, mockCid);

      expect(result.authors).toHaveLength(1);
      const author = result.authors[0]!;

      expect(author.did).toBe('did:plc:author123');
      expect(author.name).toBe('Alice Researcher');
      expect(author.order).toBe(1);
      expect(author.email).toBe('alice@example.com');
      expect(author.orcid).toBe('0000-0002-1825-0097');
      expect(author.isCorrespondingAuthor).toBe(true);
      expect(author.isHighlighted).toBe(false);
    });

    it('transforms author affiliations', () => {
      const pdsRecord = createMockPDSRecord();
      const result = transformPDSRecord(pdsRecord, mockUri, mockCid);

      const author = result.authors[0]!;
      expect(author.affiliations).toHaveLength(1);
      expect(author.affiliations[0]).toEqual({
        name: 'University of Testing',
        rorId: 'https://ror.org/03yrm5c26',
        department: 'Department of Verification',
      });
    });

    it('transforms author contributions', () => {
      const pdsRecord = createMockPDSRecord();
      const result = transformPDSRecord(pdsRecord, mockUri, mockCid);

      const author = result.authors[0]!;
      expect(author.contributions).toHaveLength(1);
      expect(author.contributions[0]).toEqual({
        typeUri: 'at://did:plc:gov/pub.chive.graph.concept/conceptualization',
        typeId: 'conceptualization',
        typeLabel: 'Conceptualization',
        degree: 'lead',
      });
    });

    it('handles multiple authors', () => {
      const pdsRecord = createMockPDSRecord({
        authors: [
          { name: 'First Author', order: 1, did: 'did:plc:first' },
          { name: 'Second Author', order: 2, did: 'did:plc:second' },
          { name: 'Third Author', order: 3 }, // No DID (external author)
        ],
      });
      const result = transformPDSRecord(pdsRecord, mockUri, mockCid);

      expect(result.authors).toHaveLength(3);
      expect(result.authors[0]!.name).toBe('First Author');
      expect(result.authors[1]!.name).toBe('Second Author');
      expect(result.authors[2]!.name).toBe('Third Author');
      expect(result.authors[2]!.did).toBeUndefined();
    });

    it('assigns default order if missing', () => {
      const pdsRecord = createMockPDSRecord({
        authors: [{ name: 'First Author' }, { name: 'Second Author' }],
      });
      const result = transformPDSRecord(pdsRecord, mockUri, mockCid);

      expect(result.authors[0]!.order).toBe(1);
      expect(result.authors[1]!.order).toBe(2);
    });
  });

  describe('supplementary materials transformation', () => {
    it('transforms blob to blobRef', () => {
      const pdsRecord = createMockPDSRecord({
        supplementaryMaterials: [
          {
            blob: {
              $type: 'blob',
              ref: { $link: 'bafkreisupplementary1' },
              mimeType: 'text/csv',
              size: 5000,
            },
            label: 'Dataset A',
            description: 'Raw data from experiment 1',
            category: 'dataset',
            detectedFormat: 'csv',
            order: 1,
          },
        ],
      });
      const result = transformPDSRecord(pdsRecord, mockUri, mockCid);

      expect(result.supplementaryMaterials).toHaveLength(1);
      const material = result.supplementaryMaterials![0]!;

      expect(material.blobRef).toBeDefined();
      expect(material.blobRef.ref).toBe('bafkreisupplementary1');
      expect(material.blobRef.mimeType).toBe('text/csv');
      expect(material.blobRef.size).toBe(5000);
      expect(material.label).toBe('Dataset A');
      expect(material.description).toBe('Raw data from experiment 1');
      expect(material.category).toBe('dataset');
      expect(material.detectedFormat).toBe('csv');
      expect(material.order).toBe(1);
    });

    it('handles multiple supplementary materials', () => {
      const pdsRecord = createMockPDSRecord({
        supplementaryMaterials: [
          {
            blob: {
              $type: 'blob',
              ref: { $link: 'bafkreidata1' },
              mimeType: 'text/csv',
              size: 1000,
            },
            label: 'Data 1',
            category: 'dataset',
            order: 1,
          },
          {
            blob: {
              $type: 'blob',
              ref: { $link: 'bafkreicode2' },
              mimeType: 'application/x-python',
              size: 2000,
            },
            label: 'Code',
            category: 'code',
            order: 2,
          },
        ],
      });
      const result = transformPDSRecord(pdsRecord, mockUri, mockCid);

      expect(result.supplementaryMaterials).toHaveLength(2);
      expect(result.supplementaryMaterials![0]!.blobRef.ref).toBe('bafkreidata1');
      expect(result.supplementaryMaterials![1]!.blobRef.ref).toBe('bafkreicode2');
    });

    it('defaults category to other if missing', () => {
      const pdsRecord = createMockPDSRecord({
        supplementaryMaterials: [
          {
            blob: {
              $type: 'blob',
              ref: { $link: 'bafkreimystery' },
              mimeType: 'application/octet-stream',
              size: 500,
            },
            label: 'Mystery File',
            category: '',
            order: 1,
          },
        ],
      });
      const result = transformPDSRecord(pdsRecord, mockUri, mockCid);

      expect(result.supplementaryMaterials![0]!.category).toBe('other');
    });
  });

  describe('facets transformation', () => {
    it('transforms facets with dimension/value', () => {
      const pdsRecord = createMockPDSRecord();
      const result = transformPDSRecord(pdsRecord, mockUri, mockCid);

      expect(result.facets).toHaveLength(2);
      expect(result.facets[0]!).toEqual({
        dimension: 'matter',
        label: 'Computer Science',
        value: 'computer-science',
        nodeUri: undefined,
      });
    });

    it('handles facets with type instead of dimension', () => {
      const pdsRecord = createMockPDSRecord({
        facets: [{ type: 'field', label: 'Biology', value: 'biology' }],
      });
      const result = transformPDSRecord(pdsRecord, mockUri, mockCid);

      expect(result.facets[0]!.dimension).toBe('field');
    });

    it('handles empty facets', () => {
      const pdsRecord = createMockPDSRecord({ facets: undefined });
      const result = transformPDSRecord(pdsRecord, mockUri, mockCid);

      expect(result.facets).toEqual([]);
    });
  });

  describe('optional fields', () => {
    it('preserves keywords', () => {
      const pdsRecord = createMockPDSRecord();
      const result = transformPDSRecord(pdsRecord, mockUri, mockCid);

      expect(result.keywords).toEqual(['testing', 'unit tests', 'vitest']);
    });

    it('preserves license', () => {
      const pdsRecord = createMockPDSRecord();
      const result = transformPDSRecord(pdsRecord, mockUri, mockCid);

      expect(result.license).toBe('CC-BY-4.0');
    });

    it('defaults license to CC-BY-4.0', () => {
      const pdsRecord = createMockPDSRecord({ license: undefined });
      const result = transformPDSRecord(pdsRecord, mockUri, mockCid);

      expect(result.license).toBe('CC-BY-4.0');
    });

    it('defaults documentFormat to pdf', () => {
      const pdsRecord = createMockPDSRecord({ documentFormat: undefined });
      const result = transformPDSRecord(pdsRecord, mockUri, mockCid);

      expect(result.documentFormat).toBe('pdf');
    });

    it('sets default publicationStatus to eprint', () => {
      const pdsRecord = createMockPDSRecord();
      const result = transformPDSRecord(pdsRecord, mockUri, mockCid);

      expect(result.publicationStatus).toBe('eprint');
    });

    it('defaults version to 1', () => {
      const pdsRecord = createMockPDSRecord({ version: undefined });
      const result = transformPDSRecord(pdsRecord, mockUri, mockCid);

      expect(result.version).toBe(1);
    });

    it('transforms previousVersion uri', () => {
      const pdsRecord = createMockPDSRecord({
        previousVersion: {
          uri: 'at://did:plc:test/pub.chive.eprint.submission/prev123',
          cid: 'bafyreiprevious',
        },
      });
      const result = transformPDSRecord(pdsRecord, mockUri, mockCid);

      expect(result.previousVersionUri).toBe(
        'at://did:plc:test/pub.chive.eprint.submission/prev123'
      );
    });
  });

  describe('submittedBy handling', () => {
    it('uses explicit submittedBy if provided', () => {
      const pdsRecord = createMockPDSRecord({
        submittedBy: 'did:plc:explicit-submitter',
      });
      const result = transformPDSRecord(pdsRecord, mockUri, mockCid);

      expect(result.submittedBy).toBe('did:plc:explicit-submitter');
    });

    it('falls back to URI DID when submittedBy is missing', () => {
      const pdsRecord = createMockPDSRecord({
        submittedBy: undefined,
      });
      // mockUri is 'at://did:plc:test/pub.chive.eprint.submission/abc123'
      const result = transformPDSRecord(pdsRecord, mockUri, mockCid);

      expect(result.submittedBy).toBe('did:plc:test');
    });

    it('falls back to URI DID when submittedBy is null', () => {
      const pdsRecord = createMockPDSRecord({
        submittedBy: null,
      });
      const result = transformPDSRecord(pdsRecord, mockUri, mockCid);

      expect(result.submittedBy).toBe('did:plc:test');
    });

    it('throws ValidationError when URI is invalid and submittedBy is missing', () => {
      const pdsRecord = createMockPDSRecord({
        submittedBy: undefined,
      });
      const invalidUri = 'invalid-uri' as AtUri;

      expect(() => transformPDSRecord(pdsRecord, invalidUri, mockCid)).toThrow(ValidationError);
      expect(() => transformPDSRecord(pdsRecord, invalidUri, mockCid)).toThrow(
        'Cannot determine submittedBy: invalid AT-URI'
      );
    });
  });

  describe('funding transformation', () => {
    it('transforms funding info', () => {
      const pdsRecord = createMockPDSRecord({
        fundingInfo: [
          {
            funderName: 'National Science Foundation',
            funderDoi: '10.13039/100000001',
            funderRor: 'https://ror.org/021nxhr62',
            grantNumber: 'NSF-1234567',
            grantTitle: 'Testing Framework Research',
            grantUrl: 'https://nsf.gov/grants/1234567',
          },
        ],
      });
      const result = transformPDSRecord(pdsRecord, mockUri, mockCid);

      expect(result.funding).toHaveLength(1);
      expect(result.funding![0]!).toEqual({
        funderName: 'National Science Foundation',
        funderDoi: '10.13039/100000001',
        funderRor: 'https://ror.org/021nxhr62',
        grantNumber: 'NSF-1234567',
        grantTitle: 'Testing Framework Research',
        grantUrl: 'https://nsf.gov/grants/1234567',
      });
    });
  });
});

// =============================================================================
// VALIDATION TESTS
// =============================================================================

describe('transformPDSRecord validation', () => {
  it('throws ValidationError when document is missing', () => {
    const pdsRecord = createMockPDSRecord({ document: undefined });

    expect(() => transformPDSRecord(pdsRecord, mockUri, mockCid)).toThrow(ValidationError);
    expect(() => transformPDSRecord(pdsRecord, mockUri, mockCid)).toThrow(
      'Missing required field: document'
    );
  });

  it('throws ValidationError when title is missing', () => {
    const pdsRecord = createMockPDSRecord({ title: '' });

    expect(() => transformPDSRecord(pdsRecord, mockUri, mockCid)).toThrow(ValidationError);
    expect(() => transformPDSRecord(pdsRecord, mockUri, mockCid)).toThrow(
      'Missing required field: title'
    );
  });

  it('throws ValidationError when authors is empty', () => {
    const pdsRecord = createMockPDSRecord({ authors: [] });

    expect(() => transformPDSRecord(pdsRecord, mockUri, mockCid)).toThrow(ValidationError);
    expect(() => transformPDSRecord(pdsRecord, mockUri, mockCid)).toThrow(
      'Missing required field: authors'
    );
  });

  it('throws ValidationError when authors is missing', () => {
    const pdsRecord = createMockPDSRecord({ authors: undefined });

    expect(() => transformPDSRecord(pdsRecord, mockUri, mockCid)).toThrow(ValidationError);
  });

  it('throws ValidationError when createdAt is missing', () => {
    const pdsRecord = createMockPDSRecord({ createdAt: undefined });

    expect(() => transformPDSRecord(pdsRecord, mockUri, mockCid)).toThrow(ValidationError);
    expect(() => transformPDSRecord(pdsRecord, mockUri, mockCid)).toThrow(
      'Missing required field: createdAt'
    );
  });
});

// =============================================================================
// isPDSEprintRecord TESTS
// =============================================================================

describe('isPDSEprintRecord', () => {
  it('returns true for valid PDS eprint record', () => {
    const pdsRecord = createMockPDSRecord();
    expect(isPDSEprintRecord(pdsRecord)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isPDSEprintRecord(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isPDSEprintRecord(undefined)).toBe(false);
  });

  it('returns false for non-object', () => {
    expect(isPDSEprintRecord('string')).toBe(false);
    expect(isPDSEprintRecord(123)).toBe(false);
    expect(isPDSEprintRecord(true)).toBe(false);
  });

  it('returns false for wrong $type', () => {
    const record = createMockPDSRecord({ $type: 'wrong.type' });
    expect(isPDSEprintRecord(record)).toBe(false);
  });

  it('returns false for missing title', () => {
    const record = createMockPDSRecord({ title: undefined });
    expect(isPDSEprintRecord(record)).toBe(false);
  });

  it('returns false for non-string title', () => {
    const record = createMockPDSRecord({ title: 123 });
    expect(isPDSEprintRecord(record)).toBe(false);
  });

  it('returns false for missing document', () => {
    const record = createMockPDSRecord({ document: undefined });
    expect(isPDSEprintRecord(record)).toBe(false);
  });

  it('returns false for null document', () => {
    const record = createMockPDSRecord({ document: null });
    expect(isPDSEprintRecord(record)).toBe(false);
  });

  it('returns false for non-array authors', () => {
    const record = createMockPDSRecord({ authors: 'not-array' });
    expect(isPDSEprintRecord(record)).toBe(false);
  });

  it('returns false for empty authors array', () => {
    const record = createMockPDSRecord({ authors: [] });
    expect(isPDSEprintRecord(record)).toBe(false);
  });

  it('returns false for missing createdAt', () => {
    const record = createMockPDSRecord({ createdAt: undefined });
    expect(isPDSEprintRecord(record)).toBe(false);
  });

  it('returns false for non-string createdAt', () => {
    const record = createMockPDSRecord({ createdAt: 1234567890 });
    expect(isPDSEprintRecord(record)).toBe(false);
  });
});
