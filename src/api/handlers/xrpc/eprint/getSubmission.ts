/**
 * XRPC handler for pub.chive.eprint.getSubmission.
 *
 * @remarks
 * Retrieves an eprint by AT URI from Chive's index. Returns the full
 * eprint record with enriched metadata, version history, and metrics.
 *
 * **ATProto Compliance:**
 * - Returns pdsUrl for source transparency
 * - Never writes to user PDS
 * - Index data only (rebuildable from firehose)
 *
 * **Schema Evolution:**
 * - Includes optional `_schemaHints` field when legacy formats are detected
 * - Hints are additive and don't break existing clients
 * - Provides migration guidance for outdated record formats
 *
 * @packageDocumentation
 * @public
 */

import { BlobRef } from '@atproto/lexicon';
import { CID } from 'multiformats/cid';

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/eprint/getSubmission.js';
import { SchemaCompatibilityService } from '../../../../services/schema/schema-compatibility.js';
import type { AtUri } from '../../../../types/atproto.js';
import { NotFoundError, ValidationError } from '../../../../types/errors.js';
import type { ApiSchemaHints } from '../../../../types/schema-compatibility.js';
import { normalizeFieldUri } from '../../../../utils/at-uri.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Extended output schema with optional schema hints.
 *
 * @remarks
 * This extends the generated OutputSchema with the optional `_schemaHints` field.
 * The field is additive and will be ignored by clients that don't understand it.
 *
 * @public
 */
export interface OutputSchemaWithHints extends OutputSchema {
  /**
   * Optional schema evolution hints.
   *
   * @remarks
   * Present only when the source record uses legacy formats that have available
   * migrations. Clients can use this information to inform users about record
   * updates or to handle format differences.
   */
  _schemaHints?: ApiSchemaHints;
}

const schemaService = new SchemaCompatibilityService();

/**
 * XRPC method for pub.chive.eprint.getSubmission.
 *
 * @remarks
 * Returns an eprint submission by AT URI with full metadata and source info.
 *
 * @example
 * ```http
 * GET /xrpc/pub.chive.eprint.getSubmission?uri=at://did:plc:abc/pub.chive.eprint.submission/xyz
 *
 * Response:
 * {
 *   "uri": "at://did:plc:abc/pub.chive.eprint.submission/xyz",
 *   "cid": "bafyrei...",
 *   "value": { ... },
 *   "indexedAt": "2024-01-01T00:00:00Z",
 *   "pdsUrl": "https://bsky.social",
 *   "_schemaHints": {
 *     "schemaVersion": "1.0.0",
 *     "deprecatedFields": ["abstract"],
 *     "migrationAvailable": true,
 *     "migrationUrl": "https://docs.chive.pub/schema/migrations/abstract-richtext"
 *   }
 * }
 * ```
 *
 * @public
 */
