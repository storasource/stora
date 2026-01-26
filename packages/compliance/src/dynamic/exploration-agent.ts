import type { MaestroClient } from '@stora-sh/screenshots';
import type { ExplorationDepth } from '../types';

interface ParsedHierarchy {
  platform: string;
  screenBounds?: { width: number; height: number };
  elements: Map<number, unknown>;
  elementList: unknown[];
  interactiveElements: unknown[];
  semanticsCoverage: number;
}

export interface ExplorationAction {
  type:
    | 'tap'
    | 'scroll'
    | 'back'
    | 'swipe'
    | 'wait'
    | 'input_text'
    | 'done';
  params?: Record<string, unknown>;
  reasoning?: string;
}

export interface ExplorationConfig {
  depth: ExplorationDepth;
  maxSteps: number;
  maxDuration: number;
  focusAreas?: string[];
}

export class ExplorationAgent {
  private maestro: MaestroClient;
  private config: ExplorationConfig;
  private currentStep = 0;
  private visitedScreens: Set<string> = new Set();
  private actionHistory: string[] = [];

  constructor(maestro: MaestroClient, config: ExplorationConfig) {
    this.maestro = maestro;
    this.config = config;
  }

  async explore(
    onScreenChange: (screenshot: Buffer, hierarchy: ParsedHierarchy) => Promise<void>
  ): Promise<void> {
    this.currentStep = 0;
    const startTime = Date.now();

    await this.maestro.launch();
    await this.wait(2000);

    while (this.shouldContinueExploring(startTime)) {
      this.currentStep++;

      const screenshot = await this.maestro.screenshot();
      const hierarchy = await this.maestro.hierarchy();

      const screenshotBuffer = Buffer.from(screenshot, 'base64');

      await onScreenChange(screenshotBuffer, hierarchy as ParsedHierarchy);

      const action = await this.decideNextAction(hierarchy as ParsedHierarchy);

      if (action.type === 'done') {
        break;
      }

      await this.executeAction(action);
      await this.wait(1500);
    }
  }

  private shouldContinueExploring(startTime: number): boolean {
    const elapsedMinutes = (Date.now() - startTime) / 1000 / 60;

    if (this.currentStep >= this.config.maxSteps) {
      return false;
    }

    if (elapsedMinutes >= this.config.maxDuration) {
      return false;
    }

    return true;
  }

  private async decideNextAction(
    _hierarchy: ParsedHierarchy
  ): Promise<ExplorationAction> {
    const random = Math.random();

    if (random < 0.6) {
      return {
        type: 'tap',
        params: { x: 50 + Math.random() * 40, y: 30 + Math.random() * 40 },
        reasoning: 'Random tap in center area',
      };
    } else if (random < 0.8) {
      return {
        type: 'scroll',
        reasoning: 'Scroll to reveal more content',
      };
    } else if (random < 0.9 && this.actionHistory.length > 3) {
      return {
        type: 'back',
        reasoning: 'Navigate back',
      };
    } else {
      return {
        type: 'wait',
        reasoning: 'Wait for animations',
      };
    }
  }

  private async executeAction(action: ExplorationAction): Promise<void> {
    this.actionHistory.push(action.type);

    if (this.actionHistory.length > 20) {
      this.actionHistory.shift();
    }

    switch (action.type) {
      case 'tap':
        if (action.params?.x && action.params?.y) {
          await this.maestro.tap(
            action.params.x as number,
            action.params.y as number
          );
        }
        break;
      case 'scroll':
        await this.maestro.scroll();
        break;
      case 'back':
        try {
          await this.maestro.back();
        } catch {
          await this.maestro.iosBackGesture();
        }
        break;
      case 'swipe':
        if (
          action.params?.startX &&
          action.params?.startY &&
          action.params?.endX &&
          action.params?.endY
        ) {
          await this.maestro.swipe(
            action.params.startX as number,
            action.params.startY as number,
            action.params.endX as number,
            action.params.endY as number
          );
        }
        break;
      case 'input_text':
        if (action.params?.text) {
          await this.maestro.inputText(action.params.text as string);
        }
        break;
      case 'wait':
        await this.wait(2000);
        break;
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getCurrentStep(): number {
    return this.currentStep;
  }

  getProgress(): number {
    return Math.round((this.currentStep / this.config.maxSteps) * 100);
  }
}
