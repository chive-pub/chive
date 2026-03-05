#!/usr/bin/env tsx

/**
 * Verifies all Wikidata Q-node associations in governance seed data.
 * Fetches entity labels from Wikidata API in batches of 50 with delays.
 */

// =============================================================================
// Mapping extraction - all Q-nodes from seed files
// =============================================================================

interface NodeMapping {
  label: string;
  wikidataId: string;
  source: string;
}

const mappings: NodeMapping[] = [
  // === LICENSES (seed-licenses.ts) ===
  { label: 'CC BY 4.0', wikidataId: 'Q20007257', source: 'seed-licenses.ts' },
  { label: 'CC BY-SA 4.0', wikidataId: 'Q18199165', source: 'seed-licenses.ts' },
  { label: 'CC BY-NC 4.0', wikidataId: 'Q34179348', source: 'seed-licenses.ts' },
  { label: 'CC BY-NC-SA 4.0', wikidataId: 'Q42553662', source: 'seed-licenses.ts' },
  { label: 'CC BY-ND 4.0', wikidataId: 'Q36795408', source: 'seed-licenses.ts' },
  { label: 'CC BY-NC-ND 4.0', wikidataId: 'Q24082749', source: 'seed-licenses.ts' },
  { label: 'CC0 1.0', wikidataId: 'Q6938433', source: 'seed-licenses.ts' },
  { label: 'MIT License', wikidataId: 'Q334661', source: 'seed-licenses.ts' },
  { label: 'Apache License 2.0', wikidataId: 'Q616526', source: 'seed-licenses.ts' },
  { label: 'GPL 3.0', wikidataId: 'Q10513445', source: 'seed-licenses.ts' },
  { label: 'BSD 3-Clause', wikidataId: 'Q18491847', source: 'seed-licenses.ts' },
  { label: 'CC BY 3.0', wikidataId: 'Q14947546', source: 'seed-licenses.ts' },
  { label: 'CC BY-SA 3.0', wikidataId: 'Q14946043', source: 'seed-licenses.ts' },
  { label: 'CC BY-NC 3.0', wikidataId: 'Q18810331', source: 'seed-licenses.ts' },
  { label: 'Public Domain', wikidataId: 'Q19652', source: 'seed-licenses.ts' },
  { label: 'The Unlicense', wikidataId: 'Q21659044', source: 'seed-licenses.ts' },
  { label: 'AGPL 3.0', wikidataId: 'Q27017232', source: 'seed-licenses.ts' },
  { label: 'LGPL 3.0', wikidataId: 'Q18534393', source: 'seed-licenses.ts' },
  { label: 'MPL 2.0', wikidataId: 'Q25428413', source: 'seed-licenses.ts' },
  { label: 'ISC License', wikidataId: 'Q386474', source: 'seed-licenses.ts' },
  { label: 'BSD 2-Clause', wikidataId: 'Q18517294', source: 'seed-licenses.ts' },
  { label: 'EUPL 1.2', wikidataId: 'Q1376919', source: 'seed-licenses.ts' },
  { label: 'ODbL', wikidataId: 'Q1224853', source: 'seed-licenses.ts' },

  // === PAPER TYPES (seed-paper-types.ts) ===
  { label: 'Original Research', wikidataId: 'Q13442814', source: 'seed-paper-types.ts' },
  { label: 'Review Article', wikidataId: 'Q7318358', source: 'seed-paper-types.ts' },
  { label: 'Systematic Review', wikidataId: 'Q1504425', source: 'seed-paper-types.ts' },
  { label: 'Meta-Analysis', wikidataId: 'Q815382', source: 'seed-paper-types.ts' },
  { label: 'Case Study', wikidataId: 'Q155207', source: 'seed-paper-types.ts' },
  { label: 'Letter/Brief Communication', wikidataId: 'Q591041', source: 'seed-paper-types.ts' },
  { label: 'Conference Paper', wikidataId: 'Q23927052', source: 'seed-paper-types.ts' },
  { label: 'Thesis/Dissertation', wikidataId: 'Q1266946', source: 'seed-paper-types.ts' },
  { label: 'Technical Report', wikidataId: 'Q3099732', source: 'seed-paper-types.ts' },

  // === GEOGRAPHIC REGIONS (seed-geographic-regions.ts) ===
  { label: 'Global', wikidataId: 'Q2', source: 'seed-geographic-regions.ts' },
  { label: 'Africa', wikidataId: 'Q15', source: 'seed-geographic-regions.ts' },
  { label: 'Asia', wikidataId: 'Q48', source: 'seed-geographic-regions.ts' },
  { label: 'Europe', wikidataId: 'Q46', source: 'seed-geographic-regions.ts' },
  { label: 'North America', wikidataId: 'Q49', source: 'seed-geographic-regions.ts' },
  { label: 'South America', wikidataId: 'Q18', source: 'seed-geographic-regions.ts' },
  { label: 'Oceania', wikidataId: 'Q55643', source: 'seed-geographic-regions.ts' },
  { label: 'Antarctica', wikidataId: 'Q51', source: 'seed-geographic-regions.ts' },
  { label: 'Middle East', wikidataId: 'Q7204', source: 'seed-geographic-regions.ts' },
  { label: 'Southeast Asia', wikidataId: 'Q11708', source: 'seed-geographic-regions.ts' },
  { label: 'East Asia', wikidataId: 'Q27231', source: 'seed-geographic-regions.ts' },
  { label: 'South Asia', wikidataId: 'Q771405', source: 'seed-geographic-regions.ts' },
  { label: 'Central Asia', wikidataId: 'Q27275', source: 'seed-geographic-regions.ts' },
  { label: 'Western Europe', wikidataId: 'Q27496', source: 'seed-geographic-regions.ts' },
  { label: 'Eastern Europe', wikidataId: 'Q27468', source: 'seed-geographic-regions.ts' },
  { label: 'Sub-Saharan Africa', wikidataId: 'Q132959', source: 'seed-geographic-regions.ts' },
  { label: 'Latin America', wikidataId: 'Q12585', source: 'seed-geographic-regions.ts' },
  { label: 'Caribbean', wikidataId: 'Q664609', source: 'seed-geographic-regions.ts' },
  { label: 'Arctic', wikidataId: 'Q25322', source: 'seed-geographic-regions.ts' },
  { label: 'Pacific Region', wikidataId: 'Q3359409', source: 'seed-geographic-regions.ts' },

  // === TIME PERIODS (seed-time-periods.ts) ===
  { label: '19th Century', wikidataId: 'Q6955', source: 'seed-time-periods.ts' },
  { label: '20th Century', wikidataId: 'Q6927', source: 'seed-time-periods.ts' },
  { label: '21st Century', wikidataId: 'Q6939', source: 'seed-time-periods.ts' },
  { label: 'Pre-Industrial Era', wikidataId: 'Q3772521', source: 'seed-time-periods.ts' },
  { label: 'Industrial Revolution', wikidataId: 'Q2269', source: 'seed-time-periods.ts' },
  { label: 'Interwar Period', wikidataId: 'Q154611', source: 'seed-time-periods.ts' },
  { label: 'Cold War Era', wikidataId: 'Q8683', source: 'seed-time-periods.ts' },
  { label: 'Post-Cold War', wikidataId: 'Q17152871', source: 'seed-time-periods.ts' },
  { label: 'Digital Age', wikidataId: 'Q956129', source: 'seed-time-periods.ts' },
  { label: 'COVID-19 Era', wikidataId: 'Q81068910', source: 'seed-time-periods.ts' },
  { label: 'Ancient', wikidataId: 'Q486761', source: 'seed-time-periods.ts' },

  // === METHODOLOGIES (seed-methodologies.ts) ===
  { label: 'Qualitative Research', wikidataId: 'Q839486', source: 'seed-methodologies.ts' },
  { label: 'Quantitative Research', wikidataId: 'Q730675', source: 'seed-methodologies.ts' },
  { label: 'Case Study (methodology)', wikidataId: 'Q155207', source: 'seed-methodologies.ts' },
  {
    label: 'Systematic Review (methodology)',
    wikidataId: 'Q1504425',
    source: 'seed-methodologies.ts',
  },
  { label: 'Meta-Analysis (methodology)', wikidataId: 'Q815382', source: 'seed-methodologies.ts' },
  { label: 'Randomized Controlled Trial', wikidataId: 'Q1436668', source: 'seed-methodologies.ts' },
  { label: 'Longitudinal Study', wikidataId: 'Q1758614', source: 'seed-methodologies.ts' },
  { label: 'Cross-Sectional Study', wikidataId: 'Q954027', source: 'seed-methodologies.ts' },
  { label: 'Ethnography', wikidataId: 'Q132151', source: 'seed-methodologies.ts' },
  { label: 'Grounded Theory', wikidataId: 'Q1152864', source: 'seed-methodologies.ts' },
  { label: 'Discourse Analysis', wikidataId: 'Q1129466', source: 'seed-methodologies.ts' },
  { label: 'Statistical Analysis', wikidataId: 'Q12483', source: 'seed-methodologies.ts' },
  { label: 'Machine Learning (methodology)', wikidataId: 'Q2539', source: 'seed-methodologies.ts' },
  { label: 'Computer Simulation', wikidataId: 'Q925667', source: 'seed-methodologies.ts' },
  { label: 'Archival Research', wikidataId: 'Q4787243', source: 'seed-methodologies.ts' },

  // === FIELDS - Domains (lib/fields.ts) ===
  { label: 'Natural Sciences', wikidataId: 'Q7991', source: 'lib/fields.ts' },
  { label: 'Engineering and Technology', wikidataId: 'Q11023', source: 'lib/fields.ts' },
  { label: 'Medical and Health Sciences', wikidataId: 'Q11190', source: 'lib/fields.ts' },
  { label: 'Agricultural and Veterinary Sciences', wikidataId: 'Q11451', source: 'lib/fields.ts' },
  { label: 'Social Sciences', wikidataId: 'Q34749', source: 'lib/fields.ts' },
  { label: 'Humanities and Arts', wikidataId: 'Q80083', source: 'lib/fields.ts' },

  // === FIELDS - Core Divisions ===
  { label: 'Mathematics', wikidataId: 'Q395', source: 'lib/fields.ts' },
  { label: 'Physics', wikidataId: 'Q413', source: 'lib/fields.ts' },
  { label: 'Chemistry', wikidataId: 'Q2329', source: 'lib/fields.ts' },
  { label: 'Earth Sciences', wikidataId: 'Q8008', source: 'lib/fields.ts' },
  { label: 'Biological Sciences', wikidataId: 'Q420', source: 'lib/fields.ts' },
  { label: 'Computer Science', wikidataId: 'Q21198', source: 'lib/fields.ts' },
  { label: 'Electrical Engineering', wikidataId: 'Q43035', source: 'lib/fields.ts' },
  { label: 'Mechanical Engineering', wikidataId: 'Q101333', source: 'lib/fields.ts' },
  { label: 'Civil Engineering', wikidataId: 'Q77590', source: 'lib/fields.ts' },
  { label: 'Materials Science', wikidataId: 'Q228736', source: 'lib/fields.ts' },
  { label: 'Clinical Medicine', wikidataId: 'Q7114438', source: 'lib/fields.ts' },
  { label: 'Neuroscience', wikidataId: 'Q7141', source: 'lib/fields.ts' },
  { label: 'Public Health', wikidataId: 'Q189603', source: 'lib/fields.ts' },
  { label: 'Psychology', wikidataId: 'Q9418', source: 'lib/fields.ts' },
  { label: 'Economics', wikidataId: 'Q8134', source: 'lib/fields.ts' },
  { label: 'Sociology', wikidataId: 'Q21201', source: 'lib/fields.ts' },
  { label: 'Political Science', wikidataId: 'Q36442', source: 'lib/fields.ts' },
  { label: 'Anthropology', wikidataId: 'Q23404', source: 'lib/fields.ts' },
  { label: 'Education', wikidataId: 'Q8434', source: 'lib/fields.ts' },
  { label: 'Law', wikidataId: 'Q7748', source: 'lib/fields.ts' },
  { label: 'Philosophy', wikidataId: 'Q5891', source: 'lib/fields.ts' },
  { label: 'History', wikidataId: 'Q309', source: 'lib/fields.ts' },
  { label: 'Linguistics', wikidataId: 'Q8162', source: 'lib/fields.ts' },
  { label: 'Literary Studies', wikidataId: 'Q8242', source: 'lib/fields.ts' },
  { label: 'Religious Studies', wikidataId: 'Q9174', source: 'lib/fields.ts' },
  { label: 'Arts', wikidataId: 'Q735', source: 'lib/fields.ts' },
  { label: 'Cognitive Science', wikidataId: 'Q147638', source: 'lib/fields.ts' },

  // === FIELDS - Linguistics Core ===
  { label: 'Phonetics', wikidataId: 'Q40998', source: 'lib/fields.ts' },
  { label: 'Phonology', wikidataId: 'Q40803', source: 'lib/fields.ts' },
  { label: 'Morphology', wikidataId: 'Q131261', source: 'lib/fields.ts' },
  { label: 'Syntax', wikidataId: 'Q37437', source: 'lib/fields.ts' },
  { label: 'Semantics', wikidataId: 'Q39645', source: 'lib/fields.ts' },
  { label: 'Pragmatics', wikidataId: 'Q192985', source: 'lib/fields.ts' },

  // === FIELDS - Linguistics Interdisciplinary ===
  { label: 'Psycholinguistics', wikidataId: 'Q185043', source: 'lib/fields.ts' },
  { label: 'Neurolinguistics', wikidataId: 'Q583405', source: 'lib/fields.ts' },
  { label: 'Sociolinguistics', wikidataId: 'Q40634', source: 'lib/fields.ts' },
  { label: 'Computational Linguistics', wikidataId: 'Q182557', source: 'lib/fields.ts' },
  { label: 'Anthropological Linguistics', wikidataId: 'Q1194352', source: 'lib/fields.ts' },
  { label: 'Applied Linguistics', wikidataId: 'Q2668830', source: 'lib/fields.ts' },
  { label: 'Philosophy of Language', wikidataId: 'Q179805', source: 'lib/fields.ts' },

  // === FIELDS - Linguistics Historical ===
  { label: 'Historical Linguistics', wikidataId: 'Q47157', source: 'lib/fields.ts' },
  { label: 'Comparative Linguistics', wikidataId: 'Q191314', source: 'lib/fields.ts' },
  { label: 'Etymology', wikidataId: 'Q41583', source: 'lib/fields.ts' },
  { label: 'Language Reconstruction', wikidataId: 'Q1195896', source: 'lib/fields.ts' },

  // === FIELDS - Semantics Subfields ===
  { label: 'Lexical Semantics', wikidataId: 'Q1820446', source: 'lib/fields.ts' },
  { label: 'Formal Semantics', wikidataId: 'Q1353507', source: 'lib/fields.ts' },
  { label: 'Cognitive Semantics', wikidataId: 'Q5141302', source: 'lib/fields.ts' },
  { label: 'Compositional Semantics', wikidataId: 'Q1124634', source: 'lib/fields.ts' },

  // === FIELDS - Syntax Subfields ===
  { label: 'Generative Syntax', wikidataId: 'Q733103', source: 'lib/fields.ts' },
  { label: 'Minimalist Program', wikidataId: 'Q1928048', source: 'lib/fields.ts' },
  { label: 'Construction Grammar', wikidataId: 'Q1140308', source: 'lib/fields.ts' },
  { label: 'Dependency Grammar', wikidataId: 'Q1199653', source: 'lib/fields.ts' },
  { label: 'Categorial Grammar', wikidataId: 'Q868898', source: 'lib/fields.ts' },
  { label: 'Head-Driven Phrase Structure Grammar', wikidataId: 'Q620419', source: 'lib/fields.ts' },
  { label: 'Lexical Functional Grammar', wikidataId: 'Q1142628', source: 'lib/fields.ts' },

  // === FIELDS - Phonology Subfields ===
  { label: 'Autosegmental Phonology', wikidataId: 'Q4824936', source: 'lib/fields.ts' },
  { label: 'Optimality Theory', wikidataId: 'Q1140284', source: 'lib/fields.ts' },
  { label: 'Metrical Phonology', wikidataId: 'Q2583934', source: 'lib/fields.ts' },
  { label: 'Prosody', wikidataId: 'Q1074290', source: 'lib/fields.ts' },
  { label: 'Laboratory Phonology', wikidataId: 'Q6464102', source: 'lib/fields.ts' },

  // === FIELDS - Phonetics Subfields ===
  { label: 'Articulatory Phonetics', wikidataId: 'Q379895', source: 'lib/fields.ts' },
  { label: 'Acoustic Phonetics', wikidataId: 'Q421992', source: 'lib/fields.ts' },
  { label: 'Auditory Phonetics', wikidataId: 'Q478665', source: 'lib/fields.ts' },

  // === FIELDS - Language Acquisition ===
  { label: 'Language Acquisition', wikidataId: 'Q208041', source: 'lib/fields.ts' },
  { label: 'First Language Acquisition', wikidataId: 'Q1411686', source: 'lib/fields.ts' },
  { label: 'Second Language Acquisition', wikidataId: 'Q187742', source: 'lib/fields.ts' },
  { label: 'Bilingualism', wikidataId: 'Q105092', source: 'lib/fields.ts' },

  // === FIELDS - Discourse Linguistics ===
  { label: 'Discourse Analysis', wikidataId: 'Q595094', source: 'lib/fields.ts' },
  { label: 'Conversation Analysis', wikidataId: 'Q1197866', source: 'lib/fields.ts' },
  { label: 'Corpus Linguistics', wikidataId: 'Q1137027', source: 'lib/fields.ts' },

  // === FIELDS - Typology ===
  { label: 'Linguistic Typology', wikidataId: 'Q174159', source: 'lib/fields.ts' },
  { label: 'Language Universals', wikidataId: 'Q632008', source: 'lib/fields.ts' },
  { label: 'Areal Linguistics', wikidataId: 'Q660003', source: 'lib/fields.ts' },

  // === FIELDS - NLP ===
  { label: 'Natural Language Processing', wikidataId: 'Q30642', source: 'lib/fields.ts' },
  { label: 'Machine Translation', wikidataId: 'Q206883', source: 'lib/fields.ts' },
  { label: 'Speech Recognition', wikidataId: 'Q206948', source: 'lib/fields.ts' },
  { label: 'Speech Synthesis', wikidataId: 'Q185799', source: 'lib/fields.ts' },
  { label: 'Information Extraction', wikidataId: 'Q854442', source: 'lib/fields.ts' },
  { label: 'Sentiment Analysis', wikidataId: 'Q2386426', source: 'lib/fields.ts' },
  { label: 'Question Answering', wikidataId: 'Q1476063', source: 'lib/fields.ts' },
  { label: 'Text Summarization', wikidataId: 'Q1318310', source: 'lib/fields.ts' },

  // === FIELDS - ML ===
  { label: 'Machine Learning', wikidataId: 'Q2539', source: 'lib/fields.ts' },
  { label: 'Deep Learning', wikidataId: 'Q197536', source: 'lib/fields.ts' },
  { label: 'Artificial Intelligence', wikidataId: 'Q11660', source: 'lib/fields.ts' },

  // === FIELDS - Agricultural ===
  { label: 'Crop Science', wikidataId: 'Q1354552', source: 'lib/fields.ts' },
  { label: 'Animal Science', wikidataId: 'Q207370', source: 'lib/fields.ts' },
  { label: 'Veterinary Medicine', wikidataId: 'Q170201', source: 'lib/fields.ts' },
  { label: 'Food Science', wikidataId: 'Q1207505', source: 'lib/fields.ts' },

  // === FIELDS - Medical ===
  { label: 'Pharmacy', wikidataId: 'Q128709', source: 'lib/fields.ts' },
  { label: 'Epidemiology', wikidataId: 'Q133805', source: 'lib/fields.ts' },
  { label: 'Immunology', wikidataId: 'Q101929', source: 'lib/fields.ts' },
  { label: 'Nursing', wikidataId: 'Q186361', source: 'lib/fields.ts' },
  { label: 'Psychiatry', wikidataId: 'Q7867', source: 'lib/fields.ts' },

  // === FIELDS - Computer Science ===
  { label: 'Data Science', wikidataId: 'Q2374463', source: 'lib/fields.ts' },
  { label: 'Cybersecurity', wikidataId: 'Q3510521', source: 'lib/fields.ts' },
  { label: 'Software Engineering', wikidataId: 'Q80993', source: 'lib/fields.ts' },
  { label: 'Human-Computer Interaction', wikidataId: 'Q628523', source: 'lib/fields.ts' },
  { label: 'Computer Vision', wikidataId: 'Q162555', source: 'lib/fields.ts' },
  { label: 'Robotics', wikidataId: 'Q170978', source: 'lib/fields.ts' },

  // === FIELDS - Humanities ===
  { label: 'Music', wikidataId: 'Q638', source: 'lib/fields.ts' },
  { label: 'Archaeology', wikidataId: 'Q23498', source: 'lib/fields.ts' },
  { label: 'Art History', wikidataId: 'Q50637', source: 'lib/fields.ts' },
  { label: 'Ethics', wikidataId: 'Q9465', source: 'lib/fields.ts' },
  { label: 'Logic', wikidataId: 'Q8078', source: 'lib/fields.ts' },

  // === FIELDS - Natural Sciences ===
  { label: 'Astronomy', wikidataId: 'Q333', source: 'lib/fields.ts' },
  { label: 'Ecology', wikidataId: 'Q7150', source: 'lib/fields.ts' },
  { label: 'Genetics', wikidataId: 'Q7162', source: 'lib/fields.ts' },
  { label: 'Biochemistry', wikidataId: 'Q7094', source: 'lib/fields.ts' },
  { label: 'Microbiology', wikidataId: 'Q7193', source: 'lib/fields.ts' },

  // === FIELDS - Social Sciences ===
  { label: 'Geography', wikidataId: 'Q1071', source: 'lib/fields.ts' },
  { label: 'Criminology', wikidataId: 'Q83267', source: 'lib/fields.ts' },
  { label: 'International Relations', wikidataId: 'Q166542', source: 'lib/fields.ts' },
  { label: 'Communication Studies', wikidataId: 'Q134995', source: 'lib/fields.ts' },

  // === CONCEPTS - Document Formats (lib/concepts.ts) ===
  { label: 'PDF', wikidataId: 'Q42332', source: 'lib/concepts.ts' },
  { label: 'LaTeX', wikidataId: 'Q5310', source: 'lib/concepts.ts' },
  { label: 'Jupyter Notebook', wikidataId: 'Q55630549', source: 'lib/concepts.ts' },
  { label: 'HTML', wikidataId: 'Q8811', source: 'lib/concepts.ts' },
  { label: 'Markdown', wikidataId: 'Q1193600', source: 'lib/concepts.ts' },
  { label: 'EPUB', wikidataId: 'Q475488', source: 'lib/concepts.ts' },

  // === CONCEPTS - Publication Statuses ===
  { label: 'Eprint', wikidataId: 'Q580922', source: 'lib/concepts.ts' },
  { label: 'Preprint', wikidataId: 'Q580922', source: 'lib/concepts.ts' },
  { label: 'Retracted', wikidataId: 'Q45182324', source: 'lib/concepts.ts' },

  // === CONCEPTS - Access Types ===
  { label: 'Open Access', wikidataId: 'Q232932', source: 'lib/concepts.ts' },
  { label: 'Gold Open Access', wikidataId: 'Q30893612', source: 'lib/concepts.ts' },
  { label: 'Green Open Access', wikidataId: 'Q30893656', source: 'lib/concepts.ts' },
  { label: 'Hybrid Open Access', wikidataId: 'Q30893609', source: 'lib/concepts.ts' },
  { label: 'Bronze Open Access', wikidataId: 'Q63065597', source: 'lib/concepts.ts' },
  { label: 'Closed Access', wikidataId: 'Q116847925', source: 'lib/concepts.ts' },

  // === CONCEPTS - Code Platforms ===
  { label: 'GitHub', wikidataId: 'Q364', source: 'lib/concepts.ts' },
  { label: 'GitLab', wikidataId: 'Q16639197', source: 'lib/concepts.ts' },
  { label: 'Bitbucket', wikidataId: 'Q2493781', source: 'lib/concepts.ts' },
  { label: 'Codeberg', wikidataId: 'Q79145161', source: 'lib/concepts.ts' },
  { label: 'SourceHut', wikidataId: 'Q65093956', source: 'lib/concepts.ts' },
  { label: 'Software Heritage', wikidataId: 'Q23791193', source: 'lib/concepts.ts' },
  { label: 'Hugging Face', wikidataId: 'Q108943604', source: 'lib/concepts.ts' },
  { label: 'Kaggle', wikidataId: 'Q21652686', source: 'lib/concepts.ts' },
  { label: 'Google Colab', wikidataId: 'Q56823884', source: 'lib/concepts.ts' },
  { label: 'Papers With Code', wikidataId: 'Q98968941', source: 'lib/concepts.ts' },

  // === CONCEPTS - Data Platforms ===
  { label: 'Zenodo', wikidataId: 'Q22661177', source: 'lib/concepts.ts' },
  { label: 'Figshare', wikidataId: 'Q22907194', source: 'lib/concepts.ts' },
  { label: 'Dryad', wikidataId: 'Q17078663', source: 'lib/concepts.ts' },
  { label: 'OSF', wikidataId: 'Q25713029', source: 'lib/concepts.ts' },
  { label: 'Dataverse', wikidataId: 'Q5227102', source: 'lib/concepts.ts' },
  { label: 'Mendeley Data', wikidataId: 'Q29032495', source: 'lib/concepts.ts' },
  { label: 'Hugging Face (data)', wikidataId: 'Q108943604', source: 'lib/concepts.ts' },
  { label: 'Kaggle (data)', wikidataId: 'Q21652686', source: 'lib/concepts.ts' },
  { label: 'Weights & Biases', wikidataId: 'Q107431107', source: 'lib/concepts.ts' },

  // === CONCEPTS - Preprint Platforms ===
  { label: 'arXiv', wikidataId: 'Q118398', source: 'lib/concepts.ts' },
  { label: 'bioRxiv', wikidataId: 'Q19835482', source: 'lib/concepts.ts' },
  { label: 'medRxiv', wikidataId: 'Q66640488', source: 'lib/concepts.ts' },
  { label: 'SSRN', wikidataId: 'Q7550801', source: 'lib/concepts.ts' },
  { label: 'OSF Preprints', wikidataId: 'Q25713029', source: 'lib/concepts.ts' },
  { label: 'EarthArXiv', wikidataId: 'Q56478267', source: 'lib/concepts.ts' },
  { label: 'PsyArXiv', wikidataId: 'Q56478251', source: 'lib/concepts.ts' },
  { label: 'SocArXiv', wikidataId: 'Q56478238', source: 'lib/concepts.ts' },

  // === CONCEPTS - Preregistration Platforms ===
  { label: 'OSF Registrations', wikidataId: 'Q25713029', source: 'lib/concepts.ts' },
  { label: 'ClinicalTrials.gov', wikidataId: 'Q5133746', source: 'lib/concepts.ts' },
  { label: 'PROSPERO', wikidataId: 'Q28133417', source: 'lib/concepts.ts' },
  { label: 'ANZCTR', wikidataId: 'Q4777251', source: 'lib/concepts.ts' },

  // === CONCEPTS - Protocol Platforms ===
  { label: 'protocols.io', wikidataId: 'Q56256113', source: 'lib/concepts.ts' },
  { label: 'Bio-protocol', wikidataId: 'Q60267627', source: 'lib/concepts.ts' },
  { label: 'Nature Protocols', wikidataId: 'Q2015821', source: 'lib/concepts.ts' },

  // === CONCEPTS - Supplementary Types ===
  { label: 'Dataset', wikidataId: 'Q1172284', source: 'lib/concepts.ts' },
  { label: 'Source Code', wikidataId: 'Q80006', source: 'lib/concepts.ts' },
  { label: 'Video', wikidataId: 'Q34508', source: 'lib/concepts.ts' },
  { label: 'Figure', wikidataId: 'Q478798', source: 'lib/concepts.ts' },
  { label: 'Appendix', wikidataId: 'Q1376568', source: 'lib/concepts.ts' },
  { label: 'Computational Notebook', wikidataId: 'Q55630549', source: 'lib/concepts.ts' },
  { label: 'Protocol', wikidataId: 'Q2101564', source: 'lib/concepts.ts' },
  { label: 'Table', wikidataId: 'Q496946', source: 'lib/concepts.ts' },
  { label: 'Audio', wikidataId: 'Q106428747', source: 'lib/concepts.ts' },
  { label: 'Presentation', wikidataId: 'Q604733', source: 'lib/concepts.ts' },
  { label: 'Questionnaire', wikidataId: 'Q895992', source: 'lib/concepts.ts' },

  // === CONCEPTS - Institution Types ===
  { label: 'University', wikidataId: 'Q3918', source: 'lib/concepts.ts' },
  { label: 'Research Institute', wikidataId: 'Q31855', source: 'lib/concepts.ts' },
  { label: 'Laboratory', wikidataId: 'Q483242', source: 'lib/concepts.ts' },
  { label: 'Company', wikidataId: 'Q4830453', source: 'lib/concepts.ts' },
  { label: 'Hospital', wikidataId: 'Q16917', source: 'lib/concepts.ts' },
  { label: 'Government Agency', wikidataId: 'Q327333', source: 'lib/concepts.ts' },
  { label: 'Nonprofit Organization', wikidataId: 'Q163740', source: 'lib/concepts.ts' },
  { label: 'Funding Body', wikidataId: 'Q1714374', source: 'lib/concepts.ts' },
  { label: 'Publisher', wikidataId: 'Q2085381', source: 'lib/concepts.ts' },
  { label: 'Research Consortium', wikidataId: 'Q1325119', source: 'lib/concepts.ts' },

  // === CONCEPTS - Researcher Types ===
  { label: 'Faculty', wikidataId: 'Q1622272', source: 'lib/concepts.ts' },
  { label: 'Postdoctoral Researcher', wikidataId: 'Q188862', source: 'lib/concepts.ts' },
  { label: 'PhD Student', wikidataId: 'Q28695116', source: 'lib/concepts.ts' },
  { label: 'Independent Researcher', wikidataId: 'Q18576619', source: 'lib/concepts.ts' },
  { label: "Master's Student", wikidataId: 'Q28695119', source: 'lib/concepts.ts' },

  // === CONCEPTS - Identifier Types ===
  { label: 'DOI', wikidataId: 'Q25670', source: 'lib/concepts.ts' },
  { label: 'arXiv ID', wikidataId: 'Q118398', source: 'lib/concepts.ts' },
  { label: 'PMID', wikidataId: 'Q2140879', source: 'lib/concepts.ts' },
  { label: 'PMCID', wikidataId: 'Q21685851', source: 'lib/concepts.ts' },
  { label: 'ISBN', wikidataId: 'Q33057', source: 'lib/concepts.ts' },
  { label: 'ISSN', wikidataId: 'Q131276', source: 'lib/concepts.ts' },
  { label: 'ORCID', wikidataId: 'Q51044', source: 'lib/concepts.ts' },
  { label: 'ROR', wikidataId: 'Q64413744', source: 'lib/concepts.ts' },
  { label: 'Handle', wikidataId: 'Q3126718', source: 'lib/concepts.ts' },
  { label: 'URN', wikidataId: 'Q15606652', source: 'lib/concepts.ts' },

  // === CONCEPTS - Presentation Types ===
  { label: 'Oral Presentation', wikidataId: 'Q604733', source: 'lib/concepts.ts' },
  { label: 'Poster Presentation', wikidataId: 'Q429785', source: 'lib/concepts.ts' },
  { label: 'Keynote', wikidataId: 'Q960189', source: 'lib/concepts.ts' },
  { label: 'Workshop', wikidataId: 'Q16051166', source: 'lib/concepts.ts' },
  { label: 'Demo', wikidataId: 'Q4157632', source: 'lib/concepts.ts' },

  // === FACETS (lib/facets.ts) ===
  { label: 'Discipline (personality)', wikidataId: 'Q11862829', source: 'lib/facets.ts' },
  { label: 'Subject Matter (matter)', wikidataId: 'Q24724', source: 'lib/facets.ts' },
  { label: 'Research Methodology (energy)', wikidataId: 'Q1379672', source: 'lib/facets.ts' },
  { label: 'Geographic Focus (space)', wikidataId: 'Q82794', source: 'lib/facets.ts' },
  { label: 'Time Period (time)', wikidataId: 'Q11471', source: 'lib/facets.ts' },
];

