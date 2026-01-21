/**
 * OpenAPI 3.1 specification generator and Swagger UI.
 *
 * @remarks
 * Generates minimal OpenAPI documentation from XRPC methods.
 * Full schema documentation comes from ATProto lexicons.
 *
 * @packageDocumentation
 * @public
 */

import { swaggerUI } from '@hono/swagger-ui';
import type { Hono } from 'hono';

import { SERVER_INFO, OPENAPI_SERVERS, OPENAPI_PATHS } from '../config.js';
import { allXRPCMethods } from '../handlers/xrpc/index.js';
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
 * Generates OpenAPI 3.1 specification from registered endpoints.
 *
 * @remarks
 * Since XRPC methods use lexicon-based validation, this generates minimal
 * OpenAPI documentation. Full schema documentation comes from lexicons.
 *
 * @returns OpenAPI specification object
 *
 * @public
 */
export function generateOpenAPISpec(): OpenAPISpec {
  const paths: Record<string, unknown> = {};

  // Generate paths from XRPC methods
  for (const [nsid, method] of Object.entries(allXRPCMethods)) {
    const path = `/xrpc/${nsid}`;
    const httpMethod = method.type === 'procedure' ? 'post' : 'get';

    // Extract tag from method namespace (e.g., pub.chive.eprint.getSubmission -> eprint)
    const parts = nsid.split('.');
    const tag = parts.length >= 3 ? parts[2] : 'other';

    // Create operation ID from NSID
    const operationId = nsid.replace(/\./g, '_');

    paths[path] = {
      [httpMethod]: {
        operationId,
        summary: `${nsid}`,
        tags: [tag],
        responses: {
          200: {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: { type: 'object' },
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
          401: {
            description: 'Authentication Required',
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
        ...(method.auth === true && {
          security: [{ bearerAuth: [] }],
        }),
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
      { name: 'endorsement', description: 'Endorsement operations' },
      { name: 'review', description: 'Review operations' },
      { name: 'author', description: 'Author operations' },
      { name: 'discovery', description: 'Discovery and enrichment' },
      { name: 'sync', description: 'Sync and indexing operations' },
      { name: 'eprints', description: 'REST eprint endpoints' },
      { name: 'health', description: 'Health check endpoints' },
    ],
    paths,
    components: {
      schemas: {
        // ATProto-compliant flat error response
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
          required: ['error', 'message'],
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
