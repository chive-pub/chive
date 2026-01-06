/**
 * Academic category taxonomy for ranking.
 *
 * @remarks
 * Comprehensive taxonomy mapping for academic preprint categorization,
 * including arXiv, LingBuzz, PsyArXiv, and cross-source mappings.
 *
 * **Data Sources:**
 * - arXiv: https://arxiv.org/category_taxonomy
 * - LingBuzz: https://lingbuzz.net
 * - PsyArXiv: OSF subject taxonomy
 *
 * @packageDocumentation
 * @public
 */

/**
 * Category source identifier.
 *
 * @public
 */
export type CategorySource = 'arxiv' | 'lingbuzz' | 'psyarxiv' | 'openreview' | 'generic';

/**
 * Category information.
 *
 * @public
 */
export interface CategoryInfo {
  /**
   * Canonical category code.
   */
  readonly code: string;

  /**
   * Human-readable name.
   */
  readonly name: string;

  /**
   * Origin taxonomy source.
   */
  readonly source: CategorySource;

  /**
   * Parent category codes.
   */
  readonly parentCodes: readonly string[];

  /**
   * Alternative names and aliases.
   */
  readonly aliases: readonly string[];
}

// =============================================================================
// arXiv TAXONOMY
// =============================================================================

/**
 * Complete arXiv category taxonomy.
 *
 * @remarks
 * Based on https://arxiv.org/category_taxonomy (as of 2024).
 * Includes all top-level categories and common subcategories.
 */
