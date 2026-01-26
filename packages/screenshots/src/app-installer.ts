import { execSync, spawn, type ChildProcess } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, readdirSync, writeFileSync, copyFileSync } from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { MobilePlatform } from './types.js';
import { processRegistry, type PromptCallback } from './process-registry.js';

export interface AppInstallerOptions {
  sessionId?: string;
  onPrompt?: PromptCallback;
}

export interface ExpoGoSession {
  metroProcess: ChildProcess;
  metroUrl: string;
  bundleId: string;
  repoPath: string;
  cleanup: () => void;
}

export class ExpoGoRunner {
  private static readonly EXPO_GO_BUNDLE_ID = 'host.exp.Exponent';

  static async start(repoPath: string, options?: AppInstallerOptions): Promise<ExpoGoSession> {
    console.log('🚀 Starting Expo Go session...');
    
    const hasYarnLock = existsSync(path.join(repoPath, 'yarn.lock'));
    const hasPnpmLock = existsSync(path.join(repoPath, 'pnpm-lock.yaml'));
    
    let installCmd: string;
    let runPrefix: string;
    if (hasPnpmLock) {
      installCmd = 'pnpm install';
      runPrefix = 'pnpm';
    } else if (hasYarnLock) {
      installCmd = 'yarn install';
      runPrefix = 'yarn';
    } else {
      installCmd = 'npm install --legacy-peer-deps';
      runPrefix = 'npx';
    }
    
    console.log('📦 Installing dependencies...');
    execSync(installCmd, { cwd: repoPath, stdio: 'inherit' });
    
    this.patchMetroConfig(repoPath);
    
    const bundleId = this.getBundleId(repoPath);
    console.log(`📱 Bundle ID: ${bundleId}`);
    
    await this.ensureSimulatorBooted();
    
    const port = 8081;
    const metroUrl = `exp://127.0.0.1:${port}`;
    
    console.log('🧹 Terminating any existing Expo Go instance...');
    try {
      execSync(`xcrun simctl terminate booted ${this.EXPO_GO_BUNDLE_ID}`, { stdio: 'pipe' });
      await this.delay(500);
    } catch {}
    
    console.log('🔄 Starting Metro bundler...');
    const metroProcess = spawn(runPrefix, ['expo', 'start', '--port', String(port), '--localhost'], {
      cwd: repoPath,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CI: '1',
        EXPO_NO_DOTENV: '1',
      },
      detached: false,
    });

    let bundleComplete = false;
    let bundleError = false;

    metroProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      if (output.trim()) {
        console.log(`[Metro] ${output.trim()}`);
        if (output.includes('Bundling complete') || output.includes('Bundled')) {
          bundleComplete = true;
        }
        if (output.includes('Bundling failed')) {
          bundleError = true;
        }
      }
    });

    metroProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      if (output.trim() && !output.includes('WARN')) {
        console.log(`[Metro] ${output.trim()}`);
      }
    });

    await this.waitForMetro(port);
    console.log('✓ Metro bundler is ready');

    console.log(`📲 Opening Expo Go with URL: ${metroUrl}`);
    try {
      execSync(`xcrun simctl openurl booted "${metroUrl}"`, { stdio: 'pipe' });
    } catch (error) {
      console.log('⚠️ Could not open URL directly, Expo Go may need to be installed...');
      spawn(runPrefix, ['expo', 'start', '--ios', '--port', String(port), '--localhost'], { 
        cwd: repoPath, 
        shell: true, 
        stdio: 'pipe',
        detached: true,
      });
      await this.delay(5000);
      try {
        execSync(`xcrun simctl openurl booted "${metroUrl}"`, { stdio: 'pipe' });
      } catch {}
    }

    console.log('⏳ Waiting for initial bundle to complete...');
    const bundleTimeout = 30000;
    const bundleStart = Date.now();
    while (!bundleComplete && !bundleError && Date.now() - bundleStart < bundleTimeout) {
      await this.delay(1000);
    }

    if (bundleError) {
      console.log('⚠️ Bundle had errors, but continuing with capture attempt...');
    } else if (bundleComplete) {
      console.log('✓ Initial bundle complete');
    } else {
      console.log('⚠️ Bundle timeout, continuing anyway...');
    }

    await this.delay(3000);

    const cleanup = () => {
      console.log('🧹 Cleaning up Expo Go session...');
      try {
        execSync(`xcrun simctl terminate booted ${this.EXPO_GO_BUNDLE_ID}`, { stdio: 'pipe' });
      } catch {}
      
      try {
        if (metroProcess && !metroProcess.killed) {
          metroProcess.kill('SIGTERM');
          setTimeout(() => {
            if (!metroProcess.killed) metroProcess.kill('SIGKILL');
          }, 3000);
        }
      } catch {}
      
      try {
        if (repoPath.startsWith(os.tmpdir())) {
          rmSync(repoPath, { recursive: true, force: true });
        }
      } catch {}
    };

    return {
      metroProcess,
      metroUrl,
      bundleId: this.EXPO_GO_BUNDLE_ID,
      repoPath,
      cleanup,
    };
  }

  private static async ensureSimulatorBooted(): Promise<void> {
    console.log('📱 Ensuring iOS Simulator is booted...');
    
    try {
      const deviceList = execSync('xcrun simctl list devices booted -j', { encoding: 'utf-8' });
      const devices = JSON.parse(deviceList);
      
      let hasBooted = false;
      for (const runtime of Object.values(devices.devices) as Array<Array<unknown>>) {
        if (runtime.length > 0) {
          hasBooted = true;
          break;
        }
      }
      
      if (!hasBooted) {
        console.log('   No booted simulator found, booting default...');
        execSync('xcrun simctl boot booted 2>/dev/null || open -a Simulator', { stdio: 'pipe' });
        await this.delay(5000);
      }
      
      console.log('✓ Simulator is ready');
    } catch {
      console.log('   Attempting to open Simulator app...');
      execSync('open -a Simulator', { stdio: 'pipe' });
      await this.delay(5000);
    }
  }

  private static async waitForMetro(port: number, timeoutMs: number = 60000): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 1000;
    
    console.log(`   Waiting for Metro on port ${port}...`);
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/status`);
        const text = await response.text();
        if (text.includes('packager-status:running')) {
          return;
        }
      } catch {
        // Metro not ready yet
      }
      await this.delay(checkInterval);
    }
    
    throw new Error(`Metro bundler failed to start within ${timeoutMs / 1000} seconds`);
  }

  private static patchMetroConfig(repoPath: string): void {
    console.log('🔧 Patching Metro config for compatibility...');
    
    const metroConfigPath = path.join(repoPath, 'metro.config.js');
    const metroBackupPath = path.join(repoPath, 'metro.config.js.stora-backup');
    
    if (existsSync(metroConfigPath)) {
      copyFileSync(metroConfigPath, metroBackupPath);
      console.log('   📋 Backed up existing metro.config.js');
    }
    
    const patchedConfig = `// Auto-patched by stora for compatibility
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver = config.resolver || {};
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Fix: zod/v4 -> zod (compatibility patch)
  if (moduleName === 'zod/v4') {
    moduleName = 'zod';
  }
  
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
`;
    
    writeFileSync(metroConfigPath, patchedConfig, 'utf-8');
    console.log('   ✓ Metro config patched (zod/v4 -> zod redirect)');
  }

  private static getBundleId(repoPath: string): string {
    const appJsonPath = path.join(repoPath, 'app.json');
    const appConfigJsPath = path.join(repoPath, 'app.config.js');
    const appConfigTsPath = path.join(repoPath, 'app.config.ts');
    
    if (existsSync(appJsonPath)) {
      try {
        const appJson = JSON.parse(readFileSync(appJsonPath, 'utf-8'));
        const bundleId = appJson.expo?.ios?.bundleIdentifier || 
                         appJson.ios?.bundleIdentifier ||
                         `host.exp.Exponent`;
        return bundleId;
      } catch {}
    }
    
    if (existsSync(appConfigJsPath) || existsSync(appConfigTsPath)) {
      try {
        const configPath = existsSync(appConfigTsPath) ? appConfigTsPath : appConfigJsPath;
        const configContent = readFileSync(configPath, 'utf-8');
        const bundleIdMatch = configContent.match(/bundleIdentifier:\s*["']([^"']+)["']/);
        if (bundleIdMatch) {
          return bundleIdMatch[1];
        }
      } catch {}
    }
    
    return 'host.exp.Exponent';
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class AppInstaller {
  private repoPath: string;
  private platform: MobilePlatform;
  private sessionId?: string;
  private onPrompt?: PromptCallback;

  constructor(repoPath: string, platform: MobilePlatform, options?: AppInstallerOptions) {
    this.repoPath = repoPath;
    this.platform = platform;
    this.sessionId = options?.sessionId;
    this.onPrompt = options?.onPrompt;
  }

  static async cloneRepo(repoUrl: string): Promise<string> {
    const tempDir = path.join(os.tmpdir(), `stora-build-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    console.log(`📦 Cloning repository...`);
    try {
      execSync(`git clone --depth 1 "${repoUrl}" "${tempDir}"`, {
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 120000,
      });
      console.log(`✓ Repository cloned to ${tempDir}`);
      return tempDir;
    } catch (error: unknown) {
      const err = error as { message?: string };
      throw new Error(`Failed to clone repository: ${err.message || 'Unknown error'}`);
    }
  }

  static detectPlatform(repoPath: string): MobilePlatform {
    if (existsSync(path.join(repoPath, 'pubspec.yaml'))) {
      return 'flutter';
    }

    const packageJsonPath = path.join(repoPath, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        if (deps['react-native']) {
          if (existsSync(path.join(repoPath, 'app.json')) || 
              existsSync(path.join(repoPath, 'app.config.js')) ||
              existsSync(path.join(repoPath, 'app.config.ts'))) {
            return 'expo';
          }
          return 'react-native';
        }
      } catch {
        // ignore
      }
    }

    if (existsSync(path.join(repoPath, 'ios')) && 
        readdirSync(path.join(repoPath, 'ios')).some(f => f.endsWith('.xcodeproj') || f.endsWith('.xcworkspace'))) {
      return 'swift';
    }

    throw new Error('Could not detect mobile platform. Supported: Flutter, React Native, Expo, Swift');
  }

  async buildAndInstall(): Promise<string> {
    console.log(`🔨 Building ${this.platform} app for iOS Simulator...`);

    switch (this.platform) {
      case 'flutter':
        return this.buildFlutter();
      case 'expo':
        return this.buildExpo();
      case 'react-native':
        return this.buildReactNative();
      case 'swift':
        return this.buildSwift();
      default:
        throw new Error(`Unsupported platform: ${this.platform}`);
    }
  }

  private async buildExpo(): Promise<string> {
    console.log('📱 Building Expo app with embedded JS bundle...');

    const hasYarnLock = existsSync(path.join(this.repoPath, 'yarn.lock'));
    const hasPnpmLock = existsSync(path.join(this.repoPath, 'pnpm-lock.yaml'));
    
    let installCmd: string;
    if (hasPnpmLock) {
      installCmd = 'pnpm install';
    } else if (hasYarnLock) {
      installCmd = 'yarn install';
    } else {
      installCmd = 'npm install --legacy-peer-deps';
    }
    
    await this.runCommand(installCmd, 'Installing dependencies...');

    const derivedData = path.join(this.repoPath, 'DerivedData');
    
    const buildCmd = [
      'npx expo run:ios',
      '--no-install',
      '--configuration Release',
      '--device simulator',
      `--build-cache`,
    ].join(' ');

    await this.runCommand(buildCmd, 'Building Expo app for iOS Simulator (this may take several minutes)...');

    const iosDir = path.join(this.repoPath, 'ios');
    if (existsSync(iosDir)) {
      const { scheme } = this.findXcodeProject();
      
      const searchPaths = [
        path.join(derivedData, 'Build', 'Products', 'Release-iphonesimulator'),
        path.join(derivedData, 'Build', 'Products', 'Debug-iphonesimulator'),
        path.join(this.repoPath, 'ios', 'build', 'Build', 'Products', 'Release-iphonesimulator'),
        path.join(this.repoPath, 'ios', 'build', 'Build', 'Products', 'Debug-iphonesimulator'),
        path.join(os.homedir(), 'Library', 'Developer', 'Xcode', 'DerivedData'),
      ];
      
      for (const searchPath of searchPaths) {
        if (existsSync(searchPath)) {
          console.log(`🔍 Searching for .app in: ${searchPath}`);
          const apps = this.findAppsRecursively(searchPath, 3);
          if (apps.length > 0) {
            const appSchemeMatch = apps.find(a => path.basename(a, '.app') === scheme);
            const appPath = appSchemeMatch || apps[0];
            console.log(`✓ Expo build complete: ${appPath}`);
            return appPath;
          }
        }
      }
      
      console.log('🔍 Searching entire repo for .app bundles...');
      const allApps = this.findAppsRecursively(this.repoPath, 6);
      if (allApps.length > 0) {
        const releaseApp = allApps.find(a => a.includes('Release'));
        const appPath = releaseApp || allApps[0];
        console.log(`✓ Expo build complete: ${appPath}`);
        return appPath;
      }
    }

    throw new Error('Expo build completed but .app bundle not found. Check build output for errors.');
  }

  private async buildFlutter(): Promise<string> {
    console.log('📱 Building Flutter app...');

    await this.runCommand('flutter pub get', 'Installing Flutter dependencies...');

    if (existsSync(path.join(this.repoPath, 'ios', 'Podfile'))) {
      await this.runCommand('pod install', 'Installing CocoaPods...', path.join(this.repoPath, 'ios'));
    }

    await this.runCommand(
      'flutter build ios --simulator --no-codesign',
      'Building for iOS Simulator (this may take a few minutes)...'
    );

    const appPath = path.join(this.repoPath, 'build', 'ios', 'iphonesimulator', 'Runner.app');
    if (!existsSync(appPath)) {
      throw new Error(`Flutter build failed: App not found at ${appPath}`);
    }

    console.log(`✓ Flutter build complete: ${appPath}`);
    return appPath;
  }

  private async buildReactNative(): Promise<string> {
    console.log('📱 Building React Native app...');

    const hasYarnLock = existsSync(path.join(this.repoPath, 'yarn.lock'));
    await this.runCommand(
      hasYarnLock ? 'yarn install' : 'npm install --legacy-peer-deps',
      'Installing npm dependencies...'
    );

    if (this.platform === 'expo' && !existsSync(path.join(this.repoPath, 'ios'))) {
      await this.runCommand('CI=1 npx expo prebuild --platform ios', 'Running Expo prebuild...');
    }

    if (existsSync(path.join(this.repoPath, 'ios', 'Podfile'))) {
      await this.runCommand('pod install', 'Installing CocoaPods...', path.join(this.repoPath, 'ios'));
    }

    const { workspace, scheme } = this.findXcodeProject();
    const derivedData = path.join(this.repoPath, 'DerivedData');

    const buildCmd = [
      'xcodebuild',
      `-workspace "${workspace}"`,
      `-scheme "${scheme}"`,
      '-configuration Debug',
      '-sdk iphonesimulator',
      '-destination "generic/platform=iOS Simulator"',
      `-derivedDataPath "${derivedData}"`,
      'CODE_SIGN_IDENTITY=""',
      'CODE_SIGNING_REQUIRED=NO',
      'build',
    ].join(' ');

    await this.runCommand(buildCmd, 'Building for iOS Simulator (this may take several minutes)...');

    const appPath = this.findAppBundle(derivedData, scheme);
    console.log(`✓ React Native build complete: ${appPath}`);
    return appPath;
  }

  private async buildSwift(): Promise<string> {
    console.log('📱 Building Swift/iOS app...');

    if (existsSync(path.join(this.repoPath, 'ios', 'Podfile'))) {
      await this.runCommand('pod install', 'Installing CocoaPods...', path.join(this.repoPath, 'ios'));
    } else if (existsSync(path.join(this.repoPath, 'Podfile'))) {
      await this.runCommand('pod install', 'Installing CocoaPods...');
    }

    const { workspace, scheme, project } = this.findXcodeProject();
    const derivedData = path.join(this.repoPath, 'DerivedData');

    const projectArg = workspace 
      ? `-workspace "${workspace}"`
      : `-project "${project}"`;

    const buildCmd = [
      'xcodebuild',
      projectArg,
      `-scheme "${scheme}"`,
      '-configuration Debug',
      '-sdk iphonesimulator',
      '-destination "generic/platform=iOS Simulator"',
      `-derivedDataPath "${derivedData}"`,
      'CODE_SIGN_IDENTITY=""',
      'CODE_SIGNING_REQUIRED=NO',
      'build',
    ].join(' ');

    await this.runCommand(buildCmd, 'Building for iOS Simulator (this may take several minutes)...');

    const appPath = this.findAppBundle(derivedData, scheme);
    console.log(`✓ Swift build complete: ${appPath}`);
    return appPath;
  }

  private findXcodeProject(): { workspace?: string; project?: string; scheme: string } {
    const iosDir = existsSync(path.join(this.repoPath, 'ios')) 
      ? path.join(this.repoPath, 'ios')
      : this.repoPath;

    const files = readdirSync(iosDir);
    const workspaceFile = files.find(f => f.endsWith('.xcworkspace'));
    const projectFile = files.find(f => f.endsWith('.xcodeproj'));

    const workspace = workspaceFile ? path.join(iosDir, workspaceFile) : undefined;
    const project = projectFile ? path.join(iosDir, projectFile) : undefined;

    if (!workspace && !project) {
      throw new Error('No Xcode workspace or project found');
    }

    const targetPath = workspace || project;
    let scheme: string;

    try {
      const listOutput = execSync(
        `xcodebuild -list ${workspace ? `-workspace "${workspace}"` : `-project "${project}"`} -json`,
        { encoding: 'utf-8', cwd: this.repoPath, stdio: 'pipe' }
      );
      const listData = JSON.parse(listOutput);
      const schemes: string[] = listData.workspace?.schemes || listData.project?.schemes || [];
      
      console.log(`📋 Available schemes: ${schemes.join(', ')}`);
      
      const INTERNAL_SCHEME_PREFIXES = [
        'EX', 'RN', 'React', 'Flipper', 'Yoga', 'FBReact', 'glog',
        'DoubleConversion', 'Folly', 'boost', 'RCT', 'FBLazy', 'hermes',
        'CocoaAsyncSocket', 'SocketRocket', 'fmt', 'libevent',
      ];
      
      const appSchemes = schemes.filter((s: string) => 
        !INTERNAL_SCHEME_PREFIXES.some(prefix => s.startsWith(prefix))
      );
      
      const baseName = path.basename(targetPath!, path.extname(targetPath!));
      const exactMatch = appSchemes.find((s: string) => s === baseName);
      
      if (exactMatch) {
        scheme = exactMatch;
        console.log(`✓ Using scheme matching project name: ${scheme}`);
      } else if (appSchemes.length > 0) {
        scheme = appSchemes[0];
        console.log(`✓ Using filtered scheme: ${scheme}`);
      } else if (schemes.length > 0) {
        scheme = schemes[0];
        console.log(`⚠️ All schemes filtered, falling back to: ${scheme}`);
      } else {
        throw new Error('No schemes found in Xcode project');
      }
    } catch (error) {
      const baseName = path.basename(targetPath!, path.extname(targetPath!));
      scheme = baseName;
      console.log(`⚠️ Could not detect scheme, using: ${scheme}`);
    }

    return { workspace, project, scheme };
  }

  private findAppBundle(derivedData: string, schemeName: string): string {
    console.log(`🔍 Looking for .app bundle...`);
    console.log(`   Scheme name: ${schemeName}`);
    console.log(`   DerivedData path: ${derivedData}`);

    // First, check if DerivedData exists at all
    if (!existsSync(derivedData)) {
      console.log(`   ❌ DerivedData directory does not exist`);
      // List parent directory to help debug
      const parentDir = path.dirname(derivedData);
      if (existsSync(parentDir)) {
        console.log(`   📁 Parent directory contents (${parentDir}):`);
        try {
          const items = readdirSync(parentDir);
          items.forEach(item => console.log(`      - ${item}`));
        } catch { /* ignore */ }
      }
      throw new Error(`DerivedData not found at ${derivedData}`);
    }

    // List DerivedData structure for debugging
    console.log(`   📁 DerivedData structure:`);
    this.listDirectoryTree(derivedData, 3, '      ');

    const productsDir = path.join(derivedData, 'Build', 'Products', 'Debug-iphonesimulator');
    
    if (!existsSync(productsDir)) {
      console.log(`   ❌ Products directory does not exist at expected path`);
      console.log(`   Expected: ${productsDir}`);
      
      // Search for any .app bundles recursively in DerivedData
      console.log(`   🔎 Searching recursively for .app bundles in DerivedData...`);
      const recursiveApps = this.findAppsRecursively(derivedData, 5);
      if (recursiveApps.length > 0) {
        console.log(`   ✓ Found ${recursiveApps.length} .app bundle(s) via recursive search:`);
        recursiveApps.forEach(app => console.log(`      - ${app}`));
        return recursiveApps[0];
      }
      
      throw new Error(`Build products not found at ${productsDir}. No .app bundles found anywhere in DerivedData.`);
    }

    // List products directory contents
    console.log(`   📁 Products directory contents:`);
    const allItems = readdirSync(productsDir);
    allItems.forEach(item => console.log(`      - ${item}`));

    // Try exact match first
    const expectedPath = path.join(productsDir, `${schemeName}.app`);
    if (existsSync(expectedPath)) {
      console.log(`   ✓ Found exact match: ${schemeName}.app`);
      return expectedPath;
    }

    // Try case-insensitive match
    const apps = allItems.filter(f => f.endsWith('.app'));
    if (apps.length > 0) {
      console.log(`   ✓ Found .app bundle: ${apps[0]}`);
      return path.join(productsDir, apps[0]);
    }

    // Last resort: recursive search from DerivedData root
    console.log(`   ⚠️ No .app in products dir, searching recursively...`);
    const recursiveApps = this.findAppsRecursively(derivedData, 5);
    if (recursiveApps.length > 0) {
      console.log(`   ✓ Found .app via recursive search: ${recursiveApps[0]}`);
      return recursiveApps[0];
    }

    // Also check if there's a different configuration (Release instead of Debug)
    const buildProductsDir = path.join(derivedData, 'Build', 'Products');
    if (existsSync(buildProductsDir)) {
      console.log(`   📁 All build configurations:`);
      const configs = readdirSync(buildProductsDir);
      configs.forEach(config => {
        const configPath = path.join(buildProductsDir, config);
        const configApps = existsSync(configPath) 
          ? readdirSync(configPath).filter(f => f.endsWith('.app'))
          : [];
        console.log(`      - ${config}: ${configApps.length > 0 ? configApps.join(', ') : '(no .app)'}`);
      });
    }

    throw new Error(`No .app bundle found in ${productsDir}. Scheme: ${schemeName}. See directory listing above for debugging.`);
  }

  /**
   * Recursively search for .app bundles
   */
  private findAppsRecursively(dir: string, maxDepth: number): string[] {
    if (maxDepth <= 0 || !existsSync(dir)) return [];
    
    const apps: string[] = [];
    try {
      const items = readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.name.endsWith('.app') && item.isDirectory()) {
          apps.push(fullPath);
        } else if (item.isDirectory() && !item.name.startsWith('.') && !item.name.endsWith('.app')) {
          apps.push(...this.findAppsRecursively(fullPath, maxDepth - 1));
        }
      }
    } catch {
      // Ignore permission errors
    }
    return apps;
  }

  /**
   * List directory tree for debugging
   */
  private listDirectoryTree(dir: string, maxDepth: number, indent: string = ''): void {
    if (maxDepth <= 0 || !existsSync(dir)) return;
    
    try {
      const items = readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        // Skip hidden files and limit noise
        if (item.name.startsWith('.')) continue;
        
        const icon = item.isDirectory() ? '📁' : '📄';
        console.log(`${indent}${icon} ${item.name}`);
        
        // Recurse into directories (but not into .app bundles, which are directories)
        if (item.isDirectory() && !item.name.endsWith('.app')) {
          this.listDirectoryTree(path.join(dir, item.name), maxDepth - 1, indent + '   ');
        }
      }
    } catch {
      // Ignore errors
    }
  }

  static async installApp(appPath: string, simulatorId?: string): Promise<void> {
    const target = simulatorId || 'booted';
    console.log(`📲 Installing app on simulator...`);

    try {
      execSync(`xcrun simctl install ${target} "${appPath}"`, {
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 60000,
      });
      console.log(`✓ App installed successfully`);
    } catch (error: unknown) {
      const err = error as { message?: string; stderr?: string };
      throw new Error(`Failed to install app: ${err.stderr || err.message || 'Unknown error'}`);
    }
  }

  static cleanup(repoPath: string): void {
    try {
      if (repoPath.startsWith(os.tmpdir())) {
        console.log('🧹 Cleaning up build directory...');
        rmSync(repoPath, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  }

  private async runCommand(command: string, message: string, cwd?: string): Promise<void> {
    console.log(message);
    console.log(`$ ${command}`);
    
    return new Promise<void>((resolve, reject) => {
      const child = spawn(command, {
        cwd: cwd || this.repoPath,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          CI: '1',
          NONINTERACTIVE: '1',
          DEBIAN_FRONTEND: 'noninteractive',
          COCOAPODS_DISABLE_STATS: '1',
          NO_FLIPPER: '1',
        },
      });

      const commandId = this.sessionId 
        ? `${this.sessionId}-${Date.now()}` 
        : `cmd-${Date.now()}`;

      if (this.sessionId && this.onPrompt) {
        processRegistry.register(commandId, child, this.onPrompt);
      }

      child.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
          if (line.trim()) console.log(line);
        });
      });

      child.stderr?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
          if (line.trim()) console.log(line);
        });
      });

      const timeout = setTimeout(() => {
        processRegistry.unregister(commandId);
        child.kill();
        reject(new Error(`Command timed out after 10 minutes: ${command}`));
      }, 600000);

      child.on('close', (code) => {
        clearTimeout(timeout);
        processRegistry.unregister(commandId);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with exit code ${code}: ${command}`));
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        processRegistry.unregister(commandId);
        reject(new Error(`Command failed: ${command}\n${err.message}`));
      });
    });
  }
}
