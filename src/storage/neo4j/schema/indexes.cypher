// ===========================================================================
// Unified Node/Edge Model Indexes
// ===========================================================================

// Base Node indexes
CREATE INDEX node_kind_idx IF NOT EXISTS
FOR (n:Node) ON (n.kind);

CREATE INDEX node_subkind_idx IF NOT EXISTS
FOR (n:Node) ON (n.subkindSlug);

CREATE INDEX node_status_idx IF NOT EXISTS
FOR (n:Node) ON (n.status);

CREATE INDEX node_label_idx IF NOT EXISTS
FOR (n:Node) ON (n.label);

// Kind label indexes for fast filtering
CREATE INDEX type_status_idx IF NOT EXISTS
FOR (n:Type) ON (n.status);

CREATE INDEX object_status_idx IF NOT EXISTS
FOR (n:Object) ON (n.status);

// Subkind label indexes (for fast queries like MATCH (n:Field))
CREATE INDEX field_label_idx IF NOT EXISTS
FOR (n:Field) ON (n.label);

CREATE INDEX facet_label_idx IF NOT EXISTS
FOR (n:Facet) ON (n.label);

CREATE INDEX institution_label_idx IF NOT EXISTS
FOR (n:Institution) ON (n.label);

CREATE INDEX person_label_idx IF NOT EXISTS
FOR (n:Person) ON (n.label);

CREATE INDEX topic_label_idx IF NOT EXISTS
FOR (n:Topic) ON (n.label);

CREATE INDEX relation_label_idx IF NOT EXISTS
FOR (n:Relation) ON (n.label);

CREATE INDEX contributiontype_label_idx IF NOT EXISTS
FOR (n:ContributionType) ON (n.label);

CREATE INDEX license_label_idx IF NOT EXISTS
FOR (n:License) ON (n.label);

CREATE INDEX documentformat_label_idx IF NOT EXISTS
FOR (n:DocumentFormat) ON (n.label);

CREATE INDEX motivation_label_idx IF NOT EXISTS
FOR (n:Motivation) ON (n.label);

// Full-text search index for nodes
CREATE FULLTEXT INDEX nodeTextIndex IF NOT EXISTS
FOR (n:Node) ON EACH [n.label, n.description];

// Edge indexes (EDGE relationship properties)
// Note: Neo4j doesn't support relationship property indexes directly
// These queries use inline property matching

// Vote indexes
CREATE INDEX vote_proposal_idx IF NOT EXISTS
FOR (v:Vote) ON (v.proposalUri);

CREATE INDEX vote_timestamp_idx IF NOT EXISTS
FOR (v:Vote) ON (v.createdAt);

// Proposal indexes
CREATE INDEX proposal_status_idx IF NOT EXISTS
FOR (p:Proposal) ON (p.status);

CREATE INDEX proposal_type_idx IF NOT EXISTS
FOR (p:Proposal) ON (p.type);

CREATE INDEX proposal_created_idx IF NOT EXISTS
FOR (p:Proposal) ON (p.createdAt);

// UserTag indexes
CREATE INDEX tag_quality_idx IF NOT EXISTS
FOR (t:UserTag) ON (t.qualityScore);

CREATE INDEX tag_spam_idx IF NOT EXISTS
FOR (t:UserTag) ON (t.spamScore);

CREATE INDEX tag_usage_idx IF NOT EXISTS
FOR (t:UserTag) ON (t.usageCount);

// Full-text search index for tags
CREATE FULLTEXT INDEX tagTextIndex IF NOT EXISTS
FOR (t:UserTag) ON EACH [t.normalizedForm, t.rawForm];

// Author indexes
CREATE INDEX author_name_idx IF NOT EXISTS
FOR (a:Author) ON (a.displayName);

// Eprint indexes
CREATE INDEX eprint_title_idx IF NOT EXISTS
FOR (p:Eprint) ON (p.title);

CREATE INDEX eprint_created_idx IF NOT EXISTS
FOR (p:Eprint) ON (p.createdAt);
