/**
 * Zod validator for pub.chive.graph.edge
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
 * Zod schema for pub.chive.graph.edge record.
 *
 * @internal
 */
export const graphEdgeSchema = z.object({
  id: z.string(),
  sourceUri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }),
  targetUri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }),
  relationUri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }).optional(),
  relationSlug: z.string().max(50),
  weight: z.number().optional(),
  metadata: z.object({ confidence: z.number().optional(), startDate: z.string().datetime().optional(), endDate: z.string().datetime().optional(), source: z.string().max(200).optional() }).optional(),
  status: z.enum(["proposed", "established", "deprecated"]),
  proposalUri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }).optional(),
  createdAt: z.string().datetime(),
  createdBy: z.string().refine((val) => /^did:[a-z]+:[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid DID format" }).optional(),
  updatedAt: z.string().datetime().optional(),
});

/**
 * Type for pub.chive.graph.edge record.
 *
 * @public
 */
export type GraphEdge = z.infer<typeof graphEdgeSchema>;


