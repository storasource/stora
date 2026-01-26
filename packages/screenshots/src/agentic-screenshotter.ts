#!/usr/bin/env ts-node
/**
 * Standalone Minimal Agentic Screenshot Taker
 * Powered by @stora-sh/mobile-use
 */

import { MobileUse, SCREENSHOT_PROMPT, ScreenshotQualityObserver, type TaskConfig } from 'mobile-use';
import { mkdirSync, writeFileSync } from 'fs';
import * as path from 'path';

function parseArgs(): {
  bundleId: string;
  maxSteps: number;
  maxScreenshots: number;
  outputDir: string;
} {
  const args = process.argv.slice(2);
  let bundleId = 'com.example.app';
  let maxSteps = 50;
  let maxScreenshots = 10;
  let outputDir = './store-screenshots';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--max-steps' && args[i + 1]) {
      maxSteps = parseInt(args[++i], 10);
    } else if (arg === '--max-screenshots' && args[i + 1]) {
      maxScreenshots = parseInt(args[++i], 10);
    } else if (arg === '--output-dir' && args[i + 1]) {
      outputDir = args[++i];
    } else if (!arg.startsWith('--') && !bundleId.includes('.')) {
      bundleId = arg;
    } else if (!arg.startsWith('--')) {
      bundleId = arg;
    }
  }

  return { bundleId, maxSteps, maxScreenshots, outputDir };
}

const ARGS = parseArgs();

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
Usage: npx ts-node agentic-screenshotter.ts <bundleId> [options]

Options:
  --max-steps <n>          Maximum exploration steps (default: 50)
  --max-screenshots <n>    Target number of screenshots (default: 10)
  --output-dir <path>      Directory for final screenshots (default: ./store-screenshots)
  --help, -h               Show this help message

Example:
  npx ts-node agentic-screenshotter.ts com.myapp.bundle --max-steps 30
`);
    process.exit(0);
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: OPENAI_API_KEY not set');
    process.exit(1);
  }

  console.log(`🚀 Starting agentic screenshot capture for ${ARGS.bundleId}`);
  console.log(`   Max steps: ${ARGS.maxSteps}`);
  console.log(`   Output dir: ${ARGS.outputDir}`);
  console.log('');

  const mobileUse = new MobileUse(apiKey);
  
  mkdirSync(ARGS.outputDir, { recursive: true });

  const config: TaskConfig = {
    bundleId: ARGS.bundleId,
    task: `Capture ${ARGS.maxScreenshots} high-quality marketing screenshots. Focus on interesting content and avoiding empty states.`,
    maxSteps: ARGS.maxSteps,
    successCriteria: [`Captured ${ARGS.maxScreenshots} screenshots`],
  };

  try {
    const result = await mobileUse.executeTask(config, {
      promptBuilder: SCREENSHOT_PROMPT,
      observers: [new ScreenshotQualityObserver()]
    });

    console.log('\n✨ Execution Complete');
    console.log(`Status: ${result.success ? 'Success' : 'Failed'}`);
    
    if (result.output && result.output.screenshots) {
      console.log(`\n📸 Saving ${result.output.screenshots.length} screenshots...`);
      
      const qualityScreenshots = new Set<string>();
      if (result.output.observations) {
        result.output.observations
          .filter(o => o.type === 'screenshot')
          .forEach(o => {
          });
      }

      let savedCount = 0;
      result.output.screenshots.forEach((screen, index) => {
        const filename = `screenshot-${index + 1}.png`;
        const filepath = path.join(ARGS.outputDir, filename);
        writeFileSync(filepath, screen.buffer);
        console.log(`   Saved: ${filepath}`);
        savedCount++;
      });
      
      console.log(`\n✅ Saved ${savedCount} screenshots to ${ARGS.outputDir}`);
    }

  } catch (error: any) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
