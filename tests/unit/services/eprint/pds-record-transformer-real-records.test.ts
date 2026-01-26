/**
 * Unit tests for PDS record transformer with real production records.
 *
 * @remarks
 * Tests transformation of actual records from production PDSes to verify
 * the transformer handles real-world data correctly. These tests cover:
 *
 * - Legacy string abstracts (schema 0.0.0)
 * - Missing submittedBy fields (DID extraction from AT-URI)
 * - Supplementary materials with UUID categories
 * - Facets using `type` instead of `dimension`
 *
 * These records were collected from production to ensure the transformer
 * handles edge cases and schema variations encountered in the wild.
 */

import { describe, it, expect } from 'vitest';

import {
  transformPDSRecord,
  transformPDSRecordWithSchema,
} from '@/services/eprint/pds-record-transformer.js';
import type { AtUri, CID } from '@/types/atproto.js';

// =============================================================================
// REAL PRODUCTION RECORDS
// =============================================================================

/**
 * Real record from production with:
 * - String abstract (legacy format)
 * - Missing submittedBy
 * - Facets using `type` instead of `dimension`
 */
const realRecordStringAbstract = {
  $type: 'pub.chive.eprint.submission',
  title: 'Probabilistic dynamic semantics',
  facets: [
    {
      type: 'form-genre',
      label: 'Original Research',
      value: 'original-research',
    },
  ],
  authors: [
    {
      did: 'did:plc:mgcfy7hmflw4zuvc27caz2wn',
      name: 'Julian Grove',
      order: 1,
      affiliations: [
        {
          name: 'University of Florida',
          rorId: 'https://ror.org/02y3ad647',
          department: 'Linguistics',
        },
      ],
      contributions: [
        {
          degree: 'lead',
          typeId: 'conceptualization',
          typeUri:
            'at://did:plc:5wzpn4a4nbqtz3q45hyud6hd/pub.chive.graph.node/contribution-type-conceptualization',
          typeLabel: 'Conceptualization',
        },
      ],
      isHighlighted: true,
      isCorrespondingAuthor: true,
    },
  ],
  license: 'cc-by-4.0',
  abstract:
    'We introduce the framework of Probabilistic Dynamic Semantics (PDS), which provides a foundation for probabilistic models of pragmatic interpretation. PDS combines dynamic semantics with probability theory to model how listeners update their beliefs based on linguistic input.',
  document: {
    $type: 'blob',
    ref: { $link: 'bafkreievbtbf332f2fft2sauj5q6ilrtaoj67lrrg6wxf6rnjzei2u7zke' },
    mimeType: 'application/pdf',
    size: 793088,
  },
  keywords: ['dynamic semantics', 'probabilistic models', 'pragmatics', 'Bayesian inference'],
  createdAt: '2026-01-18T16:00:08.522Z',
  fieldNodes: [{ uri: '6fe7359e-8b24-5fce-8bd4-0225a10c899e' }],
  documentFormat: 'pdf',
};

/**
 * Real record with supplementary materials using UUID category.
 */
const realRecordWithSupplementary = {
  $type: 'pub.chive.eprint.submission',
  title: 'Neural basis of language comprehension',
  authors: [
    {
      did: 'did:plc:test123xyz',
      name: 'Test Researcher',
      order: 1,
      isCorrespondingAuthor: true,
    },
  ],
  license: 'cc-by-4.0',
  abstract: 'This study examines the neural basis of language comprehension.',
  document: {
    $type: 'blob',
    ref: { $link: 'bafkreitestdocument123' },
    mimeType: 'application/pdf',
    size: 500000,
  },
  supplementaryMaterials: [
    {
      blob: {
        $type: 'blob',
        ref: { $link: 'bafkreisupplementarydata456' },
        mimeType: 'text/csv',
        size: 25000,
      },
      label: 'Experimental Data',
      description: 'Raw data from fMRI experiments',
      // UUID category (should fall through to cast as SupplementaryCategory)
      category: '550e8400-e29b-41d4-a716-446655440000',
      order: 1,
    },
    {
      blob: {
        $type: 'blob',
        ref: { $link: 'bafkreianalysisscript789' },
        mimeType: 'application/x-python',
        size: 5000,
      },
      label: 'Analysis Script',
      category: 'code',
      order: 2,
    },
  ],
  createdAt: '2026-01-20T10:30:00.000Z',
  documentFormat: 'pdf',
};

/**
 * Record with rich text array abstract (current format).
 */
