import fs from 'fs/promises';
import path from 'path';
import Handlebars from 'handlebars';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LEXICONS_DIR = path.join(__dirname, '../lexicons');
const OUTPUT_DIR = path.join(__dirname, '../src/lexicons/validators');
const TEMPLATE_PATH = path.join(__dirname, 'templates/zod-validator.hbs');

/**
 * Converts NSID to camelCase name
 * @param {string} nsid - NSID like "pub.chive.preprint.submission"
 * @returns {string} camelCase name like "preprintSubmission"
 */
function toCamelCase(nsid) {
  const parts = nsid.split('.');
  // Skip "pub.chive" prefix
  const relevant = parts.slice(2);
  return relevant
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

/**
 * Converts NSID to PascalCase name
 * @param {string} nsid - NSID like "pub.chive.preprint.submission"
 * @returns {string} PascalCase name like "PreprintSubmission"
 */
function toPascalCase(nsid) {
  const camel = toCamelCase(nsid);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Converts Lexicon type to Zod schema expression
 * @param {object} prop - Lexicon property definition
 * @param {object} context - Context object to track imports and local defs
 * @returns {string} Zod schema string
 */
function toZodType(prop, context = {}) {
  if (!prop || !prop.type) {
    return 'z.unknown()';
  }

  switch (prop.type) {
    case 'string':
      if (prop.format === 'datetime') {
        return 'z.string().datetime()';
      }
      if (prop.format === 'at-uri') {
        return 'z.string().refine((val) => /^at:\\/\\/did:[a-z]+:[a-zA-Z0-9._-]+\\/[a-z]+(\\.[a-z]+)+\\/[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid AT URI format" })';
      }
      if (prop.format === 'did') {
        return 'z.string().refine((val) => /^did:[a-z]+:[a-zA-Z0-9._-]+$/.test(val), { message: "Invalid DID format" })';
      }
      if (prop.format === 'cid') {
        return 'z.string().refine((val) => /^[a-z0-9]+$/.test(val) && val.length > 10, { message: "Invalid CID format" })';
      }
      if (prop.maxLength) {
        return `z.string().max(${prop.maxLength})`;
      }
      if (prop.knownValues) {
        const values = prop.knownValues.map(v => `"${v}"`).join(', ');
        return `z.enum([${values}])`;
      }
      return 'z.string()';

    case 'integer':
      if (prop.minimum !== undefined) {
        return `z.number().int().min(${prop.minimum})`;
      }
      if (prop.maximum !== undefined) {
        return `z.number().int().max(${prop.maximum})`;
      }
      return 'z.number().int()';

    case 'number':
      return 'z.number()';

    case 'boolean':
      return 'z.boolean()';

    case 'blob':
      return 'z.object({ $type: z.literal("blob"), ref: z.object({ $link: z.string() }), mimeType: z.string(), size: z.number() })';

    case 'array':
      const itemType = toZodType(prop.items, context);
      let arraySchema = `z.array(${itemType})`;
      if (prop.minLength) {
        arraySchema += `.min(${prop.minLength})`;
      }
      if (prop.maxLength) {
        arraySchema += `.max(${prop.maxLength})`;
      }
      return arraySchema;

    case 'ref':
      // Refs point to other Lexicon schemas (e.g., pub.chive.graph.facet)
      // Import and use the referenced schema for proper validation
      if (!prop.ref) {
        return 'z.unknown()';
      }

      // Handle local refs (starting with #)
      if (prop.ref.startsWith('#')) {
        const localDefName = prop.ref.slice(1);
        const localDefs = context.localDefs || {};
        const localDef = localDefs[localDefName];

        if (localDef && localDef.type === 'object') {
          // Inline the local def as a Zod schema
          return toZodType(localDef, context);
        } else if (localDef && localDef.type === 'union') {
          // Handle union types
          const unionRefs = localDef.refs || [];
          const unionSchemas = unionRefs.map(r => {
            if (r.startsWith('#')) {
              const innerDefName = r.slice(1);
              const innerDef = localDefs[innerDefName];
              if (innerDef) {
                return toZodType(innerDef, context);
              }
            }
            return 'z.unknown()';
          });
          return `z.union([${unionSchemas.join(', ')}])`;
        }

        console.warn(`Local ref not found or unsupported type: ${prop.ref}`);
        return 'z.unknown()';
      }

      // Handle global refs (NSID)
      const refNsid = prop.ref;
      const schemaName = toCamelCase(refNsid) + 'Schema';
      const typeName = toPascalCase(refNsid);

      // Calculate relative import path
      // Example: from pub/chive/preprint/submission to pub/chive/graph/facet
      // We need to import from '../graph/facet'
      if (context.currentNsid && context.imports) {
        const currentParts = context.currentNsid.split('.');
        const refParts = refNsid.split('.');

        // Find common prefix
        let commonLength = 0;
        while (commonLength < currentParts.length - 1 &&
               commonLength < refParts.length &&
               currentParts[commonLength] === refParts[commonLength]) {
          commonLength++;
        }

        // Build relative path
        const upLevels = currentParts.length - 1 - commonLength;
        const downPath = refParts.slice(commonLength).join('/');
        const relativePath = upLevels === 0 ? './' + downPath : '../'.repeat(upLevels) + downPath;

        // Track import
        if (!context.imports.some(imp => imp.path === relativePath)) {
          context.imports.push({
            path: relativePath,
            names: [{ schema: schemaName, type: typeName }]
          });
        }
      }

      return schemaName;

    case 'object':
      if (!prop.properties) {
        throw new Error('Object type must have properties defined');
      }
      const objProps = Object.entries(prop.properties)
        .map(([key, val]) => {
          const required = prop.required?.includes(key);
          const zodType = toZodType(val, context);
          const finalType = required ? zodType : `${zodType}.optional()`;
          return `${key}: ${finalType}`;
        })
        .join(', ');
      return `z.object({ ${objProps} })`;

    default:
      return 'z.unknown()';
  }
}

/**
 * Finds all JSON files recursively
 * @param {string} dir - Directory to search
 * @returns {Promise<string[]>} Array of file paths
 */
async function findSchemaFiles(dir) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findSchemaFiles(fullPath)));
    } else if (entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Generates Zod validators from Lexicon schemas
 */
async function generateValidators() {
  console.log('Loading Lexicon schemas...');
  const schemaFiles = await findSchemaFiles(LEXICONS_DIR);
  console.log(`Found ${schemaFiles.length} schema files`);

  // Load template
  const templateSource = await fs.readFile(TEMPLATE_PATH, 'utf-8');
  const template = Handlebars.compile(templateSource);

  // Register helpers
  Handlebars.registerHelper('camelCaseName', function () {
    return toCamelCase(this.id);
  });

  Handlebars.registerHelper('pascalCaseName', function () {
    return toPascalCase(this.id);
  });

  for (const file of schemaFiles) {
    try {
      const schema = JSON.parse(await fs.readFile(file, 'utf-8'));
      const nsid = schema.id;

      if (!nsid) {
        console.warn(`Skipping ${file}: no id field`);
        continue;
      }

      console.log(`Processing ${nsid}...`);

      const mainDef = schema.defs?.main;
      if (!mainDef) {
        console.warn(`Skipping ${nsid}: no main definition`);
        continue;
      }

      const isRecord = mainDef.type === 'record';
      const isQuery = mainDef.type === 'query';
      const isObject = mainDef.type === 'object';

      // Create context for tracking imports and local defs
      const context = {
        currentNsid: nsid,
        imports: [],
        localDefs: schema.defs || {}
      };

      let templateData = {
        id: nsid,
        isRecord,
        isQuery,
        isObject,
        imports: []
      };

      if (isRecord) {
        const props = mainDef.record?.properties || {};
        templateData.properties = {};
        for (const [key, prop] of Object.entries(props)) {
          const required = mainDef.record?.required?.includes(key);
          const zodType = toZodType(prop, context);
          templateData.properties[key] = required ? zodType : `${zodType}.optional()`;
        }
      }

      if (isObject) {
        const props = mainDef.properties || {};
        templateData.properties = {};
        for (const [key, prop] of Object.entries(props)) {
          const required = mainDef.required?.includes(key);
          const zodType = toZodType(prop, context);
          templateData.properties[key] = required ? zodType : `${zodType}.optional()`;
        }
      }

      if (isQuery) {
        const params = mainDef.parameters?.properties || {};
        const outputProps = mainDef.output?.schema?.properties || {};

        templateData.params = {};
        templateData.outputProps = {};

        for (const [key, prop] of Object.entries(params)) {
          const required = mainDef.parameters?.required?.includes(key);
          const zodType = toZodType(prop, context);
          templateData.params[key] = required ? zodType : `${zodType}.optional()`;
        }

        for (const [key, prop] of Object.entries(outputProps)) {
          const required = mainDef.output?.schema?.required?.includes(key);
          const zodType = toZodType(prop, context);
          templateData.outputProps[key] = required ? zodType : `${zodType}.optional()`;
        }
      }

      // Add imports to template data
      templateData.imports = context.imports;

      // Generate output
      const validatorCode = template(templateData);

      // Determine output path
      const relativePath = nsid.replace(/\./g, '/');
      const outputPath = path.join(OUTPUT_DIR, `${relativePath}.ts`);

      // Create directory
      await fs.mkdir(path.dirname(outputPath), { recursive: true });

      // Write file
      await fs.writeFile(outputPath, validatorCode);
      console.log(`✓ Generated ${outputPath}`);
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }

  console.log(`\n✅ Generated Zod validators for ${schemaFiles.length} schemas`);
}

generateValidators().catch(console.error);
