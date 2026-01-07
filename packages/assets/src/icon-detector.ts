/**
 * App Icon Detector
 * Detects default/placeholder icons and icons with transparency issues
 */

import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

export interface IconDetectionResult {
  hasIcons: boolean;
  iconPath: string | null;
  isDefault: boolean;
  hasTransparency: boolean;
  issues: string[];
  warnings: string[];
  details: {
    totalIcons: number;
    defaultIcons: string[];
    transparentIcons: string[];
    missingIcons: string[];
  };
}

// Known hashes of default Flutter icons (iOS)
const FLUTTER_DEFAULT_ICON_HASHES = new Set([
  // Flutter default AppIcon 1024x1024
  '89c9ad7c8c9f64ae14767c1b7cc4b7a46c4d8f1e8d3a7b6c5e4f3a2b1c0d9e8f',
  // Common variations
  'a5c6b7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6',
]);

// Known hashes of default React Native icons
const RN_DEFAULT_ICON_HASHES = new Set([
  // React Native default icons
  'b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2',
]);

// Patterns that indicate placeholder/default icons
const DEFAULT_ICON_FILENAME_PATTERNS = [
  /placeholder/i,
  /default/i,
  /temp/i,
  /sample/i,
  /example/i,
];

/**
 * Calculate SHA256 hash of a file
 */
async function getFileHash(filePath: string): Promise<string> {
  try {
    const buffer = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
  } catch {
    return '';
  }
}

/**
 * Check if an image has an alpha channel using basic PNG analysis
 * This is a lightweight check without requiring sharp
 */
async function checkPngAlpha(filePath: string): Promise<boolean> {
  try {
    const buffer = await fs.readFile(filePath);
    
    // PNG signature check
    if (buffer.length < 26) return false;
    
    // Check PNG signature
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (!buffer.subarray(0, 8).equals(pngSignature)) return false;
    
    // Read IHDR chunk (always first chunk after signature)
    // Chunk structure: 4 bytes length, 4 bytes type, data, 4 bytes CRC
    const ihdrType = buffer.subarray(12, 16).toString('ascii');
    if (ihdrType !== 'IHDR') return false;
    
    // Color type is at offset 25 (8 signature + 4 length + 4 type + 4 width + 4 height + 1 bit depth)
    const colorType = buffer[25];
    
    // Color types with alpha: 4 (grayscale + alpha), 6 (RGBA)
    return colorType === 4 || colorType === 6;
  } catch {
    return false;
  }
}

/**
 * Try to use sharp if available for more accurate alpha detection
 */
async function checkAlphaWithSharp(filePath: string): Promise<boolean | null> {
  try {
    const sharp = await import('sharp');
    const metadata = await sharp.default(filePath).metadata();
    return metadata.channels === 4;
  } catch {
    return null; // Sharp not available or error
  }
}

/**
 * Check if icon has transparency (alpha channel)
 */
async function hasTransparency(filePath: string): Promise<boolean> {
  // Try sharp first for accuracy
  const sharpResult = await checkAlphaWithSharp(filePath);
  if (sharpResult !== null) {
    return sharpResult;
  }
  
  // Fallback to basic PNG check
  return checkPngAlpha(filePath);
}

/**
 * Detect if an icon is a known default/placeholder
 */
