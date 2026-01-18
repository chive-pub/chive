/**
 * Academic Field definitions.
 *
 * @remarks
 * Comprehensive hierarchy based on ANZSRC 2020 (Australian and New Zealand
 * Standard Research Classification) and OECD Frascati Manual Fields of Science.
 *
 * @see {@link https://www.abs.gov.au/statistics/classifications/australian-and-new-zealand-standard-research-classification-anzsrc/2020 | ANZSRC 2020}
 * @see {@link https://www.oecd.org/science/inno/frascati-manual.htm | OECD Frascati Manual}
 */

export interface FieldDefinition {
  readonly slug: string;
  readonly label: string;
  readonly description: string;
  readonly wikidataId?: string;
  readonly anzsrcCode?: string;
  readonly type: 'domain' | 'division' | 'group' | 'field';
  readonly parentSlug?: string;
  readonly relatedSlugs?: readonly string[];
}

// =============================================================================
// Top-Level Domains
// =============================================================================

const DOMAINS: readonly FieldDefinition[] = [
  {
    slug: 'natural-sciences',
    label: 'Natural Sciences',
    description:
      'Sciences concerned with the description, understanding, and prediction of natural phenomena based on empirical evidence.',
    wikidataId: 'Q7991',
    type: 'domain',
  },
  {
    slug: 'engineering-technology',
    label: 'Engineering and Technology',
    description:
      'Application of scientific knowledge for practical purposes, including design, construction, and operation of structures, machines, and systems.',
    wikidataId: 'Q11023',
    type: 'domain',
  },
  {
    slug: 'medical-health-sciences',
    label: 'Medical and Health Sciences',
    description:
      'Sciences dealing with the maintenance of health and the prevention and treatment of disease.',
    wikidataId: 'Q11190',
    type: 'domain',
  },
  {
    slug: 'agricultural-veterinary',
    label: 'Agricultural and Veterinary Sciences',
    description:
      'Sciences relating to the practice of agriculture, animal husbandry, and food production.',
    wikidataId: 'Q11451',
    type: 'domain',
  },
  {
    slug: 'social-sciences',
    label: 'Social Sciences',
    description:
      'Sciences concerned with society and the relationships among individuals within a society.',
    wikidataId: 'Q34749',
    type: 'domain',
  },
  {
    slug: 'humanities-arts',
    label: 'Humanities and Arts',
    description:
      'Academic disciplines that study aspects of human society and culture, including history, philosophy, literature, and the arts.',
    wikidataId: 'Q80083',
    type: 'domain',
  },
];

// =============================================================================
// Major Divisions
// =============================================================================

