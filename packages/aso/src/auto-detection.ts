/**
 * Auto-Detection Module
 * Automatically detects app information from project directory
 */

import fs from 'fs-extra';
import path from 'path';
import { z } from 'zod';
import { deepScan } from '@stora-sh/analyzer';
import { GeminiClient } from './ai/gemini-client.js';
import { categoryClassificationPrompt } from './ai/prompts/category-prompts.js';
import { IOS_CATEGORIES, ANDROID_CATEGORIES } from './types.js';

export interface DetectedAppInfo {
  name: string;
  description: string;
  category: string;
  keywords: string[];
  features: string[];
  platform: 'ios' | 'android' | 'both';
  framework: string;
  bundleId?: string;
  packageName?: string;
  version?: string;
  confidence: {
    name: number;
    description: number;
    category: number;
    features: number;
  };
  source: 'config' | 'context' | 'scan' | 'merged';
}

export class AppAutoDetector {
  private ai: GeminiClient;

  constructor(apiKey?: string) {
    this.ai = new GeminiClient(apiKey);
  }

  /**
   * Main auto-detection function
   * Checks multiple sources in priority order
   */
  async detectAppInfo(projectDir: string): Promise<DetectedAppInfo> {
    console.log('🔍 Auto-detecting app information...');

    // 1. Check for stora.config.js (highest priority)
    const configInfo = await this.detectFromConfig(projectDir);
    if (configInfo && configInfo.name && configInfo.description !== 'Your app description here') {
      console.log('✅ Using information from stora.config.js');
      return configInfo;
    }

    // 2. Check for .stora context (detailed analysis)
    const contextInfo = await this.detectFromContext(projectDir);
    if (contextInfo) {
      console.log('✅ Using information from .stora context');
      return contextInfo;
    }

    // 3. Fall back to deep scan
    const scanInfo = await this.detectFromDeepScan(projectDir);
    if (scanInfo) {
      console.log('✅ Using information from deep scan');
      return scanInfo;
    }

    // 4. Ultimate fallback
    throw new Error('Could not auto-detect app information. Please run "stora init" first or provide manual information.');
  }

  /**
   * Detect from stora.config.js
   */
  private async detectFromConfig(projectDir: string): Promise<DetectedAppInfo | null> {
    const configPath = path.join(projectDir, 'stora.config.js');

    if (!await fs.pathExists(configPath)) {
      return null;
    }

    try {
      // Dynamic import of config
      const configModule = await import(configPath);
      const config = configModule.default || configModule;

      const info: DetectedAppInfo = {
        name: config.appName || 'Unknown App',
        description: config.ios?.description || config.android?.fullDescription || 'App description',
        category: this.extractCategoryFromConfig(config),
        keywords: this.extractKeywordsFromConfig(config).filter(k => k !== null) as string[],
        features: [], // Will be enhanced by context detection
        platform: config.platforms?.includes('ios') && config.platforms?.includes('android') ? 'both' :
                 config.platforms?.includes('ios') ? 'ios' : 'android',
        framework: 'unknown', // Will be detected by context/scan
        bundleId: config.ios?.bundleId || undefined,
        packageName: config.android?.packageName || undefined,
        version: config.version,
        confidence: {
          name: 95,
          description: config.ios?.description === 'Your app description here' ? 10 : 90,
          category: 80,
          features: 0,
        },
        source: 'config',
      };

      return info;
    } catch (error) {
      console.warn('Warning: Could not parse stora.config.js:', error);
      return null;
    }
  }

