import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import chalk from 'chalk';

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow all for dev
    methods: ["GET", "POST"]
  }
});

// Store connected runners
const runners = new Map<string, string>(); // runnerId -> socketId

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

    // --- FORWARDING EVENTS ---
    
    socket.on('job_update', (data) => {
       console.log(chalk.blue(`[Event] job_update: ${data.status}`));
       io.emit('job_update', data);
    });

    socket.on('job_complete', (data) => {
       console.log(chalk.green(`[Event] job_complete: ${data.status}`));
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
    // Client (Frontend)
    console.log(chalk.blue(`[Client] Connected: ${socket.id}`));
    
    socket.on('trigger_job', (jobPayload) => {
        console.log(chalk.magenta(`[Client] Triggering job...`));
        // Pick a runner (simple round-robin or first available)
        const runnerSocketId = runners.values().next().value;
        
        if (!runnerSocketId) {
            console.error(chalk.red('[API] No runners available!'));
            socket.emit('error', { message: 'No runners available' });
            return;
        }

        // Dispatch to runner
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
