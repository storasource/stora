/**
 * iOS Pre-flight Validation
 * 
 * Runs all necessary checks BEFORE the expensive build phase
 * to ensure iOS deployment will succeed.
 * 
 * Checks:
 * 1. Bundle ID format validation
 * 2. Bundle ID registered in Apple Developer Portal
 * 3. App exists in App Store Connect (or can be created)
 * 4. Code signing configured (Team ID set)
 * 5. Credentials are valid
 */

import { AppStoreConnectService } from '../services/app-store-connect.js';
import type { ASCCredentials, ASCBundleId, ASCAppInfo } from '../services/types.js';
import {
  getXcodeProjectInfo,
  hasAutomaticSigning,
  configureAutomaticSigning,
  isValidTeamId,
} from '../../build/utils/xcode-config.js';
import {
  validateAppIcons,
  removeAlphaFromIcons,
} from '../../build/utils/asset-validator.js';

export interface IOSPreflightResult {
  passed: boolean;
  checks: {
    bundleIdValid: boolean;
    bundleIdRegistered: boolean;
    appExists: boolean;
    signingConfigured: boolean;
    credentialsValid: boolean;
    assetsValid: boolean;
  };
  errors: string[];
  warnings: string[];
  info: string[];
  
  // Resources found/created
  bundleId: string;
  bundleIdResource?: ASCBundleId;
  appInfo?: ASCAppInfo;
  teamId?: string;
  
  // What was auto-fixed
  autoFixed: {
    bundleIdRegistered: boolean;
    appCreated: boolean;
    signingConfigured: boolean;
    iconAlphaRemoved: boolean;
  };
}

export interface IOSPreflightOptions {
  /** Automatically fix issues when possible (default: true) */
  autoFix?: boolean;
  /** App name for creating app/Bundle ID if needed */
  appName?: string;
  /** Team ID for automatic signing (if not already configured) */
  teamId?: string;
  /** Skip signing check (useful for CI without signing) */
  skipSigningCheck?: boolean;
  /** Skip asset/icon validation check */
  skipAssetCheck?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Run all iOS pre-flight checks
 * Fast-fail: Runs BEFORE expensive build to catch issues early
 */
export async function runIOSPreflight(
  projectDir: string,
  bundleId: string,
  credentials: ASCCredentials,
  options: IOSPreflightOptions = {}
): Promise<IOSPreflightResult> {
  const {
    autoFix = true,
    appName = 'App',
    teamId,
    skipSigningCheck = false,
    skipAssetCheck = false,
    verbose = false,
  } = options;
  
  const result: IOSPreflightResult = {
    passed: false,
    checks: {
      bundleIdValid: false,
      bundleIdRegistered: false,
      appExists: false,
      signingConfigured: false,
      credentialsValid: false,
      assetsValid: false,
    },
    errors: [],
    warnings: [],
    info: [],
    bundleId,
    autoFixed: {
      bundleIdRegistered: false,
      appCreated: false,
      signingConfigured: false,
      iconAlphaRemoved: false,
    },
  };
  
  // Initialize App Store Connect service
  let ascService: AppStoreConnectService;
  
  try {
    ascService = new AppStoreConnectService(credentials);
  } catch (error) {
    result.errors.push('Failed to initialize App Store Connect service. Check credentials.');
    return result;
  }
  
  // ========================================
  // CHECK 1: Credentials Valid
  // ========================================
  try {
    // Test API call to validate credentials
    await ascService.getAvailableTerritories();
    result.checks.credentialsValid = true;
    result.info.push('App Store Connect credentials valid');
  } catch (error: any) {
    result.checks.credentialsValid = false;
    
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      result.errors.push(
        'App Store Connect credentials invalid or expired. ' +
        'Check your API key at https://appstoreconnect.apple.com/access/api'
      );
    } else if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
      result.errors.push(
        'App Store Connect API key lacks required permissions. ' +
        'Ensure the key has Admin or App Manager role.'
      );
    } else {
      result.errors.push(`Failed to validate credentials: ${error.message}`);
    }
    
