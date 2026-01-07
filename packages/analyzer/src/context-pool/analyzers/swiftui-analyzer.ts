/**
 * SwiftUI/iOS Analyzer
 * Analyzes native iOS apps (SwiftUI + UIKit)
 */

import fs from 'fs-extra';
import path from 'path';
import type { ScreenContext, WidgetInfo, RouteDefinition } from '../types.js';

export class SwiftUIAnalyzer {
  private projectDir: string;

  constructor(projectDir: string) {
    this.projectDir = projectDir;
  }

  async analyzeScreen(filePath: string): Promise<ScreenContext> {
    const content = await fs.readFile(filePath, 'utf-8');
    const relativePath = path.relative(this.projectDir, filePath);
    const fileName = path.basename(filePath, path.extname(filePath));

    return {
      name: this.extractScreenName(fileName),
      filePath: relativePath,
      type: 'screen',
      widgets: this.extractWidgets(content),
      navigation: {
        accessibleFrom: [],
        accessibleVia: [],
        isInitial: fileName.toLowerCase().includes('home') || fileName.toLowerCase().includes('main'),
        requiresAuth: fileName.toLowerCase().includes('profile'),
      },
      testability: {
        hasTextElements: /Text\(/.test(content),
        hasOnlyIcons: /Image\(/.test(content) && !/Text\(/.test(content),
        testableElements: [],
        assertionStrategy: 'text',
      },
    };
  }

  private extractWidgets(content: string): WidgetInfo[] {
    const widgets: WidgetInfo[] = [];
    const contentWithoutModals = this.removeModalContent(content);

    // Extract Text() components
    const textRegex = /Text\("([^"]+)"\)/g;
    let match;
    while ((match = textRegex.exec(contentWithoutModals)) !== null) {
      const text = match[1].trim();
      if (text && text.length > 0 && text.length < 200) {
        widgets.push({
          type: 'text',
          value: text,
        });
      }
    }

    // Extract Button with Text label
    const buttonRegex = /Button\s*\([^}]*action:\s*{[^}]*}\s*\)\s*{\s*Text\("([^"]+)"\)\s*}/g;
    while ((match = buttonRegex.exec(contentWithoutModals)) !== null) {
      const buttonText = match[1].trim();
      const action = this.extractButtonAction(content, buttonText);

      widgets.push({
        type: 'button',
        label: buttonText,
        action,
      });
    }

    // Extract NavigationLink
    const navLinkRegex = /NavigationLink\s*\([^}]*destination:\s*([^}]+)\)\s*{\s*Text\("([^"]+)"\)\s*}/g;
    while ((match = navLinkRegex.exec(contentWithoutModals)) !== null) {
      const destination = match[1];
      const linkText = match[2].trim();

      const action = this.extractNavigationDestination(destination);

      widgets.push({
        type: 'button',
        label: linkText,
        action,
      });
    }

    // Extract TextField
    const textFieldRegex = /TextField\("([^"]+)"\s*,\s*text:\s*[^,]+/g;
    while ((match = textFieldRegex.exec(contentWithoutModals)) !== null) {
      const placeholder = match[1].trim();
      widgets.push({
        type: 'input',
        label: placeholder,
      });
    }

    // Extract SecureField
    const secureFieldRegex = /SecureField\("([^"]+)"\s*,\s*text:\s*[^,]+/g;
    while ((match = secureFieldRegex.exec(contentWithoutModals)) !== null) {
      const placeholder = match[1].trim();
      widgets.push({
        type: 'input',
        label: placeholder,
      });
    }

    // Extract Image/Icon components
    const imageRegex = /Image\(systemName:\s*"([^"]+)"\)/g;
    while ((match = imageRegex.exec(contentWithoutModals)) !== null) {
      widgets.push({
        type: 'icon',
        semanticLabel: match[1],
      });
    }

    return widgets;
  }

  private extractButtonAction(content: string, buttonText: string): WidgetAction | undefined {
    // Find Button containing this text and extract action
    const buttonBlockRegex = new RegExp(
      `Button\\([^}]*action:\\s*{([^}])}[^}]*\\)\\s*{\\s*Text\\("${this.escapeRegex(buttonText)}"\\)\\s*}`,
      'gs'
    );

    const match = buttonBlockRegex.exec(content);
    if (!match) return undefined;

    const actionContent = match[1];
    return this.extractNavigationFromAction(actionContent);
  }

  private extractNavigationFromAction(actionContent: string): WidgetAction | undefined {
    // Navigation patterns
    const navLinkMatch = /NavigationLink\(destination:\s*(\w+)\(\)\)/.exec(actionContent);
    if (navLinkMatch) {
      return {
        type: 'navigation',
        target: navLinkMatch[1],
        description: `Navigate to ${navLinkMatch[1]}`,
      };
    }

    // Custom navigation functions
    const funcMatch = /(\w+)\(\)/.exec(actionContent);
    if (funcMatch) {
      const funcName = funcMatch[1];
      if (funcName.toLowerCase().includes('navigate') || funcName.toLowerCase().includes('push')) {
        return {
          type: 'navigation',
          target: funcName.replace(/navigate|push/gi, '').toLowerCase(),
          description: `Navigate via ${funcName}`,
        };
      }
    }

    return undefined;
  }

  private extractNavigationDestination(destination: string): WidgetAction | undefined {
    // Extract view name from destination
    const viewMatch = /(\w+)\(\)/.exec(destination);
    if (viewMatch) {
      return {
        type: 'navigation',
        target: viewMatch[1],
        description: `Navigate to ${viewMatch[1]}`,
      };
    }

    return undefined;
  }

  private removeModalContent(content: string): string {
    // Remove Sheet, FullScreenCover, Alert, etc.
    const modalPatterns = [
      /\.sheet\s*\([^}]*{[\s\S]*?}\s*\)/g,
      /\.fullScreenCover\s*\([^}]*{[\s\S]*?}\s*\)/g,
      /\.alert\s*\([^}]*{[\s\S]*?}\s*\)/g,
    ];

    let cleanContent = content;
    for (const pattern of modalPatterns) {
      cleanContent = cleanContent.replace(pattern, '/* modal removed */');
    }

    return cleanContent;
  }

  private extractScreenName(fileName: string): string {
    return fileName
      .replace(/View|Controller|Screen/g, '')
      .replace(/([A-Z])/g, ' $1')
      .trim();
  }

  async parseRoutes(): Promise<RouteDefinition[]> {
    const routes: RouteDefinition[] = [];

    // Find SwiftUI view files
    const viewFiles = await this.findFiles(['**/*.swift']);

    for (const file of viewFiles) {
      const content = await fs.readFile(file, 'utf-8');

      // Extract NavigationStack/NavigationView configurations
      const navStackRegex = /NavigationStack\s*{[\s\S]*?}/g;
      const navViewRegex = /NavigationView\s*{[\s\S]*?}/g;

      // This is complex - would need more sophisticated parsing
      // For now, return basic routes found in NavigationLink patterns
      const navLinkRegex = /NavigationLink\s*\([^}]*destination:\s*(\w+)\(\)\)/g;
      let match;
      while ((match = navLinkRegex.exec(content)) !== null) {
        routes.push({
          name: match[1].toLowerCase(),
          path: match[1].toLowerCase(),
          screen: match[1],
        });
      }
    }

    return routes;
  }

  private async findFiles(patterns: string[]): Promise<string[]> {
    // Simple glob implementation for SwiftUI
    const files: string[] = [];
    const scanDir = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (!['build', '.git', 'DerivedData'].includes(entry.name)) {
              await scanDir(fullPath);
            }
          } else if (entry.isFile()) {
            const fileName = entry.name.toLowerCase();
            if (fileName.endsWith('.swift')) {
              // Check if matches any pattern
              for (const pattern of patterns) {
                if (this.matchesPattern(fullPath, pattern)) {
                  files.push(fullPath);
                  break;
                }
              }
            }
          }
        }
      } catch (error) {
        // Directory doesn't exist or can't be read
      }
    };

    await scanDir(this.projectDir);
    return files;
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    // Simple pattern matching
    const relativePath = path.relative(this.projectDir, filePath);
    return relativePath.includes(pattern.replace('**/', '').replace('*.', '.'));
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

interface WidgetAction {
  type: 'navigation' | 'state_change' | 'api_call' | 'other';
  target?: string;
  description?: string;
}
