/**
 * Flutter project parser
 */

import fs from 'fs-extra';
import path from 'path';
import type { AnalyzedFile } from '../../../types/index.js';

interface FlutterMetadata {
  name: string | null;
  version: string | null;
  ios?: { bundleId: string | null };
  android?: { packageName: string | null };
}

/**
 * Parse a Flutter project
 */
export async function parseFlutter(
  projectDir: string,
  analyzedFiles: AnalyzedFile[]
): Promise<FlutterMetadata> {
  const metadata: FlutterMetadata = {
    name: null,
    version: null,
  };

  // Parse pubspec.yaml
  const pubspecPath = path.join(projectDir, 'pubspec.yaml');
  const pubspecExists = await fs.pathExists(pubspecPath);
  
  analyzedFiles.push({
    path: 'pubspec.yaml',
    type: 'config',
    purpose: 'Flutter project configuration and dependencies',
    exists: pubspecExists,
  });

  if (pubspecExists) {
    try {
      const yaml = await import('yaml');
      const pubspecContent = await fs.readFile(pubspecPath, 'utf-8');
      const pubspec = yaml.parse(pubspecContent);
      
      metadata.name = pubspec.name || null;
      
      if (pubspec.version) {
        const versionParts = pubspec.version.split('+');
        metadata.version = versionParts[0];
      }
    } catch {
      // Ignore parsing errors
    }
  }

  // Parse iOS Info.plist for bundle ID
  const iosPlistPaths = [
    'ios/Runner/Info.plist',
    'ios/App/Info.plist',
  ];

  for (const plistPath of iosPlistPaths) {
    const fullPath = path.join(projectDir, plistPath);
    if (await fs.pathExists(fullPath)) {
      analyzedFiles.push({
        path: plistPath,
        type: 'manifest',
        purpose: 'iOS app configuration and permissions',
        exists: true,
      });

      try {
        const plistContent = await fs.readFile(fullPath, 'utf-8');
        
        // Extract bundle ID
        const bundleIdMatch = plistContent.match(/<key>CFBundleIdentifier<\/key>\s*<string>([^<$]+)<\/string>/);
        if (bundleIdMatch && !bundleIdMatch[1].includes('$')) {
          metadata.ios = { bundleId: bundleIdMatch[1] };
        }
        
        // Extract display name as fallback
        if (!metadata.name) {
          const displayNameMatch = plistContent.match(/<key>CFBundleDisplayName<\/key>\s*<string>([^<$]+)<\/string>/);
          if (displayNameMatch && !displayNameMatch[1].includes('$')) {
            metadata.name = displayNameMatch[1];
          }
        }
      } catch {
        // Ignore parsing errors
      }
      break;
    }
  }

  // If bundle ID not found in plist, check Xcode project
  if (!metadata.ios?.bundleId) {
    const pbxprojPath = path.join(projectDir, 'ios/Runner.xcodeproj/project.pbxproj');
    if (await fs.pathExists(pbxprojPath)) {
      analyzedFiles.push({
        path: 'ios/Runner.xcodeproj/project.pbxproj',
        type: 'config',
        purpose: 'Xcode project configuration',
        exists: true,
      });

      try {
        const pbxContent = await fs.readFile(pbxprojPath, 'utf-8');
        const matches = pbxContent.matchAll(/PRODUCT_BUNDLE_IDENTIFIER\s*=\s*([^;]+);/g);
        
        for (const match of matches) {
          let bundleId = match[1].trim().replace(/^["']|["']$/g, '');
          if (!bundleId.includes('Test') && !bundleId.includes('test') && !bundleId.includes('$')) {
            metadata.ios = { bundleId };
            break;
          }
        }
      } catch {
        // Ignore parsing errors
      }
    }
  }

  // Parse Android build.gradle for package name
  const buildGradlePath = path.join(projectDir, 'android/app/build.gradle');
  const buildGradleKtsPath = path.join(projectDir, 'android/app/build.gradle.kts');
  
  const gradlePath = await fs.pathExists(buildGradlePath) ? buildGradlePath 
    : await fs.pathExists(buildGradleKtsPath) ? buildGradleKtsPath 
    : null;

  if (gradlePath) {
    const relativePath = path.relative(projectDir, gradlePath);
    analyzedFiles.push({
      path: relativePath,
      type: 'config',
      purpose: 'Android build configuration',
      exists: true,
    });

    try {
      const gradleContent = await fs.readFile(gradlePath, 'utf-8');
      
      // Try namespace first (modern Gradle)
      let match = gradleContent.match(/namespace\s+["']([^"']+)["']/);
      if (match) {
        metadata.android = { packageName: match[1] };
      }
      
      // Try applicationId
      if (!metadata.android?.packageName) {
        match = gradleContent.match(/applicationId\s+["']([^"']+)["']/);
        if (match) {
          metadata.android = { packageName: match[1] };
        }
      }
      
      // Extract version info
      if (!metadata.version) {
        const versionMatch = gradleContent.match(/versionName\s+["']([^"']+)["']/);
        if (versionMatch) {
          metadata.version = versionMatch[1];
        }
      }
    } catch {
      // Ignore parsing errors
    }
  }

  // Fallback: Check AndroidManifest.xml
  if (!metadata.android?.packageName) {
    const manifestPath = path.join(projectDir, 'android/app/src/main/AndroidManifest.xml');
    if (await fs.pathExists(manifestPath)) {
      analyzedFiles.push({
        path: 'android/app/src/main/AndroidManifest.xml',
        type: 'manifest',
        purpose: 'Android app configuration and permissions',
        exists: true,
      });

      try {
        const manifestContent = await fs.readFile(manifestPath, 'utf-8');
        const packageMatch = manifestContent.match(/package="([^"]+)"/);
        if (packageMatch) {
          metadata.android = { packageName: packageMatch[1] };
        }
      } catch {
        // Ignore parsing errors
      }
    }
  }

  return metadata;
}

export default parseFlutter;


