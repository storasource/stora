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
  MobilePlatform,
  EnhancedContext,
} from './types.js';

export { processRegistry, type PromptCallback } from './process-registry.js';
export { parseHierarchy, type ParsedHierarchy, type UIElement, toElementList, toSemanticHTML } from './hierarchy-parser.js';
export { generateSetOfMark, generateColorCodedOverlay, generateBoxesOnly } from './set-of-mark.js';
export { ActionExecutor, createActionExecutor } from './action-executor.js';

// Re-export the main classes and functions
// The agentic-screenshotter is designed to be run as a script,
// but we can also export its components for programmatic use

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
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
import type { ScreenshotterOptions, AgentAction, ExecutionResult, MobilePlatform, EnhancedContext } from './types.js';
import { AppInstaller, ExpoGoRunner, type ExpoGoSession } from './app-installer.js';
import { parseHierarchy, type ParsedHierarchy, toElementList } from './hierarchy-parser.js';
import { generateSetOfMark } from './set-of-mark.js';
import { SimulatorPool } from './simulator-pool.js';

export { AppInstaller, ExpoGoRunner, type ExpoGoSession } from './app-installer.js';

// Create singleton pool instance
const pool = new SimulatorPool({
  maxSize: 5,
  preCreateCount: 2,
  deviceType: 'iPhone 15 Pro',
  cleanupStrategy: 'uninstall'
});

// Initialize pool on first import
pool.initialize().catch(console.error);

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

  async getEnhancedContext(): Promise<{
    screenshot: string;
    annotatedScreenshot: string;
    hierarchy: unknown;
    parsedHierarchy: ParsedHierarchy;
  }> {
    const [screenshot, hierarchy] = await Promise.all([
      this.screenshot(),
      this.hierarchy()
    ]);
    
    const parsed = parseHierarchy(hierarchy);
    const annotated = await generateSetOfMark(screenshot, parsed);
    
    return {
      screenshot,
      annotatedScreenshot: annotated,
      hierarchy,
      parsedHierarchy: parsed,
    };
  }

  async tapElementById(elementId: number, hierarchy: ParsedHierarchy): Promise<void> {
    const element = hierarchy.elements.get(elementId);
    
    if (!element) {
      throw new Error(`Element ${elementId} not found in hierarchy`);
    }

    if (!element.bounds) {
      throw new Error(`Element ${elementId} has no bounds`);
    }

    if (!element.states.clickable) {
      throw new Error(`Element ${elementId} is not clickable`);
    }

    if (!element.states.enabled) {
      throw new Error(`Element ${elementId} is not enabled`);
    }

    const screenWidth = hierarchy.screenBounds?.width || 1080;
    const screenHeight = hierarchy.screenBounds?.height || 1920;
    
    const xPercent = (element.bounds.centerX / screenWidth) * 100;
    const yPercent = (element.bounds.centerY / screenHeight) * 100;

    await this.tap(xPercent, yPercent);
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
interface VisionAgentOptions {
  fallbackModel?: string;
  openaiApiKey?: string;
  lowConfidenceThreshold?: number;
  failureEscalationThreshold?: number;
}

interface VisionDecisionContext {
  screenshot: string;
  annotatedScreenshot: string;
  parsedHierarchy: ParsedHierarchy;
  screenshotsTaken: number;
  screenHistory: string[];
  lastActions: string[];
  stuckCount: number;
  recentErrors: string[];
  consecutiveTapTextFailures: number;
  consecutiveActionFailures: number;
  recentFailureRate: number;
}

const SUPPORTED_AGENT_ACTIONS = new Set<AgentAction['action']>([
  'tap',
  'tapText',
  'tapElementById',
  'tapResourceId',
  'doubleTap',
  'longPress',
  'scroll',
  'swipe',
  'inputText',
  'eraseText',
  'hideKeyboard',
  'back',
  'openLink',
  'pressKey',
  'screenshot',
  'wait',
  'done',
]);

const RISKY_EXPLORATION_ACTIONS = new Set<AgentAction['action']>([
  'tapText',
  'tap',
  'swipe',
  'openLink',
  'inputText',
]);

function normalizeConfidence(value: unknown, fallback: number = 0.75): number {
  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseFloat(value)
        : Number.NaN;

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, numericValue));
}

function normalizeThreshold(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, value));
}

