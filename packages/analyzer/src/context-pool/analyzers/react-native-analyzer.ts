/**
 * React Native Code Analyzer
 * Analyzes React Native/Expo apps
 */

import fs from 'fs-extra';
import path from 'path';
import type { ScreenContext, WidgetInfo, RouteDefinition } from '../types.js';

export class ReactNativeAnalyzer {
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
        isInitial: content.includes('initialRouteName') || fileName.toLowerCase().includes('home'),
        requiresAuth: content.includes('requiresAuth') || fileName.toLowerCase().includes('profile'),
      },
      testability: {
        hasTextElements: /<Text/.test(content),
        hasOnlyIcons: /<Icon/.test(content) && !/<Text/.test(content),
        testableElements: [],
        assertionStrategy: 'text',
      },
    };
  }

  private extractWidgets(content: string): WidgetInfo[] {
    const widgets: WidgetInfo[] = [];
    const contentWithoutDialogs = this.removeDialogContent(content);

    // Extract <Text> elements (including nested)
    const textRegex = /<Text[^>]*>([^<]+)<\/Text>/g;
    let match;
    while ((match = textRegex.exec(contentWithoutDialogs)) !== null) {
      const text = match[1].trim();
      if (text && text.length > 0 && text.length < 200) {
        widgets.push({
          type: 'text',
          value: text,
        });
      }
    }

    // Extract TouchableOpacity with Text child
    const touchableRegex = /<TouchableOpacity[^>]*>[\s\S]*?<Text[^>]*>([^<]+)<\/Text>[\s\S]*?<\/TouchableOpacity>/g;
    while ((match = touchableRegex.exec(contentWithoutDialogs)) !== null) {
      const buttonText = match[1].trim();
      const action = this.extractTouchableAction(content, buttonText);

      widgets.push({
        type: 'button',
        label: buttonText,
        action,
      });
    }

    // Extract Pressable components
    const pressableRegex = /<Pressable[^>]*>[\s\S]*?<Text[^>]*>([^<]+)<\/Text>[\s\S]*?<\/Pressable>/g;
    while ((match = pressableRegex.exec(contentWithoutDialogs)) !== null) {
      const buttonText = match[1].trim();
      const action = this.extractPressableAction(content, buttonText);

      widgets.push({
        type: 'button',
        label: buttonText,
        action,
      });
    }

    // Extract Button components
    const buttonRegex = /<Button[^>]*title=["']([^"']+)["'][^>]*onPress=\{([^}]+)\}/g;
    while ((match = buttonRegex.exec(contentWithoutDialogs)) !== null) {
      const buttonText = match[1];
      const action = this.extractButtonAction(content, buttonText);

      widgets.push({
        type: 'button',
        label: buttonText,
        action,
      });
    }

    // Extract TextInput components
    const inputRegex = /<TextInput[^>]*(?:placeholder=["']([^"']+)["']|label=["']([^"']+)["'])/g;
    while ((match = inputRegex.exec(contentWithoutDialogs)) !== null) {
      const placeholder = match[1] || match[2];
      if (placeholder) {
        widgets.push({
          type: 'input',
          label: placeholder,
        });
      }
    }

    return widgets;
  }

  private extractTouchableAction(content: string, buttonText: string): WidgetAction | undefined {
    // Find TouchableOpacity containing this text and extract onPress
    const touchableBlockRegex = new RegExp(
      `<TouchableOpacity[^{]*onPress=\{([^}]+)\}[^{]*<Text[^>]*>${this.escapeRegex(buttonText)}</Text>[^{]*</TouchableOpacity>`,
      'gs'
    );

    const match = touchableBlockRegex.exec(content);
    if (!match) return undefined;

    const onPressContent = match[1];
    return this.extractNavigationFromOnPress(onPressContent);
  }

  private extractPressableAction(content: string, buttonText: string): WidgetAction | undefined {
    // Find Pressable containing this text and extract onPress
    const pressableBlockRegex = new RegExp(
      `<Pressable[^{]*onPress=\{([^}]+)\}[^{]*<Text[^>]*>${this.escapeRegex(buttonText)}</Text>[^{]*</Pressable>`,
      'gs'
    );

    const match = pressableBlockRegex.exec(content);
    if (!match) return undefined;

    const onPressContent = match[1];
    return this.extractNavigationFromOnPress(onPressContent);
  }

  private extractButtonAction(content: string, buttonText: string): WidgetAction | undefined {
    // Find Button with this title and extract onPress
    const buttonBlockRegex = new RegExp(
      `<Button[^>]*title=["']${this.escapeRegex(buttonText)}["'][^>]*onPress=\{([^}]+)\}`,
      'gs'
    );

    const match = buttonBlockRegex.exec(content);
    if (!match) return undefined;

    const onPressContent = match[1];
    return this.extractNavigationFromOnPress(onPressContent);
  }

  private extractNavigationFromOnPress(onPressContent: string): WidgetAction | undefined {
    // React Navigation patterns
    const navigateMatch = /navigation\.navigate\s*\(\s*["']([^"']+)["']/i.exec(onPressContent);
    if (navigateMatch) {
      return {
        type: 'navigation',
        target: navigateMatch[1],
        description: `Navigate to ${navigateMatch[1]}`,
      };
    }

    const pushMatch = /navigation\.push\s*\(\s*["']([^"']+)["']/i.exec(onPressContent);
    if (pushMatch) {
      return {
        type: 'navigation',
        target: pushMatch[1],
        description: `Push to ${pushMatch[1]}`,
      };
    }

    // Expo Router patterns
    const routerMatch = /router\.push\s*\(\s*["']([^"']+)["']/i.exec(onPressContent);
    if (routerMatch) {
      return {
        type: 'navigation',
        target: routerMatch[1],
        description: `Router push to ${routerMatch[1]}`,
      };
    }

    return undefined;
  }

  private removeDialogContent(content: string): string {
    // Remove Alert.alert, Modal, etc.
    const dialogPatterns = [
      /Alert\.alert\s*\([^{]*{[\s\S]*?}\s*\)/g,
      /<Modal[^>]*>[\s\S]*?<\/Modal>/g,
      /showModal\s*\([^{]*{[\s\S]*?}\s*\)/g,
    ];

    let cleanContent = content;
    for (const pattern of dialogPatterns) {
      cleanContent = cleanContent.replace(pattern, '/* dialog removed */');
    }

    return cleanContent;
  }

  private extractScreenName(fileName: string): string {
    return fileName
      .replace(/Screen|Page|View/g, '')
      .replace(/([A-Z])/g, ' $1')
      .trim();
  }

  async parseRoutes(): Promise<RouteDefinition[]> {
    const routes: RouteDefinition[] = [];

    // Find navigation configuration files
    const navFiles = await this.findFiles(['**/navigation/*.ts', '**/navigation/*.tsx', '**/routes/*.ts', '**/routes/*.tsx']);

    for (const file of navFiles) {
      const content = await fs.readFile(file, 'utf-8');

      // Extract React Navigation route definitions
      const routeRegex = /createStackNavigator|createBottomTabNavigator|createDrawerNavigator/g;
      if (routeRegex.test(content)) {
        // Parse navigator configuration
        const screenRegex = /(\w+):\s*{\s*screen:\s*(\w+)/g;
        let match;
        while ((match = screenRegex.exec(content)) !== null) {
          routes.push({
            name: match[1],
            path: match[1],
            screen: match[2],
          });
        }
      }
    }

    return routes;
  }

  private async findFiles(patterns: string[]): Promise<string[]> {
    // Simple glob implementation for React Native
    const files: string[] = [];
    const scanDir = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (!['node_modules', 'build', '.git', '__tests__', 'test'].includes(entry.name)) {
              await scanDir(fullPath);
            }
          } else if (entry.isFile()) {
            const fileName = entry.name.toLowerCase();
            if (fileName.endsWith('.ts') || fileName.endsWith('.tsx') || fileName.endsWith('.js') || fileName.endsWith('.jsx')) {
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
