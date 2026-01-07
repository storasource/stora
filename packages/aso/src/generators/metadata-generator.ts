/**
 * Metadata Generator
 * Generates ALL metadata fields for iOS and Android
 * Uses Claude (Sonnet/Opus) for AI-powered generation
 */

import { ClaudeClient } from '../ai/claude-client.js';
import { MetadataPrompts } from '../ai/prompts/metadata-prompts.js';
import {
  AppNameSchema,
  SubtitleSchema,
  ShortDescriptionSchema,
  DescriptionSchema,
  PromotionalTextSchema,
  KeywordsSchema,
  WhatsNewSchema,
  CategorySchema,
} from '../ai/schemas.js';
import { GeneratedMetadata, GenerateMetadataOptions, IOS_CATEGORIES, ANDROID_CATEGORIES } from '../types.js';

export class MetadataGenerator {
  private ai: ClaudeClient;
  
  constructor(apiKey?: string) {
    this.ai = new ClaudeClient(apiKey);
  }
  
  /**
   * Generate ALL metadata for both platforms
   */
  async generateAll(options: GenerateMetadataOptions): Promise<GeneratedMetadata> {
    const platforms = options.platform === 'both' 
      ? ['ios', 'android'] as const
      : [options.platform];
    
    const metadata: Partial<GeneratedMetadata> = {
      generatedAt: new Date(),
      model: this.ai.getModelName(),
      confidence: 0,
    };
    
    for (const platform of platforms) {
      if (platform === 'ios') {
        metadata.ios = await this.generateIOS(options);
      } else {
        metadata.android = await this.generateAndroid(options);
      }
    }
    
    // Calculate overall confidence (average of component confidences)
    metadata.confidence = 85; // Default confidence
    
    return metadata as GeneratedMetadata;
  }
  
  /**
   * Generate iOS-specific metadata
   */
  private async generateIOS(options: GenerateMetadataOptions) {
    console.log('Generating iOS metadata...');
    
    // Run all generations in parallel for speed
    const [appName, subtitle, description, promotionalText, keywords, categories, whatsNew] = 
      await Promise.all([
        // App Name
        this.generateAppName({ ...options, platform: 'ios' }),
        
        // Subtitle
        this.generateSubtitle(options),
        
        // Description
        this.generateDescription({ ...options, platform: 'ios' }),
        
        // Promotional Text
        this.generatePromotionalText(options),
        
        // Keywords
        this.generateKeywords(options),
        
        // Categories
        this.generateCategories({ ...options, platform: 'ios' }),
        
        // What's New (if version provided)
        options.version 
          ? this.generateWhatsNew({ ...options, platform: 'ios' })
          : Promise.resolve(undefined),
      ]);
    
    return {
      appName: appName.variations,
      subtitle: subtitle.variations,
      description,
      promotionalText: promotionalText.variations,
      keywords,
      categories,
      whatsNew,
    };
  }
  
  /**
   * Generate Android-specific metadata
   */
  private async generateAndroid(options: GenerateMetadataOptions) {
    console.log('Generating Android metadata...');
    
    const [appName, shortDescription, fullDescription, categories, whatsNew] = 
      await Promise.all([
        // App Name (50 char limit)
        this.generateAppName({ ...options, platform: 'android' }),
        
        // Short Description (Android-specific)
        this.generateShortDescription(options),
        
        // Full Description
        this.generateDescription({ ...options, platform: 'android' }),
        
        // Categories
        this.generateCategories({ ...options, platform: 'android' }),
        
        // What's New (500 char limit for Android)
        options.version 
          ? this.generateWhatsNew({ ...options, platform: 'android' })
          : Promise.resolve(undefined),
      ]);
    
    return {
      appName: appName.variations,
      shortDescription: shortDescription.variations,
      fullDescription,
      categories,
      whatsNew,
    };
  }
  
  /**
   * Generate app name variations
   */
  private async generateAppName(options: GenerateMetadataOptions & { platform: 'ios' | 'android' }) {
    const prompt = MetadataPrompts.appName({
      currentName: options.appName,
      description: options.currentDescription || '',
      category: options.category || 'Utilities',
      platform: options.platform,
      keywords: options.features,
      competitors: options.competitors?.map(c => c.title),
      features: options.features,
    });
    
    return this.ai.generateStructured(prompt, AppNameSchema, {
      temperature: options.temperature ?? 0.8,
      maxTokens: 2000,
    });
  }
  
  /**
   * Generate subtitle variations (iOS only)
   */
  private async generateSubtitle(options: GenerateMetadataOptions) {
    const prompt = MetadataPrompts.subtitle({
      appName: options.appName || 'App',
      description: options.currentDescription || '',
      category: options.category || 'Utilities',
      keywords: options.currentKeywords,
      valueProposition: options.uniqueValue,
      features: options.features,
    });
    
    return this.ai.generateStructured(prompt, SubtitleSchema, {
      temperature: options.temperature ?? 0.8,
      maxTokens: 1500,
    });
  }
  
  /**
   * Generate short description (Android only)
   */
  private async generateShortDescription(options: GenerateMetadataOptions) {
    const prompt = MetadataPrompts.shortDescription({
      appName: options.appName || 'App',
      description: options.currentDescription || '',
      keywords: options.currentKeywords,
      uniqueFeatures: options.features,
      category: options.category,
    });
    
    return this.ai.generateStructured(prompt, ShortDescriptionSchema, {
      temperature: options.temperature ?? 0.8,
      maxTokens: 1000,
    });
  }
  
