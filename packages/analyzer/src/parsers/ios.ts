/**
 * iOS native project parser
 */

import fs from 'fs-extra';
import path from 'path';
import type { AnalyzedFile } from '../index.js';

interface iOSMetadata {
  name: string | null;
  version: string | null;
  bundleId: string | null;
}

/**
 * Parse an iOS project
 */
export async function parseIOS(
  projectDir: string,
  analyzedFiles: AnalyzedFile[]
): Promise<iOSMetadata> {
  const metadata: iOSMetadata = {
    name: null,
    version: null,
    bundleId: null,
  };

  const iosDir = path.join(projectDir, 'ios');
  if (!(await fs.pathExists(iosDir))) {
    return metadata;
  }

  // Find and parse Info.plist files
  try {
    const entries = await fs.readdir(iosDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.') || entry.name === 'Pods' || entry.name === 'build') continue;
      
      // Check for Info.plist
      const plistPath = path.join(iosDir, entry.name, 'Info.plist');
      if (await fs.pathExists(plistPath)) {
        const relativePath = `ios/${entry.name}/Info.plist`;
        
        // Check if already analyzed
        if (!analyzedFiles.some(f => f.path === relativePath)) {
          analyzedFiles.push({
            path: relativePath,
            type: 'manifest',
            purpose: 'iOS app configuration and permissions',
            exists: true,
          });
        }

        try {
          const plistContent = await fs.readFile(plistPath, 'utf-8');
          
          // Extract bundle ID
          const bundleIdMatch = plistContent.match(/<key>CFBundleIdentifier<\/key>\s*<string>([^<]+)<\/string>/);
          if (bundleIdMatch && !bundleIdMatch[1].includes('$')) {
            metadata.bundleId = bundleIdMatch[1];
          }
          
          // Extract display name
          const displayNameMatch = plistContent.match(/<key>CFBundleDisplayName<\/key>\s*<string>([^<]+)<\/string>/);
          if (displayNameMatch && !displayNameMatch[1].includes('$')) {
            metadata.name = displayNameMatch[1];
          }
          
          // Try CFBundleName as fallback
          if (!metadata.name) {
            const bundleNameMatch = plistContent.match(/<key>CFBundleName<\/key>\s*<string>([^<]+)<\/string>/);
            if (bundleNameMatch && !bundleNameMatch[1].includes('$')) {
              metadata.name = bundleNameMatch[1];
            }
          }
          
          // Extract version
          const versionMatch = plistContent.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/);
          if (versionMatch && !versionMatch[1].includes('$')) {
            metadata.version = versionMatch[1];
          }
          
          // If we found a bundle ID, break
          if (metadata.bundleId) break;
        } catch {
          // Ignore parsing errors
        }
      }
      
      // Check for xcodeproj
      const xcodeprojects = await fs.readdir(path.join(iosDir, entry.name)).catch(() => []);
      for (const file of xcodeprojects) {
        if (file.endsWith('.xcodeproj')) {
          const pbxprojPath = path.join(iosDir, entry.name, file, 'project.pbxproj');
          if (await fs.pathExists(pbxprojPath)) {
            const relativePath = `ios/${entry.name}/${file}/project.pbxproj`;
            
            if (!analyzedFiles.some(f => f.path === relativePath)) {
              analyzedFiles.push({
                path: relativePath,
                type: 'config',
                purpose: 'Xcode project configuration',
                exists: true,
              });
            }
            
            if (!metadata.bundleId) {
              try {
                const pbxContent = await fs.readFile(pbxprojPath, 'utf-8');
                const matches = pbxContent.matchAll(/PRODUCT_BUNDLE_IDENTIFIER\s*=\s*([^;]+);/g);
                
                for (const match of matches) {
                  let bundleId = match[1].trim().replace(/^["']|["']$/g, '');
                  if (!bundleId.includes('Test') && !bundleId.includes('test') && !bundleId.includes('$')) {
                    metadata.bundleId = bundleId;
                    break;
                  }
                }
              } catch {
                // Ignore parsing errors
              }
            }
          }
        }
      }
    }
  } catch {
    // Ignore directory errors
  }

  // Also check root ios directory for xcodeproj
  try {
    const rootEntries = await fs.readdir(iosDir);
    for (const entry of rootEntries) {
      if (entry.endsWith('.xcodeproj') || entry.endsWith('.xcworkspace')) {
        const pbxprojPath = path.join(iosDir, entry, 'project.pbxproj');
        if (await fs.pathExists(pbxprojPath) && !metadata.bundleId) {
          const relativePath = `ios/${entry}/project.pbxproj`;
          
          if (!analyzedFiles.some(f => f.path === relativePath)) {
            analyzedFiles.push({
              path: relativePath,
              type: 'config',
              purpose: 'Xcode project configuration',
              exists: true,
            });
          }

          try {
            const pbxContent = await fs.readFile(pbxprojPath, 'utf-8');
            const matches = pbxContent.matchAll(/PRODUCT_BUNDLE_IDENTIFIER\s*=\s*([^;]+);/g);
            
            for (const match of matches) {
              let bundleId = match[1].trim().replace(/^["']|["']$/g, '');
              if (!bundleId.includes('Test') && !bundleId.includes('test') && !bundleId.includes('$')) {
                metadata.bundleId = bundleId;
                break;
              }
            }
          } catch {
            // Ignore parsing errors
          }
        }
      }
    }
  } catch {
    // Ignore directory errors
  }

  return metadata;
}

export default parseIOS;


