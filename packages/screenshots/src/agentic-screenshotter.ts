#!/usr/bin/env ts-node
/**
 * Standalone Minimal Agentic Screenshot Taker
 * No dependencies on existing code - completely self-contained
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, type ModelMessage } from 'ai';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, mkdirSync, existsSync, unlinkSync, copyFileSync } from 'fs';
import { createHash } from 'crypto';
import * as os from 'os';
import * as path from 'path';

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArgs(): {
  bundleId: string;
  maxSteps: number;
  maxScreenshots: number;
  saveEvalScreens: boolean;
  evalScreensDir: string;
  outputDir: string;
} {
  const args = process.argv.slice(2);
  let bundleId = 'com.example.app';
  let maxSteps = 50;
  let maxScreenshots = 10;
  let saveEvalScreens = false;
  let evalScreensDir = './eval-screens';
  let outputDir = './store-screenshots';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--max-steps' && args[i + 1]) {
      maxSteps = parseInt(args[++i], 10);
    } else if (arg === '--max-screenshots' && args[i + 1]) {
      maxScreenshots = parseInt(args[++i], 10);
    } else if (arg === '--save-eval-screens') {
      saveEvalScreens = true;
    } else if (arg === '--eval-screens-dir' && args[i + 1]) {
      evalScreensDir = args[++i];
    } else if (arg === '--output-dir' && args[i + 1]) {
      outputDir = args[++i];
    } else if (!arg.startsWith('--') && !bundleId.includes('.')) {
      bundleId = arg;
    } else if (!arg.startsWith('--')) {
      bundleId = arg;
    }
  }

  return { bundleId, maxSteps, maxScreenshots, saveEvalScreens, evalScreensDir, outputDir };
}

const ARGS = parseArgs();

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  bundleId: ARGS.bundleId,
  maxScreenshots: ARGS.maxScreenshots,
  maxSteps: ARGS.maxSteps,
  outputDir: ARGS.outputDir,
  saveEvalScreens: ARGS.saveEvalScreens,
  evalScreensDir: ARGS.evalScreensDir,
  googleApiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY!,
  model: 'gemini-3-pro-preview',
};

// ============================================================================
// Maestro Wrapper (minimal, self-contained)
// ============================================================================

class SimpleMaestro {
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
    } catch (error: any) {
      // Extract useful error message
      const output = error.stdout || error.stderr || error.message;
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

  async screenshot(stepNumber?: number): Promise<string> {
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

      if (CONFIG.saveEvalScreens && stepNumber !== undefined) {
        mkdirSync(CONFIG.evalScreensDir, { recursive: true });
        const evalPath = path.join(
          CONFIG.evalScreensDir,
          `step-${String(stepNumber).padStart(3, '0')}-before.png`
        );
        copyFileSync(screenshotPath, evalPath);
      }

      return buffer.toString('base64');
    } catch (error: any) {
      throw new Error(`Screenshot failed: ${error.message.slice(0, 300)}`);
    } finally {
      try {
        const files = existsSync(tempDir) ? require('fs').readdirSync(tempDir) : [];
        for (const file of files) {
          unlinkSync(path.join(tempDir, file));
        }
        require('fs').rmdirSync(tempDir);
      } catch {}
    }
  }

  async hierarchy(): Promise<any> {
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
    } catch (error: any) {
      throw new Error(`Hierarchy failed: ${error.message}`);
    }
  }
}

// ============================================================================
// Vision Agent
// ============================================================================

interface AgentAction {
  action:
    | 'tap'
    | 'tapText'
    | 'doubleTap'
    | 'longPress'
    | 'scroll'
    | 'swipe'
    | 'inputText'
    | 'eraseText'
    | 'hideKeyboard'
    | 'back'
    | 'openLink'
    | 'pressKey'
    | 'screenshot'
    | 'wait'
    | 'done';
  params?: any;
  reasoning: string;
  shouldScreenshot: boolean;
}

class VisionAgent {
  private google: ReturnType<typeof createGoogleGenerativeAI>;
  private conversationHistory: ModelMessage[] = [];

  constructor(apiKey: string) {
    this.google = createGoogleGenerativeAI({ apiKey });
  }

  async decide(
    screenshot: string,
    hierarchy: any,
    context: {
      screenshotsTaken: number;
      screenHistory: string[];
      lastActions: string[];
      stuckCount: number;
    }
  ): Promise<AgentAction> {
    let systemPrompt = `You are controlling a mobile app to capture high-quality screenshots for the App Store.

Your goal: Explore the app and capture screenshots showing INTERESTING CONTENT, not empty states.

AVAILABLE ACTIONS (with Maestro command mapping):

TAPPING:
- tap <x> <y> - Tap at coordinates (percentages 0-100). Maps to: tapOn point
- tapText <text> - Tap element with visible text. Maps to: tapOn text (PREFERRED when text visible)
- doubleTap <x> <y> - Double-tap at coordinates. Maps to: doubleTapOn
- longPress <x> <y> - Long press at coordinates. Maps to: longPressOn

GESTURES:
- scroll - Scroll down to reveal more content. Maps to: scroll
- swipe <startX> <startY> <endX> <endY> - Swipe gesture (for drawing, dismissing sheets, page navigation). Coordinates are percentages.

TEXT INPUT:
- inputText <text> - Type text into focused field. Maps to: inputText
- eraseText [chars] - Erase characters from focused field (default 50). Maps to: eraseText

KEYBOARD & NAVIGATION:
- hideKeyboard - Hide software keyboard. Note: Can be flaky on iOS.
- back - Go back to previous screen. ANDROID-ONLY! On iOS, use swipe from left edge (swipe 1 50 80 50) or tap visible Back/Close button.
- pressKey <key> - Press special key. Keys: enter, home, backspace, volume up, volume down, lock, tab (Android). back/power are Android-only.

UTILITIES:
- openLink <url> - Open URL or deep link in app
- wait - Wait for animations to settle. Maps to: waitForAnimationToEnd

CONTROL:
- screenshot - Capture current screen (only when content is valuable)
- done - Finish exploration (when you have enough screenshots or can't find more content)

PLATFORM NOTES:
- back command is ANDROID-ONLY. On iOS, dismiss modals by: (1) swiping sheet down, (2) tapping Close/Done/X button, (3) swiping from left edge
- hideKeyboard can be flaky on iOS - prefer tapping outside keyboard area
- eraseText can be flaky on iOS - use longPress + "Select All" + inputText as workaround if needed

Guidelines:
1. CREATE CONTENT before screenshotting. Tap buttons to add items, fill forms, navigate to detail views.
2. For drawing/canvas apps: Use swipe to draw strokes before capturing.
3. Avoid empty states, loading screens, keyboards visible, permission dialogs.
4. Don't revisit the same screen repeatedly. Use screenHistory to track where you've been.
5. Take screenshots when you see rich, interesting content that showcases the app.
6. You have ${CONFIG.maxScreenshots - context.screenshotsTaken} screenshots remaining.

Respond ONLY with JSON in this exact format:
{
  "action": "tap|tapText|doubleTap|longPress|scroll|swipe|inputText|eraseText|hideKeyboard|back|pressKey|openLink|wait|screenshot|done",
  "params": {"x": 50, "y": 50} or {"text": "Button"} or {"startX": 20, "startY": 50, "endX": 80, "endY": 50} or {"key": "enter"} or {"url": "myapp://screen"} or {"chars": 10} or {},
  "reasoning": "brief explanation of why you're taking this action",
  "shouldScreenshot": false
}

Set shouldScreenshot to true ONLY when the current screen shows valuable content worth capturing.`;

    // Add stuck warning
    if (context.stuckCount > 2) {
      systemPrompt += `\n\n⚠️ WARNING: You've been on the same screen for ${context.stuckCount} actions. Try a different approach: go back, scroll, or tap a different element.`;
    }

    // Convert base64 screenshot to Buffer for Gemini
    const imageBuffer = Buffer.from(screenshot, 'base64');

    // Simplify hierarchy to reduce token usage
    const simplifiedHierarchy = this.simplifyHierarchy(hierarchy);

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
- Screenshots taken: ${context.screenshotsTaken}/${CONFIG.maxScreenshots}
- Last 5 actions: ${context.lastActions.slice(-5).join(' → ') || 'none'}
- Screen history (last 5): ${context.screenHistory.slice(-5).join(', ') || 'none'}

Interactive elements (with bounds in percentages):
${JSON.stringify(simplifiedHierarchy, null, 2)}

What should I do next?`,
        },
      ],
    };

    // Keep conversation history manageable
    if (this.conversationHistory.length > 10) {
      this.conversationHistory = this.conversationHistory.slice(-8);
    }

    this.conversationHistory.push(userMessage);

    // Call Gemini
    const model = this.google(CONFIG.model);
    const response = await generateText({
      model,
      system: systemPrompt,
      messages: this.conversationHistory,
      temperature: 0.7,
    });

    const text = response.text.trim();

    // Add assistant response to history
    this.conversationHistory.push({
      role: 'assistant',
      content: text,
    });

    // Parse the JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('AI response:', text);
      throw new Error(`No JSON found in response`);
    }

    return JSON.parse(jsonMatch[0]);
  }

  private simplifyHierarchy(node: any, depth = 0): any {
    if (depth > 4) return null; // Limit depth

    const simplified: any = {};

    // Include useful properties
    if (node.bounds) {
      // Convert bounds to percentages (assuming screen is ~400x800)
      const screenWidth = 400;
      const screenHeight = 800;
      simplified.bounds = {
        x: Math.round((node.bounds.x / screenWidth) * 100),
        y: Math.round((node.bounds.y / screenHeight) * 100),
        width: Math.round((node.bounds.width / screenWidth) * 100),
        height: Math.round((node.bounds.height / screenHeight) * 100),
      };
    }

    if (node.text) simplified.text = node.text;
    if (node.accessibilityText) simplified.label = node.accessibilityText;
    if (node.clickable) simplified.clickable = true;
    if (node.resourceId) simplified.id = node.resourceId.split('/').pop();

    // Recursively process children (but limit to clickable/important ones)
    if (node.children && node.children.length > 0) {
      const importantChildren = node.children
        .filter((child: any) => child.clickable || child.text || child.children)
        .map((child: any) => this.simplifyHierarchy(child, depth + 1))
        .filter(Boolean);

      if (importantChildren.length > 0) {
        simplified.children = importantChildren;
      }
    }

    return Object.keys(simplified).length > 0 ? simplified : null;
  }
}

// ============================================================================
// Screenshot Manager
// ============================================================================

class ScreenshotManager {
  private screenshots: Array<{ path: string; hash: string; screenHash: string }> = [];
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
    mkdirSync(outputDir, { recursive: true });
  }

  private hashImage(base64: string): string {
    return createHash('md5').update(base64).digest('hex');
  }

  private hashHierarchy(hierarchy: any): string {
    const signature = JSON.stringify({
      elementCount: this.countElements(hierarchy),
      texts: this.extractTexts(hierarchy).slice(0, 10),
    });
    return createHash('md5').update(signature).digest('hex');
  }

  private countElements(node: any): number {
    let count = 1;
    if (node.children) {
      for (const child of node.children) {
        count += this.countElements(child);
      }
    }
    return count;
  }

  private extractTexts(node: any, texts: string[] = []): string[] {
    if (node.text && node.text.trim()) {
      texts.push(node.text.trim());
    }
    if (node.children) {
      for (const child of node.children) {
        this.extractTexts(child, texts);
      }
    }
    return texts;
  }

  isDuplicate(screenshot: string, hierarchy: any): boolean {
    const imageHash = this.hashImage(screenshot);
    // Only use image hash for duplicate detection - hierarchy hash is too aggressive for canvas/drawing apps
    return this.screenshots.some((s) => s.hash === imageHash);
  }

  save(screenshot: string, hierarchy: any): string {
    const imageHash = this.hashImage(screenshot);
    const screenHash = this.hashHierarchy(hierarchy);
    const index = this.screenshots.length + 1;
    const filename = `screenshot-${index}.png`;
    const path = `${this.outputDir}/${filename}`;

    const buffer = Buffer.from(screenshot, 'base64');
    writeFileSync(path, buffer);

    this.screenshots.push({ path, hash: imageHash, screenHash });
    return path;
  }

  count(): number {
    return this.screenshots.length;
  }
}

// ============================================================================
// Main Executor
// ============================================================================

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
Usage: npx ts-node agentic-screenshotter.ts <bundleId> [options]

Options:
  --max-steps <n>          Maximum exploration steps (default: 50)
  --max-screenshots <n>    Target number of screenshots (default: 10)
  --output-dir <path>      Directory for final screenshots (default: ./store-screenshots)
  --save-eval-screens      Save each evaluation screenshot for debugging
  --eval-screens-dir <path> Directory for eval screenshots (default: ./eval-screens)
  --help, -h               Show this help message

Example:
  npx ts-node agentic-screenshotter.ts com.myapp.bundle --max-steps 30 --save-eval-screens
`);
    process.exit(0);
  }

  console.log(`🚀 Starting agentic screenshot capture for ${CONFIG.bundleId}`);
  console.log(`   Max steps: ${CONFIG.maxSteps}, Target screenshots: ${CONFIG.maxScreenshots}`);
  if (CONFIG.saveEvalScreens) {
    console.log(`   Saving eval screens to: ${CONFIG.evalScreensDir}`);
  }
  console.log('');

  if (!CONFIG.googleApiKey) {
    console.error('❌ Error: GOOGLE_GENERATIVE_AI_API_KEY not set');
    process.exit(1);
  }

  const maestro = new SimpleMaestro(CONFIG.bundleId);
  const agent = new VisionAgent(CONFIG.googleApiKey);
  const screenshots = new ScreenshotManager(CONFIG.outputDir);

  // Track exploration state
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
  } catch (error: any) {
    console.error('❌ Failed to launch app:', error.message);
    process.exit(1);
  }

  await sleep(3000); // Wait for launch

  // Main exploration loop
  while (steps < CONFIG.maxSteps && screenshots.count() < CONFIG.maxScreenshots) {
    steps++;
    console.log(`\n━━━ Step ${steps}/${CONFIG.maxSteps} ━━━`);

    // Observe current state
    console.log('👁️  Observing screen...');
    let screenshot: string;
    let hierarchy: any;

    try {
      screenshot = await maestro.screenshot(steps);
      hierarchy = await maestro.hierarchy();
    } catch (error: any) {
      console.error('❌ Observation failed:', error.message);
      await sleep(2000);
      continue;
    }

    const screenHash = createHash('md5')
      .update(JSON.stringify(hierarchy))
      .digest('hex')
      .slice(0, 8);
    screenHistory.push(screenHash);

    // Check if stuck
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

    // Ask AI what to do
    console.log('🧠 AI deciding next action...');
    let decision: AgentAction;

    try {
      decision = await agent.decide(screenshot, hierarchy, {
        screenshotsTaken: screenshots.count(),
        screenHistory,
        lastActions,
        stuckCount: sameScreenCount,
      });
    } catch (error: any) {
      console.error('❌ AI decision failed:', error.message);
      await sleep(2000);
      continue;
    }

    console.log(`💭 ${decision.reasoning}`);
    console.log(`🎬 ${decision.action}`, decision.params || '');

    // Execute action
    try {
      switch (decision.action) {
        case 'tap':
          await maestro.tap(decision.params.x, decision.params.y);
          lastActions.push(`tap(${decision.params.x},${decision.params.y})`);
          await sleep(1500);
          break;

        case 'tapText':
          await maestro.tapText(decision.params.text);
          lastActions.push(`tapText("${decision.params.text}")`);
          await sleep(1500);
          break;

        case 'scroll':
          await maestro.scroll();
          lastActions.push('scroll');
          await sleep(1000);
          break;

        case 'hideKeyboard':
          await maestro.hideKeyboard();
          lastActions.push('hideKeyboard');
          await sleep(500);
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

        case 'swipe':
          await maestro.swipe(
            decision.params.startX,
            decision.params.startY,
            decision.params.endX,
            decision.params.endY
          );
          lastActions.push(
            `swipe(${decision.params.startX},${decision.params.startY}→${decision.params.endX},${decision.params.endY})`
          );
          await sleep(1000);
          break;

        case 'doubleTap':
          await maestro.doubleTap(decision.params.x, decision.params.y);
          lastActions.push(`doubleTap(${decision.params.x},${decision.params.y})`);
          await sleep(1000);
          break;

        case 'longPress':
          if (decision.params.text) {
            await maestro.longPressText(decision.params.text);
            lastActions.push(`longPress("${decision.params.text}")`);
          } else {
            await maestro.longPress(decision.params.x, decision.params.y);
            lastActions.push(`longPress(${decision.params.x},${decision.params.y})`);
          }
          await sleep(1000);
          break;

        case 'inputText':
          await maestro.inputText(decision.params.text);
          lastActions.push(`inputText("${decision.params.text}")`);
          await sleep(500);
          break;

        case 'eraseText':
          await maestro.eraseText(decision.params.chars || 50);
          lastActions.push(`eraseText(${decision.params.chars || 50})`);
          await sleep(500);
          break;

        case 'openLink':
          await maestro.openLink(decision.params.url);
          lastActions.push(`openLink("${decision.params.url}")`);
          await sleep(2000);
          break;

        case 'pressKey':
          await maestro.pressKey(decision.params.key);
          lastActions.push(`pressKey(${decision.params.key})`);
          await sleep(500);
          break;

        case 'wait':
          await maestro.waitForAnimation(decision.params.timeout || 3000);
          lastActions.push('wait');
          break;

        case 'screenshot':
          if (screenshots.isDuplicate(screenshot, hierarchy)) {
            console.log('⚠️  Duplicate screenshot, skipping');
          } else {
            const path = screenshots.save(screenshot, hierarchy);
            console.log(`📸 Screenshot saved: ${path}`);
          }
          lastActions.push('screenshot');
          break;

        case 'done':
          console.log("✅ AI decided we're done");
          break;

        default:
          console.log(`⚠️  Unknown action: ${decision.action}`);
      }

      // Auto-screenshot if AI said so
      if (decision.shouldScreenshot && decision.action !== 'screenshot') {
        const newScreenshot = await maestro.screenshot();
        const newHierarchy = await maestro.hierarchy();
        if (!screenshots.isDuplicate(newScreenshot, newHierarchy)) {
          const path = screenshots.save(newScreenshot, newHierarchy);
          console.log(`📸 Auto-screenshot saved: ${path}`);
        }
      }

      if (decision.action === 'done') break;
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      lastActions.push('error');
      await sleep(1000);
    }
  }

  console.log(`\n✨ Complete! ${screenshots.count()} screenshots saved to ${CONFIG.outputDir}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
