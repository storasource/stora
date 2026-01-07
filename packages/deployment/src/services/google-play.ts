/**
 * Google Play Console Service
 * Handles all interactions with Google Play Developer API
 */

import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import fs from 'fs-extra';
import path from 'path';
import type {
  GPCCredentials,
  GPCAppInfo,
  GPCTrack,
  GPCRelease,
  GPCReleaseNote,
  AppMetadata,
  Screenshot,
  DeploymentType,
  ProgressCallback,
} from './types.js';

// Track names for Android deployment
const TRACK_MAP: Record<string, string> = {
  'internal': 'internal',
  'alpha': 'alpha',
  'beta': 'beta',
  'production': 'production',
};

export class GooglePlayService {
  private credentials: GPCCredentials;
  private auth: JWT;
  private androidpublisher: any;

  constructor(credentials: GPCCredentials) {
    this.credentials = credentials;

    // Parse service account key
    let keyData: any;
    try {
      keyData = JSON.parse(credentials.privateKey);
    } catch {
      throw new Error('Invalid service account key JSON');
    }

    // Create JWT auth client
    this.auth = new JWT({
      email: keyData.client_email || credentials.serviceAccountEmail,
      key: keyData.private_key,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });

    // Initialize Android Publisher API
    this.androidpublisher = google.androidpublisher({
      version: 'v3',
      auth: this.auth,
    });
  }

  // ============================================================================
  // Edit Session Management
  // ============================================================================

  /**
   * Create an edit session (required for all operations)
   */
  async createEdit(packageName: string): Promise<string> {
    try {
      const response = await this.androidpublisher.edits.insert({
        packageName,
      });

      return response.data.id;
    } catch (error: any) {
      throw new Error(`Failed to create edit: ${error.message}`);
    }
  }

  /**
   * Commit an edit session
   */
  async commitEdit(packageName: string, editId: string): Promise<void> {
    try {
      await this.androidpublisher.edits.commit({
        packageName,
        editId,
      });
    } catch (error: any) {
      throw new Error(`Failed to commit edit: ${error.message}`);
    }
  }

  /**
   * Delete an edit session (rollback)
   */
  async deleteEdit(packageName: string, editId: string): Promise<void> {
    try {
      await this.androidpublisher.edits.delete({
        packageName,
        editId,
      });
    } catch {
      // Ignore errors when deleting
    }
  }

  // ============================================================================
  // App Information
  // ============================================================================

  /**
   * Get app information
   */
  async getAppInfo(packageName: string): Promise<GPCAppInfo> {
    const editId = await this.createEdit(packageName);
    
    try {
      const response = await this.androidpublisher.edits.details.get({
        packageName,
        editId,
      });

      return {
        packageName,
        title: response.data.defaultLanguage || packageName,
        defaultLanguage: response.data.defaultLanguage || 'en-US',
        contactEmail: response.data.contactEmail,
        contactPhone: response.data.contactPhone,
        contactWebsite: response.data.contactWebsite,
      };
    } catch (error: any) {
      throw new Error(`Failed to get app info: ${error.message}`);
    } finally {
      await this.deleteEdit(packageName, editId);
    }
  }

  // ============================================================================
  // Binary Upload
  // ============================================================================

  /**
   * Upload APK to Google Play
   */
  async uploadApk(
    packageName: string,
    editId: string,
    apkPath: string,
    onProgress?: ProgressCallback
  ): Promise<number> {
    try {
      onProgress?.({ step: 'upload', progress: 0, message: 'Preparing APK upload...' });

      const apkBuffer = await fs.readFile(apkPath);
      
      onProgress?.({ step: 'upload', progress: 20, message: 'Uploading APK to Google Play...' });

      const response = await this.androidpublisher.edits.apks.upload({
        packageName,
        editId,
        media: {
          mimeType: 'application/vnd.android.package-archive',
          body: apkBuffer,
        },
      });

      onProgress?.({ step: 'upload', progress: 100, message: 'APK upload complete!' });

      return response.data.versionCode;
    } catch (error: any) {
      throw new Error(`Failed to upload APK: ${error.message}`);
    }
  }

  /**
   * Upload AAB (Android App Bundle) to Google Play
   */
  async uploadBundle(
    packageName: string,
    editId: string,
    bundlePath: string,
    onProgress?: ProgressCallback
  ): Promise<number> {
    try {
      onProgress?.({ step: 'upload', progress: 0, message: 'Preparing AAB upload...' });

      const bundleBuffer = await fs.readFile(bundlePath);
      
      onProgress?.({ step: 'upload', progress: 20, message: 'Uploading AAB to Google Play...' });

      const response = await this.androidpublisher.edits.bundles.upload({
        packageName,
        editId,
        media: {
          mimeType: 'application/octet-stream',
          body: bundleBuffer,
        },
      });

      onProgress?.({ step: 'upload', progress: 100, message: 'AAB upload complete!' });

      return response.data.versionCode;
    } catch (error: any) {
      throw new Error(`Failed to upload AAB: ${error.message}`);
    }
  }

