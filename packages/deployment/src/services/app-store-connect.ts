/**
 * App Store Connect Service
 * Handles all interactions with App Store Connect API
 */

import jwt from 'jsonwebtoken';
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import type {
  ASCCredentials,
  ASCAppInfo,
  ASCVersion,
  ASCBuild,
  ASCBundleId,
  ASCLocalization,
  AppMetadata,
  Screenshot,
  ScreenshotDeviceType,
  ProgressCallback,
} from './types.js';

interface ASCAuthToken {
  token: string;
  expiresAt: Date;
}

/**
 * App Store Connect error codes for structured error handling
 */
export const ASC_ERROR_CODES = {
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  APP_NAME_CONFLICT: 'APP_NAME_CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  ICON_ERROR: 'ICON_ERROR',
  UPLOAD_ERROR: 'UPLOAD_ERROR',
  REDUNDANT_BINARY: 'REDUNDANT_BINARY',
} as const;

interface ASCApiError {
  id?: string;
  code: string;
  title: string;
  detail: string;
  status: string;
}

interface ParsedASCError {
  type: keyof typeof ASC_ERROR_CODES | 'UNKNOWN';
  message: string;
  details: string[];
  code?: string;
  originalErrors: ASCApiError[];
}

/**
 * Parse ASC API errors into structured format
 */
function parseASCApiErrors(error: any): ParsedASCError {
  const errors: ASCApiError[] = error.response?.data?.errors || [];
  const details = errors.map((e) => e.detail || e.title).filter(Boolean);
  const message = details.join('\n') || error.message || 'Unknown error';
  
  // Combine all error text for pattern matching
  const errorText = message.toLowerCase();
  const statusCode = error.response?.status;
  
  // Version conflict (409 with version-related message)
  if (statusCode === 409 && 
      (errorText.includes('version') || errorText.includes('duplicate') || 
       errorText.includes('already exists'))) {
    return { type: 'VERSION_CONFLICT', message, details, originalErrors: errors };
  }
  
  // Icon/asset validation errors
  if (errorText.includes('icon') || errorText.includes('alpha') || 
      errorText.includes('transparent') || errorText.includes('asset catalog')) {
    return { type: 'ICON_ERROR', message, details, originalErrors: errors };
  }
  
  // Permission errors
  if (statusCode === 403 || errorText.includes('forbidden') ||
      errorText.includes('permission') || errorText.includes('not allowed') ||
      errorText.includes('does not allow')) {
    return { type: 'PERMISSION_ERROR', message, details, originalErrors: errors };
  }
  
  // App name conflict
  if (errorText.includes('name') && (errorText.includes('already') || 
      errorText.includes('taken') || errorText.includes('being used'))) {
    return { type: 'APP_NAME_CONFLICT', message, details, originalErrors: errors };
  }
  
  // General validation errors (409 without specific pattern)
  if (statusCode === 409) {
    return { type: 'VALIDATION_ERROR', message, details, originalErrors: errors };
  }
  
  return { type: 'UNKNOWN', message, details, originalErrors: errors };
}

// Map our device types to App Store Connect screenshot types
const SCREENSHOT_TYPE_MAP: Record<ScreenshotDeviceType, string> = {
  'iphone_69': 'APP_IPHONE_67',      // 6.9" maps to 6.7" display type
  'iphone_67': 'APP_IPHONE_67',
  'iphone_65': 'APP_IPHONE_65',
  'iphone_61': 'APP_IPHONE_61',
  'iphone_58': 'APP_IPHONE_58',
  'iphone_55': 'APP_IPHONE_55',
  'iphone_47': 'APP_IPHONE_47',
  'ipad_129': 'APP_IPAD_PRO_129',
  'ipad_11': 'APP_IPAD_PRO_3RD_GEN_11',
  'ipad_105': 'APP_IPAD_PRO_105',
  'ipad_97': 'APP_IPAD_97',
  'android_phone': 'APP_IPHONE_65',   // Fallback (won't be used for iOS)
  'android_7inch': 'APP_IPAD_97',     // Fallback
  'android_10inch': 'APP_IPAD_PRO_129', // Fallback
};

export class AppStoreConnectService {
  private credentials: ASCCredentials;
  private client: AxiosInstance;
  private currentToken?: ASCAuthToken;
  private readonly baseUrl = 'https://api.appstoreconnect.apple.com/v1';

  constructor(credentials: ASCCredentials) {
    this.credentials = credentials;
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to add auth token
    this.client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
      const token = await this.getAuthToken();
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }

  // ============================================================================
  // Authentication
  // ============================================================================

  /**
   * Generate JWT token for App Store Connect API
   */
  private async getAuthToken(): Promise<string> {
    // Check if current token is still valid
    if (this.currentToken && this.currentToken.expiresAt > new Date()) {
      return this.currentToken.token;
    }

    // Generate new token
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 20 * 60; // 20 minutes

    const payload = {
      iss: this.credentials.issuerId,
      iat: now,
      exp: now + expiresIn,
      aud: 'appstoreconnect-v1',
    };

    const token = jwt.sign(payload, this.credentials.privateKey, {
      algorithm: 'ES256',
      keyid: this.credentials.keyId,
    });

    this.currentToken = {
      token,
      expiresAt: new Date((now + expiresIn) * 1000),
    };

    return token;
  }

  // ============================================================================
  // App Information
  // ============================================================================

