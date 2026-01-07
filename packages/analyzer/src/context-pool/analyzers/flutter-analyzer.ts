/**
 * Flutter Code Analyzer
 * 
 * Analyzes Flutter apps to extract:
 * - Widgets (Text, Button, Icon, etc.)
 * - Navigation (onPressed, onTap, context.push, etc.)
 * - Routes (GoRouter, MaterialApp routes, etc.)
 */

import fs from 'fs-extra';
import path from 'path';
import type { WidgetInfo, ScreenContext, RouteDefinition, NavigationTrigger } from '../types.js';

export class FlutterAnalyzer {
  private projectDir: string;

  constructor(projectDir: string) {
    this.projectDir = projectDir;
  }

  /**
   * Analyze a Flutter screen file
   */
  async analyzeScreen(filePath: string): Promise<ScreenContext> {
    const content = await fs.readFile(filePath, 'utf-8');
    const relativePath = path.relative(this.projectDir, filePath);
    const fileName = path.basename(filePath, path.extname(filePath));

    const screenName = this.extractScreenName(fileName);
    const widgets = this.extractWidgets(content);
    const navigation = this.analyzeNavigation(content, screenName);
    const testability = this.analyzeTestability(widgets);

    return {
      name: screenName,
      filePath: relativePath,
      type: this.determineScreenType(content),
      widgets,
      navigation,
      testability,
    };
  }

