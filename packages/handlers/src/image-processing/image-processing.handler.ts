import { Injectable, Logger } from '@nestjs/common';
import { JobHandler, JobExecutionPayload, ExecutionResult } from '../interface';

@Injectable()
export class ImageProcessingHandler implements JobHandler {
  readonly type = 'IMAGE_PROCESSING';
  private readonly logger = new Logger(ImageProcessingHandler.name);

  canHandle(workerType: string): boolean {
    if (!workerType) return false;
    const normalized = workerType.toUpperCase().replace(/^WORKER\./, '');
    return (
      normalized === 'IMAGE_PROCESSING' || normalized === 'RESIZE_IMAGE' || normalized === 'IMAGE'
    );
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

    this.logger.log(`ImageProcessingHandler processing image for job: ${id || 'unknown'}`);

    if (payload?.fail === true) {
      throw new Error(payload.error || 'Image processing failed: corrupted image buffer');
    }

    return {
      success: true,
      durationMs: Date.now() - startTime,
      output: {
        dimensions: { width: payload?.width || 1920, height: payload?.height || 1080 },
        format: payload?.format || 'webp',
        transformedUrl: `https://cdn.scheduler.io/images/${id || Date.now()}.webp`,
      },
    };
  }
}
