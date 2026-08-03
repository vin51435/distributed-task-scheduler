import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';

@Injectable()
export class ElasticsearchService implements OnModuleInit {
  private readonly logger = new Logger(ElasticsearchService.name);
  private client!: Client;

  onModuleInit() {
    const node = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';
    this.client = new Client({ node });
    this.logger.log(`Connected to Elasticsearch node: ${node}`);
  }

  async indexLog(logData: Record<string, any>): Promise<void> {
    try {
      await this.client.index({
        index: 'job_logs',
        document: {
          timestamp: new Date().toISOString(),
          ...logData,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to index log in Elasticsearch: ${(error as Error).message}`);
    }
  }

  async indexExecution(executionData: Record<string, any>): Promise<void> {
    try {
      await this.client.index({
        index: 'executions',
        id: executionData.id,
        document: {
          timestamp: new Date().toISOString(),
          ...executionData,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to index execution in Elasticsearch: ${(error as Error).message}`);
    }
  }

  async indexAudit(auditData: Record<string, any>): Promise<void> {
    try {
      await this.client.index({
        index: 'job_audit',
        document: {
          timestamp: new Date().toISOString(),
          ...auditData,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to index audit in Elasticsearch: ${(error as Error).message}`);
    }
  }

  async searchJobHistory(jobId: string): Promise<any> {
    try {
      const result = await this.client.search({
        index: ['job_logs', 'executions', 'job_audit'],
        query: {
          term: { 'jobId.keyword': jobId },
        },
      });
      return result.hits.hits.map((hit) => ({
        index: hit._index,
        source: hit._source,
      }));
    } catch (error) {
      this.logger.error(
        `Error searching Elasticsearch for jobId ${jobId}: ${(error as Error).message}`,
      );
      return [];
    }
  }

  getClient(): Client {
    return this.client;
  }
}
