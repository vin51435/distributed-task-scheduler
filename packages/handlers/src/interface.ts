export interface JobExecutionPayload {
  jobId?: string;
  workerType?: string;
  payload: Record<string, any>;
  tenantId?: string;
  correlationId?: string;
}

export interface ExecutionResult {
  success: boolean;
  output?: Record<string, any> | string | null;
  error?: string | null;
  retryable?: boolean;
  durationMs?: number;
  metadata?: Record<string, any>;
}

export interface JobHandler {
  /**
   * Unique identifier or standard worker type handled by this class (e.g. 'EMAIL', 'WEBHOOK', 'NOOP').
   */
  readonly type: string;

  /**
   * Determines whether this handler can process the given worker type.
   */
  canHandle(workerType: string): boolean;

  /**
   * Executes the job payload asynchronously.
   */
  execute(
    payloadOrJob: JobExecutionPayload | Record<string, any>,
    jobId?: string,
  ): Promise<ExecutionResult | void>;
}
