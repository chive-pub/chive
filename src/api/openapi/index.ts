/**
 * OpenAPI 3.1 specification generator and Swagger UI.
 *
 * @remarks
 * Generates OpenAPI documentation from Zod schemas using Zod 4's
 * native `z.toJSONSchema()` function for proper schema conversion.
 *
 * @packageDocumentation
 * @public
 */

import { swaggerUI } from '@hono/swagger-ui';
import type { Hono } from 'hono';

import { SERVER_INFO, OPENAPI_SERVERS, OPENAPI_PATHS } from '../config.js';
import { allXRPCEndpoints } from '../handlers/xrpc/index.js';
import { z } from '../schemas/base.js';
import type { ChiveEnv } from '../types/context.js';

/**
 * OpenAPI 3.1 specification.
 */
interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    description: string;
    version: string;
    contact?: {
      name?: string;
      url?: string;
      email?: string;
    };
    license?: {
      name: string;
      url?: string;
    };
  };
  servers: {
    url: string;
    description?: string;
  }[];
  tags: {
    name: string;
    description?: string;
  }[];
  paths: Record<string, unknown>;
  components?: {
    schemas?: Record<string, unknown>;
    securitySchemes?: Record<string, unknown>;
  };
}

/**
 * Global registry for extracted $defs.
 * Accumulated during spec generation, then moved to components/schemas.
 */
let extractedDefs: Record<string, unknown> = {};

/**
 * Counter for generating unique schema names.
 */
let schemaCounter = 0;

/**
 * Recursively updates $ref paths from inline $defs to components/schemas.
 *
 * @param obj - Object to process
 * @param defMapping - Map of old $def names to new component names
 */
function updateRefs(obj: unknown, defMapping: Record<string, string>): void {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      updateRefs(item, defMapping);
    }
    return;
  }

  const record = obj as Record<string, unknown>;

  // Check for $ref and update if it references a $def
  if (typeof record.$ref === 'string') {
    const match = /^#\/\$defs\/(.+)$/.exec(record.$ref);
    if (match?.[1]) {
      const defName = match[1];
      const newSchemaName = defMapping[defName];
      if (newSchemaName) {
        record.$ref = `#/components/schemas/${newSchemaName}`;
      }
    }
  }

  // Recursively process all properties
  for (const value of Object.values(record)) {
    updateRefs(value, defMapping);
  }
}

/**
 * Extracts $defs from a schema and moves them to global registry.
 *
 * @param schema - Schema potentially containing $defs
 * @param baseName - Base name for generating unique schema names
 * @returns Schema with $defs removed and $refs updated
 */
function extractAndMoveDefs(
  schema: Record<string, unknown>,
  baseName: string
): Record<string, unknown> {
  const defs = schema.$defs as Record<string, unknown> | undefined;

  if (!defs) return schema;

  // Create mapping from old names to new global names
  const defMapping: Record<string, string> = {};

  for (const [defName, defSchema] of Object.entries(defs)) {
    // Generate a unique global name
    const globalName = `${baseName}_${defName}_${schemaCounter++}`;
    defMapping[defName] = globalName;

    // Store in global registry (we'll update refs within it later)
    extractedDefs[globalName] = defSchema;
  }

  // Remove $defs from the schema
  const { $defs: _$defs, ...rest } = schema;

  // Update all $refs in the schema
  updateRefs(rest, defMapping);

  // Also update refs within the extracted defs themselves (for nested recursion)
  for (const defSchema of Object.values(defMapping)) {
    updateRefs(extractedDefs[defSchema], defMapping);
  }

  return rest;
}

/**
 * Converts a Zod schema to JSON Schema using Zod 4's native toJSONSchema.
 *
 * @remarks
 * Uses Zod 4's native `z.toJSONSchema()` function which properly handles
 * recursive schemas with z.lazy() and works with @hono/zod-openapi extensions.
 * Also extracts inline $defs and moves them to global components/schemas.
 *
 * @param schema - Zod schema to convert
 * @param baseName - Base name for generating unique schema names for extracted $defs
 * @returns JSON Schema object suitable for OpenAPI 3.1
 */
function zodToJsonSchema(schema: unknown, baseName = 'Schema'): Record<string, unknown> {
  try {
    // Use Zod 4's native toJSONSchema for proper @hono/zod-openapi compatibility
    const jsonSchema = z.toJSONSchema(schema as z.ZodType);

    // Remove $schema property as it's not needed in OpenAPI
    const { $schema: _$schema, ...rest } = jsonSchema as Record<string, unknown>;

    // Extract and move $defs to global registry
    return extractAndMoveDefs(rest, baseName);
  } catch (err) {
    // Handle z.void() and other non-representable schemas
    // by returning an empty object schema
    if (err instanceof Error && err.message.includes('cannot be represented')) {
      return { type: 'object', properties: {} };
    }
    throw err;
  }
}

