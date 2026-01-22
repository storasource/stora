import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { captureScreenshots } from '@stora-sh/screenshots';

/**
 * Creates and configures the screenshots CLI command.
 *
 * Builds a Commander.js command that accepts a bundle ID and options for
 * controlling the AI-powered screenshot capture process. Validates that
 * the Google AI API key is set before proceeding.
 *
 * Available options:
 * - `--max-steps <n>`: Maximum exploration steps (default: 50)
 * - `--max-screenshots <n>`: Target screenshot count (default: 10)
 * - `--output <path>`: Output directory (default: ./store-screenshots)
 * - `--save-eval`: Save evaluation screenshots for debugging
 * - `--eval-dir <path>`: Evaluation screenshots directory
 * - `--model <model>`: AI model to use (default: gemini-2.0-flash)
 *
 * @returns A configured Commander.js command for screenshot capture
 */
export function createScreenshotsCommand(): Command {
  const cmd = new Command('screenshots')
    .description('AI-powered screenshot automation using Maestro')
    .argument('<bundleId>', 'Bundle ID of the app')
    .option('--max-steps <n>', 'Maximum exploration steps', '50')
    .option('--max-screenshots <n>', 'Target number of screenshots', '10')
    .option('--output <path>', 'Output directory', './store-screenshots')
    .option('--save-eval', 'Save evaluation screenshots for debugging')
    .option('--eval-dir <path>', 'Evaluation screenshots directory', './eval-screens')
    .option('--model <model>', 'AI model to use', 'gemini-2.0-flash')
    .action(async (bundleId: string, options) => {
      console.log(chalk.bold.blue('\n📸 Stora Screenshots\n'));

      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        console.error(chalk.red('Error: GOOGLE_GENERATIVE_AI_API_KEY not set'));
        console.log(chalk.gray('Set it with: export GOOGLE_GENERATIVE_AI_API_KEY=your-key\n'));
        process.exit(1);
      }

      console.log(chalk.cyan('Bundle ID:'), bundleId);
      console.log(chalk.cyan('Max steps:'), options.maxSteps);
      console.log(chalk.cyan('Max screenshots:'), options.maxScreenshots);
      console.log(chalk.cyan('Output:'), options.output);
      console.log('');

      const spinner = ora('Starting agentic screenshot capture...').start();

      try {
        const result = await captureScreenshots({
          bundleId,
          maxSteps: parseInt(options.maxSteps, 10),
          maxScreenshots: parseInt(options.maxScreenshots, 10),
          outputDir: options.output,
          saveEvalScreens: options.saveEval,
          evalScreensDir: options.evalDir,
          model: options.model,
          googleApiKey: apiKey,
        });

        spinner.stop();

        if (result.success) {
          console.log(chalk.green('\n✅ Capture complete!'));
          console.log(chalk.cyan('Screenshots:'), result.screenshotCount);
          console.log(chalk.cyan('Total steps:'), result.totalSteps);
          console.log(chalk.cyan('Duration:'), `${(result.duration / 1000).toFixed(1)}s`);

          if (result.screenshots.length > 0) {
            console.log(chalk.gray('\nFiles:'));
            result.screenshots.forEach((path) => {
              console.log(chalk.gray(`  - ${path}`));
            });
          }
        } else {
          console.log(chalk.red('\n❌ Capture failed'));
          process.exit(1);
        }
      } catch (error: unknown) {
        spinner.stop();
        const err = error as { message?: string };
        console.error(chalk.red(`\n❌ Error: ${err.message || 'Unknown error'}`));
        process.exit(1);
      }
    });

  return cmd;
}
