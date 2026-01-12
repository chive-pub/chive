/**
 * OpenAPI 3.1 specification generator and Swagger UI.
 *
 * @remarks
 * Generates OpenAPI documentation from Zod schemas using Zod 4's
 * native `z.toJSONSchema()` function and provides Swagger UI for
 * interactive API exploration.
 *
 * @packageDocumentation
 * @public
 */

import { swaggerUI } from '@hono/swagger-ui';
import type { Hono } from 'hono';
import { z } from 'zod';

import { SERVER_INFO, OPENAPI_SERVERS, OPENAPI_PATHS } from '../config.js';
import { allXRPCEndpoints } from '../handlers/xrpc/index.js';
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
 * Converts a Zod schema to JSON Schema using Zod 4's native toJSONSchema.
 *
 * @param schema - Zod schema to convert
 * @returns JSON Schema object suitable for OpenAPI 3.1
 */
function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  try {
    const jsonSchema = z.toJSONSchema(schema);

    // Remove $schema property as it's not needed in OpenAPI
    const { $schema: _$schema, ...rest } = jsonSchema as Record<string, unknown>;
    return rest;
  } catch (err) {
    // Handle z.void() and other non-representable schemas
    // by returning an empty object schema
    if (err instanceof Error && err.message.includes('cannot be represented in JSON Schema')) {
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
  const paths: Record<string, unknown> = {};

  // Generate paths from XRPC endpoints
  for (const endpoint of allXRPCEndpoints) {
    const path = `/xrpc/${endpoint.method}`;
    const method = endpoint.type === 'query' ? 'get' : 'post';

    // Extract tag from method namespace
    const parts = (endpoint.method as string).split('.');
    const tag = parts.length >= 3 ? parts[2] : 'other';

    paths[path] = {
      [method]: {
        operationId: (endpoint.method as string).replace(/\./g, '_'),
        summary: endpoint.description,
        tags: [tag],
        parameters: method === 'get' ? generateQueryParameters(endpoint.inputSchema) : undefined,
        requestBody:
          method === 'post'
            ? {
                required: true,
                content: {
                  'application/json': {
                    schema: zodToJsonSchema(endpoint.inputSchema),
                  },
                },
              }
            : undefined,
        responses: {
          200: {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: zodToJsonSchema(endpoint.outputSchema),
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
 * @returns OpenAPI parameters array
 */
function generateQueryParameters(
  schema: z.ZodType
): { name: string; in: 'query'; required?: boolean; schema: unknown }[] {
  const params: {
    name: string;
    in: 'query';
    required?: boolean;
    schema: unknown;
  }[] = [];

  // Convert the full schema to JSON Schema first
  const jsonSchema = zodToJsonSchema(schema);

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
