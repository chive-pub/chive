/**
 * Contribution type domain models.
 *
 * @remarks
 * This module defines domain models for contribution types (CRediT taxonomy).
 * In the unified knowledge graph, contribution types are nodes with
 * `kind=type` and `subkind=contribution-type`.
 *
 * @packageDocumentation
 * @public
 */

/**
 * CRediT taxonomy role definition for seeding.
 *
 * @remarks
 * Used for seeding the 14 standard CRediT roles as nodes.
 *
 * @public
 */
export interface CreditRole {
  /**
   * Role identifier (kebab-case).
   */
  readonly id: string;

  /**
   * Human-readable label.
   */
  readonly label: string;

  /**
   * Official CRediT description.
   */
  readonly description: string;

  /**
   * CRediT URI.
   */
  readonly creditUri: string;

  /**
   * CRO identifier (if available).
   */
  readonly croId?: string;
}

/**
 * Standard CRediT taxonomy roles (14 roles).
 *
 * @remarks
 * These are seeded as nodes with `kind=type` and `subkind=contribution-type`.
 *
 * @see {@link https://credit.niso.org/contributor-roles-defined/ | CRediT Roles}
 * @public
 */
export const CREDIT_TAXONOMY: readonly CreditRole[] = [
  {
    id: 'conceptualization',
    label: 'Conceptualization',
    description: 'Ideas; formulation or evolution of overarching research goals and aims',
    creditUri: 'https://credit.niso.org/contributor-roles/conceptualization/',
  },
  {
    id: 'data-curation',
    label: 'Data Curation',
    description:
      'Management activities to annotate (produce metadata), scrub data and maintain research data for initial use and later reuse',
    creditUri: 'https://credit.niso.org/contributor-roles/data-curation/',
  },
  {
    id: 'formal-analysis',
    label: 'Formal Analysis',
    description:
      'Application of statistical, mathematical, computational, or other formal techniques to analyze or synthesize study data',
    creditUri: 'https://credit.niso.org/contributor-roles/formal-analysis/',
  },
  {
    id: 'funding-acquisition',
    label: 'Funding Acquisition',
    description: 'Acquisition of the financial support for the project leading to this publication',
    creditUri: 'https://credit.niso.org/contributor-roles/funding-acquisition/',
  },
  {
    id: 'investigation',
    label: 'Investigation',
    description:
      'Conducting a research and investigation process, specifically performing the experiments, or data/evidence collection',
    creditUri: 'https://credit.niso.org/contributor-roles/investigation/',
  },
  {
    id: 'methodology',
    label: 'Methodology',
    description: 'Development or design of methodology; creation of models',
    creditUri: 'https://credit.niso.org/contributor-roles/methodology/',
  },
  {
    id: 'project-administration',
    label: 'Project Administration',
    description:
      'Management and coordination responsibility for the research activity planning and execution',
    creditUri: 'https://credit.niso.org/contributor-roles/project-administration/',
  },
  {
    id: 'resources',
    label: 'Resources',
    description:
      'Provision of study materials, reagents, materials, patients, laboratory samples, animals, instrumentation, computing resources, or other analysis tools',
    creditUri: 'https://credit.niso.org/contributor-roles/resources/',
  },
  {
    id: 'software',
    label: 'Software',
    description:
      'Programming, software development; designing computer programs; implementation of the computer code and supporting algorithms; testing of existing code components',
    creditUri: 'https://credit.niso.org/contributor-roles/software/',
  },
  {
    id: 'supervision',
    label: 'Supervision',
    description:
      'Oversight and leadership responsibility for the research activity planning and execution, including mentorship external to the core team',
    creditUri: 'https://credit.niso.org/contributor-roles/supervision/',
  },
  {
    id: 'validation',
    label: 'Validation',
    description:
      'Verification, whether as a part of the activity or separate, of the overall replication/reproducibility of results/experiments and other research outputs',
    creditUri: 'https://credit.niso.org/contributor-roles/validation/',
  },
  {
    id: 'visualization',
    label: 'Visualization',
    description:
      'Preparation, creation and/or presentation of the published work, specifically visualization/data presentation',
    creditUri: 'https://credit.niso.org/contributor-roles/visualization/',
  },
  {
    id: 'writing-original-draft',
    label: 'Writing - Original Draft',
    description:
      'Preparation, creation and/or presentation of the published work, specifically writing the initial draft (including substantive translation)',
    creditUri: 'https://credit.niso.org/contributor-roles/writing-original-draft/',
  },
  {
    id: 'writing-review-editing',
    label: 'Writing - Review & Editing',
    description:
      'Preparation, creation and/or presentation of the published work by those from the original research group, specifically critical review, commentary or revision – including pre- or post-publication stages',
    creditUri: 'https://credit.niso.org/contributor-roles/writing-review-editing/',
  },
] as const;

/**
 * Contribution degree levels.
 *
 * @remarks
 * Indicates the level of contribution for a given role.
 * These are seeded as nodes with `kind=type` and `subkind=contribution-degree`.
 *
 * @public
 */
export const CONTRIBUTION_DEGREES = [
  { id: 'lead', label: 'Lead', description: 'Primary contributor for this role' },
  { id: 'equal', label: 'Equal', description: 'Equal contribution with other contributors' },
  { id: 'supporting', label: 'Supporting', description: 'Supporting or secondary contribution' },
] as const;

/**
 * Contribution degree type.
 *
 * @public
 */
export type ContributionDegree = (typeof CONTRIBUTION_DEGREES)[number]['id'];