function normalizeFailureThreshold(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

function parseActionFromModelResponse(text: string): AgentAction {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in AI response');
  }

  const parsed = JSON.parse(jsonMatch[0]) as Partial<AgentAction>;
  const action = parsed.action;

  if (!action || !SUPPORTED_AGENT_ACTIONS.has(action)) {
    throw new Error(`Unsupported action from AI response: ${String(action)}`);
  }

  return {
    action,
    params:
      parsed.params && typeof parsed.params === 'object'
        ? (parsed.params as Record<string, unknown>)
        : undefined,
    reasoning:
      typeof parsed.reasoning === 'string' && parsed.reasoning.trim().length > 0
        ? parsed.reasoning
        : 'No reasoning provided',
    shouldScreenshot: Boolean(parsed.shouldScreenshot),
    confidence: normalizeConfidence((parsed as Record<string, unknown>).confidence),
  };
}

export class VisionAgent {
  private google: ReturnType<typeof createGoogleGenerativeAI>;
  private openai: ReturnType<typeof createOpenAI>;
  private conversationHistory: ModelMessage[] = [];
  private primaryModel: string;
  private fallbackModel: string;
  private maxScreenshots: number;
  private lowConfidenceThreshold: number;
  private failureEscalationThreshold: number;
  private openaiConfigured: boolean;
  private warnedMissingOpenAIKey = false;

  constructor(
    apiKey: string,
    model: string = 'gemini-3-flash-preview',
    maxScreenshots: number = 10,
    options: VisionAgentOptions = {}
  ) {
    const resolvedOpenAIKey = options.openaiApiKey || process.env.OPENAI_API_KEY;
    this.google = createGoogleGenerativeAI({ apiKey });
    this.openai = createOpenAI(resolvedOpenAIKey ? { apiKey: resolvedOpenAIKey } : undefined);
    this.primaryModel = model;
    this.fallbackModel = options.fallbackModel || 'gpt-5.2';
    this.maxScreenshots = maxScreenshots;
    this.lowConfidenceThreshold = normalizeThreshold(options.lowConfidenceThreshold, 0.68);
    this.failureEscalationThreshold = normalizeFailureThreshold(
      options.failureEscalationThreshold,
      2
    );
    this.openaiConfigured = Boolean(resolvedOpenAIKey);
  }

  private buildSystemPrompt(context: VisionDecisionContext): string {
    const elementList = toElementList(context.parsedHierarchy, {
      maxElements: 30,
      includeCoordinates: true,
    });

    let systemPrompt = `You are controlling a mobile app to capture high-quality screenshots for the App Store.

Your goal: Explore the app and capture screenshots showing INTERESTING CONTENT, not empty states.

AVAILABLE UI ELEMENTS (numbered boxes visible on screen):
${elementList}

AVAILABLE ACTIONS (in order of reliability):
- tapElementById <id> - Tap element by ID from list above (MOST RELIABLE - prefer this!)
- tapResourceId <resourceId> - Tap by resource ID when available
- tapText <text> - Tap by exact visible text (FALLBACK only if ID/resourceId is unavailable)
- tap <x> <y> - Tap coordinates in percentages 0-100 (LAST RESORT)
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

ACTION STRATEGY:
1. PREFER tapElementById or tapResourceId when possible.
2. Use tapText only when text exactly appears in the element list and prior tapText failures are low.
3. If semantics coverage is low (<35%), prefer element IDs or coordinate taps over text matching.
4. If recent actions failed, switch strategy immediately and avoid repeating the same move.

CRITICAL GUIDELINES:
1. FORMS: When filling forms, you MUST tap "Save", "Add", "Submit", "Done", or "Create" after entering data.
2. NAVIGATION: Look for tab bars at bottom. Common tabs: Home, Search, Profile, Settings.
3. CONTENT FIRST: Create content (add items, fill forms, navigate) BEFORE taking screenshots.
4. AVOID: Empty states, loading screens, keyboards visible, permission dialogs, developer menus.
5. DON'T LOOP: If the same action failed 2+ times, pick a fundamentally different action.
6. You have ${this.maxScreenshots - context.screenshotsTaken} screenshots remaining.

The annotated screenshot shows numbered boxes for interactive elements. Match numbers to the element list above.

Platform: ${context.parsedHierarchy.platform}
Interactive elements: ${context.parsedHierarchy.interactiveElements.length}
Semantics coverage: ${context.parsedHierarchy.semanticsCoverage}%

Respond ONLY with JSON:
{
  "action": "...",
  "params": {...},
  "reasoning": "...",
  "shouldScreenshot": false,
  "confidence": 0.0
}

Set confidence between 0 and 1.
- Use confidence < 0.68 when the target action is uncertain or likely brittle.
- Use confidence >= 0.85 only when the target is clearly grounded by the current hierarchy.`;

    if (context.stuckCount > 2) {
      systemPrompt += `\n\n⚠️ WARNING: You've been on the same screen for ${context.stuckCount} actions. Try a COMPLETELY different approach - navigate to another section or recover to a previous screen.`;
    }

    if (context.consecutiveTapTextFailures > 0) {
      systemPrompt += `\n\n⚠️ IMPORTANT: tapText has failed ${context.consecutiveTapTextFailures} time(s) recently. Prefer tapElementById/tapResourceId. Use coordinates if semantics are weak.`;
    }

    if (context.consecutiveActionFailures > 0) {
      systemPrompt += `\n\n⚠️ RECENT ACTION FAILURES: ${context.consecutiveActionFailures} consecutive failure(s). Do not repeat the same failed action pattern.`;
    }

    if (context.parsedHierarchy.semanticsCoverage < 30) {
      systemPrompt += `\n\n⚠️ LOW SEMANTICS: This app has only ${context.parsedHierarchy.semanticsCoverage}% semantics coverage. Many elements lack proper labels. Rely more on IDs and coordinates when needed.`;
    }

    if (context.recentErrors.length > 0) {
      systemPrompt += `\n\n❌ RECENT ERRORS:\n${context.recentErrors.slice(-3).map((e: string) => `- ${e}`).join('\n')}\nAvoid repeating actions that caused these errors.`;
    }

    return systemPrompt;
  }

