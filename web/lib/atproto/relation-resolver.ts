/**
 * Relation type resolver.
 *
 * @remarks
 * Resolves knowledge graph relation-type nodes to their declared external
 * vocabulary mappings. Relations in Chive's knowledge graph carry
 * {@link https://www.w3.org/TR/skos-reference/ SKOS}-style `externalIds`
 * entries pointing at equivalent concepts in other vocabularies (Wikidata,
 * CiTO, Cosmik connection types, Dublin Core, etc.). This module reads
 * those mappings so dual-write code can emit foreign-ecosystem
 * representations without hard-coded enum tables.
 *
 * @packageDocumentation
 */

import { api } from '@/lib/api/client';

/**
 * In-process cache of relation node lookups.
 *
 * @remarks
 * Relation nodes are approximately immutable after publication, so caching
 * per-page-load is safe. Cache keyed by `relationUri`. The cached value is
 * the full `externalIds` array so a single fetch supports lookups against
 * multiple ecosystems.
 *
 * @internal
 */
const relationExternalIdCache = new Map<string, ExternalIdEntry[]>();

/**
 * Single external-id entry as returned by the API.
 *
 * @public
 */
export interface ExternalIdEntry {
  system: string;
  identifier: string;
  uri?: string;
  matchType?: 'exact' | 'close' | 'broader' | 'narrower' | 'related';
}

/**
 * Fetches a relation node's external-id mappings from the AppView.
 *
 * @param relationUri - AT-URI of the relation node
 * @returns Array of external-id entries, or `null` if the node cannot be
 *   resolved
 *
 * @public
 */
export async function getRelationExternalIds(
  relationUri: string
): Promise<ExternalIdEntry[] | null> {
  const cached = relationExternalIdCache.get(relationUri);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const response = await api.pub.chive.graph.getNode({ id: relationUri });
    const externalIds = ((response.data.externalIds ?? []) as ExternalIdEntry[]) ?? [];
    relationExternalIdCache.set(relationUri, externalIds);
    return externalIds;
  } catch {
    return null;
  }
}

/**
 * Looks up the identifier value for a specific ecosystem on a relation node.
 *
 * @remarks
 * Example: `getRelationExternalId(relationUri, 'cosmik')` returns
 * `"REFERENCES"` for the curated `cites` relation.
 *
 * @param relationUri - AT-URI of the relation node
 * @param system - External-id system name (e.g., `"cosmik"`, `"skos"`,
 *   `"wikidata"`, `"schema-org"`)
 * @returns Identifier string, or `null` if the relation has no mapping
 *   declared for that system
 *
 * @public
 */
export async function getRelationExternalId(
  relationUri: string,
  system: string
): Promise<string | null> {
  const entries = await getRelationExternalIds(relationUri);
  if (!entries) return null;
  return entries.find((entry) => entry.system === system)?.identifier ?? null;
}

/**
 * Derives a Cosmik `connectionType` value for a Chive relation.
 *
 * @remarks
 * Resolution order:
 * 1. If the relation node declares a `cosmik` external-id, return that value.
 * 2. Otherwise, derive from the slug by converting kebab-case to
 *    SCREAMING_SNAKE_CASE. This is a naming convention, not an enum.
 *
 * Personal relations (user-created) can declare their own Cosmik mapping
 * via the "Cosmik connection type" field in the new-relation wizard form.
 *
 * @param relationUri - AT-URI of the relation node (may be undefined for
 *   ad-hoc slug-only edges)
 * @param relationSlug - Relation slug used on the edge record
 * @returns Cosmik `connectionType` string suitable for
 *   `network.cosmik.connection.connectionType`
 *
 * @public
 */
export async function resolveCosmikConnectionType(
  relationUri: string | undefined,
  relationSlug: string
): Promise<string> {
  if (relationUri) {
    const mapped = await getRelationExternalId(relationUri, 'cosmik');
    if (mapped) return mapped;
  }
  return slugToScreamingSnake(relationSlug);
}

/**
 * Checks whether a relation has a declared Cosmik mapping (not a fallback).
 *
 * @returns The Cosmik connectionType if the relation declares one, or `null`
 *   if no mapping exists (meaning edges with this relation are Chive-only
 *   and should not be dual-written as Semble connections).
 */
export async function resolveCosmikConnectionTypeStrict(
  relationUri: string | undefined
): Promise<string | null> {
  if (!relationUri) return null;
  return getRelationExternalId(relationUri, 'cosmik');
}

/**
 * Checks whether a relation node has a cosmik externalId mapping declared.
 * Synchronous check against the local cache -- returns false if not cached.
 * For use in UI rendering, not for sync decisions.
 */
export function hasCosmikMapping(externalIds?: Array<{ system: string }>): boolean {
  return externalIds?.some((id) => id.system === 'cosmik') ?? false;
}

/**
 * Reverse resolver: finds the Chive relation node whose `externalIds` match
 * a given foreign `(system, identifier)` pair.
 *
 * @remarks
 * Used when indexing or displaying incoming foreign records (e.g., a
 * `network.cosmik.connection` with `connectionType: "REFERENCES"`) so we
 * can surface the matching Chive relation to users.
 *
 * @param system - External-id system (e.g., `"cosmik"`, `"skos"`)
 * @param identifier - Identifier value in that system
 * @returns The relation node's AT-URI and slug, or `null` if none match
 *
 * @public
 */
export async function findChiveRelationByExternalId(
  system: string,
  identifier: string
): Promise<{ uri: string; slug: string; label: string } | null> {
  try {
    const response = await api.pub.chive.graph.listNodes({
      kind: 'type',
      subkind: 'relation',
      externalIdSystem: system,
      externalIdIdentifier: identifier,
      limit: 1,
    });
    const nodes = (response.data.nodes ?? []) as Array<{
      uri: string;
      label: string;
      metadata?: { slug?: string };
    }>;
    const first = nodes[0];
    if (!first) return null;
    const slug =
      (first.metadata?.slug as string | undefined) ??
      first.label.toLowerCase().replace(/\s+/g, '-');
    return { uri: first.uri, slug, label: first.label };
  } catch {
    return null;
  }
}

/**
 * Converts a kebab-case slug to SCREAMING_SNAKE_CASE.
 *
 * @param slug - Slug like `"has-part"`
 * @returns SCREAMING_SNAKE identifier like `"HAS_PART"`
 *
 * @internal
 */
function slugToScreamingSnake(slug: string): string {
  return slug.toUpperCase().replace(/-/g, '_');
}

/**
 * Converts a SCREAMING_SNAKE identifier to a kebab-case slug.
 *
 * @param value - SCREAMING_SNAKE identifier like `"HAS_PART"`
 * @returns Slug like `"has-part"`
 *
 * @public
 */
export function screamingSnakeToSlug(value: string): string {
  return value.toLowerCase().replace(/_/g, '-');
}

/**
 * Clears the in-process relation cache.
 *
 * @remarks
 * Useful in tests and after a long-running session where relation records
 * may have been updated (though relations are rarely mutated in practice).
 *
 * @public
 */
export function clearRelationCache(): void {
  relationExternalIdCache.clear();
}
