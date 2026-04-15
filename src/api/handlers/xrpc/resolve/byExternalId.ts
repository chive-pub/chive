/**
 * XRPC handler for pub.chive.resolve.byExternalId.
 *
 * @remarks
 * Resolves an external identifier (DOI, arXiv, ORCID, ROR, ISBN, PMID,
 * Wikidata) to the Chive entity that declares it. Looks in two places:
 *
 * 1. Chive-native eprint submissions (`publishedVersion.doi`,
 *    `externalIds.arxivId`, etc.) — via `EprintService.findByExternalIds`.
 * 2. Knowledge-graph nodes (`externalIds` array on `pub.chive.graph.node`) —
 *    via `NodeService.listNodes` with `externalIdSystem` filter.
 *
 * Returns the first match. Used by canonical external-ID web routes
 * (`/doi/<id>`, `/arxiv/<id>`, etc.) to route to the right Chive page.
 *
 * @packageDocumentation
 * @public
 */

import type {
  QueryParams,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/resolve/byExternalId.js';
import { ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Maps an external-ID `system` to the corresponding field key on
 * `EprintService.findByExternalIds`.
 */
const EPRINT_FIELD_BY_SYSTEM: Record<string, string> = {
  doi: 'doi',
  arxiv: 'arxivId',
  pmid: 'pmid',
};

/** Re-exported query parameters. */
export type ResolveByExternalIdParams = QueryParams;

/** Re-exported output schema. */
export type ResolveByExternalIdOutput = OutputSchema;

/**
 * XRPC method for pub.chive.resolve.byExternalId query.
 *
 * @public
 */
export const byExternalId: XRPCMethod<QueryParams, void, OutputSchema> = {
  auth: 'optional',
  handler: async ({ params, c }): Promise<XRPCResponse<OutputSchema>> => {
    const { eprint: eprintService, nodeService } = c.get('services');
    const logger = c.get('logger');

    if (!params.system || !params.identifier) {
      throw new ValidationError('Both `system` and `identifier` parameters are required', 'params');
    }

    const system = params.system;
    const identifier = params.identifier;

    logger.debug('Resolving by external ID', { system, identifier });

    // 1. Check Chive-native eprints first.
    const eprintField = EPRINT_FIELD_BY_SYSTEM[system];
    if (eprintField && eprintService) {
      try {
        const eprint = await eprintService.findByExternalIds({
          [eprintField]: identifier,
        } as Record<string, string>);
        if (eprint) {
          return {
            encoding: 'application/json',
            body: {
              found: true,
              entityType: 'eprint',
              uri: eprint.uri,
              label: eprint.title ?? '',
              webPath: `/eprints/${encodeURIComponent(eprint.uri)}`,
            },
          };
        }
      } catch (err) {
        logger.warn('Eprint external-id lookup failed', {
          system,
          identifier,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 2. Check knowledge-graph nodes.
    if (nodeService) {
      try {
        const result = await nodeService.listNodes({
          externalIdSystem: system,
          externalIdIdentifier: identifier,
          limit: 1,
        });
        const node = result.nodes[0];
        if (node) {
          // Authors are nodes with subkind=person/author and DID on metadata.
          const isAuthor = node.subkind === 'person' || node.subkind === 'author';
          const entityType = isAuthor ? 'author' : 'graphNode';
          const did =
            node.metadata && typeof node.metadata === 'object' && 'did' in node.metadata
              ? ((node.metadata as { did?: unknown }).did as string | undefined)
              : undefined;
          const webPath = isAuthor
            ? `/authors/${did ?? node.uri}`
            : `/graph?node=${encodeURIComponent(node.uri)}`;
          return {
            encoding: 'application/json',
            body: {
              found: true,
              entityType,
              uri: node.uri,
              label: node.label,
              webPath,
            },
          };
        }
      } catch (err) {
        logger.warn('Graph node external-id lookup failed', {
          system,
          identifier,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      encoding: 'application/json',
      body: { found: false },
    };
  },
};