export const ARXIV_TAXONOMY: Record<string, CategoryInfo> = {
  // -------------------------------------------------------------------------
  // Computer Science (cs.*)
  // -------------------------------------------------------------------------
  cs: {
    code: 'cs',
    name: 'Computer Science',
    source: 'arxiv',
    parentCodes: [],
    aliases: ['computing', 'computer science'],
  },
  'cs.ai': {
    code: 'cs.ai',
    name: 'Artificial Intelligence',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['artificial intelligence', 'ai', 'machine intelligence'],
  },
  'cs.cl': {
    code: 'cs.cl',
    name: 'Computation and Language',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: [
      'computational linguistics',
      'nlp',
      'natural language processing',
      'natural language',
    ],
  },
  'cs.cc': {
    code: 'cs.cc',
    name: 'Computational Complexity',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['complexity theory', 'computational complexity'],
  },
  'cs.ce': {
    code: 'cs.ce',
    name: 'Computational Engineering, Finance, and Science',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['computational engineering'],
  },
  'cs.cg': {
    code: 'cs.cg',
    name: 'Computational Geometry',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['computational geometry'],
  },
  'cs.cr': {
    code: 'cs.cr',
    name: 'Cryptography and Security',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['cryptography', 'security', 'computer security'],
  },
  'cs.cv': {
    code: 'cs.cv',
    name: 'Computer Vision and Pattern Recognition',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['computer vision', 'image recognition', 'pattern recognition', 'vision'],
  },
  'cs.cy': {
    code: 'cs.cy',
    name: 'Computers and Society',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['computers and society'],
  },
  'cs.db': {
    code: 'cs.db',
    name: 'Databases',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['databases', 'database systems'],
  },
  'cs.dc': {
    code: 'cs.dc',
    name: 'Distributed, Parallel, and Cluster Computing',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['distributed computing', 'parallel computing'],
  },
  'cs.dl': {
    code: 'cs.dl',
    name: 'Digital Libraries',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['digital libraries'],
  },
  'cs.dm': {
    code: 'cs.dm',
    name: 'Discrete Mathematics',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['discrete mathematics', 'discrete math'],
  },
  'cs.ds': {
    code: 'cs.ds',
    name: 'Data Structures and Algorithms',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['data structures', 'algorithms'],
  },
  'cs.et': {
    code: 'cs.et',
    name: 'Emerging Technologies',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['emerging technologies'],
  },
  'cs.fl': {
    code: 'cs.fl',
    name: 'Formal Languages and Automata Theory',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['formal languages', 'automata theory'],
  },
  'cs.gl': {
    code: 'cs.gl',
    name: 'General Literature',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: [],
  },
  'cs.gr': {
    code: 'cs.gr',
    name: 'Graphics',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['computer graphics', 'graphics'],
  },
  'cs.gt': {
    code: 'cs.gt',
    name: 'Computer Science and Game Theory',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['game theory'],
  },
  'cs.hc': {
    code: 'cs.hc',
    name: 'Human-Computer Interaction',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['hci', 'human computer interaction'],
  },
  'cs.ir': {
    code: 'cs.ir',
    name: 'Information Retrieval',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['information retrieval', 'search'],
  },
  'cs.it': {
    code: 'cs.it',
    name: 'Information Theory',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['information theory'],
  },
  'cs.lg': {
    code: 'cs.lg',
    name: 'Machine Learning',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['machine learning', 'ml', 'deep learning', 'neural networks'],
  },
  'cs.lo': {
    code: 'cs.lo',
    name: 'Logic in Computer Science',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['logic', 'formal logic'],
  },
  'cs.ma': {
    code: 'cs.ma',
    name: 'Multiagent Systems',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['multiagent systems', 'multi-agent'],
  },
  'cs.mm': {
    code: 'cs.mm',
    name: 'Multimedia',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['multimedia'],
  },
  'cs.ms': {
    code: 'cs.ms',
    name: 'Mathematical Software',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['mathematical software'],
  },
  'cs.na': {
    code: 'cs.na',
    name: 'Numerical Analysis',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['numerical analysis'],
  },
  'cs.ne': {
    code: 'cs.ne',
    name: 'Neural and Evolutionary Computing',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['neural computing', 'evolutionary computing'],
  },
  'cs.ni': {
    code: 'cs.ni',
    name: 'Networking and Internet Architecture',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['networking', 'internet'],
  },
  'cs.oh': {
    code: 'cs.oh',
    name: 'Other Computer Science',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: [],
  },
  'cs.os': {
    code: 'cs.os',
    name: 'Operating Systems',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['operating systems'],
  },
  'cs.pf': {
    code: 'cs.pf',
    name: 'Performance',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['performance'],
  },
  'cs.pl': {
    code: 'cs.pl',
    name: 'Programming Languages',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['programming languages'],
  },
  'cs.ro': {
    code: 'cs.ro',
    name: 'Robotics',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['robotics'],
  },
  'cs.sc': {
    code: 'cs.sc',
    name: 'Symbolic Computation',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['symbolic computation'],
  },
  'cs.sd': {
    code: 'cs.sd',
    name: 'Sound',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['audio', 'sound processing'],
  },
  'cs.se': {
    code: 'cs.se',
    name: 'Software Engineering',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['software engineering'],
  },
  'cs.si': {
    code: 'cs.si',
    name: 'Social and Information Networks',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['social networks'],
  },
  'cs.sy': {
    code: 'cs.sy',
    name: 'Systems and Control',
    source: 'arxiv',
    parentCodes: ['cs'],
    aliases: ['control systems'],
  },

  // -------------------------------------------------------------------------
  // Mathematics (math.*)
  // -------------------------------------------------------------------------
  math: {
    code: 'math',
    name: 'Mathematics',
    source: 'arxiv',
    parentCodes: [],
    aliases: ['mathematics', 'mathematical'],
  },
  'math.ag': {
    code: 'math.ag',
    name: 'Algebraic Geometry',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['algebraic geometry'],
  },
  'math.at': {
    code: 'math.at',
    name: 'Algebraic Topology',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['algebraic topology'],
  },
  'math.ap': {
    code: 'math.ap',
    name: 'Analysis of PDEs',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['partial differential equations', 'pdes'],
  },
  'math.ct': {
    code: 'math.ct',
    name: 'Category Theory',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['category theory'],
  },
  'math.ca': {
    code: 'math.ca',
    name: 'Classical Analysis and ODEs',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['classical analysis', 'odes'],
  },
  'math.co': {
    code: 'math.co',
    name: 'Combinatorics',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['combinatorics'],
  },
  'math.ac': {
    code: 'math.ac',
    name: 'Commutative Algebra',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['commutative algebra'],
  },
  'math.cv': {
    code: 'math.cv',
    name: 'Complex Variables',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['complex analysis', 'complex variables'],
  },
  'math.dg': {
    code: 'math.dg',
    name: 'Differential Geometry',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['differential geometry'],
  },
  'math.ds': {
    code: 'math.ds',
    name: 'Dynamical Systems',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['dynamical systems'],
  },
  'math.fa': {
    code: 'math.fa',
    name: 'Functional Analysis',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['functional analysis'],
  },
  'math.gm': {
    code: 'math.gm',
    name: 'General Mathematics',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: [],
  },
  'math.gn': {
    code: 'math.gn',
    name: 'General Topology',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['general topology'],
  },
  'math.gt': {
    code: 'math.gt',
    name: 'Geometric Topology',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['geometric topology'],
  },
  'math.gr': {
    code: 'math.gr',
    name: 'Group Theory',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['group theory'],
  },
  'math.ho': {
    code: 'math.ho',
    name: 'History and Overview',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['history of mathematics'],
  },
  'math.it': {
    code: 'math.it',
    name: 'Information Theory',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['information theory'],
  },
  'math.kt': {
    code: 'math.kt',
    name: 'K-Theory and Homology',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['k-theory', 'homology'],
  },
  'math.lo': {
    code: 'math.lo',
    name: 'Logic',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['mathematical logic'],
  },
  'math.mp': {
    code: 'math.mp',
    name: 'Mathematical Physics',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['mathematical physics'],
  },
  'math.mg': {
    code: 'math.mg',
    name: 'Metric Geometry',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['metric geometry'],
  },
  'math.nt': {
    code: 'math.nt',
    name: 'Number Theory',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['number theory'],
  },
  'math.na': {
    code: 'math.na',
    name: 'Numerical Analysis',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['numerical analysis'],
  },
  'math.oa': {
    code: 'math.oa',
    name: 'Operator Algebras',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['operator algebras'],
  },
  'math.oc': {
    code: 'math.oc',
    name: 'Optimization and Control',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['optimization', 'control theory'],
  },
  'math.pr': {
    code: 'math.pr',
    name: 'Probability',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['probability theory', 'probability'],
  },
  'math.qa': {
    code: 'math.qa',
    name: 'Quantum Algebra',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['quantum algebra'],
  },
  'math.ra': {
    code: 'math.ra',
    name: 'Rings and Algebras',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['ring theory', 'algebra'],
  },
  'math.rt': {
    code: 'math.rt',
    name: 'Representation Theory',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['representation theory'],
  },
  'math.sg': {
    code: 'math.sg',
    name: 'Symplectic Geometry',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['symplectic geometry'],
  },
  'math.sp': {
    code: 'math.sp',
    name: 'Spectral Theory',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['spectral theory'],
  },
  'math.st': {
    code: 'math.st',
    name: 'Statistics Theory',
    source: 'arxiv',
    parentCodes: ['math'],
    aliases: ['statistics theory'],
  },

  // -------------------------------------------------------------------------
  // Physics
  // -------------------------------------------------------------------------
  physics: {
    code: 'physics',
    name: 'Physics',
    source: 'arxiv',
    parentCodes: [],
    aliases: ['physics', 'physical'],
  },
  'astro-ph': {
    code: 'astro-ph',
    name: 'Astrophysics',
    source: 'arxiv',
    parentCodes: ['physics'],
    aliases: ['astrophysics', 'astronomy'],
  },
  'cond-mat': {
    code: 'cond-mat',
    name: 'Condensed Matter',
    source: 'arxiv',
    parentCodes: ['physics'],
    aliases: ['condensed matter physics', 'condensed matter'],
  },
  'gr-qc': {
    code: 'gr-qc',
    name: 'General Relativity and Quantum Cosmology',
    source: 'arxiv',
    parentCodes: ['physics'],
    aliases: ['general relativity', 'quantum cosmology'],
  },
  'hep-ex': {
    code: 'hep-ex',
    name: 'High Energy Physics - Experiment',
    source: 'arxiv',
    parentCodes: ['physics'],
    aliases: ['high energy physics experiment', 'particle physics experiment'],
  },
  'hep-lat': {
    code: 'hep-lat',
    name: 'High Energy Physics - Lattice',
    source: 'arxiv',
    parentCodes: ['physics'],
    aliases: ['lattice qcd'],
  },
  'hep-ph': {
    code: 'hep-ph',
    name: 'High Energy Physics - Phenomenology',
    source: 'arxiv',
    parentCodes: ['physics'],
    aliases: ['high energy physics phenomenology'],
  },
  'hep-th': {
    code: 'hep-th',
    name: 'High Energy Physics - Theory',
    source: 'arxiv',
    parentCodes: ['physics'],
    aliases: ['high energy physics theory', 'particle physics theory', 'string theory'],
  },
  'math-ph': {
    code: 'math-ph',
    name: 'Mathematical Physics',
    source: 'arxiv',
    parentCodes: ['physics'],
    aliases: ['mathematical physics'],
  },
  nlin: {
    code: 'nlin',
    name: 'Nonlinear Sciences',
    source: 'arxiv',
    parentCodes: ['physics'],
    aliases: ['nonlinear sciences', 'chaos theory'],
  },
  'nucl-ex': {
    code: 'nucl-ex',
    name: 'Nuclear Experiment',
    source: 'arxiv',
    parentCodes: ['physics'],
    aliases: ['nuclear physics experiment'],
  },
  'nucl-th': {
    code: 'nucl-th',
    name: 'Nuclear Theory',
    source: 'arxiv',
    parentCodes: ['physics'],
    aliases: ['nuclear physics theory'],
  },
  'quant-ph': {
    code: 'quant-ph',
    name: 'Quantum Physics',
    source: 'arxiv',
    parentCodes: ['physics'],
    aliases: ['quantum mechanics', 'quantum physics', 'quantum theory', 'quantum computing'],
  },

  // -------------------------------------------------------------------------
  // Statistics (stat.*)
  // -------------------------------------------------------------------------
  stat: {
    code: 'stat',
    name: 'Statistics',
    source: 'arxiv',
    parentCodes: [],
    aliases: ['statistics', 'statistical'],
  },
  'stat.ap': {
    code: 'stat.ap',
    name: 'Applications',
    source: 'arxiv',
    parentCodes: ['stat'],
    aliases: ['applied statistics'],
  },
  'stat.co': {
    code: 'stat.co',
    name: 'Computation',
    source: 'arxiv',
    parentCodes: ['stat'],
    aliases: ['computational statistics'],
  },
  'stat.me': {
    code: 'stat.me',
    name: 'Methodology',
    source: 'arxiv',
    parentCodes: ['stat'],
    aliases: ['statistical methodology'],
  },
  'stat.ml': {
    code: 'stat.ml',
    name: 'Machine Learning',
    source: 'arxiv',
    parentCodes: ['stat'],
    aliases: ['statistical machine learning'],
  },
  'stat.ot': {
    code: 'stat.ot',
    name: 'Other Statistics',
    source: 'arxiv',
    parentCodes: ['stat'],
    aliases: [],
  },
  'stat.th': {
    code: 'stat.th',
    name: 'Statistics Theory',
    source: 'arxiv',
    parentCodes: ['stat'],
    aliases: ['theoretical statistics'],
  },

  // -------------------------------------------------------------------------
  // Quantitative Biology (q-bio.*)
  // -------------------------------------------------------------------------
  'q-bio': {
    code: 'q-bio',
    name: 'Quantitative Biology',
    source: 'arxiv',
    parentCodes: [],
    aliases: ['biology', 'biological', 'quantitative biology'],
  },
  'q-bio.bm': {
    code: 'q-bio.bm',
    name: 'Biomolecules',
    source: 'arxiv',
    parentCodes: ['q-bio'],
    aliases: ['biomolecules'],
  },
  'q-bio.cb': {
    code: 'q-bio.cb',
    name: 'Cell Behavior',
    source: 'arxiv',
    parentCodes: ['q-bio'],
    aliases: ['cell biology'],
  },
  'q-bio.gn': {
    code: 'q-bio.gn',
    name: 'Genomics',
    source: 'arxiv',
    parentCodes: ['q-bio'],
    aliases: ['genomics', 'genetics'],
  },
  'q-bio.mn': {
    code: 'q-bio.mn',
    name: 'Molecular Networks',
    source: 'arxiv',
    parentCodes: ['q-bio'],
    aliases: ['molecular networks'],
  },
  'q-bio.nc': {
    code: 'q-bio.nc',
    name: 'Neurons and Cognition',
    source: 'arxiv',
    parentCodes: ['q-bio'],
    aliases: ['neuroscience', 'cognitive science', 'neurons'],
  },
  'q-bio.ot': {
    code: 'q-bio.ot',
    name: 'Other Quantitative Biology',
    source: 'arxiv',
    parentCodes: ['q-bio'],
    aliases: [],
  },
  'q-bio.pe': {
    code: 'q-bio.pe',
    name: 'Populations and Evolution',
    source: 'arxiv',
    parentCodes: ['q-bio'],
    aliases: ['evolutionary biology', 'population biology'],
  },
  'q-bio.qm': {
    code: 'q-bio.qm',
    name: 'Quantitative Methods',
    source: 'arxiv',
    parentCodes: ['q-bio'],
    aliases: ['quantitative methods'],
  },
  'q-bio.sc': {
    code: 'q-bio.sc',
    name: 'Subcellular Processes',
    source: 'arxiv',
    parentCodes: ['q-bio'],
    aliases: ['subcellular processes'],
  },
  'q-bio.to': {
    code: 'q-bio.to',
    name: 'Tissues and Organs',
    source: 'arxiv',
    parentCodes: ['q-bio'],
    aliases: ['tissues', 'organs'],
  },

  // -------------------------------------------------------------------------
  // Quantitative Finance (q-fin.*)
  // -------------------------------------------------------------------------
  'q-fin': {
    code: 'q-fin',
    name: 'Quantitative Finance',
    source: 'arxiv',
    parentCodes: [],
    aliases: ['finance', 'financial', 'quantitative finance'],
  },
  'q-fin.cp': {
    code: 'q-fin.cp',
    name: 'Computational Finance',
    source: 'arxiv',
    parentCodes: ['q-fin'],
    aliases: ['computational finance'],
  },
  'q-fin.ec': {
    code: 'q-fin.ec',
    name: 'Economics',
    source: 'arxiv',
    parentCodes: ['q-fin'],
    aliases: ['economics'],
  },
  'q-fin.gn': {
    code: 'q-fin.gn',
    name: 'General Finance',
    source: 'arxiv',
    parentCodes: ['q-fin'],
    aliases: [],
  },
  'q-fin.mf': {
    code: 'q-fin.mf',
    name: 'Mathematical Finance',
    source: 'arxiv',
    parentCodes: ['q-fin'],
    aliases: ['mathematical finance'],
  },
  'q-fin.pm': {
    code: 'q-fin.pm',
    name: 'Portfolio Management',
    source: 'arxiv',
    parentCodes: ['q-fin'],
    aliases: ['portfolio management'],
  },
  'q-fin.pr': {
    code: 'q-fin.pr',
    name: 'Pricing of Securities',
    source: 'arxiv',
    parentCodes: ['q-fin'],
    aliases: ['securities pricing'],
  },
  'q-fin.rm': {
    code: 'q-fin.rm',
    name: 'Risk Management',
    source: 'arxiv',
    parentCodes: ['q-fin'],
    aliases: ['risk management'],
  },
  'q-fin.st': {
    code: 'q-fin.st',
    name: 'Statistical Finance',
    source: 'arxiv',
    parentCodes: ['q-fin'],
    aliases: ['statistical finance'],
  },
  'q-fin.tr': {
    code: 'q-fin.tr',
    name: 'Trading and Market Microstructure',
    source: 'arxiv',
    parentCodes: ['q-fin'],
    aliases: ['trading', 'market microstructure'],
  },

  // -------------------------------------------------------------------------
  // Economics (econ.*)
  // -------------------------------------------------------------------------
  econ: {
    code: 'econ',
    name: 'Economics',
    source: 'arxiv',
    parentCodes: [],
    aliases: ['economics', 'economic'],
  },
  'econ.em': {
    code: 'econ.em',
    name: 'Econometrics',
    source: 'arxiv',
    parentCodes: ['econ'],
    aliases: ['econometrics'],
  },
  'econ.gn': {
    code: 'econ.gn',
    name: 'General Economics',
    source: 'arxiv',
    parentCodes: ['econ'],
    aliases: [],
  },
  'econ.th': {
    code: 'econ.th',
    name: 'Theoretical Economics',
    source: 'arxiv',
    parentCodes: ['econ'],
    aliases: ['economic theory'],
  },

  // -------------------------------------------------------------------------
  // Electrical Engineering and Systems Science (eess.*)
  // -------------------------------------------------------------------------
  eess: {
    code: 'eess',
    name: 'Electrical Engineering and Systems Science',
    source: 'arxiv',
    parentCodes: [],
    aliases: ['electrical engineering', 'signal processing'],
  },
  'eess.as': {
    code: 'eess.as',
    name: 'Audio and Speech Processing',
    source: 'arxiv',
    parentCodes: ['eess'],
    aliases: ['audio processing', 'speech processing'],
  },
  'eess.iv': {
    code: 'eess.iv',
    name: 'Image and Video Processing',
    source: 'arxiv',
    parentCodes: ['eess'],
    aliases: ['image processing', 'video processing'],
  },
  'eess.sp': {
    code: 'eess.sp',
    name: 'Signal Processing',
    source: 'arxiv',
    parentCodes: ['eess'],
    aliases: ['signal processing'],
  },
  'eess.sy': {
    code: 'eess.sy',
    name: 'Systems and Control',
    source: 'arxiv',
    parentCodes: ['eess'],
    aliases: ['control systems'],
  },
};

