/**
 * Deployment Service Types
 * Shared types for App Store Connect and Google Play services
 */

// ============================================================================
// Core Types
// ============================================================================

export type Platform = 'ios' | 'android';

export type DeploymentType =
  | 'testflight'   // iOS only - TestFlight beta
  | 'internal'     // Android only - Internal testing track
  | 'alpha'        // Android only - Alpha track
  | 'beta'         // Android only - Beta track
  | 'review'       // Both - Submit for app store review
  | 'production';  // Both - Direct to production

export type DeploymentStatus =
  | 'preparing'              // Validating and preparing
  | 'uploading'              // Uploading binary
  | 'processing'             // Store is processing
  | 'submitted'              // Submitted for review
  | 'in_review'              // Currently being reviewed
  | 'pending_release'        // Approved, waiting for release
  | 'pending_developer_release' // Pending developer release
  | 'waiting_for_review'     // Waiting for review
  | 'ready_for_sale'         // Ready for sale (iOS)
  | 'approved'               // Approved
  | 'rejected'               // Rejected
  | 'published'              // Live in store
  | 'failed'                 // Deployment failed
  | 'cancelled';             // User cancelled

// ============================================================================
// Credentials
// ============================================================================

export interface ASCCredentials {
  issuerId: string;
  keyId: string;
  privateKey: string;
  teamId?: string;
}

export interface GPCCredentials {
  serviceAccountEmail: string;
  privateKey: string;  // Service account JSON key content
  projectId?: string;
}

export interface Credentials {
  ios?: ASCCredentials;
  android?: GPCCredentials;
}

// ============================================================================
// App Metadata
// ============================================================================

export interface AppMetadata {
  name: string;
  subtitle?: string;           // iOS only
  description: string;
  keywords?: string;           // iOS only (comma-separated, max 100 chars)
  category?: string;
  secondaryCategory?: string;
  supportUrl?: string;
  marketingUrl?: string;
  privacyPolicyUrl?: string;
  copyright?: string;
  whatsNew?: string;
  locale?: string;             // Default: en-US
  // Platform identifiers
  bundleId?: string;           // iOS bundle ID
  packageName?: string;        // Android package name
}

export interface Screenshot {
  filePath: string;
  locale?: string;
  deviceType: ScreenshotDeviceType;
  displayOrder: number;
  description?: string;
}

export type ScreenshotDeviceType =
  | 'iphone_69'    // iPhone 6.9" (iPhone 16 Pro Max)
  | 'iphone_67'    // iPhone 6.7" (iPhone 15 Pro Max, 14 Pro Max)
  | 'iphone_65'    // iPhone 6.5" (iPhone 11 Pro Max, XS Max)
  | 'iphone_61'    // iPhone 6.1" (iPhone 14, 13, 12)
  | 'iphone_58'    // iPhone 5.8" (iPhone X, XS)
  | 'iphone_55'    // iPhone 5.5" (iPhone 8 Plus, 7 Plus, 6s Plus)
  | 'iphone_47'    // iPhone 4.7" (iPhone SE, 8, 7, 6s)
  | 'ipad_129'     // iPad Pro 12.9"
  | 'ipad_11'      // iPad Pro 11"
  | 'ipad_105'     // iPad Pro 10.5"
  | 'ipad_97'      // iPad 9.7"
  | 'android_phone'
  | 'android_7inch'
  | 'android_10inch';

// ============================================================================
// App Store Connect Types
// ============================================================================

export interface ASCAppInfo {
  id: string;
  bundleId: string;
  name: string;
  sku: string;
  primaryLocale: string;
  appStoreState: string;
}

export interface ASCBundleId {
  id: string;
  identifier: string;
  name: string;
  platform: 'IOS' | 'MAC_OS' | 'UNIVERSAL';
  seedId?: string;
}

export interface ASCVersion {
  id: string;
  versionString: string;
  platform: 'IOS' | 'MAC_OS' | 'TV_OS';
  appStoreState: ASCVersionState;
  releaseType?: 'MANUAL' | 'AFTER_APPROVAL' | 'SCHEDULED';
  earliestReleaseDate?: string;
  downloadable?: boolean;
  createdDate: string;
}

export type ASCVersionState =
  | 'DEVELOPER_REMOVED_FROM_SALE'
  | 'DEVELOPER_REJECTED'
  | 'IN_REVIEW'
  | 'INVALID_BINARY'
  | 'METADATA_REJECTED'
  | 'PENDING_APPLE_RELEASE'
  | 'PENDING_CONTRACT'
  | 'PENDING_DEVELOPER_RELEASE'
  | 'PREPARE_FOR_SUBMISSION'
  | 'PREORDER_READY_FOR_SALE'
  | 'PROCESSING_FOR_APP_STORE'
  | 'READY_FOR_SALE'
  | 'REJECTED'
  | 'REMOVED_FROM_SALE'
  | 'WAITING_FOR_EXPORT_COMPLIANCE'
  | 'WAITING_FOR_REVIEW'
  | 'REPLACED_WITH_NEW_VERSION';

