/**
 * Deployment Manager
 * Orchestrates the full deployment flow for iOS and Android
 */

import fs from 'fs-extra';
import path from 'path';
import { AppStoreConnectService } from '../services/app-store-connect.js';
import { GooglePlayService } from '../services/google-play.js';
import type {
  Platform,
  DeploymentType,
  DeploymentConfig,
  DeploymentResult,
  DeploymentOptions,
  ASCCredentials,
  GPCCredentials,
  AppMetadata,
  Screenshot,
  ProgressCallback,
} from '../services/types.js';

export interface DeployConfig {
  platform: Platform;
  type: DeploymentType;
  version: string;
  buildNumber: string;
  binaryPath: string;
  metadata: AppMetadata;
  screenshots?: Screenshot[];
  credentials: ASCCredentials | GPCCredentials;
  liveData?: any;
  options?: DeploymentOptions;
}

export class DeploymentManager {
  private ascService?: AppStoreConnectService;
  private gpcService?: GooglePlayService;

  /**
   * Main deployment method - routes to platform-specific deployment
   */
  async deploy(
    config: DeployConfig,
    onProgress?: ProgressCallback
  ): Promise<DeploymentResult> {
    const startTime = Date.now();

    try {
      if (config.platform === 'ios') {
        return await this.deployIOS(config, onProgress);
      } else {
        return await this.deployAndroid(config, onProgress);
      }
    } catch (error) {
      const errorCode = (error as any).code;
      
      // Let recoverable/displayable errors bubble up to CLI for proper handling
      const bubblingErrors = [
        'VERSION_CONFLICT',
        'VALIDATION_ERROR', 
        'ICON_ERROR',
        'UPLOAD_ERROR',
        'PERMISSION_ERROR',
        'REDUNDANT_BINARY',
      ];
      
      if (bubblingErrors.includes(errorCode)) {
        throw error; // Re-throw so CLI can handle appropriately
      }
      
      // For other errors, return a failed result
      return {
        platform: config.platform,
        success: false,
        version: config.version,
        buildNumber: config.buildNumber,
        status: 'failed',
        duration: Date.now() - startTime,
        binaryUploaded: false,
        metadataUpdated: false,
        screenshotsUploaded: 0,
        submittedForReview: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Deploy to iOS App Store
   * 
   * IMPORTANT: Flow order is designed to check version BEFORE uploading binary
   * to avoid unnecessary uploads when version already exists.
   * 
   * Flow:
   * 1. Validate binary exists
   * 2. Get or create app in ASC
   * 3. Check if version exists → throw VERSION_CONFLICT if exists (CLI handles retry)
   * 4. Upload binary → catch REDUNDANT_BINARY and show warning but continue
   * 5. Wait for processing (if needed)
   * 6. Assign build to version
   * 7. Update metadata
   * 8. Upload screenshots
   * 9. Handle deployment type (TestFlight/Review)
   */
  private async deployIOS(
    config: DeployConfig,
    onProgress?: ProgressCallback
  ): Promise<DeploymentResult> {
    const startTime = Date.now();
    const credentials = config.credentials as ASCCredentials;
    
    // Initialize service
    this.ascService = new AppStoreConnectService(credentials);

    // Validate binary exists
    if (!(await fs.pathExists(config.binaryPath))) {
      throw new Error(`Binary not found: ${config.binaryPath}`);
    }

    const binarySize = (await fs.stat(config.binaryPath)).size;
    let binaryUploaded = false;
    let binaryWasRedundant = false;
    let metadataUpdated = false;
    let screenshotsUploaded = 0;
    let submittedForReview = false;
    let versionId: string | undefined;
    let buildId: string | undefined;
    let appId: string | undefined;
    const bundleId = config.metadata.bundleId;

    try {
      // ================================================================
      // STEP 1: Get or create app (BEFORE upload)
      // ================================================================
      onProgress?.({ step: 'app', progress: 0, message: 'Checking app in App Store Connect...' });
      
      // Try to get from live data first
      if (config.liveData?.ios?.appInfo?.appId) {
        appId = config.liveData.ios.appInfo.appId;
        onProgress?.({ step: 'app', progress: 100, message: 'Found existing app' });
      } else if (bundleId) {
        // Check if app exists and create if needed
        const baseName = config.metadata.name || 'App';
        let appName = baseName;
        let sku = this.generateSku(baseName);
        
        try {
          const { appInfo, created } = await this.ascService.ensureAppExists({
            bundleId,
            name: appName,
            sku,
            primaryLocale: 'en-US',
            platform: 'IOS',
            availableInNewTerritories: true,
          });
          
          appId = appInfo.id;
          
          if (created) {
            onProgress?.({ step: 'app', progress: 100, message: `Created new app: ${appInfo.name}` });
          } else {
            onProgress?.({ step: 'app', progress: 100, message: `Found existing app: ${appInfo.name}` });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorCode = (error as any).code;
          
          // Check if the error is about app name conflict
          if (errorCode === 'APP_NAME_CONFLICT' || errorMessage.includes('APP_NAME_CONFLICT')) {
            // Retry with timestamp suffix
            const timestamp = new Date().toISOString().split('T')[0]; // 2025-12-10
            appName = `${baseName} [${timestamp}]`;
            sku = this.generateSku(baseName);
            
            onProgress?.({ step: 'app', progress: 50, message: `Name conflict, trying: ${appName}` });
            
            try {
              const { appInfo, created } = await this.ascService.ensureAppExists({
                bundleId,
                name: appName,
                sku,
                primaryLocale: 'en-US',
                platform: 'IOS',
                availableInNewTerritories: true,
              });
              
              appId = appInfo.id;
              
              if (created) {
                onProgress?.({ step: 'app', progress: 100, message: `Created new app: ${appInfo.name}` });
              } else {
                onProgress?.({ step: 'app', progress: 100, message: `Found existing app: ${appInfo.name}` });
              }
            } catch (retryError) {
              const retryMessage = retryError instanceof Error ? retryError.message : 'Unknown error';
              onProgress?.({ step: 'app', progress: 100, message: `Could not auto-configure: ${retryMessage}` });
            }
          }
          // Check if the error is about bundle ID not being registered
          else if (errorMessage.includes('Bundle ID') && errorMessage.includes('not found')) {
            // Can't proceed without app - throw error to let CLI handle
            throw new Error(`Bundle ID "${bundleId}" not registered. Register at: https://developer.apple.com/account/resources/identifiers/list`);
          }
          else {
            onProgress?.({ step: 'app', progress: 100, message: `Could not auto-configure: ${errorMessage}` });
          }
        }
      }

      if (!appId) {
        throw new Error('Could not find or create app. Provide bundle ID in config.');
      }

      // ================================================================
      // STEP 2: Check if version exists BEFORE upload
      // This allows CLI to prompt for version increment before wasting time on upload
      // Skip this check if force flag is set (config.options?.skipVersionCheck)
      // ================================================================
      if (!config.options?.skipVersionCheck) {
        onProgress?.({ step: 'version', progress: 0, message: `Setting up version ${config.version}...` });
        
        try {
          const version = await this.ascService.createOrGetVersion(appId, config.version);
          versionId = version.id;
          onProgress?.({ step: 'version', progress: 100, message: `Version ${config.version} ready` });
        } catch (versionError: any) {
          // Check if this is a version conflict error
          if (versionError.code === 'VERSION_CONFLICT' || versionError.message?.includes('VERSION_CONFLICT')) {
            // Re-throw with context for CLI to handle BEFORE upload
            const err = new Error(versionError.message);
            (err as any).code = 'VERSION_CONFLICT';
            (err as any).conflictingVersion = config.version;
            (err as any).appId = appId;
            (err as any).buildPath = config.binaryPath;
            (err as any).binaryNotYetUploaded = true; // Key flag for CLI
            throw err;
          }
          // For other errors, re-throw as-is
          throw versionError;
        }
      }

      // ================================================================
      // STEP 3: Upload binary
      // If REDUNDANT_BINARY error, show warning but continue (build exists)
      // ================================================================
      onProgress?.({ step: 'upload', progress: 0, message: 'Uploading binary to App Store Connect...' });
      
      try {
        await this.ascService.uploadBinary(config.binaryPath, onProgress);
        binaryUploaded = true;
        onProgress?.({ step: 'upload', progress: 100, message: 'Binary uploaded successfully!' });
      } catch (uploadError: any) {
        if (uploadError.code === 'REDUNDANT_BINARY') {
          // Build already exists - this is OK, show warning and continue
          binaryUploaded = true;
          binaryWasRedundant = true;
          onProgress?.({ 
            step: 'upload', 
            progress: 100, 
            message: `Warning: Build ${config.buildNumber} already uploaded. Continuing with existing build.`
          });
        } else {
          // Other upload errors should be thrown
          throw uploadError;
        }
      }

      // ================================================================
      // STEP 4: Wait for build processing (if needed for review submission)
      // ================================================================
      if (config.type === 'review' || config.options?.waitForProcessing) {
        onProgress?.({ step: 'processing', progress: 0, message: 'Waiting for Apple to process build...' });
        
        const build = await this.ascService.waitForBuildProcessing(
          appId,
          config.buildNumber,
          30, // 30 minutes max
          onProgress
        );

        if (build) {
          buildId = build.id;
          onProgress?.({ step: 'processing', progress: 100, message: 'Build processed successfully!' });
        } else {
          // Build processing timed out or failed
          return {
            platform: 'ios',
            success: true,
            version: config.version,
            buildNumber: config.buildNumber,
            status: binaryWasRedundant ? 'Using existing build - processing timeout' : 'Binary uploaded - processing timeout',
            duration: Date.now() - startTime,
            binaryUploaded,
            binarySize,
            metadataUpdated: false,
            screenshotsUploaded: 0,
            submittedForReview: false,
            consoleUrl: 'https://appstoreconnect.apple.com',
            nextSteps: [
              binaryWasRedundant ? 'Using previously uploaded build' : 'Binary uploaded',
              'Processing timed out - check App Store Connect for build status',
              'Complete submission manually when ready',
            ],
          };
        }
      }

      // ================================================================
      // STEP 5: Create version if we skipped the check earlier (force mode)
      // ================================================================
      if (!versionId) {
        onProgress?.({ step: 'version', progress: 0, message: `Setting up version ${config.version}...` });
        const version = await this.ascService.createOrGetVersion(appId, config.version);
        versionId = version.id;
        onProgress?.({ step: 'version', progress: 100, message: `Version ${config.version} ready` });
      }

      // ================================================================
      // STEP 6: Assign build to version (if we have a processed build)
      if (buildId) {
        onProgress?.({ step: 'assign', progress: 0, message: 'Assigning build to version...' });
        await this.ascService.assignBuildToVersion(versionId, buildId);
        onProgress?.({ step: 'assign', progress: 100, message: 'Build assigned to version' });
      }

      // Step 6: Update metadata
      if (config.metadata.description || config.metadata.keywords || config.metadata.whatsNew) {
        onProgress?.({ step: 'metadata', progress: 0, message: 'Updating metadata...' });
        await this.ascService.updateVersionMetadata(versionId, config.metadata);
        metadataUpdated = true;
        onProgress?.({ step: 'metadata', progress: 100, message: 'Metadata updated' });
      }

      // Step 7: Upload screenshots
      if (config.screenshots && config.screenshots.length > 0) {
        onProgress?.({ step: 'screenshots', progress: 0, message: 'Uploading screenshots...' });
        screenshotsUploaded = await this.ascService.uploadScreenshots(
          versionId,
          config.screenshots,
          'en-US',
          onProgress
        );
      }

      // Step 8: Handle deployment type
      if (config.type === 'testflight') {
        // Enable TestFlight for the build
        if (buildId) {
          onProgress?.({ step: 'testflight', progress: 0, message: 'Enabling TestFlight...' });
          await this.ascService.enableTestFlight(buildId);
          onProgress?.({ step: 'testflight', progress: 100, message: 'TestFlight enabled!' });
        }

        return {
          platform: 'ios',
          success: true,
          version: config.version,
          buildNumber: config.buildNumber,
          status: 'Ready for TestFlight',
          duration: Date.now() - startTime,
          binaryUploaded,
          binarySize,
          metadataUpdated,
          screenshotsUploaded,
          submittedForReview: false,
          versionId,
          buildId,
          testflightLink: 'https://testflight.apple.com',
          consoleUrl: 'https://appstoreconnect.apple.com',
          nextSteps: [
            'Build is ready for TestFlight testing',
            'Internal testers can download immediately',
            'Add external testers in App Store Connect if needed',
            'When ready, submit for App Store review',
          ],
        };
      } else if (config.type === 'review') {
        // Submit for App Store review
        onProgress?.({ step: 'submit', progress: 0, message: 'Submitting for App Store review...' });
        
        try {
          await this.ascService.submitForReview(versionId);
          submittedForReview = true;
          onProgress?.({ step: 'submit', progress: 100, message: 'Submitted for review!' });
        } catch (error) {
          // Submission might fail if metadata is incomplete
          const message = error instanceof Error ? error.message : 'Unknown error';
          return {
            platform: 'ios',
            success: true,
            version: config.version,
            buildNumber: config.buildNumber,
            status: 'Ready for submission',
            duration: Date.now() - startTime,
            binaryUploaded,
            binarySize,
            metadataUpdated,
            screenshotsUploaded,
            submittedForReview: false,
            versionId,
            buildId,
            consoleUrl: 'https://appstoreconnect.apple.com',
            errorMessage: `Auto-submission failed: ${message}`,
            nextSteps: [
              'Build and metadata are ready',
              'Submit manually in App Store Connect',
              'Check that all required fields are filled',
            ],
          };
        }

        // Enable phased release if requested
        if (config.options?.phasedRelease) {
          try {
            await this.ascService.enablePhasedRelease(versionId);
          } catch {
            // Non-critical, continue
          }
        }

        return {
          platform: 'ios',
          success: true,
          version: config.version,
          buildNumber: config.buildNumber,
          status: 'Submitted for review',
          duration: Date.now() - startTime,
          binaryUploaded,
          binarySize,
          metadataUpdated,
          screenshotsUploaded,
          submittedForReview: true,
          submittedAt: new Date(),
          estimatedReviewTime: '24-48 hours',
          versionId,
          buildId,
          consoleUrl: 'https://appstoreconnect.apple.com',
          nextSteps: [
            'App is now in review queue',
            'Typical review time: 24-48 hours',
            'You will receive an email when review is complete',
            'Check status in App Store Connect',
          ],
        };
      }

      // Default: just upload
      return {
        platform: 'ios',
        success: true,
        version: config.version,
        buildNumber: config.buildNumber,
        status: 'Upload complete',
        duration: Date.now() - startTime,
        binaryUploaded,
        binarySize,
        metadataUpdated,
        screenshotsUploaded,
        submittedForReview: false,
        versionId,
        buildId,
        consoleUrl: 'https://appstoreconnect.apple.com',
        nextSteps: [
          'Binary uploaded successfully',
          'Complete submission in App Store Connect',
        ],
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Deploy to Google Play Store
   */
  private async deployAndroid(
    config: DeployConfig,
    onProgress?: ProgressCallback
  ): Promise<DeploymentResult> {
    const startTime = Date.now();
    const credentials = config.credentials as GPCCredentials;

    // Initialize service
    this.gpcService = new GooglePlayService(credentials);

    // Validate binary exists
    if (!(await fs.pathExists(config.binaryPath))) {
      throw new Error(`Binary not found: ${config.binaryPath}`);
    }

    const binarySize = (await fs.stat(config.binaryPath)).size;

    // Determine package name
    const packageName = config.metadata.packageName || config.liveData?.android?.appInfo?.packageName;
    if (!packageName) {
      throw new Error('Package name not found. Provide it in config or store connection.');
    }

    // Determine track based on deployment type
    let track: string;
    switch (config.type) {
      case 'internal':
        track = 'internal';
        break;
      case 'alpha':
        track = 'alpha';
        break;
      case 'beta':
        track = 'beta';
        break;
      case 'review':
      case 'production':
        track = 'production';
        break;
      default:
        track = 'internal'; // Default to internal for safety
    }

    // Deploy using Google Play service
    onProgress?.({ step: 'deploy', progress: 0, message: `Deploying to ${track} track...` });
    
    const result = await this.gpcService.deploy(
      packageName,
      config.binaryPath,
      track,
      config.metadata,
      config.screenshots,
      config.metadata.whatsNew,
      {
        gradualRollout: config.options?.gradualRollout,
        rolloutPercentage: config.options?.rolloutPercentage,
        status: config.type === 'review' ? 'completed' : 'completed',
      },
      onProgress
    );

    if (!result.success) {
      throw new Error(result.error || 'Deployment failed');
    }

    // Build next steps based on track
    let nextSteps: string[];
    let status: string;
    
    if (track === 'internal') {
      status = 'Available on internal track';
      nextSteps = [
        'Build is now available for internal testing',
        'Internal testers can access it immediately',
        'Promote to alpha/beta when ready for wider testing',
        'Promote to production for public release',
      ];
    } else if (track === 'alpha' || track === 'beta') {
      status = `Available on ${track} track`;
      nextSteps = [
        `Build is now available for ${track} testers`,
        'Testers will receive update notification',
        'Monitor feedback and crash reports',
        'Promote to production when ready',
      ];
    } else {
      status = 'Submitted to production';
      nextSteps = [
        'App is now live on Google Play (or pending review)',
        'Google Play may require review for new apps',
        'Monitor store listing for any issues',
        'Check Play Console for review status',
      ];
    }

    return {
      platform: 'android',
      success: true,
      version: config.version,
      buildNumber: config.buildNumber,
      status,
      duration: Date.now() - startTime,
      binaryUploaded: true,
      binarySize,
      metadataUpdated: true,
      screenshotsUploaded: config.screenshots?.length || 0,
      submittedForReview: track === 'production',
      trackId: track,
      releaseId: result.editId,
      storeUrl: `https://play.google.com/store/apps/details?id=${packageName}`,
      consoleUrl: `https://play.google.com/console/developers/app/${packageName}`,
      internalTestLink: track === 'internal' 
        ? `https://play.google.com/apps/internaltest/${packageName}` 
        : undefined,
      nextSteps,
    };
  }

  /**
   * Generate a unique SKU from app name with timestamp
   * Format: AppName-YYYYMMDD (e.g., "Doddle-20251210")
   */
  private generateSku(appName: string): string {
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const sanitizedName = appName
      .replace(/[^a-zA-Z0-9]/g, '') // Remove special chars
      .substring(0, 30); // Max length
    return `${sanitizedName}-${timestamp}`;
  }
}

// Export singleton helper
let deploymentManagerInstance: DeploymentManager | null = null;

export function getDeploymentManager(): DeploymentManager {
  if (!deploymentManagerInstance) {
    deploymentManagerInstance = new DeploymentManager();
  }
  return deploymentManagerInstance;
}