  private buildUserMessage(context: VisionDecisionContext): ModelMessage {
    const imageBuffer = Buffer.from(context.annotatedScreenshot, 'base64');

    return {
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
- Recent failure rate (last actions): ${Math.round(context.recentFailureRate * 100)}%

What should I do next?`,
        },
      ],
    };
  }

  private async generateDecision(params: {
    provider: 'google' | 'openai';
    modelId: string;
    systemPrompt: string;
    messages: ModelMessage[];
  }): Promise<{ decision: AgentAction; rawText: string }> {
    const model =
      params.provider === 'google'
        ? this.google(params.modelId)
        : this.openai(params.modelId);

    const response = await generateText({
      model,
      system: params.systemPrompt,
      messages: params.messages,
      temperature: 0.4,
      maxRetries: 2,
    });

    const rawText = response.text.trim();
    const decision = parseActionFromModelResponse(rawText);
    return { decision, rawText };
  }

  private getEscalationReasons(context: VisionDecisionContext, primaryDecision: AgentAction): string[] {
    const reasons: string[] = [];
    const confidence = normalizeConfidence(primaryDecision.confidence);

    if (confidence < this.lowConfidenceThreshold) {
      reasons.push(
        `low confidence (${confidence.toFixed(2)} < ${this.lowConfidenceThreshold.toFixed(2)})`
      );
    }

    if (context.consecutiveActionFailures >= this.failureEscalationThreshold) {
      reasons.push(
        `consecutive failures (${context.consecutiveActionFailures} >= ${this.failureEscalationThreshold})`
      );
    }

    if (context.recentFailureRate >= 0.5) {
      reasons.push(`high recent failure rate (${Math.round(context.recentFailureRate * 100)}%)`);
    }

    if (primaryDecision.action === 'tapText' && context.consecutiveTapTextFailures > 0) {
      reasons.push('repeated tapText failures');
    }

    if (RISKY_EXPLORATION_ACTIONS.has(primaryDecision.action) && confidence < 0.82) {
      reasons.push(`risky action (${primaryDecision.action}) with non-high confidence`);
    }

    return reasons;
  }

  async decide(enhancedContext: VisionDecisionContext): Promise<AgentAction> {
    const systemPrompt = this.buildSystemPrompt(enhancedContext);
    const userMessage = this.buildUserMessage(enhancedContext);

    if (this.conversationHistory.length > 10) {
      this.conversationHistory = this.conversationHistory.slice(-8);
    }

    const primary = await this.generateDecision({
      provider: 'google',
      modelId: this.primaryModel,
      systemPrompt,
      messages: [...this.conversationHistory, userMessage],
    });

    this.conversationHistory.push(userMessage);
    this.conversationHistory.push({
      role: 'assistant',
      content: primary.rawText,
    });

    const primaryDecision: AgentAction = {
      ...primary.decision,
      modelUsed: this.primaryModel,
    };

    const escalationReasons = this.getEscalationReasons(enhancedContext, primaryDecision);
    if (escalationReasons.length === 0) {
      return primaryDecision;
    }

    if (!this.openaiConfigured) {
      if (!this.warnedMissingOpenAIKey) {
        console.warn(
          '⚠️  OPENAI_API_KEY not configured. GPT fallback routing is disabled; continuing with Gemini decisions only.'
        );
        this.warnedMissingOpenAIKey = true;
      }
      return primaryDecision;
    }

    try {
      const escalationPrompt = `${systemPrompt}

ESCALATION MODE:
- A prior planner decision exists and needs second-pass validation.
- Prior decision: ${JSON.stringify(primaryDecision)}
- Escalation reasons: ${escalationReasons.join('; ')}
- Prioritize deterministic actions (tapElementById/tapResourceId) and avoid brittle taps unless unavoidable.
- If the prior decision repeats a known failure pattern, choose a different action.
- Return JSON in the exact same schema with calibrated confidence.`;

      const fallbackDecision = await this.generateDecision({
        provider: 'openai',
        modelId: this.fallbackModel,
        systemPrompt: escalationPrompt,
        messages: [userMessage],
      });

      return {
        ...fallbackDecision.decision,
        modelUsed: this.fallbackModel,
        escalationReason: escalationReasons.join('; '),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️  GPT fallback decision failed: ${message}. Using primary decision.`);
      return primaryDecision;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ExplorationFallbackCandidate {
  screenshot: string;
  hierarchy: unknown;
  stepNumber: number;
  qualityScore: number;
}

function scoreExplorationCandidate(parsedHierarchy: ParsedHierarchy): number {
  const interactiveScore = Math.min(parsedHierarchy.interactiveElements.length, 8) * 2;
  const textScore = Math.min(parsedHierarchy.textElements.length, 8);
  const semanticsScore = Math.floor(Math.max(0, parsedHierarchy.semanticsCoverage) / 20);
  return interactiveScore + textScore + semanticsScore;
}

function buildScreenSignature(parsedHierarchy: ParsedHierarchy): string {
  const textSignature = parsedHierarchy.textElements
    .slice(0, 12)
    .map((element) => (element.text || '').trim().toLowerCase())
    .filter((text) => text.length > 0);

  const interactiveSignature = parsedHierarchy.interactiveElements.slice(0, 12).map((element) => {
    const label = (element.resourceId || element.accessibilityLabel || element.text || '')
      .trim()
      .toLowerCase();
    const centerX = element.bounds ? Math.round(element.bounds.centerX / 10) * 10 : -1;
    const centerY = element.bounds ? Math.round(element.bounds.centerY / 10) * 10 : -1;
    return `${element.type}:${label}:${centerX}:${centerY}`;
  });

  const signaturePayload = {
    platform: parsedHierarchy.platform,
    totalCount: parsedHierarchy.totalCount,
    interactiveCount: parsedHierarchy.interactiveElements.length,
    semanticsBucket: Math.round(parsedHierarchy.semanticsCoverage / 5),
    textSignature,
    interactiveSignature,
  };

  return createHash('md5').update(JSON.stringify(signaturePayload)).digest('hex').slice(0, 8);
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
  const jobId = `job-${Date.now()}`;
  let deviceUdid: string | undefined;

  try {
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
      openaiApiKey: options.openaiApiKey || process.env.OPENAI_API_KEY,
      model: options.model ?? 'gemini-3-flash-preview',
      fallbackModel: options.fallbackModel ?? 'gpt-5.2',
      lowConfidenceThreshold: normalizeThreshold(options.lowConfidenceThreshold, 0.68),
      failureEscalationThreshold: normalizeFailureThreshold(
        options.failureEscalationThreshold,
        2
      ),
      device: options.device,
      platform: options.platform ?? 'ios',
      repoUrl: options.repoUrl,
      mobilePlatform: options.mobilePlatform,
      autoBuild: options.autoBuild ?? (options.repoUrl ? true : false),
      useV2Flow: options.useV2Flow ?? true,
      sessionId: options.sessionId,
      onPrompt: options.onPrompt,
    };

    if (!config.googleApiKey) {
      throw new Error(
        'Google API key required. Set GOOGLE_GENERATIVE_AI_API_KEY or pass googleApiKey option.'
      );
    }

    let clonedRepoPath: string | undefined;
    let expoGoSession: ExpoGoSession | undefined;

    if (config.device) {
      deviceUdid = await pool.acquire(jobId);
      await sleep(2000);
    }

    if (config.repoUrl && config.autoBuild) {
      try {
        clonedRepoPath = await AppInstaller.cloneRepo(config.repoUrl);
        
        const detectedPlatform = config.mobilePlatform || AppInstaller.detectPlatform(clonedRepoPath);
        console.log(`🔍 Detected platform: ${detectedPlatform}`);
        
        if (detectedPlatform === 'expo') {
          console.log('📱 Using Expo Go approach (no native build required)...');
          expoGoSession = await ExpoGoRunner.start(clonedRepoPath, {
            sessionId: config.sessionId,
            onPrompt: config.onPrompt,
          });
          config.bundleId = expoGoSession.bundleId;
          console.log('✓ Expo Go session started');
        } else {
          const installer = new AppInstaller(clonedRepoPath, detectedPlatform, {
            sessionId: config.sessionId,
            onPrompt: config.onPrompt,
          });
          const appPath = await installer.buildAndInstall();
          
          await AppInstaller.installApp(appPath);
          console.log('✓ App build and install complete');
        }
      } catch (error: unknown) {
        const err = error as { message?: string };
        const errorMessage = err.message || 'Unknown error';
        
        if (expoGoSession) {
          expoGoSession.cleanup();
        } else if (errorMessage.includes('.app bundle') || errorMessage.includes('Build products not found')) {
          console.log('');
          console.log('⚠️  Build directory preserved for debugging at:');
          console.log(`   ${clonedRepoPath}`);
          console.log('');
          console.log('To investigate manually:');
          console.log(`   cd "${clonedRepoPath}"`);
          console.log(`   find . -name "*.app" -type d`);
          console.log('');
        } else if (clonedRepoPath) {
          AppInstaller.cleanup(clonedRepoPath);
        }
        throw new Error(`Build failed: ${errorMessage}`);
      }
    }

    const maestro = new MaestroClient(config.bundleId);
    const agent = new VisionAgent(config.googleApiKey, config.model, config.maxScreenshots, {
      fallbackModel: config.fallbackModel,
      openaiApiKey: config.openaiApiKey,
      lowConfidenceThreshold: config.lowConfidenceThreshold,
      failureEscalationThreshold: config.failureEscalationThreshold,
    });
    const screenshots = new ScreenshotManager(config.outputDir);

    const screenHistory: string[] = [];
    const lastActions: string[] = [];
    const recentErrors: string[] = [];
    const fallbackCandidates: ExplorationFallbackCandidate[] = [];
    const fallbackCandidateHashes = new Set<string>();
    let lastScreenHash = '';
    let sameScreenCount = 0;
    let consecutiveTapTextFailures = 0;
    let consecutiveActionFailures = 0;
    const recentActionOutcomes: boolean[] = [];
    let swiftRecoveryAttempts = 0;
    let warnedSwiftLowSemantics = false;
    let warnedSwiftNoInteractivity = false;
    let warnedSwiftEmptyState = false;
    let forcedSwiftBootstrapScreenshot = false;
    let steps = 0;
    const isSwiftPlatform = config.mobilePlatform === 'swift';
    const minimumFallbackTarget = Math.min(config.maxScreenshots, isSwiftPlatform ? 3 : 1);

    const registerFallbackCandidate = (context: {
      screenshot: string;
      hierarchy: unknown;
      parsedHierarchy: ParsedHierarchy;
    }, stepNumber: number): void => {
      if (!context.screenshot || context.parsedHierarchy.totalCount === 0) {
        return;
      }

      const imageHash = createHash('md5').update(context.screenshot).digest('hex');
      if (fallbackCandidateHashes.has(imageHash)) {
        return;
      }

      fallbackCandidateHashes.add(imageHash);
      fallbackCandidates.push({
        screenshot: context.screenshot,
        hierarchy: context.hierarchy,
        stepNumber,
        qualityScore: scoreExplorationCandidate(context.parsedHierarchy),
      });

      const maxCandidatePool = Math.max(12, config.maxScreenshots * 8);
      if (fallbackCandidates.length > maxCandidatePool) {
        fallbackCandidates.sort(
          (a, b) => b.qualityScore - a.qualityScore || a.stepNumber - b.stepNumber
        );
        fallbackCandidates.splice(maxCandidatePool);
      }
    };

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

      let enhancedContext: {
        screenshot: string;
        annotatedScreenshot: string;
        hierarchy: unknown;
        parsedHierarchy: ParsedHierarchy;
      };

      console.log('👁️  Observing screen...');
      try {
        enhancedContext = await maestro.getEnhancedContext();
      
        if (config.saveEvalScreens) {
          mkdirSync(config.evalScreensDir, { recursive: true });
          const evalPath = path.join(
            config.evalScreensDir,
            `step-${String(steps).padStart(3, '0')}-annotated.png`
          );
          writeFileSync(evalPath, Buffer.from(enhancedContext.annotatedScreenshot, 'base64'));
        }
      } catch (error: unknown) {
        const err = error as { message?: string };
        console.error('❌ Observation failed:', err.message || 'Unknown error');
        errors.push(`Observation failed: ${err.message || 'Unknown error'}`);
        await sleep(2000);
        continue;
      }

      registerFallbackCandidate(enhancedContext, steps);

      if (isSwiftPlatform) {
        if (!warnedSwiftLowSemantics && enhancedContext.parsedHierarchy.semanticsCoverage < 35) {
          console.warn(
            `⚠️  Swift readiness: low accessibility coverage (${enhancedContext.parsedHierarchy.semanticsCoverage}%). Add accessibility identifiers/labels for more reliable navigation.`
          );
          warnedSwiftLowSemantics = true;
        }

        if (
          !warnedSwiftNoInteractivity &&
          enhancedContext.parsedHierarchy.interactiveElements.length === 0
        ) {
          console.warn(
            '⚠️  Swift readiness: no interactive elements detected on current screen. Exploration may stall without accessible controls.'
          );
          warnedSwiftNoInteractivity = true;
        }

        if (
          !warnedSwiftEmptyState &&
          steps <= 3 &&
          enhancedContext.parsedHierarchy.textElements.length <= 1 &&
          enhancedContext.parsedHierarchy.interactiveElements.length <= 1
        ) {
          console.warn(
            '⚠️  Swift readiness: early screens look sparse/empty. Seed content or preload data for marketable screenshots.'
          );
          warnedSwiftEmptyState = true;
        }

        if (!forcedSwiftBootstrapScreenshot && screenshots.count() === 0 && steps <= 2) {
          if (!screenshots.isDuplicate(enhancedContext.screenshot, enhancedContext.hierarchy)) {
            const bootstrapPath = screenshots.save(
              enhancedContext.screenshot,
              enhancedContext.hierarchy
            );
            console.log(`📸 Swift guardrail screenshot saved: ${bootstrapPath}`);
          }
          forcedSwiftBootstrapScreenshot = true;
        }
      }

      const screenHash = buildScreenSignature(enhancedContext.parsedHierarchy);
      screenHistory.push(screenHash);

      if (screenHash === lastScreenHash) {
        sameScreenCount++;
      } else {
        sameScreenCount = 0;
        swiftRecoveryAttempts = 0;
      }
      lastScreenHash = screenHash;

      const stuckThreshold = isSwiftPlatform ? 3 : 5;
      if (sameScreenCount > stuckThreshold) {
        console.log(`⚠️  Stuck on same screen for ${stuckThreshold} actions, attempting recovery`);

        if (isSwiftPlatform && swiftRecoveryAttempts < 3) {
          swiftRecoveryAttempts++;
          try {
            if (swiftRecoveryAttempts === 1) {
              await maestro.iosBackGesture();
              lastActions.push('swiftRecovery(iosBackGesture)');
            } else if (swiftRecoveryAttempts === 2) {
              await maestro.tap(5, 6);
              await sleep(300);
              await maestro.tap(95, 6);
              lastActions.push('swiftRecovery(cornerTap)');
            } else {
              await maestro.launch();
              lastActions.push('swiftRecovery(relaunch)');
            }

            await sleep(1500);
            continue;
          } catch (recoveryError: unknown) {
            const recoveryMessage =
              recoveryError instanceof Error ? recoveryError.message : 'Unknown swift recovery error';
            errors.push(`Swift recovery failed: ${recoveryMessage}`);
          }
        }

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
            console.log('Back recovery failed, ending session');
            break;
          }
        }
      }

