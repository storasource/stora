/**
 * Pattern detector for feature detection
 */

import fs from 'fs-extra';
import path from 'path';
import type { DetectedFeature } from '../../types/index.js';

interface FeaturePattern {
  name: string;
  files: string[];
  keywords: string[];
  packagePatterns: string[];
}

const FEATURE_PATTERNS: FeaturePattern[] = [
  {
    name: 'Push Notifications',
    files: ['firebase.json', 'google-services.json', 'GoogleService-Info.plist'],
    keywords: ['firebase', 'pushnotification', 'onesignal', 'fcm', 'apns'],
    packagePatterns: ['firebase_messaging', 'react-native-push-notification', '@react-native-firebase/messaging'],
  },
  {
    name: 'Camera Access',
    files: [],
    keywords: ['camera', 'photo', 'image-picker', 'barcode', 'qr'],
    packagePatterns: ['image_picker', 'camera', 'react-native-camera', 'expo-camera'],
  },
  {
    name: 'Location Services',
    files: [],
    keywords: ['geolocation', 'maps', 'location', 'gps', 'coordinates'],
    packagePatterns: ['geolocator', 'google_maps', 'react-native-maps', 'expo-location'],
  },
  {
    name: 'Authentication',
    files: [],
    keywords: ['auth', 'login', 'signin', 'signup', 'oauth'],
    packagePatterns: ['firebase_auth', 'auth0', 'react-native-auth0', '@react-native-firebase/auth'],
  },
  {
    name: 'Analytics',
    files: [],
    keywords: ['analytics', 'tracking', 'metrics', 'events'],
    packagePatterns: ['firebase_analytics', 'mixpanel', 'amplitude', 'segment', '@react-native-firebase/analytics'],
  },
  {
    name: 'In-App Purchases',
    files: [],
    keywords: ['purchase', 'subscription', 'iap', 'billing'],
    packagePatterns: ['in_app_purchase', 'react-native-iap', 'expo-in-app-purchases', 'purchases_flutter'],
  },
  {
    name: 'Biometric Authentication',
    files: [],
    keywords: ['biometric', 'fingerprint', 'faceid', 'touchid'],
    packagePatterns: ['local_auth', 'react-native-biometrics', 'expo-local-authentication'],
  },
  {
    name: 'Local Storage',
    files: [],
    keywords: ['storage', 'database', 'sqlite', 'realm'],
    packagePatterns: ['shared_preferences', 'sqflite', 'hive', 'async-storage', '@react-native-async-storage/async-storage'],
  },
  {
    name: 'Networking',
    files: [],
    keywords: ['http', 'api', 'fetch', 'axios', 'dio'],
    packagePatterns: ['dio', 'http', 'axios', 'retrofit'],
  },
  {
    name: 'Social Sharing',
    files: [],
    keywords: ['share', 'social', 'facebook', 'twitter'],
    packagePatterns: ['share_plus', 'react-native-share', 'expo-sharing'],
  },
];

/**
 * Detect features in the project
 */
export async function detectPatterns(projectDir: string, fileTree: string[]): Promise<DetectedFeature[]> {
  const features: DetectedFeature[] = [];
  const dependencies = await loadDependencies(projectDir);
  
  for (const pattern of FEATURE_PATTERNS) {
    let confidence = 0;
    const evidence: string[] = [];
    
    // Check for specific files
    for (const file of pattern.files) {
      if (fileTree.some(f => f.endsWith(file) || f.includes(file))) {
        confidence += 0.3;
        evidence.push(`File: ${file}`);
      }
    }
    
    // Check dependencies
    for (const pkg of pattern.packagePatterns) {
      if (dependencies.has(pkg.toLowerCase())) {
        confidence += 0.4;
        evidence.push(`Package: ${pkg}`);
      }
    }
    
    // Check file contents for keywords (simplified)
    if (confidence > 0 || pattern.keywords.length > 0) {
      const keywordMatches = await searchKeywords(projectDir, pattern.keywords, fileTree);
      if (keywordMatches > 0) {
        confidence += Math.min(keywordMatches * 0.1, 0.3);
        evidence.push(`${keywordMatches} keyword matches`);
      }
    }
    
    if (confidence > 0) {
      features.push({
        name: pattern.name,
        confidence: Math.min(confidence, 1),
        evidence: evidence.slice(0, 3),
      });
    }
  }
  
  // Sort by confidence
  features.sort((a, b) => b.confidence - a.confidence);
  
  return features;
}

/**
 * Load all dependencies from the project
 */
async function loadDependencies(projectDir: string): Promise<Set<string>> {
  const deps = new Set<string>();
  
  // package.json
  try {
    const packageJson = await fs.readJSON(path.join(projectDir, 'package.json'));
    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    for (const name of Object.keys(allDeps)) {
      deps.add(name.toLowerCase());
    }
  } catch {
    // Ignore
  }
  
  // pubspec.yaml
  try {
    const yaml = await import('yaml');
    const pubspecContent = await fs.readFile(path.join(projectDir, 'pubspec.yaml'), 'utf-8');
    const pubspec = yaml.parse(pubspecContent);
    const flutterDeps = { ...pubspec.dependencies, ...pubspec.dev_dependencies };
    for (const name of Object.keys(flutterDeps)) {
      deps.add(name.toLowerCase());
    }
  } catch {
    // Ignore
  }
  
  return deps;
}

/**
 * Search for keywords in project files
 */
async function searchKeywords(projectDir: string, keywords: string[], fileTree: string[]): Promise<number> {
  let matches = 0;
  
  // Search ALL source files for deep analysis
  const filesToSearch = fileTree.filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ['.js', '.ts', '.dart', '.swift', '.kt', '.java', '.json', '.yaml', '.tsx', '.jsx', '.m', '.mm', '.h'].includes(ext);
  });
  
  // Process files in batches to avoid memory issues
  const batchSize = 100;
  for (let i = 0; i < filesToSearch.length; i += batchSize) {
    const batch = filesToSearch.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (file) => {
      try {
        const content = await fs.readFile(path.join(projectDir, file), 'utf-8');
        const lowerContent = content.toLowerCase();
        
        for (const keyword of keywords) {
          if (lowerContent.includes(keyword.toLowerCase())) {
            matches++;
            break; // Only count once per file
          }
        }
      } catch {
        // Ignore unreadable files
      }
    }));
  }
  
  return matches;
}

export default detectPatterns;


