import fs from 'fs-extra';
import path from 'path';
import yaml from 'yaml';
import { parseStringPromise } from 'xml2js';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import type { Platform, Warning, AnalyzedFile, DeviceSupport } from './types.js';

export interface AnalyzerOptions {
  repoPath: string;
  options?: {
    deepScan?: boolean;
    aiEnrichment?: boolean;
  };
}

export class AppInformationAnalyzer {
  private repoPath: string;
  private deepScan: boolean;
  private aiEnrichment: boolean;
  private analyzedFiles: AnalyzedFile[] = [];

  constructor(config: AnalyzerOptions) {
    this.repoPath = config.repoPath;
    this.deepScan = config.options?.deepScan || false;
    this.aiEnrichment = config.options?.aiEnrichment || false;
  }

  private trackFile(
    relativePath: string,
    type: 'config' | 'source' | 'manifest' | 'asset' | 'other',
    purpose: string,
    exists: boolean
  ) {
    this.analyzedFiles.push({
      path: relativePath,
      type,
      purpose,
      exists,
    });
  }

  async analyze() {
    const metadata = await this.extractMetadata();
    const platforms = await this.detectPlatforms();
    const features = await this.detectFeatures();
    const dependencies = await this.analyzeDependencies();
    const deviceSupport = await this.detectDeviceSupport();
    const compliance = await this.checkCompliance();
    const confidence = this.calculateConfidence(metadata, platforms, features);

    let aiInsights = null;
    if (this.aiEnrichment && process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      aiInsights = await this.generateAIInsights(metadata, features, dependencies);
    }

    return {
      metadata,
      platforms,
      features,
      dependencies,
      deviceSupport,
      compliance,
      confidence,
      aiInsights,
      warnings: this.collectWarnings(metadata, platforms, compliance),
      analyzedFiles: this.analyzedFiles,
    };
  }

  private async extractMetadata() {
    const metadata: any = {
      displayName: null,
      bundleIdentifier: { ios: null, android: null },
      version: { name: null, code: null },
      framework: null,
      minSDKVersions: {},
      targetSDKVersions: {},
      description: null,
      author: null,
      license: null,
      repository: null,
      homepage: null,
    };

    // Check for Flutter
    const pubspecPath = path.join(this.repoPath, 'pubspec.yaml');
    const pubspecExists = await fs.pathExists(pubspecPath);
    this.trackFile('pubspec.yaml', 'config', 'Flutter configuration and dependencies', pubspecExists);
    if (pubspecExists) {
      const pubspec = yaml.parse(await fs.readFile(pubspecPath, 'utf-8'));
      metadata.displayName = pubspec.name;
      metadata.version.name = pubspec.version?.split('+')[0];
      metadata.version.code = parseInt(pubspec.version?.split('+')[1] || '1');
      metadata.framework = 'flutter';
    }

    // Check for React Native / Expo
    const packageJsonPath = path.join(this.repoPath, 'package.json');
    const packageJsonExists = await fs.pathExists(packageJsonPath);
    this.trackFile('package.json', 'config', 'JavaScript/TypeScript dependencies', packageJsonExists);
    if (packageJsonExists) {
      const packageJson = await fs.readJSON(packageJsonPath);
      metadata.displayName = metadata.displayName || packageJson.name;
      metadata.version.name = metadata.version.name || packageJson.version;
      metadata.description = packageJson.description;
      metadata.author = packageJson.author;
      metadata.license = packageJson.license;
      metadata.repository = packageJson.repository?.url || packageJson.repository;
      metadata.homepage = packageJson.homepage;

      if (packageJson.dependencies?.['react-native']) {
        metadata.framework = 'react-native';
      } else if (packageJson.dependencies?.['expo']) {
        metadata.framework = 'expo';
      }
    }

    // iOS Bundle ID - check multiple locations for Flutter and other frameworks
    const iosPlistPaths = [
      'ios/Runner/Info.plist', // Flutter
      'ios/App/Info.plist', // Capacitor
      'ios/Info.plist', // Some frameworks
    ];

    let infoPlistPath: string | null = null;
    for (const relativePath of iosPlistPaths) {
      const fullPath = path.join(this.repoPath, relativePath);
      if (await fs.pathExists(fullPath)) {
        infoPlistPath = fullPath;
        this.trackFile(relativePath, 'manifest', 'iOS app configuration and permissions', true);
        break;
      }
    }

    // Also search for it dynamically in ios subdirectories
    if (!infoPlistPath) {
      const iosDir = path.join(this.repoPath, 'ios');
      if (await fs.pathExists(iosDir)) {
        try {
          const entries = await fs.readdir(iosDir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'Pods' && entry.name !== 'build') {
              const candidatePath = path.join(iosDir, entry.name, 'Info.plist');
              if (await fs.pathExists(candidatePath)) {
                infoPlistPath = candidatePath;
                this.trackFile(
                  `ios/${entry.name}/Info.plist`,
                  'manifest',
                  'iOS app configuration and permissions',
                  true
                );
                break;
              }
            }
          }
        } catch {
          // Ignore errors
        }
      }
    }

