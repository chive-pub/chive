/**
 * Type concepts data.
 *
 * @remarks
 * Governance-controlled type concepts replacing hardcoded enums.
 * All concepts use deterministic UUIDs (v5) for idempotency.
 *
 * Categories:
 * - contribution-type: 14 CRediT contributor roles (ANSI/NISO Z39.104-2022)
 * - document-format: 8 document formats (PDF, LaTeX, Jupyter, etc.)
 * - publication-status: 9 publication states
 * - access-type: 7 access models
 * - platform-code: 10 code hosting platforms (GitHub, GitLab, etc.)
 * - platform-data: 9 data repository platforms (Zenodo, Figshare, etc.)
 * - platform-preprint: 8 preprint servers (arXiv, bioRxiv, etc.)
 * - platform-preregistration: 5 pre-registration platforms (OSF, ClinicalTrials, etc.)
 * - platform-protocol: 3 protocol repositories (protocols.io, etc.)
 * - supplementary-type: 13 supplementary material types
 * - institution-type: 10 organization types
 * - researcher-type: 7 researcher positions
 * - identifier-type: 10 identifier systems
 * - presentation-type: 6 conference presentation types
 *
 * @see {@link https://www.niso.org/publications/z39104-2022-credit | ANSI/NISO Z39.104-2022 CRediT}
 * @see {@link https://credit.niso.org/contributor-roles-defined/ | CRediT Role Definitions}
 * @see {@link https://www.wikidata.org | Wikidata}
 *
 * @packageDocumentation
 */

export type ConceptCategory =
  | 'contribution-type'
  | 'institution-type'
  | 'paper-type'
  | 'methodology'
  | 'geographic-scope'
  | 'temporal-scope'
  | 'document-format'
  | 'publication-status'
  | 'access-type'
  | 'platform-code'
  | 'platform-data'
  | 'platform-preregistration'
  | 'platform-protocol'
  | 'platform-preprint'
  | 'supplementary-type'
  | 'researcher-type'
  | 'identifier-type'
  | 'presentation-type';

export interface ConceptDefinition {
  /** Human-readable slug for lookups (e.g., 'pdf', 'university') */
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly category: ConceptCategory;
  readonly wikidataId?: string;
  readonly lcshId?: string;
  readonly fastId?: string;
  /** CRediT taxonomy URI (for contribution-type category) */
  readonly creditUri?: string;
  /** Contributor Role Ontology URI (for contribution-type category) */
  readonly croUri?: string;
  /** Parent slug for hierarchy relationships */
  readonly parentSlug?: string;
}

// =============================================================================
// CRediT Contribution Types
// =============================================================================

/**
 * CRediT Contribution Types per ANSI/NISO Z39.104-2022.
 *
 * @remarks
 * 14 standard contributor roles from the NISO CRediT taxonomy.
 * URIs follow the official pattern: `https://credit.niso.org/contributor-roles/{role}/`
 * CRO URIs link to the Contributor Role Ontology for semantic interoperability.
 *
 * @see {@link https://www.niso.org/publications/z39104-2022-credit | ANSI/NISO Z39.104-2022}
 * @see {@link https://credit.niso.org/contributor-roles-defined/ | CRediT Role Definitions}
 */
