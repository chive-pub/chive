/**
 * Graph database interface for Chive's knowledge graph.
 *
 * @remarks
 * This interface provides access to Chive's knowledge graph, storing
 * relationships between fields, concepts, papers, and authority records.
 *
 * The knowledge graph uses Wikipedia-style community moderation for
 * field nodes and relationships.
 *
 * @packageDocumentation
 * @public
 */

import type { DID } from '../atproto.js';

/**
 * Knowledge graph field node (e.g., "Quantum Computing").
 *
 * @remarks
 * Field nodes represent academic fields, subfields, and topics in a
 * hierarchical taxonomy. Users propose nodes via ATProto records, and
 * the community moderates them Wikipedia-style.
 *
 * @public
 */
export interface FieldNode {
  /**
   * Unique identifier for this field node.
   */
  readonly id: string;

  /**
   * Human-readable field label.
   *
   * @example "Quantum Computing", "Neural Networks", "Molecular Biology"
   */
  readonly label: string;

  /**
   * Node type in field hierarchy.
   *
   * @remarks
   * - `root`: Top-level root node (e.g., "All Fields")
   * - `field`: Major academic discipline (e.g., "Computer Science")
   * - `subfield`: Subdivision of a field (e.g., "Machine Learning")
   * - `topic`: Specific research topic (e.g., "Neural Networks")
   */
  readonly type: 'root' | 'field' | 'subfield' | 'topic';

  /**
   * Description of the field's scope.
   *
   * @remarks
   * Used to clarify boundaries and distinguish from related fields.
   */
  readonly description?: string;

  /**
   * Wikidata Q-ID for cross-referencing.
   *
   * @remarks
   * Links to Wikidata entity for additional structured data.
   * Format: "Q43479" (no "Q:" prefix stored).
   */
  readonly wikidataId?: string;
}

/**
 * Relationship between field nodes.
 *
 * @remarks
 * Represents hierarchical and semantic relationships between fields
 * using SKOS vocabulary.
 *
 * @public
 */
export interface FieldRelationship {
  /**
   * Source field node ID.
   */
  readonly fromId: string;

  /**
   * Target field node ID.
   */
  readonly toId: string;

  /**
   * Relationship type.
   *
   * @remarks
   * - `broader`: Target is a broader concept (e.g., "AI" broader than "Neural Networks")
   * - `narrower`: Target is a narrower concept (inverse of broader)
   * - `related`: Target is a related concept (not hierarchical)
   */
  readonly type: 'broader' | 'narrower' | 'related';

  /**
   * Confidence score (0-1).
   *
   * @remarks
   * Represents confidence in the relationship. Lower for community-proposed
   * relationships awaiting review; higher for established relationships.
   */
  readonly strength?: number;
}

/**
 * Authority record (IFLA LRM 2024-2025).
 *
 * @remarks
 * Authority records provide standardized forms for names, subjects, and
 * concepts, enabling consistent indexing and retrieval.
 *
 * Stored in Chive Governance PDS for ATProto-native authority control.
 *
 * @public
 */
export interface AuthorityRecord {
  /**
   * Unique identifier for this authority record.
   */
  readonly id: string;

  /**
   * Authorized (preferred) heading.
   *
   * @remarks
   * The canonical form used for indexing. Other forms are variants.
   *
   * @example "Neural networks (Computer science)" vs "Neural nets"
   */
  readonly authorizedHeading: string;

  /**
   * Alternate headings (variant forms).
   *
   * @remarks
   * Synonyms, abbreviations, and alternate spellings that map to the
   * authorized heading.
   */
  readonly alternateHeadings: readonly string[];

  /**
   * Scope note clarifying usage boundaries.
   *
   * @remarks
   * Distinguishes from related concepts and indicates proper usage.
   *
   * @example
   * "For computer models of neural networks. For biological neural
   * networks, see Nervous system."
   */
  readonly scope?: string;

  /**
   * Source of this authority record.
   *
   * @remarks
   * - `wikidata`: Imported from Wikidata
   * - `fast`: Derived from OCLC FAST
   * - `community`: Community-proposed (pending or established)
   */
  readonly source: 'wikidata' | 'fast' | 'community';

  /**
   * Wikidata Q-ID for cross-referencing.
   */
  readonly wikidataId?: string;
}