      if (enhancedContext.parsedHierarchy.semanticsCoverage < 30) {
        console.warn(`⚠️  Low semantics coverage: ${enhancedContext.parsedHierarchy.semanticsCoverage}%`);
      }

      const recentFailureRate = recentActionOutcomes.length
        ? recentActionOutcomes.filter((outcome) => !outcome).length / recentActionOutcomes.length
        : 0;

      console.log('🧠 AI deciding next action...');
      let decision: AgentAction;
      try {
        decision = await agent.decide({
          screenshot: enhancedContext.screenshot,
          annotatedScreenshot: enhancedContext.annotatedScreenshot,
          parsedHierarchy: enhancedContext.parsedHierarchy,
          screenshotsTaken: screenshots.count(),
          screenHistory,
          lastActions,
          stuckCount: sameScreenCount,
          recentErrors,
          consecutiveTapTextFailures,
          consecutiveActionFailures,
          recentFailureRate,
        });
      } catch (error: unknown) {
        const err = error as { message?: string };
        console.error('❌ AI decision failed:', err.message || 'Unknown error');
        errors.push(`AI decision failed: ${err.message || 'Unknown error'}`);
        await sleep(2000);
        continue;
      }

      const decisionConfidence = normalizeConfidence(decision.confidence).toFixed(2);
      const modelLabel = decision.modelUsed || config.model;
      const escalationSuffix = decision.escalationReason
        ? ` | escalated: ${decision.escalationReason}`
        : '';
      console.log(`🧠 model=${modelLabel} confidence=${decisionConfidence}${escalationSuffix}`);
      console.log(`💭 ${decision.reasoning}`);
      console.log(`🎬 ${decision.action}`, decision.params || '');

