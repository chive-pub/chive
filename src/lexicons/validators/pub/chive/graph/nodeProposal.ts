/**
 * Zod validator for pub.chive.graph.nodeProposal
 *
 * @remarks
 * Generated from Lexicon schema. DO NOT EDIT manually.
 * Regenerate using: pnpm lexicons:generate
 *
 * @packageDocumentation
 * @internal
 */

import { z } from 'zod';
import { graphNode#externalIdSchema } from './node#externalId.js';
import { graphNode#nodeMetadataSchema } from './node#nodeMetadata.js';

/**
 * Zod schema for pub.chive.graph.nodeProposal record.
 *
 * @internal
 */
export const graphNodeProposalSchema = z.object({
  proposalType: z.enum(["create", "update", "merge", "deprecate"]),
  kind: z.enum(["type", "object"]),
  subkind: z.string().max(50).optional(),
  targetUri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }).optional(),
  mergeIntoUri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }).optional(),
  proposedNode: z.object({ label: z.string().max(500), alternateLabels: z.array(z.string().max(500)).max(50).optional(), description: z.string().max(2000).optional(), externalIds: z.array(graphNode#externalIdSchema).max(20).optional(), metadata: graphNode#nodeMetadataSchema.optional() }).optional(),
  rationale: z.string().max(2000),
  evidence: z.array(z.object({ type: z.enum(["wikidata", "lcsh", "fast", "ror", "credit", "usage", "citation", "external", "other"]), uri: z.string().optional(), description: z.string().max(500).optional() })).max(10).optional(),
  createdAt: z.string().datetime(),
});

/**
 * Type for pub.chive.graph.nodeProposal record.
 *
 * @public
 */
export type GraphNodeProposal = z.infer<typeof graphNodeProposalSchema>;


