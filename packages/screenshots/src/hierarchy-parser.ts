/**
 * Maestro UI Hierarchy Parser
 *
 * Parses the raw JSON from `maestro hierarchy` into a structured format
 * with assigned element IDs for reliable interaction targeting.
 *
 * Supports both iOS and Android hierarchy formats with normalized output.
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Raw Maestro TreeNode structure (from `maestro hierarchy` output)
 */
export interface MaestroTreeNode {
  attributes?: {
    bounds?: string; // "[x1,y1][x2,y2]" format
    text?: string;
    'resource-id'?: string;
    class?: string;
    package?: string;
    'content-desc'?: string;
    accessibilityText?: string; // iOS
    title?: string; // iOS
    value?: string; // iOS
    hintText?: string;
    checkable?: string;
    checked?: string;
    clickable?: string;
    enabled?: string;
    focusable?: string;
    focused?: string;
    scrollable?: string;
    'long-clickable'?: string;
    password?: string;
    selected?: string;
    'visible-to-user'?: string;
    'important-for-accessibility'?: string;
  };
  children?: MaestroTreeNode[];
  clickable?: boolean;
  enabled?: boolean;
  focused?: boolean;
  checked?: boolean;
  selected?: boolean;
}

/**
 * Parsed bounding box with calculated center point
 */
export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  area: number;
}

/**
 * Normalized UI element with assigned ID
 */
export interface UIElement {
  /** Unique element ID for targeting */
  id: number;
  /** Depth in the hierarchy tree (0 = root) */
  depth: number;
  /** Element type/class */
  type: string;
  /** Visible text content */
  text: string | null;
  /** Resource ID / accessibility identifier */
  resourceId: string | null;
  /** Content description / accessibility label */
  accessibilityLabel: string | null;
  /** Hint or placeholder text */
  hintText: string | null;
  /** Bounding box with coordinates */
  bounds: BoundingBox | null;
  /** Element states */
  states: {
    clickable: boolean;
    enabled: boolean;
    focused: boolean;
    checked: boolean;
    selected: boolean;
    scrollable: boolean;
    password: boolean;
  };
  /** Parent element ID (-1 for root) */
  parentId: number;
  /** Child element IDs */
  childIds: number[];
  /** Platform-specific raw attributes */
  rawAttributes: Record<string, string>;
}

/**
 * Parsed UI hierarchy with indexed elements
 */
export interface ParsedHierarchy {
  /** All elements indexed by ID */
  elements: Map<number, UIElement>;
  /** Flat array of all elements */
  elementList: UIElement[];
  /** Only clickable/interactive elements */
  interactiveElements: UIElement[];
  /** Elements with visible text */
  textElements: UIElement[];
  /** Root element ID */
  rootId: number;
  /** Maximum tree depth */
  maxDepth: number;
  /** Total element count */
  totalCount: number;
  /** Semantics coverage (% of elements with proper labels) */
  semanticsCoverage: number;
  /** Screen dimensions (inferred from root bounds) */
  screenBounds: BoundingBox | null;
  /** Detected platform */
  platform: 'ios' | 'android' | 'unknown';
}

// =============================================================================
// Constants
// =============================================================================

/** Minimum element area to be considered interactive (filters tiny elements) */
const MIN_INTERACTIVE_AREA = 100; // pixels²

/** Element types that are typically interactive */
const INTERACTIVE_TYPES = new Set([
  // Android
  'android.widget.Button',
  'android.widget.ImageButton',
  'android.widget.EditText',
  'android.widget.CheckBox',
  'android.widget.RadioButton',
  'android.widget.Switch',
  'android.widget.ToggleButton',
  'android.widget.Spinner',
  'android.widget.SeekBar',
  'android.widget.ImageView',
  'android.widget.TextView',
  'android.view.View',
  // iOS (derived from accessibilityText presence)
  'Button',
  'TextField',
  'SecureTextField',
  'Switch',
  'Slider',
  'Picker',
  'Image',
  'StaticText',
  'Link',
  'Cell',
  'Icon',
]);