      try {
        switch (decision.action) {
          case 'tapElementById': {
            const elementId = decision.params?.elementId as number | undefined;
            if (typeof elementId !== 'number') {
              throw new Error('tapElementById requires numeric elementId');
            }
            await maestro.tapElementById(elementId, enhancedContext.parsedHierarchy);
            lastActions.push(`tapElementById(${elementId})`);
            consecutiveTapTextFailures = 0;
            await sleep(1500);
            break;
          }
          case 'tap': {
            const x = decision.params?.x as number | undefined;
            const y = decision.params?.y as number | undefined;
            if (typeof x !== 'number' || typeof y !== 'number') {
              throw new Error('tap requires numeric x and y');
            }
            await maestro.tap(x, y);
            lastActions.push(`tap(${x},${y})`);
            await sleep(1500);
            break;
          }
          case 'tapText': {
            const text = decision.params?.text as string | undefined;
            if (!text) {
              throw new Error('tapText requires text');
            }
            await maestro.tapText(text);
            lastActions.push(`tapText("${text}")`);
            consecutiveTapTextFailures = 0;
            await sleep(1500);
            break;
          }
          case 'tapResourceId': {
            const resourceId = decision.params?.resourceId as string | undefined;
            if (!resourceId) {
              throw new Error('tapResourceId requires resourceId');
            }
            const target = enhancedContext.parsedHierarchy.elementList.find(
              (element) => element.resourceId === resourceId
            );
            if (!target) {
              throw new Error(`Resource ID not found: ${resourceId}`);
            }
            await maestro.tapElementById(target.id, enhancedContext.parsedHierarchy);
            lastActions.push(`tapResourceId(${resourceId})`);
            await sleep(1500);
            break;
          }
          case 'doubleTap': {
            const x = decision.params?.x as number | undefined;
            const y = decision.params?.y as number | undefined;
            if (typeof x !== 'number' || typeof y !== 'number') {
              throw new Error('doubleTap requires numeric x and y');
            }
            await maestro.doubleTap(x, y);
            lastActions.push(`doubleTap(${x},${y})`);
            await sleep(1500);
            break;
          }
          case 'longPress': {
            const x = decision.params?.x as number | undefined;
            const y = decision.params?.y as number | undefined;
            if (typeof x !== 'number' || typeof y !== 'number') {
              throw new Error('longPress requires numeric x and y');
            }
            await maestro.longPress(x, y);
            lastActions.push(`longPress(${x},${y})`);
            await sleep(1500);
            break;
          }
          case 'scroll':
            await maestro.scroll();
            lastActions.push('scroll');
            await sleep(1000);
            break;
          case 'swipe': {
            const startX = decision.params?.startX as number | undefined;
            const startY = decision.params?.startY as number | undefined;
            const endX = decision.params?.endX as number | undefined;
            const endY = decision.params?.endY as number | undefined;
            if (
              typeof startX !== 'number' ||
              typeof startY !== 'number' ||
              typeof endX !== 'number' ||
              typeof endY !== 'number'
            ) {
              throw new Error('swipe requires numeric startX/startY/endX/endY');
            }
            await maestro.swipe(startX, startY, endX, endY);
            lastActions.push(`swipe(${startX},${startY}→${endX},${endY})`);
            await sleep(1200);
            break;
          }
          case 'inputText': {
            const text = decision.params?.text as string | undefined;
            if (!text) {
              throw new Error('inputText requires text');
            }
            await maestro.inputText(text);
            lastActions.push('inputText');
            await sleep(800);
            break;
          }
          case 'eraseText': {
            const chars = (decision.params?.chars as number | undefined) ?? 50;
            await maestro.eraseText(chars);
            lastActions.push(`eraseText(${chars})`);
            await sleep(600);
            break;
          }
          case 'hideKeyboard':
            await maestro.hideKeyboard();
            lastActions.push('hideKeyboard');
            await sleep(600);
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
          case 'openLink': {
            const url = decision.params?.url as string | undefined;
            if (!url) {
              throw new Error('openLink requires url');
            }
            await maestro.openLink(url);
            lastActions.push(`openLink(${url})`);
            await sleep(1200);
            break;
          }
          case 'pressKey': {
            const key = decision.params?.key as string | undefined;
            if (!key) {
              throw new Error('pressKey requires key');
            }
            await maestro.pressKey(key);
            lastActions.push(`pressKey(${key})`);
            await sleep(800);
            break;
          }
          case 'wait': {
            const timeout = (decision.params?.timeout as number | undefined) ?? 2500;
            await maestro.waitForAnimation(timeout);
            lastActions.push(`wait(${timeout})`);
            break;
          }
          case 'screenshot':
            if (screenshots.isDuplicate(enhancedContext.screenshot, enhancedContext.hierarchy)) {
              console.log('⚠️  Duplicate screenshot, skipping');
            } else {
              const savedPath = screenshots.save(enhancedContext.screenshot, enhancedContext.hierarchy);
              console.log(`📸 Screenshot saved: ${savedPath}`);
            }
            lastActions.push('screenshot');
            break;
          case 'done':
            console.log("✅ AI decided we're done");
            break;
          default:
            throw new Error(`Unsupported action: ${decision.action}`);
        }

        if (decision.shouldScreenshot && decision.action !== 'screenshot') {
          const newScreenshot = await maestro.screenshot();
          const newHierarchy = await maestro.hierarchy();
          if (!screenshots.isDuplicate(newScreenshot, newHierarchy)) {
            const savedPath = screenshots.save(newScreenshot, newHierarchy);
            console.log(`📸 Auto-screenshot saved: ${savedPath}`);
          }
        }

        consecutiveActionFailures = 0;
        recentActionOutcomes.push(true);
        if (recentActionOutcomes.length > 8) {
          recentActionOutcomes.shift();
        }

        if (decision.action === 'done') break;
      } catch (error: unknown) {
        const err = error as { message?: string };
        const errorMsg = err.message || 'Unknown error';
        console.error(`❌ Error: ${errorMsg}`);
        errors.push(`Action failed: ${errorMsg}`);
        consecutiveActionFailures++;
        recentActionOutcomes.push(false);
        if (recentActionOutcomes.length > 8) {
          recentActionOutcomes.shift();
        }

        if (decision.action === 'tapText') {
          consecutiveTapTextFailures++;
          const targetText = decision.params?.text || 'unknown';
          recentErrors.push(`tapText("${targetText}") failed - element not found`);
        } else {
          recentErrors.push(`${decision.action} failed: ${errorMsg.slice(0, 100)}`);
        }

        if (recentErrors.length > 5) {
          recentErrors.shift();
        }

        lastActions.push('error');
        await sleep(1000);
      }
    }

    const screenshotsBeforeFallback = screenshots.count();
    if (screenshotsBeforeFallback < minimumFallbackTarget && fallbackCandidates.length > 0) {
      if (screenshotsBeforeFallback === 0) {
        console.warn('⚠️  No direct screenshots captured. Applying exploration fallback screenshots...');
      } else {
        console.warn(
          `⚠️  Only ${screenshotsBeforeFallback} direct screenshot(s) captured. Applying exploration fallback top-up...`
        );
      }

      const rankedFallbacks = [...fallbackCandidates].sort(
        (a, b) => b.qualityScore - a.qualityScore || a.stepNumber - b.stepNumber
      );

      for (const candidate of rankedFallbacks) {
        if (screenshots.count() >= minimumFallbackTarget) {
          break;
        }

        if (screenshots.isDuplicate(candidate.screenshot, candidate.hierarchy)) {
          continue;
        }

        const fallbackPath = screenshots.save(candidate.screenshot, candidate.hierarchy);
        console.log(`📸 Fallback screenshot saved: ${fallbackPath}`);
      }

      const fallbackAdded = screenshots.count() - screenshotsBeforeFallback;
      if (fallbackAdded > 0) {
        if (screenshotsBeforeFallback === 0) {
          errors.push(
            'Primary exploration yielded no curated screenshots; used exploration fallback screenshots.'
          );
        } else {
          errors.push(
            `Primary exploration yielded low screenshot coverage (${screenshotsBeforeFallback}); topped up with ${fallbackAdded} fallback screenshot(s).`
          );
        }
      }
    }

    if (screenshots.count() === 0 && isSwiftPlatform) {
      errors.push(
        'No screenshots captured. Swift flows often require stronger accessibility identifiers and non-empty seeded content.'
      );
    } else if (isSwiftPlatform && screenshots.count() < minimumFallbackTarget) {
      errors.push(
        `Swift capture completed with ${screenshots.count()} screenshot(s), below the ${minimumFallbackTarget}-screenshot minimum target. Seed richer data and add accessibility identifiers to improve exploration reliability.`
      );
    }

    console.log(`\n✨ Complete! ${screenshots.count()} screenshots saved to ${config.outputDir}`);

    if (expoGoSession) {
      expoGoSession.cleanup();
    } else if (clonedRepoPath) {
      AppInstaller.cleanup(clonedRepoPath);
    }

    return {
      success: screenshots.count() > 0,
      screenshotCount: screenshots.count(),
      totalSteps: steps,
      screenshots: screenshots.getAll(),
      duration: Date.now() - startTime,
      errors,
    };
  } finally {
    if (deviceUdid) {
      await pool.release(deviceUdid, options.bundleId);
    }
  }
}

export async function shutdownPool(): Promise<void> {
  await pool.shutdown();
}
