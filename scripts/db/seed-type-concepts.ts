#!/usr/bin/env tsx

/**
 * Type concepts seed script.
 *
 * @remarks
 * Seeds the Neo4j knowledge graph with governance-controlled type concepts.
 * These concepts replace hardcoded enums throughout the system.
 *
 * **UUID Identifiers**: All concepts use deterministic UUIDs (v5) generated from
 * a Chive namespace and the human-readable slug. This ensures idempotency -
 * running the script multiple times produces the same UUIDs.
 *
 * Example AT-URI: at://did:plc:chive-governance/pub.chive.graph.concept/550e8400-e29b-41d4-a716-446655440000
 *
 * Categories seeded:
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
 * Uses MERGE on slug to be idempotent - safe to run multiple times.
 * New runs will update existing records without creating duplicates.
 *
 * @see {@link https://www.wikidata.org | Wikidata}
 *
 * @packageDocumentation
 */

import type { Driver, Session } from 'neo4j-driver';

import { createNeo4jDriver, getGovernanceDid } from '../../src/storage/neo4j/setup.js';

import { conceptUuid } from './lib/deterministic-uuid.js';

// =============================================================================
// Types
// =============================================================================

type ConceptCategory =
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

interface ConceptDefinition {
  /** Human-readable slug for lookups (e.g., 'pdf', 'university') */
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly category: ConceptCategory;
  readonly wikidataId?: string;
  readonly lcshId?: string;
  readonly fastId?: string;
  /** Parent slug for hierarchy relationships */
  readonly parentSlug?: string;
}

// =============================================================================
// Document Formats
// =============================================================================

/**
 * Document formats with Wikidata mappings.
 */
