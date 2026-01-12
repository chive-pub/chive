/**
 * Zod validator for pub.chive.contribution.type
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
 * Zod schema for pub.chive.contribution.type record.
 *
 * @internal
 */
export const contributionTypeSchema = z.object({
  id: z.string().max(50),
  label: z.string().max(100),
  description: z.string().max(1000),
  externalMappings: z.array(z.object({ system: z.string().max(50), identifier: z.string().max(100), uri: z.string().optional(), matchType: z.enum(["exact-match", "close-match", "broad-match", "narrow-match"]).optional() })).max(10).optional(),
  status: z.enum(["established", "provisional", "deprecated"]),
  proposalUri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }).optional(),
  deprecatedBy: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

/**
 * Type for pub.chive.contribution.type record.
 *
 * @public
 */
export type ContributionType = z.infer<typeof contributionTypeSchema>;


