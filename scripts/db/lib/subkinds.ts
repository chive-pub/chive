/**
 * Subkind type definitions for unified knowledge graph.
 *
 * @remarks
 * Defines all subkinds available in the unified node model.
 * Subkinds are themselves nodes with `kind=type` and `subkind=subkind`.
 *
 * @packageDocumentation
 */

/**
 * Node kind - distinguishes classifications (type) from instances (object).
 */
export type NodeKind = 'type' | 'object';

/**
 * Subkind definition for seeding.
 */
export interface SubkindDefinition {
  /** Human-readable slug (e.g., 'field', 'contribution-type') */
  readonly slug: string;
  /** Display label */
  readonly label: string;
  /** Description of what this subkind represents */
  readonly description: string;
  /** Whether this subkind is for type nodes or object nodes */
  readonly kind: NodeKind;
  /** Display order in UI selectors */
  readonly displayOrder?: number;
}

/**
 * All subkind definitions.
 *
 * @remarks
 * These are seeded as meta-type nodes (kind=type, subkind=subkind).
 */
export const SUBKINDS: readonly SubkindDefinition[] = [
  // =============================================================================
  // Meta-types (describe what kinds of nodes exist)
  // =============================================================================
  {
    slug: 'subkind',
    label: 'Subkind',
    description: 'Meta-type for classifying node types',
    kind: 'type',
    displayOrder: 0,
  },
  {
    slug: 'relation',
    label: 'Relation Type',
    description: 'Edge/relationship types between nodes',
    kind: 'type',
    displayOrder: 1,
  },

  // =============================================================================
  // Core graph subkinds
  // =============================================================================
  {
    slug: 'field',
    label: 'Academic Field',
    description: 'Research disciplines and academic fields - hierarchy via edges',
    kind: 'object',
    displayOrder: 10,
  },
  {
    slug: 'facet',
    label: 'Classification Facet',
    description: 'Classification dimensions for categorizing eprints',
    kind: 'type',
    displayOrder: 11,
  },

  // =============================================================================
  // Submission form type subkinds
  // =============================================================================
  {
    slug: 'document-format',
    label: 'Document Format',
    description: 'File format types (PDF, LaTeX, Jupyter, etc.)',
    kind: 'type',
    displayOrder: 20,
  },
  {
    slug: 'license',
    label: 'License',
    description: 'Distribution licenses (CC-BY, MIT, Apache, etc.)',
    kind: 'object',
    displayOrder: 21,
  },
  {
    slug: 'supplementary-category',
    label: 'Supplementary Category',
    description: 'Supplementary material types (appendix, figure, dataset, etc.)',
    kind: 'type',
    displayOrder: 22,
  },
  {
    slug: 'publication-status',
    label: 'Publication Status',
    description: 'Publication lifecycle stages (preprint, under_review, published, etc.)',
    kind: 'type',
    displayOrder: 23,
  },
  {
    slug: 'paper-type',
    label: 'Paper Type',
    description: 'Research document types (original-research, review, meta-analysis, etc.)',
    kind: 'type',
    displayOrder: 24,
  },
  {
    slug: 'contribution-type',
    label: 'Contribution Type',
    description: 'CRediT contributor roles (conceptualization, methodology, etc.)',
    kind: 'type',
    displayOrder: 25,
  },
  {
    slug: 'contribution-degree',
    label: 'Contribution Degree',
    description: 'Contribution level modifiers (lead, equal, supporting)',
    kind: 'type',
    displayOrder: 26,
  },

  // =============================================================================
  // Platform subkinds (specific platform instances)
  // =============================================================================
  {
    slug: 'platform-code',
    label: 'Code Platform',
    description: 'Code hosting platforms (GitHub, GitLab, etc.)',
    kind: 'object',
    displayOrder: 30,
  },
  {
    slug: 'platform-data',
    label: 'Data Platform',
    description: 'Data hosting platforms (Zenodo, Figshare, etc.)',
    kind: 'object',
    displayOrder: 31,
  },
  {
    slug: 'platform-preprint',
    label: 'Preprint Server',
    description: 'Preprint hosting platforms (arXiv, bioRxiv, etc.)',
    kind: 'object',
    displayOrder: 32,
  },
  {
    slug: 'platform-preregistration',
    label: 'Preregistration Registry',
    description: 'Preregistration platforms (OSF, ClinicalTrials, etc.)',
    kind: 'object',
    displayOrder: 33,
  },
  {
    slug: 'platform-protocol',
    label: 'Protocol Repository',
    description: 'Protocol hosting platforms (protocols.io, etc.)',
    kind: 'object',
    displayOrder: 34,
  },

  // =============================================================================
  // Other type subkinds
  // =============================================================================
  {
    slug: 'presentation-type',
    label: 'Presentation Type',
    description: 'Conference presentation types (oral, poster, keynote, etc.)',
    kind: 'type',
    displayOrder: 40,
  },
  {
    slug: 'institution-type',
    label: 'Institution Type',
    description: 'Organization classification types (university, research-lab, etc.)',
    kind: 'type',
    displayOrder: 41,
  },
  {
    slug: 'motivation',
    label: 'Annotation Motivation',
    description: 'Annotation motivations (commenting, questioning, highlighting, etc.)',
    kind: 'type',
    displayOrder: 42,
  },
  {
    slug: 'endorsement-type',
    label: 'Endorsement Type',
    description: 'Endorsement types (methodological, analytical, etc.)',
    kind: 'type',
    displayOrder: 44,
  },
  {
    slug: 'endorsement-kind',
    label: 'Endorsement Kind',
    description: 'Endorsement kinds (core research, technical, etc.)',
    kind: 'type',
    displayOrder: 45,
  },
  {
    slug: 'access-type',
    label: 'Access Type',
    description: 'Open access status types (open_access, gold_oa, closed, etc.)',
    kind: 'type',
    displayOrder: 46,
  },

  // =============================================================================
  // Object subkinds (instances rather than types)
  // =============================================================================
  {
    slug: 'institution',
    label: 'Institution',
    description: 'Research institutions (MIT, Harvard, NIH, etc.)',
    kind: 'object',
    displayOrder: 50,
  },
  {
    slug: 'person',
    label: 'Person',
    description: 'Named persons (researchers, editors)',
    kind: 'object',
    displayOrder: 51,
  },
  {
    slug: 'author',
    label: 'Author',
    description: 'Authors and contributors (unified with Person)',
    kind: 'object',
    displayOrder: 52,
  },
  {
    slug: 'eprint',
    label: 'Eprint',
    description: 'Eprint documents and papers',
    kind: 'object',
    displayOrder: 53,
  },
  {
    slug: 'event',
    label: 'Event',
    description: 'Named events (NeurIPS 2024, ICML 2025, etc.)',
    kind: 'object',
    displayOrder: 54,
  },
];

/**
 * Get subkind by slug.
 */
export function getSubkind(slug: string): SubkindDefinition | undefined {
  return SUBKINDS.find((s) => s.slug === slug);
}

/**
 * Get all type subkinds (for forms that create type nodes).
 */
export function getTypeSubkinds(): readonly SubkindDefinition[] {
  return SUBKINDS.filter((s) => s.kind === 'type').sort(
    (a, b) => (a.displayOrder ?? 100) - (b.displayOrder ?? 100)
  );
}

/**
 * Get all object subkinds (for forms that create object nodes).
 */
export function getObjectSubkinds(): readonly SubkindDefinition[] {
  return SUBKINDS.filter((s) => s.kind === 'object').sort(
    (a, b) => (a.displayOrder ?? 100) - (b.displayOrder ?? 100)
  );
}
