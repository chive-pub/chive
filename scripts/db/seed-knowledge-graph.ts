#!/usr/bin/env tsx

/**
 * Knowledge graph seed script.
 *
 * @remarks
 * Seeds the Neo4j knowledge graph with:
 * - 14 CRediT contribution types from NISO standard
 * - Academic field hierarchy based on ANZSRC 2020 / OECD FOS
 * - Comprehensive linguistics subfields
 * - Field relationships (PARENT_OF, RELATED_TO)
 *
 * Uses MERGE to be idempotent - safe to run multiple times.
 *
 * @see {@link https://credit.niso.org/ | CRediT Taxonomy}
 * @see {@link https://www.abs.gov.au/statistics/classifications/australian-and-new-zealand-standard-research-classification-anzsrc | ANZSRC 2020}
 *
 * @packageDocumentation
 */

import type { Driver, Session } from 'neo4j-driver';

import { createNeo4jDriver, getGovernanceDid } from '../../src/storage/neo4j/setup.js';

// =============================================================================
// CRediT Contribution Types
// =============================================================================

/**
 * CRediT role definition.
 */
interface CreditRole {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly creditUri: string;
  readonly croUri?: string;
}

/**
 * The 14 CRediT (Contributor Roles Taxonomy) roles.
 *
 * @see {@link https://credit.niso.org/contributor-roles-defined/ | CRediT Roles}
 */
const CREDIT_TAXONOMY: readonly CreditRole[] = [
  {
    id: 'conceptualization',
    label: 'Conceptualization',
    description: 'Ideas; formulation or evolution of overarching research goals and aims.',
    creditUri: 'https://credit.niso.org/contributor-roles/conceptualization/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000064',
  },
  {
    id: 'data-curation',
    label: 'Data Curation',
    description:
      'Management activities to annotate (produce metadata), scrub data and maintain research data for initial use and later re-use.',
    creditUri: 'https://credit.niso.org/contributor-roles/data-curation/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000025',
  },
  {
    id: 'formal-analysis',
    label: 'Formal Analysis',
    description:
      'Application of statistical, mathematical, computational, or other formal techniques to analyze or synthesize study data.',
    creditUri: 'https://credit.niso.org/contributor-roles/formal-analysis/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000006',
  },
  {
    id: 'funding-acquisition',
    label: 'Funding Acquisition',
    description:
      'Acquisition of the financial support for the project leading to this publication.',
    creditUri: 'https://credit.niso.org/contributor-roles/funding-acquisition/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000020',
  },
  {
    id: 'investigation',
    label: 'Investigation',
    description:
      'Conducting a research and investigation process, specifically performing the experiments, or data/evidence collection.',
    creditUri: 'https://credit.niso.org/contributor-roles/investigation/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000052',
  },
  {
    id: 'methodology',
    label: 'Methodology',
    description: 'Development or design of methodology; creation of models.',
    creditUri: 'https://credit.niso.org/contributor-roles/methodology/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000029',
  },
  {
    id: 'project-administration',
    label: 'Project Administration',
    description:
      'Management and coordination responsibility for the research activity planning and execution.',
    creditUri: 'https://credit.niso.org/contributor-roles/project-administration/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000053',
  },
  {
    id: 'resources',
    label: 'Resources',
    description:
      'Provision of study materials, reagents, materials, patients, laboratory samples, animals, instrumentation, computing resources, or other analysis tools.',
    creditUri: 'https://credit.niso.org/contributor-roles/resources/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000054',
  },
  {
    id: 'software',
    label: 'Software',
    description:
      'Programming, software development; designing computer programs; implementation of the computer code and supporting algorithms; testing of existing code components.',
    creditUri: 'https://credit.niso.org/contributor-roles/software/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000015',
  },
  {
    id: 'supervision',
    label: 'Supervision',
    description:
      'Oversight and leadership responsibility for the research activity planning and execution, including mentorship external to the core team.',
    creditUri: 'https://credit.niso.org/contributor-roles/supervision/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000055',
  },
  {
    id: 'validation',
    label: 'Validation',
    description:
      'Verification, whether as a part of the activity or separate, of the overall replication/reproducibility of results/experiments and other research outputs.',
    creditUri: 'https://credit.niso.org/contributor-roles/validation/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000056',
  },
  {
    id: 'visualization',
    label: 'Visualization',
    description:
      'Preparation, creation and/or presentation of the published work, specifically visualization/data presentation.',
    creditUri: 'https://credit.niso.org/contributor-roles/visualization/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000059',
  },
  {
    id: 'writing-original-draft',
    label: 'Writing - Original Draft',
    description:
      'Preparation, creation and/or presentation of the published work, specifically writing the initial draft.',
    creditUri: 'https://credit.niso.org/contributor-roles/writing-original-draft/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000057',
  },
  {
    id: 'writing-review-editing',
    label: 'Writing - Review & Editing',
    description:
      'Preparation, creation and/or presentation of the published work by those from the original research group, specifically critical review, commentary or revision.',
    creditUri: 'https://credit.niso.org/contributor-roles/writing-review-editing/',
    croUri: 'http://purl.obolibrary.org/obo/CRO_0000058',
  },
];

// =============================================================================
// Academic Field Definitions
// =============================================================================

/**
 * Field definition for seeding.
 */
interface FieldDefinition {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly wikidataId?: string;
  readonly anzsrcCode?: string;
  readonly type: 'domain' | 'division' | 'group' | 'field';
  readonly parentId?: string;
  readonly relatedIds?: readonly string[];
}