const realRecordRichTextAbstract = {
  $type: 'pub.chive.eprint.submission',
  title: 'Advances in transformer architectures',
  authors: [
    {
      did: 'did:plc:author456',
      name: 'AI Researcher',
      order: 1,
      isCorrespondingAuthor: true,
    },
  ],
  license: 'cc-by-4.0',
  abstract: [
    { type: 'text', content: 'This paper explores advances in ' },
    {
      type: 'nodeRef',
      uri: 'at://did:plc:gov/pub.chive.graph.node/transformer-architecture',
      label: 'transformer architectures',
    },
    { type: 'text', content: ' for natural language processing tasks.' },
  ],
  document: {
    $type: 'blob',
    ref: { $link: 'bafkreitransformer123' },
    mimeType: 'application/pdf',
    size: 650000,
  },
  keywords: ['transformers', 'NLP', 'deep learning'],
  createdAt: '2026-01-22T14:00:00.000Z',
  documentFormat: 'pdf',
  submittedBy: 'did:plc:author456',
};

// =============================================================================
// TEST URIS AND CIDS
// =============================================================================

const stringAbstractUri =
  'at://did:plc:mgcfy7hmflw4zuvc27caz2wn/pub.chive.eprint.submission/3lgg7abc123' as AtUri;
const stringAbstractCid = 'bafyreicidstring123' as CID;

const supplementaryUri = 'at://did:plc:test123xyz/pub.chive.eprint.submission/3lgg7sup456' as AtUri;
const supplementaryCid = 'bafyreicidsupplementary456' as CID;

const richTextUri = 'at://did:plc:author456/pub.chive.eprint.submission/3lgg7rich789' as AtUri;
const richTextCid = 'bafyreicidrichtext789' as CID;

// =============================================================================
// TESTS: STRING ABSTRACT (LEGACY FORMAT)
// =============================================================================

