import sharp from 'sharp';
import type { ParsedHierarchy, UIElement } from './hierarchy-parser.js';

interface SetOfMarkConfig {
  minArea: number;
  boxColor: { r: number; g: number; b: number };
  boxWidth: number;
  labelPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  fontSize: number;
  labelBgColor: { r: number; g: number; b: number };
  labelTextColor: { r: number; g: number; b: number };
  labelPadding: number;
  maxElements: number;
}

const DEFAULT_CONFIG: SetOfMarkConfig = {
  minArea: 3000,
  boxColor: { r: 255, g: 0, b: 0 },
  boxWidth: 5,
  labelPosition: 'top-left',
  fontSize: 28,
  labelBgColor: { r: 0, g: 0, b: 0 },
  labelTextColor: { r: 255, g: 255, b: 255 },
  labelPadding: 6,
  maxElements: 50,
};

function calculateLabelPosition(
  element: UIElement,
  position: SetOfMarkConfig['labelPosition'],
  fontSize: number,
  padding: number
): { x: number; y: number } {
  if (!element.bounds) {
    return { x: 0, y: 0 };
  }

  const { x1, y1, x2, y2 } = element.bounds;

  switch (position) {
    case 'top-left':
      return { x: x1 + padding, y: y1 + fontSize + padding };
    case 'top-right':
      return { x: x2 - fontSize * 2 - padding, y: y1 + fontSize + padding };
    case 'bottom-left':
      return { x: x1 + padding, y: y2 - padding };
    case 'bottom-right':
      return { x: x2 - fontSize * 2 - padding, y: y2 - padding };
    case 'center':
      return {
        x: element.bounds.centerX - fontSize,
        y: element.bounds.centerY + fontSize / 2,
      };
    default:
      return { x: x1 + padding, y: y1 + fontSize + padding };
  }
}

function createElementSVG(
  element: UIElement,
  config: SetOfMarkConfig,
  labelPos: { x: number; y: number }
): string {
  if (!element.bounds) return '';

  const { x1, y1, x2, y2 } = element.bounds;
  const { boxColor, boxWidth, fontSize, labelBgColor, labelTextColor, labelPadding } = config;

  const labelText = element.id.toString();
  const textWidth = labelText.length * fontSize * 0.6;
  const textHeight = fontSize;

  const parts: string[] = [];

  parts.push(
    `<rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}" ` +
      `fill="none" stroke="rgb(${boxColor.r},${boxColor.g},${boxColor.b})" ` +
      `stroke-width="${boxWidth}"/>`
  );

  parts.push(
    `<rect x="${labelPos.x - labelPadding}" y="${labelPos.y - textHeight - labelPadding}" ` +
      `width="${textWidth + labelPadding * 2}" height="${textHeight + labelPadding * 2}" ` +
      `fill="rgb(${labelBgColor.r},${labelBgColor.g},${labelBgColor.b})"/>`
  );

  parts.push(
    `<text x="${labelPos.x}" y="${labelPos.y}" ` +
      `font-family="Arial" font-size="${fontSize}" font-weight="bold" ` +
      `fill="rgb(${labelTextColor.r},${labelTextColor.g},${labelTextColor.b})">${labelText}</text>`
  );

  return parts.join('');
}