/**
 * 10-dimensional facet (PMEST + FAST).
 *
 * @remarks
 * Chive uses a hybrid 10-dimensional faceted classification system:
 *
 * **PMEST** (Ranganathan's Colon Classification):
 * - **Personality**: Disciplinary perspective (handled by field nodes)
 * - **Matter**: Subject matter, phenomena
 * - **Energy**: Processes, methods
 * - **Space**: Geographic/spatial context
 * - **Time**: Temporal period
 *
 * **FAST** (OCLC Faceted Application of Subject Terminology):
 * - **Form**: Document genre (tutorial, meta-analysis, etc.)
 * - **Topical**: General topics
 * - **Geographic**: Geographic entities
 * - **Chronological**: Historical periods
 * - **Event**: Named events
 *
 * @public
 */
export interface Facet {
  /**
   * Facet dimension.
   */
  readonly dimension:
    | 'personality'
    | 'matter'
    | 'energy'
    | 'space'
    | 'time'
    | 'form'
    | 'topical'
    | 'geographic'
    | 'chronological'
    | 'event';

  /**
   * Facet value (human-readable).
   */
  readonly value: string;

  /**
   * Authority record ID (if authority-controlled).
   *
   * @remarks
   * Links to authoritative form for this facet value.
   */
  readonly authorityRecordId?: string;
}

/**
 * Vote record for field proposals.
 *
 * @remarks
 * Records user votes on proposals for community moderation.
 * Votes are indexed from ATProto records with role-weighted tallying.
 *
 * @public
 */
export interface VoteRecord {
  /**
   * Vote URI from ATProto record.
   */
  readonly uri: string;

  /**
   * URI of the proposal being voted on.
   */
  readonly proposalUri: string;

  /**
   * DID of the voter.
   */
  readonly voterDid: DID;

  /**
   * Voter's role for weight calculation.
   */
  readonly voterRole: 'community-member' | 'reviewer' | 'domain-expert' | 'administrator';

  /**
   * Vote decision.
   */
  readonly vote: 'approve' | 'reject' | 'abstain' | 'request-changes';

  /**
   * Optional rationale for the vote.
   */
  readonly rationale?: string;

  /**
   * When the vote was cast.
   */
  readonly createdAt: Date;
}

/**
 * Field proposal for Wikipedia-style moderation.
 *
 * @remarks
 * Users propose new field nodes or relationships via ATProto records.
 * The community discusses and votes on proposals before approval.
 *
 * @public
 */
export interface FieldProposal {
  /**
   * Unique proposal ID.
   */
  readonly id: string;

  /**
   * Field node ID (for updates/merges/deletes) or null (for creates).
   */
  readonly fieldId: string;

  /**
   * DID of user who proposed this.
   */
  readonly proposedBy: DID;

  /**
   * Type of proposal.
   */
  readonly proposalType: 'create' | 'update' | 'merge' | 'delete';

  /**
   * Proposed changes (proposal-specific structure).
   */
  readonly changes: {
    readonly label?: string;
    readonly description?: string;
    readonly alternateNames?: readonly string[];
    readonly fieldType?: 'field' | 'root' | 'subfield' | 'topic';
    readonly parentId?: string;
    readonly mergeTargetId?: string;
    readonly wikidataId?: string;
  };

  /**
   * Rationale for the proposal.
   */
  readonly rationale: string;

  /**
   * Proposal status.
   */
  readonly status: 'pending' | 'approved' | 'rejected';

  /**
   * Vote counts.
   */
  readonly votes: {
    readonly approve: number;
    readonly reject: number;
  };

  /**
   * Proposal creation timestamp.
   */
  readonly createdAt: Date;
}

/**
 * Graph database interface for Neo4j.
 *
 * @remarks
 * Provides access to Chive's knowledge graph for field relationships,
 * authority control, and faceted classification.
 *
 * Implementation notes:
 * - Uses Neo4j 5+ with Cypher queries
 * - Field nodes use hierarchical labels
 * - Relationships are typed and weighted
 * - Authority records stored in dedicated collection
 *
 * @public
 */
export interface IGraphDatabase {
  /**
   * Creates or updates a field node.
   *
   * @param field - Field node data
   * @returns Promise resolving when upserted
   *
   * @remarks
   * Upserts the field node (insert or update based on ID).
   *
   * @example
   * ```typescript
   * await graphDb.upsertField({
   *   id: 'quantum-computing',
   *   label: 'Quantum Computing',
   *   type: 'field',
   *   description: 'Computing using quantum mechanics principles',
   *   wikidataId: 'Q484761'
   * });
   * ```
   *
   * @public
   */
  upsertField(field: FieldNode): Promise<void>;

