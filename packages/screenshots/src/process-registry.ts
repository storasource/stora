import type { ChildProcess } from 'child_process';

/**
 * Prompt detection patterns for CLI interactions
 * 
 * IMPORTANT: These patterns must be SPECIFIC to avoid false positives on build output.
 * Removed generic patterns like /:\s*$/ and /\?\s*$/ which matched regular log lines.
 * 
 * Only match explicit yes/no prompts and known interactive patterns.
 */
const PROMPT_PATTERNS = [
  /\(y\/n\)\s*$/i,
  /\(Y\/n\)\s*$/i,
  /\(y\/N\)\s*$/i,
  /\(yes\/no\)\s*$/i,
  /Ok to proceed\?\s*\(y\)\s*$/i,
  /\? \(y\/N\)\s*$/i,
  /\? \(Y\/n\)\s*$/i,
  /\[y\/N\]\s*$/i,
  /\[Y\/n\]\s*$/i,
  /\[yes\/no\]\s*$/i,
  /proceed\?\s*\(y\/n\)/i,
  /continue\?\s*\(y\/n\)/i,
  /Password:\s*$/i,
  /password for\s+.*:\s*$/i,
  /Enter passphrase.*:\s*$/i,
  /Enter password.*:\s*$/i,
];

/**
 * Prompt callback function type
 */
export type PromptCallback = (prompt: string) => void;

/**
 * Input resolver function type - resolves with user input
 */
export type InputResolver = (input: string) => void;

/**
 * Registered process entry
 */
interface ProcessEntry {
  process: ChildProcess;
  promptCallback?: PromptCallback;
  inputResolver?: InputResolver;
  pendingPrompt?: string;
  outputBuffer: string;
}

/**
 * Global process registry for managing running child processes
 * Allows external code to:
 * 1. Track running processes by session/collection ID
 * 2. Detect CLI prompts from stdout/stderr
 * 3. Write user input to stdin
 */
class ProcessRegistry {
  private processes: Map<string, ProcessEntry> = new Map();

  /**
   * Register a new child process
   */
  register(
    id: string, 
    process: ChildProcess, 
    promptCallback?: PromptCallback
  ): void {
    const entry: ProcessEntry = {
      process,
      promptCallback,
      outputBuffer: '',
    };

    this.processes.set(id, entry);

    // Set up output monitoring for prompt detection
    if (promptCallback) {
      const handleOutput = (data: Buffer) => {
        const text = data.toString();
        entry.outputBuffer += text;

        // Check if the output ends with a prompt pattern
        const trimmedBuffer = entry.outputBuffer.trim();
        for (const pattern of PROMPT_PATTERNS) {
          if (pattern.test(trimmedBuffer)) {
            // Extract the prompt (last line or relevant portion)
            const lines = trimmedBuffer.split('\n');
            const promptLine = lines[lines.length - 1].trim();
            
            if (promptLine) {
              entry.pendingPrompt = promptLine;
              promptCallback(promptLine);
              entry.outputBuffer = ''; // Reset buffer after detecting prompt
              break;
            }
          }
        }

        // Keep buffer from growing too large (keep last 1000 chars)
        if (entry.outputBuffer.length > 1000) {
          entry.outputBuffer = entry.outputBuffer.slice(-500);
        }
      };

      process.stdout?.on('data', handleOutput);
      process.stderr?.on('data', handleOutput);
    }

    // Clean up on process exit
    process.on('close', () => {
      this.unregister(id);
    });

    process.on('error', () => {
      this.unregister(id);
    });
  }

  /**
   * Unregister a process
   */
  unregister(id: string): void {
    this.processes.delete(id);
  }

  /**
   * Get a registered process
   */
  get(id: string): ProcessEntry | undefined {
    return this.processes.get(id);
  }

  /**
   * Check if a process is registered
   */
  has(id: string): boolean {
    return this.processes.has(id);
  }

  /**
   * Write input to a process's stdin
   */
  writeInput(id: string, input: string): boolean {
    const entry = this.processes.get(id);
    if (!entry || !entry.process.stdin) {
      return false;
    }

    try {
      // Write input followed by newline
      entry.process.stdin.write(input + '\n');
      entry.pendingPrompt = undefined;
      return true;
    } catch (error) {
      console.error(`Failed to write input to process ${id}:`, error);
      return false;
    }
  }

  /**
   * Check if a process has a pending prompt
   */
  hasPendingPrompt(id: string): boolean {
    const entry = this.processes.get(id);
    return !!entry?.pendingPrompt;
  }

  /**
   * Get the pending prompt for a process
   */
  getPendingPrompt(id: string): string | undefined {
    return this.processes.get(id)?.pendingPrompt;
  }

  /**
   * Kill a registered process
   */
  kill(id: string, signal: NodeJS.Signals = 'SIGTERM'): boolean {
    const entry = this.processes.get(id);
    if (!entry) {
      return false;
    }

    try {
      entry.process.kill(signal);
      this.unregister(id);
      return true;
    } catch (error) {
      console.error(`Failed to kill process ${id}:`, error);
      return false;
    }
  }

  /**
   * Get all registered process IDs
   */
  getAll(): string[] {
    return Array.from(this.processes.keys());
  }

  /**
   * Clear all registered processes
   */
  clear(): void {
    for (const id of this.processes.keys()) {
      this.kill(id);
    }
    this.processes.clear();
  }
}

// Export singleton instance
export const processRegistry = new ProcessRegistry();

// Also export the class for testing
export { ProcessRegistry };
