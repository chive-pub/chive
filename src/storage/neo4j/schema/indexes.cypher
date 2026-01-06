// Field label index for search
CREATE INDEX field_label_idx IF NOT EXISTS
FOR (f:Field) ON (f.label);

// Field type index
CREATE INDEX field_type_idx IF NOT EXISTS
FOR (f:Field) ON (f.type);

// Authority record heading index
CREATE INDEX authority_heading_idx IF NOT EXISTS
FOR (a:AuthorityRecord) ON (a.authorizedForm);

// Authority record status index
CREATE INDEX authority_status_idx IF NOT EXISTS
FOR (a:AuthorityRecord) ON (a.status);

// Preprint facet dimension index (for faceted browse)
CREATE INDEX preprint_facet_dim_idx IF NOT EXISTS
FOR (p:Preprint) ON (p.facet_dimensions);

// Facet hierarchy index (composite for efficient hierarchy queries)
CREATE INDEX facet_hierarchy_idx IF NOT EXISTS
FOR (f:Facet) ON (f.facetType, f.level);

// Facet materialized path index (for ancestor/descendant queries)
CREATE INDEX facet_path_idx IF NOT EXISTS
FOR (f:Facet) ON (f.materializedPath);

// UserTag quality indexes
CREATE INDEX tag_quality_idx IF NOT EXISTS
FOR (t:UserTag) ON (t.qualityScore);

CREATE INDEX tag_spam_idx IF NOT EXISTS
FOR (t:UserTag) ON (t.spamScore);

CREATE INDEX tag_usage_idx IF NOT EXISTS
FOR (t:UserTag) ON (t.usageCount);

// Proposal status and date index (for filtering active proposals)
CREATE INDEX proposal_status_date_idx IF NOT EXISTS
FOR (p:FieldProposal) ON (p.status, p.createdAt);

// Vote proposal index (for aggregating votes by proposal)
CREATE INDEX vote_proposal_idx IF NOT EXISTS
FOR (v:Vote) ON (v.proposalUri);

// Vote timestamp index (for chronological ordering)
CREATE INDEX vote_timestamp_idx IF NOT EXISTS
FOR (v:Vote) ON (v.createdAt);

// Full-text search index for field labels and descriptions
CREATE FULLTEXT INDEX fieldTextIndex IF NOT EXISTS
FOR (f:Field) ON EACH [f.label, f.description];

// Full-text search index for authority records
CREATE FULLTEXT INDEX authorityTextIndex IF NOT EXISTS
FOR (a:AuthorityRecord) ON EACH [a.authorizedForm, a.variantForms, a.scopeNote];

// Full-text search index for tags
CREATE FULLTEXT INDEX tagTextIndex IF NOT EXISTS
FOR (t:UserTag) ON EACH [t.normalizedForm, t.rawForm];