export const CONTRIBUTION_TYPE_CONCEPTS: readonly ConceptDefinition[] = [
  {
    slug: 'conceptualization',
    name: 'Conceptualization',
    description: 'Ideas; formulation or evolution of overarching research goals and aims.',
    category: 'contribution-type',
    creditUri: 'https://credit.niso.org/contributor-roles/conceptualization/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000064',
  },
  {
    slug: 'data-curation',
    name: 'Data Curation',
    description:
      'Management activities to annotate (produce metadata), scrub data and maintain research data for initial use and later re-use.',
    category: 'contribution-type',
    creditUri: 'https://credit.niso.org/contributor-roles/data-curation/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000025',
  },
  {
    slug: 'formal-analysis',
    name: 'Formal Analysis',
    description:
      'Application of statistical, mathematical, computational, or other formal techniques to analyze or synthesize study data.',
    category: 'contribution-type',
    creditUri: 'https://credit.niso.org/contributor-roles/formal-analysis/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000006',
  },
  {
    slug: 'funding-acquisition',
    name: 'Funding Acquisition',
    description:
      'Acquisition of the financial support for the project leading to this publication.',
    category: 'contribution-type',
    creditUri: 'https://credit.niso.org/contributor-roles/funding-acquisition/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000020',
  },
  {
    slug: 'investigation',
    name: 'Investigation',
    description:
      'Conducting a research and investigation process, specifically performing the experiments, or data/evidence collection.',
    category: 'contribution-type',
    creditUri: 'https://credit.niso.org/contributor-roles/investigation/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000052',
  },
  {
    slug: 'methodology',
    name: 'Methodology',
    description: 'Development or design of methodology; creation of models.',
    category: 'contribution-type',
    creditUri: 'https://credit.niso.org/contributor-roles/methodology/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000029',
  },
  {
    slug: 'project-administration',
    name: 'Project Administration',
    description:
      'Management and coordination responsibility for the research activity planning and execution.',
    category: 'contribution-type',
    creditUri: 'https://credit.niso.org/contributor-roles/project-administration/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000053',
  },
  {
    slug: 'resources',
    name: 'Resources',
    description:
      'Provision of study materials, reagents, materials, patients, laboratory samples, animals, instrumentation, computing resources, or other analysis tools.',
    category: 'contribution-type',
    creditUri: 'https://credit.niso.org/contributor-roles/resources/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000054',
  },
  {
    slug: 'software',
    name: 'Software',
    description:
      'Programming, software development; designing computer programs; implementation of the computer code and supporting algorithms; testing of existing code components.',
    category: 'contribution-type',
    creditUri: 'https://credit.niso.org/contributor-roles/software/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000015',
  },
  {
    slug: 'supervision',
    name: 'Supervision',
    description:
      'Oversight and leadership responsibility for the research activity planning and execution, including mentorship external to the core team.',
    category: 'contribution-type',
    creditUri: 'https://credit.niso.org/contributor-roles/supervision/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000055',
  },
  {
    slug: 'validation',
    name: 'Validation',
    description:
      'Verification, whether as a part of the activity or separate, of the overall replication/reproducibility of results/experiments and other research outputs.',
    category: 'contribution-type',
    creditUri: 'https://credit.niso.org/contributor-roles/validation/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000056',
  },
  {
    slug: 'visualization',
    name: 'Visualization',
    description:
      'Preparation, creation and/or presentation of the published work, specifically visualization/data presentation.',
    category: 'contribution-type',
    creditUri: 'https://credit.niso.org/contributor-roles/visualization/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000059',
  },
  {
    slug: 'writing-original-draft',
    name: 'Writing - Original Draft',
    description:
      'Preparation, creation and/or presentation of the published work, specifically writing the initial draft.',
    category: 'contribution-type',
    creditUri: 'https://credit.niso.org/contributor-roles/writing-original-draft/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000057',
  },
  {
    slug: 'writing-review-editing',
    name: 'Writing - Review & Editing',
    description:
      'Preparation, creation and/or presentation of the published work by those from the original research group, specifically critical review, commentary or revision.',
    category: 'contribution-type',
    creditUri: 'https://credit.niso.org/contributor-roles/writing-review-editing/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000058',
  },
];

// =============================================================================
// Document Formats
// =============================================================================

/**
 * Document formats with Wikidata mappings.
 */
