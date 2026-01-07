/**
 * Deployment Preview Generator
 * Generates a preview of what will change during deployment
 */

import fs from 'fs-extra';
import path from 'path';
import type {
  Platform,
  DeploymentType,
  DeploymentPreview,
  DeploymentOption,
  MetadataChange,
  ScreenshotChanges,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  AppMetadata,
  Screenshot,
} from '../services/types.js';

export interface PreviewConfig {
  platform: Platform;
  version: string;
  buildNumber: string;
  binaryPath: string;
  metadata: AppMetadata;
  screenshots?: Screenshot[];
  currentMetadata?: AppMetadata;
  currentScreenshots?: string[];
  liveData?: any;
}

/**
 * Generate a deployment preview
 */
export async function generateDeploymentPreview(
  config: PreviewConfig
): Promise<DeploymentPreview> {
  // Get binary size
  let binarySize = 0;
  if (await fs.pathExists(config.binaryPath)) {
    binarySize = (await fs.stat(config.binaryPath)).size;
  }

  // Get current version from live data
  let currentVersion: string | undefined;
  if (config.platform === 'ios' && config.liveData?.ios?.latestVersion) {
    currentVersion = config.liveData.ios.latestVersion.versionString;
  } else if (config.platform === 'android' && config.liveData?.android?.appInfo) {
    // Android doesn't have easy version access in our current implementation
    currentVersion = undefined;
  }

  // Calculate metadata changes
  const metadataChanges = calculateMetadataChanges(
    config.currentMetadata || config.liveData?.currentMetadata,
    config.metadata
  );

  // Calculate screenshot changes
  const screenshotChanges = calculateScreenshotChanges(
    config.currentScreenshots || [],
    config.screenshots || []
  );

  // Validate deployment
  const validation = await validateDeployment(config);

  // Get available deployment options
  const deploymentOptions = getDeploymentOptions(config.platform, validation.isValid);

  return {
    platform: config.platform,
    version: config.version,
    buildNumber: config.buildNumber,
    binaryPath: config.binaryPath,
    binarySize,
    currentVersion,
    currentMetadata: config.currentMetadata,
    metadataChanges,
    screenshotChanges,
    validation,
    deploymentOptions,
  };
}

/**
 * Calculate what metadata fields will change
 */
function calculateMetadataChanges(
  current: AppMetadata | undefined,
  newMetadata: AppMetadata
): MetadataChange[] {
  const changes: MetadataChange[] = [];

  const fields: (keyof AppMetadata)[] = [
    'name',
    'subtitle',
    'description',
    'keywords',
    'category',
    'secondaryCategory',
    'supportUrl',
    'marketingUrl',
    'privacyPolicyUrl',
    'copyright',
    'whatsNew',
  ];

  for (const field of fields) {
    const oldValue = current?.[field] as string | undefined;
    const newValue = newMetadata[field] as string | undefined;
    
    // Only include if there's a new value
    if (newValue !== undefined && newValue !== '') {
      changes.push({
        field,
        oldValue,
        newValue,
        changed: oldValue !== newValue,
      });
    }
  }

  return changes;
}

/**
 * Calculate what screenshots will change
 */
function calculateScreenshotChanges(
  currentPaths: string[],
  newScreenshots: Screenshot[]
): ScreenshotChanges {
  return {
    toAdd: newScreenshots, // Replace all strategy - all screenshots are new
    toRemove: currentPaths, // All existing screenshots will be removed
    unchanged: 0, // With replace all, nothing stays
    totalNew: newScreenshots.length,
  };
}

/**
 * Validate deployment configuration
 */
