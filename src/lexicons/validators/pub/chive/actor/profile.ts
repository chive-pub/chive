/**
 * Zod validator for pub.chive.actor.profile
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
 * Zod schema for pub.chive.actor.profile record.
 *
 * @internal
 */
export const actorProfileSchema = z.object({
  displayName: z.string().max(200).optional(),
  bio: z.string().max(2000).optional(),
  avatar: z.object({ $type: z.literal("blob"), ref: z.object({ $link: z.string() }), mimeType: z.string(), size: z.number() }).optional(),
  orcid: z.string().optional(),
  affiliations: z.array(z.object({ institutionUri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }).optional(), name: z.string().max(200), rorId: z.string().max(50).optional() })).max(10).optional(),
  fieldUris: z.array(z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" })).max(20).optional(),
  nameVariants: z.array(z.string().max(200)).max(20).optional(),
  previousAffiliations: z.array(z.object({ institutionUri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }).optional(), name: z.string().max(200), rorId: z.string().max(50).optional() })).max(20).optional(),
  researchKeywords: z.array(z.object({ topicUri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }).optional(), label: z.string().max(100), fastId: z.string().max(20).optional(), wikidataId: z.string().max(20).optional() })).max(50).optional(),
  semanticScholarId: z.string().max(50).optional(),
  openAlexId: z.string().max(50).optional(),
  googleScholarId: z.string().max(50).optional(),
  arxivAuthorId: z.string().max(100).optional(),
  openReviewId: z.string().max(100).optional(),
  dblpId: z.string().max(200).optional(),
  scopusAuthorId: z.string().max(50).optional(),
});

/**
 * Type for pub.chive.actor.profile record.
 *
 * @public
 */
export type ActorProfile = z.infer<typeof actorProfileSchema>;