/**
 * Top-level academic domains based on OECD Fields of Science.
 */
const DOMAINS: readonly FieldDefinition[] = [
  {
    id: 'natural-sciences',
    label: 'Natural Sciences',
    description:
      'Sciences concerned with the description, understanding, and prediction of natural phenomena based on empirical evidence.',
    wikidataId: 'Q7991',
    type: 'domain',
  },
  {
    id: 'engineering-technology',
    label: 'Engineering and Technology',
    description:
      'Application of scientific knowledge for practical purposes, including design, construction, and operation of structures, machines, and systems.',
    wikidataId: 'Q11023',
    type: 'domain',
  },
  {
    id: 'medical-health-sciences',
    label: 'Medical and Health Sciences',
    description:
      'Sciences dealing with the maintenance of health and the prevention and treatment of disease.',
    wikidataId: 'Q11190',
    type: 'domain',
  },
  {
    id: 'agricultural-veterinary',
    label: 'Agricultural and Veterinary Sciences',
    description:
      'Sciences relating to the practice of agriculture, animal husbandry, and food production.',
    wikidataId: 'Q11451',
    type: 'domain',
  },
  {
    id: 'social-sciences',
    label: 'Social Sciences',
    description:
      'Sciences concerned with society and the relationships among individuals within a society.',
    wikidataId: 'Q34749',
    type: 'domain',
  },
  {
    id: 'humanities-arts',
    label: 'Humanities and Arts',
    description:
      'Academic disciplines that study aspects of human society and culture, including history, philosophy, literature, and the arts.',
    wikidataId: 'Q80083',
    type: 'domain',
  },
];

/**
 * Major divisions under each domain.
 */
