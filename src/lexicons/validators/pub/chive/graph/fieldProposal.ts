/**
 * Zod validator for pub.chive.graph.fieldProposal
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
 * Zod schema for pub.chive.graph.fieldProposal record.
 *
 * @internal
 */
export const graphFieldProposalSchema = z.object({
  fieldId: z.string().optional(),
  proposalType: z.enum(["create", "update", "merge", "delete"]),
  proposedLabel: z.string().max(200).optional(),
  proposedDescription: z.string().max(1000).optional(),
  wikidataId: z.string().optional(),
  rationale: z.string().max(2000),
  createdAt: z.string().datetime(),
});

/**
 * Type for pub.chive.graph.fieldProposal record.
 *
 * @public
 */
export type GraphFieldProposal = z.infer<typeof graphFieldProposalSchema>;


