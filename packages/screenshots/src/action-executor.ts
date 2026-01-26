import type { MaestroClient } from './index.js';
import type { ParsedHierarchy, UIElement } from './hierarchy-parser.js';
import { findByText, findByResourceId } from './hierarchy-parser.js';

interface ExecutionResult {
  success: boolean;
  tier: 1 | 2 | 3;
  method: string;
  error?: string;
  attemptedMethods: string[];
}

interface TapOptions {
  text?: string;
  elementId?: number;
  coordinates?: { x: number; y: number };
  resourceId?: string;
}

export class ActionExecutor {
  constructor(
    private maestro: MaestroClient,
    private hierarchy: ParsedHierarchy
  ) {}

  async executeTap(options: TapOptions): Promise<ExecutionResult> {
    const attemptedMethods: string[] = [];
    let lastError: string | undefined;

    if (options.elementId !== undefined) {
      try {
        attemptedMethods.push('tapElementById');
        await this.tapByElementId(options.elementId);
        return {
          success: true,
          tier: 1,
          method: 'tapElementById',
          attemptedMethods,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    if (options.resourceId) {
      try {
        attemptedMethods.push('tapByResourceId');
        await this.tapByResourceId(options.resourceId);
        return {
          success: true,
          tier: 1,
          method: 'tapByResourceId',
          attemptedMethods,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    if (options.text) {
      try {
        attemptedMethods.push('tapText');
        await this.maestro.tapText(options.text);
        return {
          success: true,
          tier: 2,
          method: 'tapText',
          attemptedMethods,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    if (options.coordinates) {
      try {
        attemptedMethods.push('tapCoordinates');
        await this.maestro.tap(options.coordinates.x, options.coordinates.y);
        return {
          success: true,
          tier: 3,
          method: 'tapCoordinates',
          attemptedMethods,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    return {
      success: false,
      tier: 3,
      method: 'none',
      error: lastError || 'No tap method available',
      attemptedMethods,
    };
  }

  async tapByElementId(elementId: number): Promise<void> {
    const element = this.hierarchy.elements.get(elementId);

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

    const screenWidth = this.hierarchy.screenBounds?.width || 1080;
    const screenHeight = this.hierarchy.screenBounds?.height || 1920;

    const xPercent = (element.bounds.centerX / screenWidth) * 100;
    const yPercent = (element.bounds.centerY / screenHeight) * 100;

    await this.maestro.tap(xPercent, yPercent);
  }

  async tapByResourceId(resourceId: string): Promise<void> {
    const element = findByResourceId(this.hierarchy, resourceId);

    if (!element) {
      throw new Error(`Element with resourceId "${resourceId}" not found`);
    }

    await this.tapByElementId(element.id);
  }

  async tapByText(text: string, exact: boolean = false): Promise<void> {
    const elements = findByText(this.hierarchy, text, exact);

    if (elements.length === 0) {
      throw new Error(`No elements found with text "${text}"`);
    }

    const clickableElements = elements.filter((el) => el.states.clickable);

    if (clickableElements.length === 0) {
      throw new Error(`Found elements with text "${text}" but none are clickable`);
    }

    const largestElement = clickableElements.reduce((largest, current) => {
      const largestArea = largest.bounds?.area || 0;
      const currentArea = current.bounds?.area || 0;
      return currentArea > largestArea ? current : largest;
    });

    await this.tapByElementId(largestElement.id);
  }

  async tapWithFallback(
    primary: TapOptions,
    fallback: TapOptions
  ): Promise<ExecutionResult> {
    const result = await this.executeTap(primary);

    if (result.success) {
      return result;
    }

    console.warn(
      `Primary tap method failed: ${result.error}. Trying fallback...`
    );

    return await this.executeTap(fallback);
  }

  async smartTap(target: {
    text?: string;
    resourceId?: string;
    elementId?: number;
  }): Promise<ExecutionResult> {
    const options: TapOptions = {};

    if (target.elementId !== undefined) {
      options.elementId = target.elementId;
    } else if (target.resourceId) {
      options.resourceId = target.resourceId;
    } else if (target.text) {
      const elements = findByText(this.hierarchy, target.text, false);
      if (elements.length > 0 && elements[0].bounds) {
        options.elementId = elements[0].id;
        options.text = target.text;
      } else {
        options.text = target.text;
      }
    }

    if (options.elementId !== undefined) {
      const element = this.hierarchy.elements.get(options.elementId);
      if (element?.bounds) {
        const screenWidth = this.hierarchy.screenBounds?.width || 1080;
        const screenHeight = this.hierarchy.screenBounds?.height || 1920;
        options.coordinates = {
          x: (element.bounds.centerX / screenWidth) * 100,
          y: (element.bounds.centerY / screenHeight) * 100,
        };
      }
    }

    return await this.executeTap(options);
  }
}

export function createActionExecutor(
  maestro: MaestroClient,
  hierarchy: ParsedHierarchy
): ActionExecutor {
  return new ActionExecutor(maestro, hierarchy);
}