const DIVISIONS: readonly FieldDefinition[] = [
  // Natural Sciences
  {
    id: 'mathematics',
    label: 'Mathematics',
    description:
      'The abstract science of number, quantity, and space, either as abstract concepts or as applied to other disciplines.',
    wikidataId: 'Q395',
    anzsrcCode: '49',
    type: 'division',
    parentId: 'natural-sciences',
  },
  {
    id: 'physics',
    label: 'Physics',
    description:
      'The natural science that studies matter, its fundamental constituents, motion, energy, and force.',
    wikidataId: 'Q413',
    anzsrcCode: '51',
    type: 'division',
    parentId: 'natural-sciences',
  },
  {
    id: 'chemistry',
    label: 'Chemistry',
    description:
      'The scientific study of the properties and behavior of matter, including its composition, structure, and changes.',
    wikidataId: 'Q2329',
    anzsrcCode: '34',
    type: 'division',
    parentId: 'natural-sciences',
  },
  {
    id: 'earth-sciences',
    label: 'Earth Sciences',
    description:
      'Sciences related to the planet Earth, including geology, geophysics, oceanography, and atmospheric science.',
    wikidataId: 'Q8008',
    anzsrcCode: '37',
    type: 'division',
    parentId: 'natural-sciences',
  },
  {
    id: 'biological-sciences',
    label: 'Biological Sciences',
    description:
      'Natural science concerned with the study of life and living organisms, including their structure, function, growth, and evolution.',
    wikidataId: 'Q420',
    anzsrcCode: '31',
    type: 'division',
    parentId: 'natural-sciences',
  },
  // Engineering and Technology
  {
    id: 'computer-science',
    label: 'Computer Science',
    description:
      'The study of computation, information, and automation, including the design and analysis of algorithms and data structures.',
    wikidataId: 'Q21198',
    anzsrcCode: '46',
    type: 'division',
    parentId: 'engineering-technology',
    relatedIds: ['mathematics', 'linguistics'],
  },
  {
    id: 'electrical-engineering',
    label: 'Electrical Engineering',
    description:
      'Engineering discipline concerned with the study, design, and application of equipment and systems using electricity and electronics.',
    wikidataId: 'Q43035',
    anzsrcCode: '40',
    type: 'division',
    parentId: 'engineering-technology',
  },
  {
    id: 'mechanical-engineering',
    label: 'Mechanical Engineering',
    description:
      'Engineering discipline that combines engineering physics, mathematics, and materials science to design and manufacture mechanical systems.',
    wikidataId: 'Q101333',
    anzsrcCode: '40',
    type: 'division',
    parentId: 'engineering-technology',
  },
  {
    id: 'civil-engineering',
    label: 'Civil Engineering',
    description:
      'Professional engineering discipline that deals with the design, construction, and maintenance of the physical and naturally built environment.',
    wikidataId: 'Q77590',
    anzsrcCode: '40',
    type: 'division',
    parentId: 'engineering-technology',
  },
  {
    id: 'materials-science',
    label: 'Materials Science',
    description:
      'Interdisciplinary field involving the properties of matter and its applications to various areas of science and engineering.',
    wikidataId: 'Q228736',
    anzsrcCode: '40',
    type: 'division',
    parentId: 'engineering-technology',
  },
  // Medical and Health Sciences
  {
    id: 'clinical-medicine',
    label: 'Clinical Medicine',
    description: 'Branch of medicine dealing with the observation and treatment of patients.',
    wikidataId: 'Q11190',
    anzsrcCode: '32',
    type: 'division',
    parentId: 'medical-health-sciences',
  },
  {
    id: 'neuroscience',
    label: 'Neuroscience',
    description:
      'Scientific study of the nervous system, encompassing the structure, function, development, and pathology of neural systems.',
    wikidataId: 'Q7141',
    anzsrcCode: '32',
    type: 'division',
    parentId: 'medical-health-sciences',
    relatedIds: ['psychology', 'cognitive-science'],
  },
  {
    id: 'public-health',
    label: 'Public Health',
    description:
      'Science and art of preventing disease, prolonging life, and promoting health through organized efforts of society.',
    wikidataId: 'Q189603',
    anzsrcCode: '42',
    type: 'division',
    parentId: 'medical-health-sciences',
  },
  // Social Sciences
  {
    id: 'psychology',
    label: 'Psychology',
    description:
      'Scientific study of mind and behavior, encompassing conscious and unconscious phenomena, feelings, and thought.',
    wikidataId: 'Q9418',
    anzsrcCode: '52',
    type: 'division',
    parentId: 'social-sciences',
    relatedIds: ['neuroscience', 'linguistics', 'cognitive-science'],
  },
  {
    id: 'economics',
    label: 'Economics',
    description:
      'Social science that studies the production, distribution, and consumption of goods and services.',
    wikidataId: 'Q8134',
    anzsrcCode: '38',
    type: 'division',
    parentId: 'social-sciences',
  },
  {
    id: 'sociology',
    label: 'Sociology',
    description:
      'Study of society, patterns of social relationships, social interaction, and culture of everyday life.',
    wikidataId: 'Q21201',
    anzsrcCode: '44',
    type: 'division',
    parentId: 'social-sciences',
  },
  {
    id: 'political-science',
    label: 'Political Science',
    description:
      'Scientific study of politics, government systems, political behavior, and analysis of political activities.',
    wikidataId: 'Q36442',
    anzsrcCode: '44',
    type: 'division',
    parentId: 'social-sciences',
  },
  {
    id: 'anthropology',
    label: 'Anthropology',
    description:
      'Scientific study of humans, human behavior, and societies in the past and present.',
    wikidataId: 'Q23404',
    anzsrcCode: '44',
    type: 'division',
    parentId: 'social-sciences',
    relatedIds: ['linguistics', 'archaeology'],
  },
  {
    id: 'education',
    label: 'Education',
    description: 'Academic field concerned with methods and theories of teaching and learning.',
    wikidataId: 'Q8434',
    anzsrcCode: '39',
    type: 'division',
    parentId: 'social-sciences',
  },
  {
    id: 'law',
    label: 'Law',
    description:
      'System of rules created and enforced through social or governmental institutions to regulate behavior.',
    wikidataId: 'Q7748',
    anzsrcCode: '48',
    type: 'division',
    parentId: 'social-sciences',
  },
  // Humanities and Arts
  {
    id: 'philosophy',
    label: 'Philosophy',
    description:
      'Study of general and fundamental questions about existence, knowledge, values, reason, mind, and language.',
    wikidataId: 'Q5891',
    anzsrcCode: '50',
    type: 'division',
    parentId: 'humanities-arts',
    relatedIds: ['linguistics', 'cognitive-science'],
  },
  {
    id: 'history',
    label: 'History',
    description: 'Study and documentation of the past, particularly events, people, and societies.',
    wikidataId: 'Q309',
    anzsrcCode: '43',
    type: 'division',
    parentId: 'humanities-arts',
  },
  {
    id: 'linguistics',
    label: 'Linguistics',
    description:
      'Scientific study of language and its structure, including morphology, syntax, phonetics, phonology, semantics, and pragmatics.',
    wikidataId: 'Q7094',
    anzsrcCode: '4704',
    type: 'division',
    parentId: 'humanities-arts',
    relatedIds: [
      'computer-science',
      'psychology',
      'philosophy',
      'cognitive-science',
      'anthropology',
    ],
  },
  {
    id: 'literary-studies',
    label: 'Literary Studies',
    description:
      'Academic discipline devoted to the study of literature, including poetry, prose, and drama.',
    wikidataId: 'Q8242',
    anzsrcCode: '4705',
    type: 'division',
    parentId: 'humanities-arts',
  },
  {
    id: 'religious-studies',
    label: 'Religious Studies',
    description:
      'Academic field devoted to research into religious beliefs, behaviors, and institutions.',
    wikidataId: 'Q9174',
    anzsrcCode: '50',
    type: 'division',
    parentId: 'humanities-arts',
  },
  {
    id: 'arts',
    label: 'Arts',
    description:
      'Creative activities and disciplines including visual arts, performing arts, and creative writing.',
    wikidataId: 'Q735',
    anzsrcCode: '36',
    type: 'division',
    parentId: 'humanities-arts',
  },
  // Interdisciplinary
  {
    id: 'cognitive-science',
    label: 'Cognitive Science',
    description:
      'Interdisciplinary study of the mind and its processes, drawing on psychology, neuroscience, linguistics, philosophy, and AI.',
    wikidataId: 'Q101929',
    type: 'division',
    parentId: 'social-sciences',
    relatedIds: ['psychology', 'neuroscience', 'linguistics', 'philosophy', 'computer-science'],
  },
];

// =============================================================================
// Linguistics Subfields (Comprehensive)
// =============================================================================

/**
 * Core linguistics subfields.
 */
