/**
 * Android native project parser
 */

import fs from 'fs-extra';
import path from 'path';
import type { AnalyzedFile } from '../index.js';

interface AndroidMetadata {
  name: string | null;
  version: string | null;
  packageName: string | null;
}

/**
 * Parse an Android project
 */
export async function parseAndroid(
  projectDir: string,
  analyzedFiles: AnalyzedFile[]
): Promise<AndroidMetadata> {
  const metadata: AndroidMetadata = {
    name: null,
    version: null,
    packageName: null,
  };

  const androidDir = path.join(projectDir, 'android');
  if (!(await fs.pathExists(androidDir))) {
    return metadata;
  }

  // Parse build.gradle or build.gradle.kts
  const buildGradlePath = path.join(androidDir, 'app', 'build.gradle');
  const buildGradleKtsPath = path.join(androidDir, 'app', 'build.gradle.kts');
  
  let gradlePath: string | null = null;
  if (await fs.pathExists(buildGradlePath)) {
    gradlePath = buildGradlePath;
  } else if (await fs.pathExists(buildGradleKtsPath)) {
    gradlePath = buildGradleKtsPath;
  }

  if (gradlePath) {
    const relativePath = path.relative(projectDir, gradlePath);
    
    if (!analyzedFiles.some(f => f.path === relativePath)) {
      analyzedFiles.push({
        path: relativePath,
        type: 'config',
        purpose: 'Android build configuration',
        exists: true,
      });
    }

    try {
      const gradleContent = await fs.readFile(gradlePath, 'utf-8');
      
      // Extract namespace (modern Gradle)
      let match = gradleContent.match(/namespace\s+["']([^"']+)["']/);
      if (match) {
        metadata.packageName = match[1];
      }
      
      // Extract applicationId
      if (!metadata.packageName) {
        match = gradleContent.match(/applicationId\s+["']([^"']+)["']/);
        if (match) {
          metadata.packageName = match[1];
        }
      }
      
      // Extract versionName
      const versionNameMatch = gradleContent.match(/versionName\s+["']([^"']+)["']/);
      if (versionNameMatch) {
        metadata.version = versionNameMatch[1];
      }
      
      // Extract app name from resValue or similar
      const resValueMatch = gradleContent.match(/resValue\s*\(\s*["']string["']\s*,\s*["']app_name["']\s*,\s*["']([^"']+)["']\)/);
      if (resValueMatch) {
        metadata.name = resValueMatch[1];
      }
    } catch {
      // Ignore parsing errors
    }
  }

  // Parse AndroidManifest.xml
  const manifestPath = path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
  if (await fs.pathExists(manifestPath)) {
    const relativePath = 'android/app/src/main/AndroidManifest.xml';
    
    if (!analyzedFiles.some(f => f.path === relativePath)) {
      analyzedFiles.push({
        path: relativePath,
        type: 'manifest',
        purpose: 'Android app configuration and permissions',
        exists: true,
      });
    }

    try {
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      
      // Extract package name from manifest
      if (!metadata.packageName) {
        const packageMatch = manifestContent.match(/package="([^"]+)"/);
        if (packageMatch) {
          metadata.packageName = packageMatch[1];
        }
      }
      
      // Extract app label
      if (!metadata.name) {
        const labelMatch = manifestContent.match(/android:label="([^"@]+)"/);
        if (labelMatch) {
          metadata.name = labelMatch[1];
        }
      }
    } catch {
      // Ignore parsing errors
    }
  }

  // Check strings.xml for app name
  if (!metadata.name) {
    const stringsPath = path.join(androidDir, 'app', 'src', 'main', 'res', 'values', 'strings.xml');
    if (await fs.pathExists(stringsPath)) {
      try {
        const stringsContent = await fs.readFile(stringsPath, 'utf-8');
        const appNameMatch = stringsContent.match(/<string\s+name="app_name"[^>]*>([^<]+)<\/string>/);
        if (appNameMatch) {
          metadata.name = appNameMatch[1];
        }
      } catch {
        // Ignore parsing errors
      }
    }
  }

  return metadata;
}

export default parseAndroid;