export const DOCUMENT_FORMAT_CONCEPTS: readonly ConceptDefinition[] = [
  {
    slug: 'pdf',
    name: 'PDF',
    description: 'Portable Document Format - fixed-layout document format.',
    category: 'document-format',
    wikidataId: 'Q42332',
  },
  {
    slug: 'latex',
    name: 'LaTeX',
    description: 'Document preparation system for typesetting.',
    category: 'document-format',
    wikidataId: 'Q5310',
  },
  {
    slug: 'jupyter-notebook',
    name: 'Jupyter Notebook',
    description: 'Interactive computational document combining code, text, and visualizations.',
    category: 'document-format',
    wikidataId: 'Q55630549',
  },
  {
    slug: 'docx',
    name: 'Microsoft Word (DOCX)',
    description: 'Office Open XML document format for word processing.',
    category: 'document-format',
    wikidataId: 'Q27203404',
  },
  {
    slug: 'html',
    name: 'HTML',
    description: 'HyperText Markup Language for web documents.',
    category: 'document-format',
    wikidataId: 'Q8811',
  },
  {
    slug: 'markdown',
    name: 'Markdown',
    description: 'Lightweight markup language for plain text formatting.',
    category: 'document-format',
    wikidataId: 'Q1193600',
  },
  {
    slug: 'odt',
    name: 'OpenDocument (ODT)',
    description: 'Open Document Format for word processing.',
    category: 'document-format',
    wikidataId: 'Q27203973',
  },
  {
    slug: 'epub',
    name: 'EPUB',
    description: 'Electronic publication format for ebooks.',
    category: 'document-format',
    wikidataId: 'Q475488',
  },
];

// =============================================================================
// Publication Status
// =============================================================================

/**
 * Publication status values with Wikidata mappings.
 */
export const PUBLICATION_STATUS_CONCEPTS: readonly ConceptDefinition[] = [
  {
    slug: 'eprint',
    name: 'Eprint',
    description: 'Self-archived scholarly manuscript, not yet submitted for peer review.',
    category: 'publication-status',
    wikidataId: 'Q580922',
  },
  {
    slug: 'preprint',
    name: 'Preprint',
    description: 'Manuscript shared before formal peer review.',
    category: 'publication-status',
    wikidataId: 'Q580922',
  },
  {
    slug: 'under-review',
    name: 'Under Review',
    description: 'Manuscript currently undergoing peer review.',
    category: 'publication-status',
  },
  {
    slug: 'revision-requested',
    name: 'Revision Requested',
    description: 'Manuscript returned to authors for revisions after peer review.',
    category: 'publication-status',
  },
  {
    slug: 'accepted',
    name: 'Accepted',
    description: 'Manuscript accepted for publication after peer review.',
    category: 'publication-status',
  },
  {
    slug: 'in-press',
    name: 'In Press',
    description: 'Accepted manuscript being prepared for publication.',
    category: 'publication-status',
  },
  {
    slug: 'published',
    name: 'Published',
    description: 'Work formally published in a venue.',
    category: 'publication-status',
  },
  {
    slug: 'retracted',
    name: 'Retracted',
    description: 'Publication withdrawn due to errors or misconduct.',
    category: 'publication-status',
    wikidataId: 'Q45182324',
  },
  {
    slug: 'withdrawn',
    name: 'Withdrawn',
    description: 'Manuscript withdrawn by author before publication.',
    category: 'publication-status',
  },
];

// =============================================================================
// Access Types
// =============================================================================

/**
 * Access type models with Wikidata mappings.
 */
