/**
 * Zod validator for pub.chive.contribution.typeProposal
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
 * Zod schema for pub.chive.contribution.typeProposal record.
 *
 * @internal
 */
export const contributionTypeProposalSchema = z.object({
  typeId: z.string().max(50).optional(),
  proposalType: z.enum(["create", "update", "deprecate"]),
  proposedId: z.string().max(50),
  proposedLabel: z.string().max(100),
  proposedDescription: z.string().max(1000).optional(),
  externalMappings: z.array(z.object({ system: z.string().max(50), identifier: z.string().max(100), uri: z.string().optional() })).max(10).optional(),
  rationale: z.string().max(2000),
  supersedes: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }).optional(),
  createdAt: z.string().datetime(),
});

/**
 * Type for pub.chive.contribution.typeProposal record.
 *
 * @public
 */
export type ContributionTypeProposal = z.infer<typeof contributionTypeProposalSchema>;


