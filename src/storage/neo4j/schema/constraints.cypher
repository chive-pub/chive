// ===========================================================================
// Unified Node/Edge Model Constraints
// ===========================================================================

// Node constraints - all knowledge graph entities use the unified Node label
CREATE CONSTRAINT node_uri_unique IF NOT EXISTS
FOR (n:Node) REQUIRE n.uri IS UNIQUE;

CREATE CONSTRAINT node_id_unique IF NOT EXISTS
FOR (n:Node) REQUIRE n.id IS UNIQUE;

// Vote constraints
CREATE CONSTRAINT vote_uri_unique IF NOT EXISTS
FOR (v:Vote) REQUIRE v.uri IS UNIQUE;

// Proposal constraints (unified for node and edge proposals)
CREATE CONSTRAINT proposal_uri_unique IF NOT EXISTS
FOR (p:Proposal) REQUIRE p.uri IS UNIQUE;

// UserTag constraints
CREATE CONSTRAINT user_tag_normalized_unique IF NOT EXISTS
FOR (t:UserTag) REQUIRE t.normalizedForm IS UNIQUE;
