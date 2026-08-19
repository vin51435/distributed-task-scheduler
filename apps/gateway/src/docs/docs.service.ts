import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface ServiceSpecConfig {
  key: string;
  name: string;
  url: string;
}

@Injectable()
export class DocsService {
  private readonly logger = new Logger(DocsService.name);
  private gatewayBaseDoc: any = null;

  public setGatewayBaseDoc(doc: any) {
    this.gatewayBaseDoc = doc;
  }

  private readonly services: ServiceSpecConfig[] = [
    {
      key: 'identity',
      name: 'Identity Service',
      url: process.env.IDENTITY_SERVICE_URL || 'http://localhost:3001',
    },
    {
      key: 'scheduler',
      name: 'Scheduler Service',
      url: process.env.SCHEDULER_SERVICE_URL || 'http://localhost:3002',
    },
    {
      key: 'dispatcher',
      name: 'Dispatcher Service',
      url: process.env.DISPATCHER_SERVICE_URL || 'http://localhost:3004',
    },
  ];

  /**
   * Fetches OpenAPI JSON specification from a downstream service.
   */
  async fetchServiceSpec(service: ServiceSpecConfig): Promise<any | null> {
    const targetUrl = `${service.url}/api-json`;
    try {
      const response = await axios.get(targetUrl, { timeout: 2500 });
      return response.data;
    } catch (err: any) {
      this.logger.debug(
        `Could not load OpenAPI spec from ${service.name} (${targetUrl}): ${err.message}`,
      );
      return null;
    }
  }

  /**
   * Returns individual service spec by key.
   */
  async getServiceSpec(serviceKey: string): Promise<any> {
    if (serviceKey.toLowerCase() === 'gateway') {
      if (this.gatewayBaseDoc) {
        return this.gatewayBaseDoc;
      }
    }

    const service = this.services.find((s) => s.key === serviceKey.toLowerCase());
    if (!service) {
      return {
        openapi: '3.0.0',
        info: { title: 'Not Found', version: '1.0.0' },
        paths: {},
      };
    }

    const spec = await this.fetchServiceSpec(service);
    if (!spec) {
      return {
        openapi: '3.0.0',
        info: {
          title: `${service.name} (Offline)`,
          description: `Service at ${service.url} is currently unreachable or starting up.`,
          version: '1.0.0',
        },
        paths: {},
      };
    }

    // Ensure server points to gateway so requests proxy properly
    spec.servers = [{ url: '/', description: 'API Gateway Proxy' }];
    this.sanitizeSpecParameters(spec);
    return spec;
  }

  /**
   * Merges all downstream OpenAPI specifications into a single unified specification.
   */
  async getUnifiedSpec(gatewayBaseDoc?: any): Promise<any> {
    const baseDoc = gatewayBaseDoc || this.gatewayBaseDoc;
    try {
      const results = await Promise.all(
        this.services.map(async (service) => {
          try {
            const spec = await this.fetchServiceSpec(service);
            return { service, spec };
          } catch {
            return { service, spec: null };
          }
        }),
      );

      const unified: any = {
        openapi: '3.0.0',
        info: {
          title: 'Distributed Task Scheduler - Unified API Gateway',
          description:
            'Unified interactive OpenAPI documentation aggregating all downstream microservices (Identity, Scheduler, Dispatcher, Gateway Health). Requests executed here are proxied directly through the Gateway.',
          version: '1.0.0',
        },
        servers: [{ url: '/', description: 'API Gateway' }],
        tags: [
          {
            name: 'health',
            description: 'Gateway and microservice health check endpoints',
          },
        ],
        paths: {},
        components: {
          schemas: {},
          securitySchemes: {
            bearer: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
              description: 'JWT Bearer token issued by /api/auth/login or /api/auth/register',
            },
            'x-api-key': {
              type: 'apiKey',
              name: 'x-api-key',
              in: 'header',
              description: 'Organization API Key for automated machine-to-machine calls',
            },
          },
        },
      };

      // 1. Merge Gateway local paths (e.g. /health, /health/services)
      if (baseDoc) {
        if (baseDoc.tags) {
          for (const tag of baseDoc.tags) {
            if (!unified.tags.some((t: any) => t.name === tag.name)) {
              unified.tags.push(tag);
            }
          }
        }
        if (baseDoc.paths) {
          Object.assign(unified.paths, baseDoc.paths);
        }
        if (baseDoc.components?.schemas) {
          Object.assign(unified.components.schemas, baseDoc.components.schemas);
        }
      }

      // Ensure /health endpoints are always present
      if (!unified.paths['/health']) {
        unified.paths['/health'] = {
          get: {
            tags: ['health'],
            summary: 'Gateway Health check endpoint',
            description: 'Returns health status and uptime of the API Gateway',
            responses: {
              200: {
                description: 'API Gateway is healthy',
              },
            },
          },
        };
      }

      if (!unified.paths['/health/services']) {
        unified.paths['/health/services'] = {
          get: {
            tags: ['health'],
            summary: 'Multi-service Ecosystem Health check',
            description: 'Live connectivity status of all downstream microservices',
            responses: {
              200: {
                description: 'Live connectivity status of all microservices',
              },
            },
          },
        };
      }

      // 2. Merge each downstream service spec
      for (const { service, spec } of results) {
        if (!spec) {
          unified.tags.push({
            name: service.name,
            description: `⚠️ Service currently offline or unreachable at ${service.url}`,
          });
          continue;
        }

        if (Array.isArray(spec.tags)) {
          for (const tag of spec.tags) {
            if (!unified.tags.some((t: any) => t.name === tag.name)) {
              unified.tags.push(tag);
            }
          }
        }

        if (spec.paths) {
          for (const [pathKey, pathItem] of Object.entries(spec.paths)) {
            // Normalize path to ensure leading slash
            const normalizedPath = pathKey.startsWith('/') ? pathKey : `/${pathKey}`;
            unified.paths[normalizedPath] = {
              ...(unified.paths[normalizedPath] || {}),
              ...(pathItem as object),
            };
          }
        }

        if (spec.components?.schemas) {
          Object.assign(unified.components.schemas, spec.components.schemas);
        }
      }

      this.sanitizeSpecParameters(unified);
      return unified;
    } catch (err: any) {
      this.logger.error(`Error generating unified OpenAPI spec: ${err.message}`, err.stack);
      return {
        openapi: '3.0.0',
        info: {
          title: 'Distributed Task Scheduler - Unified API Gateway',
          description: 'API Gateway Swagger Fallback',
          version: '1.0.0',
        },
        servers: [{ url: '/', description: 'API Gateway' }],
        paths: {},
      };
    }
  }

  /**
   * Sanitizes operation parameters so that x-tenant-id is never marked as required in Swagger UI.
   */
  private sanitizeSpecParameters(spec: any) {
    if (!spec || !spec.paths) return;

    for (const pathObj of Object.values(spec.paths) as any[]) {
      for (const operation of Object.values(pathObj) as any[]) {
        if (operation && Array.isArray(operation.parameters)) {
          operation.parameters = operation.parameters.map((param: any) => {
            if (param.name && param.name.toLowerCase() === 'x-tenant-id') {
              return {
                ...param,
                required: false,
                description:
                  param.description ||
                  'Tenant ID (optional: auto-resolved from Bearer token or API key)',
              };
            }
            return param;
          });
        }
      }
    }
  }
}
