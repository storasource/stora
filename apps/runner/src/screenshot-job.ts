import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import { randomUUID } from 'crypto';
import {
  captureScreenshots,
  processRegistry,
  type ExecutionResult,
  type MobilePlatform,
} from '@stora-sh/screenshots';
import { ArtifactUploader } from './uploader.js';

const PROMPT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface PendingPrompt {
  promptId: string;
  resolve: (input: string) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

// Track pending prompts by jobId:promptId
const pendingPrompts = new Map<string, PendingPrompt>();

/**
 * Prompt required event data for Socket.io emission
 */
export interface JobPromptRequiredEvent {
  jobId: string;
  promptId: string;
  prompt: string;
  timestamp: number;
}

/**
 * Prompt response event data from Socket.io
 */
export interface JobPromptResponseEvent {
  jobId: string;
  promptId: string;
  input: string;
}

/**
 * Device configuration for screenshot capture
 */
export interface DeviceConfig {
  id: string;
  simulatorName?: string;
  platform: 'ios' | 'android';
}

/**
 * Screenshot job input parameters
 */
export interface ScreenshotJob {
  id: string;
  collectionId: string;
  projectId: string;
  bundleId: string;
  devices: DeviceConfig[];
  repoUrl?: string;
  googleApiKey: string;
  mobilePlatform?: MobilePlatform;
  autoBuild?: boolean;
}

export interface ScreenshotJobCallbacks {
  onProgress: (message: string) => void;
  onScreenshot: (url: string, filename: string) => void;
  onError: (message: string) => void;
  onComplete: (result: ExecutionResult & { uploadedUrls: string[] }) => void;
  emitPromptRequired: (event: JobPromptRequiredEvent) => void;
}

export function submitPromptInput(sessionId: string, input: string): boolean {
  return processRegistry.writeInput(sessionId, input);
}

export function handlePromptResponse(event: JobPromptResponseEvent): boolean {
  const key = `${event.jobId}:${event.promptId}`;
  const pending = pendingPrompts.get(key);

  if (!pending) {
    return false;
  }

  clearTimeout(pending.timeout);
  pendingPrompts.delete(key);

  const success = processRegistry.writeInput(event.jobId, event.input);
  if (success) {
    pending.resolve(event.input);
  } else {
    pending.reject(new Error('Failed to write input to process'));
  }

  return success;
}

export async function handleScreenshotJob(
  job: ScreenshotJob,
  callbacks: ScreenshotJobCallbacks
): Promise<void> {
  const { onProgress, onScreenshot, onError, onComplete, emitPromptRequired } = callbacks;
  const uploader = new ArtifactUploader();
  const tempDir = path.join(os.tmpdir(), `screenshot-job-${job.id}`);
  await fs.ensureDir(tempDir);

  onProgress(`Starting screenshot capture for job ${job.id}`);

  const firstDevice = job.devices[0];
  const simulatorName = firstDevice?.simulatorName;
  const platform = firstDevice?.platform || 'ios';

  onProgress(`Using device: ${simulatorName || 'default'} (${platform})`);

   const onPrompt = (prompt: string) => {
     const promptId = randomUUID();
     const key = `${job.id}:${promptId}`;

    const promptPromise = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingPrompts.delete(key);
        reject(new Error('PROMPT_TIMEOUT'));
      }, PROMPT_TIMEOUT_MS);

      pendingPrompts.set(key, { promptId, resolve, reject, timeout });
    });

     emitPromptRequired({
       jobId: job.id,
       promptId,
       prompt,
       timestamp: Date.now(),
     });

    promptPromise.catch((err) => {
      if (err.message === 'PROMPT_TIMEOUT') {
        onError(`Prompt timeout: no response received within 5 minutes`);
      }
    });
  };

  try {
    onProgress('Calling captureScreenshots...');

    const result = await captureScreenshots({
      bundleId: job.bundleId,
      outputDir: tempDir,
      maxScreenshots: 6,
      maxSteps: 35,
      googleApiKey: job.googleApiKey,
      device: simulatorName,
      platform,
      repoUrl: job.repoUrl,
      mobilePlatform: job.mobilePlatform,
      autoBuild: job.autoBuild ?? true,
      sessionId: job.collectionId,
      onPrompt,
    });

    onProgress(`Capture complete: ${result.screenshotCount} screenshots`);

    const uploadedUrls: string[] = [];

    for (const screenshotPath of result.screenshots) {
      try {
        const filename = path.basename(screenshotPath);
        onProgress(`Uploading ${filename}...`);

        const url = await uploader.upload(screenshotPath);
        uploadedUrls.push(url);
        onScreenshot(url, filename);

        onProgress(`Uploaded: ${url}`);
      } catch (uploadError) {
        const errorMessage =
          uploadError instanceof Error ? uploadError.message : 'Unknown upload error';
        onError(`Failed to upload screenshot: ${errorMessage}`);
      }
    }

    for (const error of result.errors) {
      onError(error);
    }

    onComplete({
      ...result,
      uploadedUrls,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    onError(`Screenshot capture failed: ${errorMessage}`);
    onComplete({
      success: false,
      screenshotCount: 0,
      totalSteps: 0,
      screenshots: [],
      duration: 0,
      errors: [errorMessage],
      uploadedUrls: [],
    });
  } finally {
    await fs.remove(tempDir).catch(() => {});
  }
}