  /**
   * Extract widgets from Flutter code
   */
  private extractWidgets(content: string): WidgetInfo[] {
    const widgets: WidgetInfo[] = [];

    // Remove dialog/modal content before extracting widgets
    // These are not immediately visible on screen load
    const contentWithoutDialogs = this.removeDialogContent(content);

    // Extract Text widgets: Text('Hello'), Text("Hello")
    const textRegex = /Text\s*\(\s*['"]([^'"]+)['"]/g;
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

    // Extract ElevatedButton/TextButton with child Text (use cleaned content)
    // Use a more flexible pattern that handles nested parentheses
    const buttonRegex = /(ElevatedButton|TextButton|OutlinedButton|IconButton|FloatingActionButton)\s*\([\s\S]*?child:\s*(?:const\s+)?Text\s*\(\s*['"]([^'"]+)['"]\s*\)/gs;
    while ((match = buttonRegex.exec(contentWithoutDialogs)) !== null) {
      const buttonType = match[1];
      const buttonText = match[2].trim();
      
      // Check if button has navigation (use original content for full context)
      const action = this.extractButtonAction(content, buttonText);
      
      widgets.push({
        type: 'button',
        label: buttonText,
        action,
      });
    }

    // Extract Icons: Icons.save, Icons.menu, etc.
    const iconRegex = /Icons\.(\w+)/g;
    while ((match = iconRegex.exec(contentWithoutDialogs)) !== null) {
      widgets.push({
        type: 'icon',
        semanticLabel: match[1],
      });
    }

    // Extract TextField/TextFormField
    const inputRegex = /(TextField|TextFormField)\s*\([^)]*(?:decoration:\s*InputDecoration\s*\([^)]*labelText:\s*['"]([^'"]+)['"]\))?/gs;
    while ((match = inputRegex.exec(contentWithoutDialogs)) !== null) {
      if (match[2]) {
        widgets.push({
          type: 'input',
          label: match[2].trim(),
        });
      }
    }

    return widgets;
  }

  /**
   * Extract button action (navigation)
   */
  private extractButtonAction(content: string, buttonText: string): WidgetAction | undefined {
    // Find button block containing this text
    // Pattern 1: onPressed before child (most common)
    // ElevatedButton(onPressed: () { ... }, child: Text('...'))
    const buttonBlockRegex1 = new RegExp(
      `(ElevatedButton|TextButton|OutlinedButton|IconButton)\\s*\\([^{]*onPressed:\\s*\\([^)]*\\)\\s*\\{([^}]+)\\}[^{]*child:\\s*(?:const\\s+)?Text\\s*\\(\\s*['"]${this.escapeRegex(buttonText)}['"]`,
      'gs'
    );

    let match = buttonBlockRegex1.exec(content);
    if (match) {
      const onPressedContent = match[2];
      return this.extractNavigationFromOnPressed(onPressedContent);
    }

    // Pattern 2: child before onPressed (less common)
    // ElevatedButton(child: Text('...'), onPressed: () { ... })
    const buttonBlockRegex2 = new RegExp(
      `child:\\s*(?:const\\s+)?Text\\s*\\(\\s*['"]${this.escapeRegex(buttonText)}['"][^{]*onPressed:\\s*\\([^)]*\\)\\s*\\{([^}]+)\\}`,
      'gs'
    );

    match = buttonBlockRegex2.exec(content);
    if (match) {
      const onPressedContent = match[1];
      return this.extractNavigationFromOnPressed(onPressedContent);
    }

    return undefined;
  }

  /**
   * Extract navigation target from onPressed content
   */
  private extractNavigationFromOnPressed(onPressedContent: string): WidgetAction | undefined {
    // context.pushNamed(RouteNames.canvas.name)
    const pushNamedRouteMatch = /context\.(?:push|pushNamed)\s*\(\s*RouteNames\.([\w]+)\.name/i.exec(onPressedContent);
    if (pushNamedRouteMatch) {
      return {
        type: 'navigation',
        target: pushNamedRouteMatch[1],
        description: `Navigate to ${pushNamedRouteMatch[1]}`,
      };
    }

    // context.goNamed(RouteNames.canvas.name)
    const goNamedRouteMatch = /context\.(?:go|goNamed)\s*\(\s*RouteNames\.([\w]+)\.name/i.exec(onPressedContent);
    if (goNamedRouteMatch) {
      return {
        type: 'navigation',
        target: goNamedRouteMatch[1],
        description: `Navigate to ${goNamedRouteMatch[1]}`,
      };
    }

    // context.pushNamed('screenName')
    const pushNamedMatch = /context\.(?:push|pushNamed)\s*\(\s*['"]([\w.]+)['"]/i.exec(onPressedContent);
    if (pushNamedMatch) {
      return {
        type: 'navigation',
        target: pushNamedMatch[1],
        description: `Navigate to ${pushNamedMatch[1]}`,
      };
    }

    // Navigator.pushNamed
    const navigatorMatch = /Navigator\.pushNamed\s*\([^,]+,\s*['"]([\w.]+)['"]/i.exec(onPressedContent);
    if (navigatorMatch) {
      return {
        type: 'navigation',
        target: navigatorMatch[1],
        description: `Navigate to ${navigatorMatch[1]}`,
      };
    }

    return undefined;
  }

  /**
   * Analyze navigation patterns in the screen
   */
  private analyzeNavigation(content: string, screenName: string): {
    accessibleFrom: string[];
    accessibleVia: NavigationTrigger[];
    isInitial: boolean;
    requiresAuth: boolean;
  } {
    // Determine if this is the initial screen
    const isInitial = 
      screenName.toLowerCase().includes('home') ||
      screenName.toLowerCase().includes('main') ||
      screenName.toLowerCase().includes('splash') ||
      content.includes('initialRoute') ||
      content.includes('home:');

    // Check for auth requirements
    const requiresAuth = 
      screenName.toLowerCase().includes('profile') ||
      screenName.toLowerCase().includes('settings') ||
      screenName.toLowerCase().includes('account') ||
      content.includes('requiresAuth') ||
      content.includes('AuthGuard');

    return {
      accessibleFrom: [],  // Will be filled by navigation graph builder
      accessibleVia: [],   // Will be filled by navigation graph builder
      isInitial,
      requiresAuth,
    };
  }

  /**
   * Analyze testability of the screen
   */
  private analyzeTestability(widgets: WidgetInfo[]): {
    hasTextElements: boolean;
    hasOnlyIcons: boolean;
    testableElements: any[];
    assertionStrategy: 'text' | 'icon' | 'hybrid' | 'wait';
  } {
    const textWidgets = widgets.filter(w => w.type === 'text' || w.type === 'button');
    const iconWidgets = widgets.filter(w => w.type === 'icon');

    const hasTextElements = textWidgets.length > 0;
    const hasOnlyIcons = iconWidgets.length > 0 && textWidgets.length === 0;

    // Create testable elements for Maestro
    const testableElements = textWidgets
      .filter(w => w.value || w.label)
      .slice(0, 3)  // Max 3 assertions
      .map(w => ({
        type: w.type,
        value: w.value || w.label || '',
        maestroQuery: {
          type: 'text' as const,
          value: w.value || w.label || '',
        },
      }));

    let assertionStrategy: 'text' | 'icon' | 'hybrid' | 'wait' = 'wait';
    if (hasTextElements && iconWidgets.length === 0) {
      assertionStrategy = 'text';
    } else if (hasOnlyIcons) {
      assertionStrategy = 'icon';
    } else if (hasTextElements && iconWidgets.length > 0) {
      assertionStrategy = 'hybrid';
    }

    return {
      hasTextElements,
      hasOnlyIcons,
      testableElements,
      assertionStrategy,
    };
  }

  /**
   * Extract screen name from file name
   */
  private extractScreenName(fileName: string): string {
    return fileName
      .replace(/_screen|_page|_view/gi, '')
      .replace(/screen|page|view$/gi, '')
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Determine if file is a screen, page, or component
   */
  private determineScreenType(content: string): 'screen' | 'page' | 'view' | 'component' {
    if (content.includes('extends StatelessWidget') || content.includes('extends StatefulWidget')) {
      if (content.includes('Scaffold')) {
        return 'screen';
      }
      return 'component';
    }
    return 'screen';
  }

  /**
   * Parse GoRouter routes
   */
  async parseGoRouterRoutes(): Promise<RouteDefinition[]> {
    const routes: RouteDefinition[] = [];

    // Find router provider or router config file
    const routerFiles = await this.findFiles('**/router*.dart');
    
    for (const file of routerFiles) {
      const content = await fs.readFile(file, 'utf-8');
      
      // Look for GoRoute definitions
      const routeRegex = /GoRoute\s*\(\s*path:\s*['"]([^'"]+)['"][\s\S]*?name:\s*RouteNames\.(\w+)\.name/g;
      let match;
      
      while ((match = routeRegex.exec(content)) !== null) {
        routes.push({
          name: match[2],
          path: match[1],
          screen: this.routeNameToScreenName(match[2]),
        });
      }
    }

    return routes;
  }

  /**
   * Remove dialog/modal/alert content from code
   * These widgets are not immediately visible on screen load
   */
  private removeDialogContent(content: string): string {
    // Remove showDialog, showModalBottomSheet, showCupertinoDialog blocks
    const dialogPatterns = [
      /showDialog\s*\([^{]*{[\s\S]*?}\s*\)/g,
      /showModalBottomSheet\s*\([^{]*{[\s\S]*?}\s*\)/g,
      /showCupertinoDialog\s*\([^{]*{[\s\S]*?}\s*\)/g,
      /AlertDialog\s*\([^{]*{[\s\S]*?}\s*\)/g,
      /CupertinoAlertDialog\s*\([^{]*{[\s\S]*?}\s*\)/g,
    ];

    let cleanContent = content;
    for (const pattern of dialogPatterns) {
      cleanContent = cleanContent.replace(pattern, '/* dialog removed */');
    }

    return cleanContent;
  }

  /**
   * Convert route name to screen name
   */
  private routeNameToScreenName(routeName: string): string {
    return routeName
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Find files matching pattern
   */
  private async findFiles(pattern: string): Promise<string[]> {
    // Simple glob implementation
    const files: string[] = [];
    const scanDir = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          if (!['node_modules', 'build', '.git'].includes(entry.name)) {
            await scanDir(fullPath);
          }
        } else if (entry.isFile() && fullPath.endsWith('.dart')) {
          if (pattern.includes('router') && entry.name.includes('router')) {
            files.push(fullPath);
          }
        }
      }
    };

    await scanDir(this.projectDir);
    return files;
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

interface WidgetAction {
  type: 'navigation' | 'state_change' | 'api_call' | 'other';
  target?: string;
  description?: string;
}
