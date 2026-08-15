import { Injectable, Logger, BadGatewayException, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosRequestConfig, Method } from 'axios';
import { Request, Response } from 'express';

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);
  private readonly identityUrl: string;
  private readonly schedulerUrl: string;

  constructor() {
    this.identityUrl = process.env.IDENTITY_SERVICE_URL || 'http://localhost:3001';
    this.schedulerUrl = process.env.SCHEDULER_SERVICE_URL || 'http://localhost:3002';
  }

  /**
   * Resolves target upstream service base URL according to request path.
   */
  public resolveTargetUrl(path: string): string {
    const p = path.toLowerCase();
    if (
      p.startsWith('/api/auth') ||
      p.startsWith('/api/tenants') ||
      p.startsWith('/api/roles') ||
      p.startsWith('/api/users') ||
      p.startsWith('/api/api-keys')
    ) {
      return this.identityUrl;
    }

    // Default routes to Scheduler Service
    return this.schedulerUrl;
  }

  /**
   * Proxies the client HTTP request to the selected upstream service.
   */
  async forward(req: Request, res: Response): Promise<void> {
    const targetBase = this.resolveTargetUrl(req.originalUrl || req.url);
    const targetUrl = `${targetBase}${req.originalUrl || req.url}`;

    this.logger.log(`Proxying [${req.method}] ${req.originalUrl} -> ${targetUrl}`);

    const forwardHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (
        value !== undefined &&
        key.toLowerCase() !== 'host' &&
        key.toLowerCase() !== 'content-length'
      ) {
        forwardHeaders[key] = Array.isArray(value) ? value.join(', ') : value;
      }
    }

    const config: AxiosRequestConfig = {
      method: req.method as Method,
      url: targetUrl,
      headers: forwardHeaders,
      data: ['POST', 'PUT', 'PATCH'].includes(req.method.toUpperCase()) ? req.body : undefined,
      validateStatus: () => true, // Don't throw on non-2xx status codes; proxy them directly
      timeout: 10000,
    };

    try {
      const response = await axios(config);

      // Copy upstream response headers
      for (const [key, value] of Object.entries(response.headers)) {
        if (
          value !== undefined &&
          !['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())
        ) {
          res.setHeader(key, value as any);
        }
      }

      res.status(response.status).send(response.data);
    } catch (err: any) {
      this.logger.error(`Upstream proxy failure to ${targetUrl}: ${err.message}`, err.stack);
      if (err.response) {
        res.status(err.response.status).send(err.response.data);
      } else {
        res.status(HttpStatus.BAD_GATEWAY).json({
          statusCode: HttpStatus.BAD_GATEWAY,
          error: 'Bad Gateway',
          message: `Unable to reach upstream service at ${targetBase}: ${err.message}`,
        });
      }
    }
  }
}
