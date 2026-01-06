/**
 * Zod validator for pub.chive.preprint.version
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
 * Zod schema for pub.chive.preprint.version record.
 *
 * @internal
 */
export const preprintVersionSchema = z.object({
  preprintUri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }),
  versionNumber: z.number().int().min(1),
  previousVersionUri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }).optional(),
  changes: z.string().max(2000),
  createdAt: z.string().datetime(),
});

/**
 * Type for pub.chive.preprint.version record.
 *
 * @public
 */
export type PreprintVersion = z.infer<typeof preprintVersionSchema>;


