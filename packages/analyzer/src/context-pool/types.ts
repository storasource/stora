/**
 * App Context Pool - Comprehensive app understanding system
 * 
 * This module builds a complete understanding of the app structure,
 * including screens, navigation, widgets, and relationships.
 */

export interface AppContext {
  projectDir: string;
  framework: 'flutter' | 'react-native' | 'expo' | 'native' | 'unknown';
  metadata: AppContextMetadata;
  screens: ScreenContext[];
  navigationGraph: NavigationGraph;
  routes: RouteDefinition[];
  widgets: WidgetRegistry;
  stateManagement?: StateManagementInfo;
  generatedAt: Date;
  version: string;
}

export interface AppContextMetadata {
  name: string;
  bundleId: {
    ios?: string;
    android?: string;
  };
  version: string;
  framework: string;
}

export interface ScreenContext {
  name: string;
  filePath: string;
  type: 'screen' | 'page' | 'view' | 'component';
  widgets: WidgetInfo[];
  navigation: ScreenNavigation;
  testability: ScreenTestability;
}

export interface WidgetInfo {
  type: 'text' | 'button' | 'input' | 'icon' | 'image' | 'list' | 'other';
  value?: string;           // For text widgets
  label?: string;           // For buttons
  id?: string;              // Accessibility ID or key
  semanticLabel?: string;   // Semantic/accessibility label
  action?: WidgetAction;    // What happens when interacted with
}

export interface WidgetAction {
  type: 'navigation' | 'state_change' | 'api_call' | 'other';
  target?: string;          // Screen name or route for navigation
  description?: string;
}

export interface ScreenNavigation {
  accessibleFrom: string[];           // List of screen names that can navigate here
  accessibleVia: NavigationTrigger[]; // How to reach this screen
  isInitial: boolean;                 // Is this the launch screen?
  requiresAuth: boolean;              // Requires authentication?
}

export interface NavigationTrigger {
  sourceScreen: string;
  triggerWidget: string;    // Button text, icon description, etc.
  widgetType: 'button' | 'tab' | 'icon' | 'list_item';
  navigationMethod: 'push' | 'replace' | 'modal' | 'tab_switch';
}

export interface ScreenTestability {
  hasTextElements: boolean;
  hasOnlyIcons: boolean;
  testableElements: TestableElement[];
  assertionStrategy: 'text' | 'icon' | 'hybrid' | 'wait';
}

export interface TestableElement {
  type: 'text' | 'icon' | 'button';
  value: string;
  maestroQuery: MaestroQuery;
}

export interface MaestroQuery {
  type: 'text' | 'id' | 'accessibility';
  value: string;
  optional?: boolean;
}

export interface NavigationGraph {
  nodes: NavigationNode[];
  edges: NavigationEdge[];
}

export interface NavigationNode {
  screenName: string;
  isInitial: boolean;
  depth: number;  // Distance from initial screen
}

export interface NavigationEdge {
  from: string;
  to: string;
  trigger: string;  // Button text or action
  weight: number;   // Navigation cost (for shortest path)
}

export interface RouteDefinition {
  name: string;
  path: string;
  screen: string;
  params?: RouteParam[];
  guards?: string[];  // Auth guards, etc.
}

export interface RouteParam {
  name: string;
  required: boolean;
  type?: string;
}

export interface WidgetRegistry {
  screens: Map<string, WidgetInfo[]>;
  sharedWidgets: WidgetInfo[];
}

export interface StateManagementInfo {
  type: 'riverpod' | 'provider' | 'bloc' | 'redux' | 'mobx' | 'getx' | 'none';
  authProvider?: string;
  stateFiles: string[];
}

/**
 * Context Pool Builder Options
 */
export interface ContextPoolOptions {
  projectDir: string;
  deepAnalysis?: boolean;     // Analyze all files deeply
  parseNavigation?: boolean;  // Parse route definitions
  cacheResults?: boolean;     // Save to .stora/context/
}

/**
 * Context Pool Query Interface
 */
export interface ContextPoolQuery {
  // Screen queries
  findScreen(name: string): ScreenContext | undefined;
  getInitialScreen(): ScreenContext | undefined;
  getScreensAccessibleFrom(screenName: string): ScreenContext[];
  
  // Navigation queries
  getNavigationPath(from: string, to: string): NavigationEdge[];
  getShortestPath(from: string, to: string): string[];
  
  // Widget queries
  getScreenWidgets(screenName: string): WidgetInfo[];
  getTestableElements(screenName: string): TestableElement[];
  
  // Route queries
  getRouteForScreen(screenName: string): RouteDefinition | undefined;
}