const DIVISIONS: readonly FieldDefinition[] = [
  // Natural Sciences
  {
    slug: 'mathematics',
    label: 'Mathematics',
    description:
      'The abstract science of number, quantity, and space, either as abstract concepts or as applied to other disciplines.',
    wikidataId: 'Q395',
    anzsrcCode: '49',
    type: 'division',
    parentSlug: 'natural-sciences',
  },
  {
    slug: 'physics',
    label: 'Physics',
    description:
      'The natural science that studies matter, its fundamental constituents, motion, energy, and force.',
    wikidataId: 'Q413',
    anzsrcCode: '51',
    type: 'division',
    parentSlug: 'natural-sciences',
  },
  {
    slug: 'chemistry',
    label: 'Chemistry',
    description:
      'The scientific study of the properties and behavior of matter, including its composition, structure, and changes.',
    wikidataId: 'Q2329',
    anzsrcCode: '34',
    type: 'division',
    parentSlug: 'natural-sciences',
  },
  {
    slug: 'earth-sciences',
    label: 'Earth Sciences',
    description:
      'Sciences related to the planet Earth, including geology, geophysics, oceanography, and atmospheric science.',
    wikidataId: 'Q8008',
    anzsrcCode: '37',
    type: 'division',
    parentSlug: 'natural-sciences',
  },
  {
    slug: 'biological-sciences',
    label: 'Biological Sciences',
    description:
      'Natural science concerned with the study of life and living organisms, including their structure, function, growth, and evolution.',
    wikidataId: 'Q420',
    anzsrcCode: '31',
    type: 'division',
    parentSlug: 'natural-sciences',
  },
  // Engineering and Technology
  {
    slug: 'computer-science',
    label: 'Computer Science',
    description:
      'The study of computation, information, and automation, including the design and analysis of algorithms and data structures.',
    wikidataId: 'Q21198',
    anzsrcCode: '46',
    type: 'division',
    parentSlug: 'engineering-technology',
    relatedSlugs: ['mathematics', 'linguistics'],
  },
  {
    slug: 'electrical-engineering',
    label: 'Electrical Engineering',
    description:
      'Engineering discipline concerned with the study, design, and application of equipment and systems using electricity and electronics.',
    wikidataId: 'Q43035',
    anzsrcCode: '40',
    type: 'division',
    parentSlug: 'engineering-technology',
  },
  {
    slug: 'mechanical-engineering',
    label: 'Mechanical Engineering',
    description:
      'Engineering discipline that combines engineering physics, mathematics, and materials science to design and manufacture mechanical systems.',
    wikidataId: 'Q101333',
    anzsrcCode: '40',
    type: 'division',
    parentSlug: 'engineering-technology',
  },
  {
    slug: 'civil-engineering',
    label: 'Civil Engineering',
    description:
      'Professional engineering discipline that deals with the design, construction, and maintenance of the physical and naturally built environment.',
    wikidataId: 'Q77590',
    anzsrcCode: '40',
    type: 'division',
    parentSlug: 'engineering-technology',
  },
  {
    slug: 'materials-science',
    label: 'Materials Science',
    description:
      'Interdisciplinary field involving the properties of matter and its applications to various areas of science and engineering.',
    wikidataId: 'Q228736',
    anzsrcCode: '40',
    type: 'division',
    parentSlug: 'engineering-technology',
  },
  // Medical and Health Sciences
  {
    slug: 'clinical-medicine',
    label: 'Clinical Medicine',
    description: 'Branch of medicine dealing with the observation and treatment of patients.',
    wikidataId: 'Q7114438',
    anzsrcCode: '32',
    type: 'division',
    parentSlug: 'medical-health-sciences',
  },
  {
    slug: 'neuroscience',
    label: 'Neuroscience',
    description:
      'Scientific study of the nervous system, encompassing the structure, function, development, and pathology of neural systems.',
    wikidataId: 'Q7141',
    anzsrcCode: '32',
    type: 'division',
    parentSlug: 'medical-health-sciences',
    relatedSlugs: ['psychology', 'cognitive-science'],
  },
  {
    slug: 'public-health',
    label: 'Public Health',
    description:
      'Science and art of preventing disease, prolonging life, and promoting health through organized efforts of society.',
    wikidataId: 'Q189603',
    anzsrcCode: '42',
    type: 'division',
    parentSlug: 'medical-health-sciences',
  },
  // Social Sciences
  {
    slug: 'psychology',
    label: 'Psychology',
    description:
      'Scientific study of mind and behavior, encompassing conscious and unconscious phenomena, feelings, and thought.',
    wikidataId: 'Q9418',
    anzsrcCode: '52',
    type: 'division',
    parentSlug: 'social-sciences',
    relatedSlugs: ['neuroscience', 'linguistics', 'cognitive-science'],
  },
  {
    slug: 'economics',
    label: 'Economics',
    description:
      'Social science that studies the production, distribution, and consumption of goods and services.',
    wikidataId: 'Q8134',
    anzsrcCode: '38',
    type: 'division',
    parentSlug: 'social-sciences',
  },
  {
    slug: 'sociology',
    label: 'Sociology',
    description:
      'Study of society, patterns of social relationships, social interaction, and culture of everyday life.',
    wikidataId: 'Q21201',
    anzsrcCode: '44',
    type: 'division',
    parentSlug: 'social-sciences',
  },
  {
    slug: 'political-science',
    label: 'Political Science',
    description:
      'Scientific study of politics, government systems, political behavior, and analysis of political activities.',
    wikidataId: 'Q36442',
    anzsrcCode: '44',
    type: 'division',
    parentSlug: 'social-sciences',
  },
  {
    slug: 'anthropology',
    label: 'Anthropology',
    description:
      'Scientific study of humans, human behavior, and societies in the past and present.',
    wikidataId: 'Q23404',
    anzsrcCode: '44',
    type: 'division',
    parentSlug: 'social-sciences',
    relatedSlugs: ['linguistics', 'archaeology'],
  },
  {
    slug: 'education',
    label: 'Education',
    description: 'Academic field concerned with methods and theories of teaching and learning.',
    wikidataId: 'Q8434',
    anzsrcCode: '39',
    type: 'division',
    parentSlug: 'social-sciences',
  },
  {
    slug: 'law',
    label: 'Law',
    description:
      'System of rules created and enforced through social or governmental institutions to regulate behavior.',
    wikidataId: 'Q7748',
    anzsrcCode: '48',
    type: 'division',
    parentSlug: 'social-sciences',
  },
  // Humanities and Arts
  {
    slug: 'philosophy',
    label: 'Philosophy',
    description:
      'Study of general and fundamental questions about existence, knowledge, values, reason, mind, and language.',
    wikidataId: 'Q5891',
    anzsrcCode: '50',
    type: 'division',
    parentSlug: 'humanities-arts',
    relatedSlugs: ['linguistics', 'cognitive-science'],
  },
  {
    slug: 'history',
    label: 'History',
    description: 'Study and documentation of the past, particularly events, people, and societies.',
    wikidataId: 'Q309',
    anzsrcCode: '43',
    type: 'division',
    parentSlug: 'humanities-arts',
  },
  {
    slug: 'linguistics',
    label: 'Linguistics',
    description:
      'Scientific study of language and its structure, including morphology, syntax, phonetics, phonology, semantics, and pragmatics.',
    wikidataId: 'Q8162',
    anzsrcCode: '4704',
    type: 'division',
    parentSlug: 'humanities-arts',
    relatedSlugs: [
      'computer-science',
      'psychology',
      'philosophy',
      'cognitive-science',
      'anthropology',
    ],
  },
  {
    slug: 'literary-studies',
    label: 'Literary Studies',
    description:
      'Academic discipline devoted to the study of literature, including poetry, prose, and drama.',
    wikidataId: 'Q8242',
    anzsrcCode: '4705',
    type: 'division',
    parentSlug: 'humanities-arts',
  },
  {
    slug: 'religious-studies',
    label: 'Religious Studies',
    description:
      'Academic field devoted to research into religious beliefs, behaviors, and institutions.',
    wikidataId: 'Q9174',
    anzsrcCode: '50',
    type: 'division',
    parentSlug: 'humanities-arts',
  },
  {
    slug: 'arts',
    label: 'Arts',
    description:
      'Creative activities and disciplines including visual arts, performing arts, and creative writing.',
    wikidataId: 'Q735',
    anzsrcCode: '36',
    type: 'division',
    parentSlug: 'humanities-arts',
  },
  // Interdisciplinary
  {
    slug: 'cognitive-science',
    label: 'Cognitive Science',
    description:
      'Interdisciplinary study of the mind and its processes, drawing on psychology, neuroscience, linguistics, philosophy, and AI.',
    wikidataId: 'Q147638',
    type: 'division',
    parentSlug: 'social-sciences',
    relatedSlugs: ['psychology', 'neuroscience', 'linguistics', 'philosophy', 'computer-science'],
  },
];

