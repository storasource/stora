/**
 * @stora-sh/screenshots
 *
 * AI-powered agentic screenshot automation for mobile apps using Maestro.
 *
 * @example
 * ```typescript
 * import { captureScreenshots } from '@stora-sh/screenshots';
 *
 * const result = await captureScreenshots({
 *   bundleId: 'com.example.app',
 *   maxScreenshots: 10,
 *   outputDir: './screenshots',
 * });
 *
 * console.log(`Captured ${result.screenshotCount} screenshots`);
 * ```
 */

export type {
  ScreenshotterOptions,
  ScreenshotResult,
  AgentAction,
  ExecutionResult,
} from './types.js';

// Re-export the main classes and functions
// The agentic-screenshotter is designed to be run as a script,
// but we can also export its components for programmatic use

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, type ModelMessage } from 'ai';
import { execSync } from 'child_process';
import {
  writeFileSync,
  readFileSync,
  mkdirSync,
  existsSync,
  unlinkSync,
  copyFileSync,
  readdirSync,
  rmdirSync,
} from 'fs';
import { createHash } from 'crypto';
import * as os from 'os';
import * as path from 'path';
import type { ScreenshotterOptions, AgentAction, ExecutionResult } from './types.js';

/**
 * Maestro wrapper for UI automation
 */
export class MaestroClient {
  private bundleId: string;

  constructor(bundleId: string) {
    this.bundleId = bundleId;
  }

  private runFlow(yaml: string): void {
    const flowPath = `/tmp/maestro-flow-${Date.now()}.yaml`;
    writeFileSync(flowPath, yaml);

    try {
      execSync(`maestro test ${flowPath}`, {
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 30000,
      });
    } catch (error: unknown) {
      const err = error as { stdout?: string; stderr?: string; message?: string };
      const output = err.stdout || err.stderr || err.message || 'Unknown error';
      throw new Error(`Maestro command failed: ${output.slice(0, 200)}`);
    }
  }

