/**
 * @stora-sh/screenshots - Flow Refinement
 * Takes exploration logs and generates optimized Maestro YAML flows
 */

import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { ExplorationLog, RefinedFlowMetadata } from './types';

const REFINEMENT_SYSTEM_PROMPT = `You are a mobile app flow optimization expert specializing in creating efficient, deterministic Maestro test flows.

Your task is to analyze exploration logs from AI-driven app exploration and generate optimized Maestro YAML flows that:
1. Capture only the most marketable/valuable screens
2. Use MINIMAL steps to reach each target screen (fewer steps = better)
3. Are fully deterministic and reproducible
4. Use coordinate-based taps (avoid text matching when possible)
5. Include appropriate wait times for animations/loading states

CRITICAL OPTIMIZATION RULES:
- IGNORE all steps marked "isMarketable: false" - these are failed or non-valuable steps
- REMOVE ALL redundant navigation (back/forth movements, duplicate taps, unnecessary scrolls)
- The output flow MUST have FEWER steps than the input (aggressive optimization required)
- Find the SHORTEST path to each marketable screen - eliminate exploration detours
- Combine sequential taps on the same coordinates into one tap
- Remove failed tapText attempts - use only successful coordinate taps
- Use percentage-based coordinates for tap actions (e.g., "88%,90%")
- Do NOT use "sleep" or "wait" commands. Use "waitForAnimationToEnd" if needed.
- Every marketable screen MUST have a takeScreenshot command
- The flow must be valid Maestro YAML syntax

OUTPUT FORMAT:
Return ONLY valid Maestro YAML. No markdown, no explanations, no extra text.
Start with "appId: <bundleId>" and include the "---" separator.

EXAMPLE OPTIMIZATION:
Input: 15 exploration steps (3 marketable, 12 failed/redundant)
Output: 6 optimized steps (3 taps to reach marketable screens + 3 screenshots)
Goal: Minimal, direct path to capture all marketable screens.`;

const REFINEMENT_USER_PROMPT_TEMPLATE = (log: ExplorationLog, targetScreenshots: number) => `
Analyze this exploration log and create an optimized Maestro flow:

**Exploration Summary:**
- Total exploration steps: ${log.totalSteps}
- Marketable screens found: ${log.marketableScreens.length}
- Failed/redundant steps: ${log.totalSteps - log.marketableScreens.length}
- Target screenshots to capture: ${targetScreenshots}
- Platform: ${log.platform}
- Bundle ID: ${log.bundleId}

**MARKETABLE SCREENS (USE ONLY THESE):**
${log.steps
  .filter((s) => s.isMarketable)
  .map(
    (s) => `
Step ${s.stepNumber}:
- Action: ${s.action.action} ${JSON.stringify(s.action.params || {})}
- Reasoning: ${s.reasoning}
- Why marketable: ${s.marketableReason}
`
  )
  .join('\n')}

**FAILED/REDUNDANT STEPS (IGNORE THESE):**
${log.steps
  .filter((s) => !s.isMarketable)
  .map(
    (s) => `
Step ${s.stepNumber}: ${s.action.action} ${JSON.stringify(s.action.params || {})} ← SKIP THIS (failed or redundant)
`
  )
  .join('')}

**Your Task:**
Create a Maestro YAML flow that:
1. Captures the top ${Math.min(targetScreenshots, log.marketableScreens.length)} most marketable screens
2. Uses the SHORTEST PATH to reach each screen (remove ALL exploration detours)
3. ONLY includes actions that lead directly to marketable screens
4. Ensures all taps use coordinate percentages (e.g., "point: \\"50%,50%\\"")
5. Do NOT use "sleep" commands. Use "waitForAnimationToEnd" if pauses are needed.
6. Takes a screenshot at each marketable screen using: takeScreenshot: screenshot-N

OPTIMIZATION GOAL: ${log.totalSteps} exploration steps → ${log.marketableScreens.length + Math.min(targetScreenshots, log.marketableScreens.length)} optimized steps (or fewer)

Remember: Output ONLY the YAML, nothing else. Be aggressive with optimization - remove everything except the direct path to marketable screens.
`;

export interface RefinementOptions {
  /** Google AI API key (defaults to env) */
  googleApiKey?: string;
  /** Model to use for refinement (default: gemini-3-pro-preview) */
  model?: string;
  /** Number of screenshots to capture in refined flow (default: all marketable screens) */
  targetScreenshots?: number;
  /** Output directory for refined flow file (default: ./refined-flows) */
  outputDir?: string;
}

export interface RefinementResult {
  success: boolean;
  metadata: RefinedFlowMetadata;
  flowYaml: string;
  errors: string[];
}

/**
 * Refine an exploration log into an optimized Maestro YAML flow
 */