// =============================================================================
// Linguistics Subfields
// =============================================================================

const LINGUISTICS_CORE: readonly FieldDefinition[] = [
  {
    slug: 'phonetics',
    label: 'Phonetics',
    description:
      'Study of the physical sounds of human speech, including their production, acoustic properties, and perception.',
    wikidataId: 'Q40998',
    type: 'group',
    parentSlug: 'linguistics',
    relatedSlugs: ['phonology'],
  },
  {
    slug: 'phonology',
    label: 'Phonology',
    description:
      'Study of the systematic organization of sounds in languages, including phonemes, allophones, and phonological rules.',
    wikidataId: 'Q40803',
    type: 'group',
    parentSlug: 'linguistics',
    relatedSlugs: ['phonetics', 'morphology'],
  },
  {
    slug: 'morphology',
    label: 'Morphology',
    description:
      'Study of the internal structure of words, including morphemes, word formation processes, and inflection.',
    wikidataId: 'Q131261',
    type: 'group',
    parentSlug: 'linguistics',
    relatedSlugs: ['phonology', 'syntax'],
  },
  {
    slug: 'syntax',
    label: 'Syntax',
    description:
      'Study of sentence structure and the rules governing the arrangement of words, phrases, and clauses.',
    wikidataId: 'Q37437',
    type: 'group',
    parentSlug: 'linguistics',
    relatedSlugs: ['morphology', 'semantics'],
  },
  {
    slug: 'semantics',
    label: 'Semantics',
    description:
      'Study of meaning in language, including word meaning, sentence meaning, and the relationship between linguistic expressions and their referents.',
    wikidataId: 'Q39645',
    type: 'group',
    parentSlug: 'linguistics',
    relatedSlugs: ['syntax', 'pragmatics', 'philosophy-of-language'],
  },
  {
    slug: 'pragmatics',
    label: 'Pragmatics',
    description:
      'Study of how context contributes to meaning, including speech acts, implicature, deixis, and discourse structure.',
    wikidataId: 'Q192985',
    type: 'group',
    parentSlug: 'linguistics',
    relatedSlugs: ['semantics', 'discourse-analysis', 'sociolinguistics'],
  },
];

const LINGUISTICS_INTERDISCIPLINARY: readonly FieldDefinition[] = [
  {
    slug: 'psycholinguistics',
    label: 'Psycholinguistics',
    description:
      'Study of the psychological and neurobiological factors enabling language acquisition, comprehension, and production.',
    wikidataId: 'Q185043',
    type: 'group',
    parentSlug: 'linguistics',
    relatedSlugs: ['cognitive-science', 'neurolinguistics', 'language-acquisition'],
  },
  {
    slug: 'neurolinguistics',
    label: 'Neurolinguistics',
    description:
      'Study of the neural mechanisms in the brain that control language comprehension, production, and acquisition.',
    wikidataId: 'Q583405',
    type: 'group',
    parentSlug: 'linguistics',
    relatedSlugs: ['neuroscience', 'psycholinguistics', 'cognitive-science'],
  },
  {
    slug: 'sociolinguistics',
    label: 'Sociolinguistics',
    description:
      'Study of the relationship between language and society, including language variation, change, and social identity.',
    wikidataId: 'Q40634',
    type: 'group',
    parentSlug: 'linguistics',
    relatedSlugs: ['sociology', 'anthropological-linguistics', 'pragmatics'],
  },
  {
    slug: 'computational-linguistics',
    label: 'Computational Linguistics',
    description:
      'Interdisciplinary field concerned with statistical or rule-based modeling of natural language from a computational perspective.',
    wikidataId: 'Q182557',
    anzsrcCode: '470403',
    type: 'group',
    parentSlug: 'linguistics',
    relatedSlugs: ['computer-science', 'natural-language-processing', 'machine-learning'],
  },
  {
    slug: 'anthropological-linguistics',
    label: 'Anthropological Linguistics',
    description:
      'Study of the relationship between language and culture, and how language shapes social life.',
    wikidataId: 'Q1194352',
    type: 'group',
    parentSlug: 'linguistics',
    relatedSlugs: ['anthropology', 'sociolinguistics'],
  },
  {
    slug: 'applied-linguistics',
    label: 'Applied Linguistics',
    description:
      'Field concerned with practical applications of language studies, including language teaching, translation, and language policy.',
    wikidataId: 'Q2668830',
    type: 'group',
    parentSlug: 'linguistics',
    relatedSlugs: ['education', 'second-language-acquisition'],
  },
  {
    slug: 'philosophy-of-language',
    label: 'Philosophy of Language',
    description:
      'Philosophical study of the nature of language, including meaning, reference, truth, and the relationship between language and reality.',
    wikidataId: 'Q179805',
    type: 'group',
    parentSlug: 'linguistics',
    relatedSlugs: ['philosophy', 'semantics', 'pragmatics'],
  },
];

