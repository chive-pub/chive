/**
 * Zod validator for pub.chive.eprint.version
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
 * Zod schema for pub.chive.eprint.version record.
 *
 * @internal
 */
export const eprintVersionSchema = z.object({
  eprintUri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }),
  versionNumber: z.number().int().min(1),
  previousVersionUri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }).optional(),
  changes: z.string().max(2000),
  createdAt: z.string().datetime(),
});

/**
 * Type for pub.chive.eprint.version record.
 *
 * @public
 */
export type EprintVersion = z.infer<typeof eprintVersionSchema>;