  /**
   * Generate full description
   */
  private async generateDescription(options: GenerateMetadataOptions & { platform: 'ios' | 'android' }) {
    const prompt = MetadataPrompts.description({
      appName: options.appName || 'App',
      category: options.category || (options.platform === 'ios' ? 'Utilities' : 'Tools'),
      platform: options.platform,
      currentDescription: options.currentDescription,
      keywords: options.currentKeywords,
      features: options.features,
      targetAudience: options.targetAudience,
      competitors: options.competitors?.map(c => ({
        name: c.title,
        description: c.description,
      })),
      uniqueValue: options.uniqueValue,
    });
    
    return this.ai.generateStructured(prompt, DescriptionSchema, {
      temperature: options.temperature ?? 0.8,
      maxTokens: 3000,
    });
  }
  
  /**
   * Generate promotional text (iOS only)
   */
  private async generatePromotionalText(options: GenerateMetadataOptions) {
    const prompt = MetadataPrompts.promotionalText({
      appName: options.appName || 'App',
      upcomingFeatures: options.newFeatures,
    });
    
    return this.ai.generateStructured(prompt, PromotionalTextSchema, {
      temperature: options.temperature ?? 0.8,
      maxTokens: 1000,
    });
  }
  
  /**
   * Generate iOS keyword string
   */
  private async generateKeywords(options: GenerateMetadataOptions) {
    const prompt = MetadataPrompts.keywords({
      appName: options.appName || 'App',
      description: options.currentDescription || '',
      category: options.category || 'Utilities',
      currentKeywords: options.currentKeywords,
      competitorKeywords: this.extractCompetitorKeywords(options.competitors),
      targetAudience: options.targetAudience,
      keywordOpportunities: options.keywordOpportunities,
      features: options.features,
    });
    
    return this.ai.generateStructured(prompt, KeywordsSchema, {
      temperature: options.temperature ?? 0.6, // Lower temperature for keywords
      maxTokens: 1500,
    });
  }
  
  /**
   * Generate What's New text
   */
  private async generateWhatsNew(options: GenerateMetadataOptions & { platform: 'ios' | 'android' }) {
    const prompt = MetadataPrompts.whatsNew({
      appName: options.appName || 'App',
      version: options.version!,
      platform: options.platform,
      newFeatures: options.newFeatures,
      changes: options.improvements,
      bugFixes: options.bugFixes,
      userFeedback: options.userFeedback,
    });
    
    return this.ai.generateStructured(prompt, WhatsNewSchema, {
      temperature: options.temperature ?? 0.7,
      maxTokens: 2000,
    });
  }
  
  /**
   * Generate category classification
   */
  private async generateCategories(options: GenerateMetadataOptions & { platform: 'ios' | 'android' }) {
    const categories = options.platform === 'ios' 
      ? IOS_CATEGORIES.join('\n- ')
      : ANDROID_CATEGORIES.join('\n- ');
    
    const prompt = `You are an expert ASO specialist. Classify this app into the most appropriate ${options.platform === 'ios' ? 'App Store' : 'Google Play'} categories.

APP INFORMATION:
${options.appName ? `App Name: "${options.appName}"` : ''}
${options.currentDescription ? `Description: ${options.currentDescription.substring(0, 300)}` : ''}
${options.features ? `Features: ${options.features.join(', ')}` : ''}
${options.category ? `Current Category: ${options.category}` : ''}

AVAILABLE CATEGORIES:
- ${categories}

TASK:
1. Select the PRIMARY category (most important for discoverability)
${options.platform === 'ios' ? '2. Select a SECONDARY category if applicable (optional but recommended)' : ''}
3. Provide confidence score (0-100) and reasoning for each
4. Suggest 2-3 alternative categories

Be strategic - the primary category determines where the app appears in browse/filter.

Return as JSON with this structure:
- primary: { category, confidence, reasoning }
${options.platform === 'ios' ? '- secondary: { category, confidence, reasoning } (optional)' : ''}
- alternatives: [{ category, confidence }, ...]`;
    
    return this.ai.generateStructured(prompt, CategorySchema, {
      temperature: 0.3, // Lower temperature for classification
      maxTokens: 1000,
    });
  }
  
  /**
   * Extract keywords from competitor apps
   */
  private extractCompetitorKeywords(competitors?: any[]): string[] {
    if (!competitors || competitors.length === 0) return [];
    
    const keywords: string[] = [];
    for (const comp of competitors.slice(0, 5)) {
      if (comp.title) {
        keywords.push(...comp.title.toLowerCase().split(/\s+/));
      }
      if (comp.subtitle) {
        keywords.push(...comp.subtitle.toLowerCase().split(/\s+/));
      }
      if (comp.description) {
        const desc = comp.description.toLowerCase().split(/\s+/).slice(0, 50);
        keywords.push(...desc);
      }
    }
    
    // Count frequency and return top 20
    const frequency = new Map<string, number>();
    for (const kw of keywords) {
      if (kw.length >= 3) {
        frequency.set(kw, (frequency.get(kw) || 0) + 1);
      }
    }
    
    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([kw]) => kw);
  }
}

export default MetadataGenerator;
