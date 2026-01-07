/**
 * ASO Module Types
 * Comprehensive type definitions for App Store Optimization
 */

// ============================================
// Core ASO Types
// ============================================

export type Platform = 'ios' | 'android';

// ============================================
// Competitor App Data
// ============================================

export interface CompetitorApp {
  id: string;
  title: string;
  subtitle?: string; // iOS only
  description: string;
  keywords?: string; // iOS keywords if available
  rating: number;
  reviews: number;
  installs?: string; // Android only (e.g., "1M+")
  category: string;
  rank?: number; // App's rank in category
  price: number;
  screenshots: string[];
  icon: string;
  url: string;
  platform: Platform;
  
  // Metadata
  releaseDate?: string;
  currentVersion?: string;
  developer: string;
  developerWebsite?: string;
  
  // Analysis results
  analyzedKeywords?: ExtractedKeyword[];
  strengths?: string[];
  weaknesses?: string[];
}

export interface ExtractedKeyword {
  keyword: string;
  source: 'title' | 'subtitle' | 'description' | 'inferred';
  frequency: number;
  position?: number; // Position in source text
}

// ============================================
// Keyword Research
// ============================================

export interface KeywordOpportunity {
  keyword: string;
  searchVolume: number; // Estimated monthly searches
  difficulty: number; // 0-100 (0=easy, 100=hard)
  relevance: number; // 0-100 (how relevant to this app)
  competitorUsage: {
    count: number; // How many competitors use this
    competitors: string[]; // Which competitors
  };
  trend: 'rising' | 'stable' | 'declining';
  opportunityScore: number; // Composite score (0-100)
  reasoning: string; // Why this keyword is valuable
  variations: string[]; // Related keyword variations
  category?: 'primary' | 'feature' | 'benefit' | 'problem-solution' | 'alternative';
}

export interface KeywordGap {
  keyword: string;
  competitorsUsing: number;
  reasoning: string;
  priority: 'high' | 'medium' | 'low';
  expectedImpact: number; // % improvement estimate
}

// ============================================
// Market Intelligence
// ============================================

export interface MarketIntelligence {
  category: string;
  totalCompetitorsAnalyzed: number;
  marketOverview: {
    avgRating: number;
    avgReviews: number;
    topApps: Array<{
      name: string;
      rating: number;
      reviews: number;
    }>;
  };
  
  keywordLandscape: {
    topKeywords: Array<{
      keyword: string;
      usage: number; // % of apps using this
      avgRank: number; // Avg rank of apps using this
    }>;
    trendingKeywords: string[];
    underutilizedKeywords: string[];
  };
  
  contentPatterns: {
    commonFeatures: string[];
    messagingPatterns: string[];
    avgTitleLength: number;
    avgDescriptionLength: number;
  };
  
  pricingAnalysis: {
    free: number; // % free apps
    paid: number; // % paid apps
    freemium: number; // % with IAP
    avgPrice: number;
  };
  
  opportunities: {
    gaps: string[]; // Market gaps
    differentiators: string[]; // How to stand out
    recommendations: string[];
  };
}

// ============================================
// Generated Metadata
// ============================================

export interface GeneratedMetadata {
  ios: iOSMetadata;
  android: AndroidMetadata;
  generatedAt: Date;
  model: string; // AI model used
  confidence: number; // Overall confidence score
}

export interface iOSMetadata {
  appName: Array<{
    name: string;
    score: number;
    reasoning: string;
    keywords: string[];
    characterCount: number;
  }>;
  
  subtitle: Array<{
    subtitle: string;
    score: number;
    reasoning: string;
    characterCount: number;
  }>;
  
  description: {
    description: string;
    keywordDensity: number;
    readabilityScore: number;
    characterCount: number;
    structure: {
      hook: string;
      valueProposition: string;
      features: string[];
      socialProof?: string;
      callToAction: string;
    };
  };
  
  promotionalText: Array<{
    text: string;
    useCase: 'feature_announcement' | 'promotion' | 'seasonal';
    reasoning: string;
    characterCount: number;
  }>;
  
  keywords: {
    keywordString: string;
    characterCount: number;
    keywords: string[];
    reasoning: string;
  };
  
  whatsNew?: {
    text: string;
    characterCount: number;
    sections: {
      newFeatures?: string[];
      improvements?: string[];
      bugFixes?: string[];
      callToAction?: string;
    };
  };
  
  categories: {
    primary: {
      category: string;
      confidence: number;
      reasoning: string;
    };
    secondary?: {
      category: string;
      confidence: number;
      reasoning: string;
    };
    alternatives: Array<{
      category: string;
      confidence: number;
    }>;
  };
}

export interface AndroidMetadata {
  appName: Array<{
    name: string;
    score: number;
    reasoning: string;
    keywords: string[];
    characterCount: number;
  }>;
  
  shortDescription: Array<{
    shortDescription: string;
    score: number;
    reasoning: string;
    characterCount: number;
  }>;
  
  fullDescription: {
    description: string;
    keywordDensity: number;
    readabilityScore: number;
    characterCount: number;
    structure: {
      hook: string;
      valueProposition: string;
      features: string[];
      socialProof?: string;
      callToAction: string;
    };
  };
  
  whatsNew?: {
    text: string;
    characterCount: number;
    sections: {
      newFeatures?: string[];
      improvements?: string[];
      bugFixes?: string[];
      callToAction?: string;
    };
  };
  
  categories: {
    primary: {
      category: string;
      confidence: number;
      reasoning: string;
    };
    alternatives: Array<{
      category: string;
      confidence: number;
    }>;
  };
}

// ============================================
// ASO Analysis Results
// ============================================