const LINGUISTICS_CORE: readonly FieldDefinition[] = [
  // Structural/Theoretical Linguistics (Core Areas)
  {
    id: 'phonetics',
    label: 'Phonetics',
    description:
      'Study of the physical sounds of human speech, including their production, acoustic properties, and perception.',
    wikidataId: 'Q40998',
    type: 'group',
    parentId: 'linguistics',
    relatedIds: ['phonology'],
  },
  {
    id: 'phonology',
    label: 'Phonology',
    description:
      'Study of the systematic organization of sounds in languages, including phonemes, allophones, and phonological rules.',
    wikidataId: 'Q40803',
    type: 'group',
    parentId: 'linguistics',
    relatedIds: ['phonetics', 'morphology'],
  },
  {
    id: 'morphology',
    label: 'Morphology',
    description:
      'Study of the internal structure of words, including morphemes, word formation processes, and inflection.',
    wikidataId: 'Q131261',
    type: 'group',
    parentId: 'linguistics',
    relatedIds: ['phonology', 'syntax'],
  },
  {
    id: 'syntax',
    label: 'Syntax',
    description:
      'Study of sentence structure and the rules governing the arrangement of words, phrases, and clauses.',
    wikidataId: 'Q37437',
    type: 'group',
    parentId: 'linguistics',
    relatedIds: ['morphology', 'semantics'],
  },
  {
    id: 'semantics',
    label: 'Semantics',
    description:
      'Study of meaning in language, including word meaning, sentence meaning, and the relationship between linguistic expressions and their referents.',
    wikidataId: 'Q39645',
    type: 'group',
    parentId: 'linguistics',
    relatedIds: ['syntax', 'pragmatics', 'philosophy-of-language'],
  },
  {
    id: 'pragmatics',
    label: 'Pragmatics',
    description:
      'Study of how context contributes to meaning, including speech acts, implicature, deixis, and discourse structure.',
    wikidataId: 'Q192985',
    type: 'group',
    parentId: 'linguistics',
    relatedIds: ['semantics', 'discourse-analysis', 'sociolinguistics'],
  },
];

/**
 * Interdisciplinary and applied linguistics fields.
 */
const LINGUISTICS_INTERDISCIPLINARY: readonly FieldDefinition[] = [
  {
    id: 'psycholinguistics',
    label: 'Psycholinguistics',
    description:
      'Study of the psychological and neurobiological factors enabling language acquisition, comprehension, and production.',
    wikidataId: 'Q185043',
    type: 'group',
    parentId: 'linguistics',
    relatedIds: ['cognitive-science', 'neurolinguistics', 'language-acquisition'],
  },
  {
    id: 'neurolinguistics',
    label: 'Neurolinguistics',
    description:
      'Study of the neural mechanisms in the brain that control language comprehension, production, and acquisition.',
    wikidataId: 'Q583405',
    type: 'group',
    parentId: 'linguistics',
    relatedIds: ['neuroscience', 'psycholinguistics', 'cognitive-science'],
  },
  {
    id: 'sociolinguistics',
    label: 'Sociolinguistics',
    description:
      'Study of the relationship between language and society, including language variation, change, and social identity.',
    wikidataId: 'Q40634',
    type: 'group',
    parentId: 'linguistics',
    relatedIds: ['sociology', 'anthropological-linguistics', 'pragmatics'],
  },
  {
    id: 'computational-linguistics',
    label: 'Computational Linguistics',
    description:
      'Interdisciplinary field concerned with statistical or rule-based modeling of natural language from a computational perspective.',
    wikidataId: 'Q182557',
    anzsrcCode: '470403',
    type: 'group',
    parentId: 'linguistics',
    relatedIds: ['computer-science', 'natural-language-processing', 'machine-learning'],
  },
  {
    id: 'anthropological-linguistics',
    label: 'Anthropological Linguistics',
    description:
      'Study of the relationship between language and culture, and how language shapes social life.',
    wikidataId: 'Q1194352',
    type: 'group',
    parentId: 'linguistics',
    relatedIds: ['anthropology', 'sociolinguistics'],
  },
  {
    id: 'applied-linguistics',
    label: 'Applied Linguistics',
    description:
      'Field concerned with practical applications of language studies, including language teaching, translation, and language policy.',
    wikidataId: 'Q2668830',
    type: 'group',
    parentId: 'linguistics',
    relatedIds: ['education', 'second-language-acquisition'],
  },
  {
    id: 'philosophy-of-language',
    label: 'Philosophy of Language',
    description:
      'Philosophical study of the nature of language, including meaning, reference, truth, and the relationship between language and reality.',
    wikidataId: 'Q179805',
    type: 'group',
    parentId: 'linguistics',
    relatedIds: ['philosophy', 'semantics', 'pragmatics'],
  },
];

/**
 * Historical and comparative linguistics.
 */
const LINGUISTICS_HISTORICAL: readonly FieldDefinition[] = [
  {
    id: 'historical-linguistics',
    label: 'Historical Linguistics',
    description:
      'Study of language change over time, including sound changes, grammaticalization, and language relatedness.',
    wikidataId: 'Q47157',
    type: 'group',
    parentId: 'linguistics',
    relatedIds: ['comparative-linguistics', 'etymology'],
  },
  {
    id: 'comparative-linguistics',
    label: 'Comparative Linguistics',
    description:
      'Branch of historical linguistics concerned with comparing languages to establish their historical relatedness.',
    wikidataId: 'Q191314',
    type: 'group',
    parentId: 'linguistics',
    relatedIds: ['historical-linguistics', 'typology'],
  },
  {
    id: 'etymology',
    label: 'Etymology',
    description:
      'Study of the history of words, their origins, and how their form and meaning have changed over time.',
    wikidataId: 'Q41583',
    type: 'field',
    parentId: 'historical-linguistics',
  },
  {
    id: 'language-reconstruction',
    label: 'Language Reconstruction',
    description:
      'Methods for inferring the features of ancestral languages from their descendant languages.',
    wikidataId: 'Q1195896',
    type: 'field',
    parentId: 'historical-linguistics',
  },
];

