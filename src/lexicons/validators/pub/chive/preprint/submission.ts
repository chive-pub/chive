/**
 * Zod validator for pub.chive.preprint.submission
 *
 * @remarks
 * Generated from Lexicon schema. DO NOT EDIT manually.
 * Regenerate using: pnpm lexicons:generate
 *
 * @packageDocumentation
 * @internal
 */

import { z } from 'zod';
import { graphFacetSchema } from '../graph/facet.js';

/**
 * Zod schema for pub.chive.preprint.submission record.
 *
 * @internal
 */
export const preprintSubmissionSchema = z.object({
  title: z.string().max(500),
  abstract: z.string().max(5000),
  pdf: z.object({ $type: z.literal("blob"), ref: z.object({ $link: z.string() }), mimeType: z.string(), size: z.number() }),
  supplementary: z.array(z.object({ $type: z.literal("blob"), ref: z.object({ $link: z.string() }), mimeType: z.string(), size: z.number() })).max(10).optional(),
  coAuthors: z.array(z.string().refine((val) => /^did:[a-z]+:[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid DID format" })).max(50).optional(),
  keywords: z.array(z.string().max(100)).max(20).optional(),
  facets: z.array(graphFacetSchema).max(30).optional(),
  version: z.number().int().min(1).optional(),
  previousVersion: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }).optional(),
  license: z.enum(["CC-BY-4.0", "CC-BY-SA-4.0", "CC0-1.0", "MIT", "Apache-2.0"]),
  createdAt: z.string().datetime(),
});

/**
 * Type for pub.chive.preprint.submission record.
 *
 * @public
 */
export type PreprintSubmission = z.infer<typeof preprintSubmissionSchema>;