  /**
   * Gets a field node by ID.
   *
   * @param fieldId - Field identifier
   * @returns Field node or null if not found
   *
   * @remarks
   * Retrieves a single field node by its unique identifier.
   *
   * @example
   * ```typescript
   * const field = await graphDb.getFieldById('quantum-computing');
   * if (field) {
   *   console.log(`Found: ${field.label}`);
   * }
   * ```
   *
   * @public
   */
  getFieldById(fieldId: string): Promise<FieldNode | null>;

  /**
   * Creates a relationship between field nodes.
   *
   * @param relationship - Relationship data
   * @returns Promise resolving when created
   *
   * @remarks
   * Creates a directed relationship edge in the graph.
   *
   * @example
   * ```typescript
   * await graphDb.createRelationship({
   *   fromId: 'neural-networks',
   *   toId: 'artificial-intelligence',
   *   type: 'narrower',
   *   strength: 0.95
   * });
   * ```
   *
   * @public
   */
  createRelationship(relationship: FieldRelationship): Promise<void>;

  /**
   * Finds related fields by traversing relationships.
   *
   * @param fieldId - Starting field ID
   * @param maxDepth - Maximum traversal depth
   * @returns Related field nodes
   *
   * @remarks
   * Uses graph traversal to find related fields up to maxDepth hops away.
   * Useful for "explore related fields" features.
   *
   * @example
   * ```typescript
   * const related = await graphDb.findRelatedFields('neural-networks', 2);
   * // Returns fields within 2 hops: AI, deep learning, machine learning, etc.
   * ```
   *
   * @public
   */
  findRelatedFields(fieldId: string, maxDepth?: number): Promise<readonly FieldNode[]>;

  /**
   * Creates an authority record.
   *
   * @param record - Authority record data
   * @returns Promise resolving when created
   *
   * @remarks
   * Stores authority record in graph for linking to field nodes and facets.
   *
   * @example
   * ```typescript
   * await graphDb.createAuthorityRecord({
   *   id: 'neural-networks-cs',
   *   authorizedHeading: 'Neural networks (Computer science)',
   *   alternateHeadings: ['Neural nets', 'ANNs', 'Artificial neural networks'],
   *   scope: 'For biological networks, see Nervous system',
   *   source: 'wikidata',
   *   wikidataId: 'Q43479'
   * });
   * ```
   *
   * @public
   */
  createAuthorityRecord(record: AuthorityRecord): Promise<void>;

  /**
   * Queries field nodes by facets.
   *
   * @param facets - Facet filters
   * @returns Matching field IDs
   *
   * @remarks
   * Finds fields that match all specified facets (AND query).
   * Use for faceted navigation and filtering.
   *
   * @example
   * ```typescript
   * const fields = await graphDb.queryByFacets([
   *   { dimension: 'matter', value: 'Proteins' },
   *   { dimension: 'energy', value: 'Meta-analysis' }
   * ]);
   * // Returns fields about protein meta-analyses
   * ```
   *
   * @public
   */
  queryByFacets(facets: readonly Facet[]): Promise<readonly string[]>;

  /**
   * Gets pending community proposals for a field.
   *
   * @param fieldId - Field ID
   * @returns Pending proposals
   *
   * @remarks
   * Returns proposals awaiting community review for this field.
   *
   * @example
   * ```typescript
   * const proposals = await graphDb.getCommunityProposals('neural-networks');
   * proposals.forEach(p => {
   *   console.log(`${p.proposalType}: ${p.rationale}`);
   * });
   * ```
   *
   * @public
   */
  getCommunityProposals(fieldId: string): Promise<readonly FieldProposal[]>;

  /**
   * Creates a vote record for a proposal.
   *
   * @param vote - Vote record data
   * @returns Promise resolving when created
   *
   * @remarks
   * Persists vote to graph database and updates proposal vote counts.
   * Votes are weighted by voter role:
   * - community-member: 1.0x
   * - reviewer: 2.0x
   * - domain-expert: 3.0x
   * - administrator: 5.0x
   *
   * @example
   * ```typescript
   * await graphDb.createVote({
   *   uri: 'at://did:plc:voter/pub.chive.graph.vote/abc123',
   *   proposalUri: 'at://did:plc:author/pub.chive.graph.fieldProposal/xyz',
   *   voterDid: 'did:plc:voter',
   *   voterRole: 'reviewer',
   *   vote: 'approve',
   *   rationale: 'Well-structured proposal with clear scope',
   *   createdAt: new Date()
   * });
   * ```
   *
   * @public
   */
  createVote(vote: VoteRecord): Promise<void>;