const LINGUISTICS_HISTORICAL: readonly FieldDefinition[] = [
  {
    slug: 'historical-linguistics',
    label: 'Historical Linguistics',
    description:
      'Study of language change over time, including sound changes, grammaticalization, and language relatedness.',
    wikidataId: 'Q47157',
    type: 'group',
    parentSlug: 'linguistics',
    relatedSlugs: ['comparative-linguistics', 'etymology'],
  },
  {
    slug: 'comparative-linguistics',
    label: 'Comparative Linguistics',
    description:
      'Branch of historical linguistics concerned with comparing languages to establish their historical relatedness.',
    wikidataId: 'Q191314',
    type: 'group',
    parentSlug: 'linguistics',
    relatedSlugs: ['historical-linguistics', 'typology'],
  },
  {
    slug: 'etymology',
    label: 'Etymology',
    description:
      'Study of the history of words, their origins, and how their form and meaning have changed over time.',
    wikidataId: 'Q41583',
    type: 'field',
    parentSlug: 'historical-linguistics',
  },
  {
    slug: 'language-reconstruction',
    label: 'Language Reconstruction',
    description:
      'Methods for inferring the features of ancestral languages from their descendant languages.',
    wikidataId: 'Q1195896',
    type: 'field',
    parentSlug: 'historical-linguistics',
  },
];

const SEMANTICS_SUBFIELDS: readonly FieldDefinition[] = [
  {
    slug: 'lexical-semantics',
    label: 'Lexical Semantics',
    description:
      'Study of word meanings, including sense relations (synonymy, antonymy, hyponymy), polysemy, and lexical decomposition.',
    wikidataId: 'Q1820446',
    type: 'field',
    parentSlug: 'semantics',
    relatedSlugs: ['morphology'],
  },
  {
    slug: 'formal-semantics',
    label: 'Formal Semantics',
    description:
      'Study of meaning using formal tools from logic and mathematics, including model-theoretic and proof-theoretic approaches.',
    wikidataId: 'Q1353507',
    type: 'field',
    parentSlug: 'semantics',
    relatedSlugs: ['philosophy-of-language', 'syntax'],
  },
  {
    slug: 'cognitive-semantics',
    label: 'Cognitive Semantics',
    description:
      'Study of meaning from a cognitive perspective, including conceptual metaphor, image schemas, and embodied cognition.',
    wikidataId: 'Q5141302',
    type: 'field',
    parentSlug: 'semantics',
    relatedSlugs: ['cognitive-science', 'psycholinguistics'],
  },
  {
    slug: 'compositional-semantics',
    label: 'Compositional Semantics',
    description:
      'Study of how meanings of complex expressions are derived from meanings of their parts and rules of combination.',
    wikidataId: 'Q1124634',
    type: 'field',
    parentSlug: 'semantics',
    relatedSlugs: ['formal-semantics', 'syntax'],
  },
  {
    slug: 'event-semantics',
    label: 'Event Semantics',
    description:
      'Semantic framework treating events as first-class entities, analyzing aspect, tense, and argument structure.',
    type: 'field',
    parentSlug: 'semantics',
    relatedSlugs: ['formal-semantics'],
  },
];

const SYNTAX_SUBFIELDS: readonly FieldDefinition[] = [
  {
    slug: 'generative-syntax',
    label: 'Generative Syntax',
    description:
      "Approach to syntax emphasizing innate grammatical knowledge and formal rule systems, following Chomsky's framework.",
    wikidataId: 'Q733103',
    type: 'field',
    parentSlug: 'syntax',
    relatedSlugs: ['minimalist-program'],
  },
  {
    slug: 'minimalist-program',
    label: 'Minimalist Program',
    description:
      'Current stage of generative grammar, emphasizing economy principles and minimal computational mechanisms.',
    wikidataId: 'Q1928048',
    type: 'field',
    parentSlug: 'syntax',
    relatedSlugs: ['generative-syntax'],
  },
  {
    slug: 'construction-grammar',
    label: 'Construction Grammar',
    description:
      'Family of theories viewing grammar as an inventory of constructions (form-meaning pairings) at various levels.',
    wikidataId: 'Q1140308',
    type: 'field',
    parentSlug: 'syntax',
    relatedSlugs: ['cognitive-semantics'],
  },
  {
    slug: 'dependency-grammar',
    label: 'Dependency Grammar',
    description:
      'Syntactic framework based on dependency relations between words, where structure is determined by head-dependent asymmetries.',
    wikidataId: 'Q1199653',
    type: 'field',
    parentSlug: 'syntax',
    relatedSlugs: ['computational-linguistics'],
  },
  {
    slug: 'categorial-grammar',
    label: 'Categorial Grammar',
    description:
      'Family of formalisms in which syntactic structure is derived from lexical categories and function application.',
    wikidataId: 'Q868898',
    type: 'field',
    parentSlug: 'syntax',
    relatedSlugs: ['formal-semantics', 'computational-linguistics'],
  },
  {
    slug: 'head-driven-phrase-structure-grammar',
    label: 'Head-Driven Phrase Structure Grammar',
    description:
      'Constraint-based, lexicalist approach to grammatical theory using typed feature structures.',
    wikidataId: 'Q620419',
    type: 'field',
    parentSlug: 'syntax',
    relatedSlugs: ['computational-linguistics'],
  },
  {
    slug: 'lexical-functional-grammar',
    label: 'Lexical Functional Grammar',
    description:
      'Syntactic theory emphasizing parallel structures and functional organization of grammatical information.',
    wikidataId: 'Q1142628',
    type: 'field',
    parentSlug: 'syntax',
    relatedSlugs: ['computational-linguistics'],
  },
];

