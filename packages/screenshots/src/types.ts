/**
 * @stora-sh/screenshots - Type definitions
 */

export type MobilePlatform = 'flutter' | 'react-native' | 'expo' | 'swift' | 'kotlin';

export interface ScreenshotterOptions {
  /** Target bundle ID of the app */
  bundleId: string;
  /** Maximum exploration steps (default: 50) */
  maxSteps?: number;
  /** Target number of screenshots (default: 10) */
  maxScreenshots?: number;
  /** Directory for final screenshots (default: ./store-screenshots) */
  outputDir?: string;
  /** Save evaluation screenshots for debugging */
  saveEvalScreens?: boolean;
  /** Directory for evaluation screenshots (default: ./eval-screens) */
  evalScreensDir?: string;
  /** Google AI API key (defaults to env vars) */
  googleApiKey?: string;
  /** Model to use (default: gemini-2.0-flash) */
  model?: string;
  /** Device name to use (e.g., "iPhone 15 Pro"). If provided, will boot simulator. */
  device?: string;
  /** Platform: ios or android (default: ios) */
  platform?: 'ios' | 'android';
  /** GitHub clone URL with embedded access token for cloning the repo */
  repoUrl?: string;
  /** Mobile platform type for build process */
  mobilePlatform?: MobilePlatform;
  /** Whether to auto-build and install the app before capture (default: true if repoUrl provided) */
  autoBuild?: boolean;
  /** Session ID for process tracking and interactive input */
  sessionId?: string;
  /** Callback when CLI prompts for user input */
  onPrompt?: (prompt: string) => void;
}

export interface ScreenshotResult {
  /** Path to the saved screenshot */
  path: string;
  /** MD5 hash of the image */
  hash: string;
  /** Hash of the screen hierarchy */
  screenHash: string;
}

export interface AgentAction {
  action:
    | 'tap'
    | 'tapText'
    | 'tapElementById'
    | 'tapResourceId'
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
  params?: Record<string, unknown>;
  reasoning: string;
  shouldScreenshot: boolean;
}

export interface EnhancedContext {
  screenshot: string;
  annotatedScreenshot: string;
  hierarchy: unknown;
  parsedHierarchy: {
    totalElements: number;
    interactiveCount: number;
    semanticsCoverage: number;
    platform: 'ios' | 'android' | 'unknown';
  };
  elementList: string;
}

export interface ExecutionResult {
  /** Whether the execution completed successfully */
  success: boolean;
  /** Number of screenshots captured */
  screenshotCount: number;
  /** Total steps taken */
  totalSteps: number;
  /** Paths to all captured screenshots */
  screenshots: string[];
  /** Duration in milliseconds */
  duration: number;
  /** Any errors encountered */
  errors: string[];
}