async function validateDeployment(config: PreviewConfig): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check binary exists
  if (!(await fs.pathExists(config.binaryPath))) {
    errors.push({
      field: 'binaryPath',
      message: `Binary not found: ${config.binaryPath}`,
      code: 'BINARY_NOT_FOUND',
    });
  } else {
    // Check binary type matches platform
    const ext = path.extname(config.binaryPath).toLowerCase();
    
    if (config.platform === 'ios') {
      if (ext !== '.ipa' && ext !== '.xcarchive') {
        errors.push({
          field: 'binaryPath',
          message: `Invalid iOS binary type: ${ext}. Expected .ipa or .xcarchive`,
          code: 'INVALID_BINARY_TYPE',
        });
      }
    } else if (config.platform === 'android') {
      if (ext !== '.aab' && ext !== '.apk') {
        errors.push({
          field: 'binaryPath',
          message: `Invalid Android binary type: ${ext}. Expected .aab or .apk`,
          code: 'INVALID_BINARY_TYPE',
        });
      }
      
      // Warn if using APK instead of AAB
      if (ext === '.apk') {
        warnings.push({
          field: 'binaryPath',
          message: 'Using APK instead of AAB',
          suggestion: 'Google Play recommends Android App Bundles (AAB) for smaller downloads',
        });
      }
    }
  }

  // Validate metadata
  if (!config.metadata.name || config.metadata.name.length === 0) {
    errors.push({
      field: 'name',
      message: 'App name is required',
      code: 'MISSING_NAME',
    });
  } else if (config.metadata.name.length > 30) {
    errors.push({
      field: 'name',
      message: `App name too long: ${config.metadata.name.length} chars (max 30)`,
      code: 'NAME_TOO_LONG',
    });
  }

  if (!config.metadata.description || config.metadata.description.length === 0) {
    warnings.push({
      field: 'description',
      message: 'No description provided',
      suggestion: 'Add a compelling description to improve App Store visibility',
    });
  } else if (config.metadata.description.length < 100) {
    warnings.push({
      field: 'description',
      message: 'Description is very short',
      suggestion: 'Longer descriptions (300+ chars) tend to perform better in search',
    });
  }

  // iOS-specific validation
  if (config.platform === 'ios') {
    // Subtitle validation
    if (config.metadata.subtitle && config.metadata.subtitle.length > 30) {
      errors.push({
        field: 'subtitle',
        message: `Subtitle too long: ${config.metadata.subtitle.length} chars (max 30)`,
        code: 'SUBTITLE_TOO_LONG',
      });
    }

    // Keywords validation
    if (config.metadata.keywords) {
      if (config.metadata.keywords.length > 100) {
        errors.push({
          field: 'keywords',
          message: `Keywords too long: ${config.metadata.keywords.length} chars (max 100)`,
          code: 'KEYWORDS_TOO_LONG',
        });
      }
    } else {
      warnings.push({
        field: 'keywords',
        message: 'No keywords provided',
        suggestion: 'Add relevant keywords to improve App Store search visibility',
      });
    }
  }

  // Screenshot validation
  if (!config.screenshots || config.screenshots.length === 0) {
    warnings.push({
      field: 'screenshots',
      message: 'No screenshots provided',
      suggestion: 'Screenshots are required for App Store listing. Add at least 2 screenshots.',
    });
  } else {
    // Check that screenshot files exist
    for (const screenshot of config.screenshots) {
      if (!(await fs.pathExists(screenshot.filePath))) {
        errors.push({
          field: 'screenshots',
          message: `Screenshot not found: ${screenshot.filePath}`,
          code: 'SCREENSHOT_NOT_FOUND',
        });
      }
    }

    // Check minimum screenshot count
    if (config.platform === 'ios' && config.screenshots.length < 2) {
      warnings.push({
        field: 'screenshots',
        message: 'iOS App Store requires at least 2 screenshots per device type',
        suggestion: 'Add more screenshots to meet App Store requirements',
      });
    }
  }

  // Privacy policy validation
  if (!config.metadata.privacyPolicyUrl || config.metadata.privacyPolicyUrl.length === 0) {
    warnings.push({
      field: 'privacyPolicyUrl',
      message: 'No privacy policy URL provided',
      suggestion: 'Privacy policy is required for most apps. Add a URL before submission.',
    });
  }

  // What's new validation
  if (!config.metadata.whatsNew || config.metadata.whatsNew.length === 0) {
    warnings.push({
      field: 'whatsNew',
      message: 'No release notes provided',
      suggestion: 'Add "What\'s New" text to inform users about changes in this version',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get available deployment options based on platform
 */
function getDeploymentOptions(
  platform: Platform,
  isValid: boolean
): DeploymentOption[] {
  if (platform === 'ios') {
    return [
      {
        type: 'testflight',
        label: 'TestFlight (Beta Testing)',
        description: 'Deploy to TestFlight for beta testing. Build will be available to internal testers immediately.',
        estimatedTime: '~10 minutes (processing)',
        available: isValid,
        reason: isValid ? undefined : 'Fix validation errors first',
      },
      {
        type: 'review',
        label: 'Submit for App Store Review',
        description: 'Submit to Apple for App Store review. Once approved, the app will be available for public download.',
        estimatedTime: '24-48 hours (review)',
        available: isValid,
        reason: isValid ? undefined : 'Fix validation errors first',
      },
    ];
  } else {
    return [
      {
        type: 'internal',
        label: 'Internal Testing',
        description: 'Deploy to internal testing track. Available instantly to internal testers.',
        estimatedTime: 'Instant',
        available: isValid,
        reason: isValid ? undefined : 'Fix validation errors first',
      },
      {
        type: 'alpha',
        label: 'Alpha Track',
        description: 'Deploy to alpha track for early testing with a wider group.',
        estimatedTime: '~1 hour (processing)',
        available: isValid,
        reason: isValid ? undefined : 'Fix validation errors first',
      },
      {
        type: 'beta',
        label: 'Beta Track',
        description: 'Deploy to beta track for broader testing before production.',
        estimatedTime: '~1 hour (processing)',
        available: isValid,
        reason: isValid ? undefined : 'Fix validation errors first',
      },
      {
        type: 'production',
        label: 'Production (Public Release)',
        description: 'Deploy directly to production. May require Google review for new apps.',
        estimatedTime: 'Instant to 7 days (review varies)',
        available: isValid,
        reason: isValid ? undefined : 'Fix validation errors first',
      },
    ];
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