const PHONOLOGY_SUBFIELDS: readonly FieldDefinition[] = [
  {
    slug: 'autosegmental-phonology',
    label: 'Autosegmental Phonology',
    description:
      'Phonological framework using separate tiers for different features (tone, vowel harmony), allowing independent spreading.',
    wikidataId: 'Q4824936',
    type: 'field',
    parentSlug: 'phonology',
  },
  {
    slug: 'optimality-theory',
    label: 'Optimality Theory',
    description:
      'Constraint-based phonological framework where output forms are selected by ranking of violable constraints.',
    wikidataId: 'Q1140284',
    type: 'field',
    parentSlug: 'phonology',
    relatedSlugs: ['morphology'],
  },
  {
    slug: 'metrical-phonology',
    label: 'Metrical Phonology',
    description: 'Study of rhythmic and stress patterns using hierarchical tree structures.',
    wikidataId: 'Q2583934',
    type: 'field',
    parentSlug: 'phonology',
  },
  {
    slug: 'prosody',
    label: 'Prosody',
    description:
      'Study of suprasegmental features including intonation, stress, rhythm, and their linguistic functions.',
    wikidataId: 'Q1074290',
    type: 'field',
    parentSlug: 'phonology',
    relatedSlugs: ['phonetics', 'pragmatics'],
  },
  {
    slug: 'laboratory-phonology',
    label: 'Laboratory Phonology',
    description:
      'Interdisciplinary approach combining phonological theory with experimental and quantitative methods.',
    wikidataId: 'Q6464102',
    type: 'field',
    parentSlug: 'phonology',
    relatedSlugs: ['phonetics', 'psycholinguistics'],
  },
];

const PHONETICS_SUBFIELDS: readonly FieldDefinition[] = [
  {
    slug: 'articulatory-phonetics',
    label: 'Articulatory Phonetics',
    description:
      'Study of how speech sounds are produced by the articulatory organs (tongue, lips, vocal cords).',
    wikidataId: 'Q379895',
    type: 'field',
    parentSlug: 'phonetics',
  },
  {
    slug: 'acoustic-phonetics',
    label: 'Acoustic Phonetics',
    description:
      'Study of the physical properties of speech sounds as they travel through the air.',
    wikidataId: 'Q421992',
    type: 'field',
    parentSlug: 'phonetics',
  },
  {
    slug: 'auditory-phonetics',
    label: 'Auditory Phonetics',
    description:
      'Study of how speech sounds are perceived and processed by the human auditory system.',
    wikidataId: 'Q478665',
    type: 'field',
    parentSlug: 'phonetics',
    relatedSlugs: ['psycholinguistics'],
  },
];

const LANGUAGE_ACQUISITION: readonly FieldDefinition[] = [
  {
    slug: 'language-acquisition',
    label: 'Language Acquisition',
    description:
      'Study of how humans acquire language, including first language acquisition in children.',
    wikidataId: 'Q208041',
    type: 'group',
    parentSlug: 'linguistics',
    relatedSlugs: ['psycholinguistics', 'cognitive-science'],
  },
  {
    slug: 'first-language-acquisition',
    label: 'First Language Acquisition',
    description:
      'Study of how children acquire their native language(s), including phonological, lexical, and syntactic development.',
    wikidataId: 'Q1411686',
    type: 'field',
    parentSlug: 'language-acquisition',
    relatedSlugs: ['psycholinguistics'],
  },
  {
    slug: 'second-language-acquisition',
    label: 'Second Language Acquisition',
    description: 'Study of how people learn languages other than their native language.',
    wikidataId: 'Q187742',
    type: 'field',
    parentSlug: 'language-acquisition',
    relatedSlugs: ['applied-linguistics', 'education'],
  },
  {
    slug: 'bilingualism',
    label: 'Bilingualism',
    description:
      'Study of the acquisition, representation, and processing of two or more languages.',
    wikidataId: 'Q105092',
    type: 'field',
    parentSlug: 'language-acquisition',
    relatedSlugs: ['psycholinguistics', 'sociolinguistics'],
  },
];