export async function refineExplorationLog(
  log: ExplorationLog,
  options: RefinementOptions = {}
): Promise<RefinementResult> {
  const {
    googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    model = 'gemini-3-pro-preview',
    targetScreenshots = log.marketableScreens.length,
    outputDir = './refined-flows',
  } = options;

  const errors: string[] = [];

  try {
    // Validate inputs
    if (!googleApiKey) {
      throw new Error('Google AI API key required (GOOGLE_GENERATIVE_AI_API_KEY)');
    }

    if (log.marketableScreens.length === 0) {
      throw new Error('No marketable screens found in exploration log');
    }

    console.log(`[Refinement] Starting refinement for exploration ${log.explorationId}`);
    console.log(`[Refinement] Found ${log.marketableScreens.length} marketable screens`);
    console.log(`[Refinement] Target: ${targetScreenshots} screenshots`);

    // Ensure output directory exists
    mkdirSync(outputDir, { recursive: true });

    // Call Gemini for refinement
    const userPrompt = REFINEMENT_USER_PROMPT_TEMPLATE(log, targetScreenshots);

    const result = await generateText({
      model: google(model),
      system: REFINEMENT_SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.2, // Low temperature for deterministic output
      maxRetries: 3,
    });

    let flowYaml = result.text.trim();

    // Clean up output (remove markdown if present)
    if (flowYaml.includes('```yaml')) {
      flowYaml = flowYaml.split('```yaml')[1].split('```')[0].trim();
    } else if (flowYaml.includes('```')) {
      flowYaml = flowYaml.split('```')[1].split('```')[0].trim();
    }

    // Strip invalid Maestro commands that the AI sometimes generates
    flowYaml = sanitizeMaestroYaml(flowYaml);

    // Validate YAML structure
    if (!flowYaml.startsWith('appId:')) {
      throw new Error('Generated YAML does not start with appId');
    }

    if (!flowYaml.includes('---')) {
      throw new Error('Generated YAML missing --- separator');
    }

    if (!flowYaml.includes('takeScreenshot')) {
      throw new Error('Generated YAML has no screenshot commands');
    }

    // Count optimized steps (rough heuristic)
    const optimizedSteps = (flowYaml.match(/- /g) || []).length;

    // Generate metadata
    const flowId = `flow-${Date.now()}`;
    const maestroFlowPath = join(outputDir, `${flowId}.yaml`);

    const metadata: RefinedFlowMetadata = {
      flowId,
      explorationId: log.explorationId,
      generatedAt: new Date().toISOString(),
      originalSteps: log.totalSteps,
      optimizedSteps,
      marketableScreensCaptured: Math.min(targetScreenshots, log.marketableScreens.length),
      maestroFlowPath,
    };

    // Save YAML file
    try {
      writeFileSync(maestroFlowPath, flowYaml, 'utf-8');
      console.log(`[Refinement] Saved flow to ${maestroFlowPath}`);
    } catch (err) {
      errors.push(`Failed to save flow file: ${err}`);
    }

    // Save metadata
    const metadataPath = join(outputDir, `${flowId}.json`);
    try {
      writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
      console.log(`[Refinement] Saved metadata to ${metadataPath}`);
    } catch (err) {
      errors.push(`Failed to save metadata: ${err}`);
    }

    console.log(`[Refinement] Optimization: ${log.totalSteps} → ${optimizedSteps} steps`);
    console.log(`[Refinement] Success!`);

    return {
      success: true,
      metadata,
      flowYaml,
      errors,
    };
  } catch (error) {
    console.error('[Refinement] Failed:', error);
    errors.push(error instanceof Error ? error.message : String(error));

    return {
      success: false,
      metadata: {
        flowId: `flow-error-${Date.now()}`,
        explorationId: log.explorationId,
        generatedAt: new Date().toISOString(),
        originalSteps: log.totalSteps,
        optimizedSteps: 0,
        marketableScreensCaptured: 0,
        maestroFlowPath: '',
      },
      flowYaml: '',
      errors,
    };
  }
}

/**
 * Sanitize generated Maestro YAML by removing invalid commands.
 * AI models sometimes generate commands like `sleep` which Maestro doesn't support.
 */
function sanitizeMaestroYaml(yaml: string): string {
  const invalidCommands = ['sleep', 'wait', 'pause', 'delay'];
  const lines = yaml.split('\n');
  const sanitized: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip lines that are invalid Maestro commands (e.g., "- sleep: 500")
    let isInvalid = false;
    for (const cmd of invalidCommands) {
      if (trimmed === `- ${cmd}:` || trimmed.startsWith(`- ${cmd}: `)) {
        console.log(`[Refinement] Stripped invalid command: ${trimmed}`);
        isInvalid = true;
        break;
      }
    }

    if (!isInvalid) {
      sanitized.push(line);
    }
  }

  return sanitized.join('\n');
}

/**
 * Validate a Maestro YAML flow file
 */
export function validateMaestroFlow(yaml: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!yaml.includes('appId:')) {
    errors.push('Missing appId declaration');
  }

  if (!yaml.includes('---')) {
    errors.push('Missing YAML document separator (---)');
  }

  if (!yaml.includes('takeScreenshot')) {
    errors.push('No screenshot commands found');
  }

  // Check for common mistakes
  if (yaml.includes('tapOn:') && !yaml.includes('point:')) {
    errors.push('tapOn commands should use "point:" for coordinates');
  }

  const invalidCommands = ['sleep', 'wait', 'pause', 'delay'];
  for (const cmd of invalidCommands) {
    if (yaml.includes(`- ${cmd}:`)) {
      errors.push(`Invalid Maestro command found: "${cmd}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