  /**
   * Detect from .stora context
   */
  private async detectFromContext(projectDir: string): Promise<DetectedAppInfo | null> {
    const contextPath = path.join(projectDir, '.stora', 'context', 'app-context.json');

    if (!await fs.pathExists(contextPath)) {
      return null;
    }

    try {
      const context = await fs.readJson(contextPath);

      // Extract features from screens and widgets
      const features = this.extractFeaturesFromContext(context);

      // Generate description from features
      const description = await this.generateDescriptionFromFeatures(features, context.framework);

      // Classify category using AI
      const category = await this.classifyCategory(features, context.framework);

      const info: DetectedAppInfo = {
        name: context.metadata?.name || 'Unknown App',
        description,
        category,
        keywords: this.generateKeywordsFromFeatures(features, category),
        features,
        platform: 'both', // Assume both unless specified
        framework: context.framework || context.metadata?.framework || 'unknown',
        bundleId: context.metadata?.bundleId?.ios,
        packageName: context.metadata?.bundleId?.android,
        version: context.metadata?.version,
        confidence: {
          name: 90,
          description: 85,
          category: 80,
          features: 90,
        },
        source: 'context',
      };

      return info;
    } catch (error) {
      console.warn('Warning: Could not parse .stora context:', error);
      return null;
    }
  }

  /**
   * Detect from deep scan
   */
  private async detectFromDeepScan(projectDir: string): Promise<DetectedAppInfo | null> {
    try {
      const scanResult = await deepScan(projectDir);

      if (!scanResult) {
        return null;
      }

      // Extract basic information from scan
      const features = this.extractFeaturesFromScan(scanResult);

      const info: DetectedAppInfo = {
        name: scanResult.name || 'Unknown App',
        description: `A ${scanResult.framework} app`, // Basic description
        category: 'Utilities', // Default category
        keywords: ['app', scanResult.framework].filter(k => k != null) as string[],
        features,
        platform: 'both',
        framework: scanResult.framework || 'unknown',
        version: scanResult.version || undefined,
        confidence: {
          name: 70,
          description: 30,
          category: 40,
          features: 60,
        },
        source: 'scan',
      };

      return info;
    } catch (error) {
      console.warn('Warning: Deep scan failed:', error);
      return null;
    }
  }

  /**
   * Extract category from config
   */
  private extractCategoryFromConfig(config: any): string {
    // Try to find category in iOS or Android config
    if (config.ios?.primaryCategory) return config.ios.primaryCategory;
    if (config.android?.primaryCategory) return config.android.primaryCategory;

    // Default based on keywords or features
    const keywords = config.aso?.targetKeywords || [];
    if (keywords.some((k: string) => k.toLowerCase().includes('game'))) return 'Games';
    if (keywords.some((k: string) => k.toLowerCase().includes('social'))) return 'Social Networking';
    if (keywords.some((k: string) => k.toLowerCase().includes('music'))) return 'Music';

    return 'Utilities'; // Safe default
  }

  /**
   * Extract keywords from config
   */
  private extractKeywordsFromConfig(config: any): string[] {
    const iosKeywords = config.ios?.keywords;
    const androidKeywords = config.android?.shortDescription;
    const asoKeywords = config.aso?.targetKeywords || [];

    if (iosKeywords && iosKeywords !== 'keyword1,keyword2,keyword3') {
      return iosKeywords.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);
    }

    if (asoKeywords.length > 0) {
      return asoKeywords.filter((k: string) => k != null);
    }