/**
 * Semantics subfields (detailed).
 */
const SEMANTICS_SUBFIELDS: readonly FieldDefinition[] = [
  {
    id: 'lexical-semantics',
    label: 'Lexical Semantics',
    description:
      'Study of word meanings, including sense relations (synonymy, antonymy, hyponymy), polysemy, and lexical decomposition.',
    wikidataId: 'Q1820446',
    type: 'field',
    parentId: 'semantics',
    relatedIds: ['morphology'],
  },
  {
    id: 'formal-semantics',
    label: 'Formal Semantics',
    description:
      'Study of meaning using formal tools from logic and mathematics, including model-theoretic and proof-theoretic approaches.',
    wikidataId: 'Q1353507',
    type: 'field',
    parentId: 'semantics',
    relatedIds: ['philosophy-of-language', 'syntax'],
  },
  {
    id: 'cognitive-semantics',
    label: 'Cognitive Semantics',
    description:
      'Study of meaning from a cognitive perspective, including conceptual metaphor, image schemas, and embodied cognition.',
    wikidataId: 'Q5141302',
    type: 'field',
    parentId: 'semantics',
    relatedIds: ['cognitive-science', 'psycholinguistics'],
  },
  {
    id: 'compositional-semantics',
    label: 'Compositional Semantics',
    description:
      'Study of how meanings of complex expressions are derived from meanings of their parts and rules of combination.',
    wikidataId: 'Q1124634',
    type: 'field',
    parentId: 'semantics',
    relatedIds: ['formal-semantics', 'syntax'],
  },
  {
    id: 'event-semantics',
    label: 'Event Semantics',
    description:
      'Semantic framework treating events as first-class entities, analyzing aspect, tense, and argument structure.',
    type: 'field',
    parentId: 'semantics',
    relatedIds: ['formal-semantics'],
  },
];

/**
 * Syntax subfields (detailed).
 */
const SYNTAX_SUBFIELDS: readonly FieldDefinition[] = [
  {
    id: 'generative-syntax',
    label: 'Generative Syntax',
    description:
      "Approach to syntax emphasizing innate grammatical knowledge and formal rule systems, following Chomsky's framework.",
    wikidataId: 'Q733103',
    type: 'field',
    parentId: 'syntax',
    relatedIds: ['minimalist-program'],
  },
  {
    id: 'minimalist-program',
    label: 'Minimalist Program',
    description:
      'Current stage of generative grammar, emphasizing economy principles and minimal computational mechanisms.',
    wikidataId: 'Q1928048',
    type: 'field',
    parentId: 'syntax',
    relatedIds: ['generative-syntax'],
  },
  {
    id: 'construction-grammar',
    label: 'Construction Grammar',
    description:
      'Family of theories viewing grammar as an inventory of constructions (form-meaning pairings) at various levels.',
    wikidataId: 'Q1140308',
    type: 'field',
    parentId: 'syntax',
    relatedIds: ['cognitive-semantics'],
  },
  {
    id: 'dependency-grammar',
    label: 'Dependency Grammar',
    description:
      'Syntactic framework based on dependency relations between words, where structure is determined by head-dependent asymmetries.',
    wikidataId: 'Q1199653',
    type: 'field',
    parentId: 'syntax',
    relatedIds: ['computational-linguistics'],
  },
  {
    id: 'categorial-grammar',
    label: 'Categorial Grammar',
    description:
      'Family of formalisms in which syntactic structure is derived from lexical categories and function application.',
    wikidataId: 'Q868898',
    type: 'field',
    parentId: 'syntax',
    relatedIds: ['formal-semantics', 'computational-linguistics'],
  },
  {
    id: 'head-driven-phrase-structure-grammar',
    label: 'Head-Driven Phrase Structure Grammar',
    description:
      'Constraint-based, lexicalist approach to grammatical theory using typed feature structures.',
    wikidataId: 'Q620419',
    type: 'field',
    parentId: 'syntax',
    relatedIds: ['computational-linguistics'],
  },
  {
    id: 'lexical-functional-grammar',
    label: 'Lexical Functional Grammar',
    description:
      'Syntactic theory emphasizing parallel structures and functional organization of grammatical information.',
    wikidataId: 'Q1142628',
    type: 'field',
    parentId: 'syntax',
    relatedIds: ['computational-linguistics'],
  },
];

/**
 * Phonology subfields (detailed).
 */