  async launch(): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- launchApp`;
    this.runFlow(yaml);
  }

  async tap(x: number, y: number): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- tapOn:\n    point: ${x}%,${y}%`;
    this.runFlow(yaml);
  }

  async tapText(text: string): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- tapOn:\n    text: "${text}"`;
    this.runFlow(yaml);
  }

  async scroll(): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- scroll`;
    this.runFlow(yaml);
  }

  async hideKeyboard(): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- hideKeyboard`;
    this.runFlow(yaml);
  }

  async back(): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- back`;
    this.runFlow(yaml);
  }

  async swipe(startX: number, startY: number, endX: number, endY: number): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- swipe:\n    start: "${startX}%, ${startY}%"\n    end: "${endX}%, ${endY}%"`;
    this.runFlow(yaml);
  }

  async doubleTap(x: number, y: number): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- doubleTapOn:\n    point: ${x}%,${y}%`;
    this.runFlow(yaml);
  }

  async longPress(x: number, y: number): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- longPressOn:\n    point: ${x}%,${y}%`;
    this.runFlow(yaml);
  }

  async longPressText(text: string): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- longPressOn:\n    text: "${text}"`;
    this.runFlow(yaml);
  }

  async inputText(text: string): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- inputText: "${text}"`;
    this.runFlow(yaml);
  }

  async eraseText(chars: number = 50): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- eraseText: ${chars}`;
    this.runFlow(yaml);
  }

  async openLink(url: string): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- openLink: ${url}`;
    this.runFlow(yaml);
  }

  async pressKey(key: string): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- pressKey: ${key}`;
    this.runFlow(yaml);
  }

  async waitForAnimation(timeout: number = 3000): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- waitForAnimationToEnd:\n    timeout: ${timeout}`;
    this.runFlow(yaml);
  }

  async iosBackGesture(): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- swipe:\n    start: "1%, 50%"\n    end: "80%, 50%"`;
    this.runFlow(yaml);
  }

  async screenshot(outputDir?: string, stepNumber?: number): Promise<string> {
    const timestamp = Date.now();
    const name = `screen-${timestamp}`;
    const tempDir = path.join(os.tmpdir(), `maestro-eval-${timestamp}`);
    mkdirSync(tempDir, { recursive: true });

    try {
      const yaml = `appId: ${this.bundleId}\n---\n- takeScreenshot: ${name}`;
      const flowPath = path.join(tempDir, 'flow.yaml');
      writeFileSync(flowPath, yaml);

      execSync(`maestro test ${flowPath}`, {
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 15000,
        cwd: tempDir,
      });

      const screenshotPath = path.join(tempDir, `${name}.png`);
      if (!existsSync(screenshotPath)) {
        throw new Error(`Screenshot not found at ${screenshotPath}`);
      }

      const buffer = readFileSync(screenshotPath);

      if (outputDir && stepNumber !== undefined) {
        mkdirSync(outputDir, { recursive: true });
        const evalPath = path.join(
          outputDir,
          `step-${String(stepNumber).padStart(3, '0')}-before.png`
        );
        copyFileSync(screenshotPath, evalPath);
      }

      return buffer.toString('base64');
    } catch (error: unknown) {
      const err = error as { message?: string };
      throw new Error(`Screenshot failed: ${(err.message || 'Unknown error').slice(0, 300)}`);
    } finally {
      try {
        const files = existsSync(tempDir) ? readdirSync(tempDir) : [];
        for (const file of files) {
          unlinkSync(path.join(tempDir, file));
        }
        rmdirSync(tempDir);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  async hierarchy(): Promise<unknown> {
    try {
      const output = execSync('maestro hierarchy', {
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 10000,
      });

      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in hierarchy output');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error: unknown) {
      const err = error as { message?: string };
      throw new Error(`Hierarchy failed: ${err.message || 'Unknown error'}`);
    }
  }
}

/**
 * Screenshot manager for deduplication and storage
 */
export class ScreenshotManager {
  private screenshots: Array<{ path: string; hash: string; screenHash: string }> = [];
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
    mkdirSync(outputDir, { recursive: true });
  }

  private hashImage(base64: string): string {
    return createHash('md5').update(base64).digest('hex');
  }

  private hashHierarchy(node: unknown): string {
    const signature = JSON.stringify({
      elementCount: this.countElements(node),
      texts: this.extractTexts(node).slice(0, 10),
    });
    return createHash('md5').update(signature).digest('hex');
  }

  private countElements(node: unknown): number {
    const n = node as { children?: unknown[] };
    let count = 1;
    if (n.children) {
      for (const child of n.children) {
        count += this.countElements(child);
      }
    }
    return count;
  }

  private extractTexts(node: unknown, texts: string[] = []): string[] {
    const n = node as { text?: string; children?: unknown[] };
    if (n.text && n.text.trim()) {
      texts.push(n.text.trim());
    }
    if (n.children) {
      for (const child of n.children) {
        this.extractTexts(child, texts);
      }
    }
    return texts;
  }

  isDuplicate(screenshot: string, _hierarchy: unknown): boolean {
    const imageHash = this.hashImage(screenshot);
    return this.screenshots.some((s) => s.hash === imageHash);
  }

  save(screenshot: string, hierarchy: unknown): string {
    const imageHash = this.hashImage(screenshot);
    const screenHash = this.hashHierarchy(hierarchy);
    const index = this.screenshots.length + 1;
    const filename = `screenshot-${index}.png`;
    const filepath = path.join(this.outputDir, filename);

    const buffer = Buffer.from(screenshot, 'base64');
    writeFileSync(filepath, buffer);

    this.screenshots.push({ path: filepath, hash: imageHash, screenHash });
    return filepath;
  }

  count(): number {
    return this.screenshots.length;
  }

  getAll(): string[] {
    return this.screenshots.map((s) => s.path);
  }
}

/**
 * Vision agent for AI-powered exploration decisions
 */
export class VisionAgent {
  private google: ReturnType<typeof createGoogleGenerativeAI>;
  private conversationHistory: ModelMessage[] = [];
  private model: string;
  private maxScreenshots: number;

  constructor(apiKey: string, model: string = 'gemini-2.0-flash', maxScreenshots: number = 10) {
    this.google = createGoogleGenerativeAI({ apiKey });
    this.model = model;
    this.maxScreenshots = maxScreenshots;
  }

  async decide(
    screenshot: string,
    hierarchy: unknown,
    context: {
      screenshotsTaken: number;
      screenHistory: string[];
      lastActions: string[];
      stuckCount: number;
    }
  ): Promise<AgentAction> {
    let systemPrompt = `You are controlling a mobile app to capture high-quality screenshots for the App Store.

Your goal: Explore the app and capture screenshots showing INTERESTING CONTENT, not empty states.

AVAILABLE ACTIONS:
- tap <x> <y> - Tap at coordinates (percentages 0-100)
- tapText <text> - Tap element with visible text (PREFERRED when text visible)
- doubleTap <x> <y> - Double-tap at coordinates
- longPress <x> <y> - Long press at coordinates
- scroll - Scroll down to reveal more content
- swipe <startX> <startY> <endX> <endY> - Swipe gesture
- inputText <text> - Type text into focused field
- eraseText [chars] - Erase characters from focused field
- hideKeyboard - Hide software keyboard
- back - Go back (ANDROID-ONLY! On iOS, use swipe or tap Back button)
- pressKey <key> - Press special key
- openLink <url> - Open URL or deep link
- wait - Wait for animations
- screenshot - Capture current screen
- done - Finish exploration

Guidelines:
1. CREATE CONTENT before screenshotting
2. Avoid empty states, loading screens, keyboards, permission dialogs
3. Don't revisit the same screen repeatedly
4. You have ${this.maxScreenshots - context.screenshotsTaken} screenshots remaining

Respond ONLY with JSON:
{
  "action": "...",
  "params": {...},
  "reasoning": "...",
  "shouldScreenshot": false
}`;

    if (context.stuckCount > 2) {
      systemPrompt += `\n\n⚠️ WARNING: You've been on the same screen for ${context.stuckCount} actions. Try a different approach.`;
    }

    const imageBuffer = Buffer.from(screenshot, 'base64');

    const userMessage: ModelMessage = {
      role: 'user',
      content: [
        {
          type: 'image',
          image: imageBuffer,
        },
        {
          type: 'text',
          text: `Current state:
- Screenshots taken: ${context.screenshotsTaken}/${this.maxScreenshots}
- Last 5 actions: ${context.lastActions.slice(-5).join(' → ') || 'none'}

What should I do next?`,
        },
      ],
    };

    if (this.conversationHistory.length > 10) {
      this.conversationHistory = this.conversationHistory.slice(-8);
    }

    this.conversationHistory.push(userMessage);

    const model = this.google(this.model);
    const response = await generateText({
      model,
      system: systemPrompt,
      messages: this.conversationHistory,
      temperature: 0.7,
    });

    const text = response.text.trim();

    this.conversationHistory.push({
      role: 'assistant',
      content: text,
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }

    return JSON.parse(jsonMatch[0]) as AgentAction;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main function to capture screenshots using agentic exploration
 *
 * @param options Configuration options
 * @returns Execution result with screenshot paths and metadata
 */
export async function captureScreenshots(options: ScreenshotterOptions): Promise<ExecutionResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  const config = {
    bundleId: options.bundleId,
    maxScreenshots: options.maxScreenshots ?? 10,
    maxSteps: options.maxSteps ?? 50,
    outputDir: options.outputDir ?? './store-screenshots',
    saveEvalScreens: options.saveEvalScreens ?? false,
    evalScreensDir: options.evalScreensDir ?? './eval-screens',
    googleApiKey:
      options.googleApiKey ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY,
    model: options.model ?? 'gemini-2.0-flash',
  };

  if (!config.googleApiKey) {
    throw new Error(
      'Google API key required. Set GOOGLE_GENERATIVE_AI_API_KEY or pass googleApiKey option.'
    );
  }

  const maestro = new MaestroClient(config.bundleId);
  const agent = new VisionAgent(config.googleApiKey, config.model, config.maxScreenshots);
  const screenshots = new ScreenshotManager(config.outputDir);

  const screenHistory: string[] = [];
  const lastActions: string[] = [];
  let lastScreenHash = '';
  let sameScreenCount = 0;
  let steps = 0;

  // Launch app
  console.log('📱 Launching app...');
  try {
    await maestro.launch();
    console.log('✓ App launched');
  } catch (error: unknown) {
    const err = error as { message?: string };
    throw new Error(`Failed to launch app: ${err.message || 'Unknown error'}`);
  }

  await sleep(3000);

  // Main exploration loop
  while (steps < config.maxSteps && screenshots.count() < config.maxScreenshots) {
    steps++;
    console.log(`\n━━━ Step ${steps}/${config.maxSteps} ━━━`);

    let screenshot: string;
    let hierarchy: unknown;

    console.log('👁️  Observing screen...');
    try {
      screenshot = await maestro.screenshot(
        config.saveEvalScreens ? config.evalScreensDir : undefined,
        steps
      );
      hierarchy = await maestro.hierarchy();
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('❌ Observation failed:', err.message || 'Unknown error');
      errors.push(`Observation failed: ${err.message || 'Unknown error'}`);
      await sleep(2000);
      continue;
    }

    const screenHash = createHash('md5')
      .update(JSON.stringify(hierarchy))
      .digest('hex')
      .slice(0, 8);
    screenHistory.push(screenHash);

    if (screenHash === lastScreenHash) {
      sameScreenCount++;
    } else {
      sameScreenCount = 0;
    }
    lastScreenHash = screenHash;

    if (sameScreenCount > 5) {
      console.log('⚠️  Stuck on same screen for 5 actions, forcing back');
      try {
        await maestro.back();
        lastActions.push('back (stuck)');
        await sleep(1000);
        continue;
      } catch {
        try {
          await maestro.iosBackGesture();
          lastActions.push('iosBack (stuck)');
          await sleep(1000);
          continue;
        } catch {
          console.log('Back failed, ending session');
          break;
        }
      }
    }

    console.log('🧠 AI deciding next action...');
    let decision: AgentAction;
    try {
      decision = await agent.decide(screenshot, hierarchy, {
        screenshotsTaken: screenshots.count(),
        screenHistory,
        lastActions,
        stuckCount: sameScreenCount,
      });
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('❌ AI decision failed:', err.message || 'Unknown error');
      errors.push(`AI decision failed: ${err.message || 'Unknown error'}`);
      await sleep(2000);
      continue;
    }

    console.log(`💭 ${decision.reasoning}`);
    console.log(`🎬 ${decision.action}`, decision.params || '');

    try {
      switch (decision.action) {
        case 'tap':
          await maestro.tap(decision.params!.x as number, decision.params!.y as number);
          lastActions.push(`tap(${decision.params!.x},${decision.params!.y})`);
          await sleep(1500);
          break;
        case 'tapText':
          await maestro.tapText(decision.params!.text as string);
          lastActions.push(`tapText("${decision.params!.text}")`);
          await sleep(1500);
          break;
        case 'scroll':
          await maestro.scroll();
          lastActions.push('scroll');
          await sleep(1000);
          break;
        case 'back':
          try {
            await maestro.back();
          } catch {
            await maestro.iosBackGesture();
          }
          lastActions.push('back');
          await sleep(1000);
          break;
        case 'screenshot':
          if (screenshots.isDuplicate(screenshot, hierarchy)) {
            console.log('⚠️  Duplicate screenshot, skipping');
          } else {
            const savedPath = screenshots.save(screenshot, hierarchy);
            console.log(`📸 Screenshot saved: ${savedPath}`);
          }
          lastActions.push('screenshot');
          break;
        case 'done':
          console.log("✅ AI decided we're done");
          break;
        default:
          // Handle other actions...
          lastActions.push(decision.action);
      }

      if (decision.shouldScreenshot && decision.action !== 'screenshot') {
        const newScreenshot = await maestro.screenshot();
        const newHierarchy = await maestro.hierarchy();
        if (!screenshots.isDuplicate(newScreenshot, newHierarchy)) {
          const savedPath = screenshots.save(newScreenshot, newHierarchy);
          console.log(`📸 Auto-screenshot saved: ${savedPath}`);
        }
      }

      if (decision.action === 'done') break;
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error(`❌ Error: ${err.message || 'Unknown error'}`);
      errors.push(`Action failed: ${err.message || 'Unknown error'}`);
      lastActions.push('error');
      await sleep(1000);
    }
  }

  console.log(`\n✨ Complete! ${screenshots.count()} screenshots saved to ${config.outputDir}`);

  return {
    success: screenshots.count() > 0,
    screenshotCount: screenshots.count(),
    totalSteps: steps,
    screenshots: screenshots.getAll(),
    duration: Date.now() - startTime,
    errors,
  };
}
