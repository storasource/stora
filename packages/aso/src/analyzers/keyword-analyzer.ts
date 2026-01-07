/**
 * Keyword Analyzer
 * AI-powered keyword research with competitive analysis
 * Uses Claude (Sonnet/Opus) for AI-powered analysis
 */

import { ClaudeClient } from '../ai/claude-client.js';
import { KeywordResearchSchema, KeywordGapSchema } from '../ai/schemas.js';
import { KeywordPrompts } from '../ai/prompts/keyword-prompts.js';
import { CompetitorApp, KeywordOpportunity, KeywordGap, Platform } from '../types.js';
import * as keywordExtractor from 'keyword-extractor';

export interface KeywordResearchOptions {
  appName: string;
  description: string;
  category: string;
  platform: Platform;
  currentKeywords?: string[];
  competitors?: CompetitorApp[];
  features?: string[];
  targetAudience?: string;
}

export interface KeywordGapOptions {
  currentKeywords: string[];
  competitors: CompetitorApp[];
  category: string;
  appDescription: string;
}

export class KeywordAnalyzer {
  private ai: ClaudeClient;
  
  constructor(apiKey?: string) {
    this.ai = new ClaudeClient(apiKey);
  }
  
  /**
   * Research keywords using AI and competitive analysis
   */
  async researchKeywords(options: KeywordResearchOptions): Promise<KeywordOpportunity[]> {
    // Extract competitor keywords for context
    const competitorKeywords = options.competitors 
      ? this.extractCompetitorKeywords(options.competitors)
      : undefined;
    
    // Build research prompt
    const prompt = KeywordPrompts.research({
      appName: options.appName,
      description: options.description,
      category: options.category,
      platform: options.platform,
      currentKeywords: options.currentKeywords,
      competitorKeywords,
      targetAudience: options.targetAudience,
      features: options.features,
    });
    
    // Get AI-generated keywords
    const result = await this.ai.generateStructured(prompt, KeywordResearchSchema, {
      temperature: 0.7,
      maxTokens: 4000,
    });
    
    // Enhance with competitive data and calculate opportunity scores
    const opportunities: KeywordOpportunity[] = result.keywords.map(kw => {
      const compUsage = competitorKeywords?.get(kw.keyword.toLowerCase()) || {
        count: 0,
        competitors: [],
      };
      
      return {
        keyword: kw.keyword,
        searchVolume: kw.searchVolume,
        difficulty: kw.difficulty,
        relevance: kw.relevance,
        trend: kw.trend,
        competitorUsage: compUsage,
        opportunityScore: this.calculateOpportunityScore({
          searchVolume: kw.searchVolume,
          difficulty: kw.difficulty,
          relevance: kw.relevance,
          competitorCount: compUsage.count,
        }),
        reasoning: kw.reasoning,
        variations: kw.variations,
        category: kw.category,
      };
    });
    
    // Sort by opportunity score (highest first)
    return opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore);
  }
  
  /**
   * Find keyword gaps compared to competitors
   */
  async findKeywordGaps(options: KeywordGapOptions): Promise<KeywordGap[]> {
    const currentSet = new Set(options.currentKeywords.map(k => k.toLowerCase()));
    
    // Extract competitor keywords
    const competitorKeywords = this.extractCompetitorKeywords(options.competitors);
    
    // Build gap analysis prompt
    const competitorsData = options.competitors.map(c => ({
      name: c.title,
      keywords: this.extractKeywordsFromText(
        `${c.title} ${c.subtitle || ''} ${c.description.substring(0, 200)}`
      ),
    }));
    
    const prompt = KeywordPrompts.gapAnalysis({
      currentKeywords: options.currentKeywords,
      competitors: competitorsData,
      category: options.category,
      appDescription: options.appDescription,
    });
    
    // Get AI analysis
    const result = await this.ai.generateStructured(prompt, KeywordGapSchema, {
      temperature: 0.6,
      maxTokens: 2000,
    });
    
    // Filter to only include keywords not in current set
    const gaps: KeywordGap[] = result.gaps
      .filter(gap => !currentSet.has(gap.keyword.toLowerCase()))
      .map(gap => ({
        keyword: gap.keyword,
        competitorsUsing: gap.competitorsUsing,
        reasoning: gap.reasoning,
        priority: gap.priority,
        expectedImpact: gap.expectedImpact,
      }));
    
    // Sort by priority then expected impact
    return gaps.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.expectedImpact - a.expectedImpact;
    });
  }
  
  /**
   * Extract keywords from competitor apps
   */
  private extractCompetitorKeywords(
    competitors: CompetitorApp[]
  ): Map<string, { count: number; competitors: string[] }> {
    const keywordMap = new Map<string, { count: number; competitors: string[] }>();
    
    for (const comp of competitors) {
      // Extract keywords from various sources
      const titleKeywords = this.extractKeywordsFromText(comp.title);
      const subtitleKeywords = comp.subtitle 
        ? this.extractKeywordsFromText(comp.subtitle)
        : [];
      const descriptionKeywords = this.extractKeywordsFromText(
        comp.description.substring(0, 300) // First 300 chars most relevant
      );
      
      // Combine all keywords
      const allKeywords = new Set([
        ...titleKeywords,
        ...subtitleKeywords,
        ...descriptionKeywords,
      ].map(k => k.toLowerCase()));
      
      // Count keyword usage
      for (const kw of allKeywords) {
        if (kw.length >= 3) { // Minimum 3 characters
          const existing = keywordMap.get(kw) || { count: 0, competitors: [] };
          existing.count++;
          if (!existing.competitors.includes(comp.title)) {
            existing.competitors.push(comp.title);
          }
          keywordMap.set(kw, existing);
        }
      }
    }
    
    return keywordMap;
  }
  
  /**
   * Extract keywords from text using NLP
   */
  private extractKeywordsFromText(text: string): string[] {
    try {
      // Use a simple keyword extraction approach
      const words = text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length >= 3 && word.length <= 20 && !/^\d+$/.test(word));

      // Count word frequency
      const wordFreq = new Map<string, number>();
      for (const word of words) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }

      // Return top words by frequency, filtering out common stop words
      const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'had', 'by', 'hot', 'day', 'from', 'she', 'his', 'they', 'say', 'her', 'she', 'will', 'one', 'all', 'would', 'there', 'their', 'what', 'out', 'about', 'who', 'get', 'which', 'when', 'make', 'can', 'like', 'time', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us']);

      return Array.from(wordFreq.entries())
        .filter(([word]) => !stopWords.has(word))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([word]) => word);
    } catch (error) {
      // Fallback to simple word extraction
      return text
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length >= 3 && !/^\d+$/.test(word))
        .slice(0, 20);
    }
  }
  
  /**
   * Calculate opportunity score for a keyword
   */
  private calculateOpportunityScore(metrics: {
    searchVolume: number;
    difficulty: number;
    relevance: number;
    competitorCount: number;
  }): number {
    // Normalize search volume to 0-100 scale
    const normalizedVolume = Math.min((metrics.searchVolume / 10000) * 100, 100);
    
    // Invert difficulty (lower difficulty = higher opportunity)
    const normalizedDifficulty = 100 - metrics.difficulty;
    
    // Relevance is already 0-100
    const normalizedRelevance = metrics.relevance;
    
    // Competitor factor: Some competition is good (validation), too much is bad
    let competitorFactor = 0;
    if (metrics.competitorCount === 0) {
      competitorFactor = 20; // Unproven keyword
    } else if (metrics.competitorCount <= 3) {
      competitorFactor = 50; // Good validation, low competition
    } else if (metrics.competitorCount <= 6) {
      competitorFactor = 30; // Proven but competitive
    } else {
      competitorFactor = 10; // Too competitive
    }
    
    // Weighted formula
    const score = (
      normalizedVolume * 0.35 +        // 35% weight on search volume
      normalizedDifficulty * 0.30 +    // 30% weight on low difficulty
      normalizedRelevance * 0.25 +     // 25% weight on relevance
      competitorFactor * 0.10          // 10% weight on competition level
    );
    
    return Math.round(score);
  }
  
  /**
   * Analyze current keyword performance
   */
  async analyzeCurrentKeywords(options: {
    keywords: string[];
    appName: string;
    category: string;
    competitors?: CompetitorApp[];
  }): Promise<Array<{
    keyword: string;
    score: number;
    issues: string[];
    suggestions: string[];
  }>> {
    const results: Array<{
      keyword: string;
      score: number;
      issues: string[];
      suggestions: string[];
    }> = [];
    
    const competitorKeywords = options.competitors 
      ? this.extractCompetitorKeywords(options.competitors)
      : new Map();
    
    for (const keyword of options.keywords) {
      const issues: string[] = [];
      const suggestions: string[] = [];
      let score = 100;
      
      // Check length
      if (keyword.length < 3) {
        issues.push('Too short (less than 3 characters)');
        score -= 30;
      }
      
      // Check if competitors use it
      const compUsage = competitorKeywords.get(keyword.toLowerCase());
      if (!compUsage || compUsage.count === 0) {
        issues.push('No competitors use this keyword (may be unproven)');
        suggestions.push('Validate this keyword has search volume');
        score -= 15;
      }
      
      // Check word count
      const wordCount = keyword.split(' ').length;
      if (wordCount === 1 && keyword.length < 5) {
        suggestions.push('Consider using a more specific phrase');
      }
      
      if (wordCount > 4) {
        issues.push('Very long-tail keyword (may have low volume)');
        suggestions.push('Consider shorter variations');
        score -= 10;
      }
      
      results.push({
        keyword,
        score: Math.max(0, score),
        issues,
        suggestions,
      });
    }
    
    return results;
  }
}

export default KeywordAnalyzer;
