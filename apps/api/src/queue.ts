import { Queue, Worker, Job } from 'bullmq';
import { redis } from './redis.js';
import chalk from 'chalk';

export interface ScreenshotJobData {
  id: string;
  collectionId: string;
  projectId: string;
  bundleId: string;
  devices: string[];
  repoUrl: string;
  googleApiKey: string;
  mobilePlatform?: string;
  autoBuild?: boolean;
  useV2Flow?: boolean;
}

export type JobState = 'queued' | 'assigned' | 'running' | 'completed' | 'failed';

const jobStates = new Map<string, JobState>();

export const screenshotQueue = new Queue<ScreenshotJobData>('screenshot-jobs', {
  connection: redis,
});

screenshotQueue.on('error', (err: Error) => {
  console.error(chalk.red(`[Queue] Error: ${err.message}`));
});

console.log(chalk.green('[Queue] Connected to Redis'));

export function setJobState(jobId: string, state: JobState): void {
  jobStates.set(jobId, state);
  console.log(chalk.blue(`[Queue] Job ${jobId} state: ${state}`));
}

export function getJobState(jobId: string): JobState | undefined {
  return jobStates.get(jobId);
}

export async function addScreenshotJob(data: ScreenshotJobData): Promise<Job<ScreenshotJobData>> {
  const job = await screenshotQueue.add('screenshot', data, {
    jobId: data.id,
    attempts: 2,
    backoff: { type: 'fixed', delay: 10000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
  setJobState(data.id, 'queued');
  console.log(chalk.magenta(`[Queue] Job added: ${data.id}`));
  return job;
}

export function createScreenshotWorker(
  processor: (job: Job<ScreenshotJobData>) => Promise<void>
): Worker<ScreenshotJobData> {
  const worker = new Worker<ScreenshotJobData>('screenshot-jobs', processor, {
    connection: redis,
    concurrency: 5,
  });

  worker.on('completed', (job) => {
    if (job) {
      setJobState(job.data.id, 'completed');
      console.log(chalk.green(`[Worker] Job completed: ${job.data.id}`));
    }
  });

  worker.on('failed', (job, err) => {
    if (job) {
      setJobState(job.data.id, 'failed');
      console.error(chalk.red(`[Worker] Job failed: ${job.data.id} - ${err.message}`));
    }
  });

  worker.on('error', (err: Error) => {
    console.error(chalk.red(`[Worker] Error: ${err.message}`));
  });

  console.log(chalk.green('[Worker] Screenshot worker started'));
  return worker;
}

export { Job };
