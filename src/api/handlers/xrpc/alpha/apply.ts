/**
 * Handler for pub.chive.alpha.apply.
 *
 * @remarks
 * Submits an alpha tester application. Requires authentication.
 *
 * @packageDocumentation
 * @public
 */

// Use generated types from lexicons
import type {
  InputSchema,
  OutputSchema,
} from '../../../../lexicons/generated/types/pub/chive/alpha/apply.js';
import { AuthenticationError, ValidationError } from '../../../../types/errors.js';
import type { XRPCMethod, XRPCResponse } from '../../../xrpc/types.js';

/**
 * Simple email validation regex.
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * XRPC method for pub.chive.alpha.apply.
 *
 * @public
 */
export const apply: XRPCMethod<void, InputSchema, OutputSchema> = {
  type: 'procedure',
  auth: true,
  handler: async ({ input, c }): Promise<XRPCResponse<OutputSchema>> => {
    const logger = c.get('logger');
    const user = c.get('user');
    const alphaService = c.get('alphaService');

    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!input) {
      throw new ValidationError('Input is required', 'input');
    }
    const params = input;

    // Validate email format
    if (!params.email || !EMAIL_REGEX.test(params.email)) {
      throw new ValidationError('Invalid email format', 'email');
    }

    logger.debug('Processing alpha application', {
      did: user.did,
      sector: params.sector,
      careerStage: params.careerStage,
      affiliationCount: params.affiliations?.length ?? 0,
      keywordCount: params.researchKeywords.length,
    });

    // Cast lexicon types to service types (lexicon uses (string & {}) for extensibility)
    type ServiceSector =
      | 'academia'
      | 'industry'
      | 'government'
      | 'nonprofit'
      | 'healthcare'
      | 'independent'
      | 'other';
    type ServiceCareerStage =
      | 'undergraduate'
      | 'graduate-masters'
      | 'graduate-phd'
      | 'postdoc'
      | 'research-staff'
      | 'junior-faculty'
      | 'senior-faculty'
      | 'research-admin'
      | 'librarian'
      | 'science-communicator'
      | 'policy-professional'
      | 'retired'
      | 'other';

    const application = await alphaService.apply({
      did: user.did,
      handle: user.handle,
      email: params.email,
      sector: params.sector as ServiceSector,
      sectorOther: params.sectorOther,
      careerStage: params.careerStage as ServiceCareerStage,
      careerStageOther: params.careerStageOther,
      affiliations: params.affiliations,
      researchKeywords: params.researchKeywords,
      motivation: params.motivation,
    });

    return {
      encoding: 'application/json',
      body: {
        applicationId: application.id,
        status: application.status,
        createdAt: application.createdAt.toISOString(),
      },
    };
  },
};