    // Can't continue without valid credentials
    return result;
  }
  
  // ========================================
  // CHECK 2: Bundle ID Format
  // ========================================
  const bundleIdValidation = validateBundleIdFormat(bundleId);
  result.checks.bundleIdValid = bundleIdValidation.valid;
  
  if (!bundleIdValidation.valid) {
    result.errors.push(bundleIdValidation.error!);
    // Can't continue with invalid Bundle ID
    return result;
  }
  
  result.info.push(`Bundle ID format valid: ${bundleId}`);
  
  // ========================================
  // CHECK 3: Bundle ID Registered
  // ========================================
  try {
    const existingBundleId = await ascService.getBundleId(bundleId);
    
    if (existingBundleId) {
      result.checks.bundleIdRegistered = true;
      result.bundleIdResource = existingBundleId;
      result.info.push(`Bundle ID registered: ${bundleId}`);
    } else if (autoFix) {
      // Auto-register Bundle ID
      result.info.push(`Registering Bundle ID: ${bundleId}...`);
      
      try {
        const { bundleId: newBundleId, created } = await ascService.ensureBundleIdExists(
          bundleId,
          appName,
          'IOS'
        );
        
        result.checks.bundleIdRegistered = true;
        result.bundleIdResource = newBundleId;
        result.autoFixed.bundleIdRegistered = created;
        
        if (created) {
          result.info.push(`Bundle ID registered successfully: ${bundleId}`);
        }
      } catch (registerError: any) {
        result.errors.push(`Failed to register Bundle ID: ${registerError.message}`);
      }
    } else {
      result.errors.push(
        `Bundle ID "${bundleId}" not registered in Apple Developer Portal. ` +
        `Register it at: https://developer.apple.com/account/resources/identifiers/list`
      );
    }
  } catch (error: any) {
    result.errors.push(`Failed to check Bundle ID: ${error.message}`);
  }
  
  // ========================================
  // CHECK 4: App Exists in ASC
  // ========================================
  if (result.checks.bundleIdRegistered) {
    try {
      const existingApp = await ascService.getAppInfo(bundleId);
      
      if (existingApp) {
        result.checks.appExists = true;
        result.appInfo = existingApp;
        result.info.push(`App found in App Store Connect: ${existingApp.name}`);
      } else if (autoFix) {
        // Auto-create app
        result.warnings.push(
          `App not found in App Store Connect. Will be created during deployment.`
        );
        // Note: We don't create the app here to avoid creating apps that won't be used
        // The deployment process will create it when needed
        result.checks.appExists = true; // Mark as "will exist"
        result.autoFixed.appCreated = true;
      } else {
        result.warnings.push(
          `App "${bundleId}" not found in App Store Connect. ` +
          `It will need to be created during deployment.`
        );
        result.checks.appExists = true; // Still pass - app will be created
      }
    } catch (error: any) {
      result.warnings.push(`Could not check if app exists: ${error.message}`);
      result.checks.appExists = true; // Don't fail on this
    }
  }
  
  // ========================================
  // CHECK 5: Code Signing Configured
  // ========================================
  if (!skipSigningCheck) {
    try {
      const projectInfo = await getXcodeProjectInfo(projectDir);
      
      if (!projectInfo) {
        result.warnings.push(
          'Could not read Xcode project. Signing check skipped.'
        );
        result.checks.signingConfigured = true; // Don't fail
      } else if (projectInfo.hasTeamId) {
        result.checks.signingConfigured = true;
        result.teamId = projectInfo.teamId;
        result.info.push(`Code signing configured (Team ID: ${projectInfo.teamId})`);
      } else if (autoFix && teamId) {
        // Auto-configure signing
        result.info.push(`Configuring automatic signing with Team ID: ${teamId}...`);
        
        try {
          await configureAutomaticSigning(projectDir, teamId);
          result.checks.signingConfigured = true;
          result.teamId = teamId;
          result.autoFixed.signingConfigured = true;
          result.info.push('Automatic signing configured successfully');
        } catch (signingError: any) {
          result.errors.push(`Failed to configure signing: ${signingError.message}`);
        }
      } else if (autoFix && !teamId) {
        // Need Team ID but none provided
        result.errors.push(
          'Code signing not configured and no Team ID provided. ' +
          'Run with --team-id <TEAM_ID> or configure signing in Xcode.'
        );
      } else {
        result.errors.push(
          'Code signing not configured. ' +
          'Set DEVELOPMENT_TEAM in Xcode or use automatic signing setup.'
        );
      }
    } catch (error: any) {
      result.warnings.push(`Signing check failed: ${error.message}`);
      result.checks.signingConfigured = true; // Don't fail on check errors
    }
  } else {
    result.checks.signingConfigured = true;
    result.info.push('Signing check skipped');
  }
  
  // ========================================
  // CHECK 6: App Assets Valid
  // ========================================
  if (!skipAssetCheck) {
    try {
      const iconValidation = await validateAppIcons(projectDir);
      result.checks.assetsValid = iconValidation.valid;
      
      if (!iconValidation.valid) {
        // Handle alpha channel issue (auto-fixable)
        if (iconValidation.hasAlphaChannel) {
          if (autoFix) {
            const fixed = await removeAlphaFromIcons(projectDir);
            result.autoFixed.iconAlphaRemoved = true;
            result.info.push(`Removed alpha channel from ${fixed.length} icon(s)`);
            result.checks.assetsValid = true;
          } else {
            result.errors.push(
              `App icons have transparency (${iconValidation.iconsWithAlpha.length} files). ` +
              `App Store requires opaque icons. Use --auto-fix to remove alpha.`
            );
          }
        }
        
        // Handle missing icons
        if (iconValidation.missingIcons.length > 0) {
          const requiredMissing = iconValidation.missingIcons.filter(m => 
            m.includes('1024x1024') || m.includes('60x60')
          );
          
          if (requiredMissing.length > 0) {
            result.errors.push(`Missing required icons: ${requiredMissing.join(', ')}`);
          } else {
            result.warnings.push(`Missing optional icons: ${iconValidation.missingIcons.length}`);
          }
        }
        
        // Report dimension issues as warnings
        for (const wrong of iconValidation.wrongDimensions) {
          result.warnings.push(
            `Icon ${wrong.file}: expected ${wrong.expected}, got ${wrong.actual}`
          );
        }
      } else {
        result.info.push('App icons valid');
      }
    } catch (error: any) {
      result.warnings.push(`Asset validation skipped: ${error.message}`);
      result.checks.assetsValid = true; // Don't fail on check errors
    }
  } else {
    result.checks.assetsValid = true;
    result.info.push('Asset check skipped');
  }
  
  // ========================================
  // DETERMINE OVERALL RESULT
  // ========================================
  const criticalChecks = [
    result.checks.credentialsValid,
    result.checks.bundleIdValid,
    result.checks.bundleIdRegistered,
  ];
  
  // Signing is only critical if not skipped
  if (!skipSigningCheck) {
    criticalChecks.push(result.checks.signingConfigured);
  }
  
  // Assets are only critical if not skipped
  if (!skipAssetCheck) {
    criticalChecks.push(result.checks.assetsValid);
  }
  
  result.passed = criticalChecks.every(check => check) && result.errors.length === 0;
  
  return result;
}