describe('PDS record transformer with real records', () => {
  describe('string abstract transformation (legacy schema 0.0.0)', () => {
    it('converts string abstract to RichTextBody', () => {
      const result = transformPDSRecord(
        realRecordStringAbstract,
        stringAbstractUri,
        stringAbstractCid
      );

      expect(result.abstract).toBeDefined();
      expect(result.abstract.type).toBe('RichText');
      expect(result.abstract.items).toHaveLength(1);
      expect(result.abstract.items[0]).toEqual({
        type: 'text',
        content:
          'We introduce the framework of Probabilistic Dynamic Semantics (PDS), which provides a foundation for probabilistic models of pragmatic interpretation. PDS combines dynamic semantics with probability theory to model how listeners update their beliefs based on linguistic input.',
      });
    });

    it('preserves abstract plain text', () => {
      const result = transformPDSRecord(
        realRecordStringAbstract,
        stringAbstractUri,
        stringAbstractCid
      );

      expect(result.abstractPlainText).toBe(
        'We introduce the framework of Probabilistic Dynamic Semantics (PDS), which provides a foundation for probabilistic models of pragmatic interpretation. PDS combines dynamic semantics with probability theory to model how listeners update their beliefs based on linguistic input.'
      );
    });

    it('detects legacy format (schema 0.0.0) in schema detection', () => {
      const result = transformPDSRecordWithSchema(
        realRecordStringAbstract,
        stringAbstractUri,
        stringAbstractCid
      );

      expect(result.abstractFormat).toBe('string');
      expect(result.schemaDetection.isCurrentSchema).toBe(false);
      expect(result.schemaDetection.compatibility.detectedFormat).toBe('legacy');
      expect(result.schemaDetection.compatibility.schemaVersion).toEqual({
        major: 0,
        minor: 0,
        patch: 0,
      });
    });

    it('provides deprecation info for string abstract', () => {
      const result = transformPDSRecordWithSchema(
        realRecordStringAbstract,
        stringAbstractUri,
        stringAbstractCid
      );

      expect(result.schemaDetection.compatibility.deprecatedFields).toHaveLength(1);
      const deprecatedField = result.schemaDetection.compatibility.deprecatedFields[0];
      expect(deprecatedField?.field).toBe('abstract');
      expect(deprecatedField?.detectedFormat).toBe('string');
      expect(deprecatedField?.currentFormat).toBe('RichTextItem[]');
    });

    it('correctly transforms all other fields', () => {
      const result = transformPDSRecord(
        realRecordStringAbstract,
        stringAbstractUri,
        stringAbstractCid
      );

      expect(result.uri).toBe(stringAbstractUri);
      expect(result.cid).toBe(stringAbstractCid);
      expect(result.title).toBe('Probabilistic dynamic semantics');
      expect(result.license).toBe('cc-by-4.0');
      expect(result.documentFormat).toBe('pdf');
      expect(result.keywords).toEqual([
        'dynamic semantics',
        'probabilistic models',
        'pragmatics',
        'Bayesian inference',
      ]);

      // Document blob ref
      expect(result.documentBlobRef.ref).toBe(
        'bafkreievbtbf332f2fft2sauj5q6ilrtaoj67lrrg6wxf6rnjzei2u7zke'
      );
      expect(result.documentBlobRef.mimeType).toBe('application/pdf');
      expect(result.documentBlobRef.size).toBe(793088);
    });

    it('correctly transforms author data', () => {
      const result = transformPDSRecord(
        realRecordStringAbstract,
        stringAbstractUri,
        stringAbstractCid
      );

      expect(result.authors).toHaveLength(1);
      const author = result.authors[0]!;

      expect(author.did).toBe('did:plc:mgcfy7hmflw4zuvc27caz2wn');
      expect(author.name).toBe('Julian Grove');
      expect(author.order).toBe(1);
      expect(author.isHighlighted).toBe(true);
      expect(author.isCorrespondingAuthor).toBe(true);

      // Affiliations
      expect(author.affiliations).toHaveLength(1);
      expect(author.affiliations[0]).toEqual({
        name: 'University of Florida',
        rorId: 'https://ror.org/02y3ad647',
        department: 'Linguistics',
      });

      // Contributions
      expect(author.contributions).toHaveLength(1);
      expect(author.contributions[0]?.typeId).toBe('conceptualization');
      expect(author.contributions[0]?.degree).toBe('lead');
    });
  });

  // =============================================================================
  // TESTS: MISSING SUBMITTED BY
  // =============================================================================

  describe('missing submittedBy handling', () => {
    it('extracts DID from AT-URI when submittedBy is missing', () => {
      const result = transformPDSRecord(
        realRecordStringAbstract,
        stringAbstractUri,
        stringAbstractCid
      );

      // submittedBy is missing in realRecordStringAbstract
      // Should be extracted from AT-URI: at://did:plc:mgcfy7hmflw4zuvc27caz2wn/...
      expect(result.submittedBy).toBe('did:plc:mgcfy7hmflw4zuvc27caz2wn');
    });

    it('uses explicit submittedBy when provided', () => {
      const result = transformPDSRecord(realRecordRichTextAbstract, richTextUri, richTextCid);

      expect(result.submittedBy).toBe('did:plc:author456');
    });
  });

  // =============================================================================
  // TESTS: SUPPLEMENTARY MATERIALS
  // =============================================================================

  describe('supplementary materials transformation', () => {
    it('converts blob to blobRef for all supplementary materials', () => {
      const result = transformPDSRecord(
        realRecordWithSupplementary,
        supplementaryUri,
        supplementaryCid
      );

      expect(result.supplementaryMaterials).toHaveLength(2);

      const firstMaterial = result.supplementaryMaterials![0]!;
      expect(firstMaterial.blobRef).toBeDefined();
      expect(firstMaterial.blobRef.ref).toBe('bafkreisupplementarydata456');
      expect(firstMaterial.blobRef.mimeType).toBe('text/csv');
      expect(firstMaterial.blobRef.size).toBe(25000);

      const secondMaterial = result.supplementaryMaterials![1]!;
      expect(secondMaterial.blobRef.ref).toBe('bafkreianalysisscript789');
      expect(secondMaterial.blobRef.mimeType).toBe('application/x-python');
    });

    it('handles UUID category by casting to SupplementaryCategory', () => {
      const result = transformPDSRecord(
        realRecordWithSupplementary,
        supplementaryUri,
        supplementaryCid
      );

      const firstMaterial = result.supplementaryMaterials![0]!;
      // UUID category falls through as-is (cast to SupplementaryCategory type)
      expect(firstMaterial.category).toBe('550e8400-e29b-41d4-a716-446655440000');

      // Valid category is preserved
      const secondMaterial = result.supplementaryMaterials![1]!;
      expect(secondMaterial.category).toBe('code');
    });

    it('preserves label and description', () => {
      const result = transformPDSRecord(
        realRecordWithSupplementary,
        supplementaryUri,
        supplementaryCid
      );

      const firstMaterial = result.supplementaryMaterials![0]!;
      expect(firstMaterial.label).toBe('Experimental Data');
      expect(firstMaterial.description).toBe('Raw data from fMRI experiments');
    });

    it('preserves order', () => {
      const result = transformPDSRecord(
        realRecordWithSupplementary,
        supplementaryUri,
        supplementaryCid
      );

      expect(result.supplementaryMaterials![0]!.order).toBe(1);
      expect(result.supplementaryMaterials![1]!.order).toBe(2);
    });
  });

  // =============================================================================
  // TESTS: FACETS WITH TYPE FIELD
  // =============================================================================

  describe('facets with type field instead of dimension', () => {
    it('maps type to dimension when dimension is missing', () => {
      const result = transformPDSRecord(
        realRecordStringAbstract,
        stringAbstractUri,
        stringAbstractCid
      );

      expect(result.facets).toHaveLength(1);
      const facet = result.facets[0]!;

      // `type: 'form-genre'` should become `dimension: 'form-genre'`
      expect(facet.dimension).toBe('form-genre');
      // Label is preserved at runtime even though not in FacetFilter type
      // The transformer produces objects with label, but the type doesn't include it
      expect((facet as unknown as { label: string }).label).toBe('Original Research');
      expect(facet.value).toBe('original-research');
    });

    it('prefers dimension over type when both are present', () => {
      const recordWithBoth = {
        ...realRecordStringAbstract,
        facets: [
          {
            type: 'legacy-type',
            dimension: 'correct-dimension',
            label: 'Test',
            value: 'test',
          },
        ],
      };

      const result = transformPDSRecord(recordWithBoth, stringAbstractUri, stringAbstractCid);

      expect(result.facets[0]!.dimension).toBe('correct-dimension');
    });

    it('falls back to unknown when neither type nor dimension is present', () => {
      const recordNoType = {
        ...realRecordStringAbstract,
        facets: [
          {
            label: 'Test Label',
            value: 'test-value',
          },
        ],
      };

      const result = transformPDSRecord(recordNoType, stringAbstractUri, stringAbstractCid);

      expect(result.facets[0]!.dimension).toBe('unknown');
    });
  });

  // =============================================================================
  // TESTS: FIELD NODES
  // =============================================================================

  describe('field nodes transformation', () => {
    it('transforms field nodes with URI-based IDs', () => {
      const result = transformPDSRecord(
        realRecordStringAbstract,
        stringAbstractUri,
        stringAbstractCid
      );

      expect(result.fields).toBeDefined();
      expect(result.fields).toHaveLength(1);

      const field = result.fields![0]!;
      expect(field.uri).toBe('6fe7359e-8b24-5fce-8bd4-0225a10c899e');
      expect(field.label).toBe('6fe7359e-8b24-5fce-8bd4-0225a10c899e'); // Label defaults to URI
      expect(field.id).toBe('6fe7359e-8b24-5fce-8bd4-0225a10c899e');
    });
  });

  // =============================================================================
  // TESTS: RICH TEXT ABSTRACT (CURRENT FORMAT)
  // =============================================================================

  describe('rich text array abstract (current format)', () => {
    it('transforms rich text array correctly', () => {
      const result = transformPDSRecord(realRecordRichTextAbstract, richTextUri, richTextCid);

      expect(result.abstract.type).toBe('RichText');
      expect(result.abstract.items).toHaveLength(3);

      expect(result.abstract.items[0]).toEqual({
        type: 'text',
        content: 'This paper explores advances in ',
      });

      expect(result.abstract.items[1]).toEqual({
        type: 'nodeRef',
        uri: 'at://did:plc:gov/pub.chive.graph.node/transformer-architecture',
        label: 'transformer architectures',
        subkind: undefined,
      });

      expect(result.abstract.items[2]).toEqual({
        type: 'text',
        content: ' for natural language processing tasks.',
      });
    });

    it('generates correct plain text from rich text array', () => {
      const result = transformPDSRecord(realRecordRichTextAbstract, richTextUri, richTextCid);

      expect(result.abstractPlainText).toBe(
        'This paper explores advances in transformer architectures for natural language processing tasks.'
      );
    });

    it('detects current schema format', () => {
      const result = transformPDSRecordWithSchema(
        realRecordRichTextAbstract,
        richTextUri,
        richTextCid
      );

      expect(result.abstractFormat).toBe('rich-text-array');
      expect(result.schemaDetection.isCurrentSchema).toBe(true);
      expect(result.schemaDetection.compatibility.detectedFormat).toBe('current');
      expect(result.schemaDetection.compatibility.deprecatedFields).toHaveLength(0);
    });
  });

  // =============================================================================
  // TESTS: TIMESTAMP CONVERSION
  // =============================================================================

  describe('timestamp conversion', () => {
    it('converts ISO string createdAt to Unix timestamp in milliseconds', () => {
      const result = transformPDSRecord(
        realRecordStringAbstract,
        stringAbstractUri,
        stringAbstractCid
      );

      const expectedTimestamp = new Date('2026-01-18T16:00:08.522Z').getTime();
      expect(result.createdAt).toBe(expectedTimestamp);
    });
  });
});
