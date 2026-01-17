/**
 * Zod validator for pub.chive.graph.reconciliation
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
 * Zod schema for pub.chive.graph.reconciliation record.
 *
 * @internal
 */
export const graphReconciliationSchema = z.object({
  sourceUri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }),
  targetSystem: z.enum(["wikidata", "lcsh", "fast", "ror", "orcid", "viaf", "gnd", "mesh", "aat", "getty"]),
  targetId: z.string(),
  confidence: z.number(),
  matchType: z.enum(["exact", "close", "broad", "narrow", "related"]).optional(),
  status: z.enum(["proposed", "verified", "rejected"]),
  verifiedBy: z.string().refine((val) => /^did:[a-z]+:[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid DID format" }).optional(),
  notes: z.string().max(1000).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

/**
 * Type for pub.chive.graph.reconciliation record.
 *
 * @public
 */
export type GraphReconciliation = z.infer<typeof graphReconciliationSchema>;


