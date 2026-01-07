/**
 * Context Pool Builder
 *
 * Orchestrates the analysis of an entire app to build a comprehensive
 * understanding of screens, navigation, and relationships.
 */

import fs from 'fs-extra';
import path from 'path';
import type {
  AppContext,
  ScreenContext,
  NavigationGraph,
  NavigationNode,
  NavigationEdge,
  RouteDefinition,
  ContextPoolOptions,
} from './types.js';
import { FlutterAnalyzer } from './analyzers/flutter-analyzer.js';
import { ReactNativeAnalyzer } from './analyzers/react-native-analyzer.js';
import { SwiftUIAnalyzer } from './analyzers/swiftui-analyzer.js';
import { KotlinAnalyzer } from './analyzers/kotlin-analyzer.js';

export class ContextPoolBuilder {
  private projectDir: string;
  private framework: string;
  private options: ContextPoolOptions;

  constructor(options: ContextPoolOptions) {
    this.projectDir = options.projectDir;
    this.options = options;
    this.framework = 'unknown';
  }

  /**
   * Build complete app context
   */
  async build(): Promise<AppContext> {
    // Detect framework
    this.framework = await this.detectFramework();

    // Get appropriate analyzer
    const analyzer = await this.getAnalyzer();

    // Find all screen files
    const screenFiles = await this.findScreenFiles();

    // Analyze each screen
    const screens: ScreenContext[] = [];
    for (const file of screenFiles) {
      try {
        const screenContext = await analyzer.analyzeScreen(file);
        screens.push(screenContext);
      } catch (error) {
        console.warn(`Failed to analyze ${file}:`, error);
      }
    }

    // Parse routes if available
    let routes: RouteDefinition[] = [];
    if (this.options.parseNavigation && 'parseRoutes' in analyzer) {
      routes = await (analyzer as any).parseRoutes();
    }

    // Build navigation graph
    const navigationGraph = this.buildNavigationGraph(screens, routes);

    // Extract metadata
    const metadata = await this.extractMetadata();

    const context: AppContext = {
      projectDir: this.projectDir,
      framework: this.framework as any,
      metadata,
      screens,
      navigationGraph,
      routes,
      widgets: {
        screens: new Map(screens.map((s) => [s.name, s.widgets])),
        sharedWidgets: [],
      },
      generatedAt: new Date(),
      version: '1.0.0',
    };

    // Cache if requested
    if (this.options.cacheResults) {
      await this.saveContext(context);
    }

    return context;
  }

  /**
   * Detect app framework
   */
  private async detectFramework(): Promise<string> {
    // Check for Flutter
    if (await this.detectFlutter()) {
      return 'flutter';
    }

    // Check for React Native
    if (await this.detectReactNative()) {
      return 'react-native';
    }

    // Check for Expo
    if (await this.detectExpo()) {
      return 'expo';
    }

    // Check for iOS
    if (await this.detectiOS()) {
      return 'ios';
    }

    // Check for Android
    if (await this.detectAndroid()) {
      return 'android';
    }

    return 'unknown';
  }

  /**
   * Get analyzer for detected framework
   */
  private async getAnalyzer() {
    switch (this.framework) {
      case 'flutter':
        return new FlutterAnalyzer(this.projectDir);
      case 'react-native':
      case 'expo':
        return new ReactNativeAnalyzer(this.projectDir);
      case 'ios':
        return new SwiftUIAnalyzer(this.projectDir);
      case 'android':
        return new KotlinAnalyzer(this.projectDir);
      case 'native':
        // For mixed native projects, try to detect which one
        if (await this.detectiOS()) {
          return new SwiftUIAnalyzer(this.projectDir);
        } else if (await this.detectAndroid()) {
          return new KotlinAnalyzer(this.projectDir);
        }
        // Fallback to SwiftUI
        return new SwiftUIAnalyzer(this.projectDir);
      default:
        // Default to Flutter analyzer as it's most complete
        return new FlutterAnalyzer(this.projectDir);
    }
  }

  /**
   * Detect iOS project
   */
  private async detectiOS(): Promise<boolean> {
    try {
      const iosDir = path.join(this.projectDir, 'ios');
      if (await fs.pathExists(iosDir)) {
        const files = await fs.readdir(iosDir);
        return files.some((f) => f.endsWith('.xcodeproj') || f.endsWith('.xcworkspace'));
      }
    } catch (error) {
      // Directory doesn't exist
    }
    return false;
  }

