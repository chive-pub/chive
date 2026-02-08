/**
 * CRediT (Contributor Roles Taxonomy) fallback data.
 *
 * @remarks
 * This is the canonical source for CRediT contribution type fallback data
 * in the frontend. All components that need CRediT types should import
 * from here rather than defining their own copies.
 *
 * The primary data source is the knowledge graph (via useContributionTypes hook).
 * This file provides fallback data for offline mode or initial render.
 *
 * @see {@link https://credit.niso.org/contributor-roles-defined/ | NISO CRediT}
 * @packageDocumentation
 */

/**
 * Graph PDS DID for CRediT contribution type nodes.
 *
 * @remarks
 * This DID is used for constructing AT-URIs to graph nodes.
 * The actual DID should match the deployed graph PDS.
 */
export const GRAPH_PDS_DID = 'did:plc:5wzpn4a4nbqtz3q45hyud6hd';

/**
 * CRediT contribution type for frontend display.
 */
export interface CreditType {
  /** AT-URI of the contribution type node */
  uri: string;
  /** Unique identifier (kebab-case) */
  id: string;
  /** Human-readable label */
  label: string;
  /** Description of the contribution type */
  description: string;
  /** NISO CRediT URI */
  creditUri: string;
  /** CRO (Contributor Role Ontology) URI */
  croUri: string;
  /** Status in the system */
  status: 'established' | 'provisional' | 'deprecated';
}

/**
 * Standard CRediT taxonomy (14 roles) with AT-URIs.
 *
 * @remarks
 * UUIDs are deterministically generated from the CRediT role identifiers.
 * This data is used as fallback when the knowledge graph is unavailable.
 */
