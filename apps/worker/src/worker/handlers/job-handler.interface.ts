export interface JobHandler {
  /**
   * Unique identifier or worker type handled by this class (e.g. 'EMAIL', 'WEBHOOK', 'NOOP').
   */
  readonly type: string;

  /**
   * Executes the job payload asynchronously.
   * @param payload The job payload dictionary.
   * @param jobId Optional unique job ID for downstream idempotency keys.
   */
  execute(payload: Record<string, any>, jobId?: string): Promise<void>;
}