export interface ASCBuild {
  id: string;
  version: string;
  uploadedDate: string;
  processingState: 'PROCESSING' | 'FAILED' | 'INVALID' | 'VALID';
  usesNonExemptEncryption?: boolean;
  minOsVersion: string;
}

export interface ASCLocalization {
  id: string;
  locale: string;
  name?: string;
  subtitle?: string;
  description?: string;
  keywords?: string;
  whatsNew?: string;
  marketingUrl?: string;
  supportUrl?: string;
  privacyPolicyUrl?: string;
}

// ============================================================================
// Google Play Types
// ============================================================================

export interface GPCAppInfo {
  packageName: string;
  title: string;
  defaultLanguage: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWebsite?: string;
}

export interface GPCTrack {
  track: 'internal' | 'alpha' | 'beta' | 'production';
  status: 'draft' | 'inProgress' | 'halted' | 'completed';
  releases: GPCRelease[];
}

export interface GPCRelease {
  name: string;
  versionCodes: number[];
  status: 'draft' | 'inProgress' | 'halted' | 'completed' | 'rejected' | 'archived';
  releaseNotes?: GPCReleaseNote[];
  userFraction?: number;
}

export interface GPCReleaseNote {
  language: string;
  text: string;
}

// ============================================================================
// Deployment Configuration
// ============================================================================

export interface DeploymentConfig {
  platform: Platform;
  type: DeploymentType;
  version: string;
  buildNumber: string;
  binaryPath: string;
  metadata: AppMetadata;
  screenshots?: Screenshot[];
  credentials: ASCCredentials | GPCCredentials;
  
  // Options
  options?: DeploymentOptions;
  
  // Live data from store (if available)
  liveData?: any;
}

export interface DeploymentOptions {
  autoPublish?: boolean;           // Auto-release after approval (default: false)
  waitForProcessing?: boolean;     // Wait for build processing (default: true for review)
  submitForReview?: boolean;       // Submit for review after upload
  phasedRelease?: boolean;         // iOS: 7-day phased release (default: false)
  gradualRollout?: boolean;        // Android: gradual rollout (default: false)
  rolloutPercentage?: number;      // Android: rollout percentage (1-100)
  replaceScreenshots?: boolean;    // Replace all existing screenshots (default: true)
  skipVersionCheck?: boolean;      // Skip version existence check before upload (--force flag)
}

// ============================================================================
// Deployment Result
// ============================================================================

export interface DeploymentResult {
  platform: Platform;
  success: boolean;
  version: string;
  buildNumber: string;
  status: DeploymentStatus | string;
  duration: number;
  
  // Upload info
  binaryUploaded: boolean;
  binarySize?: number;
  uploadDuration?: number;
  
  // Metadata info
  metadataUpdated: boolean;
  screenshotsUploaded: number;
  
  // Review info
  submittedForReview: boolean;
  submittedAt?: Date;
  estimatedReviewTime?: string;
  
  // Links
  testflightLink?: string;
  internalTestLink?: string;
  storeUrl?: string;
  consoleUrl?: string;
  
  // Platform-specific IDs
  versionId?: string;
  buildId?: string;
  trackId?: string;
  releaseId?: string;
  
  // Errors
  errorMessage?: string;
  errorDetails?: any;
  
  // Next steps
  nextSteps?: string[];
}

// ============================================================================
// Deployment Preview
// ============================================================================

export interface DeploymentPreview {
  platform: Platform;
  version: string;
  buildNumber: string;
  binaryPath: string;
  binarySize: number;
  
  // Current state (from live data)
  currentVersion?: string;
  currentMetadata?: AppMetadata;
  
  // What will change
  metadataChanges: MetadataChange[];
  screenshotChanges: ScreenshotChanges;
  
  // Validation
  validation: ValidationResult;
  
  // Available options
  deploymentOptions: DeploymentOption[];
}

export interface MetadataChange {
  field: string;
  oldValue: string | undefined;
  newValue: string | undefined;
  changed: boolean;
}

export interface ScreenshotChanges {
  toAdd: Screenshot[];
  toRemove: string[];
  unchanged: number;
  totalNew: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface DeploymentOption {
  type: DeploymentType;
  label: string;
  description: string;
  estimatedTime?: string;
  available: boolean;
  reason?: string;
}

// ============================================================================
// Progress Events
// ============================================================================

export interface DeploymentProgress {
  step: string;
  progress: number;
  message: string;
  details?: Record<string, any>;
}

export type ProgressCallback = (progress: DeploymentProgress) => void;