export const ACCESS_TYPE_CONCEPTS: readonly ConceptDefinition[] = [
  {
    slug: 'open-access',
    name: 'Open Access',
    description: 'Freely available without subscription or payment.',
    category: 'access-type',
    wikidataId: 'Q232932',
  },
  {
    slug: 'gold-open-access',
    name: 'Gold Open Access',
    description: 'Open access via publisher with article processing charges.',
    category: 'access-type',
    wikidataId: 'Q30893612',
    parentSlug: 'open-access',
  },
  {
    slug: 'green-open-access',
    name: 'Green Open Access',
    description: 'Open access via self-archiving in repository.',
    category: 'access-type',
    wikidataId: 'Q30893656',
    parentSlug: 'open-access',
  },
  {
    slug: 'hybrid-open-access',
    name: 'Hybrid Open Access',
    description: 'Open access article in subscription journal.',
    category: 'access-type',
    wikidataId: 'Q30893609',
    parentSlug: 'open-access',
  },
  {
    slug: 'bronze-open-access',
    name: 'Bronze Open Access',
    description: 'Free to read on publisher site but without open license.',
    category: 'access-type',
    wikidataId: 'Q63065597',
    parentSlug: 'open-access',
  },
  {
    slug: 'closed-access',
    name: 'Closed Access',
    description: 'Access restricted to subscribers or purchasers.',
    category: 'access-type',
    wikidataId: 'Q116847925',
  },
  {
    slug: 'embargoed',
    name: 'Embargoed',
    description: 'Temporarily restricted, becoming open after embargo period.',
    category: 'access-type',
  },
];

// =============================================================================
// Code Platforms
// =============================================================================

/**
 * Code hosting platforms with Wikidata mappings.
 */
export const CODE_PLATFORM_CONCEPTS: readonly ConceptDefinition[] = [
  {
    slug: 'github',
    name: 'GitHub',
    description: 'Code hosting platform for version control and collaboration.',
    category: 'platform-code',
    wikidataId: 'Q364',
  },
  {
    slug: 'gitlab',
    name: 'GitLab',
    description: 'DevOps platform with Git repository management.',
    category: 'platform-code',
    wikidataId: 'Q16639197',
  },
  {
    slug: 'bitbucket',
    name: 'Bitbucket',
    description: 'Git repository hosting service by Atlassian.',
    category: 'platform-code',
    wikidataId: 'Q2493781',
  },
  {
    slug: 'codeberg',
    name: 'Codeberg',
    description: 'Free and open-source Git hosting service.',
    category: 'platform-code',
    wikidataId: 'Q79145161',
  },
  {
    slug: 'sourcehut',
    name: 'SourceHut',
    description: 'Minimalist code hosting platform.',
    category: 'platform-code',
    wikidataId: 'Q65093956',
  },
  {
    slug: 'software-heritage',
    name: 'Software Heritage',
    description: 'Universal archive for software source code.',
    category: 'platform-code',
    wikidataId: 'Q23791193',
  },
  {
    slug: 'huggingface-code',
    name: 'Hugging Face',
    description: 'Platform for machine learning models and code.',
    category: 'platform-code',
    wikidataId: 'Q108943604',
  },
  {
    slug: 'kaggle-code',
    name: 'Kaggle',
    description: 'Data science platform with code notebooks.',
    category: 'platform-code',
    wikidataId: 'Q21652686',
  },
  {
    slug: 'colab',
    name: 'Google Colab',
    description: 'Cloud-based Jupyter notebook environment.',
    category: 'platform-code',
    wikidataId: 'Q56823884',
  },
  {
    slug: 'paperswithcode',
    name: 'Papers With Code',
    description: 'Platform linking papers with implementation code.',
    category: 'platform-code',
    wikidataId: 'Q98968941',
  },
];

// =============================================================================
// Data Platforms
// =============================================================================

/**
 * Data repository platforms with Wikidata mappings.
 */
