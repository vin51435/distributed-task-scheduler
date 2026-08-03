export interface JobHandler {
  /**
   * Unique identifier or worker type handled by this class (e.g. 'EMAIL', 'WEBHOOK', 'NOOP').
   */
  readonly type: string;

  /**
   * Executes the job payload asynchronously.
   * @param payload The job payload dictionary.
   */
  execute(payload: Record<string, any>): Promise<void>;
}
