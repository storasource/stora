/**
 * React Native / Expo project parser
 */

import fs from 'fs-extra';
import path from 'path';
import type { AnalyzedFile } from '../index.js';

interface ReactNativeMetadata {
  name: string | null;
  version: string | null;
  ios?: { bundleId: string | null };
  android?: { packageName: string | null };
}

/**
 * Parse a React Native or Expo project
 */
export async function parseReactNative(
  projectDir: string,
  analyzedFiles: AnalyzedFile[]
): Promise<ReactNativeMetadata> {
  const metadata: ReactNativeMetadata = {
    name: null,
    version: null,
  };

  // Parse package.json
  const packageJsonPath = path.join(projectDir, 'package.json');
  if (await fs.pathExists(packageJsonPath)) {
    analyzedFiles.push({
      path: 'package.json',
      type: 'config',
      purpose: 'JavaScript/TypeScript dependencies and project info',
      exists: true,
    });

    try {
      const packageJson = await fs.readJSON(packageJsonPath);
      metadata.name = packageJson.name || null;
      metadata.version = packageJson.version || null;
    } catch {
      // Ignore parsing errors
    }
  }

  // Parse app.json (React Native / Expo)
  const appJsonPath = path.join(projectDir, 'app.json');
  if (await fs.pathExists(appJsonPath)) {
    analyzedFiles.push({
      path: 'app.json',
      type: 'config',
      purpose: 'React Native / Expo app configuration',
      exists: true,
    });

    try {
      const appJson = await fs.readJSON(appJsonPath);
      
      // Expo format
      if (appJson.expo) {
        metadata.name = metadata.name || appJson.expo.name;
        metadata.version = metadata.version || appJson.expo.version;
        
        if (appJson.expo.ios?.bundleIdentifier) {
          metadata.ios = { bundleId: appJson.expo.ios.bundleIdentifier };
        }
        if (appJson.expo.android?.package) {
          metadata.android = { packageName: appJson.expo.android.package };
        }
      } else {
        // Plain React Native format
        metadata.name = metadata.name || appJson.name || appJson.displayName;
      }
    } catch {
      // Ignore parsing errors
    }
  }

  // Parse app.config.js/ts (Expo)
  const appConfigPaths = ['app.config.js', 'app.config.ts'];
  for (const configFile of appConfigPaths) {
    const configPath = path.join(projectDir, configFile);
    if (await fs.pathExists(configPath)) {
      analyzedFiles.push({
        path: configFile,
        type: 'config',
        purpose: 'Expo dynamic configuration',
        exists: true,
      });
      break;
    }
  }

  // Parse iOS Info.plist if not found in app.json
  if (!metadata.ios?.bundleId) {
    const iosPlistPaths = [
      'ios/*/Info.plist',
    ];

    // Find Info.plist dynamically
    const iosDir = path.join(projectDir, 'ios');
    if (await fs.pathExists(iosDir)) {
      try {
        const entries = await fs.readdir(iosDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.') && 
              entry.name !== 'Pods' && entry.name !== 'build') {
            const plistPath = path.join(iosDir, entry.name, 'Info.plist');
            if (await fs.pathExists(plistPath)) {
              const relativePath = `ios/${entry.name}/Info.plist`;
              analyzedFiles.push({
                path: relativePath,
                type: 'manifest',
                purpose: 'iOS app configuration and permissions',
                exists: true,
              });

              try {
                const plistContent = await fs.readFile(plistPath, 'utf-8');
                const bundleIdMatch = plistContent.match(/<key>CFBundleIdentifier<\/key>\s*<string>([^<$]+)<\/string>/);
                if (bundleIdMatch && !bundleIdMatch[1].includes('$')) {
                  metadata.ios = { bundleId: bundleIdMatch[1] };
                }
                
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
        }
      } catch {
        // Ignore directory errors
      }
    }
  }

  // Parse Android build.gradle if not found in app.json
  if (!metadata.android?.packageName) {
    const buildGradlePath = path.join(projectDir, 'android/app/build.gradle');
    if (await fs.pathExists(buildGradlePath)) {
      analyzedFiles.push({
        path: 'android/app/build.gradle',
        type: 'config',
        purpose: 'Android build configuration',
        exists: true,
      });

      try {
        const gradleContent = await fs.readFile(buildGradlePath, 'utf-8');
        
        // Try namespace first
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
      } catch {
        // Ignore parsing errors
      }
    }
  }

  return metadata;
}

export default parseReactNative;