const DISCOURSE_LINGUISTICS: readonly FieldDefinition[] = [
  {
    slug: 'discourse-analysis',
    label: 'Discourse Analysis',
    description:
      'Study of language in use above the sentence level, including coherence, cohesion, and discourse structure.',
    wikidataId: 'Q595094',
    type: 'group',
    parentSlug: 'linguistics',
    relatedSlugs: ['pragmatics', 'sociolinguistics'],
  },
  {
    slug: 'conversation-analysis',
    label: 'Conversation Analysis',
    description:
      'Study of social interaction through naturally occurring talk, including turn-taking, repair, and sequence organization.',
    wikidataId: 'Q1197866',
    type: 'field',
    parentSlug: 'discourse-analysis',
    relatedSlugs: ['sociolinguistics', 'pragmatics'],
  },
  {
    slug: 'corpus-linguistics',
    label: 'Corpus Linguistics',
    description:
      'Study of language using large collections of texts (corpora) and computational methods.',
    wikidataId: 'Q1137027',
    type: 'group',
    parentSlug: 'linguistics',
    relatedSlugs: ['computational-linguistics'],
  },
];

const TYPOLOGY_LINGUISTICS: readonly FieldDefinition[] = [
  {
    slug: 'typology',
    label: 'Linguistic Typology',
    description:
      'Classification of languages according to their structural features and investigation of cross-linguistic patterns.',
    wikidataId: 'Q174159',
    type: 'group',
    parentSlug: 'linguistics',
    relatedSlugs: ['comparative-linguistics'],
  },
  {
    slug: 'language-universals',
    label: 'Language Universals',
    description:
      'Study of properties shared by all human languages, whether absolute or statistical.',
    wikidataId: 'Q632008',
    type: 'field',
    parentSlug: 'typology',
    relatedSlugs: ['generative-syntax'],
  },
  {
    slug: 'areal-linguistics',
    label: 'Areal Linguistics',
    description:
      'Study of linguistic features shared by languages in geographic proximity through contact.',
    wikidataId: 'Q660003',
    type: 'field',
    parentSlug: 'typology',
    relatedSlugs: ['sociolinguistics', 'historical-linguistics'],
  },
];

// =============================================================================
// NLP and AI Fields
// =============================================================================

const NLP_FIELDS: readonly FieldDefinition[] = [
  {
    slug: 'natural-language-processing',
    label: 'Natural Language Processing',
    description:
      'Subfield of AI and linguistics concerned with enabling computers to understand, interpret, and generate human language.',
    wikidataId: 'Q30642',
    type: 'group',
    parentSlug: 'computer-science',
    relatedSlugs: ['computational-linguistics', 'machine-learning'],
  },
  {
    slug: 'machine-translation',
    label: 'Machine Translation',
    description: 'Use of software to translate text or speech from one language to another.',
    wikidataId: 'Q206883',
    type: 'field',
    parentSlug: 'natural-language-processing',
    relatedSlugs: ['computational-linguistics'],
  },
  {
    slug: 'speech-recognition',
    label: 'Speech Recognition',
    description:
      'Interdisciplinary subfield enabling computers to recognize and translate spoken language into text.',
    wikidataId: 'Q206948',
    type: 'field',
    parentSlug: 'natural-language-processing',
    relatedSlugs: ['phonetics', 'acoustic-phonetics'],
  },
  {
    slug: 'speech-synthesis',
    label: 'Speech Synthesis',
    description:
      'Artificial production of human speech, converting text to natural-sounding speech.',
    wikidataId: 'Q185799',
    type: 'field',
    parentSlug: 'natural-language-processing',
    relatedSlugs: ['phonetics'],
  },
  {
    slug: 'information-extraction',
    label: 'Information Extraction',
    description: 'Task of automatically extracting structured information from unstructured text.',
    wikidataId: 'Q854442',
    type: 'field',
    parentSlug: 'natural-language-processing',
  },
  {
    slug: 'sentiment-analysis',
    label: 'Sentiment Analysis',
    description:
      'Use of NLP to identify and extract subjective information such as opinions and attitudes from text.',
    wikidataId: 'Q2386426',
    type: 'field',
    parentSlug: 'natural-language-processing',
  },
  {
    slug: 'question-answering',
    label: 'Question Answering',
    description:
      'Field of information retrieval and NLP focused on automatically answering questions posed in natural language.',
    wikidataId: 'Q1476063',
    type: 'field',
    parentSlug: 'natural-language-processing',
  },
  {
    slug: 'text-summarization',
    label: 'Text Summarization',
    description:
      'Process of producing concise summaries while preserving key information from source documents.',
    wikidataId: 'Q1318310',
    type: 'field',
    parentSlug: 'natural-language-processing',
  },
];

const ML_FIELDS: readonly FieldDefinition[] = [
  {
    slug: 'machine-learning',
    label: 'Machine Learning',
    description:
      'Field of AI that gives computers the ability to learn without being explicitly programmed.',
    wikidataId: 'Q2539',
    type: 'group',
    parentSlug: 'computer-science',
    relatedSlugs: ['natural-language-processing', 'artificial-intelligence'],
  },
  {
    slug: 'deep-learning',
    label: 'Deep Learning',
    description:
      'Machine learning methods based on artificial neural networks with multiple layers.',
    wikidataId: 'Q197536',
    type: 'field',
    parentSlug: 'machine-learning',
    relatedSlugs: ['natural-language-processing'],
  },
  {
    slug: 'artificial-intelligence',
    label: 'Artificial Intelligence',
    description:
      'Field of computer science dedicated to creating systems capable of performing tasks that typically require human intelligence.',
    wikidataId: 'Q11660',
    type: 'group',
    parentSlug: 'computer-science',
    relatedSlugs: ['machine-learning', 'cognitive-science'],
  },
];

