/**
 * @stora-sh/screenshots CLI
 *
 * AI-powered agentic screenshot automation for mobile apps
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { captureScreenshots } from './index.js';

const program = new Command();

program
  .name('stora-screenshots')
  .description('AI-powered agentic screenshot automation for mobile apps')
  .version('0.1.0');

program
  .command('capture')
  .description('Capture screenshots using AI-powered exploration')
  .argument('<bundleId>', 'Bundle ID of the app to capture screenshots from')
  .option('--max-steps <n>', 'Maximum exploration steps', '50')
  .option('--max-screenshots <n>', 'Target number of screenshots', '10')
  .option('--output-dir <path>', 'Directory for screenshots', './store-screenshots')
  .option('--save-eval-screens', 'Save evaluation screenshots for debugging')
  .option('--eval-screens-dir <path>', 'Directory for eval screenshots', './eval-screens')
  .option('--model <model>', 'AI model to use', 'gemini-3.0-pro-preview')
  .action(async (bundleId: string, options) => {
    console.log(chalk.bold.blue('\n📸 Stora Screenshots - AI-Powered Capture\n'));

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error(chalk.red('Error: GOOGLE_GENERATIVE_AI_API_KEY environment variable not set'));
      console.log(chalk.gray('Set it with: export GOOGLE_GENERATIVE_AI_API_KEY=your-key\n'));
      process.exit(1);
    }

    console.log(chalk.cyan('Bundle ID:'), bundleId);
    console.log(chalk.cyan('Max steps:'), options.maxSteps);
    console.log(chalk.cyan('Max screenshots:'), options.maxScreenshots);
    console.log(chalk.cyan('Output:'), options.outputDir);
    console.log('');

    const spinner = ora('Starting agentic screenshot capture...').start();

    try {
      const result = await captureScreenshots({
        bundleId,
        maxSteps: parseInt(options.maxSteps, 10),
        maxScreenshots: parseInt(options.maxScreenshots, 10),
        outputDir: options.outputDir,
        saveEvalScreens: options.saveEvalScreens,
        evalScreensDir: options.evalScreensDir,
        model: options.model,
        googleApiKey: apiKey,
      });

      spinner.stop();

      if (result.success) {
        console.log(chalk.green(`\n✅ Capture complete!`));
        console.log(chalk.cyan('Screenshots:'), result.screenshotCount);
        console.log(chalk.cyan('Total steps:'), result.totalSteps);
        console.log(chalk.cyan('Duration:'), `${(result.duration / 1000).toFixed(1)}s`);
        console.log(chalk.cyan('Output:'), options.outputDir);

        if (result.screenshots.length > 0) {
          console.log(chalk.gray('\nFiles:'));
          result.screenshots.forEach((path) => {
            console.log(chalk.gray(`  - ${path}`));
          });
        }

        if (result.errors.length > 0) {
          console.log(chalk.yellow(`\n⚠️  ${result.errors.length} error(s) occurred:`));
          result.errors.slice(0, 5).forEach((error) => {
            console.log(chalk.yellow(`  - ${error}`));
          });
        }
      } else {
        console.log(chalk.red('\n❌ Capture failed'));
        if (result.errors.length > 0) {
          console.log(chalk.red('Errors:'));
          result.errors.forEach((error) => {
            console.log(chalk.red(`  - ${error}`));
          });
        }
        process.exit(1);
      }
    } catch (error: unknown) {
      spinner.stop();
      const err = error as { message?: string };
      console.error(chalk.red(`\n❌ Error: ${err.message || 'Unknown error'}`));
      process.exit(1);
    }
  });

program
  .command('doctor')
  .description('Check if all dependencies are installed')
  .action(async () => {
    console.log(chalk.bold.blue('\n🔍 Stora Screenshots - Dependency Check\n'));

    const checks = [
      {
        name: 'Maestro CLI',
        check: async () => {
          const { execSync } = await import('child_process');
          const output = execSync('maestro --version', { encoding: 'utf-8' });
          return output.trim();
        },
      },
      {
        name: 'Node.js',
        check: async () => process.version,
      },
      {
        name: 'Google AI API Key',
        check: async () => {
          const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
          return key ? 'Set ✓' : 'Not set';
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

program.parse();
