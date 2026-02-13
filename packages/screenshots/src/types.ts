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
  /** OpenAI API key for fallback decision routing (defaults to OPENAI_API_KEY env var) */
  openaiApiKey?: string;
  /** Primary exploration model (default: gemini-3-flash-preview) */
  model?: string;
  /** Fallback exploration model for low-confidence/high-failure decisions (default: gpt-5.2) */
  fallbackModel?: string;
  /** Confidence threshold for fallback routing, 0-1 range (default: 0.68) */
  lowConfidenceThreshold?: number;
  /** Consecutive action failure threshold for fallback routing (default: 2) */
  failureEscalationThreshold?: number;
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
  /** Enable V2 flow orchestration when available (default: true) */
  useV2Flow?: boolean;
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
  /** Action confidence from 0-1 (higher means more certain) */
  confidence?: number;
  /** Model ID that produced the action */
  modelUsed?: string;
  /** Why a fallback model was used */
  escalationReason?: string;
}

export interface ExplorationStep {
  /** Step index in chronological order (1-based) */
  stepNumber: number;
  /** Action executed at this step */
  action: {
    action: AgentAction['action'];
    params?: Record<string, unknown>;
  };
  /** Agent reasoning text */
  reasoning: string;
  /** Whether this step was marked as marketable */
  isMarketable: boolean;
  /** Optional explanation for marketability */
  marketableReason?: string;
  /** Optional screenshot captured at this step */
  screenshotPath?: string;
  /** ISO timestamp for this step */
  timestamp?: string;
}

export interface ExplorationLog {
  /** Unique exploration run ID */
  explorationId: string;
  /** Target app bundle ID */
  bundleId: string;
  /** Runtime platform for this exploration */
  platform: 'ios' | 'android' | 'unknown' | string;
  /** Number of exploration steps */
  totalSteps: number;
  /** Full chronological list of steps */
  steps: ExplorationStep[];
  /** Subset of steps marked as marketable */
  marketableScreens: ExplorationStep[];
  /** ISO timestamp for the log */
  generatedAt?: string;
}

export interface RefinedFlowMetadata {
  flowId: string;
  explorationId: string;
  generatedAt: string;
  originalSteps: number;
  optimizedSteps: number;
  marketableScreensCaptured: number;
  maestroFlowPath: string;
  fallbackUsed?: boolean;
  fallbackReason?: string;
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

export interface PoolDevice {
  udid: string;
  name: string;
  deviceType: string;
  state: 'idle' | 'in-use' | 'cleaning' | 'corrupted';
  inUseBy?: string;
  createdAt: Date;
  lastUsedAt?: Date;
}

export interface PoolConfig {
  maxSize: number;
  preCreateCount: number;
  acquireTimeout: number;
  deviceType: string;
  cleanupStrategy: 'uninstall' | 'erase';
}
