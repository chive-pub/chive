/**
 * OpenAPI 3.1 specification generator and Swagger UI.
 *
 * @remarks
 * Generates rich OpenAPI documentation from ATProto lexicons at runtime.
 * Converts lexicon schemas to OpenAPI 3.1 format.
 *
 * @packageDocumentation
 * @public
 */

import { swaggerUI } from '@hono/swagger-ui';
import type { Hono } from 'hono';

import { schemaDict } from '../../lexicons/generated/lexicons.js';
import { SERVER_INFO, OPENAPI_SERVERS, OPENAPI_PATHS } from '../config.js';
import { allXRPCMethods } from '../handlers/xrpc/index.js';
import type { ChiveEnv } from '../types/context.js';

// =============================================================================
// Types
// =============================================================================

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    description: string;
    version: string;
    contact?: { name?: string; url?: string; email?: string };
    license?: { name: string; url?: string };
  };
  servers: { url: string; description?: string }[];
  tags: { name: string; description?: string }[];
  paths: Record<string, unknown>;
  components?: {
    schemas?: Record<string, unknown>;
    securitySchemes?: Record<string, unknown>;
  };
}

interface LexProperty {
  type: string;
  description?: string;
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  default?: unknown;
  const?: unknown;
  knownValues?: string[];
  ref?: string;
  refs?: string[];
  items?: LexProperty;
  properties?: Record<string, LexProperty>;
  required?: string[];
  maxSize?: number;
}

interface LexDef {
  type: string;
  description?: string;
  parameters?: {
    type: string;
    required?: string[];
    properties?: Record<string, LexProperty>;
  };
  input?: {
    encoding: string;
    schema?: LexProperty;
  };
  output?: {
    encoding: string;
    schema?: LexProperty;
  };
  errors?: { name: string; description?: string }[];
  record?: LexProperty;
  properties?: Record<string, LexProperty>;
  required?: string[];
}

// =============================================================================
// Lexicon to OpenAPI Converters
// =============================================================================

/**
 * Converts a lexicon string format to OpenAPI format.
 */
function convertFormat(format: string): string {
  if (format === 'datetime') return 'date-time';
  return format;
}

/**
 * Resolves a lexicon reference to an OpenAPI $ref path.
 */
function getRefPath(currentId: string, ref: string): string {
  // Local reference (e.g., #foo)
  if (ref.startsWith('#')) {
    return `#/components/schemas/${currentId}${ref.replace('#', '.')}`;
  }
  // Remove lex: prefix if present
  const cleanRef = ref.replace('lex:', '');
  // Remove #main suffix
  if (cleanRef.endsWith('#main')) {
    return `#/components/schemas/${cleanRef.replace('#main', '')}`;
  }
  // Replace # with . for nested refs
  if (cleanRef.includes('#')) {
    return `#/components/schemas/${cleanRef.replace('#', '.')}`;
  }
  return `#/components/schemas/${cleanRef}`;
}

/**
 * Converts a lexicon property to an OpenAPI schema.
 */
function convertProperty(currentId: string, prop: LexProperty): Record<string, unknown> {
  switch (prop.type) {
    case 'string':
      return {
        type: 'string',
        ...(prop.description && { description: prop.description }),
        ...(prop.format && { format: convertFormat(prop.format) }),
        ...(prop.minLength !== undefined && { minLength: prop.minLength }),
        ...(prop.maxLength !== undefined && { maxLength: prop.maxLength }),
        ...(prop.default !== undefined && { default: prop.default }),
        ...(prop.knownValues && { enum: prop.knownValues }),
      };

    case 'integer':
      return {
        type: 'integer',
        ...(prop.description && { description: prop.description }),
        ...(prop.minimum !== undefined && { minimum: prop.minimum }),
        ...(prop.maximum !== undefined && { maximum: prop.maximum }),
        ...(prop.default !== undefined && { default: prop.default }),
      };

    case 'boolean':
      return {
        type: 'boolean',
        ...(prop.description && { description: prop.description }),
        ...(prop.default !== undefined && { default: prop.default }),
        ...(prop.const !== undefined && { default: prop.const }),
      };

    case 'blob':
      return {
        type: 'string',
        format: 'binary',
        ...(prop.description && { description: prop.description }),
        ...(prop.maxSize !== undefined && { maxLength: prop.maxSize }),
      };

    case 'bytes':
      return {
        type: 'string',
        format: 'byte',
        ...(prop.description && { description: prop.description }),
        ...(prop.maxLength !== undefined && { maxLength: prop.maxLength }),
      };

    case 'cid-link':
      return {
        type: 'string',
        format: 'cid',
        ...(prop.description && { description: prop.description }),
      };

    case 'ref':
      return { $ref: getRefPath(currentId, prop.ref ?? '') };

    case 'union':
      return {
        oneOf: (prop.refs ?? []).map((ref) => ({
          $ref: getRefPath(currentId, ref),
        })),
      };

    case 'array':
      return {
        type: 'array',
        items: prop.items ? convertProperty(currentId, prop.items) : {},
        ...(prop.maxLength !== undefined && { maxItems: prop.maxLength }),
      };

    case 'object':
      return convertObject(currentId, prop);

    case 'token':
      return {
        type: 'string',
        format: 'token',
        ...(prop.description && { description: prop.description }),
      };

    case 'unknown':
      return { type: 'object', additionalProperties: true };

    default:
      return { type: 'object' };
  }
}