    return ['app']; // Minimal fallback
  }

  /**
   * Extract features from context
   */
  private extractFeaturesFromContext(context: any): string[] {
    const features: string[] = [];

    // Extract from screen names
    if (context.screens) {
      context.screens.forEach((screen: any) => {
        if (screen.name) {
          features.push(`Screen: ${screen.name}`);
        }
      });
    }

    // Extract from widgets
    if (context.widgets?.screens) {
      Object.values(context.widgets.screens).forEach((widgets: any) => {
        widgets.forEach((widget: any) => {
          if (widget.type === 'button' && widget.label) {
            features.push(`Button: ${widget.label}`);
          }
          if (widget.type === 'text' && widget.value) {
            features.push(`Text: ${widget.value}`);
          }
          if (widget.type === 'icon' && widget.semanticLabel) {
            features.push(`Icon: ${widget.semanticLabel}`);
          }
        });
      });
    }

    return [...new Set(features)]; // Remove duplicates
  }

  /**
   * Generate description from features
   */
  private async generateDescriptionFromFeatures(features: string[], framework: string): Promise<string> {
    if (features.length === 0) {
      return `A ${framework} mobile application.`;
    }

    // Simple heuristic-based description generation
    const featureText = features.slice(0, 5).join(', ').toLowerCase();

    if (featureText.includes('canvas') || featureText.includes('draw') || featureText.includes('brush')) {
      return `A creative ${framework} app for drawing and sketching. Create beautiful artwork with intuitive tools and features.`;
    }

    if (featureText.includes('task') || featureText.includes('todo') || featureText.includes('calendar')) {
      return `A productivity ${framework} app for managing tasks and staying organized. Plan your day and boost your efficiency.`;
    }

    if (featureText.includes('social') || featureText.includes('chat') || featureText.includes('message')) {
      return `A social ${framework} app for connecting with friends and sharing experiences. Stay connected and engaged.`;
    }

    return `A feature-rich ${framework} mobile application with ${features.length} screens and various interactive elements.`;
  }

  /**
   * Classify category using AI
   */
  private async classifyCategory(features: string[], framework: string): Promise<string> {
    if (!this.ai.isConfigured()) {
      // Fallback to heuristic classification
      return this.classifyCategoryHeuristically(features);
    }

    try {
      const prompt = categoryClassificationPrompt
        .replace('{features}', features.join('\n- '))
        .replace('{framework}', framework)
        .replace('{ios_categories}', IOS_CATEGORIES.join('\n- '))
        .replace('{android_categories}', ANDROID_CATEGORIES.join('\n- '));

      const result = await this.ai.generateStructured(prompt, z.object({
        category: z.string(),
        confidence: z.number(),
        reasoning: z.string(),
      }));

      return result.category;
    } catch (error) {
      console.warn('AI category classification failed, using heuristics');
      return this.classifyCategoryHeuristically(features);
    }
  }

  /**
   * Heuristic category classification (fallback)
   */
  private classifyCategoryHeuristically(features: string[]): string {
    const featureText = features.join(' ').toLowerCase();

    if (featureText.includes('canvas') || featureText.includes('draw') || featureText.includes('brush') || featureText.includes('paint')) {
      return 'Art & Design';
    }

    if (featureText.includes('game') || featureText.includes('play') || featureText.includes('score')) {
      return 'Games';
    }

    if (featureText.includes('social') || featureText.includes('chat') || featureText.includes('friend') || featureText.includes('message')) {
      return 'Social Networking';
    }

    if (featureText.includes('task') || featureText.includes('todo') || featureText.includes('calendar') || featureText.includes('productivity')) {
      return 'Productivity';
    }

    if (featureText.includes('music') || featureText.includes('audio') || featureText.includes('sound')) {
      return 'Music';
    }

    if (featureText.includes('photo') || featureText.includes('camera') || featureText.includes('image')) {
      return 'Photo & Video';
    }

    if (featureText.includes('health') || featureText.includes('fitness') || featureText.includes('workout')) {
      return 'Health & Fitness';
    }

    if (featureText.includes('food') || featureText.includes('restaurant') || featureText.includes('recipe')) {
      return 'Food & Drink';
    }

    if (featureText.includes('travel') || featureText.includes('map') || featureText.includes('navigation')) {
      return 'Travel';
    }

    return 'Utilities'; // Safe default
  }

  /**
   * Generate keywords from features and category
   */
  private generateKeywordsFromFeatures(features: string[], category: string): string[] {
    const keywords = new Set<string>();

    // Add category-based keywords
    const categoryKeywords: Record<string, string[]> = {
      'Art & Design': ['drawing', 'art', 'design', 'creative', 'sketch'],
      'Games': ['game', 'play', 'fun', 'entertainment'],
      'Social Networking': ['social', 'chat', 'friends', 'connect', 'share'],
      'Productivity': ['productivity', 'tasks', 'organization', 'efficiency', 'work'],
      'Music': ['music', 'audio', 'sound', 'songs', 'player'],
      'Photo & Video': ['photo', 'video', 'camera', 'images', 'pictures'],
      'Health & Fitness': ['health', 'fitness', 'workout', 'exercise', 'wellness'],
      'Food & Drink': ['food', 'drink', 'recipes', 'cooking', 'restaurant'],
      'Travel': ['travel', 'maps', 'navigation', 'trip', 'vacation'],
    };

    const catKeywords = categoryKeywords[category] || ['app', 'mobile'];
    catKeywords.forEach(k => keywords.add(k));

    // Add feature-based keywords
    const featureText = features.join(' ').toLowerCase();

    if (featureText.includes('canvas')) keywords.add('canvas');
    if (featureText.includes('draw') || featureText.includes('brush')) keywords.add('drawing');
    if (featureText.includes('task') || featureText.includes('todo')) keywords.add('tasks');
    if (featureText.includes('calendar')) keywords.add('calendar');
    if (featureText.includes('social') || featureText.includes('chat')) keywords.add('social');
    if (featureText.includes('music') || featureText.includes('audio')) keywords.add('music');
    if (featureText.includes('photo') || featureText.includes('camera')) keywords.add('photo');

    return Array.from(keywords).slice(0, 10); // Limit to 10 keywords
  }

  /**
   * Extract features from scan result
   */
  private extractFeaturesFromScan(scanResult: any): string[] {
    const features: string[] = [];

    if (scanResult.framework) {
      features.push(`${scanResult.framework} app`);
    }

    // Add basic features based on detected patterns
    if (scanResult.detectedFeatures) {
      scanResult.detectedFeatures.forEach((feature: any) => {
        if (feature.name) {
          features.push(feature.name);
        }
      });
    }

    return features;
  }

  /**
   * Save detected information back to config
   */
  async saveToConfig(projectDir: string, detectedInfo: DetectedAppInfo): Promise<void> {
    const configPath = path.join(projectDir, 'stora.config.js');

    try {
      // Load existing config
      const configModule = await import(configPath);
      const config = configModule.default || configModule;

      // Update with detected information
      const updatedConfig = {
        ...config,
        appName: detectedInfo.name,
        version: detectedInfo.version || config.version,
        platforms: detectedInfo.platform === 'both' ? ['ios', 'android'] :
                  detectedInfo.platform === 'ios' ? ['ios'] : ['android'],
        ios: {
          ...config.ios,
          bundleId: detectedInfo.bundleId || config.ios?.bundleId,
          appName: detectedInfo.name,
          description: detectedInfo.description,
          keywords: detectedInfo.keywords.join(','),
          // Add primary category if detected
          primaryCategory: detectedInfo.category,
        },
        android: {
          ...config.android,
          packageName: detectedInfo.packageName || config.android?.packageName,
          appName: detectedInfo.name,
          fullDescription: detectedInfo.description,
          shortDescription: detectedInfo.description.substring(0, 80),
          // Add primary category if detected
          primaryCategory: detectedInfo.category,
        },
        aso: {
          ...config.aso,
          targetKeywords: detectedInfo.keywords,
        },
      };

      // Convert to JavaScript string
      const configString = this.configToString(updatedConfig);

      // Write back to file
      await fs.writeFile(configPath, configString, 'utf-8');

      console.log(`💾 Updated stora.config.js with detected information`);
    } catch (error) {
      console.warn('Warning: Could not save to config:', error);
    }
  }

  /**
   * Convert config object to JavaScript string
   */
  private configToString(config: any): string {
    return `/**
 * Stora Configuration
 * Generated by: stora init + auto-detection
 *
 * @type {import('stora').StoraConfig}
 */
export default ${JSON.stringify(config, null, 2)};
`;
  }
}

// Export singleton instance
export const appAutoDetector = new AppAutoDetector();

// Export main function
export async function autoDetectAppInfo(projectDir: string): Promise<DetectedAppInfo> {
  return appAutoDetector.detectAppInfo(projectDir);
}

export async function saveDetectedInfoToConfig(projectDir: string, info: DetectedAppInfo): Promise<void> {
  return appAutoDetector.saveToConfig(projectDir, info);
}