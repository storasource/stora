/**
 * Enhanced ASO Module
 * Main orchestrator for AI-powered ASO optimization
 * Uses Claude (Sonnet/Opus) for AI-powered features
 */

import { ClaudeClient } from './ai/claude-client.js';
import { MetadataGenerator } from './generators/metadata-generator.js';
import { KeywordAnalyzer } from './analyzers/keyword-analyzer.js';
import { ASOScorer } from './scorers/aso-scorer.js';
import { CompetitorFinder } from './scrapers/competitor-finder.js';
import { AppStoreScraper } from './scrapers/app-store-scraper.js';
import { GooglePlayScraper } from './scrapers/google-play-scraper.js';
import type {
  Platform,
  ASOResult,
  ASOConfig,
  AppMetadata,
  TitleSuggestion,
  DescriptionSuggestion,
  KeywordSuggestion,
} from '../../types/index.js';

export interface EnhancedOptimizeOptions {
  projectDir: string;
  platform: Platform;
  config?: ASOConfig;
  metadata: AppMetadata;
  
  // API configuration
  apiKey?: string;
  
  // Analysis options
  includeCompetitors?: boolean;
  includeKeywordResearch?: boolean;
  generateMetadata?: boolean;
}

/**
 * Enhanced ASO optimization with AI
 */
export async function enhancedOptimizeASO(options: EnhancedOptimizeOptions): Promise<{
  score: ASOResult;
  analysis?: any;
  generatedMetadata?: any;
}> {
  const { platform, metadata, config, apiKey } = options;
  
  console.log('🚀 Running enhanced ASO optimization...\n');
  
  // Initialize components
  const scorer = new ASOScorer();
  const competitorFinder = new CompetitorFinder();
  
  // Check if AI is available (Claude)
  const ai = new ClaudeClient(apiKey);
  const hasAI = ai.isConfigured();
  
  if (!hasAI) {
    console.warn('⚠️  No API key configured. Running basic analysis only.');
    console.warn('   Set GOOGLE_GENERATIVE_AI_API_KEY for AI-powered features.\n');
  }
  
  // Step 1: Find competitors
  let competitors: any[] = [];
  if (options.includeCompetitors !== false) {
    console.log('🔍 Finding competitors...');
    try {
      competitors = await competitorFinder.findCompetitors({
        platform,
        appName: metadata.name,
        category: metadata.category || 'Utilities',
        keywords: config?.targetKeywords,
        limit: 10,
      });
      console.log(`   Found ${competitors.length} competitors\n`);
    } catch (error) {
      console.warn('   Could not find competitors:', error);
    }
  }
  
  // Step 2: Calculate current score
  console.log('📊 Calculating ASO score...');
  const scoreResult = scorer.calculateScore({
    title: metadata.name,
    description: metadata.description,
    keywords: Array.isArray(metadata.keywords) ? metadata.keywords.join(',') : metadata.keywords,
    category: metadata.category,
    platform,
    competitorCount: competitors.length,
  });
  
  console.log(`   Overall Score: ${scoreResult.overall}/100 (${scoreResult.grade})`);
  console.log(`   Title: ${scoreResult.title}/100`);
  console.log(`   Description: ${scoreResult.description}/100`);
  console.log(`   Keywords: ${scoreResult.keywords}/100\n`);
  
  // Step 3: AI-powered analysis (if available)
  let analysisResult: any;
  let generatedMetadata: any;
  
  if (hasAI) {
    // Keyword research
    if (options.includeKeywordResearch !== false) {
      console.log('🔑 Researching keywords with AI...');
      try {
        const keywordAnalyzer = new KeywordAnalyzer(apiKey);
        const keywords = await keywordAnalyzer.researchKeywords({
          appName: metadata.name,
          description: metadata.description,
          category: metadata.category || 'Utilities',
          platform,
          competitors,
          features: config?.targetKeywords,
        });
        
        console.log(`   Discovered ${keywords.length} keyword opportunities\n`);
        
        // Build basic analysis result
        analysisResult = {
          keywordOpportunities: keywords,
          competitors,
        };
      } catch (error) {
        console.warn('   Keyword research failed:', error);
      }
    }
    
    // Generate metadata
    if (options.generateMetadata) {
      console.log('✨ Generating optimized metadata with AI...');
      try {
        const generator = new MetadataGenerator(apiKey);
        generatedMetadata = await generator.generateAll({
          appName: metadata.name,
          currentDescription: metadata.description,
          category: metadata.category,
          platform,
          features: config?.targetKeywords,
          currentKeywords: metadata.keywords?.split(','),
          competitors,
        });
        
        console.log('   Generated all metadata fields\n');
      } catch (error) {
        console.warn('   Metadata generation failed:', error);
      }
    }
  }
  
  // Convert to legacy ASOResult format (with extended properties for AI insights)
  const legacyResult: ASOResult & { priorityActions?: any; predictions?: any } = {
    score: scoreResult.overall,
    grade: scoreResult.grade,
    titleScore: scoreResult.title,
    descriptionScore: scoreResult.description,
    keywordsScore: scoreResult.keywords,
    titleSuggestions: generatedMetadata?.ios?.appName.map((v: any) => ({
      title: v.name,
      score: v.score,
      reason: v.reasoning,
    })) || [],
    descriptionSuggestions: scoreResult.breakdown.descriptionIssues.map(issue => ({
      suggestion: issue,
      reason: 'Improvement opportunity',
    })),
    keywordSuggestions: scoreResult.breakdown.keywordIssues.map(issue => ({
      keyword: '',
      action: 'add' as const,
      reason: issue,
    })),
    improvements: scoreResult.priorityActions.map(action => action.action),
    // Preserve full data for AI insights display
    priorityActions: scoreResult.priorityActions,
    predictions: scoreResult.predictions,
  };
  
  console.log('✅ ASO optimization complete!\n');
  
  return {
    score: legacyResult,
    analysis: analysisResult,
    generatedMetadata,
  };
}

// Export all components
export {
  ClaudeClient,
  MetadataGenerator,
  KeywordAnalyzer,
  ASOScorer,
  CompetitorFinder,
  AppStoreScraper,
  GooglePlayScraper,
};

export * from './types.js';