    if (infoPlistPath) {
      try {
        const plistContent = await fs.readFile(infoPlistPath, 'utf-8');

        // Extract display name
        const displayMatch = plistContent.match(/<key>CFBundleDisplayName<\/key>\s*<string>([^<$]+)<\/string>/);
        if (displayMatch && displayMatch[1]) {
          metadata.displayName = metadata.displayName || displayMatch[1];
        }

        // Try CFBundleName as fallback
        if (!metadata.displayName) {
          const nameMatch = plistContent.match(/<key>CFBundleName<\/key>\s*<string>([^<$]+)<\/string>/);
          if (nameMatch && nameMatch[1]) {
            metadata.displayName = nameMatch[1];
          }
        }

        // Bundle ID - check if it's a variable
        const bundleIdMatch = plistContent.match(/<key>CFBundleIdentifier<\/key>\s*<string>([^<]+)<\/string>/);
        if (bundleIdMatch) {
          const bundleId = bundleIdMatch[1];
          if (!bundleId.includes('$') && !bundleId.includes('(')) {
            metadata.bundleIdentifier.ios = bundleId;
          }
        }
      } catch (error) {
        // Plist parsing failed, continue
      }
    }

    // If bundle ID not found in plist, check Xcode project (common in Flutter)
    if (!metadata.bundleIdentifier.ios) {
      const xcodeProjectPaths = [
        'ios/Runner.xcodeproj/project.pbxproj', // Flutter
        'ios/App.xcodeproj/project.pbxproj', // Capacitor
      ];

      for (const relativePath of xcodeProjectPaths) {
        const pbxPath = path.join(this.repoPath, relativePath);
        if (await fs.pathExists(pbxPath)) {
          this.trackFile(relativePath, 'config', 'Xcode project configuration', true);
          try {
            const pbxContent = await fs.readFile(pbxPath, 'utf-8');
            // Find non-test bundle identifier
            const matches = pbxContent.matchAll(/PRODUCT_BUNDLE_IDENTIFIER\s*=\s*([^;]+);/g);
            for (const match of matches) {
              let bundleId = match[1].trim().replace(/^["']|["']$/g, '');
              if (!bundleId.includes('Test') && !bundleId.includes('test')) {
                metadata.bundleIdentifier.ios = bundleId;
                break;
              }
            }
          } catch {
            // Ignore errors
          }
          break;
        }
      }
    }

    // Android Package Name - check build.gradle first (modern Gradle)
    const buildGradlePaths = ['android/app/build.gradle', 'android/app/build.gradle.kts'];

    for (const relativePath of buildGradlePaths) {
      const gradlePath = path.join(this.repoPath, relativePath);
      if (await fs.pathExists(gradlePath)) {
        this.trackFile(relativePath, 'config', 'Android build configuration', true);
        try {
          const gradleContent = await fs.readFile(gradlePath, 'utf-8');

          // namespace (modern Gradle)
          let match = gradleContent.match(/namespace\s+["']([^"']+)["']/);
          if (match) {
            metadata.bundleIdentifier.android = match[1];
          }

          // applicationId
          if (!metadata.bundleIdentifier.android) {
            match = gradleContent.match(/applicationId\s+["']([^"']+)["']/);
            if (match) {
              metadata.bundleIdentifier.android = match[1];
            }
          }

          // Version info from gradle
          const versionNameMatch = gradleContent.match(/versionName\s+["']([^"']+)["']/);
          const versionCodeMatch = gradleContent.match(/versionCode\s+(\d+)/);

          if (versionNameMatch && !metadata.version.name) {
            metadata.version.name = versionNameMatch[1];
          }
          if (versionCodeMatch && !metadata.version.code) {
            metadata.version.code = parseInt(versionCodeMatch[1]);
          }
        } catch {
          // Ignore errors
        }
        break;
      }
    }

    // Fallback: check AndroidManifest.xml for package (older style)
    const androidManifestPath = path.join(this.repoPath, 'android/app/src/main/AndroidManifest.xml');
    const androidManifestExists = await fs.pathExists(androidManifestPath);
    this.trackFile(
      'android/app/src/main/AndroidManifest.xml',
      'manifest',
      'Android app configuration and permissions',
      androidManifestExists
    );
    if (androidManifestExists && !metadata.bundleIdentifier.android) {
      try {
        const manifestContent = await fs.readFile(androidManifestPath, 'utf-8');
        const packageMatch = manifestContent.match(/package="([^"]+)"/);
        if (packageMatch) {
          metadata.bundleIdentifier.android = packageMatch[1];
        }

        // Also extract app label if not set
        if (!metadata.displayName) {
          const labelMatch = manifestContent.match(/android:label="([^"@]+)"/);
          if (labelMatch) {
            metadata.displayName = labelMatch[1];
          }
        }
      } catch (error) {
        // Manifest parsing failed
      }
    }