const PHONOLOGY_SUBFIELDS: readonly FieldDefinition[] = [
  {
    id: 'autosegmental-phonology',
    label: 'Autosegmental Phonology',
    description:
      'Phonological framework using separate tiers for different features (tone, vowel harmony), allowing independent spreading.',
    wikidataId: 'Q4824936',
    type: 'field',
    parentId: 'phonology',
  },
  {
    id: 'optimality-theory',
    label: 'Optimality Theory',
    description:
      'Constraint-based phonological framework where output forms are selected by ranking of violable constraints.',
    wikidataId: 'Q1140284',
    type: 'field',
    parentId: 'phonology',
    relatedIds: ['morphology'],
  },
  {
    id: 'metrical-phonology',
    label: 'Metrical Phonology',
    description: 'Study of rhythmic and stress patterns using hierarchical tree structures.',
    wikidataId: 'Q2583934',
    type: 'field',
    parentId: 'phonology',
  },
  {
    id: 'prosody',
    label: 'Prosody',
    description:
      'Study of suprasegmental features including intonation, stress, rhythm, and their linguistic functions.',
    wikidataId: 'Q1074290',
    type: 'field',
    parentId: 'phonology',
    relatedIds: ['phonetics', 'pragmatics'],
  },
  {
    id: 'laboratory-phonology',
    label: 'Laboratory Phonology',
    description:
      'Interdisciplinary approach combining phonological theory with experimental and quantitative methods.',
    wikidataId: 'Q6464102',
    type: 'field',
    parentId: 'phonology',
    relatedIds: ['phonetics', 'psycholinguistics'],
  },
];

/**
 * Phonetics subfields.
 */
const PHONETICS_SUBFIELDS: readonly FieldDefinition[] = [
  {
    id: 'articulatory-phonetics',
    label: 'Articulatory Phonetics',
    description:
      'Study of how speech sounds are produced by the articulatory organs (tongue, lips, vocal cords).',
    wikidataId: 'Q379895',
    type: 'field',
    parentId: 'phonetics',
  },
  {
    id: 'acoustic-phonetics',
    label: 'Acoustic Phonetics',
    description:
      'Study of the physical properties of speech sounds as they travel through the air.',
    wikidataId: 'Q421992',
    type: 'field',
    parentId: 'phonetics',
  },
  {
    id: 'auditory-phonetics',
    label: 'Auditory Phonetics',
    description:
      'Study of how speech sounds are perceived and processed by the human auditory system.',
    wikidataId: 'Q478665',
    type: 'field',
    parentId: 'phonetics',
    relatedIds: ['psycholinguistics'],
  },
];

/**
 * Language acquisition and learning.
 */
const LANGUAGE_ACQUISITION: readonly FieldDefinition[] = [
  {
    id: 'language-acquisition',
    label: 'Language Acquisition',
    description:
      'Study of how humans acquire language, including first language acquisition in children.',
    wikidataId: 'Q208041',
    type: 'group',
    parentId: 'linguistics',
    relatedIds: ['psycholinguistics', 'cognitive-science'],
  },
  {
    id: 'first-language-acquisition',
    label: 'First Language Acquisition',
    description:
      'Study of how children acquire their native language(s), including phonological, lexical, and syntactic development.',
    wikidataId: 'Q1411686',
    type: 'field',
    parentId: 'language-acquisition',
    relatedIds: ['psycholinguistics'],
  },
  {
    id: 'second-language-acquisition',
    label: 'Second Language Acquisition',
    description: 'Study of how people learn languages other than their native language.',
    wikidataId: 'Q187742',
    type: 'field',
    parentId: 'language-acquisition',
    relatedIds: ['applied-linguistics', 'education'],
  },
  {
    id: 'bilingualism',
    label: 'Bilingualism',
    description:
      'Study of the acquisition, representation, and processing of two or more languages.',
    wikidataId: 'Q105092',
    type: 'field',
    parentId: 'language-acquisition',
    relatedIds: ['psycholinguistics', 'sociolinguistics'],
  },
];

/**
 * Discourse and text linguistics.
 */
const DISCOURSE_LINGUISTICS: readonly FieldDefinition[] = [
  {
    id: 'discourse-analysis',
    label: 'Discourse Analysis',
    description:
      'Study of language in use above the sentence level, including coherence, cohesion, and discourse structure.',
    wikidataId: 'Q595094',
    type: 'group',
    parentId: 'linguistics',
    relatedIds: ['pragmatics', 'sociolinguistics'],
  },
  {
    id: 'conversation-analysis',
    label: 'Conversation Analysis',
    description:
      'Study of social interaction through naturally occurring talk, including turn-taking, repair, and sequence organization.',
    wikidataId: 'Q1197866',
    type: 'field',
    parentId: 'discourse-analysis',
    relatedIds: ['sociolinguistics', 'pragmatics'],
  },
  {
    id: 'corpus-linguistics',
    label: 'Corpus Linguistics',
    description:
      'Study of language using large collections of texts (corpora) and computational methods.',
    wikidataId: 'Q1137027',
    type: 'group',
    parentId: 'linguistics',
    relatedIds: ['computational-linguistics'],
  },
];

/**
 * Typology and universals.
 */
const TYPOLOGY_LINGUISTICS: readonly FieldDefinition[] = [
  {
    id: 'typology',
    label: 'Linguistic Typology',
    description:
      'Classification of languages according to their structural features and investigation of cross-linguistic patterns.',
    wikidataId: 'Q174159',
    type: 'group',
    parentId: 'linguistics',
    relatedIds: ['comparative-linguistics'],
  },
  {
    id: 'language-universals',
    label: 'Language Universals',
    description:
      'Study of properties shared by all human languages, whether absolute or statistical.',
    wikidataId: 'Q632008',
    type: 'field',
    parentId: 'typology',
    relatedIds: ['generative-syntax'],
  },
  {
    id: 'areal-linguistics',
    label: 'Areal Linguistics',
    description:
      'Study of linguistic features shared by languages in geographic proximity through contact.',
    wikidataId: 'Q660003',
    type: 'field',
    parentId: 'typology',
    relatedIds: ['sociolinguistics', 'historical-linguistics'],
  },
];