/**
 * Converts a lexicon object definition to an OpenAPI schema.
 */
function convertObject(currentId: string, obj: LexProperty): Record<string, unknown> {
  const properties: Record<string, unknown> = {};

  if (obj.properties) {
    for (const [key, prop] of Object.entries(obj.properties)) {
      properties[key] = convertProperty(currentId, prop);
    }
  }

  return {
    type: 'object',
    ...(obj.description && { description: obj.description }),
    ...(obj.required && obj.required.length > 0 && { required: obj.required }),
    ...(Object.keys(properties).length > 0 && { properties }),
  };
}

/**
 * Converts lexicon query parameters to OpenAPI parameters.
 */
function convertParameters(
  currentId: string,
  params: LexDef['parameters']
): Record<string, unknown>[] {
  if (!params?.properties) return [];

  const required = new Set(params.required ?? []);
  const result: Record<string, unknown>[] = [];

  for (const [name, prop] of Object.entries(params.properties)) {
    result.push({
      name,
      in: 'query',
      required: required.has(name),
      ...(prop.description && { description: prop.description }),
      schema: convertProperty(currentId, prop),
    });
  }

  return result;
}

/**
 * Gets the lexicon definition for an NSID.
 */
function getLexiconDef(nsid: string): LexDef | undefined {
  // Convert NSID to schema key (e.g., pub.chive.eprint.getSubmission -> PubChiveEprintGetSubmission)
  const key = nsid
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  const dict = schemaDict as Record<string, { defs?: Record<string, LexDef> }>;
  const lexDoc = dict[key];
  return lexDoc?.defs?.main;
}

/**
 * Collects all referenced schemas from the schemaDict.
 */
function collectReferencedSchemas(): Record<string, unknown> {
  const schemas: Record<string, unknown> = {};

  for (const lexDoc of Object.values(schemaDict)) {
    const doc = lexDoc as { id: string; defs?: Record<string, LexDef> };
    if (!doc.defs) continue;

    for (const [defName, def] of Object.entries(doc.defs)) {
      const schemaId = defName === 'main' ? doc.id : `${doc.id}.${defName}`;

      // Only include object, record, string, array, and token types as schemas
      if (def.type === 'object') {
        schemas[schemaId] = convertObject(doc.id, def as LexProperty);
      } else if (def.type === 'record' && def.record) {
        schemas[schemaId] = convertObject(doc.id, def.record);
      } else if (def.type === 'string') {
        schemas[schemaId] = convertProperty(doc.id, def as unknown as LexProperty);
      } else if (def.type === 'array') {
        schemas[schemaId] = convertProperty(doc.id, def as unknown as LexProperty);
      } else if (def.type === 'token') {
        schemas[schemaId] = convertProperty(doc.id, def as unknown as LexProperty);
      }
    }
  }

  return schemas;
}

// =============================================================================
// OpenAPI Generation
// =============================================================================

/**
 * Generates OpenAPI 3.1 specification from lexicons and registered endpoints.
 *
 * @returns OpenAPI specification object
 * @public
 */
