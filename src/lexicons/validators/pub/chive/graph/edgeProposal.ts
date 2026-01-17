/**
 * Zod validator for pub.chive.graph.edgeProposal
 *
 * @remarks
 * Generated from Lexicon schema. DO NOT EDIT manually.
 * Regenerate using: pnpm lexicons:generate
 *
 * @packageDocumentation
 * @internal
 */

import { z } from 'zod';
import { graphEdge#edgeMetadataSchema } from './edge#edgeMetadata.js';
import { graphNodeProposal#evidenceSchema } from './nodeProposal#evidence.js';

/**
 * Zod schema for pub.chive.graph.edgeProposal record.
 *
 * @internal
 */
export const graphEdgeProposalSchema = z.object({
  proposalType: z.enum(["create", "update", "deprecate"]),
  targetEdgeUri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }).optional(),
  proposedEdge: z.object({ sourceUri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }), targetUri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }), relationUri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }).optional(), relationSlug: z.string().max(50), weight: z.number().optional(), metadata: graphEdge#edgeMetadataSchema.optional() }).optional(),
  rationale: z.string().max(2000),
  evidence: z.array(graphNodeProposal#evidenceSchema).max(10).optional(),
  createdAt: z.string().datetime(),
});

/**
 * Type for pub.chive.graph.edgeProposal record.
 *
 * @public
 */
export type GraphEdgeProposal = z.infer<typeof graphEdgeProposalSchema>;


