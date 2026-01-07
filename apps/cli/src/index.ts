/**
 * Stora CLI - The intelligent mobile app deployment tool
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { displayCompactBanner } from './ui/banner.js';
import { createScreenshotsCommand } from './commands/screenshots.js';
import { createComplianceCommand } from './commands/compliance.js';

const program = new Command();

// Display banner
displayCompactBanner();

program
  .name('stora')
  .description('The intelligent mobile app deployment tool')
  .version('0.1.0');

// Add commands
program.addCommand(createScreenshotsCommand());
program.addCommand(createComplianceCommand());

// Doctor command
program
  .command('doctor')
  .description('Check if all dependencies are installed')
  .action(async () => {
    console.log(chalk.bold.blue('🔍 Stora Doctor\n'));

    const checks = [
      {
        name: 'Node.js',
        check: async () => process.version,
      },
      {
        name: 'Maestro CLI',
        check: async () => {
          const { execSync } = await import('child_process');
          return execSync('maestro --version', { encoding: 'utf-8' }).trim();
        },
      },
      {
        name: 'Google AI API Key',
        check: async () => {
          const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
          return key ? chalk.green('Set ✓') : chalk.yellow('Not set');
        },
      },
    ];

    for (const { name, check } of checks) {
      try {
        const result = await check();
        console.log(chalk.green('✓'), chalk.white(name + ':'), chalk.gray(result));
      } catch {
        console.log(chalk.red('✗'), chalk.white(name + ':'), chalk.red('Not found'));
      }
    }

    console.log('');
  });

// Global error handler
program.exitOverride();

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    const error = err as { code?: string; message?: string };
    if (error.code !== 'commander.helpDisplayed' && error.code !== 'commander.version') {
      console.error(chalk.red(`\nError: ${error.message || 'Unknown error'}`));
      process.exit(1);
    }
  }
}

main();
