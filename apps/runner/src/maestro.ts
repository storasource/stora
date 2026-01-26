import { spawn } from 'child_process';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';

interface MaestroOptions {
  flowFile: string;
  reportDir?: string;
  onLog: (log: string, type: 'stdout' | 'stderr') => void;
}

export class MaestroRunner {
  async run(options: MaestroOptions): Promise<void> {
    const { flowFile, reportDir, onLog } = options;
    
    console.log(chalk.blue(`[Maestro] Starting test: ${flowFile}`));

    // Ensure report dir exists
    if (reportDir) await fs.ensureDir(reportDir);

    const args = ['test', flowFile, '--format=junit'];
    if (reportDir) {
        args.push('--output', path.join(reportDir, 'report.xml'));
        // debug-output stores logs and videos
        args.push('--debug-output', reportDir); 
    }

    return new Promise((resolve, reject) => {
      // Use 'maestroProc' instead of 'process' to avoid shadowing global
      const maestroProc = spawn('maestro', args, {
        env: { ...process.env, FORCE_COLOR: '1' }
      });

      maestroProc.stdout.on('data', (data: Buffer) => {
        const str = data.toString();
        onLog(str, 'stdout');
        process.stdout.write(data);
      });

      maestroProc.stderr.on('data', (data: Buffer) => {
        const str = data.toString();
        onLog(str, 'stderr');
        process.stderr.write(data);
      });

      maestroProc.on('close', (code: number) => {
        if (code === 0) {
          console.log(chalk.green(`[Maestro] Test completed successfully.`));
          resolve();
        } else {
          console.error(chalk.red(`[Maestro] Test failed with code ${code}`));
          reject(new Error(`Maestro exited with code ${code}`));
        }
      });
    });
  }
}