  /**
   * Searches authority records by query text, type, and status.
   *
   * @param query - Search query text (matches authorized heading and alternates)
   * @param options - Search options (type filter, status filter, pagination)
   * @returns Matching authority records with pagination info
   *
   * @remarks
   * Uses Neo4j fulltext search index for efficient matching.
   * Supports filtering by authority type and approval status.
   *
   * @example
   * ```typescript
   * const results = await graphDb.searchAuthorityRecords('neural network', {
   *   type: 'concept',
   *   status: 'approved',
   *   limit: 20,
   *   offset: 0
   * });
   * ```
   *
   * @public
   */
  searchAuthorityRecords(
    query: string,
    options?: {
      readonly type?: 'person' | 'organization' | 'concept' | 'place';
      readonly status?: 'proposed' | 'under_review' | 'approved' | 'deprecated';
      readonly limit?: number;
      readonly offset?: number;
    }
  ): Promise<{
    readonly records: readonly AuthorityRecord[];
    readonly total: number;
    readonly hasMore: boolean;
  }>;

  /**
   * Aggregates available facet values with counts for refinement UI.
   *
   * @param currentFacets - Currently selected facets to filter by
   * @returns Available facet values with preprint counts per dimension
   *
   * @remarks
   * Returns only facet values that would produce results given current filters.
   * Counts represent how many preprints match if that facet is added.
   *
   * @example
   * ```typescript
   * const refinements = await graphDb.aggregateFacetRefinements([
   *   { dimension: 'personality', value: 'Computer Science' }
   * ]);
   * // Returns available matter, energy, space, time values
   * ```
   *
   * @public
   */
  aggregateFacetRefinements(currentFacets: readonly Facet[]): Promise<{
    readonly personality?: readonly { value: string; count: number }[];
    readonly matter?: readonly { value: string; count: number }[];
    readonly energy?: readonly { value: string; count: number }[];
    readonly space?: readonly { value: string; count: number }[];
    readonly time?: readonly { value: string; count: number }[];
  }>;

  /**
   * Lists field nodes with optional filtering and pagination.
   *
   * @param options - List options (status filter, parent filter, pagination)
   * @returns Field nodes with pagination info
   *
   * @remarks
   * Returns field nodes matching the specified filters.
   *
   * @example
   * ```typescript
   * const fields = await graphDb.listFields({
   *   status: 'approved',
   *   limit: 50,
   *   cursor: '50'
   * });
   * ```
   *
   * @public
   */
  listFields(options: {
    readonly status?: 'proposed' | 'under_review' | 'approved' | 'deprecated';
    readonly parentId?: string;
    readonly limit?: number;
    readonly cursor?: string;
  }): Promise<{
    readonly fields: readonly FieldNode[];
    readonly total: number;
    readonly hasMore: boolean;
    readonly cursor?: string;
  }>;

  /**
   * Lists proposals with optional filtering.
   *
   * @param filters - Proposal filters (status, type, proposer, etc.)
   * @returns Paginated proposals
   *
   * @example
   * ```typescript
   * const result = await graphDb.getProposals({
   *   status: ['pending'],
   *   limit: 20
   * });
   * ```
   *
   * @public
   */
  getProposals(filters: {
    readonly status?: readonly ('pending' | 'approved' | 'rejected')[];
    readonly proposalType?: readonly ('create' | 'update' | 'merge' | 'delete')[];
    readonly proposerDid?: DID;
    readonly fieldUri?: string;
    readonly createdAfter?: Date;
    readonly createdBefore?: Date;
    readonly offset?: number;
    readonly limit?: number;
  }): Promise<{
    readonly proposals: readonly FieldProposal[];
    readonly total: number;
    readonly hasMore: boolean;
    readonly offset: number;
  }>;

  /**
   * Gets a proposal by ID.
   *
   * @param proposalId - Proposal identifier
   * @returns Proposal if found, null otherwise
   *
   * @example
   * ```typescript
   * const proposal = await graphDb.getProposalById('abc123');
   * ```
   *
   * @public
   */
  getProposalById(proposalId: string): Promise<FieldProposal | null>;

  /**
   * Gets votes for a specific proposal.
   *
   * @param proposalUri - Proposal AT-URI
   * @returns Votes cast on the proposal
   *
   * @example
   * ```typescript
   * const votes = await graphDb.getVotesForProposal('at://did:plc:xxx/pub.chive.graph.fieldProposal/abc');
   * ```
   *
   * @public
   */
  getVotesForProposal(proposalUri: string): Promise<readonly VoteRecord[]>;
}
