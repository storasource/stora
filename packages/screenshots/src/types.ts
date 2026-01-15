/**
 * @stora-sh/screenshots - Type definitions
 */

/**
 * Configuration options for the screenshot capture session.
 *
 * Defines the parameters for controlling how the AI agent explores
 * and captures screenshots from a mobile application. All options
 * except [bundleId] have sensible defaults.
 *
 * @example
 * ```typescript
 * const options: ScreenshotterOptions = {
 *   bundleId: 'com.example.app',
 *   maxScreenshots: 10,
 *   outputDir: './screenshots',
 * };
 * ```
 */
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
}

/**
 * Represents a single captured screenshot with metadata.
 *
 * Contains the file path and hash information used for deduplication.
 * The [hash] is computed from the image content, while [screenHash]
 * is derived from the UI hierarchy structure.
 */
export interface ScreenshotResult {
  /** Path to the saved screenshot */
  path: string;
  /** MD5 hash of the image */
  hash: string;
  /** Hash of the screen hierarchy */
  screenHash: string;
}

/**
 * Represents an action decision made by the AI vision agent.
 *
 * The agent analyzes the current screen state and returns an action
 * to perform. Each action includes reasoning for debugging and an
 * optional flag indicating whether the current screen is worth capturing.
 *
 * The [action] field determines the type of interaction, while [params]
 * provides action-specific parameters such as coordinates or text input.
 */
export interface AgentAction {
  /** The type of action to perform on the mobile app */
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
  /** Action-specific parameters (coordinates, text, etc.) */
  params?: Record<string, unknown>;
  /** AI explanation of why this action was chosen */
  reasoning: string;
  /** Whether the current screen should be captured after the action */
  shouldScreenshot: boolean;
}

/**
 * Contains the results of a screenshot capture session.
 *
 * Returned by [captureScreenshots] after the exploration completes.
 * Includes success status, captured screenshot paths, timing information,
 * and any errors encountered during execution.
 *
 * @example
 * ```typescript
 * const result = await captureScreenshots(options);
 * if (result.success) {
 *   console.log(`Captured ${result.screenshotCount} screenshots`);
 * }
 * ```
 */
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
