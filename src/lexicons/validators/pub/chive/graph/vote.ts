/**
 * Zod validator for pub.chive.graph.vote
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
 * Zod schema for pub.chive.graph.vote record.
 *
 * @internal
 */
export const graphVoteSchema = z.object({
  proposalUri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }),
  vote: z.enum(["approve", "reject"]),
  comment: z.string().max(500).optional(),
  createdAt: z.string().datetime(),
});

/**
 * Type for pub.chive.graph.vote record.
 *
 * @public
 */
export type GraphVote = z.infer<typeof graphVoteSchema>;