// =============================================================================
// Additional Fields (Comprehensive Coverage)
// =============================================================================

const AGRICULTURAL_FIELDS: readonly FieldDefinition[] = [
  {
    slug: 'crop-science',
    label: 'Crop Science',
    description:
      'Study of the breeding, cultivation, and management of crops for food, fiber, and fuel production.',
    wikidataId: 'Q1354552',
    anzsrcCode: '3004',
    type: 'division',
    parentSlug: 'agricultural-veterinary',
  },
  {
    slug: 'animal-science',
    label: 'Animal Science',
    description:
      'Study of the biology and management of domestic animals, including nutrition, reproduction, and genetics.',
    wikidataId: 'Q207370',
    anzsrcCode: '3003',
    type: 'division',
    parentSlug: 'agricultural-veterinary',
  },
  {
    slug: 'veterinary-medicine',
    label: 'Veterinary Medicine',
    description:
      'Branch of medicine dealing with the prevention, diagnosis, and treatment of disease in animals.',
    wikidataId: 'Q170201',
    anzsrcCode: '3009',
    type: 'division',
    parentSlug: 'agricultural-veterinary',
  },
  {
    slug: 'food-science',
    label: 'Food Science',
    description:
      'Study of the physical, biological, and chemical makeup of food and the concepts underlying food processing.',
    wikidataId: 'Q1207505',
    anzsrcCode: '3006',
    type: 'division',
    parentSlug: 'agricultural-veterinary',
    relatedSlugs: ['chemistry', 'biological-sciences'],
  },
];

const MEDICAL_FIELDS: readonly FieldDefinition[] = [
  {
    slug: 'pharmacy',
    label: 'Pharmacy',
    description:
      'Science and technique of preparing, dispensing, and reviewing drugs and providing clinical services.',
    wikidataId: 'Q128709',
    anzsrcCode: '3211',
    type: 'division',
    parentSlug: 'medical-health-sciences',
  },
  {
    slug: 'epidemiology',
    label: 'Epidemiology',
    description:
      'Study and analysis of the distribution, patterns and determinants of health and disease conditions in populations.',
    wikidataId: 'Q133805',
    anzsrcCode: '4202',
    type: 'division',
    parentSlug: 'medical-health-sciences',
    relatedSlugs: ['public-health'],
  },
  {
    slug: 'immunology',
    label: 'Immunology',
    description:
      'Branch of biology and medicine covering the study of immune systems in all organisms.',
    wikidataId: 'Q101929',
    anzsrcCode: '3204',
    type: 'division',
    parentSlug: 'medical-health-sciences',
    relatedSlugs: ['biological-sciences'],
  },
  {
    slug: 'nursing',
    label: 'Nursing',
    description:
      'Profession focused on the care of individuals, families, and communities to attain, maintain, or recover optimal health.',
    wikidataId: 'Q186361',
    anzsrcCode: '4201',
    type: 'division',
    parentSlug: 'medical-health-sciences',
  },
  {
    slug: 'psychiatry',
    label: 'Psychiatry',
    description:
      'Medical specialty devoted to the diagnosis, prevention, and treatment of mental disorders.',
    wikidataId: 'Q7867',
    anzsrcCode: '3206',
    type: 'group',
    parentSlug: 'clinical-medicine',
    relatedSlugs: ['psychology', 'neuroscience'],
  },
];

const CS_FIELDS: readonly FieldDefinition[] = [
  {
    slug: 'data-science',
    label: 'Data Science',
    description:
      'Interdisciplinary field using scientific methods, processes, algorithms to extract knowledge from data.',
    wikidataId: 'Q2374463',
    type: 'division',
    parentSlug: 'computer-science',
    relatedSlugs: ['machine-learning', 'mathematics'],
  },
  {
    slug: 'cybersecurity',
    label: 'Cybersecurity',
    description: 'Practice of protecting systems, networks, and programs from digital attacks.',
    wikidataId: 'Q3510521',
    type: 'division',
    parentSlug: 'computer-science',
  },
  {
    slug: 'software-engineering',
    label: 'Software Engineering',
    description: 'Systematic approach to the development, operation, and maintenance of software.',
    wikidataId: 'Q80993',
    anzsrcCode: '4612',
    type: 'division',
    parentSlug: 'computer-science',
  },
  {
    slug: 'human-computer-interaction',
    label: 'Human-Computer Interaction',
    description:
      'Study of the design and use of computer technology focused on interfaces between people and computers.',
    wikidataId: 'Q628523',
    anzsrcCode: '4608',
    type: 'division',
    parentSlug: 'computer-science',
    relatedSlugs: ['psychology', 'cognitive-science'],
  },
  {
    slug: 'computer-vision',
    label: 'Computer Vision',
    description:
      'Field of AI that trains computers to interpret and understand visual information.',
    wikidataId: 'Q162555',
    type: 'group',
    parentSlug: 'artificial-intelligence',
    relatedSlugs: ['deep-learning'],
  },
  {
    slug: 'robotics',
    label: 'Robotics',
    description:
      'Branch of engineering and science involving design, construction, operation, and use of robots.',
    wikidataId: 'Q170978',
    type: 'group',
    parentSlug: 'artificial-intelligence',
  },
];

