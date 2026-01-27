import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import chalk from 'chalk';
import './redis.js';
import { 
  addScreenshotJob, 
  createScreenshotWorker, 
  setJobState, 
  ScreenshotJobData,
  Job
} from './queue.js';

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const runners = new Map<string, string>();

const ORCHESTRATOR_TOKEN = process.env.ORCHESTRATOR_TOKEN;

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!ORCHESTRATOR_TOKEN) {
    console.error(chalk.red('[Auth] ORCHESTRATOR_TOKEN not configured'));
    return next(new Error('Server token not configured'));
  }
  
  if (!token) {
    console.error(chalk.red('[Auth] Connection rejected: missing token'));
    return next(new Error('Authentication token required'));
  }
  
  if (token !== ORCHESTRATOR_TOKEN) {
    console.error(chalk.red('[Auth] Connection rejected: invalid token'));
    return next(new Error('Invalid authentication token'));
  }
  
  console.log(chalk.green('[Auth] Token validated successfully'));
  next();
});

function getFirstAvailableRunner(): string | undefined {
  return runners.values().next().value;
}

createScreenshotWorker(async (job: Job<ScreenshotJobData>) => {
  const runnerSocketId = getFirstAvailableRunner();
  
  if (!runnerSocketId) {
    throw new Error('No runners available');
  }
  
  setJobState(job.data.id, 'assigned');
  
  io.to(runnerSocketId).emit('run_job', job.data);
  
  setJobState(job.data.id, 'running');
});

io.on('connection', (socket) => {
  const { type, runnerId } = socket.handshake.query;

  if (type === 'runner') {
    const id = runnerId as string;
    console.log(chalk.green(`[Runner] Connected: ${id} (${socket.id})`));
    runners.set(id, socket.id);
    
    socket.on('disconnect', () => {
      console.log(chalk.yellow(`[Runner] Disconnected: ${id}`));
      runners.delete(id);
    });

    socket.on('job_update', (data) => {
       console.log(chalk.blue(`[Event] job_update: ${data.status}`));
       if (data.jobId && data.status) {
         if (data.status === 'running') {
           setJobState(data.jobId, 'running');
         }
       }
       io.emit('job_update', data);
    });

    socket.on('job_complete', (data) => {
       console.log(chalk.green(`[Event] job_complete: ${data.status}`));
       if (data.jobId) {
         setJobState(data.jobId, data.status === 'success' ? 'completed' : 'failed');
       }
       io.emit('job_complete', data);
    });

    socket.on('job_artifact', (data) => {
       console.log(chalk.cyan(`[Event] job_artifact: ${data.type}`));
       io.emit('job_artifact', data);
    });
    
    socket.on('log', (data) => {
        io.emit('log_stream', data);
    });

  } else {
    console.log(chalk.blue(`[Client] Connected: ${socket.id}`));
    
    socket.on('trigger_screenshot_job', async (jobPayload) => {
        console.log(chalk.magenta(`[Client] Triggering screenshot job...`));
        
        const jobData: ScreenshotJobData = {
          id: jobPayload.id || `job-${Date.now()}`,
          collectionId: jobPayload.collectionId,
          projectId: jobPayload.projectId,
          bundleId: jobPayload.bundleId,
          devices: jobPayload.devices,
          repoUrl: jobPayload.repoUrl,
          googleApiKey: jobPayload.googleApiKey,
          mobilePlatform: jobPayload.mobilePlatform,
          autoBuild: jobPayload.autoBuild,
        };

        try {
          await addScreenshotJob(jobData);
          socket.emit('job_queued', { jobId: jobData.id });
        } catch (err) {
          const error = err as Error;
          console.error(chalk.red(`[API] Failed to queue job: ${error.message}`));
          socket.emit('error', { message: 'Failed to queue job' });
        }
    });

    socket.on('trigger_job', (jobPayload) => {
        console.log(chalk.magenta(`[Client] Triggering job (legacy)...`));
        const runnerSocketId = getFirstAvailableRunner();
        
        if (!runnerSocketId) {
            console.error(chalk.red('[API] No runners available!'));
            socket.emit('error', { message: 'No runners available' });
            return;
        }

        io.to(runnerSocketId).emit('run_job', {
            id: `job-${Date.now()}`,
            ...jobPayload
        });
    });
  }
});

httpServer.listen(PORT, () => {
  console.log(chalk.cyan(`[API] Server listening on port ${PORT}`));
});
