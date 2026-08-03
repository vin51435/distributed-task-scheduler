export enum QueueName {
  WORKER_EMAIL = 'worker.email',
  WORKER_WEBHOOK = 'worker.webhook',
  WORKER_NOOP = 'worker.noop',
  SCHEDULER_JOBS = 'scheduler.jobs',
}

export enum RoutingKey {
  WORKER_EMAIL = 'worker.email',
  WORKER_WEBHOOK = 'worker.webhook',
  WORKER_NOOP = 'worker.noop',
  JOB_EXECUTE = 'job.execute',
}

export interface QueueTopologyConfig {
  name: string;
  routingKey: string;
  dlqName: string;
}

export const WORKER_QUEUE_CONFIGS: QueueTopologyConfig[] = [
  {
    name: QueueName.WORKER_EMAIL,
    routingKey: RoutingKey.WORKER_EMAIL,
    dlqName: `${QueueName.WORKER_EMAIL}.dlq`,
  },
  {
    name: QueueName.WORKER_WEBHOOK,
    routingKey: RoutingKey.WORKER_WEBHOOK,
    dlqName: `${QueueName.WORKER_WEBHOOK}.dlq`,
  },
  {
    name: QueueName.WORKER_NOOP,
    routingKey: RoutingKey.WORKER_NOOP,
    dlqName: `${QueueName.WORKER_NOOP}.dlq`,
  },
  {
    name: QueueName.SCHEDULER_JOBS,
    routingKey: RoutingKey.JOB_EXECUTE,
    dlqName: `${QueueName.SCHEDULER_JOBS}.dlq`,
  },
];