/** Map Android class names to semantic HTML-like types */
const TYPE_MAPPING: Record<string, string> = {
  'android.widget.Button': 'button',
  'android.widget.ImageButton': 'button',
  'android.widget.EditText': 'input',
  'android.widget.TextView': 'text',
  'android.widget.ImageView': 'image',
  'android.widget.CheckBox': 'checkbox',
  'android.widget.RadioButton': 'radio',
  'android.widget.Switch': 'switch',
  'android.widget.ToggleButton': 'toggle',
  'android.widget.Spinner': 'select',
  'android.widget.SeekBar': 'slider',
  'android.widget.ProgressBar': 'progress',
  'android.widget.ScrollView': 'scroll',
  'android.widget.ListView': 'list',
  'android.widget.RecyclerView': 'list',
  'android.view.View': 'view',
  'android.view.ViewGroup': 'container',
  'android.widget.FrameLayout': 'container',
  'android.widget.LinearLayout': 'container',
  'android.widget.RelativeLayout': 'container',
  'androidx.constraintlayout.widget.ConstraintLayout': 'container',
  'androidx.recyclerview.widget.RecyclerView': 'list',
  'androidx.appcompat.widget.AppCompatButton': 'button',
  'androidx.appcompat.widget.AppCompatEditText': 'input',
  'androidx.appcompat.widget.AppCompatTextView': 'text',
  'androidx.appcompat.widget.AppCompatImageView': 'image',
  'com.google.android.material.button.MaterialButton': 'button',
  'com.google.android.material.textfield.TextInputEditText': 'input',
};

// =============================================================================
// Parser Functions
// =============================================================================

/**
 * Parse bounds string "[x1,y1][x2,y2]" into structured BoundingBox
 */
export function parseBounds(boundsStr: string | undefined): BoundingBox | null {
  if (!boundsStr) return null;

  // Match pattern: [x1,y1][x2,y2]
  const match = boundsStr.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (!match) return null;

  const x1 = parseInt(match[1], 10);
  const y1 = parseInt(match[2], 10);
  const x2 = parseInt(match[3], 10);
  const y2 = parseInt(match[4], 10);

  const width = x2 - x1;
  const height = y2 - y1;

  return {
    x1,
    y1,
    x2,
    y2,
    width,
    height,
    centerX: x1 + width / 2,
    centerY: y1 + height / 2,
    area: width * height,
  };
}

/**
 * Extract text content from node attributes (handles iOS/Android differences)
 */
function extractText(attrs: MaestroTreeNode['attributes']): string | null {
  if (!attrs) return null;

  // Priority: text > accessibilityText > title > value
  const text = attrs.text?.trim();
  if (text) return text;

  const accessibilityText = attrs.accessibilityText?.trim();
  if (accessibilityText) return accessibilityText;

  const title = attrs.title?.trim();
  if (title) return title;

  const value = attrs.value?.trim();
  if (value) return value;

  return null;
}

/**
 * Extract accessibility label from node attributes
 */
function extractAccessibilityLabel(
  attrs: MaestroTreeNode['attributes']
): string | null {
  if (!attrs) return null;

  // Priority: content-desc > accessibilityText
  const contentDesc = attrs['content-desc']?.trim();
  if (contentDesc) return contentDesc;

  const accessibilityText = attrs.accessibilityText?.trim();
  if (accessibilityText) return accessibilityText;

  return null;
}

/**
 * Map element class to semantic type
 */
function mapType(className: string | undefined): string {
  if (!className) return 'unknown';

  // Check direct mapping
  if (TYPE_MAPPING[className]) {
    return TYPE_MAPPING[className];
  }

  // Extract simple class name from full path
  const parts = className.split('.');
  const simpleName = parts[parts.length - 1];

  // Common patterns
  if (simpleName.toLowerCase().includes('button')) return 'button';
  if (simpleName.toLowerCase().includes('text')) return 'text';
  if (simpleName.toLowerCase().includes('image')) return 'image';
  if (simpleName.toLowerCase().includes('edit')) return 'input';
  if (simpleName.toLowerCase().includes('input')) return 'input';
  if (simpleName.toLowerCase().includes('check')) return 'checkbox';
  if (simpleName.toLowerCase().includes('switch')) return 'switch';
  if (simpleName.toLowerCase().includes('scroll')) return 'scroll';
  if (simpleName.toLowerCase().includes('list')) return 'list';
  if (simpleName.toLowerCase().includes('recycler')) return 'list';
  if (simpleName.toLowerCase().includes('layout')) return 'container';
  if (simpleName.toLowerCase().includes('view')) return 'view';

  return simpleName.toLowerCase();
}

/**
 * Detect platform from hierarchy structure
 */
function detectPlatform(node: MaestroTreeNode): 'ios' | 'android' | 'unknown' {
  const attrs = node.attributes;

  if (attrs?.class?.startsWith('android.') || attrs?.package) {
    return 'android';
  }

  if (attrs?.accessibilityText !== undefined || attrs?.title !== undefined) {
    return 'ios';
  }

  // Check children recursively
  if (node.children) {
    for (const child of node.children) {
      const platform = detectPlatform(child);
      if (platform !== 'unknown') return platform;
    }
  }

  return 'unknown';
}