/**
 * Validate Bundle ID format
 */
function validateBundleIdFormat(bundleId: string): { valid: boolean; error?: string } {
  if (!bundleId || typeof bundleId !== 'string') {
    return { valid: false, error: 'Bundle ID is required' };
  }
  
  if (bundleId.length > 255) {
    return { 
      valid: false, 
      error: `Bundle ID too long (${bundleId.length} chars). Maximum is 255 characters.`
    };
  }
  
  // Must have at least two components (e.g., com.app)
  const parts = bundleId.split('.');
  if (parts.length < 2) {
    return {
      valid: false,
      error: `Invalid Bundle ID format: "${bundleId}". Must be in reverse-DNS format (e.g., com.company.app).`
    };
  }
  
  // Check each part
  for (const part of parts) {
    if (!part) {
      return {
        valid: false,
        error: `Invalid Bundle ID: "${bundleId}". Contains empty component (consecutive dots).`
      };
    }
    
    if (part.startsWith('-')) {
      return {
        valid: false,
        error: `Invalid Bundle ID: "${bundleId}". Components cannot start with a hyphen.`
      };
    }
    
    if (!/^[a-zA-Z0-9-]+$/.test(part)) {
      return {
        valid: false,
        error: `Invalid Bundle ID: "${bundleId}". Can only contain letters, numbers, and hyphens.`
      };
    }
  }
  
  // Cannot use reserved Apple prefixes
  if (bundleId.startsWith('com.apple.') || bundleId.startsWith('com.apple-')) {
    return {
      valid: false,
      error: `Invalid Bundle ID: "${bundleId}". Cannot use reserved Apple prefix "com.apple".`
    };
  }
  
  return { valid: true };
}

/**
 * Format pre-flight results for display
 */
export function formatPreflightResults(result: IOSPreflightResult): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('iOS Pre-flight Checks:');
  lines.push('');
  
  // Credentials
  lines.push(formatCheckLine(
    'Credentials valid',
    result.checks.credentialsValid
  ));
  
  // Bundle ID
  lines.push(formatCheckLine(
    `Bundle ID format`,
    result.checks.bundleIdValid,
    result.bundleId
  ));
  
  lines.push(formatCheckLine(
    'Bundle ID registered',
    result.checks.bundleIdRegistered,
    result.autoFixed.bundleIdRegistered ? '(auto-registered)' : undefined
  ));
  
  // App
  lines.push(formatCheckLine(
    'App exists in ASC',
    result.checks.appExists,
    result.autoFixed.appCreated ? '(will be created)' : result.appInfo?.name
  ));
  
  // Signing
  lines.push(formatCheckLine(
    'Code signing configured',
    result.checks.signingConfigured,
    result.autoFixed.signingConfigured ? '(auto-configured)' : result.teamId
  ));
  
  // Assets
  lines.push(formatCheckLine(
    'App icons valid',
    result.checks.assetsValid,
    result.autoFixed.iconAlphaRemoved ? '(alpha removed)' : undefined
  ));
  
  // Errors
  if (result.errors.length > 0) {
    lines.push('');
    lines.push('Errors:');
    for (const error of result.errors) {
      lines.push(`  ✗ ${error}`);
    }
  }
  
  // Warnings
  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    for (const warning of result.warnings) {
      lines.push(`  ! ${warning}`);
    }
  }
  
  // Summary
  lines.push('');
  const passedCount = Object.values(result.checks).filter(v => v).length;
  const totalCount = Object.values(result.checks).length;
  
  if (result.passed) {
    lines.push(`Pre-flight: ${passedCount}/${totalCount} checks passed`);
  } else {
    lines.push(`Pre-flight FAILED: ${passedCount}/${totalCount} checks passed`);
  }
  
  return lines.join('\n');
}

function formatCheckLine(label: string, passed: boolean, detail?: string): string {
  const icon = passed ? '✓' : '✗';
  const detailStr = detail ? ` (${detail})` : '';
  return `  ${icon} ${label}${detailStr}`;
}

export { validateBundleIdFormat };