export interface ASOAnalysisResult {
  // Current state
  currentListing: {
    title: string;
    subtitle?: string;
    shortDescription?: string;
    description: string;
    keywords?: string;
    category?: string;
    score: number;
  };
  
  // Competitive analysis
  competitors: CompetitorApp[];
  marketIntelligence: MarketIntelligence;
  
  // Keyword research
  keywordOpportunities: KeywordOpportunity[];
  keywordGaps: KeywordGap[];
  currentKeywordPerformance: Array<{
    keyword: string;
    score: number;
    issues: string[];
    suggestions: string[];
  }>;
  
  // Generated suggestions
  titleSuggestions: Array<{
    title: string;
    score: number;
    keywords: string[];
    reasoning: string;
  }>;
  
  descriptionSuggestions: Array<{
    description: string;
    score: number;
    keywordDensity: number;
    readability: number;
    reasoning: string;
  }>;
  
  keywordSuggestions: Array<{
    action: 'add' | 'remove' | 'replace';
    keyword: string;
    replacement?: string;
    priority: 'high' | 'medium' | 'low';
    expectedImpact: number;
    reasoning: string;
  }>;
  
  // Overall scoring
  score: {
    overall: number; // 0-100
    title: number;
    description: number;
    keywords: number;
    competitive: number;
    grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
  };
  
  // Predictions
  predictions: {
    currentConversionRate: number; // Estimated %
    optimizedConversionRate: number; // With suggestions applied
    improvement: number; // % improvement
    currentVisibility: number; // 0-100
    optimizedVisibility: number;
    estimatedDownloadIncrease: number; // % increase
  };
  
  // Action items
  quickWins: Array<{
    action: string;
    impact: number;
    effort: 'easy' | 'medium' | 'hard';
    timeEstimate: string;
  }>;
  
  priorityActions: Array<{
    action: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    expectedImpact: number;
    reasoning: string;
  }>;
  
  longTermStrategy: string[];
  
  // Metadata
  analyzedAt: Date;
  duration: number; // Analysis duration in ms
  platform: Platform;
}

// ============================================
// Generation Options
// ============================================

export interface GenerateMetadataOptions {
  // App context
  appName?: string;
  currentDescription?: string;
  category?: string;
  platform: 'ios' | 'android' | 'both';
  
  // Additional context
  features?: string[];
  targetAudience?: string;
  uniqueValue?: string;
  
  // Competitive data
  competitors?: CompetitorApp[];
  competitorIds?: string[]; // Auto-fetch if provided
  
  // Update context (for What's New)
  version?: string;
  newFeatures?: string[];
  improvements?: string[];
  bugFixes?: string[];
  userFeedback?: string[];
  
  // Keywords
  currentKeywords?: string[];
  keywordOpportunities?: Array<{ keyword: string; score: number }>;
  
  // Generation options
  variations?: number; // How many variations to generate
  temperature?: number; // AI creativity (0-1)
  includeCompetitiveAnalysis?: boolean;
  includeKeywordResearch?: boolean;
}

export interface AnalyzeASOOptions {
  // App information
  appName: string;
  description: string;
  category?: string;
  platform: Platform;
  currentKeywords?: string[];
  
  // Analysis options
  includeCompetitors?: boolean;
  competitorCount?: number;
  competitorIds?: string[]; // Specific competitors to analyze
  
  // Keyword research
  includeKeywordResearch?: boolean;
  targetKeywords?: string[];
  
  // Market analysis
  includeMarketIntelligence?: boolean;
  
  // Cache options
  useCache?: boolean;
  cacheTTL?: number; // ms
}

// ============================================
// Scraper Types
// ============================================

export interface ScraperOptions {
  country?: string;
  language?: string;
  limit?: number;
  cache?: boolean;
  cacheTTL?: number;
}

export interface SearchOptions extends ScraperOptions {
  query: string;
}

export interface AppDetailsOptions extends ScraperOptions {
  appId: string;
}

export interface TopAppsOptions extends ScraperOptions {
  category?: string;
  collection?: 'top_free' | 'top_paid' | 'top_grossing';
}

// ============================================
// Rate Limiter Types
// ============================================

export interface RateLimiterConfig {
  requestsPerMinute: number;
  burstSize?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// ============================================
// App Store Categories
// ============================================

export const IOS_CATEGORIES = [
  'Books',
  'Business',
  'Developer Tools',
  'Education',
  'Entertainment',
  'Finance',
  'Food & Drink',
  'Games',
  'Graphics & Design',
  'Health & Fitness',
  'Lifestyle',
  'Medical',
  'Music',
  'Navigation',
  'News',
  'Photo & Video',
  'Productivity',
  'Reference',
  'Shopping',
  'Social Networking',
  'Sports',
  'Travel',
  'Utilities',
  'Weather',
] as const;

export const ANDROID_CATEGORIES = [
  'Art & Design',
  'Auto & Vehicles',
  'Beauty',
  'Books & Reference',
  'Business',
  'Comics',
  'Communication',
  'Dating',
  'Education',
  'Entertainment',
  'Events',
  'Finance',
  'Food & Drink',
  'Health & Fitness',
  'House & Home',
  'Libraries & Demo',
  'Lifestyle',
  'Maps & Navigation',
  'Medical',
  'Music & Audio',
  'News & Magazines',
  'Parenting',
  'Personalization',
  'Photography',
  'Productivity',
  'Shopping',
  'Social',
  'Sports',
  'Tools',
  'Travel & Local',
  'Video Players & Editors',
  'Weather',
] as const;

export type iOSCategory = typeof IOS_CATEGORIES[number];
export type AndroidCategory = typeof ANDROID_CATEGORIES[number];