/**
 * NLP and computational fields (bridging CS and linguistics).
 */
const NLP_FIELDS: readonly FieldDefinition[] = [
  {
    id: 'natural-language-processing',
    label: 'Natural Language Processing',
    description:
      'Subfield of AI and linguistics concerned with enabling computers to understand, interpret, and generate human language.',
    wikidataId: 'Q30642',
    type: 'group',
    parentId: 'computer-science',
    relatedIds: ['computational-linguistics', 'machine-learning'],
  },
  {
    id: 'machine-translation',
    label: 'Machine Translation',
    description: 'Use of software to translate text or speech from one language to another.',
    wikidataId: 'Q206883',
    type: 'field',
    parentId: 'natural-language-processing',
    relatedIds: ['computational-linguistics'],
  },
  {
    id: 'speech-recognition',
    label: 'Speech Recognition',
    description:
      'Interdisciplinary subfield enabling computers to recognize and translate spoken language into text.',
    wikidataId: 'Q206948',
    type: 'field',
    parentId: 'natural-language-processing',
    relatedIds: ['phonetics', 'acoustic-phonetics'],
  },
  {
    id: 'speech-synthesis',
    label: 'Speech Synthesis',
    description:
      'Artificial production of human speech, converting text to natural-sounding speech.',
    wikidataId: 'Q185799',
    type: 'field',
    parentId: 'natural-language-processing',
    relatedIds: ['phonetics'],
  },
  {
    id: 'information-extraction',
    label: 'Information Extraction',
    description: 'Task of automatically extracting structured information from unstructured text.',
    wikidataId: 'Q854442',
    type: 'field',
    parentId: 'natural-language-processing',
  },
  {
    id: 'sentiment-analysis',
    label: 'Sentiment Analysis',
    description:
      'Use of NLP to identify and extract subjective information such as opinions and attitudes from text.',
    wikidataId: 'Q2386426',
    type: 'field',
    parentId: 'natural-language-processing',
  },
  {
    id: 'question-answering',
    label: 'Question Answering',
    description:
      'Field of information retrieval and NLP focused on automatically answering questions posed in natural language.',
    wikidataId: 'Q1476063',
    type: 'field',
    parentId: 'natural-language-processing',
  },
  {
    id: 'text-summarization',
    label: 'Text Summarization',
    description:
      'Process of producing concise summaries while preserving key information from source documents.',
    wikidataId: 'Q1318310',
    type: 'field',
    parentId: 'natural-language-processing',
  },
];

/**
 * Machine learning fields relevant to NLP.
 */
const ML_FIELDS: readonly FieldDefinition[] = [
  {
    id: 'machine-learning',
    label: 'Machine Learning',
    description:
      'Field of AI that gives computers the ability to learn without being explicitly programmed.',
    wikidataId: 'Q2539',
    type: 'group',
    parentId: 'computer-science',
    relatedIds: ['natural-language-processing', 'artificial-intelligence'],
  },
  {
    id: 'deep-learning',
    label: 'Deep Learning',
    description:
      'Machine learning methods based on artificial neural networks with multiple layers.',
    wikidataId: 'Q197536',
    type: 'field',
    parentId: 'machine-learning',
    relatedIds: ['natural-language-processing'],
  },
  {
    id: 'artificial-intelligence',
    label: 'Artificial Intelligence',
    description:
      'Field of computer science dedicated to creating systems capable of performing tasks that typically require human intelligence.',
    wikidataId: 'Q11660',
    type: 'group',
    parentId: 'computer-science',
    relatedIds: ['machine-learning', 'cognitive-science'],
  },
];

/**
 * All field definitions combined.
 */
const ALL_FIELDS: readonly FieldDefinition[] = [
  ...DOMAINS,
  ...DIVISIONS,
  ...LINGUISTICS_CORE,
  ...LINGUISTICS_INTERDISCIPLINARY,
  ...LINGUISTICS_HISTORICAL,
  ...SEMANTICS_SUBFIELDS,
  ...SYNTAX_SUBFIELDS,
  ...PHONOLOGY_SUBFIELDS,
  ...PHONETICS_SUBFIELDS,
  ...LANGUAGE_ACQUISITION,
  ...DISCOURSE_LINGUISTICS,
  ...TYPOLOGY_LINGUISTICS,
  ...NLP_FIELDS,
  ...ML_FIELDS,
];

// =============================================================================
// Seeding Functions
// =============================================================================

/**
 * Seed contribution types.
 */