// =============================================================================
// LINGBUZZ TAXONOMY
// =============================================================================

/**
 * LingBuzz category taxonomy.
 *
 * @remarks
 * Categories used on LingBuzz linguistics preprint server.
 */
export const LINGBUZZ_TAXONOMY: Record<string, CategoryInfo> = {
  'linguistics.syntax': {
    code: 'linguistics.syntax',
    name: 'Syntax',
    source: 'lingbuzz',
    parentCodes: ['linguistics'],
    aliases: ['syntactic theory', 'sentence structure', 'syntactic'],
  },
  'linguistics.semantics': {
    code: 'linguistics.semantics',
    name: 'Semantics',
    source: 'lingbuzz',
    parentCodes: ['linguistics'],
    aliases: ['formal semantics', 'meaning', 'semantic'],
  },
  'linguistics.phonology': {
    code: 'linguistics.phonology',
    name: 'Phonology',
    source: 'lingbuzz',
    parentCodes: ['linguistics'],
    aliases: ['phonological theory', 'sound patterns', 'phonological'],
  },
  'linguistics.phonetics': {
    code: 'linguistics.phonetics',
    name: 'Phonetics',
    source: 'lingbuzz',
    parentCodes: ['linguistics'],
    aliases: ['speech sounds', 'phonetic'],
  },
  'linguistics.morphology': {
    code: 'linguistics.morphology',
    name: 'Morphology',
    source: 'lingbuzz',
    parentCodes: ['linguistics'],
    aliases: ['word structure', 'morphological'],
  },
  'linguistics.pragmatics': {
    code: 'linguistics.pragmatics',
    name: 'Pragmatics',
    source: 'lingbuzz',
    parentCodes: ['linguistics'],
    aliases: ['pragmatic'],
  },
  'linguistics.psycholinguistics': {
    code: 'linguistics.psycholinguistics',
    name: 'Psycholinguistics',
    source: 'lingbuzz',
    parentCodes: ['linguistics'],
    aliases: ['language processing', 'psycholinguistic'],
  },
  'linguistics.historical': {
    code: 'linguistics.historical',
    name: 'Historical Linguistics',
    source: 'lingbuzz',
    parentCodes: ['linguistics'],
    aliases: ['language change', 'diachronic'],
  },
  'linguistics.typology': {
    code: 'linguistics.typology',
    name: 'Typology',
    source: 'lingbuzz',
    parentCodes: ['linguistics'],
    aliases: ['language typology', 'typological'],
  },
  'linguistics.acquisition': {
    code: 'linguistics.acquisition',
    name: 'Language Acquisition',
    source: 'lingbuzz',
    parentCodes: ['linguistics'],
    aliases: ['first language acquisition', 'second language acquisition'],
  },
  linguistics: {
    code: 'linguistics',
    name: 'Linguistics',
    source: 'lingbuzz',
    parentCodes: [],
    aliases: ['linguistics', 'linguistic'],
  },
};