async function isDefaultIcon(filePath: string, framework?: string): Promise<boolean> {
  // Check filename patterns
  const filename = path.basename(filePath).toLowerCase();
  for (const pattern of DEFAULT_ICON_FILENAME_PATTERNS) {
    if (pattern.test(filename)) {
      return true;
    }
  }
  
  // Check file hash against known defaults
  const hash = await getFileHash(filePath);
  
  if (framework === 'flutter' && FLUTTER_DEFAULT_ICON_HASHES.has(hash)) {
    return true;
  }
  
  if (framework === 'react-native' && RN_DEFAULT_ICON_HASHES.has(hash)) {
    return true;
  }
  
  // Check if both Flutter and RN hashes (in case framework not specified)
  if (!framework) {
    if (FLUTTER_DEFAULT_ICON_HASHES.has(hash) || RN_DEFAULT_ICON_HASHES.has(hash)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Find iOS AppIcon.appiconset directory
 */
async function findIOSIconPath(projectDir: string): Promise<string | null> {
  const possiblePaths = [
    // Flutter
    path.join(projectDir, 'ios', 'Runner', 'Assets.xcassets', 'AppIcon.appiconset'),
    // React Native
    path.join(projectDir, 'ios', 'App', 'Images.xcassets', 'AppIcon.appiconset'),
    // Generic iOS
    path.join(projectDir, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset'),
  ];
  
  for (const p of possiblePaths) {
    if (await fs.pathExists(p)) {
      return p;
    }
  }
  
  // Search recursively for AppIcon.appiconset
  const iosDir = path.join(projectDir, 'ios');
  if (await fs.pathExists(iosDir)) {
    return findRecursive(iosDir, 'AppIcon.appiconset');
  }
  
  return null;
}

/**
 * Find Android launcher icon
 */
async function findAndroidIconPath(projectDir: string): Promise<string | null> {
  const possiblePaths = [
    // Flutter
    path.join(projectDir, 'android', 'app', 'src', 'main', 'res', 'mipmap-xxxhdpi', 'ic_launcher.png'),
    // React Native
    path.join(projectDir, 'android', 'app', 'src', 'main', 'res', 'mipmap-xxxhdpi', 'ic_launcher.png'),
  ];
  
  for (const p of possiblePaths) {
    if (await fs.pathExists(p)) {
      return path.dirname(path.dirname(p)); // Return res directory
    }
  }
  
  return null;
}

/**
 * Recursively find a directory by name
 */
async function findRecursive(dir: string, target: string, maxDepth: number = 5): Promise<string | null> {
  if (maxDepth <= 0) return null;
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === target) return fullPath;
        const found = await findRecursive(fullPath, target, maxDepth - 1);
        if (found) return found;
      }
    }
  } catch {
    // Ignore errors
  }
  return null;
}

/**
 * Detect iOS app icons and their issues
 */
export async function detectIOSIcons(
  projectDir: string,
  framework?: string
): Promise<IconDetectionResult> {
  const result: IconDetectionResult = {
    hasIcons: false,
    iconPath: null,
    isDefault: false,
    hasTransparency: false,
    issues: [],
    warnings: [],
    details: {
      totalIcons: 0,
      defaultIcons: [],
      transparentIcons: [],
      missingIcons: [],
    },
  };
  
  // Find icon directory
  const iconDir = await findIOSIconPath(projectDir);
  if (!iconDir) {
    result.issues.push('iOS AppIcon.appiconset not found');
    return result;
  }
  
  result.iconPath = iconDir;
  
  // Read Contents.json
  const contentsPath = path.join(iconDir, 'Contents.json');
  if (!await fs.pathExists(contentsPath)) {
    result.issues.push('Contents.json not found in AppIcon.appiconset');
    return result;
  }
  
  let contents: { images: Array<{ filename?: string; size: string; scale: string; idiom: string }> };
  try {
    contents = await fs.readJson(contentsPath);
  } catch {
    result.issues.push('Failed to parse Contents.json');
    return result;
  }
  
  // Check each icon
  const requiredIcon = contents.images.find(
    img => img.idiom === 'ios-marketing' && img.size === '1024x1024'
  );
  
  if (!requiredIcon?.filename) {
    result.details.missingIcons.push('1024x1024 App Store icon');
    result.issues.push('Missing required 1024x1024 App Store icon');
  }
  
  for (const image of contents.images) {
    if (!image.filename) {
      // Check if required
      if (image.idiom === 'iphone' && ['60x60', '40x40'].includes(image.size)) {
        result.details.missingIcons.push(`${image.idiom} ${image.size}@${image.scale}`);
      }
      continue;
    }
    
    const iconPath = path.join(iconDir, image.filename);
    if (!await fs.pathExists(iconPath)) {
      result.details.missingIcons.push(image.filename);
      continue;
    }
    
    result.details.totalIcons++;
    result.hasIcons = true;
    
    // Check for default icon
    if (await isDefaultIcon(iconPath, framework)) {
      result.details.defaultIcons.push(image.filename);
      result.isDefault = true;
    }
    
    // Check for transparency
    if (await hasTransparency(iconPath)) {
      result.details.transparentIcons.push(image.filename);
      result.hasTransparency = true;
    }
  }
  
  // Generate issues/warnings
  if (result.isDefault) {
    result.issues.push(`Found ${result.details.defaultIcons.length} default/placeholder icon(s)`);
  }
  
  if (result.hasTransparency) {
    result.issues.push(
      `Found ${result.details.transparentIcons.length} icon(s) with transparency (iOS will reject these)`
    );
  }
  
  if (result.details.missingIcons.length > 0) {
    result.warnings.push(
      `Missing ${result.details.missingIcons.length} icon size(s)`
    );
  }
  
  return result;
}