async function seedContributionTypes(session: Session, governanceDid: string): Promise<void> {
  console.log('Seeding CRediT contribution types...');

  for (const role of CREDIT_TAXONOMY) {
    const externalMappings = [
      {
        system: 'credit',
        identifier: role.id,
        uri: role.creditUri,
        matchType: 'exact-match',
      },
    ];

    if (role.croUri) {
      externalMappings.push({
        system: 'cro',
        identifier: role.croUri.split('/').pop() ?? role.id,
        uri: role.croUri,
        matchType: 'exact-match',
      });
    }

    await session.run(
      `
      MERGE (ct:ContributionType {typeId: $typeId})
      ON CREATE SET
        ct.uri = $uri,
        ct.label = $label,
        ct.description = $description,
        ct.externalMappings = $externalMappings,
        ct.status = 'established',
        ct.proposalUri = null,
        ct.source = 'credit',
        ct.createdAt = datetime()
      ON MATCH SET
        ct.label = $label,
        ct.description = $description,
        ct.externalMappings = $externalMappings,
        ct.updatedAt = datetime()
      `,
      {
        typeId: role.id,
        uri: `at://${governanceDid}/pub.chive.contribution.type/${role.id}`,
        label: role.label,
        description: role.description,
        externalMappings: JSON.stringify(externalMappings),
      }
    );
  }

  console.log(`  Created ${CREDIT_TAXONOMY.length} contribution types`);
}

/**
 * Seed academic fields.
 */
async function seedFields(session: Session, governanceDid: string): Promise<void> {
  console.log('Seeding academic fields...');

  for (const field of ALL_FIELDS) {
    await session.run(
      `
      MERGE (f:Field {id: $id})
      ON CREATE SET
        f.uri = $uri,
        f.label = $label,
        f.description = $description,
        f.type = $type,
        f.wikidataId = $wikidataId,
        f.anzsrcCode = $anzsrcCode,
        f.status = 'established',
        f.source = 'seed',
        f.createdAt = datetime()
      ON MATCH SET
        f.label = $label,
        f.description = $description,
        f.wikidataId = $wikidataId,
        f.anzsrcCode = $anzsrcCode,
        f.updatedAt = datetime()
      `,
      {
        id: field.id,
        uri: `at://${governanceDid}/pub.chive.graph.field/${field.id}`,
        label: field.label,
        description: field.description,
        type: field.type,
        wikidataId: field.wikidataId ?? null,
        anzsrcCode: field.anzsrcCode ?? null,
      }
    );
  }

  console.log(`  Created ${ALL_FIELDS.length} fields`);
}

/**
 * Create field hierarchy relationships.
 */
async function seedFieldRelationships(session: Session): Promise<void> {
  console.log('Creating field relationships...');

  let parentCount = 0;
  let relatedCount = 0;

  // Create PARENT_OF relationships
  for (const field of ALL_FIELDS) {
    if (field.parentId) {
      await session.run(
        `
        MATCH (parent:Field {id: $parentId})
        MATCH (child:Field {id: $childId})
        MERGE (parent)-[r:PARENT_OF]->(child)
        ON CREATE SET r.createdAt = datetime()
        `,
        {
          parentId: field.parentId,
          childId: field.id,
        }
      );
      parentCount++;
    }
  }

  // Create RELATED_TO relationships
  for (const field of ALL_FIELDS) {
    if (field.relatedIds) {
      for (const relatedId of field.relatedIds) {
        await session.run(
          `
          MATCH (a:Field {id: $fieldId})
          MATCH (b:Field {id: $relatedId})
          MERGE (a)-[r:RELATED_TO]-(b)
          ON CREATE SET r.createdAt = datetime(), r.source = 'seed'
          `,
          {
            fieldId: field.id,
            relatedId: relatedId,
          }
        );
        relatedCount++;
      }
    }
  }

  // Connect all domains to root
  await session.run(
    `
    MATCH (root:Field {id: 'root'})
    MATCH (domain:Field)
    WHERE domain.type = 'domain'
    MERGE (root)-[r:PARENT_OF]->(domain)
    ON CREATE SET r.createdAt = datetime()
    `
  );

  console.log(`  Created ${parentCount} parent relationships`);
  console.log(`  Created ${relatedCount} related relationships`);
}

/**
 * Add constraint for ContributionType if not exists.
 */
async function ensureConstraints(session: Session): Promise<void> {
  console.log('Ensuring constraints...');

  await session.run(`
    CREATE CONSTRAINT contribution_type_id_unique IF NOT EXISTS
    FOR (ct:ContributionType) REQUIRE ct.typeId IS UNIQUE
  `);

  await session.run(`
    CREATE CONSTRAINT contribution_type_uri_unique IF NOT EXISTS
    FOR (ct:ContributionType) REQUIRE ct.uri IS UNIQUE
  `);

  await session.run(`
    CREATE INDEX contribution_type_status_idx IF NOT EXISTS
    FOR (ct:ContributionType) ON (ct.status)
  `);
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
    await ensureConstraints(session);
    await seedContributionTypes(session, governanceDid);
    await seedFields(session, governanceDid);
    await seedFieldRelationships(session);

    // Print summary
    const summary = await session.run(`
      MATCH (ct:ContributionType) WITH count(ct) as types
      MATCH (f:Field) WITH types, count(f) as fields
      MATCH ()-[r:PARENT_OF]->() WITH types, fields, count(r) as parents
      MATCH ()-[r:RELATED_TO]-() WITH types, fields, parents, count(r)/2 as related
      RETURN types, fields, parents, related
    `);

    const record = summary.records[0];
    console.log('\n=== Seed Summary ===');
    console.log(`Contribution Types: ${record?.get('types')}`);
    console.log(`Fields: ${record?.get('fields')}`);
    console.log(`Parent Relationships: ${record?.get('parents')}`);
    console.log(`Related Relationships: ${record?.get('related')}`);
    console.log('====================\n');

    console.log('Knowledge graph seeding complete!');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await session.close();
    await driver.close();
  }
}

main();