const DOCUMENT_FORMAT_CONCEPTS: readonly ConceptDefinition[] = [
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
const PUBLICATION_STATUS_CONCEPTS: readonly ConceptDefinition[] = [
  {
    slug: 'eprint',
    name: 'Eprint',
    description: 'Self-archived scholarly manuscript, not yet submitted for peer review.',
    category: 'publication-status',
    wikidataId: 'Q580922', // Shares Wikidata with preprint as related concept
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
const ACCESS_TYPE_CONCEPTS: readonly ConceptDefinition[] = [
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
const CODE_PLATFORM_CONCEPTS: readonly ConceptDefinition[] = [
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
const DATA_PLATFORM_CONCEPTS: readonly ConceptDefinition[] = [
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
const PREPRINT_PLATFORM_CONCEPTS: readonly ConceptDefinition[] = [
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
const PREREGISTRATION_PLATFORM_CONCEPTS: readonly ConceptDefinition[] = [
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
const PROTOCOL_PLATFORM_CONCEPTS: readonly ConceptDefinition[] = [
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
const SUPPLEMENTARY_TYPE_CONCEPTS: readonly ConceptDefinition[] = [
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
const INSTITUTION_TYPE_CONCEPTS: readonly ConceptDefinition[] = [
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
const RESEARCHER_TYPE_CONCEPTS: readonly ConceptDefinition[] = [
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
const IDENTIFIER_TYPE_CONCEPTS: readonly ConceptDefinition[] = [
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
const PRESENTATION_TYPE_CONCEPTS: readonly ConceptDefinition[] = [
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
// Combined Concepts
// =============================================================================

const ALL_CONCEPTS: readonly ConceptDefinition[] = [
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

// =============================================================================
// Seeding Functions
// =============================================================================

/**
 * Ensure concept constraints exist.
 */
async function ensureConceptConstraints(session: Session): Promise<void> {
  console.log('Ensuring concept constraints...');

  // UUID id constraint
  await session.run(`
    CREATE CONSTRAINT concept_id_unique IF NOT EXISTS
    FOR (c:Concept) REQUIRE c.id IS UNIQUE
  `);

  // Slug constraint (for human-readable lookups)
  await session.run(`
    CREATE CONSTRAINT concept_slug_unique IF NOT EXISTS
    FOR (c:Concept) REQUIRE c.slug IS UNIQUE
  `);

  await session.run(`
    CREATE CONSTRAINT concept_uri_unique IF NOT EXISTS
    FOR (c:Concept) REQUIRE c.uri IS UNIQUE
  `);

  await session.run(`
    CREATE INDEX concept_category_idx IF NOT EXISTS
    FOR (c:Concept) ON (c.category)
  `);

  await session.run(`
    CREATE INDEX concept_status_idx IF NOT EXISTS
    FOR (c:Concept) ON (c.status)
  `);

  await session.run(`
    CREATE INDEX concept_wikidata_idx IF NOT EXISTS
    FOR (c:Concept) ON (c.wikidataId)
  `);

  // Full-text search index
  try {
    await session.run(`
      CREATE FULLTEXT INDEX conceptTextIndex IF NOT EXISTS
      FOR (c:Concept) ON EACH [c.name, c.description]
    `);
  } catch {
    // Index may already exist
    console.log('  Full-text index already exists or could not be created');
  }
}

/**
 * Seed concept values.
 *
 * @remarks
 * Uses MERGE on slug (human-readable identifier) for idempotency.
 * Generates UUID on first creation, preserves it on updates.
 * AT-URI uses the UUID: at://did/pub.chive.graph.concept/{uuid}
 */
async function seedConcepts(session: Session, governanceDid: string): Promise<void> {
  console.log('Seeding type concepts...');

  const counts: Record<string, number> = {};

  for (const concept of ALL_CONCEPTS) {
    // Generate deterministic UUID from slug for idempotency
    const uuid = conceptUuid(concept.slug);

    await session.run(
      `
      MERGE (c:Concept {slug: $slug})
      ON CREATE SET
        c.id = $id,
        c.uri = $uri,
        c.name = $name,
        c.description = $description,
        c.category = $category,
        c.wikidataId = $wikidataId,
        c.lcshId = $lcshId,
        c.fastId = $fastId,
        c.status = 'established',
        c.source = 'seed',
        c.createdAt = datetime()
      ON MATCH SET
        c.name = $name,
        c.description = $description,
        c.wikidataId = $wikidataId,
        c.lcshId = $lcshId,
        c.fastId = $fastId,
        c.updatedAt = datetime()
      `,
      {
        slug: concept.slug,
        id: uuid,
        // URI uses UUID, not slug, per ATProto design
        uri: `at://${governanceDid}/pub.chive.graph.concept/${uuid}`,
        name: concept.name,
        description: concept.description,
        category: concept.category,
        wikidataId: concept.wikidataId ?? null,
        lcshId: concept.lcshId ?? null,
        fastId: concept.fastId ?? null,
      }
    );

    counts[concept.category] = (counts[concept.category] ?? 0) + 1;
  }

  // Create parent-child relationships for concepts with parentSlug
  console.log('Creating concept hierarchy relationships...');
  for (const concept of ALL_CONCEPTS) {
    if (concept.parentSlug) {
      await session.run(
        `
        MATCH (child:Concept {slug: $childSlug})
        MATCH (parent:Concept {slug: $parentSlug})
        MERGE (child)-[:PARENT_CONCEPT]->(parent)
        SET child.parentConceptUri = parent.uri
        `,
        {
          childSlug: concept.slug,
          parentSlug: concept.parentSlug,
        }
      );
    }
  }

  console.log('\nConcepts created by category:');
  for (const [category, count] of Object.entries(counts).sort()) {
    console.log(`  ${category}: ${count}`);
  }
}

/**
 * Main seeding function.
 */
async function main(): Promise<void> {
  const driver: Driver = createNeo4jDriver();
  const governanceDid = getGovernanceDid();

  console.log(`Using governance DID: ${governanceDid}`);

  const session = driver.session();

  try {
    await ensureConceptConstraints(session);
    await seedConcepts(session, governanceDid);

    // Print summary
    const summary = await session.run(`
      MATCH (c:Concept)
      RETURN c.category as category, count(*) as count
      ORDER BY count DESC
    `);

    console.log('\n=== Type Concept Seed Summary ===');
    for (const record of summary.records) {
      console.log(`${record.get('category')}: ${record.get('count')}`);
    }

    const total = await session.run(`MATCH (c:Concept) RETURN count(*) as total`);
    console.log(`Total Concepts: ${total.records[0]?.get('total')}`);

    // Show hierarchy relationships
    const hierarchyCount = await session.run(`
      MATCH ()-[r:PARENT_CONCEPT]->()
      RETURN count(r) as count
    `);
    console.log(`Hierarchy Relationships: ${hierarchyCount.records[0]?.get('count')}`);
    console.log('==================================\n');

    console.log('Type concept seeding complete!');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