export const DATA_PLATFORM_CONCEPTS: readonly ConceptDefinition[] = [
  {
    slug: 'zenodo',
    name: 'Zenodo',
    description: 'General-purpose open repository operated by CERN.',
    category: 'platform-data',
    wikidataId: 'Q22661177',
  },
  {
    slug: 'figshare',
    name: 'Figshare',
    description: 'Repository for research outputs including datasets and figures.',
    category: 'platform-data',
    wikidataId: 'Q22907194',
  },
  {
    slug: 'dryad',
    name: 'Dryad',
    description: 'Curated digital repository for research data.',
    category: 'platform-data',
    wikidataId: 'Q17078663',
  },
  {
    slug: 'osf-data',
    name: 'OSF',
    description: 'Open Science Framework for research data.',
    category: 'platform-data',
    wikidataId: 'Q25713029',
  },
  {
    slug: 'dataverse',
    name: 'Dataverse',
    description: 'Open source web application for sharing research data.',
    category: 'platform-data',
    wikidataId: 'Q5227102',
  },
  {
    slug: 'mendeley-data',
    name: 'Mendeley Data',
    description: 'Research data repository by Elsevier.',
    category: 'platform-data',
    wikidataId: 'Q29032495',
  },
  {
    slug: 'huggingface-data',
    name: 'Hugging Face',
    description: 'Platform for machine learning datasets.',
    category: 'platform-data',
    wikidataId: 'Q108943604',
  },
  {
    slug: 'kaggle-data',
    name: 'Kaggle',
    description: 'Data science platform with datasets.',
    category: 'platform-data',
    wikidataId: 'Q21652686',
  },
  {
    slug: 'wandb',
    name: 'Weights & Biases',
    description: 'ML experiment tracking and model registry.',
    category: 'platform-data',
    wikidataId: 'Q107431107',
  },
];

// =============================================================================
// Preprint Platforms
// =============================================================================

/**
 * Preprint server platforms with Wikidata mappings.
 */
export const PREPRINT_PLATFORM_CONCEPTS: readonly ConceptDefinition[] = [
  {
    slug: 'arxiv',
    name: 'arXiv',
    description: 'Open-access repository for scientific preprints.',
    category: 'platform-preprint',
    wikidataId: 'Q118398',
  },
  {
    slug: 'biorxiv',
    name: 'bioRxiv',
    description: 'Preprint server for biological sciences.',
    category: 'platform-preprint',
    wikidataId: 'Q19835482',
  },
  {
    slug: 'medrxiv',
    name: 'medRxiv',
    description: 'Preprint server for health sciences.',
    category: 'platform-preprint',
    wikidataId: 'Q66640488',
  },
  {
    slug: 'ssrn',
    name: 'SSRN',
    description: 'Social Science Research Network preprint server.',
    category: 'platform-preprint',
    wikidataId: 'Q7550801',
  },
  {
    slug: 'osf-preprints',
    name: 'OSF Preprints',
    description: 'Open Science Framework preprint service.',
    category: 'platform-preprint',
    wikidataId: 'Q25713029',
  },
  {
    slug: 'eartharxiv',
    name: 'EarthArXiv',
    description: 'Preprint server for earth sciences.',
    category: 'platform-preprint',
    wikidataId: 'Q56478267',
  },
  {
    slug: 'psyarxiv',
    name: 'PsyArXiv',
    description: 'Preprint server for psychological sciences.',
    category: 'platform-preprint',
    wikidataId: 'Q56478251',
  },
  {
    slug: 'socarxiv',
    name: 'SocArXiv',
    description: 'Preprint server for social sciences.',
    category: 'platform-preprint',
    wikidataId: 'Q56478238',
  },
];

// =============================================================================
// Preregistration Platforms
// =============================================================================

/**
 * Pre-registration and registered report platforms.
 */
export const PREREGISTRATION_PLATFORM_CONCEPTS: readonly ConceptDefinition[] = [
  {
    slug: 'osf-prereg',
    name: 'OSF Registrations',
    description: 'Open Science Framework for pre-registrations.',
    category: 'platform-preregistration',
    wikidataId: 'Q25713029',
  },
  {
    slug: 'aspredicted',
    name: 'AsPredicted',
    description: 'Pre-registration platform for research studies.',
    category: 'platform-preregistration',
  },
  {
    slug: 'clinicaltrials',
    name: 'ClinicalTrials.gov',
    description: 'Registry of clinical research studies.',
    category: 'platform-preregistration',
    wikidataId: 'Q5133746',
  },
  {
    slug: 'prospero',
    name: 'PROSPERO',
    description: 'International prospective register of systematic reviews.',
    category: 'platform-preregistration',
    wikidataId: 'Q28133417',
  },
  {
    slug: 'anzctr',
    name: 'ANZCTR',
    description: 'Australian New Zealand Clinical Trials Registry.',
    category: 'platform-preregistration',
    wikidataId: 'Q4777251',
  },
];

