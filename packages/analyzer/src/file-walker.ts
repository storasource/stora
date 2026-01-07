/**
 * File walker for project scanning
 */

import fs from 'fs-extra';
import path from 'path';

// Directories to skip
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'build',
  'dist',
  '.gradle',
  '.idea',
  '.vscode',
  'Pods',
  'DerivedData',
  '.dart_tool',
  '.pub-cache',
  '__pycache__',
  'venv',
  '.env',
  'coverage',
  '.nyc_output',
]);

// File extensions to include
const INCLUDE_EXTENSIONS = new Set([
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.dart',
  '.swift',
  '.kt',
  '.java',
  '.m',
  '.mm',
  '.h',
  '.json',
  '.yaml',
  '.yml',
  '.xml',
  '.plist',
  '.gradle',
  '.podspec',
  '.pbxproj',
]);

/**
 * Walk the file tree and return relevant files
 */
export async function fileWalker(
  projectDir: string,
  options: {
    maxDepth?: number;
    includeAll?: boolean;
  } = {}
): Promise<string[]> {
  const { maxDepth = 10, includeAll = false } = options;
  const files: string[] = [];
  
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(projectDir, fullPath);
        
        if (entry.isDirectory()) {
          // Skip certain directories
          if (SKIP_DIRS.has(entry.name)) continue;
          if (entry.name.startsWith('.') && entry.name !== '.stora') continue;
          
          await walk(fullPath, depth + 1);
        } else if (entry.isFile()) {
          // Include based on extension
          const ext = path.extname(entry.name).toLowerCase();
          
          if (includeAll || INCLUDE_EXTENSIONS.has(ext) || isImportantFile(entry.name)) {
            files.push(relativePath);
          }
        }
      }
    } catch {
      // Ignore permission errors
    }
  }
  
  await walk(projectDir, 0);
  
  return files;
}

/**
 * Check if a file is important regardless of extension
 */
function isImportantFile(fileName: string): boolean {
  const importantFiles = new Set([
    'pubspec.yaml',
    'package.json',
    'app.json',
    'expo.json',
    'Info.plist',
    'AndroidManifest.xml',
    'build.gradle',
    'settings.gradle',
    'Podfile',
    'Gemfile',
    'Fastfile',
    'Appfile',
    'Matchfile',
    '.env',
    '.env.example',
    'capacitor.config.ts',
    'capacitor.config.json',
    'config.xml',
    'stora.config.js',
    'stora.config.ts',
  ]);
  
  return importantFiles.has(fileName);
}

/**
 * Get file content safely
 */
export async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export default fileWalker;