  /**
   * Upload binary (auto-detect type)
   */
  async uploadBinary(
    packageName: string,
    editId: string,
    binaryPath: string,
    onProgress?: ProgressCallback
  ): Promise<number> {
    if (binaryPath.endsWith('.aab')) {
      return this.uploadBundle(packageName, editId, binaryPath, onProgress);
    } else if (binaryPath.endsWith('.apk')) {
      return this.uploadApk(packageName, editId, binaryPath, onProgress);
    } else {
      throw new Error(`Unsupported binary type: ${binaryPath}`);
    }
  }

  // ============================================================================
  // Track Management
  // ============================================================================

  /**
   * Get track information
   */
  async getTrack(
    packageName: string,
    editId: string,
    track: string
  ): Promise<GPCTrack | null> {
    try {
      const response = await this.androidpublisher.edits.tracks.get({
        packageName,
        editId,
        track,
      });

      return {
        track: response.data.track as any,
        status: 'completed',
        releases: (response.data.releases || []).map((r: any) => ({
          name: r.name,
          versionCodes: r.versionCodes?.map((v: string) => parseInt(v, 10)) || [],
          status: r.status,
          releaseNotes: r.releaseNotes,
          userFraction: r.userFraction,
        })),
      };
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      throw new Error(`Failed to get track: ${error.message}`);
    }
  }

