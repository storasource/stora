import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import {
  captureScreenshots,
  processRegistry,
  type ExecutionResult,
  type MobilePlatform,
} from '@stora-sh/screenshots';
import { ArtifactUploader } from './uploader.js';

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

/**
 * Callbacks for streaming progress during screenshot capture
 */
export interface ScreenshotJobCallbacks {
  /** Called for progress messages */
  onProgress: (message: string) => void;
  /** Called when a screenshot is captured and uploaded */
  onScreenshot: (url: string, filename: string) => void;
  /** Called when an error occurs */
  onError: (message: string) => void;
  /** Called when the job completes */
  onComplete: (result: ExecutionResult & { uploadedUrls: string[] }) => void;
  /** Called when CLI prompts for user input */
  onPromptRequired: (prompt: string, promptId: string) => void;
}

/**
 * Submit user input for a pending prompt
 */
export function submitPromptInput(sessionId: string, input: string): boolean {
  return processRegistry.writeInput(sessionId, input);
}

/**
 * Handle a screenshot capture job
 *
 * Calls captureScreenshots() with job parameters, streams progress via callbacks,
 * and uploads screenshots to Vercel Blob.
 */
export async function handleScreenshotJob(
  job: ScreenshotJob,
  callbacks: ScreenshotJobCallbacks
): Promise<void> {
  const { onProgress, onScreenshot, onError, onComplete, onPromptRequired } = callbacks;
  const uploader = new ArtifactUploader();
  const tempDir = path.join(os.tmpdir(), `screenshot-job-${job.id}`);
  await fs.ensureDir(tempDir);

  onProgress(`Starting screenshot capture for job ${job.id}`);

  const firstDevice = job.devices[0];
  const simulatorName = firstDevice?.simulatorName;
  const platform = firstDevice?.platform || 'ios';

  onProgress(`Using device: ${simulatorName || 'default'} (${platform})`);

  const onPrompt = (prompt: string) => {
    onPromptRequired(prompt, job.collectionId);
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