export const getSubmission: XRPCMethod<QueryParams, void, OutputSchemaWithHints> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchemaWithHints>> => {
    const { eprint, metrics } = c.get('services');
    const logger = c.get('logger');
    const user = c.get('user');

    // Validate required parameter
    if (!params.uri) {
      throw new ValidationError('Missing required parameter: uri', 'uri');
    }

    logger.debug('Getting eprint submission', { uri: params.uri });

    const result = await eprint.getEprint(params.uri as AtUri);

    if (!result) {
      throw new NotFoundError('Eprint', params.uri);
    }

    // Record view metric (non-blocking)
    metrics.recordView(params.uri as AtUri, user?.did).catch((err) => {
      logger.warn('Failed to record view', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    });

    // Helper to convert internal BlobRef to @atproto/lexicon BlobRef
    const toBlobRef = (ref: { ref: string; mimeType: string; size: number }): BlobRef => {
      return new BlobRef(CID.parse(ref.ref), ref.mimeType, ref.size);
    };

    // Convert abstract items to lexicon format
    // result.abstract is an AnnotationBody with .items array
    const abstractItems = result.abstract.items.map((item) => {
      if (item.type === 'text') {
        return {
          $type: 'pub.chive.eprint.submission#textItem' as const,
          type: 'text' as const,
          content: item.content,
        };
      } else if (item.type === 'fieldRef' || item.type === 'nodeRef') {
        return {
          $type: 'pub.chive.eprint.submission#nodeRefItem' as const,
          type: 'nodeRef' as const,
          uri: item.uri,
          label: item.label ?? '',
          subkind: 'field',
        };
      }
      // For other ref types (wikidata, authority, etc.), convert to text with label
      return {
        $type: 'pub.chive.eprint.submission#textItem' as const,
        type: 'text' as const,
        content: 'label' in item ? String(item.label ?? '') : '',
      };
    });

    // Build the submission value in lexicon format
    const response: OutputSchemaWithHints = {
      uri: result.uri,
      cid: result.cid,
      value: {
        $type: 'pub.chive.eprint.submission',
        title: result.title,
        abstract: abstractItems,
        abstractPlainText: result.abstractPlainText,
        document: toBlobRef(result.documentBlobRef),
        documentFormatSlug: result.documentFormat as OutputSchema['value']['documentFormatSlug'],
        supplementaryMaterials: result.supplementaryMaterials?.map((item) => ({
          blob: toBlobRef(item.blobRef),
          label: item.label,
          description: item.description,
          categorySlug: item.category as
            | 'appendix'
            | 'figure'
            | 'table'
            | 'dataset'
            | 'code'
            | 'notebook'
            | 'video'
            | 'audio'
            | 'presentation'
            | 'protocol'
            | 'questionnaire'
            | 'other'
            | (string & {}),
          detectedFormat: item.detectedFormat,
          order: item.order,
        })),
        authors: result.authors.map((author) => ({
          $type: 'pub.chive.eprint.authorContribution' as const,
          did: author.did,
          name: author.name,
          orcid: author.orcid,
          email: author.email,
          order: author.order,
          affiliations: (author.affiliations ?? []).map((aff) => ({
            name: aff.name,
            rorId: aff.rorId,
            department: aff.department,
          })),
          contributions: (author.contributions ?? []).map((contrib) => ({
            typeUri: contrib.typeUri,
            typeId: contrib.typeId,
            typeLabel: contrib.typeLabel,
            degreeSlug: contrib.degree as 'lead' | 'equal' | 'supporting' | (string & {}),
          })),
          isCorrespondingAuthor: author.isCorrespondingAuthor,
          isHighlighted: author.isHighlighted,
        })),
        submittedBy: result.submittedBy,
        paperDid: result.paperDid,
        keywords: result.keywords ? [...result.keywords] : undefined,
        fieldUris: result.fields?.map((f) => normalizeFieldUri(f.uri)),
        // Include enriched fields with resolved labels for frontend display
        fields: result.fields?.map((f) => ({
          uri: normalizeFieldUri(f.uri),
          label: f.label,
          id: f.id ?? normalizeFieldUri(f.uri),
        })),
        version: result.version,
        licenseUri: result.licenseUri,
        licenseSlug: result.license as
          | 'CC-BY-4.0'
          | 'CC-BY-SA-4.0'
          | 'CC0-1.0'
          | 'MIT'
          | 'Apache-2.0'
          | (string & {}),
        publicationStatusSlug: result.publicationStatus as
          | 'eprint'
          | 'preprint'
          | 'submitted'
          | 'accepted'
          | 'published'
          | (string & {}),
        createdAt: result.createdAt.toISOString(),
      },
      indexedAt: result.indexedAt.toISOString(),
      pdsUrl: result.pdsUrl,
    };

    // Include schema hints only if migration is needed
    // The needsAbstractMigration flag is set during indexing based on the source
    // record format. This avoids heuristic-based detection which had false positives.
    if (result.needsAbstractMigration) {
      const schemaDetection = schemaService.analyzeEprintRecord({
        // Pass a string to trigger the legacy abstract format detection
        abstract: result.abstractPlainText ?? '',
        // Include title to avoid false positive deprecation warnings
        title: result.title,
        titleRich: result.titleRich,
      });

      const schemaHints = schemaService.generateApiHints(schemaDetection);
      if (schemaHints) {
        response._schemaHints = schemaHints;
      }
    }

    return { encoding: 'application/json', body: response };
  },
};
