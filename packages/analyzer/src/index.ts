import fs from 'fs-extra';
import path from 'path';

export type Framework = 'flutter' | 'react-native' | 'expo' | 'capacitor' | 'cordova' | 'native-ios' | 'native-android' | null;
export type Platform = 'ios' | 'android';

export interface AppScanResult {
  name: string | null;
  framework: Framework;
  version: string | null;
  platforms: Platform[];
  ios?: { bundleId: string | null };
  android?: { packageName: string | null };
  features: DetectedFeature[];
  dependencies: DependencyInfo;
  warnings: Warning[];
  analyzedFiles: AnalyzedFile[];
  confidence: ConfidenceScore;
}

export interface DetectedFeature {
  name: string;
  type: string;
  confidence: number;
  evidence?: string[];
}

export interface DependencyInfo {
  direct: Array<{ name: string; version: string }>;
  sdks: {
    analytics: Array<{ name: string; version: string }>;
    ads: Array<{ name: string; version: string }>;
    payment: Array<{ name: string; version: string }>;
    social: Array<{ name: string; version: string }>;
  };
}

export interface Warning {
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface AnalyzedFile {
  path: string;
  type: string;
  purpose?: string;
  exists?: boolean;
}

export interface ConfidenceScore {
  overall: number;
  metadata: number;
  platforms: number;
  features: number;
  uncertainAreas: string[];
}

export async function deepScan(projectDir: string): Promise<AppScanResult> {
  const platforms = await detectPlatforms(projectDir);
  const framework = await detectFramework(projectDir);
  
  return {
    name: null,
    framework,
    version: null,
    platforms,
    features: [],
    dependencies: {
      direct: [],
      sdks: { analytics: [], ads: [], payment: [], social: [] },
    },
    warnings: platforms.length === 0 ? [{ severity: 'error', message: 'No mobile platforms detected' }] : [],
    analyzedFiles: [],
    confidence: {
      overall: 0.5,
      metadata: 0,
      platforms: platforms.length > 0 ? 1 : 0,
      features: 0,
      uncertainAreas: ['App Name', 'Version'],
    },
  };
}

async function detectFramework(projectDir: string): Promise<Framework> {
  if (await fs.pathExists(path.join(projectDir, 'pubspec.yaml'))) {
    return 'flutter';
  }
  
  const packageJsonPath = path.join(projectDir, 'package.json');
  if (await fs.pathExists(packageJsonPath)) {
    try {
      const packageJson = await fs.readJSON(packageJsonPath);
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      if (deps['expo']) return 'expo';
      if (deps['react-native']) return 'react-native';
    } catch {}
  }
  
  return null;
}

async function detectPlatforms(projectDir: string): Promise<Platform[]> {
  const platforms: Platform[] = [];
  
  if (await fs.pathExists(path.join(projectDir, 'ios'))) {
    platforms.push('ios');
  }
  
  if (await fs.pathExists(path.join(projectDir, 'android'))) {
    platforms.push('android');
  }
  
  return platforms;
}

export default deepScan;