const HUMANITIES_FIELDS: readonly FieldDefinition[] = [
  {
    slug: 'music',
    label: 'Music',
    description: 'Art form and cultural activity involving organized sound and silence.',
    wikidataId: 'Q638',
    anzsrcCode: '3603',
    type: 'division',
    parentSlug: 'humanities-arts',
  },
  {
    slug: 'archaeology',
    label: 'Archaeology',
    description: 'Study of human activity through the recovery and analysis of material culture.',
    wikidataId: 'Q23498',
    anzsrcCode: '4301',
    type: 'division',
    parentSlug: 'humanities-arts',
    relatedSlugs: ['anthropology', 'history'],
  },
  {
    slug: 'art-history',
    label: 'Art History',
    description: 'Study of visual arts in historical and stylistic context.',
    wikidataId: 'Q50637',
    anzsrcCode: '3601',
    type: 'division',
    parentSlug: 'humanities-arts',
    relatedSlugs: ['arts'],
  },
  {
    slug: 'ethics',
    label: 'Ethics',
    description:
      'Branch of philosophy concerning systematizing, defending, and recommending concepts of right and wrong.',
    wikidataId: 'Q9465',
    anzsrcCode: '5001',
    type: 'group',
    parentSlug: 'philosophy',
  },
  {
    slug: 'logic',
    label: 'Logic',
    description: 'Study of correct reasoning, including both formal and informal logic.',
    wikidataId: 'Q8078',
    anzsrcCode: '5001',
    type: 'group',
    parentSlug: 'philosophy',
    relatedSlugs: ['mathematics'],
  },
];

const NATURAL_SCIENCE_FIELDS: readonly FieldDefinition[] = [
  {
    slug: 'astronomy',
    label: 'Astronomy',
    description: 'Natural science that studies celestial objects and phenomena.',
    wikidataId: 'Q333',
    anzsrcCode: '5101',
    type: 'division',
    parentSlug: 'natural-sciences',
    relatedSlugs: ['physics'],
  },
  {
    slug: 'ecology',
    label: 'Ecology',
    description:
      'Branch of biology concerning the relationships between organisms and their environments.',
    wikidataId: 'Q7150',
    anzsrcCode: '3103',
    type: 'division',
    parentSlug: 'natural-sciences',
    relatedSlugs: ['biological-sciences'],
  },
  {
    slug: 'genetics',
    label: 'Genetics',
    description:
      'Branch of biology concerned with the study of genes, genetic variation, and heredity.',
    wikidataId: 'Q7162',
    anzsrcCode: '3105',
    type: 'division',
    parentSlug: 'biological-sciences',
  },
  {
    slug: 'biochemistry',
    label: 'Biochemistry',
    description:
      'Branch of science exploring chemical processes within and relating to living organisms.',
    wikidataId: 'Q7094',
    anzsrcCode: '3101',
    type: 'division',
    parentSlug: 'biological-sciences',
    relatedSlugs: ['chemistry'],
  },
  {
    slug: 'microbiology',
    label: 'Microbiology',
    description:
      'Study of microorganisms, including bacteria, archaea, viruses, fungi, and protozoa.',
    wikidataId: 'Q7193',
    anzsrcCode: '3107',
    type: 'division',
    parentSlug: 'biological-sciences',
  },
];

const SOCIAL_SCIENCE_FIELDS: readonly FieldDefinition[] = [
  {
    slug: 'geography',
    label: 'Geography',
    description: 'Study of places and the relationships between people and their environments.',
    wikidataId: 'Q1071',
    anzsrcCode: '4406',
    type: 'division',
    parentSlug: 'social-sciences',
    relatedSlugs: ['earth-sciences'],
  },
  {
    slug: 'criminology',
    label: 'Criminology',
    description: 'Study of crime, criminal behavior, and the criminal justice system.',
    wikidataId: 'Q83267',
    anzsrcCode: '4402',
    type: 'division',
    parentSlug: 'social-sciences',
    relatedSlugs: ['sociology', 'law'],
  },
  {
    slug: 'international-relations',
    label: 'International Relations',
    description: 'Study of interconnectedness of politics, economics and law on a global level.',
    wikidataId: 'Q166542',
    anzsrcCode: '4407',
    type: 'division',
    parentSlug: 'social-sciences',
    relatedSlugs: ['political-science'],
  },
  {
    slug: 'communication-studies',
    label: 'Communication Studies',
    description: 'Academic discipline dealing with processes of human communication.',
    wikidataId: 'Q134995',
    anzsrcCode: '4701',
    type: 'division',
    parentSlug: 'social-sciences',
    relatedSlugs: ['linguistics'],
  },
];

// =============================================================================
// Export All Fields
// =============================================================================

export const ALL_FIELDS: readonly FieldDefinition[] = [
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
  ...AGRICULTURAL_FIELDS,
  ...MEDICAL_FIELDS,
  ...CS_FIELDS,
  ...HUMANITIES_FIELDS,
  ...NATURAL_SCIENCE_FIELDS,
  ...SOCIAL_SCIENCE_FIELDS,
];

/**
 * All field slugs for linking to facets.
 */
export const FIELD_SLUGS: readonly string[] = ALL_FIELDS.map((f) => f.slug);