// =============================================================================
// Protocol Platforms
// =============================================================================

/**
 * Protocol repository platforms.
 */
export const PROTOCOL_PLATFORM_CONCEPTS: readonly ConceptDefinition[] = [
  {
    slug: 'protocols-io',
    name: 'protocols.io',
    description: 'Open access repository for scientific methods and protocols.',
    category: 'platform-protocol',
    wikidataId: 'Q56256113',
  },
  {
    slug: 'bio-protocol',
    name: 'Bio-protocol',
    description: 'Peer-reviewed protocol journal and repository.',
    category: 'platform-protocol',
    wikidataId: 'Q60267627',
  },
  {
    slug: 'nature-protocols',
    name: 'Nature Protocols',
    description: 'Journal for detailed experimental protocols.',
    category: 'platform-protocol',
    wikidataId: 'Q2015821',
  },
];

// =============================================================================
// Supplementary Types
// =============================================================================

/**
 * Supplementary material types with Wikidata mappings.
 */
export const SUPPLEMENTARY_TYPE_CONCEPTS: readonly ConceptDefinition[] = [
  {
    slug: 'dataset',
    name: 'Dataset',
    description: 'Collection of data for research use.',
    category: 'supplementary-type',
    wikidataId: 'Q1172284',
  },
  {
    slug: 'source-code',
    name: 'Source Code',
    description: 'Computer program or script for research.',
    category: 'supplementary-type',
    wikidataId: 'Q80006',
  },
  {
    slug: 'video',
    name: 'Video',
    description: 'Audio-visual recording or demonstration.',
    category: 'supplementary-type',
    wikidataId: 'Q34508',
  },
  {
    slug: 'figure',
    name: 'Figure',
    description: 'Image, chart, or diagram visualizing data.',
    category: 'supplementary-type',
    wikidataId: 'Q478798',
  },
  {
    slug: 'appendix',
    name: 'Appendix',
    description: 'Supplementary information extending the main text.',
    category: 'supplementary-type',
    wikidataId: 'Q1376568',
  },
  {
    slug: 'notebook',
    name: 'Computational Notebook',
    description: 'Interactive document with code, results, and narrative.',
    category: 'supplementary-type',
    wikidataId: 'Q55630549',
  },
  {
    slug: 'protocol',
    name: 'Protocol',
    description: 'Detailed experimental procedure or methodology.',
    category: 'supplementary-type',
    wikidataId: 'Q2101564',
  },
  {
    slug: 'model',
    name: 'Model',
    description: 'Trained machine learning model or simulation.',
    category: 'supplementary-type',
  },
  {
    slug: 'table',
    name: 'Table',
    description: 'Data presented in tabular format.',
    category: 'supplementary-type',
    wikidataId: 'Q496946',
  },
  {
    slug: 'audio',
    name: 'Audio',
    description: 'Audio recording or sound file.',
    category: 'supplementary-type',
    wikidataId: 'Q106428747',
  },
  {
    slug: 'presentation',
    name: 'Presentation',
    description: 'Slide deck or presentation materials.',
    category: 'supplementary-type',
    wikidataId: 'Q604733',
  },
  {
    slug: 'questionnaire',
    name: 'Questionnaire',
    description: 'Survey instrument or questionnaire.',
    category: 'supplementary-type',
    wikidataId: 'Q895992',
  },
  {
    slug: 'supplementary-other',
    name: 'Other Supplementary Material',
    description: 'Supplementary material not covered by other categories.',
    category: 'supplementary-type',
  },
];

// =============================================================================
// Institution Types
// =============================================================================

/**
 * Institution types with Wikidata mappings.
 */