  /**
   * Detect Android project
   */
  private async detectAndroid(): Promise<boolean> {
    try {
      return await fs.pathExists(path.join(this.projectDir, 'android', 'build.gradle'));
    } catch (error) {
      return false;
    }
  }

  /**
   * Detect Flutter project
   */
  private async detectFlutter(): Promise<boolean> {
    return await fs.pathExists(path.join(this.projectDir, 'pubspec.yaml'));
  }

  /**
   * Detect React Native project
   */
  private async detectReactNative(): Promise<boolean> {
    const packageJson = path.join(this.projectDir, 'package.json');
    if (await fs.pathExists(packageJson)) {
      const pkg = await fs.readJSON(packageJson);
      if (pkg.dependencies?.['react-native']) {
        return true;
      }
    }
    return false;
  }

  /**
   * Detect Expo project
   */
  private async detectExpo(): Promise<boolean> {
    const packageJson = path.join(this.projectDir, 'package.json');
    if (await fs.pathExists(packageJson)) {
      const pkg = await fs.readJSON(packageJson);
      if (pkg.dependencies?.['expo']) {
        return true;
      }
    }
    return false;
  }

  /**
   * Find all screen files based on framework
   */
  private async findScreenFiles(): Promise<string[]> {
    const screenFiles: string[] = [];

    const patterns = this.getScreenPatterns();

    for (const pattern of patterns) {
      const dir = path.join(this.projectDir, pattern.dir);
      if (await fs.pathExists(dir)) {
        const files = await this.walkDirectory(dir, pattern.extensions, pattern.namePatterns);
        screenFiles.push(...files);
      }
    }

    return screenFiles;
  }

  /**
   * Get screen file patterns for framework
   */
  private getScreenPatterns() {
    switch (this.framework) {
      case 'flutter':
        return [
          {
            dir: 'lib/screens',
            extensions: ['.dart'],
            namePatterns: ['screen', 'page', 'view'],
          },
          {
            dir: 'lib/pages',
            extensions: ['.dart'],
            namePatterns: ['screen', 'page', 'view'],
          },
          {
            dir: 'lib/presentation/screens',
            extensions: ['.dart'],
            namePatterns: ['screen', 'page', 'view'],
          },
        ];
      case 'react-native':
      case 'expo':
        return [
          {
            dir: 'src/screens',
            extensions: ['.tsx', '.jsx', '.ts', '.js'],
            namePatterns: ['screen', 'page', 'view'],
          },
          {
            dir: 'app/screens',
            extensions: ['.tsx', '.jsx', '.ts', '.js'],
            namePatterns: ['screen', 'page', 'view'],
          },
        ];
      case 'native':
        return [
          {
            dir: 'ios',
            extensions: ['.swift'],
            namePatterns: ['view', 'screen', 'controller'],
          },
          {
            dir: 'android/app/src/main',
            extensions: ['.kt', '.java'],
            namePatterns: ['activity', 'fragment', 'screen'],
          },
        ];
      default:
        return [];
    }
  }