  /**
   * Assign version to track
   */
  async assignToTrack(
    packageName: string,
    editId: string,
    track: string,
    versionCode: number,
    releaseNotes?: GPCReleaseNote[],
    status: 'draft' | 'completed' | 'halted' | 'inProgress' = 'completed',
    userFraction?: number
  ): Promise<void> {
    try {
      const release: any = {
        versionCodes: [versionCode.toString()],
        status,
      };

      if (releaseNotes && releaseNotes.length > 0) {
        release.releaseNotes = releaseNotes;
      }

      if (userFraction !== undefined && userFraction > 0 && userFraction < 1) {
        release.userFraction = userFraction;
        release.status = 'inProgress'; // Gradual rollout requires inProgress status
      }

      await this.androidpublisher.edits.tracks.update({
        packageName,
        editId,
        track,
        requestBody: {
          track,
          releases: [release],
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to assign to track: ${error.message}`);
    }
  }

  /**
   * Promote from one track to another
   */
  async promoteToTrack(
    packageName: string,
    editId: string,
    fromTrack: string,
    toTrack: string,
    versionCode: number
  ): Promise<void> {
    await this.assignToTrack(packageName, editId, toTrack, versionCode);
  }

  // ============================================================================
  // Metadata Management
  // ============================================================================

  /**
   * Get store listing
   */
  async getStoreListing(
    packageName: string,
    editId: string,
    language: string = 'en-US'
  ): Promise<any> {
    try {
      const response = await this.androidpublisher.edits.listings.get({
        packageName,
        editId,
        language,
      });

      return response.data;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      throw new Error(`Failed to get listing: ${error.message}`);
    }
  }

  /**
   * Update store listing
   */
  async updateStoreListing(
    packageName: string,
    editId: string,
    metadata: AppMetadata,
    language: string = 'en-US'
  ): Promise<void> {
    try {
      await this.androidpublisher.edits.listings.update({
        packageName,
        editId,
        language,
        requestBody: {
          language,
          title: metadata.name,
          shortDescription: metadata.subtitle || metadata.description.substring(0, 80),
          fullDescription: metadata.description,
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to update listing: ${error.message}`);
    }
  }

  // ============================================================================
  // Screenshot Management
  // ============================================================================

  /**
   * Delete all screenshots for an image type
   */
  async deleteScreenshots(
    packageName: string,
    editId: string,
    language: string,
    imageType: string
  ): Promise<void> {
    try {
      await this.androidpublisher.edits.images.deleteall({
        packageName,
        editId,
        language,
        imageType,
      });
    } catch {
      // Ignore errors when deleting
    }
  }

  /**
   * Upload screenshot
   */
  async uploadScreenshot(
    packageName: string,
    editId: string,
    language: string,
    imageType: string,
    imagePath: string
  ): Promise<void> {
    try {
      const imageBuffer = await fs.readFile(imagePath);
      
      await this.androidpublisher.edits.images.upload({
        packageName,
        editId,
        language,
        imageType,
        media: {
          mimeType: 'image/png',
          body: imageBuffer,
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to upload screenshot: ${error.message}`);
    }
  }

  /**
   * Upload all screenshots
   */
  async uploadScreenshots(
    packageName: string,
    editId: string,
    screenshots: Screenshot[],
    language: string = 'en-US',
    onProgress?: ProgressCallback
  ): Promise<number> {
    try {
      // Map device types to Google Play image types
      const imageTypeMap: Record<string, string> = {
        'android_phone': 'phoneScreenshots',
        'android_7inch': 'sevenInchScreenshots',
        'android_10inch': 'tenInchScreenshots',
        // iOS types fallback to phone
        'iphone_69': 'phoneScreenshots',
        'iphone_67': 'phoneScreenshots',
        'iphone_65': 'phoneScreenshots',
        'iphone_61': 'phoneScreenshots',
        'iphone_58': 'phoneScreenshots',
        'iphone_55': 'phoneScreenshots',
        'iphone_47': 'phoneScreenshots',
        'ipad_129': 'tenInchScreenshots',
        'ipad_11': 'tenInchScreenshots',
        'ipad_105': 'tenInchScreenshots',
        'ipad_97': 'sevenInchScreenshots',
      };

      // Group screenshots by type
      const screenshotsByType: Record<string, Screenshot[]> = {};
      for (const screenshot of screenshots) {
        const imageType = imageTypeMap[screenshot.deviceType] || 'phoneScreenshots';
        if (!screenshotsByType[imageType]) {
          screenshotsByType[imageType] = [];
        }
        screenshotsByType[imageType].push(screenshot);
      }

      // Delete existing screenshots (replace all strategy)
      onProgress?.({ step: 'screenshots', progress: 5, message: 'Removing existing screenshots...' });
      for (const imageType of Object.keys(screenshotsByType)) {
        await this.deleteScreenshots(packageName, editId, language, imageType);
      }

      let uploadedCount = 0;
      const totalScreenshots = screenshots.length;

      // Upload screenshots by type
      for (const [imageType, typeScreenshots] of Object.entries(screenshotsByType)) {
        for (const screenshot of typeScreenshots) {
          try {
            await this.uploadScreenshot(
              packageName,
              editId,
              language,
              imageType,
              screenshot.filePath
            );
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
  // Full Deployment Flow
  // ============================================================================

  /**
   * Deploy to a specific track
   */
  async deploy(
    packageName: string,
    binaryPath: string,
    track: string,
    metadata?: AppMetadata,
    screenshots?: Screenshot[],
    releaseNotes?: string,
    options?: {
      gradualRollout?: boolean;
      rolloutPercentage?: number;
      status?: 'draft' | 'completed';
    },
    onProgress?: ProgressCallback
  ): Promise<{
    success: boolean;
    versionCode?: number;
    editId?: string;
    error?: string;
  }> {
    let editId: string | undefined;
    
    try {
      // Create edit session
      onProgress?.({ step: 'prepare', progress: 0, message: 'Creating edit session...' });
      editId = await this.createEdit(packageName);

      // Upload binary
      onProgress?.({ step: 'upload', progress: 0, message: 'Uploading binary...' });
      const versionCode = await this.uploadBinary(packageName, editId, binaryPath, onProgress);

      // Update metadata if provided
      if (metadata) {
        onProgress?.({ step: 'metadata', progress: 0, message: 'Updating store listing...' });
        await this.updateStoreListing(packageName, editId, metadata);
        onProgress?.({ step: 'metadata', progress: 100, message: 'Store listing updated' });
      }

      // Upload screenshots if provided
      if (screenshots && screenshots.length > 0) {
        await this.uploadScreenshots(packageName, editId, screenshots, 'en-US', onProgress);
      }

      // Prepare release notes
      const releaseNotesList: GPCReleaseNote[] = releaseNotes 
        ? [{ language: 'en-US', text: releaseNotes }]
        : [];

      // Calculate user fraction for gradual rollout
      let userFraction: number | undefined;
      if (options?.gradualRollout && options.rolloutPercentage) {
        userFraction = options.rolloutPercentage / 100;
      }

      // Assign to track
      onProgress?.({ step: 'track', progress: 0, message: `Assigning to ${track} track...` });
      await this.assignToTrack(
        packageName,
        editId,
        track,
        versionCode,
        releaseNotesList,
        options?.status || 'completed',
        userFraction
      );
      onProgress?.({ step: 'track', progress: 100, message: `Assigned to ${track} track` });

      // Commit edit
      onProgress?.({ step: 'commit', progress: 0, message: 'Committing changes...' });
      await this.commitEdit(packageName, editId);
      onProgress?.({ step: 'commit', progress: 100, message: 'Deployment complete!' });

      return {
        success: true,
        versionCode,
        editId,
      };
    } catch (error: any) {
      // Rollback on error
      if (editId) {
        await this.deleteEdit(packageName, editId);
      }
      
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
