import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { analyzeCompliance } from '@stora/compliance';

export function createComplianceCommand(): Command {
  const cmd = new Command('compliance')
    .description('Check app compliance with store guidelines')
    .argument('[path]', 'Path to the app project', '.')
    .option('-p, --platform <platform>', 'Target platform (ios, android, both)', 'both')
    .option('--no-ai', 'Disable AI-powered analysis')
    .option('--strict', 'Use strict checking mode')
    .action(async (projectPath: string, options) => {
      console.log(chalk.bold.blue('\n🔍 Stora Compliance Check\n'));

      const spinner = ora('Analyzing app compliance...').start();

      try {
        const result = await analyzeCompliance(projectPath, {
          platform: options.platform as 'ios' | 'android' | 'both',
          enableAI: options.ai !== false,
          strictness: options.strict ? 'strict' : 'balanced',
        });

        spinner.stop();

        // Display results
        console.log(chalk.bold('\n📊 Compliance Report\n'));
        console.log(chalk.cyan('Score:'), `${result.score}/100`);
        console.log(chalk.cyan('Grade:'), result.grade);
        console.log(
          chalk.cyan('Pass Likelihood:'),
          `${(result.passLikelihood * 100).toFixed(0)}%`
        );

        if (result.issues.length > 0) {
          console.log(chalk.bold('\n⚠️  Issues Found:\n'));

          const criticalIssues = result.issues.filter((i) => i.severity === 'critical');
          const highIssues = result.issues.filter((i) => i.severity === 'high');
          const mediumIssues = result.issues.filter((i) => i.severity === 'medium');
          const lowIssues = result.issues.filter((i) => i.severity === 'low');

          if (criticalIssues.length > 0) {
            console.log(chalk.red.bold(`Critical (${criticalIssues.length}):`));
            criticalIssues.forEach((issue) => {
              console.log(chalk.red(`  ✗ ${issue.title}`));
              console.log(chalk.gray(`    ${issue.message}`));
              if (issue.recommendation) {
                console.log(chalk.yellow(`    → ${issue.recommendation}`));
              }
            });
            console.log('');
          }

          if (highIssues.length > 0) {
            console.log(chalk.yellow.bold(`High (${highIssues.length}):`));
            highIssues.forEach((issue) => {
              console.log(chalk.yellow(`  ⚠ ${issue.title}`));
              console.log(chalk.gray(`    ${issue.message}`));
            });
            console.log('');
          }

          if (mediumIssues.length > 0) {
            console.log(chalk.blue.bold(`Medium (${mediumIssues.length}):`));
            mediumIssues.forEach((issue) => {
              console.log(chalk.blue(`  • ${issue.title}`));
            });
            console.log('');
          }

          if (lowIssues.length > 0) {
            console.log(chalk.gray.bold(`Low (${lowIssues.length}):`));
            lowIssues.forEach((issue) => {
              console.log(chalk.gray(`  ○ ${issue.title}`));
            });
            console.log('');
          }
        } else {
          console.log(chalk.green('\n✅ No compliance issues found!'));
        }

        if (result.aiAnalysis) {
          console.log(chalk.bold('\n🤖 AI Analysis:\n'));
          console.log(chalk.gray(result.aiAnalysis.overallAssessment));
          console.log(
            chalk.cyan('\nEstimated Approval:'),
            `${result.aiAnalysis.estimatedApprovalLikelihood}%`
          );
        }

        console.log('');
      } catch (error: unknown) {
        spinner.stop();
        const err = error as { message?: string };
        console.error(chalk.red(`\n❌ Error: ${err.message || 'Unknown error'}`));
        process.exit(1);
      }
    });

  return cmd;
}