  /**
   * Walk directory and find matching files
   */
  private async walkDirectory(dir: string, extensions: string[], namePatterns: string[]): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip common non-screen directories
          if (['node_modules', 'build', 'dist', '.git', '__tests__', 'test'].includes(entry.name)) {
            continue;
          }
          files.push(...(await this.walkDirectory(fullPath, extensions, namePatterns)));
        } else if (entry.isFile()) {
          const fileName = entry.name.toLowerCase();

          // Check extension
          if (!extensions.some((ext) => fileName.endsWith(ext))) {
            continue;
          }

          // Check name patterns
          if (namePatterns.some((pattern) => fileName.includes(pattern))) {
            // Skip test files
            if (!fileName.includes('.test.') && !fileName.includes('.spec.')) {
              files.push(fullPath);
            }
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }

    return files;
  }

  /**
   * Build navigation graph from screens and routes
   */
  private buildNavigationGraph(screens: ScreenContext[], routes: RouteDefinition[]): NavigationGraph {
    const nodes: NavigationNode[] = [];
    const edges: NavigationEdge[] = [];

    // Create nodes
    for (const screen of screens) {
      nodes.push({
        screenName: screen.name,
        isInitial: screen.navigation.isInitial,
        depth: screen.navigation.isInitial ? 0 : 999, // Will be recalculated
      });
    }

    // Create edges from button actions
    for (const screen of screens) {
      for (const widget of screen.widgets) {
        if (widget.action?.type === 'navigation' && widget.action.target) {
          const targetScreen = this.findScreenByRoute(screens, routes, widget.action.target);

          if (targetScreen) {
            edges.push({
              from: screen.name,
              to: targetScreen.name,
              trigger: widget.label || widget.value || 'unknown',
              weight: 1,
            });

            // Update screen navigation info
            if (!targetScreen.navigation.accessibleFrom.includes(screen.name)) {
              targetScreen.navigation.accessibleFrom.push(screen.name);
            }

            targetScreen.navigation.accessibleVia.push({
              sourceScreen: screen.name,
              triggerWidget: widget.label || widget.value || 'unknown',
              widgetType: widget.type === 'button' ? 'button' : 'icon',
              navigationMethod: 'push',
            });
          }
        }
      }
    }

    // Calculate depths using BFS
    this.calculateDepths(nodes, edges);

    return { nodes, edges };
  }

  /**
   * Find screen by route name or target
   */
  private findScreenByRoute(
    screens: ScreenContext[],
    routes: RouteDefinition[],
    target: string
  ): ScreenContext | undefined {
    // Try direct screen name match
    let screen = screens.find(
      (s) =>
        s.name.toLowerCase() === target.toLowerCase() ||
        s.name.toLowerCase().replace(/\s/g, '') === target.toLowerCase().replace(/\s/g, '')
    );

    if (screen) return screen;

    // Try route name match
    const route = routes.find((r) => r.name.toLowerCase() === target.toLowerCase());
    if (route) {
      screen = screens.find((s) => s.name.toLowerCase() === route.screen.toLowerCase());
    }

    return screen;
  }

  /**
   * Calculate screen depths from initial screen
   */
  private calculateDepths(nodes: NavigationNode[], edges: NavigationEdge[]): void {
    const initialNodes = nodes.filter((n) => n.isInitial);
    if (initialNodes.length === 0) return;

    // BFS to calculate depths
    const queue: Array<{ name: string; depth: number }> = [];
    const visited = new Set<string>();

    for (const initial of initialNodes) {
      queue.push({ name: initial.screenName, depth: 0 });
      visited.add(initial.screenName);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;

      // Update node depth
      const node = nodes.find((n) => n.screenName === current.name);
      if (node) {
        node.depth = current.depth;
      }

      // Add connected nodes
      const outgoingEdges = edges.filter((e) => e.from === current.name);
      for (const edge of outgoingEdges) {
        if (!visited.has(edge.to)) {
          visited.add(edge.to);
          queue.push({ name: edge.to, depth: current.depth + 1 });
        }
      }
    }
  }

  /**
   * Extract app metadata
   */
  private async extractMetadata() {
    let name = 'App';
    let bundleId: any = {};
    let version = '1.0.0';

    // Flutter
    const pubspecPath = path.join(this.projectDir, 'pubspec.yaml');
    if (await fs.pathExists(pubspecPath)) {
      const content = await fs.readFile(pubspecPath, 'utf-8');
      const nameMatch = /name:\s*(\S+)/.exec(content);
      const versionMatch = /version:\s*(\S+)/.exec(content);
      if (nameMatch) name = nameMatch[1];
      if (versionMatch) version = versionMatch[1].split('+')[0];
    }

    // React Native / Expo
    const packagePath = path.join(this.projectDir, 'package.json');
    if (await fs.pathExists(packagePath)) {
      const pkg = await fs.readJSON(packagePath);
      name = pkg.name || name;
      version = pkg.version || version;
    }

    return {
      name,
      bundleId,
      version,
      framework: this.framework,
    };
  }

  /**
   * Save context to cache
   */
  private async saveContext(context: AppContext): Promise<void> {
    const contextDir = path.join(this.projectDir, '.stora', 'context');
    await fs.ensureDir(contextDir);

    const contextPath = path.join(contextDir, 'app-context.json');

    // Convert Map to object for JSON serialization
    const serializable = {
      ...context,
      widgets: {
        screens: Object.fromEntries(context.widgets.screens),
        sharedWidgets: context.widgets.sharedWidgets,
      },
    };

    await fs.writeJSON(contextPath, serializable, { spaces: 2 });
  }

  /**
   * Load cached context
   */
  static async loadContext(projectDir: string): Promise<AppContext | null> {
    const contextPath = path.join(projectDir, '.stora', 'context', 'app-context.json');

    if (!(await fs.pathExists(contextPath))) {
      return null;
    }

    try {
      const data = await fs.readJSON(contextPath);

      // Restore Map from object
      data.widgets.screens = new Map(Object.entries(data.widgets.screens));
      data.generatedAt = new Date(data.generatedAt);

      return data as AppContext;
    } catch (error) {
      return null;
    }
  }
}
