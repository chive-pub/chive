/**
 * Zod validator for pub.chive.graph.facet
 *
 * @remarks
 * Generated from Lexicon schema. DO NOT EDIT manually.
 * Regenerate using: pnpm lexicons:generate
 *
 * @packageDocumentation
 * @internal
 */

import { z } from 'zod';


/**
 * Zod schema for pub.chive.graph.facet object.
 *
 * @internal
 */
export const graphFacetSchema = z.object({
  dimension: z.enum(["personality", "matter", "energy", "space", "time", "form", "topical", "geographic", "chronological", "event"]),
  value: z.string().max(200),
  authorityRecordId: z.string().optional(),
});

/**
 * Type for pub.chive.graph.facet object.
 *
 * @public
 */
export type GraphFacet = z.infer<typeof graphFacetSchema>;