export function generateOpenAPISpec(): OpenAPISpec {
  const paths: Record<string, unknown> = {};
  const collectedSchemas = collectReferencedSchemas();

  // Generate paths from XRPC methods
  for (const [nsid, method] of Object.entries(allXRPCMethods)) {
    const path = `/xrpc/${nsid}`;
    const httpMethod = method.type === 'procedure' ? 'post' : 'get';
    const lexDef = getLexiconDef(nsid);

    // Extract tag from method namespace
    const parts = nsid.split('.');
    const tag = parts.length >= 3 ? parts[2] : 'other';

    // Build operation
    const operation: Record<string, unknown> = {
      operationId: nsid.replace(/\./g, '_'),
      summary: nsid,
      ...(lexDef?.description && { description: lexDef.description }),
      tags: [tag],
      ...(method.auth === true && { security: [{ bearerAuth: [] }] }),
    };

    // Add parameters for queries
    if (httpMethod === 'get' && lexDef?.parameters) {
      const params = convertParameters(nsid, lexDef.parameters);
      if (params.length > 0) {
        operation.parameters = params;
      }
    }

    // Add request body for procedures
    if (httpMethod === 'post' && lexDef?.input?.schema) {
      operation.requestBody = {
        required: true,
        content: {
          [lexDef.input.encoding]: {
            schema: convertProperty(nsid, lexDef.input.schema),
          },
        },
      };
    }

    // Build responses
    const responses: Record<string, unknown> = {};

    // Success response
    if (lexDef?.output?.schema) {
      responses['200'] = {
        description: 'OK',
        content: {
          [lexDef.output.encoding]: {
            schema: convertProperty(nsid, lexDef.output.schema),
          },
        },
      };
    } else {
      responses['200'] = { description: 'OK' };
    }

    // Error responses with possible error codes
    const possibleErrors = ['InvalidRequest'];
    if (method.auth === true) {
      possibleErrors.push('ExpiredToken', 'InvalidToken');
    }
    if (lexDef?.errors) {
      for (const err of lexDef.errors) {
        possibleErrors.push(err.name);
      }
    }

    responses['400'] = {
      description: 'Bad Request',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['error', 'message'],
            properties: {
              error: { type: 'string', enum: possibleErrors },
              message: { type: 'string' },
            },
          },
        },
      },
    };

    if (method.auth === true) {
      responses['401'] = {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      };
    }

    operation.responses = responses;
    paths[path] = { [httpMethod]: operation };
  }

  // Add REST routes
  paths['/api/v1/eprints'] = {
    get: {
      operationId: 'searchEprints',
      summary: 'Search eprints',
      tags: ['eprints'],
      parameters: [
        { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', default: 50, minimum: 1, maximum: 100 },
        },
        { name: 'cursor', in: 'query', schema: { type: 'string' } },
      ],
      responses: { 200: { description: 'Search results' } },
    },
  };

  paths['/api/v1/eprints/{uri}'] = {
    get: {
      operationId: 'getEprint',
      summary: 'Get eprint by URI',
      tags: ['eprints'],
      parameters: [
        {
          name: 'uri',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'URL-encoded AT URI',
        },
      ],
      responses: {
        200: { description: 'Eprint details' },
        404: { description: 'Eprint not found' },
      },
    },
  };

  paths['/health'] = {
    get: {
      operationId: 'healthCheck',
      summary: 'Liveness probe',
      tags: ['health'],
      responses: { 200: { description: 'Service is alive' } },
    },
  };

  paths['/ready'] = {
    get: {
      operationId: 'readinessCheck',
      summary: 'Readiness probe',
      tags: ['health'],
      responses: {
        200: { description: 'Service is ready' },
        503: { description: 'Service is not ready' },
      },
    },
  };

  return {
    openapi: '3.1.0',
    info: {
      title: SERVER_INFO.title,
      description: SERVER_INFO.description,
      version: SERVER_INFO.version,
      contact: SERVER_INFO.contact,
      license: SERVER_INFO.license,
    },
    servers: [...OPENAPI_SERVERS],
    tags: [
      { name: 'activity', description: 'Activity logging and feed' },
      { name: 'actor', description: 'Actor profile operations' },
      { name: 'alpha', description: 'Alpha program operations' },
      { name: 'author', description: 'Author operations' },
      { name: 'backlink', description: 'Backlink operations' },
      { name: 'claiming', description: 'Eprint claiming operations' },
      { name: 'discovery', description: 'Discovery and enrichment' },
      { name: 'endorsement', description: 'Endorsement operations' },
      { name: 'eprint', description: 'Eprint operations' },
      { name: 'governance', description: 'Governance operations' },
      { name: 'graph', description: 'Knowledge graph operations' },
      { name: 'import', description: 'Import operations' },
      { name: 'metrics', description: 'Metrics and trending' },
      { name: 'notification', description: 'Notification operations' },
      { name: 'review', description: 'Review operations' },
      { name: 'sync', description: 'Sync and indexing operations' },
      { name: 'tag', description: 'Tag operations' },
      { name: 'eprints', description: 'REST eprint endpoints' },
      { name: 'health', description: 'Health check endpoints' },
    ],
    paths,
    components: {
      schemas: {
        ErrorResponse: {
          type: 'object',
          required: ['error', 'message'],
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        ...collectedSchemas,
      },
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  };
}

/**
 * Registers OpenAPI documentation routes.
 *
 * @param app - Hono application
 * @public
 */
export function registerOpenAPIRoutes(app: Hono<ChiveEnv>): void {
  app.get(OPENAPI_PATHS.spec, (c) => {
    const spec = generateOpenAPISpec();
    return c.json(spec);
  });

  app.get(
    OPENAPI_PATHS.docs,
    swaggerUI({
      url: OPENAPI_PATHS.spec,
    })
  );
}