export const INSTITUTION_TYPE_CONCEPTS: readonly ConceptDefinition[] = [
  {
    slug: 'university',
    name: 'University',
    description: 'Higher education institution offering degrees.',
    category: 'institution-type',
    wikidataId: 'Q3918',
  },
  {
    slug: 'research-institute',
    name: 'Research Institute',
    description: 'Organization dedicated to scientific research.',
    category: 'institution-type',
    wikidataId: 'Q31855',
  },
  {
    slug: 'laboratory',
    name: 'Laboratory',
    description: 'Facility for scientific experimentation.',
    category: 'institution-type',
    wikidataId: 'Q483242',
  },
  {
    slug: 'company',
    name: 'Company',
    description: 'Commercial business organization.',
    category: 'institution-type',
    wikidataId: 'Q4830453',
  },
  {
    slug: 'hospital',
    name: 'Hospital',
    description: 'Healthcare facility providing medical services.',
    category: 'institution-type',
    wikidataId: 'Q16917',
  },
  {
    slug: 'government-agency',
    name: 'Government Agency',
    description: 'Public sector organization.',
    category: 'institution-type',
    wikidataId: 'Q327333',
  },
  {
    slug: 'nonprofit',
    name: 'Nonprofit Organization',
    description: 'Organization operating for purposes other than profit.',
    category: 'institution-type',
    wikidataId: 'Q163740',
  },
  {
    slug: 'funding-body',
    name: 'Funding Body',
    description: 'Organization providing research grants.',
    category: 'institution-type',
    wikidataId: 'Q1714374',
  },
  {
    slug: 'publisher',
    name: 'Publisher',
    description: 'Organization publishing scholarly works.',
    category: 'institution-type',
    wikidataId: 'Q2085381',
  },
  {
    slug: 'consortium',
    name: 'Research Consortium',
    description: 'Group of organizations collaborating on research.',
    category: 'institution-type',
    wikidataId: 'Q1325119',
  },
];

// =============================================================================
// Researcher Types
// =============================================================================

/**
 * Researcher position types with Wikidata mappings.
 */
export const RESEARCHER_TYPE_CONCEPTS: readonly ConceptDefinition[] = [
  {
    slug: 'faculty',
    name: 'Faculty',
    description: 'Academic staff member (professor, lecturer).',
    category: 'researcher-type',
    wikidataId: 'Q1622272',
  },
  {
    slug: 'postdoc',
    name: 'Postdoctoral Researcher',
    description: 'Researcher holding a doctorate in temporary position.',
    category: 'researcher-type',
    wikidataId: 'Q188862',
  },
  {
    slug: 'phd-student',
    name: 'PhD Student',
    description: 'Doctoral candidate pursuing a PhD degree.',
    category: 'researcher-type',
    wikidataId: 'Q28695116',
  },
  {
    slug: 'research-scientist',
    name: 'Research Scientist',
    description: 'Non-faculty research position.',
    category: 'researcher-type',
    wikidataId: 'Q901',
  },
  {
    slug: 'industry-researcher',
    name: 'Industry Researcher',
    description: 'Researcher employed in private sector.',
    category: 'researcher-type',
  },
  {
    slug: 'independent-researcher',
    name: 'Independent Researcher',
    description: 'Researcher not affiliated with an institution.',
    category: 'researcher-type',
    wikidataId: 'Q18576619',
  },
  {
    slug: 'masters-student',
    name: "Master's Student",
    description: "Student pursuing a master's degree.",
    category: 'researcher-type',
    wikidataId: 'Q28695119',
  },
];

// =============================================================================
// Identifier Types
// =============================================================================

/**
 * Identifier systems with Wikidata mappings.
 */