export async function generateSetOfMark(
  screenshotBase64: string,
  hierarchy: ParsedHierarchy,
  config: Partial<SetOfMarkConfig> = {}
): Promise<string> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const imageBuffer = Buffer.from(screenshotBase64, 'base64');
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width || 1080;
  const height = metadata.height || 1920;

  const eligibleElements = hierarchy.interactiveElements
    .filter(
      (el) =>
        el.bounds !== null &&
        el.bounds.area >= finalConfig.minArea &&
        el.states.enabled
    )
    .slice(0, finalConfig.maxElements);

  const svgParts: string[] = [];

  for (const element of eligibleElements) {
    const labelPos = calculateLabelPosition(
      element,
      finalConfig.labelPosition,
      finalConfig.fontSize,
      finalConfig.labelPadding
    );

    svgParts.push(createElementSVG(element, finalConfig, labelPos));
  }

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svgParts.join('')}</svg>`;

  const result = await sharp(imageBuffer)
    .composite([
      {
        input: Buffer.from(svg),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  return result.toString('base64');
}

export async function generateSetOfMarkFiltered(
  screenshotBase64: string,
  hierarchy: ParsedHierarchy,
  filterFn: (element: UIElement) => boolean,
  config: Partial<SetOfMarkConfig> = {}
): Promise<string> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const imageBuffer = Buffer.from(screenshotBase64, 'base64');
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width || 1080;
  const height = metadata.height || 1920;

  const eligibleElements = hierarchy.elementList
    .filter(filterFn)
    .filter((el) => el.bounds !== null && el.bounds.area >= finalConfig.minArea)
    .slice(0, finalConfig.maxElements);

  const svgParts: string[] = [];

  for (const element of eligibleElements) {
    const labelPos = calculateLabelPosition(
      element,
      finalConfig.labelPosition,
      finalConfig.fontSize,
      finalConfig.labelPadding
    );

    svgParts.push(createElementSVG(element, finalConfig, labelPos));
  }

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svgParts.join('')}</svg>`;

  const result = await sharp(imageBuffer)
    .composite([
      {
        input: Buffer.from(svg),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  return result.toString('base64');
}

export async function generateBoxesOnly(
  screenshotBase64: string,
  hierarchy: ParsedHierarchy,
  config: Partial<Pick<SetOfMarkConfig, 'minArea' | 'boxColor' | 'boxWidth' | 'maxElements'>> = {}
): Promise<string> {
  const finalConfig = {
    minArea: config.minArea ?? DEFAULT_CONFIG.minArea,
    boxColor: config.boxColor ?? DEFAULT_CONFIG.boxColor,
    boxWidth: config.boxWidth ?? DEFAULT_CONFIG.boxWidth,
    maxElements: config.maxElements ?? DEFAULT_CONFIG.maxElements,
  };

  const imageBuffer = Buffer.from(screenshotBase64, 'base64');
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width || 1080;
  const height = metadata.height || 1920;

  const eligibleElements = hierarchy.interactiveElements
    .filter(
      (el) =>
        el.bounds !== null &&
        el.bounds.area >= finalConfig.minArea &&
        el.states.enabled
    )
    .slice(0, finalConfig.maxElements);

  const svgParts: string[] = [];

  for (const element of eligibleElements) {
    if (!element.bounds) continue;
    const { x1, y1, x2, y2 } = element.bounds;
    svgParts.push(
      `<rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}" ` +
        `fill="none" stroke="rgb(${finalConfig.boxColor.r},${finalConfig.boxColor.g},${finalConfig.boxColor.b})" ` +
        `stroke-width="${finalConfig.boxWidth}"/>`
    );
  }

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svgParts.join('')}</svg>`;

  const result = await sharp(imageBuffer)
    .composite([
      {
        input: Buffer.from(svg),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  return result.toString('base64');
}

export async function generateColorCodedOverlay(
  screenshotBase64: string,
  hierarchy: ParsedHierarchy,
  config: Partial<SetOfMarkConfig> = {}
): Promise<string> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const imageBuffer = Buffer.from(screenshotBase64, 'base64');
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width || 1080;
  const height = metadata.height || 1920;

  const colorMap: Record<string, { r: number; g: number; b: number }> = {
    button: { r: 0, g: 255, b: 0 },
    input: { r: 0, g: 150, b: 255 },
    checkbox: { r: 255, g: 165, b: 0 },
    switch: { r: 255, g: 165, b: 0 },
    text: { r: 128, g: 128, b: 128 },
    image: { r: 255, g: 0, b: 255 },
    default: { r: 255, g: 0, b: 0 },
  };

  const eligibleElements = hierarchy.interactiveElements
    .filter(
      (el) =>
        el.bounds !== null &&
        el.bounds.area >= finalConfig.minArea &&
        el.states.enabled
    )
    .slice(0, finalConfig.maxElements);

  const svgParts: string[] = [];

  for (const element of eligibleElements) {
    const color = colorMap[element.type] || colorMap.default;
    const labelPos = calculateLabelPosition(
      element,
      finalConfig.labelPosition,
      finalConfig.fontSize,
      finalConfig.labelPadding
    );

    const customConfig = { ...finalConfig, boxColor: color };
    svgParts.push(createElementSVG(element, customConfig, labelPos));
  }

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svgParts.join('')}</svg>`;

  const result = await sharp(imageBuffer)
    .composite([
      {
        input: Buffer.from(svg),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  return result.toString('base64');
}

export interface AnnotationStats {
  totalElements: number;
  annotatedElements: number;
  filteredBySize: number;
  elementTypes: Record<string, number>;
  averageElementArea: number;
}

export function getAnnotationStats(
  hierarchy: ParsedHierarchy,
  config: Partial<SetOfMarkConfig> = {}
): AnnotationStats {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const eligible = hierarchy.interactiveElements.filter(
    (el) =>
      el.bounds !== null &&
      el.bounds.area >= finalConfig.minArea &&
      el.states.enabled
  );

  const annotated = eligible.slice(0, finalConfig.maxElements);
  const filteredBySize = hierarchy.interactiveElements.filter(
    (el) =>
      el.bounds !== null &&
      el.bounds.area < finalConfig.minArea &&
      el.states.enabled
  ).length;

  const elementTypes: Record<string, number> = {};
  let totalArea = 0;

  for (const el of annotated) {
    elementTypes[el.type] = (elementTypes[el.type] || 0) + 1;
    if (el.bounds) {
      totalArea += el.bounds.area;
    }
  }

  return {
    totalElements: hierarchy.interactiveElements.length,
    annotatedElements: annotated.length,
    filteredBySize,
    elementTypes,
    averageElementArea: annotated.length > 0 ? totalArea / annotated.length : 0,
  };
}

export async function saveAnnotatedScreenshot(
  screenshotBase64: string,
  hierarchy: ParsedHierarchy,
  outputPath: string,
  config: Partial<SetOfMarkConfig> = {}
): Promise<void> {
  const annotated = await generateSetOfMark(screenshotBase64, hierarchy, config);
  const buffer = Buffer.from(annotated, 'base64');

  const fs = await import('fs');
  fs.writeFileSync(outputPath, buffer);
}