/**
 * Parse boolean attribute value
 */
function parseBoolean(value: string | boolean | undefined): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return false;
}

/**
 * Parse a single node into UIElement
 */
function parseNode(
  node: MaestroTreeNode,
  id: number,
  depth: number,
  parentId: number
): UIElement {
  const attrs = node.attributes || {};

  const bounds = parseBounds(attrs.bounds);
  const type = mapType(attrs.class);
  const text = extractText(attrs);
  const accessibilityLabel = extractAccessibilityLabel(attrs);

  // Determine clickable state from multiple sources
  const isClickable =
    parseBoolean(node.clickable) ||
    parseBoolean(attrs.clickable) ||
    (type === 'button' && bounds !== null && bounds.area > MIN_INTERACTIVE_AREA);

  return {
    id,
    depth,
    type,
    text,
    resourceId: attrs['resource-id'] || null,
    accessibilityLabel,
    hintText: attrs.hintText || null,
    bounds,
    states: {
      clickable: isClickable,
      enabled: parseBoolean(node.enabled) || parseBoolean(attrs.enabled),
      focused: parseBoolean(node.focused) || parseBoolean(attrs.focused),
      checked: parseBoolean(node.checked) || parseBoolean(attrs.checked),
      selected: parseBoolean(node.selected) || parseBoolean(attrs.selected),
      scrollable: parseBoolean(attrs.scrollable),
      password: parseBoolean(attrs.password),
    },
    parentId,
    childIds: [],
    rawAttributes: attrs as Record<string, string>,
  };
}

/**
 * Recursively traverse and parse the hierarchy tree
 */
function traverseTree(
  node: MaestroTreeNode,
  elements: UIElement[],
  parentId: number,
  depth: number
): number {
  const id = elements.length;
  const element = parseNode(node, id, depth, parentId);
  elements.push(element);

  // Update parent's childIds
  if (parentId >= 0 && elements[parentId]) {
    elements[parentId].childIds.push(id);
  }

  // Process children
  if (node.children) {
    for (const child of node.children) {
      traverseTree(child, elements, id, depth + 1);
    }
  }

  return id;
}

/**
 * Calculate semantics coverage score
 */
function calculateSemanticsCoverage(elements: UIElement[]): number {
  const interactiveElements = elements.filter(
    (el) =>
      el.states.clickable &&
      el.bounds !== null &&
      el.bounds.area > MIN_INTERACTIVE_AREA
  );

  if (interactiveElements.length === 0) return 100;

  const withLabels = interactiveElements.filter(
    (el) =>
      el.text !== null ||
      el.accessibilityLabel !== null ||
      el.resourceId !== null
  );

  return Math.round((withLabels.length / interactiveElements.length) * 100);
}

// =============================================================================
// Main Parser
// =============================================================================

/**
 * Parse raw Maestro hierarchy JSON into structured ParsedHierarchy
 *
 * @param rawHierarchy - Raw JSON output from `maestro hierarchy`
 * @returns Parsed hierarchy with indexed elements
 */
export function parseHierarchy(rawHierarchy: unknown): ParsedHierarchy {
  const root = rawHierarchy as MaestroTreeNode;

  if (!root) {
    return createEmptyHierarchy();
  }

  const elementList: UIElement[] = [];
  traverseTree(root, elementList, -1, 0);

  const elements = new Map<number, UIElement>();
  for (const el of elementList) {
    elements.set(el.id, el);
  }

  const interactiveElements = elementList.filter(
    (el) =>
      el.states.clickable &&
      el.states.enabled &&
      el.bounds !== null &&
      el.bounds.area > MIN_INTERACTIVE_AREA
  );

  const textElements = elementList.filter((el) => el.text !== null);

  const maxDepth = Math.max(...elementList.map((el) => el.depth), 0);
  const semanticsCoverage = calculateSemanticsCoverage(elementList);
  const platform = detectPlatform(root);

  // Get screen bounds from root element
  const screenBounds = elementList[0]?.bounds || null;

  return {
    elements,
    elementList,
    interactiveElements,
    textElements,
    rootId: 0,
    maxDepth,
    totalCount: elementList.length,
    semanticsCoverage,
    screenBounds,
    platform,
  };
}

/**
 * Create empty hierarchy for error cases
 */
