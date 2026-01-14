/**
 * Alpha tester API schemas.
 *
 * @remarks
 * Zod schemas for alpha tester application endpoints.
 *
 * @packageDocumentation
 * @public
 */

import { z } from 'zod';

/**
 * Alpha application status.
 */
export const alphaStatusSchema = z.enum(['none', 'pending', 'approved', 'rejected']);

export type AlphaStatus = z.infer<typeof alphaStatusSchema>;

/**
 * Sector/organization type for alpha applications.
 */
export const alphaSectorSchema = z.enum([
  'academia',
  'industry',
  'government',
  'nonprofit',
  'healthcare',
  'independent',
  'other',
]);

export type AlphaSector = z.infer<typeof alphaSectorSchema>;

/**
 * Career stage/position for alpha applications.
 */
export const alphaCareerStageSchema = z.enum([
  'undergraduate',
  'graduate-masters',
  'graduate-phd',
  'postdoc',
  'research-staff',
  'junior-faculty',
  'senior-faculty',
  'research-admin',
  'librarian',
  'science-communicator',
  'policy-professional',
  'retired',
  'other',
]);

export type AlphaCareerStage = z.infer<typeof alphaCareerStageSchema>;

/**
 * Affiliation schema for alpha applications.
 */
export const alphaAffiliationSchema = z.object({
  name: z.string().min(1).max(200).describe('Institution name'),
  rorId: z.string().url().optional().describe('ROR ID URL'),
});

export type AlphaAffiliation = z.infer<typeof alphaAffiliationSchema>;

/**
 * Research keyword schema for alpha applications.
 */
export const alphaResearchKeywordSchema = z.object({
  label: z.string().min(1).max(100).describe('Keyword label'),
  fastId: z.string().max(20).optional().describe('FAST authority ID'),
  wikidataId: z.string().max(20).optional().describe('Wikidata ID'),
});

export type AlphaResearchKeyword = z.infer<typeof alphaResearchKeywordSchema>;

// ============================================================================
// Apply Endpoint
// ============================================================================

/**
 * Parameters for submitting an alpha application.
 */
export const alphaApplyParamsSchema = z
  .object({
    email: z.string().email().describe('Contact email for notifications'),
    sector: alphaSectorSchema.describe('Organization type'),
    sectorOther: z.string().max(100).optional().describe('Custom sector if "other" selected'),
    careerStage: alphaCareerStageSchema.describe('Career stage/position'),
    careerStageOther: z
      .string()
      .max(100)
      .optional()
      .describe('Custom career stage if "other" selected'),
    affiliations: z
      .array(alphaAffiliationSchema)
      .max(10)
      .optional()
      .describe('Institutional affiliations (optional)'),
    researchKeywords: z
      .array(alphaResearchKeywordSchema)
      .min(1)
      .max(10)
      .describe('Research keywords'),
    motivation: z.string().max(1000).optional().describe('Optional motivation statement'),
  })
  .refine(
    (data) => data.sector !== 'other' || (data.sectorOther && data.sectorOther.trim().length > 0),
    {
      message: 'Please specify your sector',
      path: ['sectorOther'],
    }
  )
  .refine(
    (data) =>
      data.careerStage !== 'other' ||
      (data.careerStageOther && data.careerStageOther.trim().length > 0),
    {
      message: 'Please specify your career stage',
      path: ['careerStageOther'],
    }
  );

export type AlphaApplyParams = z.infer<typeof alphaApplyParamsSchema>;

/**
 * Response for alpha application submission.
 */
export const alphaApplyResponseSchema = z.object({
  applicationId: z.string().uuid(),
  status: alphaStatusSchema,
  createdAt: z.string().datetime(),
});

export type AlphaApplyResponse = z.infer<typeof alphaApplyResponseSchema>;

// ============================================================================
// Check Status Endpoint
// ============================================================================

/**
 * Parameters for checking alpha status (empty - uses authenticated user).
 */
export const alphaCheckStatusParamsSchema = z.object({});

export type AlphaCheckStatusParams = z.infer<typeof alphaCheckStatusParamsSchema>;

/**
 * Response for alpha status check.
 */
export const alphaCheckStatusResponseSchema = z.object({
  status: alphaStatusSchema,
  appliedAt: z.string().datetime().optional(),
  reviewedAt: z.string().datetime().optional(),
});

export type AlphaCheckStatusResponse = z.infer<typeof alphaCheckStatusResponseSchema>;
