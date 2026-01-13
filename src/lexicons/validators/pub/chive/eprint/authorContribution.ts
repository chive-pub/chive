/**
 * Zod validator for pub.chive.eprint.authorContribution
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
 * Zod schema for pub.chive.eprint.authorContribution object.
 *
 * @internal
 */
export const eprintAuthorContributionSchema = z.object({
  did: z.string().refine((val) => /^did:[a-z]+:[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid DID format" }).optional(),
  name: z.string().max(200),
  orcid: z.string().max(19).optional(),
  email: z.string().max(254).optional(),
  order: z.number().int().min(1),
  affiliations: z.array(z.object({ name: z.string().max(300), rorId: z.string().max(100).optional(), department: z.string().max(200).optional() })).max(10).optional(),
  contributions: z.array(z.object({ typeUri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }), degree: z.enum(["lead", "equal", "supporting"]).optional() })).max(14).optional(),
  isCorrespondingAuthor: z.boolean().optional(),
  isHighlighted: z.boolean().optional(),
});

/**
 * Type for pub.chive.eprint.authorContribution object.
 *
 * @public
 */
export type EprintAuthorContribution = z.infer<typeof eprintAuthorContributionSchema>;