function createEmptyHierarchy(): ParsedHierarchy {
  return {
    elements: new Map(),
    elementList: [],
    interactiveElements: [],
    textElements: [],
    rootId: -1,
    maxDepth: 0,
    totalCount: 0,
    semanticsCoverage: 0,
    screenBounds: null,
    platform: 'unknown',
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Find element by resource ID
 */
export function findByResourceId(
  hierarchy: ParsedHierarchy,
  resourceId: string
): UIElement | undefined {
  return hierarchy.elementList.find((el) => el.resourceId === resourceId);
}

/**
 * Find elements containing specific text
 */
export function findByText(
  hierarchy: ParsedHierarchy,
  text: string,
  exact: boolean = false
): UIElement[] {
  const lowerText = text.toLowerCase();
  return hierarchy.elementList.filter((el) => {
    if (!el.text) return false;
    if (exact) return el.text === text;
    return el.text.toLowerCase().includes(lowerText);
  });
}

/**
 * Find clickable elements within a bounding region
 */
export function findClickableInRegion(
  hierarchy: ParsedHierarchy,
  region: { x1: number; y1: number; x2: number; y2: number }
): UIElement[] {
  return hierarchy.interactiveElements.filter((el) => {
    if (!el.bounds) return false;
    return (
      el.bounds.centerX >= region.x1 &&
      el.bounds.centerX <= region.x2 &&
      el.bounds.centerY >= region.y1 &&
      el.bounds.centerY <= region.y2
    );
  });
}

/**
 * Get element's full path as string (for debugging)
 */
export function getElementPath(
  hierarchy: ParsedHierarchy,
  elementId: number
): string {
  const path: string[] = [];
  let currentId = elementId;

  while (currentId >= 0) {
    const el = hierarchy.elements.get(currentId);
    if (!el) break;

    const label =
      el.text || el.resourceId || el.accessibilityLabel || el.type;
    path.unshift(`${el.type}[${el.id}]${label ? `:${label}` : ''}`);
    currentId = el.parentId;
  }

  return path.join(' > ');
}

/**
 * Generate HTML-like encoding for LLM consumption (Revyl-style)
 */
export function toSemanticHTML(
  hierarchy: ParsedHierarchy,
  options: { includeNonInteractive?: boolean; maxElements?: number } = {}
): string {
  const { includeNonInteractive = false, maxElements = 50 } = options;

  const elements = includeNonInteractive
    ? hierarchy.elementList
    : hierarchy.interactiveElements;

  const lines: string[] = ['<ui>'];

  for (const el of elements.slice(0, maxElements)) {
    if (!el.bounds || el.bounds.area < MIN_INTERACTIVE_AREA) continue;

    const tag = el.type;
    const attrs: string[] = [`id="${el.id}"`];

    if (el.resourceId) {
      const className = el.resourceId.split('/').pop() || el.resourceId;
      attrs.push(`class="${className}"`);
    }

    if (el.accessibilityLabel && el.accessibilityLabel !== el.text) {
      attrs.push(`aria-label="${el.accessibilityLabel}"`);
    }

    const indent = '  '.repeat(Math.min(el.depth, 4));
    const content = el.text || '';
    const attrStr = attrs.join(' ');

    lines.push(`${indent}<${tag} ${attrStr}>${content}</${tag}>`);
  }

  lines.push('</ui>');
  return lines.join('\n');
}

/**
 * Generate compact element list for LLM prompts
 */
export function toElementList(
  hierarchy: ParsedHierarchy,
  options: { maxElements?: number; includeCoordinates?: boolean } = {}
): string {
  const { maxElements = 30, includeCoordinates = true } = options;

  const lines: string[] = [];

  for (const el of hierarchy.interactiveElements.slice(0, maxElements)) {
    if (!el.bounds) continue;

    const parts: string[] = [`[${el.id}]`, el.type];

    if (el.text) {
      parts.push(`"${el.text.slice(0, 40)}${el.text.length > 40 ? '...' : ''}"`);
    } else if (el.accessibilityLabel) {
      parts.push(`(${el.accessibilityLabel.slice(0, 40)})`);
    } else if (el.resourceId) {
      parts.push(`#${el.resourceId.split('/').pop()}`);
    }

    if (includeCoordinates) {
      // Convert to percentage for Maestro compatibility
      const screenWidth = hierarchy.screenBounds?.width || 1080;
      const screenHeight = hierarchy.screenBounds?.height || 1920;
      const xPercent = Math.round((el.bounds.centerX / screenWidth) * 100);
      const yPercent = Math.round((el.bounds.centerY / screenHeight) * 100);
      parts.push(`@(${xPercent}%,${yPercent}%)`);
    }

    lines.push(parts.join(' '));
  }

  return lines.join('\n');
}
