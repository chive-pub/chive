// Root knowledge graph nodes
MERGE (root:Field {
  id: 'root',
  label: 'All Fields',
  type: 'root',
  description: 'Root node of the knowledge graph'
});

// PMEST + FAST dimension templates
MERGE (personality:FacetDimension {
  name: 'personality',
  description: 'Disciplinary perspective (PMEST)',
  order: 1
});

MERGE (matter:FacetDimension {
  name: 'matter',
  description: 'Subject matter (PMEST)',
  order: 2
});

MERGE (energy:FacetDimension {
  name: 'energy',
  description: 'Processes and actions (PMEST)',
  order: 3
});

MERGE (space:FacetDimension {
  name: 'space',
  description: 'Geographic and spatial (PMEST)',
  order: 4
});

MERGE (time:FacetDimension {
  name: 'time',
  description: 'Temporal (PMEST)',
  order: 5
});

MERGE (form:FacetDimension {
  name: 'form',
  description: 'Form or genre (FAST)',
  order: 6
});

MERGE (topical:FacetDimension {
  name: 'topical',
  description: 'Topical subjects (FAST)',
  order: 7
});

MERGE (geographic:FacetDimension {
  name: 'geographic',
  description: 'Geographic entities (FAST)',
  order: 8
});

MERGE (chronological:FacetDimension {
  name: 'chronological',
  description: 'Historical periods (FAST)',
  order: 9
});

MERGE (event:FacetDimension {
  name: 'event',
  description: 'Named events (FAST)',
  order: 10
});
