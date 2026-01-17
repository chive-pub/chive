/**
 * Zod validator for pub.chive.graph.node
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
 * Zod schema for pub.chive.graph.node record.
 *
 * @internal
 */
export const graphNodeSchema = z.object({
  id: z.string(),
  slug: z.string().max(100).optional(),
  kind: z.enum(["type", "object"]),
  subkind: z.string().max(50).optional(),
  subkindUri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }).optional(),
  label: z.string().max(500),
  alternateLabels: z.array(z.string().max(500)).max(50).optional(),
  description: z.string().max(2000).optional(),
  externalIds: z.array(z.object({ system: z.enum(["wikidata", "ror", "orcid", "isni", "viaf", "lcsh", "fast", "credit", "spdx", "fundref", "mesh", "aat", "gnd", "anzsrc"]), identifier: z.string().max(200), uri: z.string().optional(), matchType: z.enum(["exact", "close", "broader", "narrower", "related"]).optional() })).max(20).optional(),
  metadata: z.object({ country: z.string().max(2).optional(), city: z.string().max(200).optional(), website: z.string().optional(), organizationStatus: z.enum(["active", "merged", "inactive", "defunct"]).optional(), mimeTypes: z.array(z.string()).max(10).optional(), spdxId: z.string().max(100).optional(), displayOrder: z.number().int().optional(), inverseSlug: z.string().max(50).optional() }).optional(),
  status: z.enum(["proposed", "provisional", "established", "deprecated"]),
  deprecatedBy: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }).optional(),
  proposalUri: z.string().refine((val) => /^at:\/\/did:[a-z]+:[a-zA-Z0-9._-]+\/[a-z]+(\.[a-z]+)+\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" }).optional(),
  createdAt: z.string().datetime(),
  createdBy: z.string().refine((val) => /^did:[a-z]+:[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid DID format" }).optional(),
  updatedAt: z.string().datetime().optional(),
});

/**
 * Type for pub.chive.graph.node record.
 *
 * @public
 */
export type GraphNode = z.infer<typeof graphNodeSchema>;