export const CREDIT_TAXONOMY: readonly CreditType[] = [
  {
    uri: `at://${GRAPH_PDS_DID}/pub.chive.graph.node/e1612645-6a62-59b7-a13a-8d618637be85`,
    id: 'conceptualization',
    label: 'Conceptualization',
    description: 'Ideas; formulation or evolution of overarching research goals and aims',
    creditUri: 'https://credit.niso.org/contributor-roles/conceptualization/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000064',
    status: 'established',
  },
  {
    uri: `at://${GRAPH_PDS_DID}/pub.chive.graph.node/fa5c6fc7-2202-5e45-8364-7740ae534f7c`,
    id: 'data-curation',
    label: 'Data Curation',
    description:
      'Management activities to annotate, scrub data and maintain research data for initial use and later reuse',
    creditUri: 'https://credit.niso.org/contributor-roles/data-curation/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000025',
    status: 'established',
  },
  {
    uri: `at://${GRAPH_PDS_DID}/pub.chive.graph.node/8d456593-b60d-5544-8e1b-ac831b29267c`,
    id: 'formal-analysis',
    label: 'Formal Analysis',
    description:
      'Application of statistical, mathematical, computational, or other formal techniques to analyze or synthesize study data',
    creditUri: 'https://credit.niso.org/contributor-roles/formal-analysis/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000006',
    status: 'established',
  },
  {
    uri: `at://${GRAPH_PDS_DID}/pub.chive.graph.node/3f571c23-ddb4-5638-b363-6d597950c3af`,
    id: 'funding-acquisition',
    label: 'Funding Acquisition',
    description: 'Acquisition of the financial support for the project leading to this publication',
    creditUri: 'https://credit.niso.org/contributor-roles/funding-acquisition/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000020',
    status: 'established',
  },
  {
    uri: `at://${GRAPH_PDS_DID}/pub.chive.graph.node/5d67f57c-9d4c-59e3-b3b1-d7205b33f6c8`,
    id: 'investigation',
    label: 'Investigation',
    description:
      'Conducting a research and investigation process, specifically performing the experiments, or data/evidence collection',
    creditUri: 'https://credit.niso.org/contributor-roles/investigation/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000052',
    status: 'established',
  },
  {
    uri: `at://${GRAPH_PDS_DID}/pub.chive.graph.node/052bfbce-9b15-55fd-8efc-99e82f7abeb2`,
    id: 'methodology',
    label: 'Methodology',
    description: 'Development or design of methodology; creation of models',
    creditUri: 'https://credit.niso.org/contributor-roles/methodology/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000029',
    status: 'established',
  },
  {
    uri: `at://${GRAPH_PDS_DID}/pub.chive.graph.node/65f27cc7-1e90-5d45-b987-3c6b4676822e`,
    id: 'project-administration',
    label: 'Project Administration',
    description:
      'Management and coordination responsibility for the research activity planning and execution',
    creditUri: 'https://credit.niso.org/contributor-roles/project-administration/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000053',
    status: 'established',
  },
  {
    uri: `at://${GRAPH_PDS_DID}/pub.chive.graph.node/b320849e-5d28-5da7-9341-b960616b549a`,
    id: 'resources',
    label: 'Resources',
    description:
      'Provision of study materials, reagents, materials, patients, laboratory samples, animals, instrumentation, computing resources, or other analysis tools',
    creditUri: 'https://credit.niso.org/contributor-roles/resources/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000054',
    status: 'established',
  },
  {
    uri: `at://${GRAPH_PDS_DID}/pub.chive.graph.node/13bbd687-3112-52b3-9a8d-7bd93b74a21f`,
    id: 'software',
    label: 'Software',
    description:
      'Programming, software development; designing computer programs; implementation of the computer code and supporting algorithms',
    creditUri: 'https://credit.niso.org/contributor-roles/software/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000015',
    status: 'established',
  },
  {
    uri: `at://${GRAPH_PDS_DID}/pub.chive.graph.node/7f57ae9f-d8f8-5dc8-a155-e5243de9fd8c`,
    id: 'supervision',
    label: 'Supervision',
    description:
      'Oversight and leadership responsibility for the research activity planning and execution, including mentorship external to the core team',
    creditUri: 'https://credit.niso.org/contributor-roles/supervision/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000055',
    status: 'established',
  },
  {
    uri: `at://${GRAPH_PDS_DID}/pub.chive.graph.node/197483f2-41cc-57a7-aed9-e6c6a01522e5`,
    id: 'validation',
    label: 'Validation',
    description:
      'Verification of the overall replication/reproducibility of results/experiments and other research outputs',
    creditUri: 'https://credit.niso.org/contributor-roles/validation/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000056',
    status: 'established',
  },
  {
    uri: `at://${GRAPH_PDS_DID}/pub.chive.graph.node/e209ced9-b3bd-53d7-ab2f-a072942142c9`,
    id: 'visualization',
    label: 'Visualization',
    description:
      'Preparation, creation and/or presentation of the published work, specifically visualization/data presentation',
    creditUri: 'https://credit.niso.org/contributor-roles/visualization/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000059',
    status: 'established',
  },
  {
    uri: `at://${GRAPH_PDS_DID}/pub.chive.graph.node/829cce56-857a-5abb-be9d-9e6b29f51198`,
    id: 'writing-original-draft',
    label: 'Writing - Original Draft',
    description:
      'Preparation, creation and/or presentation of the published work, specifically writing the initial draft',
    creditUri: 'https://credit.niso.org/contributor-roles/writing-original-draft/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000057',
    status: 'established',
  },
  {
    uri: `at://${GRAPH_PDS_DID}/pub.chive.graph.node/728c728b-b7c8-548a-aa5e-8906d1e61cce`,
    id: 'writing-review-editing',
    label: 'Writing - Review & Editing',
    description:
      'Preparation, creation and/or presentation of the published work specifically critical review, commentary or revision',
    creditUri: 'https://credit.niso.org/contributor-roles/writing-review-editing/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000058',
    status: 'established',
  },
] as const;

/**
 * Contribution degree fallback data.
 */
export const CONTRIBUTION_DEGREES = [
  { slug: 'lead', label: 'Lead' },
  { slug: 'equal', label: 'Equal' },
  { slug: 'supporting', label: 'Supporting' },
] as const;

/**
 * Helper to get CRediT type by ID.
 */
export function getCreditTypeById(id: string): CreditType | undefined {
  return CREDIT_TAXONOMY.find((t) => t.id === id);
}

/**
 * Helper to get CRediT type label by ID.
 */
export function getCreditTypeLabel(id: string): string {
  return getCreditTypeById(id)?.label ?? id;
}
