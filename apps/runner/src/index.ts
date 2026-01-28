import { SimulatorManager } from './simulator.js';
import { MaestroRunner } from './maestro.js';
import { ArtifactUploader } from './uploader.js';
import { handleScreenshotJob, handlePromptResponse, type ScreenshotJob, type JobPromptResponseEvent } from './screenshot-job.js';
import { io } from 'socket.io-client';
import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';

// --- CONFIG ---
const API_URL = process.env.API_URL || 'http://localhost:3001'; 
const RUNNER_ID = process.env.RUNNER_ID || 'local-mac-runner';
const ORCHESTRATOR_TOKEN = process.env.ORCHESTRATOR_TOKEN;
const WORK_DIR = path.join(process.cwd(), 'temp');

// --- SETUP ---
const socket = io(API_URL, {
  autoConnect: false,
  query: { runnerId: RUNNER_ID, type: 'runner' },
  auth: { token: ORCHESTRATOR_TOKEN }
});

const sim = new SimulatorManager();
const maestro = new MaestroRunner();
const uploader = new ArtifactUploader();

// Global job context to stream logs
let currentJobId: string | null = null;

async function main() {
  console.log(chalk.green(`[Runner] Starting ${RUNNER_ID}...`));
  
  // 1. Local Test Mode
  const args = process.argv.slice(2);
  if (args.length > 0) {
     await runLocalJob(args[0], args[1], null);
     return;
  }

  // 2. Connect to Cloud
  socket.connect();
  
  socket.on('connect', () => {
    console.log(chalk.green(`[Socket] Connected to ${API_URL}`));
  });

  socket.on('disconnect', () => {
      console.log(chalk.yellow(`[Socket] Disconnected`));
    });

  // Handle prompt responses from orchestrator
  socket.on('job_prompt_response', (data: JobPromptResponseEvent) => {
    console.log(chalk.cyan(`[Prompt] Received response for job ${data.jobId}, promptId ${data.promptId}`));
    const success = handlePromptResponse(data);
    if (!success) {
      console.log(chalk.yellow(`[Prompt] No pending prompt found for ${data.jobId}:${data.promptId}`));
    }
  });

  socket.on('run_job', async (job: ScreenshotJob) => {
    console.log(chalk.magenta(`[Job] Received screenshot job: ${job.id}`));
    currentJobId = job.id;
    
    try {
      socket.emit('job_update', { jobId: job.id, status: 'running' });
      
      await handleScreenshotJob(job, {
        onProgress: (message) => {
          socket.emit('job_update', { jobId: job.id, status: 'running', message });
          socket.emit('log', { jobId: job.id, message, type: 'stdout', timestamp: Date.now() });
        },
        onScreenshot: (url, filename) => {
          socket.emit('job_artifact', { 
            jobId: job.id, 
            type: 'screenshot', 
            screenshot: { url, screen: filename, deviceId: job.devices[0]?.id || 'unknown' }
          });
        },
        onError: (message) => {
          socket.emit('job_error', { jobId: job.id, error: message });
        },
        onComplete: (result) => {
          const status = result.success ? 'success' : 'failed';
          socket.emit('job_update', { jobId: job.id, status });
          socket.emit('job_complete', { jobId: job.id, status, ...result });
        },
        emitPromptRequired: (event) => {
          console.log(chalk.yellow(`[Prompt] CLI requires input: ${event.prompt}`));
          socket.emit('job_prompt_required', event);
        }
      });
    } catch (e: any) {
      console.error(chalk.red(`[Job] Failed: ${e.message}`));
      socket.emit('job_update', { jobId: job.id, status: 'failed', error: e.message });
      socket.emit('job_complete', { jobId: job.id, status: 'failed', error: e.message });
    } finally {
      currentJobId = null;
    }
  });
}

async function runLocalJob(appPath: string, flowPath: string, jobId: string | null) {
    console.log(chalk.cyan(`[Local] Running job with App: ${appPath} Flow: ${flowPath}`));
    
    // Boot Simulator
    const udid = await sim.boot('iPhone 16 Pro');
    
    // Install App
    if (appPath.endsWith('.app') || appPath.endsWith('.zip')) {
        await sim.install(udid, appPath);
    } else {
        console.warn(chalk.yellow(`[Local] App path does not look like .app bundle, skipping install (assuming pre-installed)`));
    }

    // Run Maestro
    const timestamp = Date.now();
    const reportDir = path.join(WORK_DIR, `${timestamp}`);
    
    // Clean up previous video if exists
    const videoName = 'session_replay.mp4';
    const videoPath = path.join(process.cwd(), videoName);
    if (await fs.pathExists(videoPath)) {
        await fs.remove(videoPath);
    }

    try {
        await maestro.run({
            flowFile: flowPath,
            reportDir,
            onLog: (msg: string, type: 'stdout' | 'stderr') => {
                if (jobId) {
                    socket.emit('log', { 
                        jobId, 
                        message: msg, 
                        type,
                        timestamp: Date.now() 
                    });
                }
                process.stdout.write(chalk.gray(`[Stream] ${msg}`));
            }
        });
    } catch (e) {
        console.error(chalk.red(`[Maestro] Run failed, but continuing to artifact collection...`));
    }
    
    console.log(chalk.green(`[Local] Done. Checking for video at ${videoPath}`));

    // Find and Upload Video
    let videoUrl = null;
    
    // Wait for file flush
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
        if (await fs.pathExists(videoPath)) {
            console.log(chalk.blue(`[Artifacts] Found video: ${videoPath}`));
            videoUrl = await uploader.upload(videoPath);
            
            // Move it to report dir for safekeeping
            await fs.move(videoPath, path.join(reportDir, videoName));

            if (jobId) {
                socket.emit('job_artifact', { jobId, type: 'video', url: videoUrl });
            }
        } else {
            console.warn(chalk.yellow(`[Artifacts] No video file found at ${videoPath}`));
            
            // Fallback: Check recursive (maybe configuration changed)
            const files = await getFiles(reportDir);
            const fallbackVideo = files.find(f => f.endsWith('.mp4'));
             if (fallbackVideo) {
                console.log(chalk.blue(`[Artifacts] Found video in report dir: ${fallbackVideo}`));
                videoUrl = await uploader.upload(fallbackVideo);
            }
        }
    } catch (err) {
        console.error(chalk.red(`[Artifacts] Error processing artifacts: ${err}`));
    }
    
    return { videoUrl };
}

async function getFiles(dir: string): Promise<string[]> {
  try {
      const dirents = await fs.readdir(dir, { withFileTypes: true });
      const files = await Promise.all(dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? getFiles(res) : res;
      }));
      return Array.prototype.concat(...files);
  } catch (e) {
      return [];
  }
}

main().catch(err => console.error(err));
