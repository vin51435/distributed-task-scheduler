import { Injectable, Logger } from '@nestjs/common';
import { JobHandler, JobExecutionPayload, ExecutionResult } from '../interface';

@Injectable()
export class CompressionHandler implements JobHandler {
  readonly type = 'COMPRESSION';
  private readonly logger = new Logger(CompressionHandler.name);

  canHandle(workerType: string): boolean {
    if (!workerType) return false;
    const normalized = workerType.toUpperCase().replace(/^WORKER\./, '');
    return normalized === 'COMPRESSION' || normalized === 'ZIP' || normalized === 'GZIP';
  }

  async execute(
    payloadOrJob: JobExecutionPayload | Record<string, any>,
    jobId?: string,
  ): Promise<ExecutionResult | void> {
    const startTime = Date.now();
    const payload =
      payloadOrJob && 'payload' in payloadOrJob && typeof payloadOrJob.payload === 'object'
        ? payloadOrJob.payload
        : payloadOrJob;
    const id = jobId || ('jobId' in payloadOrJob ? payloadOrJob.jobId : undefined);

    this.logger.log(
      `CompressionHandler compressing resource ${payload?.sourcePath || 'unspecified'}`,
    );

    if (payload?.fail === true) {
      throw new Error(payload.error || 'Compression failed: target file missing');
    }

    return {
      success: true,
      durationMs: Date.now() - startTime,
      output: {
        compressedSize: payload?.size ? Math.floor(payload.size * 0.4) : 1024,
        algorithm: payload?.algorithm || 'gzip',
        outputPath: `/tmp/compressed_${id || Date.now()}.gz`,
      },
    };
  }
}