export const IDENTIFIER_TYPE_CONCEPTS: readonly ConceptDefinition[] = [
  {
    slug: 'doi',
    name: 'DOI',
    description: 'Digital Object Identifier for persistent identification.',
    category: 'identifier-type',
    wikidataId: 'Q25670',
  },
  {
    slug: 'arxiv-id',
    name: 'arXiv ID',
    description: 'Identifier for arXiv preprints.',
    category: 'identifier-type',
    wikidataId: 'Q118398',
  },
  {
    slug: 'pmid',
    name: 'PMID',
    description: 'PubMed unique identifier.',
    category: 'identifier-type',
    wikidataId: 'Q2140879',
  },
  {
    slug: 'pmcid',
    name: 'PMCID',
    description: 'PubMed Central identifier.',
    category: 'identifier-type',
    wikidataId: 'Q21685851',
  },
  {
    slug: 'isbn',
    name: 'ISBN',
    description: 'International Standard Book Number.',
    category: 'identifier-type',
    wikidataId: 'Q33057',
  },
  {
    slug: 'issn',
    name: 'ISSN',
    description: 'International Standard Serial Number.',
    category: 'identifier-type',
    wikidataId: 'Q131276',
  },
  {
    slug: 'orcid',
    name: 'ORCID',
    description: 'Open Researcher and Contributor ID.',
    category: 'identifier-type',
    wikidataId: 'Q51044',
  },
  {
    slug: 'ror',
    name: 'ROR',
    description: 'Research Organization Registry identifier.',
    category: 'identifier-type',
    wikidataId: 'Q64413744',
  },
  {
    slug: 'handle',
    name: 'Handle',
    description: 'Handle System identifier for digital objects.',
    category: 'identifier-type',
    wikidataId: 'Q3126718',
  },
  {
    slug: 'urn',
    name: 'URN',
    description: 'Uniform Resource Name.',
    category: 'identifier-type',
    wikidataId: 'Q15606652',
  },
];

// =============================================================================
// Presentation Types
// =============================================================================

/**
 * Conference presentation types with Wikidata mappings.
 */
export const PRESENTATION_TYPE_CONCEPTS: readonly ConceptDefinition[] = [
  {
    slug: 'oral-presentation',
    name: 'Oral Presentation',
    description: 'Spoken presentation at a conference or symposium.',
    category: 'presentation-type',
    wikidataId: 'Q604733',
  },
  {
    slug: 'poster-presentation',
    name: 'Poster Presentation',
    description: 'Visual presentation displayed at a conference.',
    category: 'presentation-type',
    wikidataId: 'Q429785',
  },
  {
    slug: 'keynote',
    name: 'Keynote',
    description: 'Featured or invited presentation at a conference.',
    category: 'presentation-type',
    wikidataId: 'Q960189',
  },
  {
    slug: 'workshop',
    name: 'Workshop',
    description: 'Interactive session with hands-on activities.',
    category: 'presentation-type',
    wikidataId: 'Q16051166',
  },
  {
    slug: 'demo',
    name: 'Demo',
    description: 'Demonstration of software, system, or technique.',
    category: 'presentation-type',
    wikidataId: 'Q4157632',
  },
  {
    slug: 'presentation-other',
    name: 'Other Presentation',
    description: 'Presentation type not covered by other categories.',
    category: 'presentation-type',
  },
];

// =============================================================================
// Combined Concepts Export
// =============================================================================

export const ALL_CONCEPTS: readonly ConceptDefinition[] = [
  ...CONTRIBUTION_TYPE_CONCEPTS,
  ...DOCUMENT_FORMAT_CONCEPTS,
  ...PUBLICATION_STATUS_CONCEPTS,
  ...ACCESS_TYPE_CONCEPTS,
  ...CODE_PLATFORM_CONCEPTS,
  ...DATA_PLATFORM_CONCEPTS,
  ...PREPRINT_PLATFORM_CONCEPTS,
  ...PREREGISTRATION_PLATFORM_CONCEPTS,
  ...PROTOCOL_PLATFORM_CONCEPTS,
  ...SUPPLEMENTARY_TYPE_CONCEPTS,
  ...INSTITUTION_TYPE_CONCEPTS,
  ...RESEARCHER_TYPE_CONCEPTS,
  ...IDENTIFIER_TYPE_CONCEPTS,
  ...PRESENTATION_TYPE_CONCEPTS,
];
