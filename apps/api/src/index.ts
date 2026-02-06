import 'dotenv/config';
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
app.use(express.json());

app.post('/jobs', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (token !== ORCHESTRATOR_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (runners.size === 0) {
    console.warn(chalk.yellow('[API] Job rejected: No runners connected'));
    return res.status(503).json({ error: 'No runners available' });
  }

  const jobPayload = req.body;
  console.log(chalk.magenta(`[HTTP] Triggering screenshot job...`));
  console.log(chalk.magenta(`[HTTP] Received payload:`, JSON.stringify(jobPayload, null, 2)));

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
     useV2Flow: jobPayload.useV2Flow ?? true,
   };

  try {
    await addScreenshotJob(jobData);
    // Broadcast queued event so clients (via socket) know about it
    io.emit('job_queued', { jobId: jobData.id });
    res.json({ jobId: jobData.id });
  } catch (err) {
    const error = err as Error;
    console.error(chalk.red(`[API] Failed to queue job: ${error.message}`));
    res.status(500).json({ error: 'Failed to queue job' });
  }
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 60000,
  transports: ['websocket', 'polling'],
});

const runners = new Map<string, string>();
const jobToRunner = new Map<string, string>();

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

const worker = createScreenshotWorker(async (job: Job<ScreenshotJobData>) => {
  const runnerSocketId = getFirstAvailableRunner();
  
  if (!runnerSocketId) {
    throw new Error('No runners available');
  }
  
  setJobState(job.data.id, 'assigned');
  
  io.emit('job_update', { 
    jobId: job.data.id, 
    status: 'assigned',
    message: 'Found available runner, dispatching job...' 
  });
  
  try {
    await io.to(runnerSocketId).timeout(10000).emitWithAck('run_job', job.data);
    setJobState(job.data.id, 'running');
  } catch (e) {
    const err = e as Error;
    console.error(chalk.red(`[Worker] Runner failed to acknowledge job: ${err.message}`));
    
    io.emit('job_error', { 
      jobId: job.data.id, 
      error: 'Runner failed to accept job (timeout). Please try again or restart the runner.' 
    });
    
    throw new Error('Runner acknowledgement timeout');
  }
});

worker.on('failed', (job, err) => {
  if (job) {
    io.emit('job_error', { 
      jobId: job.data.id, 
      error: err.message || 'Job failed' 
    });
    io.emit('job_complete', {
      jobId: job.data.id,
      status: 'failed',
      error: err.message
    });
  }
});

worker.on('completed', (job) => {
  // We rely on the runner to send the explicit 'job_complete' event with artifacts,
  // but we can send a backup status update here if needed.
  // For now, let's just log.
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
         jobToRunner.delete(data.jobId);
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

    socket.on('job_prompt_required', (data: { 
      jobId: string; 
      promptId: string; 
      prompt: string; 
      timestamp: number 
    }) => {
      console.log(chalk.yellow(`[Event] job_prompt_required for job ${data.jobId}`));
      jobToRunner.set(data.jobId, socket.id);
      io.emit('job_prompt_required', {
        jobId: data.jobId,
        promptId: data.promptId,
        promptType: 'input',
        message: data.prompt,
        options: [],
      });
    });

    socket.on('job_error', (data) => {
      console.log(chalk.red(`[Event] job_error: ${data.error}`));
      io.emit('job_error', data);
    });

  } else {
    console.log(chalk.blue(`[Client] Connected: ${socket.id}`));
    
    // Debug: Log ALL incoming events
    socket.onAny((eventName, ...args) => {
      console.log(chalk.yellow(`[Debug] Received event '${eventName}' from ${socket.id}`));
    });
    
    console.log(chalk.blue(`[Client] Registering trigger_screenshot_job listener for ${socket.id}`));
    socket.on('trigger_screenshot_job', async (jobPayload) => {
        console.log(chalk.magenta(`[Client] Triggering screenshot job...`));
        console.log(chalk.magenta(`[Client] Received payload:`, JSON.stringify(jobPayload, null, 2)));
        
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
          useV2Flow: jobPayload.useV2Flow,
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

    socket.on('job_prompt_response', (data: { jobId: string; promptId?: string; input: string }) => {
      console.log(chalk.cyan(`[Client] Prompt response for job ${data.jobId}`));
      const runnerSocketId = jobToRunner.get(data.jobId);
      if (runnerSocketId) {
        io.to(runnerSocketId).emit('job_prompt_response', {
          jobId: data.jobId,
          promptId: data.promptId || '',
          input: data.input,
        });
      } else {
        console.error(chalk.red(`[Error] No runner found for job ${data.jobId}`));
      }
    });

    // Signal to client that all listeners are ready
    socket.emit('server_ready');
    console.log(chalk.green(`[Client] Server ready signal sent to ${socket.id}`));
  }
});

httpServer.listen(PORT, () => {
  console.log(chalk.cyan(`[API] Server listening on port ${PORT}`));
});