    // Track additional configuration files
    const appJsonPath = path.join(this.repoPath, 'app.json');
    const appJsonExists = await fs.pathExists(appJsonPath);
    this.trackFile('app.json', 'config', 'Expo/React Native app configuration', appJsonExists);
    if (appJsonExists) {
      try {
        const appJson = await fs.readJSON(appJsonPath);
        metadata.displayName = metadata.displayName || appJson.expo?.name || appJson.name;
        metadata.version.name = metadata.version.name || appJson.expo?.version || appJson.version;
        if (appJson.expo) {
          metadata.framework = metadata.framework || 'expo';
        }
      } catch (error) {
        // Error reading app.json
      }
    }

    // Track Gradle files for Android
    const buildGradlePath = path.join(this.repoPath, 'android/app/build.gradle');
    const buildGradleExists = await fs.pathExists(buildGradlePath);
    this.trackFile('android/app/build.gradle', 'config', 'Android build configuration', buildGradleExists);
    if (buildGradleExists) {
      try {
        const gradleContent = await fs.readFile(buildGradlePath, 'utf-8');
        const versionNameMatch = gradleContent.match(/versionName\s+"([^"]+)"/);
        const versionCodeMatch = gradleContent.match(/versionCode\s+(\d+)/);
        const minSdkMatch = gradleContent.match(/minSdkVersion\s+(\d+)/);
        const targetSdkMatch = gradleContent.match(/targetSdkVersion\s+(\d+)/);

        if (versionNameMatch) metadata.version.name = metadata.version.name || versionNameMatch[1];
        if (versionCodeMatch) metadata.version.code = metadata.version.code || parseInt(versionCodeMatch[1]);
        if (minSdkMatch) metadata.minSDKVersions.android = parseInt(minSdkMatch[1]);
        if (targetSdkMatch) metadata.targetSDKVersions.android = parseInt(targetSdkMatch[1]);
      } catch (error) {
        // Error reading gradle file
      }
    }

    // Track Podfile for iOS
    const podfilePath = path.join(this.repoPath, 'ios/Podfile');
    const podfileExists = await fs.pathExists(podfilePath);
    this.trackFile('ios/Podfile', 'config', 'iOS CocoaPods dependencies', podfileExists);

    // Track README
    const readmePath = path.join(this.repoPath, 'README.md');
    const readmeExists = await fs.pathExists(readmePath);
    this.trackFile('README.md', 'other', 'Project documentation', readmeExists);

    // Track .gitignore
    const gitignorePath = path.join(this.repoPath, '.gitignore');
    const gitignoreExists = await fs.pathExists(gitignorePath);
    this.trackFile('.gitignore', 'config', 'Git ignore patterns', gitignoreExists);

    // Track environment files
    const envPath = path.join(this.repoPath, '.env');
    const envExists = await fs.pathExists(envPath);
    this.trackFile('.env', 'config', 'Environment variables', envExists);

    const envExamplePath = path.join(this.repoPath, '.env.example');
    const envExampleExists = await fs.pathExists(envExamplePath);
    this.trackFile('.env.example', 'config', 'Environment variables template', envExampleExists);

    return metadata;
  }

  private async detectPlatforms(): Promise<Platform[]> {
    const platforms: Platform[] = [];

    // iOS
    if (await fs.pathExists(path.join(this.repoPath, 'ios'))) {
      platforms.push({
        platform: 'ios' as const,
        detected: true,
        ios: {
          targets: [],
          schemes: [],
        },
      });
    }

    // Android
    if (await fs.pathExists(path.join(this.repoPath, 'android'))) {
      platforms.push({
        platform: 'android' as const,
        detected: true,
        android: {
          buildVariants: ['debug', 'release'],
        },
      });
    }

    return platforms;
  }

  private async detectFeatures() {
    const features = [];
    const featureMap: Record<string, { files: string[]; keywords: string[] }> = {
      'Push Notifications': {
        files: ['firebase.json', 'google-services.json', 'GoogleService-Info.plist'],
        keywords: ['firebase', 'pushnotification', 'onesignal'],
      },
      'Camera Access': {
        files: [],
        keywords: ['camera', 'image-picker', 'react-native-camera'],
      },
      'Location Services': {
        files: [],
        keywords: ['geolocation', 'maps', 'location'],
      },
      Authentication: {
        files: [],
        keywords: ['auth', 'login', 'firebase-auth', 'auth0'],
      },
      Analytics: {
        files: [],
        keywords: ['analytics', 'mixpanel', 'amplitude', 'segment'],
      },
    };

    for (const [featureName, detection] of Object.entries(featureMap)) {
      let confidence = 0;
      const evidence = [];

      // Check for specific files
      for (const file of detection.files) {
        const filePath = path.join(this.repoPath, file);
        const exists = await fs.pathExists(filePath);
        if (exists) {
          confidence += 0.3;
          evidence.push(file);
          this.trackFile(file, 'config', `${featureName} configuration`, true);
        }
      }

      // Check package.json dependencies
      try {
        const packageJson = await fs.readJSON(path.join(this.repoPath, 'package.json'));
        const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

        for (const keyword of detection.keywords) {
          const foundDeps = Object.keys(allDeps).filter((dep) => dep.toLowerCase().includes(keyword.toLowerCase()));
          if (foundDeps.length > 0) {
            confidence += 0.2 * foundDeps.length;
            evidence.push(...foundDeps);
          }
        }
      } catch {
        // No package.json or read error
      }

      if (confidence > 0) {
        features.push({
          name: featureName,
          confidence: Math.min(confidence, 1),
          evidence: evidence.slice(0, 3),
        });
      }
    }

    return features;
  }

  private async analyzeDependencies() {
    const dependencies: any = {
      direct: [],
      sdks: {
        analytics: [],
        ads: [],
        payment: [],
        social: [],
      },
    };

    try {
      const packageJson = await fs.readJSON(path.join(this.repoPath, 'package.json'));
      const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      dependencies.direct = Object.entries(allDeps).map(([name, version]) => ({
        name,
        version: version as string,
      }));

      // Categorize SDKs
      const sdkPatterns = {
        analytics: ['analytics', 'mixpanel', 'amplitude', 'segment', 'firebase'],
        ads: ['admob', 'adsense', 'facebook-ads', 'google-ads'],
        payment: ['stripe', 'paypal', 'braintree', 'square', 'payment'],
        social: ['facebook', 'twitter', 'instagram', 'share'],
      };

      for (const [category, patterns] of Object.entries(sdkPatterns)) {
        dependencies.sdks[category] = dependencies.direct.filter((dep: any) =>
          patterns.some((pattern) => dep.name.toLowerCase().includes(pattern))
        );
      }
    } catch {
      // No package.json
    }

    return dependencies;
  }

  private async checkCompliance() {
    const permissions = [];
    const privacyRelated: any = {
      tracksUsers: false,
      collectsPersonalData: false,
      thirdPartySDKs: [],
    };

    // Check iOS permissions (Info.plist)
    try {
      const infoPlistPath = path.join(this.repoPath, 'ios/Info.plist');
      if (await fs.pathExists(infoPlistPath)) {
        const content = await fs.readFile(infoPlistPath, 'utf-8');

        const permissionPatterns = [
          { key: 'NSCameraUsageDescription', name: 'Camera Access', severity: 'warning' as const },
          { key: 'NSPhotoLibraryUsageDescription', name: 'Photo Library Access', severity: 'warning' as const },
          { key: 'NSLocationWhenInUseUsageDescription', name: 'Location Access', severity: 'warning' as const },
          { key: 'NSMicrophoneUsageDescription', name: 'Microphone Access', severity: 'critical' as const },
        ];

        for (const perm of permissionPatterns) {
          if (content.includes(perm.key)) {
            permissions.push({
              name: perm.name,
              platform: 'ios' as const,
              severity: perm.severity,
              justification: 'Found in Info.plist',
            });
          }
        }
      }
    } catch {
      // Error reading plist
    }

    // Check for tracking
    const trackingKeywords = ['analytics', 'tracking', 'mixpanel', 'amplitude'];
    try {
      const packageJson = await fs.readJSON(path.join(this.repoPath, 'package.json'));
      const allDeps = Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies });

      privacyRelated.tracksUsers = allDeps.some((dep) =>
        trackingKeywords.some((keyword) => dep.toLowerCase().includes(keyword))
      );

      if (privacyRelated.tracksUsers) {
        privacyRelated.thirdPartySDKs = allDeps.filter((dep) =>
          trackingKeywords.some((keyword) => dep.toLowerCase().includes(keyword))
        );
      }
    } catch {
      // No package.json
    }

    return {
      permissions,
      privacyRelated,
    };
  }

  private async generateAIInsights(metadata: any, features: any[], dependencies: any) {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return null;
    }

    try {
      const prompt = `Analyze this mobile app and provide insights:

App Name: ${metadata.displayName}
Framework: ${metadata.framework}
Features: ${features.map((f) => f.name).join(', ')}
Dependencies: ${dependencies.direct.length} packages

Provide:
1. App category (e.g., Social, E-commerce, Productivity)
2. Target audience
3. Key selling points (3-5 bullet points)
4. Suggested app description for stores (50-100 words)
5. Recommended keywords for App Store optimization (10 keywords)
6. Potential compliance concerns

Format as JSON.`;

      const { text } = await generateText({
        model: google('gemini-2.0-flash-exp') as any, // Flash is better for simple insights
        prompt,
      });

      // Strip markdown code blocks if present (```json ... ```)
      let jsonText = text.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText
          .replace(/^```json?\n?/, '')
          .replace(/\n?```$/, '')
          .trim();
      }

      return JSON.parse(jsonText);
    } catch (error) {
      console.error('AI enrichment failed:', error);
      return null;
    }
  }

  private calculateConfidence(metadata: any, platforms: any[], features: any[]) {
    let overall = 0;
    const factors = [];

    // Metadata confidence
    if (metadata.displayName) factors.push(0.2);
    if (metadata.bundleIdentifier.ios || metadata.bundleIdentifier.android) factors.push(0.2);
    if (metadata.version.name) factors.push(0.1);
    if (metadata.framework) factors.push(0.2);

    // Platform detection
    if (platforms.length > 0) factors.push(0.15);

    // Features detected
    if (features.length > 0) factors.push(0.15);

    overall = factors.reduce((sum, factor) => sum + factor, 0);

    return {
      overall: Math.min(overall, 1),
      metadata: factors.slice(0, 4).reduce((sum, f) => sum + f, 0) / 0.7,
      platforms: platforms.length > 0 ? 1 : 0,
      features: features.length > 0 ? 0.8 : 0.3,
      uncertainAreas: this.findUncertainAreas(metadata, platforms),
    };
  }

  private findUncertainAreas(metadata: any, platforms: any[]) {
    const uncertain = [];

    if (!metadata.bundleIdentifier.ios && platforms.some((p) => p.platform === 'ios')) {
      uncertain.push('iOS Bundle Identifier');
    }

    if (!metadata.bundleIdentifier.android && platforms.some((p) => p.platform === 'android')) {
      uncertain.push('Android Package Name');
    }

    if (!metadata.displayName) {
      uncertain.push('App Display Name');
    }

    return uncertain;
  }

  private collectWarnings(metadata: any, platforms: any[], compliance: any) {
    const warnings: Warning[] = [];

    if (platforms.length === 0) {
      warnings.push({
        severity: 'error' as const,
        message: 'No mobile platforms detected. Is this a mobile app?',
      });
    }

    if (!metadata.bundleIdentifier.ios && !metadata.bundleIdentifier.android) {
      warnings.push({
        severity: 'warning' as const,
        message: 'Bundle identifiers not found. Manual configuration required.',
      });
    }

    if (compliance.privacyRelated.tracksUsers && compliance.permissions.length === 0) {
      warnings.push({
        severity: 'warning' as const,
        message: 'App tracks users but no privacy permissions declared.',
      });
    }

    return warnings;
  }

  private async detectDeviceSupport(): Promise<DeviceSupport> {
    const deviceSupport: DeviceSupport = {
      // iOS defaults
      iPhone: false,
      iPad: false,
      iPadMini: false,
      iPadPro: false,

      // Android defaults
      phone: true, // Android phones are always supported by default
      tablet7inch: false,
      tablet10inch: false,
      chromebook: false,
      tv: false,
      wear: false,
      automotive: false,
      xr: false,
    };

    // Check iOS device support from Info.plist
    const iosSupport = await this.detectIOSDeviceSupport();
    Object.assign(deviceSupport, iosSupport);

    // Check Android device support from manifest
    const androidSupport = await this.detectAndroidDeviceSupport();
    Object.assign(deviceSupport, androidSupport);

    return deviceSupport;
  }

  private async detectIOSDeviceSupport(): Promise<Partial<DeviceSupport>> {
    const support: Partial<DeviceSupport> = {};

    // Check for iOS Info.plist
    const iosPlistPath = path.join(this.repoPath, 'ios', 'Runner', 'Info.plist');
    const iosPlistExists = await fs.pathExists(iosPlistPath);
    this.trackFile('ios/Runner/Info.plist', 'config', 'iOS app configuration', iosPlistExists);

    if (iosPlistExists) {
      try {
        const plistContent = await fs.readFile(iosPlistPath, 'utf-8');
        const deviceFamily = this.extractUIDeviceFamily(plistContent);

        support.iPhone = deviceFamily.includes(1);
        support.iPad = deviceFamily.includes(2);

        // For now, assume all iPad support includes both Mini and Pro
        if (support.iPad) {
          support.iPadMini = true;
          support.iPadPro = true;
        }
      } catch (error) {
        // If parsing fails, assume iPhone-only support
        support.iPhone = true;
      }
    }

    return support;
  }

  private async detectAndroidDeviceSupport(): Promise<Partial<DeviceSupport>> {
    const support: Partial<DeviceSupport> = {};

    // Check for Android manifest
    const androidManifestPath = path.join(this.repoPath, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
    const androidManifestExists = await fs.pathExists(androidManifestPath);
    this.trackFile(
      'android/app/src/main/AndroidManifest.xml',
      'manifest',
      'Android app manifest',
      androidManifestExists
    );

    if (androidManifestExists) {
      try {
        const manifestContent = await fs.readFile(androidManifestPath, 'utf-8');
        const supportsScreens = this.extractSupportsScreens(manifestContent);
        const usesFeatures = this.extractUsesFeatures(manifestContent);

        support.tablet7inch = supportsScreens.largeScreens !== false;
        support.tablet10inch = supportsScreens.xlargeScreens !== false;
        support.tv = usesFeatures.some((f) => f.name === 'android.software.leanback');
        support.wear = usesFeatures.some((f) => f.name === 'android.hardware.type.watch');
        support.automotive = usesFeatures.some((f) => f.name === 'android.car');
        support.xr = usesFeatures.some((f) => f.name === 'oculus.software.vr');

        // Chromebook support is generally enabled with xlarge screens
        support.chromebook = supportsScreens.xlargeScreens !== false;
      } catch (error) {
        // If parsing fails, use defaults
      }
    }

    return support;
  }

  private extractUIDeviceFamily(plistContent: string): number[] {
    // Simple regex extraction for UIDeviceFamily
    const deviceFamilyMatch = plistContent.match(/<key>UIDeviceFamily<\/key>\s*<array>([\s\S]*?)<\/array>/);
    if (!deviceFamilyMatch) return [1]; // Default to iPhone only

    const familyMatches = deviceFamilyMatch[1].match(/<integer>(\d+)<\/integer>/g);
    if (!familyMatches) return [1];

    return familyMatches.map((match) => parseInt(match.match(/<integer>(\d+)<\/integer>/)?.[1] || '1'));
  }

  private extractSupportsScreens(manifestContent: string): {
    largeScreens: boolean;
    xlargeScreens: boolean;
  } {
    const supportsScreensMatch = manifestContent.match(/<supports-screens([\s\S]*?)\/>/);
    if (!supportsScreensMatch) {
      return { largeScreens: true, xlargeScreens: true }; // Default Android behavior
    }

    const supportsScreens = supportsScreensMatch[1];
    const largeScreens = !supportsScreens.includes('android:largeScreens="false"');
    const xlargeScreens = !supportsScreens.includes('android:xlargeScreens="false"');

    return { largeScreens, xlargeScreens };
  }

  private extractUsesFeatures(manifestContent: string): Array<{ name: string }> {
    const features: Array<{ name: string }> = [];
    const featureMatches = manifestContent.matchAll(/<uses-feature[^>]*android:name="([^"]+)"/g);

    for (const match of featureMatches) {
      features.push({ name: match[1] });
    }

    return features;
  }
}

export * from './types.js';

/**
 * Convenience function to analyze an app directory
 * Returns a simplified result suitable for CLI usage
 */
export async function analyzeApp(
  projectDir: string,
  options?: { deepScan?: boolean; aiEnrichment?: boolean }
): Promise<{
  framework: string | null;
  ios?: { bundleId: string | null };
  android?: { packageName: string | null };
  name: string | null;
  version: string | null;
  platforms: string[];
  features: string[];
  warnings: Array<{ severity: string; message: string }>;
}> {
  const analyzer = new AppInformationAnalyzer({
    repoPath: projectDir,
    options,
  });

  const result = await analyzer.analyze();

  // Transform to simplified format for CLI
  const platforms = result.platforms.map((p) => p.platform);

  return {
    framework: result.metadata.framework,
    ios: platforms.includes('ios') ? { bundleId: result.metadata.bundleIdentifier.ios } : undefined,
    android: platforms.includes('android') ? { packageName: result.metadata.bundleIdentifier.android } : undefined,
    name: result.metadata.displayName,
    version: result.metadata.version.name,
    platforms,
    features: result.features.map((f) => f.name),
    warnings: result.warnings,
  };
}