/**
 * Generates OpenAPI 3.1 specification from registered endpoints.
 *
 * @returns OpenAPI specification object
 *
 * @public
 */
export function generateOpenAPISpec(): OpenAPISpec {
  // Reset global state for each generation
  extractedDefs = {};
  schemaCounter = 0;

  const paths: Record<string, unknown> = {};

  // Generate paths from XRPC endpoints
  for (const endpoint of allXRPCEndpoints) {
    const path = `/xrpc/${endpoint.method}`;
    const method = endpoint.type === 'query' ? 'get' : 'post';

    // Extract tag from method namespace
    const parts = (endpoint.method as string).split('.');
    const tag = parts.length >= 3 ? parts[2] : 'other';

    // Create meaningful base name from endpoint method for schema naming
    const baseName = (endpoint.method as string).replace(/\./g, '_');

    paths[path] = {
      [method]: {
        operationId: baseName,
        summary: endpoint.description,
        tags: [tag],
        parameters:
          method === 'get'
            ? generateQueryParameters(endpoint.inputSchema, `${baseName}_input`)
            : undefined,
        requestBody:
          method === 'post'
            ? {
                required: true,
                content: {
                  'application/json': {
                    schema: zodToJsonSchema(endpoint.inputSchema, `${baseName}_input`),
                  },
                },
              }
            : undefined,
        responses: {
          200: {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: zodToJsonSchema(endpoint.outputSchema, `${baseName}_output`),
              },
            },
          },
          400: {
            description: 'Bad Request - Validation error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          429: {
            description: 'Too Many Requests - Rate limit exceeded',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          500: {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
        },
      },
    };
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
      responses: {
        200: { description: 'Search results' },
      },
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
      responses: {
        200: { description: 'Service is alive' },
      },
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
      { name: 'eprint', description: 'Eprint operations' },
      { name: 'graph', description: 'Knowledge graph operations' },
      { name: 'metrics', description: 'Metrics and trending' },
      { name: 'eprints', description: 'REST eprint endpoints' },
      { name: 'health', description: 'Health check endpoints' },
    ],
    paths,
    components: {
      schemas: {
        // Include extracted $defs from recursive schemas
        ...extractedDefs,
        // Standard error response schema
        ErrorResponse: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                requestId: { type: 'string' },
                field: { type: 'string' },
                retryAfter: { type: 'integer' },
              },
              required: ['code', 'message', 'requestId'],
            },
          },
          required: ['error'],
        },
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
 * Generates OpenAPI query parameters from a Zod schema.
 *
 * @param schema - Zod schema
 * @param baseName - Base name for generating unique schema names
 * @returns OpenAPI parameters array
 */
function generateQueryParameters(
  schema: unknown,
  baseName = 'Params'
): { name: string; in: 'query'; required?: boolean; schema: unknown }[] {
  const params: {
    name: string;
    in: 'query';
    required?: boolean;
    schema: unknown;
  }[] = [];

  // Convert the full schema to JSON Schema first
  const jsonSchema = zodToJsonSchema(schema, baseName);

  // Extract properties from the JSON Schema
  const properties = jsonSchema.properties as Record<string, unknown> | undefined;
  const required = (jsonSchema.required as string[]) ?? [];

  if (!properties) return params;

  for (const [key, fieldSchema] of Object.entries(properties)) {
    params.push({
      name: key,
      in: 'query',
      required: required.includes(key),
      schema: fieldSchema,
    });
  }

  return params;
}

/**
 * Registers OpenAPI documentation routes.
 *
 * @param app - Hono application
 *
 * @remarks
 * Registers:
 * - `GET /openapi.json` - OpenAPI specification
 * - `GET /docs` - Swagger UI
 *
 * @public
 */
export function registerOpenAPIRoutes(app: Hono<ChiveEnv>): void {
  // OpenAPI specification endpoint
  app.get(OPENAPI_PATHS.spec, (c) => {
    const spec = generateOpenAPISpec();
    return c.json(spec);
  });

  // Swagger UI
  app.get(
    OPENAPI_PATHS.docs,
    swaggerUI({
      url: OPENAPI_PATHS.spec,
    })
  );
}