// =============================================================================
// CROSS-SOURCE MAPPINGS
// =============================================================================

/**
 * Cross-source category mappings.
 *
 * @remarks
 * Maps categories from different sources to related categories,
 * enabling cross-source matching in ranking.
 */
export const CROSS_SOURCE_MAPPINGS: ReadonlyMap<string, readonly string[]> = new Map([
  // LingBuzz to arXiv
  ['linguistics.syntax', ['cs.cl', 'cs.ai']],
  ['linguistics.semantics', ['cs.cl', 'cs.lo']],
  ['linguistics.phonology', ['cs.cl', 'cs.sd']],
  ['linguistics.phonetics', ['cs.cl', 'eess.as']],
  ['linguistics.psycholinguistics', ['cs.cl', 'q-bio.nc']],
  ['linguistics', ['cs.cl']],

  // Generic field mappings
  ['computer science', ['cs']],
  ['physics', ['physics', 'hep-th', 'hep-ex', 'quant-ph', 'cond-mat']],
  ['mathematics', ['math']],
  ['biology', ['q-bio']],
  ['economics', ['econ', 'q-fin']],
  ['neuroscience', ['q-bio.nc']],
  ['machine learning', ['cs.lg', 'stat.ml']],
  ['artificial intelligence', ['cs.ai']],
  ['natural language processing', ['cs.cl']],
  ['quantum computing', ['quant-ph', 'cs.et']],
]);

// =============================================================================
// COMBINED TAXONOMY
// =============================================================================

/**
 * Combined taxonomy from all sources.
 */
export const FULL_TAXONOMY: Record<string, CategoryInfo> = {
  ...ARXIV_TAXONOMY,
  ...LINGBUZZ_TAXONOMY,
};

/**
 * Gets all aliases for lookup.
 */
export function getAllAliases(): Map<string, string> {
  const aliases = new Map<string, string>();

  for (const [code, info] of Object.entries(FULL_TAXONOMY)) {
    // Add canonical code
    aliases.set(code.toLowerCase(), code);
    aliases.set(info.name.toLowerCase(), code);

    // Add all aliases
    for (const alias of info.aliases) {
      aliases.set(alias.toLowerCase(), code);
    }
  }

  return aliases;
}

export default FULL_TAXONOMY;
