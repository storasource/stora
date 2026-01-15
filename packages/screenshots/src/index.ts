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
 * Wraps the Maestro CLI for mobile UI automation.
 *
 * Provides a programmatic interface to execute Maestro commands on a running
 * iOS Simulator or Android Emulator. Each method generates a temporary YAML
 * flow file and executes it via the Maestro CLI.
 *
 * @example
 * ```typescript
 * const maestro = new MaestroClient('com.example.app');
 * await maestro.launch();
 * await maestro.tap(50, 30);
 * const screenshot = await maestro.screenshot();
 * ```
 */
export class MaestroClient {
  private bundleId: string;

  /**
   * Creates a new Maestro client for the specified app.
   *
   * @param bundleId - The bundle identifier of the target application
   */
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

  /**
   * Launches the target application on the simulator or emulator.
   *
   * @throws Error if the app fails to launch or Maestro command times out
   */
  async launch(): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- launchApp`;
    this.runFlow(yaml);
  }

  /**
   * Taps at the specified screen coordinates.
   *
   * @param x - Horizontal position as a percentage (0-100)
   * @param y - Vertical position as a percentage (0-100)
   * @throws Error if the tap action fails
   */
  async tap(x: number, y: number): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- tapOn:\n    point: ${x}%,${y}%`;
    this.runFlow(yaml);
  }

  /**
   * Taps on an element containing the specified visible text.
   *
   * This is the preferred tap method when the target element has visible text,
   * as it is more reliable than coordinate-based tapping.
   *
   * @param text - The visible text of the element to tap
   * @throws Error if no element with the text is found
   */
  async tapText(text: string): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- tapOn:\n    text: "${text}"`;
    this.runFlow(yaml);
  }

  /**
   * Scrolls down on the current screen to reveal more content.
   *
   * @throws Error if the scroll action fails
   */
  async scroll(): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- scroll`;
    this.runFlow(yaml);
  }

  /**
   * Hides the software keyboard if currently visible.
   *
   * Note: This can be flaky on iOS; consider tapping outside the keyboard area
   * as an alternative.
   *
   * @throws Error if the keyboard cannot be hidden
   */
  async hideKeyboard(): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- hideKeyboard`;
    this.runFlow(yaml);
  }

  /**
   * Navigates back using the Android back button.
   *
   * This is Android-only. For iOS, use [iosBackGesture] or tap a visible
   * back button instead.
   *
   * @throws Error if the back action fails
   */
  async back(): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- back`;
    this.runFlow(yaml);
  }

  /**
   * Performs a swipe gesture from one point to another.
   *
   * Useful for dismissing sheets, navigating carousels, or drawing gestures.
   *
   * @param startX - Starting horizontal position as a percentage (0-100)
   * @param startY - Starting vertical position as a percentage (0-100)
   * @param endX - Ending horizontal position as a percentage (0-100)
   * @param endY - Ending vertical position as a percentage (0-100)
   * @throws Error if the swipe action fails
   */
  async swipe(startX: number, startY: number, endX: number, endY: number): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- swipe:\n    start: "${startX}%, ${startY}%"\n    end: "${endX}%, ${endY}%"`;
    this.runFlow(yaml);
  }

  /**
   * Performs a double-tap gesture at the specified coordinates.
   *
   * @param x - Horizontal position as a percentage (0-100)
   * @param y - Vertical position as a percentage (0-100)
   * @throws Error if the double-tap action fails
   */
  async doubleTap(x: number, y: number): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- doubleTapOn:\n    point: ${x}%,${y}%`;
    this.runFlow(yaml);
  }

  /**
   * Performs a long press gesture at the specified coordinates.
   *
   * @param x - Horizontal position as a percentage (0-100)
   * @param y - Vertical position as a percentage (0-100)
   * @throws Error if the long press action fails
   */
  async longPress(x: number, y: number): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- longPressOn:\n    point: ${x}%,${y}%`;
    this.runFlow(yaml);
  }

  /**
   * Performs a long press gesture on an element with the specified text.
   *
   * @param text - The visible text of the element to long press
   * @throws Error if no element with the text is found
   */
  async longPressText(text: string): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- longPressOn:\n    text: "${text}"`;
    this.runFlow(yaml);
  }

  /**
   * Types text into the currently focused input field.
   *
   * @param text - The text to input
   * @throws Error if no input field is focused or typing fails
   */
  async inputText(text: string): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- inputText: "${text}"`;
    this.runFlow(yaml);
  }

  /**
   * Erases characters from the currently focused input field.
   *
   * @param chars - Number of characters to erase (default: 50)
   * @throws Error if no input field is focused or erasing fails
   */
  async eraseText(chars: number = 50): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- eraseText: ${chars}`;
    this.runFlow(yaml);
  }

  /**
   * Opens a URL or deep link in the app.
   *
   * @param url - The URL or deep link to open
   * @throws Error if the link cannot be opened
   */
  async openLink(url: string): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- openLink: ${url}`;
    this.runFlow(yaml);
  }

  /**
   * Presses a special key on the device.
   *
   * Supported keys include: enter, home, backspace, volume up, volume down,
   * lock, tab. Note: back and power are Android-only.
   *
   * @param key - The key to press
   * @throws Error if the key press fails
   */
  async pressKey(key: string): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- pressKey: ${key}`;
    this.runFlow(yaml);
  }

  /**
   * Waits for animations to complete before proceeding.
   *
   * @param timeout - Maximum time to wait in milliseconds (default: 3000)
   * @throws Error if the wait times out
   */
  async waitForAnimation(timeout: number = 3000): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- waitForAnimationToEnd:\n    timeout: ${timeout}`;
    this.runFlow(yaml);
  }

  /**
   * Performs an iOS-style back gesture by swiping from the left edge.
   *
   * Use this as an alternative to [back] on iOS devices, which do not
   * support the Android back button.
   *
   * @throws Error if the swipe gesture fails
   */
  async iosBackGesture(): Promise<void> {
    const yaml = `appId: ${this.bundleId}\n---\n- swipe:\n    start: "1%, 50%"\n    end: "80%, 50%"`;
    this.runFlow(yaml);
  }

  /**
   * Captures a screenshot of the current screen.
   *
   * Returns the screenshot as a base64-encoded PNG string. Optionally saves
   * a copy to the specified output directory for debugging purposes.
   *
   * @param outputDir - Optional directory to save a copy of the screenshot
   * @param stepNumber - Optional step number for naming the saved file
   * @returns A promise resolving to the base64-encoded PNG image
   * @throws Error if the screenshot capture fails
   */
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

  /**
   * Retrieves the current UI element hierarchy from the screen.
   *
   * Returns a JSON object representing the tree structure of all visible
   * UI elements, including their text, bounds, and accessibility properties.
   * Used by the AI agent to understand screen content and make decisions.
   *
   * @returns A promise resolving to the UI hierarchy as a JSON object
   * @throws Error if the hierarchy retrieval fails
   */
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
 * Manages screenshot storage with deduplication.
 *
 * Handles saving captured screenshots to disk while avoiding duplicates
 * using MD5 hash comparison. Maintains an index of all saved screenshots
 * for retrieval after the capture session completes.
 *
 * @example
 * ```typescript
 * const manager = new ScreenshotManager('./screenshots');
 * if (!manager.isDuplicate(base64Image, hierarchy)) {
 *   const path = manager.save(base64Image, hierarchy);
 * }
 * ```
 */
export class ScreenshotManager {
  private screenshots: Array<{ path: string; hash: string; screenHash: string }> = [];
  private outputDir: string;

  /**
   * Creates a new screenshot manager.
   *
   * Creates the output directory if it does not exist.
   *
   * @param outputDir - Directory path where screenshots will be saved
   */
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

  /**
   * Checks whether a screenshot is a duplicate of one already saved.
   *
   * Uses MD5 hash comparison of the image content to detect exact duplicates.
   *
   * @param screenshot - Base64-encoded PNG image to check
   * @param _hierarchy - UI hierarchy (currently unused, reserved for future use)
   * @returns True if the screenshot is a duplicate, false otherwise
   */
  isDuplicate(screenshot: string, _hierarchy: unknown): boolean {
    const imageHash = this.hashImage(screenshot);
    return this.screenshots.some((s) => s.hash === imageHash);
  }

  /**
   * Saves a screenshot to the output directory.
   *
   * Writes the image to disk with an incrementing filename and records
   * metadata for deduplication and retrieval.
   *
   * @param screenshot - Base64-encoded PNG image to save
   * @param hierarchy - UI hierarchy for computing the screen hash
   * @returns The file path where the screenshot was saved
   */
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

  /**
   * Returns the number of screenshots saved so far.
   *
   * @returns The count of saved screenshots
   */
  count(): number {
    return this.screenshots.length;
  }

  /**
   * Returns all saved screenshot file paths.
   *
   * @returns An array of file paths to the saved screenshots
   */
  getAll(): string[] {
    return this.screenshots.map((s) => s.path);
  }
}

/**
 * AI-powered vision agent for autonomous app exploration.
 *
 * Analyzes screenshots using Google Gemini to decide what actions to take
 * for capturing high-quality App Store screenshots. Maintains conversation
 * history for context-aware decision making across multiple steps.
 *
 * @example
 * ```typescript
 * const agent = new VisionAgent(apiKey);
 * const action = await agent.decide(screenshot, hierarchy, context);
 * // action.action = 'tap', action.params = { x: 50, y: 30 }
 * ```
 */
export class VisionAgent {
  private google: ReturnType<typeof createGoogleGenerativeAI>;
  private conversationHistory: ModelMessage[] = [];
  private model: string;
  private maxScreenshots: number;

  /**
   * Creates a new vision agent.
   *
   * @param apiKey - Google AI API key for Gemini access
   * @param model - Model identifier to use (default: gemini-2.0-flash)
   * @param maxScreenshots - Target number of screenshots to inform the agent
   */
  constructor(apiKey: string, model: string = 'gemini-2.0-flash', maxScreenshots: number = 10) {
    this.google = createGoogleGenerativeAI({ apiKey });
    this.model = model;
    this.maxScreenshots = maxScreenshots;
  }

  /**
   * Analyzes the current screen and decides the next action to take.
   *
   * Sends the screenshot to Google Gemini for vision analysis along with
   * contextual information about the exploration state. Returns a structured
   * action decision including the action type, parameters, and reasoning.
   *
   * @param screenshot - Base64-encoded PNG of the current screen
   * @param hierarchy - UI element hierarchy for context
   * @param context - Current exploration state including screenshots taken
   * @param context.screenshotsTaken - Number of screenshots captured so far
   * @param context.screenHistory - Hashes of previously visited screens
   * @param context.lastActions - Recent actions taken for context
   * @param context.stuckCount - How many times the same screen was visited
   * @returns A promise resolving to the agent's action decision
   * @throws Error if the AI response cannot be parsed or the API call fails
   */
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
 * Captures App Store-ready screenshots using AI-powered exploration.
 *
 * Launches the target app and uses an AI vision agent to autonomously
 * navigate and capture screenshots of interesting content. The agent
 * avoids empty states, loading screens, and duplicate captures.
 *
 * Requires Maestro CLI to be installed and a running iOS Simulator or
 * Android Emulator with the target app installed.
 *
 * @param options - Configuration options for the capture session
 * @returns A promise resolving to the execution result with captured screenshots
 * @throws Error if the Google API key is not configured
 * @throws Error if the app fails to launch
 *
 * @example
 * ```typescript
 * const result = await captureScreenshots({
 *   bundleId: 'com.example.app',
 *   maxScreenshots: 10,
 *   outputDir: './screenshots',
 * });
 *
 * if (result.success) {
 *   console.log(`Captured ${result.screenshotCount} screenshots`);
 *   result.screenshots.forEach(path => console.log(path));
 * }
 * ```
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
