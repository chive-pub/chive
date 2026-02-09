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
 * @packageDocumentation
 * @public
 */

import { BlobRef } from '@atproto/lexicon';
import { CID } from 'multiformats/cid';

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/eprint/getSubmission.js';
import type { AtUri } from '../../../../types/atproto.js';
import { NotFoundError, ValidationError } from '../../../../types/errors.js';
import { normalizeFieldUri } from '../../../../utils/at-uri.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

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
export const getSubmission: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
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

    // Fetch avatars for authors who don't have one
    const authorsNeedingAvatars = result.authors.filter((a) => a.did && !a.avatarUrl);
    const avatarMap = new Map<string, string>();

    if (authorsNeedingAvatars.length > 0) {
      const dids = authorsNeedingAvatars.map((a) => a.did).filter(Boolean) as string[];
      // Batch fetch up to 25 profiles at a time (API limit)
      const batchSize = 25;
      for (let i = 0; i < dids.length; i += batchSize) {
        const batch = dids.slice(i, i + batchSize);
        try {
          const params = new URLSearchParams();
          for (const did of batch) {
            params.append('actors', did);
          }
          const response = await fetch(
            `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfiles?${params.toString()}`,
            {
              headers: { Accept: 'application/json' },
              signal: AbortSignal.timeout(5000),
            }
          );

          if (response.ok) {
            const data = (await response.json()) as {
              profiles: { did: string; avatar?: string }[];
            };
            for (const profile of data.profiles) {
              if (profile.avatar) {
                avatarMap.set(profile.did, profile.avatar);
              }
            }
          }
        } catch (error) {
          logger.debug('Failed to fetch Bluesky profiles for authors', {
            error: error instanceof Error ? error.message : String(error),
            batchSize: batch.length,
          });
        }
      }
    }

    // Generate schema hints if migration is available
    // The indexer tracks which records use deprecated formats
    const deprecatedFields: string[] = [];
    if (result.needsAbstractMigration) {
      deprecatedFields.push('abstract');
    }
    // Check for title containing LaTeX that could benefit from rich text format
    // Patterns: $...$ (inline math), $$...$$ (display math), \command{ (LaTeX commands)
    const latexPattern = /\$[^$]+\$|\$\$[^$]+\$\$|\\[a-zA-Z]+\{/;
    if (result.title && latexPattern.test(result.title) && !result.titleRich) {
      deprecatedFields.push('title');
    }
    // Check for license needing migration (has slug but no URI)
    if (result.license && !result.licenseUri) {
      deprecatedFields.push('license');
    }

    const schemaHints =
      deprecatedFields.length > 0
        ? {
            schemaVersion: '0.1.0',
            deprecatedFields,
            migrationAvailable: true,
            migrationUrl: 'https://docs.chive.pub/guides/schema-migration',
          }
        : undefined;

    // Resolve UUID field labels from Neo4j at response time.
    // During indexing, labels may fall back to UUIDs if Neo4j was unavailable.
    const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let resolvedFields = result.fields?.map((f) => ({
      uri: normalizeFieldUri(f.uri),
      label: f.label,
      id: f.id ?? normalizeFieldUri(f.uri),
    }));

    if (resolvedFields) {
      const uuidFields = resolvedFields.filter((f) => UUID_PATTERN.test(f.label));
      if (uuidFields.length > 0) {
        try {
          const { nodeRepository } = c.get('services');
          const uuidIds = uuidFields.map((f) => f.id);
          const nodeMap = await nodeRepository.getNodesByIds(uuidIds);
          resolvedFields = resolvedFields.map((f) => {
            if (UUID_PATTERN.test(f.label)) {
              const node = nodeMap.get(f.id);
              if (node) {
                return { ...f, label: node.label };
              }
            }
            return f;
          });
        } catch (err) {
          logger.warn('Failed to resolve UUID field labels from Neo4j', {
            error: err instanceof Error ? err.message : 'Unknown error',
            uuidCount: uuidFields.length,
          });
        }
      }
    }

    // Build the submission value in lexicon format
    const response: OutputSchema & { _schemaHints?: typeof schemaHints } = {
      uri: result.uri,
      cid: result.cid,
      ...(schemaHints && { _schemaHints: schemaHints }),
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
          handle: author.handle,
          avatarUrl: author.avatarUrl ?? (author.did ? avatarMap.get(author.did) : undefined),
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
        // Include enriched fields with resolved labels for frontend display.
        // UUID labels are resolved from Neo4j at response time (see below).
        fields: resolvedFields,
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

    return { encoding: 'application/json', body: response };
  },
};