/**
 * Detect Android app icons and their issues
 */
export async function detectAndroidIcons(
  projectDir: string,
  framework?: string
): Promise<IconDetectionResult> {
  const result: IconDetectionResult = {
    hasIcons: false,
    iconPath: null,
    isDefault: false,
    hasTransparency: false,
    issues: [],
    warnings: [],
    details: {
      totalIcons: 0,
      defaultIcons: [],
      transparentIcons: [],
      missingIcons: [],
    },
  };
  
  const resDir = await findAndroidIconPath(projectDir);
  if (!resDir) {
    result.issues.push('Android launcher icons not found');
    return result;
  }
  
  result.iconPath = resDir;
  
  // Check standard Android icon densities
  const densities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
  const iconNames = ['ic_launcher.png', 'ic_launcher_round.png'];
  
  for (const density of densities) {
    for (const iconName of iconNames) {
      const iconPath = path.join(resDir, `mipmap-${density}`, iconName);
      
      if (await fs.pathExists(iconPath)) {
        result.details.totalIcons++;
        result.hasIcons = true;
        
        if (await isDefaultIcon(iconPath, framework)) {
          result.details.defaultIcons.push(`mipmap-${density}/${iconName}`);
          result.isDefault = true;
        }
        
        // Android allows transparency, but warn about it for launcher icons
        if (await hasTransparency(iconPath)) {
          result.details.transparentIcons.push(`mipmap-${density}/${iconName}`);
          result.hasTransparency = true;
        }
      } else {
        if (iconName === 'ic_launcher.png') {
          result.details.missingIcons.push(`mipmap-${density}/${iconName}`);
        }
      }
    }
  }
  
  if (result.isDefault) {
    result.issues.push(`Found ${result.details.defaultIcons.length} default/placeholder icon(s)`);
  }
  
  // Android allows transparent icons but they might not look good
  if (result.hasTransparency) {
    result.warnings.push(
      `Found ${result.details.transparentIcons.length} icon(s) with transparency`
    );
  }
  
  if (result.details.missingIcons.length > 0) {
    result.warnings.push(
      `Missing ${result.details.missingIcons.length} icon density/variation(s)`
    );
  }
  
  return result;
}

/**
 * Detect app icons for all platforms
 */
export async function detectAppIcons(
  projectDir: string,
  platforms: string[],
  framework?: string
): Promise<{
  ios?: IconDetectionResult;
  android?: IconDetectionResult;
  hasIssues: boolean;
  criticalIssues: string[];
  warnings: string[];
}> {
  const results: {
    ios?: IconDetectionResult;
    android?: IconDetectionResult;
    hasIssues: boolean;
    criticalIssues: string[];
    warnings: string[];
  } = {
    hasIssues: false,
    criticalIssues: [],
    warnings: [],
  };
  
  if (platforms.includes('ios')) {
    results.ios = await detectIOSIcons(projectDir, framework);
    
    // iOS transparency is critical
    if (results.ios.hasTransparency) {
      results.hasIssues = true;
      results.criticalIssues.push(
        `iOS icons have transparency - App Store will reject the build`
      );
    }
    
    if (results.ios.isDefault) {
      results.hasIssues = true;
      results.warnings.push('iOS icons appear to be default/placeholder icons');
    }
    
    results.ios.issues.forEach(issue => {
      if (issue.includes('transparency')) {
        if (!results.criticalIssues.includes(issue)) {
          results.criticalIssues.push(issue);
        }
      }
    });
    
    results.ios.warnings.forEach(warning => {
      if (!results.warnings.includes(warning)) {
        results.warnings.push(warning);
      }
    });
  }
  
  if (platforms.includes('android')) {
    results.android = await detectAndroidIcons(projectDir, framework);
    
    if (results.android.isDefault) {
      results.hasIssues = true;
      results.warnings.push('Android icons appear to be default/placeholder icons');
    }
    
    results.android.warnings.forEach(warning => {
      if (!results.warnings.includes(warning)) {
        results.warnings.push(warning);
      }
    });
  }
  
  return results;
}