  /**
   * Get app information by bundle ID
   */
  async getAppInfo(bundleId: string): Promise<ASCAppInfo | null> {
    try {
      const response = await this.client.get('/apps', {
        params: {
          'filter[bundleId]': bundleId,
          limit: 1,
        },
      });

      if (response.data.data.length === 0) {
        return null;
      }

      const app = response.data.data[0];
      return {
        id: app.id,
        bundleId: app.attributes.bundleId,
        name: app.attributes.name,
        sku: app.attributes.sku,
        primaryLocale: app.attributes.primaryLocale,
        appStoreState: app.attributes.appStoreState,
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw new Error(`Failed to get app info: ${error.message}`);
    }
  }

  /**
   * Get app by ID
   */
  async getAppById(appId: string): Promise<ASCAppInfo | null> {
    try {
      const response = await this.client.get(`/apps/${appId}`);
      const app = response.data.data;
      return {
        id: app.id,
        bundleId: app.attributes.bundleId,
        name: app.attributes.name,
        sku: app.attributes.sku,
        primaryLocale: app.attributes.primaryLocale,
        appStoreState: app.attributes.appStoreState,
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw new Error(`Failed to get app: ${error.message}`);
    }
  }

  /**
   * Check if an app exists in App Store Connect
   */
  async checkAppExists(bundleId: string): Promise<boolean> {
    const app = await this.getAppInfo(bundleId);
    return app !== null;
  }

  /**
   * Create a new app in App Store Connect
   * This will automatically register the Bundle ID if it doesn't exist
   * 
   * @param options.bundleId - The bundle identifier (e.g., com.company.app)
   * @param options.name - The app name as it will appear on the App Store
   * @param options.sku - Stock Keeping Unit (defaults to bundle ID with dots replaced by underscores)
   * @param options.primaryLocale - Primary language/locale (defaults to en-US)
   * @param options.platform - Target platform: IOS, MAC_OS, or UNIVERSAL (defaults to IOS)
   * @param options.availableInNewTerritories - Make app available in new territories (defaults to true)
   * @param options.autoRegisterBundleId - Auto-register Bundle ID if not found (defaults to true)
   */
  async createApp(options: {
    bundleId: string;
    name: string;
    sku?: string;
    primaryLocale?: string;
    platform?: 'IOS' | 'MAC_OS' | 'UNIVERSAL';
    availableInNewTerritories?: boolean;
    autoRegisterBundleId?: boolean;
  }): Promise<ASCAppInfo> {
    try {
      const platform = options.platform || 'IOS';
      let bundleIdResource: ASCBundleId;
      
      // Check if auto-registration is enabled (default: true)
      const autoRegister = options.autoRegisterBundleId !== false;
      
      if (autoRegister) {
        // Ensure Bundle ID exists, register if needed
        // Map platform for Bundle ID registration
        const bundleIdPlatform = platform === 'UNIVERSAL' ? 'UNIVERSAL' : platform;
        const { bundleId, created } = await this.ensureBundleIdExists(
          options.bundleId,
          options.name,
          bundleIdPlatform
        );
        bundleIdResource = bundleId;
        
        if (created) {
          console.log(`  ✓ Registered Bundle ID: ${options.bundleId}`);
        }
      } else {
        // Just check if it exists
        const existing = await this.getBundleId(options.bundleId);
        
        if (!existing) {
          throw new Error(
            `Bundle ID "${options.bundleId}" not found in App Store Connect. ` +
            `Please register it in the Apple Developer Portal first: ` +
            `https://developer.apple.com/account/resources/identifiers/list`
          );
        }
        
        bundleIdResource = existing;
      }

      // Create the app
      // IMPORTANT: bundleId is passed via relationships, NOT attributes
      // See: https://developer.apple.com/documentation/appstoreconnectapi/post-v1-apps
      const response = await this.client.post('/apps', {
        data: {
          type: 'apps',
          attributes: {
            name: options.name,
            sku: options.sku || options.bundleId.replace(/\./g, '_'),
            primaryLocale: options.primaryLocale || 'en-US',
            availableInNewTerritories: options.availableInNewTerritories !== false,
          },
          relationships: {
            bundleId: {
              data: {
                type: 'bundleIds',
                id: bundleIdResource.id,
              },
            },
          },
        },
      });

      const app = response.data.data;
      return {
        id: app.id,
        bundleId: app.attributes.bundleId,
        name: app.attributes.name,
        sku: app.attributes.sku,
        primaryLocale: app.attributes.primaryLocale,
        appStoreState: app.attributes.appStoreState,
      };
    } catch (error: any) {
      // Enhanced error handling with helpful messages
      if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        const messages = errors.map((e: any) => e.detail || e.title).join(', ');
        
        // Detect specific error types and provide helpful guidance
        if (messages.includes('does not allow') && messages.includes('CREATE')) {
          throw new Error(
            `App creation not permitted.\n\n` +
            `This error typically occurs when:\n` +
            `  1. API key lacks Admin permissions\n` +
            `     → Check at: https://appstoreconnect.apple.com/access/api\n` +
            `  2. Required agreements are not signed\n` +
            `     → Check at: https://appstoreconnect.apple.com/agreements\n` +
            `  3. Account has restrictions on creating new apps\n\n` +
            `Original error: ${messages}`
          );
        }
        
        // Detect name conflict specifically
        if (messages.includes('already being used') || 
            messages.includes('name you entered is already') ||
            (messages.includes('ENTITY_ERROR') && messages.toLowerCase().includes('name'))) {
          const err = new Error(
            `APP_NAME_CONFLICT: The app name "${options.name}" is already in use.\n` +
            `App Store Connect requires unique app names globally.\n\n` +
            `Options:\n` +
            `  1. Set a unique name in config: ios.appName\n` +
            `  2. Re-run deployment to use auto-generated unique name\n\n` +
            `Original error: ${messages}`
          );
          (err as any).code = 'APP_NAME_CONFLICT';
          (err as any).attemptedName = options.name;
          throw err;
        }
        
        if (messages.includes('ENTITY_ERROR') || messages.includes('already exists')) {
          throw new Error(
            `Failed to create app: An app with this name or SKU may already exist.\n` +
            `Try a different app name or check existing apps at:\n` +
            `https://appstoreconnect.apple.com/apps\n\n` +
            `Original error: ${messages}`
          );
        }
        
        if (messages.includes('FORBIDDEN') || messages.includes('403')) {
          throw new Error(
            `Permission denied when creating app.\n\n` +
            `Please verify:\n` +
            `  1. Your API key has Admin access\n` +
            `  2. All agreements are signed at https://appstoreconnect.apple.com/agreements\n` +
            `  3. Your account can create apps in this region\n\n` +
            `Original error: ${messages}`
          );
        }
        
        throw new Error(`Failed to create app: ${messages}`);
      }
      throw new Error(`Failed to create app: ${error.message}`);
    }
  }

  /**
   * Check if app exists, create if not
   * Returns the app info (existing or newly created)
   */
  async ensureAppExists(options: {
    bundleId: string;
    name: string;
    sku?: string;
    primaryLocale?: string;
    platform?: 'IOS' | 'MAC_OS' | 'UNIVERSAL';
    availableInNewTerritories?: boolean;
  }): Promise<{ appInfo: ASCAppInfo; created: boolean }> {
    // Check if app exists
    const existing = await this.getAppInfo(options.bundleId);
    
    if (existing) {
      return { appInfo: existing, created: false };
    }

    // App doesn't exist, create it
    const newApp = await this.createApp({
      bundleId: options.bundleId,
      name: options.name,
      sku: options.sku,
      primaryLocale: options.primaryLocale,
      platform: options.platform,
      availableInNewTerritories: options.availableInNewTerritories,
    });
    return { appInfo: newApp, created: true };
  }

  /**
   * Get available territories for app distribution
   */
  async getAvailableTerritories(): Promise<Array<{ id: string; currency: string }>> {
    try {
      const response = await this.client.get('/territories', {
        params: { limit: 200 },
      });

      return response.data.data.map((t: any) => ({
        id: t.id,
        currency: t.attributes.currency,
      }));
    } catch (error: any) {
      throw new Error(`Failed to get territories: ${error.message}`);
    }
  }

  // ============================================================================
  // Bundle ID Management
  // ============================================================================

  /**
   * Get Bundle ID resource by identifier
   */
  async getBundleId(identifier: string): Promise<ASCBundleId | null> {
    try {
      const response = await this.client.get('/bundleIds', {
        params: {
          'filter[identifier]': identifier,
          limit: 1,
        },
      });

      if (response.data.data.length === 0) {
        return null;
      }

      const bundleId = response.data.data[0];
      return {
        id: bundleId.id,
        identifier: bundleId.attributes.identifier,
        name: bundleId.attributes.name,
        platform: bundleId.attributes.platform,
        seedId: bundleId.attributes.seedId,
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw new Error(`Failed to get Bundle ID: ${error.message}`);
    }
  }

  /**
   * Register a new Bundle ID in Apple Developer Portal
   * @param identifier - Bundle ID (e.g., com.company.app)
   * @param name - Display name for the Bundle ID
   * @param platform - Target platform (IOS, MAC_OS, or UNIVERSAL)
   */
  async registerBundleId(
    identifier: string,
    name: string,
    platform: 'IOS' | 'MAC_OS' | 'UNIVERSAL' = 'IOS'
  ): Promise<ASCBundleId> {
    try {
      // Validate Bundle ID format
      if (!this.isValidBundleIdFormat(identifier)) {
        throw new Error(
          `Invalid Bundle ID format: "${identifier}". ` +
          `Bundle ID must be in reverse-DNS format (e.g., com.company.app), ` +
          `contain only alphanumeric characters, hyphens, and periods, ` +
          `and be no longer than 255 characters.`
        );
      }

      const response = await this.client.post('/bundleIds', {
        data: {
          type: 'bundleIds',
          attributes: {
            identifier,
            name,
            platform,
          },
        },
      });

      const bundleId = response.data.data;
      return {
        id: bundleId.id,
        identifier: bundleId.attributes.identifier,
        name: bundleId.attributes.name,
        platform: bundleId.attributes.platform,
        seedId: bundleId.attributes.seedId,
      };
    } catch (error: any) {
      // Handle specific error cases
      if (error.response?.status === 409) {
        // Bundle ID already exists - this is actually fine
        const existing = await this.getBundleId(identifier);
        if (existing) {
          return existing;
        }
        throw new Error(`Bundle ID "${identifier}" already exists but could not be retrieved.`);
      }

      if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        const messages = errors.map((e: any) => e.detail || e.title).join(', ');
        
        // Provide helpful messages for common errors
        if (messages.includes('ENTITY_ERROR.ATTRIBUTE.INVALID')) {
          throw new Error(
            `Invalid Bundle ID: "${identifier}". ` +
            `Apple requires Bundle IDs to be in reverse-DNS format. ` +
            `Check that it doesn't use reserved prefixes (e.g., com.apple.*).`
          );
        }
        
        throw new Error(`Failed to register Bundle ID: ${messages}`);
      }
      
      throw new Error(`Failed to register Bundle ID: ${error.message}`);
    }
  }

  /**
   * Ensure Bundle ID exists, register if not
   * @returns Object with bundleId resource and whether it was created
   */
  async ensureBundleIdExists(
    identifier: string,
    name: string,
    platform: 'IOS' | 'MAC_OS' | 'UNIVERSAL' = 'IOS'
  ): Promise<{ bundleId: ASCBundleId; created: boolean }> {
    // Check if Bundle ID already exists
    const existing = await this.getBundleId(identifier);
    
    if (existing) {
      return { bundleId: existing, created: false };
    }

    // Register new Bundle ID
    const newBundleId = await this.registerBundleId(identifier, name, platform);
    return { bundleId: newBundleId, created: true };
  }

  /**
   * Validate Bundle ID format
   * Bundle IDs must be:
   * - In reverse-DNS format (e.g., com.company.app)
   * - Contain only alphanumeric characters, hyphens, and periods
   * - Max 255 characters
   * - Cannot start with a period or hyphen
   * - Cannot use reserved prefixes (com.apple.*)
   */
  private isValidBundleIdFormat(identifier: string): boolean {
    if (!identifier || identifier.length > 255) {
      return false;
    }

    // Must have at least two components (e.g., com.app)
    const parts = identifier.split('.');
    if (parts.length < 2) {
      return false;
    }

    // Check each part
    for (const part of parts) {
      // Part cannot be empty, start with hyphen, or contain invalid chars
      if (!part || part.startsWith('-') || !/^[a-zA-Z0-9-]+$/.test(part)) {
        return false;
      }
    }

    // Cannot use reserved Apple prefixes
    if (identifier.startsWith('com.apple.') || identifier.startsWith('com.apple-')) {
      return false;
    }

    return true;
  }

  // ============================================================================
  // Version Management
  // ============================================================================

  /**
   * Get latest version for an app
   */
  async getLatestVersion(appId: string): Promise<ASCVersion | null> {
    try {
      const response = await this.client.get(`/apps/${appId}/appStoreVersions`, {
        params: {
          'filter[platform]': 'IOS',
          limit: 1,
          sort: '-createdDate',
        },
      });

      if (response.data.data.length === 0) {
        return null;
      }

      const version = response.data.data[0];
      return {
        id: version.id,
        versionString: version.attributes.versionString,
        platform: version.attributes.platform,
        appStoreState: version.attributes.appStoreState,
        releaseType: version.attributes.releaseType,
        earliestReleaseDate: version.attributes.earliestReleaseDate,
        downloadable: version.attributes.downloadable,
        createdDate: version.attributes.createdDate,
      };
    } catch (error: any) {
      throw new Error(`Failed to get versions: ${error.message}`);
    }
  }

  /**
   * Get version by version string
   */
  async getVersion(appId: string, versionString: string): Promise<ASCVersion | null> {
    try {
      const response = await this.client.get(`/apps/${appId}/appStoreVersions`, {
        params: {
          'filter[platform]': 'IOS',
          'filter[versionString]': versionString,
        },
      });

      if (response.data.data.length === 0) {
        return null;
      }

      const version = response.data.data[0];
      return {
        id: version.id,
        versionString: version.attributes.versionString,
        platform: version.attributes.platform,
        appStoreState: version.attributes.appStoreState,
        releaseType: version.attributes.releaseType,
        createdDate: version.attributes.createdDate,
      };
    } catch (error: any) {
      throw new Error(`Failed to get version: ${error.message}`);
    }
  }

  /**
   * Create a new app store version
   */
  async createVersion(
    appId: string,
    versionString: string,
    platform: 'IOS' | 'MAC_OS' | 'TV_OS' = 'IOS',
    releaseType: 'MANUAL' | 'AFTER_APPROVAL' = 'MANUAL'
  ): Promise<ASCVersion> {
    try {
      const response = await this.client.post('/appStoreVersions', {
        data: {
          type: 'appStoreVersions',
          attributes: {
            versionString,
            platform,
            releaseType,
          },
          relationships: {
            app: {
              data: {
                type: 'apps',
                id: appId,
              },
            },
          },
        },
      });

      const version = response.data.data;
      return {
        id: version.id,
        versionString: version.attributes.versionString,
        platform: version.attributes.platform,
        appStoreState: version.attributes.appStoreState,
        releaseType: version.attributes.releaseType,
        createdDate: version.attributes.createdDate,
      };
    } catch (error: any) {
      // Parse and categorize the error
      const parsed = parseASCApiErrors(error);
      
      // Handle version conflict
      if (parsed.type === 'VERSION_CONFLICT') {
        const err = new Error(
          `VERSION_CONFLICT: Version "${versionString}" already exists in App Store Connect.\n` +
          `This version may have already been submitted or is currently in review.\n\n` +
          `Options:\n` +
          `  1. Increment version number and retry\n` +
          `  2. Use the existing version if it's in an editable state\n`
        );
        (err as any).code = ASC_ERROR_CODES.VERSION_CONFLICT;
        (err as any).conflictingVersion = versionString;
        (err as any).appId = appId;
        throw err;
      }
      
      // Handle icon/validation errors
      if (parsed.type === 'ICON_ERROR' || parsed.type === 'VALIDATION_ERROR') {
        const err = new Error(
          `App Store Connect validation failed:\n${parsed.details.map(d => `  • ${d}`).join('\n')}`
        );
        (err as any).code = parsed.type === 'ICON_ERROR' ? ASC_ERROR_CODES.ICON_ERROR : ASC_ERROR_CODES.VALIDATION_ERROR;
        (err as any).details = parsed.details;
        throw err;
      }
      
      // Handle permission errors
      if (parsed.type === 'PERMISSION_ERROR') {
        const err = new Error(
          `Permission denied:\n${parsed.message}\n\n` +
          `Please verify:\n` +
          `  1. Your API key has Admin access\n` +
          `  2. All agreements are signed at https://appstoreconnect.apple.com/agreements`
        );
        (err as any).code = ASC_ERROR_CODES.PERMISSION_ERROR;
        throw err;
      }
      
      throw new Error(`Failed to create version: ${parsed.message}`);
    }
  }

  /**
   * Create or get existing version
   */
  async createOrGetVersion(appId: string, versionString: string): Promise<ASCVersion> {
    // Check if version already exists
    const existing = await this.getVersion(appId, versionString);
    if (existing) {
      return existing;
    }

    // Create new version
    return this.createVersion(appId, versionString);
  }

  // ============================================================================
  // Build Management
  // ============================================================================

  /**
   * Upload binary to App Store Connect using xcrun altool
   */
  async uploadBinary(
    binaryPath: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    // Validate binary exists
    if (!(await fs.pathExists(binaryPath))) {
      throw new Error(`Binary not found: ${binaryPath}`);
    }

    onProgress?.({ step: 'upload', progress: 0, message: 'Preparing upload...' });

    // Create temporary API key file for altool
    const privateKeysDir = path.join(process.env.HOME || '~', '.appstoreconnect', 'private_keys');
    const apiKeyFileName = `AuthKey_${this.credentials.keyId}.p8`;
    const apiKeyPath = path.join(privateKeysDir, apiKeyFileName);

    await fs.ensureDir(privateKeysDir);
    await fs.writeFile(apiKeyPath, this.credentials.privateKey);

    try {
      onProgress?.({ step: 'upload', progress: 10, message: 'Uploading to App Store Connect...' });

      // Determine upload command based on file type
      let uploadCommand: string;
      if (binaryPath.endsWith('.ipa')) {
        uploadCommand = [
          'xcrun',
          'altool',
          '--upload-app',
          `--file "${binaryPath}"`,
          `--apiKey ${this.credentials.keyId}`,
          `--apiIssuer ${this.credentials.issuerId}`,
          '--type ios',
        ].join(' ');
      } else if (binaryPath.endsWith('.xcarchive')) {
        uploadCommand = [
          'xcrun',
          'altool',
          '--upload-package',
          `"${binaryPath}"`,
          `--apiKey ${this.credentials.keyId}`,
          `--apiIssuer ${this.credentials.issuerId}`,
          '--type ios',
        ].join(' ');
      } else {
        throw new Error(`Unsupported build file type: ${binaryPath}`);
      }

      // Execute upload and capture output
      try {
        execSync(uploadCommand, {
          stdio: 'pipe',
          maxBuffer: 100 * 1024 * 1024, // 100MB buffer
          encoding: 'utf-8',
        });
      } catch (execError: any) {
        // execSync throws on non-zero exit - capture the error output
        const errorOutput = execError.stderr?.toString() || execError.stdout?.toString() || execError.message || '';
        
        // Parse ITMS error codes from altool output
        const itmsErrors = this.parseAltoolErrors(errorOutput);
        
        if (itmsErrors.length > 0) {
          // Check for redundant binary upload first (ITMS-90062, ITMS-4238)
          const redundantBinaryError = itmsErrors.find(e => e.isRedundantBinary);
          if (redundantBinaryError) {
            const err = new Error(
              `REDUNDANT_BINARY: Build already uploaded.\n` +
              `A build with this version/build number already exists in App Store Connect.\n` +
              `Existing version: ${redundantBinaryError.existingVersion || 'unknown'}\n` +
              `Existing build: ${redundantBinaryError.existingBuildNumber || 'unknown'}`
            );
            (err as any).code = ASC_ERROR_CODES.REDUNDANT_BINARY;
            (err as any).existingVersion = redundantBinaryError.existingVersion;
            (err as any).existingBuildNumber = redundantBinaryError.existingBuildNumber;
            (err as any).details = itmsErrors;
            throw err;
          }
          
          // Check for icon/asset errors
          const hasIconError = itmsErrors.some(e => 
            e.message.toLowerCase().includes('icon') || 
            e.message.toLowerCase().includes('alpha') ||
            e.message.toLowerCase().includes('transparent')
          );
          
          const errorCode = hasIconError ? ASC_ERROR_CODES.ICON_ERROR : ASC_ERROR_CODES.UPLOAD_ERROR;
          const err = new Error(
            `Upload validation failed:\n${itmsErrors.map(e => `  • ${e.code}: ${e.message}`).join('\n')}`
          );
          (err as any).code = errorCode;
          (err as any).details = itmsErrors;
          throw err;
        }
        
        // Generic upload error
        const err = new Error(`Upload failed: ${errorOutput || execError.message}`);
        (err as any).code = ASC_ERROR_CODES.UPLOAD_ERROR;
        throw err;
      }

      onProgress?.({ step: 'upload', progress: 100, message: 'Upload complete!' });
    } finally {
      // Clean up temporary API key
      await fs.remove(apiKeyPath).catch(() => {});
    }
  }

  /**
   * Parse altool/Transporter error output
   * Returns structured errors with special handling for redundant binary uploads
   */
  private parseAltoolErrors(output: string): Array<{ 
    code: string; 
    message: string; 
    isRedundantBinary?: boolean;
    existingBuildNumber?: string;
    existingVersion?: string;
  }> {
    const errors: Array<{ 
      code: string; 
      message: string;
      isRedundantBinary?: boolean;
      existingBuildNumber?: string;
      existingVersion?: string;
    }> = [];
    
    // Match ITMS error codes: ERROR ITMS-90062: "This bundle is invalid..."
    const itmsRegex = /ERROR\s+(ITMS-\d+):\s*"?([^"\n]+)"?/gi;
    let match;
    while ((match = itmsRegex.exec(output)) !== null) {
      const code = match[1];
      const message = match[2].trim();
      
      // Check for redundant binary upload (ITMS-90062 or ITMS-4238)
      // Example: "You've already uploaded a build with build number '5' for version number '1.0.4'"
      const isRedundantBinary = 
        code === 'ITMS-90062' || 
        code === 'ITMS-4238' ||
        message.toLowerCase().includes('redundant binary') ||
        message.toLowerCase().includes('already uploaded a build');
      
      if (isRedundantBinary) {
        // Try to extract existing build number and version from message
        const buildMatch = message.match(/build\s*(?:number)?\s*['"]?(\d+)['"]?/i);
        const versionMatch = message.match(/version\s*(?:number)?\s*['"]?([\d.]+)['"]?/i);
        
        errors.push({
          code,
          message,
          isRedundantBinary: true,
          existingBuildNumber: buildMatch?.[1],
          existingVersion: versionMatch?.[1],
        });
      } else {
        errors.push({ code, message });
      }
    }
    
    // Also check for general error patterns without ITMS codes
    const errorRegex = /error:\s*(.+)/gi;
    while ((match = errorRegex.exec(output)) !== null) {
      const msg = match[1].trim();
      // Avoid duplicates
      if (!errors.some(e => e.message.includes(msg) || msg.includes(e.message))) {
        // Check for redundant binary without ITMS code
        const isRedundantBinary = 
          msg.toLowerCase().includes('redundant binary') ||
          msg.toLowerCase().includes('already uploaded');
        
        errors.push({ 
          code: 'ERROR', 
          message: msg,
          isRedundantBinary,
        });
      }
    }
    
    return errors;
  }

  /**
   * Get build by build number
   */
  async getBuild(appId: string, buildNumber: string): Promise<ASCBuild | null> {
    try {
      const response = await this.client.get(`/builds`, {
        params: {
          'filter[app]': appId,
          'filter[version]': buildNumber,
          'filter[processingState]': 'PROCESSING,FAILED,INVALID,VALID',
          limit: 1,
        },
      });

      if (response.data.data.length === 0) {
        return null;
      }

      const build = response.data.data[0];
      return {
        id: build.id,
        version: build.attributes.version,
        uploadedDate: build.attributes.uploadedDate,
        processingState: build.attributes.processingState,
        usesNonExemptEncryption: build.attributes.usesNonExemptEncryption,
        minOsVersion: build.attributes.minOsVersion,
      };
    } catch (error: any) {
      throw new Error(`Failed to get build: ${error.message}`);
    }
  }

  /**
   * Wait for build to be processed
   */
  async waitForBuildProcessing(
    appId: string,
    buildNumber: string,
    maxWaitMinutes: number = 30,
    onProgress?: ProgressCallback
  ): Promise<ASCBuild | null> {
    const startTime = Date.now();
    const maxWaitMs = maxWaitMinutes * 60 * 1000;
    const pollIntervalMs = 30 * 1000; // 30 seconds

    let pollCount = 0;
    while (Date.now() - startTime < maxWaitMs) {
      try {
        const build = await this.getBuild(appId, buildNumber);
        
        if (build) {
          if (build.processingState === 'VALID') {
            onProgress?.({ 
              step: 'processing', 
              progress: 100, 
              message: 'Build processed successfully!' 
            });
            return build;
          } else if (build.processingState === 'FAILED' || build.processingState === 'INVALID') {
            onProgress?.({ 
              step: 'processing', 
              progress: 100, 
              message: `Build processing failed: ${build.processingState}` 
            });
            return null;
          }
        }

        // Calculate progress
        pollCount++;
        const elapsedMs = Date.now() - startTime;
        const progress = Math.min(90, Math.floor((elapsedMs / maxWaitMs) * 90));
        const elapsedMinutes = Math.floor(elapsedMs / 60000);
        
        onProgress?.({ 
          step: 'processing', 
          progress, 
          message: `Waiting for Apple to process build... (${elapsedMinutes}m elapsed)` 
        });

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      } catch {
        // Ignore errors and continue polling
        // (build might not appear in API immediately after upload)
      }
    }

    // Timeout
    onProgress?.({ 
      step: 'processing', 
      progress: 100, 
      message: 'Build processing timed out' 
    });
    return null;
  }

  /**
   * Assign build to version
   */
  async assignBuildToVersion(versionId: string, buildId: string): Promise<void> {
    try {
      await this.client.patch(`/appStoreVersions/${versionId}/relationships/build`, {
        data: {
          type: 'builds',
          id: buildId,
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to assign build to version: ${error.message}`);
    }
  }

  // ============================================================================
  // Metadata Management
  // ============================================================================

  /**
   * Get version localizations
   */
  async getVersionLocalizations(versionId: string): Promise<ASCLocalization[]> {
    try {
      const response = await this.client.get(
        `/appStoreVersions/${versionId}/appStoreVersionLocalizations`
      );

      return response.data.data.map((loc: any) => ({
        id: loc.id,
        locale: loc.attributes.locale,
        name: loc.attributes.name,
        subtitle: loc.attributes.subtitle,
        description: loc.attributes.description,
        keywords: loc.attributes.keywords,
        whatsNew: loc.attributes.whatsNew,
        marketingUrl: loc.attributes.marketingUrl,
        supportUrl: loc.attributes.supportUrl,
        privacyPolicyUrl: loc.attributes.privacyPolicyUrl,
      }));
    } catch (error: any) {
      throw new Error(`Failed to get localizations: ${error.message}`);
    }
  }

  /**
   * Update version metadata
   */
  async updateVersionMetadata(
    versionId: string,
    metadata: AppMetadata,
    locale: string = 'en-US'
  ): Promise<void> {
    try {
      // Get existing localizations
      const localizations = await this.getVersionLocalizations(versionId);
      const existingLoc = localizations.find(l => l.locale === locale);

      if (existingLoc) {
        // Update existing localization
        await this.client.patch(
          `/appStoreVersionLocalizations/${existingLoc.id}`,
          {
            data: {
              type: 'appStoreVersionLocalizations',
              id: existingLoc.id,
              attributes: {
                description: metadata.description,
                keywords: metadata.keywords,
                whatsNew: metadata.whatsNew,
                marketingUrl: metadata.marketingUrl,
                supportUrl: metadata.supportUrl,
                privacyPolicyUrl: metadata.privacyPolicyUrl,
              },
            },
          }
        );
      } else {
        // Create new localization
        await this.client.post('/appStoreVersionLocalizations', {
          data: {
            type: 'appStoreVersionLocalizations',
            attributes: {
              locale,
              description: metadata.description,
              keywords: metadata.keywords,
              whatsNew: metadata.whatsNew,
              marketingUrl: metadata.marketingUrl,
              supportUrl: metadata.supportUrl,
              privacyPolicyUrl: metadata.privacyPolicyUrl,
            },
            relationships: {
              appStoreVersion: {
                data: {
                  type: 'appStoreVersions',
                  id: versionId,
                },
              },
            },
          },
        });
      }

      // Update app-level metadata (name, subtitle) requires app info localization
      // This is separate from version localization
      // TODO: Implement app info localization update if needed
    } catch (error: any) {
      throw new Error(`Failed to update metadata: ${error.message}`);
    }
  }

  // ============================================================================
  // Screenshot Management
  // ============================================================================

  /**
   * Get screenshot sets for a localization
   */
  async getScreenshotSets(localizationId: string): Promise<any[]> {
    try {
      const response = await this.client.get(
        `/appStoreVersionLocalizations/${localizationId}/appScreenshotSets`
      );
      return response.data.data;
    } catch (error: any) {
      throw new Error(`Failed to get screenshot sets: ${error.message}`);
    }
  }

  /**
   * Delete all existing screenshots for a localization
   */
  async deleteExistingScreenshots(localizationId: string): Promise<void> {
    try {
      const sets = await this.getScreenshotSets(localizationId);
      
      for (const set of sets) {
        // Get screenshots in set
        const screenshotsResponse = await this.client.get(
          `/appScreenshotSets/${set.id}/appScreenshots`
        );
        
        // Delete each screenshot
        for (const screenshot of screenshotsResponse.data.data) {
          await this.client.delete(`/appScreenshots/${screenshot.id}`);
        }
      }
    } catch (error: any) {
      // Ignore errors when deleting - might not exist
    }
  }

  /**
   * Upload screenshots to App Store Connect
   */
  async uploadScreenshots(
    versionId: string,
    screenshots: Screenshot[],
    locale: string = 'en-US',
    onProgress?: ProgressCallback
  ): Promise<number> {
    try {
      // Get localizations
      const localizations = await this.getVersionLocalizations(versionId);
      const localization = localizations.find(l => l.locale === locale);
      
      if (!localization) {
        throw new Error(`Localization not found for locale: ${locale}`);
      }

      // Delete existing screenshots (replace all strategy)
      onProgress?.({ step: 'screenshots', progress: 5, message: 'Removing existing screenshots...' });
      await this.deleteExistingScreenshots(localization.id);

      // Group screenshots by device type
      const screenshotsByType: Record<string, Screenshot[]> = {};
      for (const screenshot of screenshots) {
        const ascType = SCREENSHOT_TYPE_MAP[screenshot.deviceType];
        if (!screenshotsByType[ascType]) {
          screenshotsByType[ascType] = [];
        }
        screenshotsByType[ascType].push(screenshot);
      }

      let uploadedCount = 0;
      const totalScreenshots = screenshots.length;

      // Upload screenshots by type
      for (const [ascType, typeScreenshots] of Object.entries(screenshotsByType)) {
        // Create or get screenshot set
        let screenshotSet: any;
        
        try {
          const setsResponse = await this.client.get(
            `/appStoreVersionLocalizations/${localization.id}/appScreenshotSets`,
            { params: { 'filter[screenshotDisplayType]': ascType } }
          );
          
          if (setsResponse.data.data.length > 0) {
            screenshotSet = setsResponse.data.data[0];
          } else {
            // Create new screenshot set
            const createResponse = await this.client.post('/appScreenshotSets', {
              data: {
                type: 'appScreenshotSets',
                attributes: {
                  screenshotDisplayType: ascType,
                },
                relationships: {
                  appStoreVersionLocalization: {
                    data: {
                      type: 'appStoreVersionLocalizations',
                      id: localization.id,
                    },
                  },
                },
              },
            });
            screenshotSet = createResponse.data.data;
          }
        } catch (error: any) {
          console.warn(`Could not create screenshot set for ${ascType}: ${error.message}`);
          continue;
        }

        // Upload each screenshot
        for (const screenshot of typeScreenshots) {
          try {
            // Read file
            const fileBuffer = await fs.readFile(screenshot.filePath);
            const fileSize = fileBuffer.length;
            const fileName = path.basename(screenshot.filePath);

            // Reserve upload
            const reserveResponse = await this.client.post('/appScreenshots', {
              data: {
                type: 'appScreenshots',
                attributes: {
                  fileName,
                  fileSize,
                },
                relationships: {
                  appScreenshotSet: {
                    data: {
                      type: 'appScreenshotSets',
                      id: screenshotSet.id,
                    },
                  },
                },
              },
            });

            const screenshotData = reserveResponse.data.data;
            const uploadOperations = screenshotData.attributes.uploadOperations;

            // Upload to each upload operation URL
            for (const operation of uploadOperations) {
              const chunk = fileBuffer.slice(operation.offset, operation.offset + operation.length);
              
              await axios.put(operation.url, chunk, {
                headers: {
                  ...operation.requestHeaders.reduce((acc: any, h: any) => {
                    acc[h.name] = h.value;
                    return acc;
                  }, {}),
                },
              });
            }

            // Commit upload
            await this.client.patch(`/appScreenshots/${screenshotData.id}`, {
              data: {
                type: 'appScreenshots',
                id: screenshotData.id,
                attributes: {
                  uploaded: true,
                  sourceFileChecksum: screenshotData.attributes.sourceFileChecksum,
                },
              },
            });

            uploadedCount++;
            const progress = Math.floor(10 + (uploadedCount / totalScreenshots) * 90);
            onProgress?.({ 
              step: 'screenshots', 
              progress, 
              message: `Uploaded ${uploadedCount}/${totalScreenshots} screenshots...` 
            });
          } catch (error: any) {
            console.warn(`Failed to upload screenshot ${screenshot.filePath}: ${error.message}`);
          }
        }
      }

      onProgress?.({ step: 'screenshots', progress: 100, message: `Uploaded ${uploadedCount} screenshots` });
      return uploadedCount;
    } catch (error: any) {
      throw new Error(`Failed to upload screenshots: ${error.message}`);
    }
  }

  // ============================================================================
  // Review Submission
  // ============================================================================

  /**
   * Submit version for review
   */
  async submitForReview(versionId: string): Promise<void> {
    try {
      await this.client.post('/appStoreVersionSubmissions', {
        data: {
          type: 'appStoreVersionSubmissions',
          relationships: {
            appStoreVersion: {
              data: {
                type: 'appStoreVersions',
                id: versionId,
              },
            },
          },
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to submit for review: ${error.message}`);
    }
  }

  /**
   * Enable TestFlight for a build
   */
  async enableTestFlight(buildId: string): Promise<void> {
    try {
      // Set beta app review to submitted
      await this.client.post('/betaAppReviewSubmissions', {
        data: {
          type: 'betaAppReviewSubmissions',
          relationships: {
            build: {
              data: {
                type: 'builds',
                id: buildId,
              },
            },
          },
        },
      });
    } catch (error: any) {
      // Might already be enabled or not needed
      console.warn(`Note: ${error.message}`);
    }
  }

  /**
   * Add build to TestFlight beta group
   */
  async addToTestFlightGroup(
    buildId: string,
    groupId?: string
  ): Promise<void> {
    // If no group specified, build is automatically available to internal testers
    if (!groupId) {
      return;
    }

    try {
      await this.client.post(`/betaGroups/${groupId}/relationships/builds`, {
        data: [
          {
            type: 'builds',
            id: buildId,
          },
        ],
      });
    } catch (error: any) {
      throw new Error(`Failed to add build to TestFlight group: ${error.message}`);
    }
  }

  // ============================================================================
  // Phased Release
  // ============================================================================

  /**
   * Enable phased release for a version
   */
  async enablePhasedRelease(versionId: string): Promise<void> {
    try {
      await this.client.post('/appStoreVersionPhasedReleases', {
        data: {
          type: 'appStoreVersionPhasedReleases',
          attributes: {
            phasedReleaseState: 'ACTIVE',
          },
          relationships: {
            appStoreVersion: {
              data: {
                type: 'appStoreVersions',
                id: versionId,
              },
            },
          },
        },
      });
    } catch (error: any) {
      // Might already be enabled
      console.warn(`Note: ${error.message}`);
    }
  }
}
