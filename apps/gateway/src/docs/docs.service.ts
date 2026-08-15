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
    return spec;
  }

  /**
   * Merges all downstream OpenAPI specifications into a single unified specification.
   */
  async getUnifiedSpec(gatewayBaseDoc?: any): Promise<any> {
    const results = await Promise.all(
      this.services.map(async (service) => {
        const spec = await this.fetchServiceSpec(service);
        return { service, spec };
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
      tags: [],
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

    // 1. Merge Gateway local paths (e.g. /health) if provided
    if (gatewayBaseDoc) {
      if (gatewayBaseDoc.tags) {
        unified.tags.push(...gatewayBaseDoc.tags);
      }
      if (gatewayBaseDoc.paths) {
        Object.assign(unified.paths, gatewayBaseDoc.paths);
      }
      if (gatewayBaseDoc.components?.schemas) {
        Object.assign(unified.components.schemas, gatewayBaseDoc.components.schemas);
      }
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

    return unified;
  }
}
