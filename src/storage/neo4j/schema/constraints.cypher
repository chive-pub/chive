// Field node constraints
CREATE CONSTRAINT field_id_unique IF NOT EXISTS
FOR (f:Field) REQUIRE f.id IS UNIQUE;

CREATE CONSTRAINT field_uri_unique IF NOT EXISTS
FOR (f:Field) REQUIRE f.uri IS UNIQUE;

// Authority record constraints
CREATE CONSTRAINT authority_id_unique IF NOT EXISTS
FOR (a:AuthorityRecord) REQUIRE a.id IS UNIQUE;

CREATE CONSTRAINT authority_uri_unique IF NOT EXISTS
FOR (a:AuthorityRecord) REQUIRE a.uri IS UNIQUE;

// Wikidata entity constraints
CREATE CONSTRAINT wikidata_id_unique IF NOT EXISTS
FOR (w:WikidataEntity) REQUIRE w.qid IS UNIQUE;

// Preprint node constraints (for graph associations)
CREATE CONSTRAINT preprint_uri_unique IF NOT EXISTS
FOR (p:Preprint) REQUIRE p.uri IS UNIQUE;

// Author node constraints
CREATE CONSTRAINT author_did_unique IF NOT EXISTS
FOR (a:Author) REQUIRE a.did IS UNIQUE;

// Field proposal constraints
CREATE CONSTRAINT proposal_id_unique IF NOT EXISTS
FOR (fp:FieldProposal) REQUIRE fp.id IS UNIQUE;

CREATE CONSTRAINT proposal_uri_unique IF NOT EXISTS
FOR (fp:FieldProposal) REQUIRE fp.uri IS UNIQUE;

// Facet constraints
CREATE CONSTRAINT facet_uri_unique IF NOT EXISTS
FOR (f:Facet) REQUIRE f.uri IS UNIQUE;

// Note: Composite uniqueness on (facetType, value) requires Neo4j Enterprise Edition (NODE KEY)
// For Community Edition, uniqueness is enforced through uri and application logic
// CREATE CONSTRAINT facet_type_value_unique IF NOT EXISTS
// FOR (f:Facet) REQUIRE (f.facetType, f.value) IS NODE KEY;

// UserTag constraints
CREATE CONSTRAINT user_tag_normalized_unique IF NOT EXISTS
FOR (t:UserTag) REQUIRE t.normalizedForm IS UNIQUE;

// Vote constraints
CREATE CONSTRAINT vote_uri_unique IF NOT EXISTS
FOR (v:Vote) REQUIRE v.uri IS UNIQUE;

// Relation proposal constraints
CREATE CONSTRAINT relation_proposal_uri_unique IF NOT EXISTS
FOR (rp:RelationProposal) REQUIRE rp.uri IS UNIQUE;

// Facet dimension constraints
CREATE CONSTRAINT facet_dimension_name_unique IF NOT EXISTS
FOR (fd:FacetDimension) REQUIRE fd.name IS UNIQUE;

// Contribution type constraints
CREATE CONSTRAINT contribution_type_id_unique IF NOT EXISTS
FOR (ct:ContributionType) REQUIRE ct.typeId IS UNIQUE;

CREATE CONSTRAINT contribution_type_uri_unique IF NOT EXISTS
FOR (ct:ContributionType) REQUIRE ct.uri IS UNIQUE;