// =============================================================================
// Wikidata API fetcher
// =============================================================================

interface WikidataEntity {
  id: string;
  labels?: {
    en?: { value: string };
  };
  descriptions?: {
    en?: { value: string };
  };
  missing?: string;
}

interface WikidataResponse {
  entities: Record<string, WikidataEntity>;
}

async function fetchWikidataBatch(ids: string[]): Promise<Map<string, WikidataEntity>> {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join('|')}&props=labels|descriptions&languages=en&format=json`;

  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'ChiveWikidataVerifier/1.0 (https://chive.pub; admin@chive.pub)',
    },
  });

  if (!resp.ok) {
    throw new Error(`Wikidata API error: ${resp.status} ${resp.statusText}`);
  }

  const data = (await resp.json()) as WikidataResponse;
  const result = new Map<string, WikidataEntity>();
  for (const [id, entity] of Object.entries(data.entities)) {
    result.set(id, entity);
  }
  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Comparison logic
// =============================================================================

interface VerificationResult {
  label: string;
  wikidataId: string;
  source: string;
  wikidataLabel: string | null;
  wikidataDescription: string | null;
  status: 'match' | 'mismatch' | 'missing' | 'error';
}

function normalizeForComparison(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isReasonableMatch(ourLabel: string, wikidataLabel: string): boolean {
  const ours = normalizeForComparison(ourLabel);
  const theirs = normalizeForComparison(wikidataLabel);

  // Exact match after normalization
  if (ours === theirs) return true;

  // One contains the other
  if (ours.includes(theirs) || theirs.includes(ours)) return true;

  // Check if significant words overlap (at least 50%)
  const ourWords = new Set(ours.split(' ').filter((w) => w.length > 2));
  const theirWords = new Set(theirs.split(' ').filter((w) => w.length > 2));
  if (ourWords.size === 0 || theirWords.size === 0) return false;

  let overlap = 0;
  for (const w of ourWords) {
    if (theirWords.has(w)) overlap++;
  }

  const overlapRatio = overlap / Math.min(ourWords.size, theirWords.size);
  return overlapRatio >= 0.5;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log('Wikidata Q-Node Verification Script');
  console.log('====================================\n');

  // Deduplicate Q-IDs for fetching
  const uniqueIds = [...new Set(mappings.map((m) => m.wikidataId))];
  console.log(`Total mappings: ${mappings.length}`);
  console.log(`Unique Wikidata IDs: ${uniqueIds.length}`);

  // Batch into groups of 50
  const batches: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += 50) {
    batches.push(uniqueIds.slice(i, i + 50));
  }
  console.log(`Batches needed: ${batches.length} (50 per batch)\n`);

  // Fetch all entities
  const allEntities = new Map<string, WikidataEntity>();
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]!;
    console.log(`Fetching batch ${i + 1}/${batches.length} (${batch.length} entities)...`);
    try {
      const entities = await fetchWikidataBatch(batch);
      for (const [id, entity] of entities) {
        allEntities.set(id, entity);
      }
    } catch (err) {
      console.error(`  ERROR fetching batch ${i + 1}:`, err);
    }

    // Wait 2 seconds between batches to avoid rate limiting
    if (i < batches.length - 1) {
      await sleep(2000);
    }
  }

  console.log(`\nFetched ${allEntities.size} entities from Wikidata.\n`);

  // Verify each mapping
  const results: VerificationResult[] = [];
  const mismatches: VerificationResult[] = [];
  const missing: VerificationResult[] = [];

  for (const mapping of mappings) {
    const entity = allEntities.get(mapping.wikidataId);
    const wikidataLabel = entity?.labels?.en?.value ?? null;
    const wikidataDescription = entity?.descriptions?.en?.value ?? null;

    if (!entity || entity.missing !== undefined) {
      const result: VerificationResult = {
        ...mapping,
        wikidataLabel: null,
        wikidataDescription: null,
        status: 'missing',
      };
      results.push(result);
      missing.push(result);
    } else if (!wikidataLabel) {
      const result: VerificationResult = {
        ...mapping,
        wikidataLabel: null,
        wikidataDescription,
        status: 'missing',
      };
      results.push(result);
      missing.push(result);
    } else if (isReasonableMatch(mapping.label, wikidataLabel)) {
      results.push({
        ...mapping,
        wikidataLabel,
        wikidataDescription,
        status: 'match',
      });
    } else {
      const result: VerificationResult = {
        ...mapping,
        wikidataLabel,
        wikidataDescription,
        status: 'mismatch',
      };
      results.push(result);
      mismatches.push(result);
    }
  }

  // Report
  const matches = results.filter((r) => r.status === 'match');

  console.log('====================================');
  console.log('RESULTS SUMMARY');
  console.log('====================================');
  console.log(`Matches:    ${matches.length}`);
  console.log(`Mismatches: ${mismatches.length}`);
  console.log(`Missing:    ${missing.length}`);
  console.log(`Total:      ${results.length}`);
  console.log();

  if (mismatches.length > 0) {
    console.log('====================================');
    console.log('MISMATCHES (Our Label vs Wikidata Label)');
    console.log('====================================\n');

    for (const m of mismatches) {
      console.log(`  ${m.wikidataId} | Source: ${m.source}`);
      console.log(`    Ours:     "${m.label}"`);
      console.log(`    Wikidata: "${m.wikidataLabel}"`);
      if (m.wikidataDescription) {
        console.log(`    Desc:     "${m.wikidataDescription}"`);
      }
      console.log();
    }
  }

  if (missing.length > 0) {
    console.log('====================================');
    console.log('MISSING (Entity not found on Wikidata)');
    console.log('====================================\n');

    for (const m of missing) {
      console.log(`  ${m.wikidataId} | "${m.label}" | Source: ${m.source}`);
    }
    console.log();
  }

  if (matches.length > 0) {
    console.log('====================================');
    console.log('MATCHES (verified correct)');
    console.log('====================================\n');

    for (const m of matches) {
      const note =
        normalizeForComparison(m.label) !== normalizeForComparison(m.wikidataLabel!)
          ? ` (wikidata: "${m.wikidataLabel}")`
          : '';
      console.log(`  ${m.wikidataId} | "${m.label}"${note} | ${m.source}`);
    }
    console.log();
  }

  // Exit with error code if mismatches found
  if (mismatches.length > 0 || missing.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
