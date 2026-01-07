/**
 * Zod schemas for structured AI output
 */

import { z } from 'zod';

// ============================================
// Metadata Generation Schemas
// ============================================

export const AppNameSchema = z.object({
  variations: z.array(z.object({
    name: z.string(),
    score: z.number().min(0).max(100),
    reasoning: z.string(),
    keywords: z.array(z.string()),
    characterCount: z.number(),
  })),
});

export const SubtitleSchema = z.object({
  variations: z.array(z.object({
    subtitle: z.string(),
    score: z.number().min(0).max(100),
    reasoning: z.string(),
    characterCount: z.number(),
  })),
});

export const ShortDescriptionSchema = z.object({
  variations: z.array(z.object({
    shortDescription: z.string(),
    score: z.number().min(0).max(100),
    reasoning: z.string(),
    characterCount: z.number(),
  })),
});

export const DescriptionSchema = z.object({
  description: z.string(),
  keywordDensity: z.number(),
  readabilityScore: z.number(),
  characterCount: z.number(),
  structure: z.object({
    hook: z.string(),
    valueProposition: z.string(),
    features: z.array(z.string()),
    socialProof: z.string().optional(),
    callToAction: z.string(),
  }),
});

export const PromotionalTextSchema = z.object({
  variations: z.array(z.object({
    text: z.string(),
    useCase: z.enum(['feature_announcement', 'promotion', 'seasonal']),
    reasoning: z.string(),
    characterCount: z.number(),
  })),
});

export const KeywordsSchema = z.object({
  keywordString: z.string(),
  characterCount: z.number(),
  keywords: z.array(z.string()),
  reasoning: z.string(),
});

export const WhatsNewSchema = z.object({
  text: z.string(),
  characterCount: z.number(),
  sections: z.object({
    newFeatures: z.array(z.string()).optional(),
    improvements: z.array(z.string()).optional(),
    bugFixes: z.array(z.string()).optional(),
    callToAction: z.string().optional(),
  }),
});

export const CategorySchema = z.object({
  primary: z.object({
    category: z.string(),
    confidence: z.number().min(0).max(100),
    reasoning: z.string(),
  }),
  secondary: z.object({
    category: z.string(),
    confidence: z.number().min(0).max(100),
    reasoning: z.string(),
  }).optional(),
  alternatives: z.array(z.object({
    category: z.string(),
    confidence: z.number().min(0).max(100),
  })),
});

// ============================================
// Keyword Research Schemas
// ============================================

export const KeywordResearchSchema = z.object({
  keywords: z.array(z.object({
    keyword: z.string(),
    searchVolume: z.number().min(0),
    difficulty: z.number().min(0).max(100),
    relevance: z.number().min(0).max(100),
    trend: z.enum(['rising', 'stable', 'declining']),
    reasoning: z.string(),
    variations: z.array(z.string()),
    category: z.enum(['primary', 'feature', 'benefit', 'problem-solution', 'alternative']).optional(),
  })),
});

export const KeywordGapSchema = z.object({
  gaps: z.array(z.object({
    keyword: z.string(),
    competitorsUsing: z.number(),
    reasoning: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    expectedImpact: z.number(),
  })),
});

// ============================================
// Competitive Analysis Schemas
// ============================================

export const CompetitiveAnalysisSchema = z.object({
  insights: z.object({
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    opportunities: z.array(z.string()),
    threats: z.array(z.string()),
  }),
  keywordStrategy: z.object({
    topKeywords: z.array(z.string()),
    missingKeywords: z.array(z.string()),
    uniqueKeywords: z.array(z.string()),
  }),
  recommendations: z.array(z.string()),
});

export const MarketIntelligenceSchema = z.object({
  overview: z.object({
    totalApps: z.number(),
    avgRating: z.number(),
    avgReviews: z.number(),
  }),
  trends: z.object({
    topFeatures: z.array(z.string()),
    emergingKeywords: z.array(z.string()),
    messagingPatterns: z.array(z.string()),
  }),
  opportunities: z.object({
    gaps: z.array(z.string()),
    differentiators: z.array(z.string()),
    recommendations: z.array(z.string()),
  }),
});

// ============================================
// Type exports
// ============================================

export type AppNameResult = z.infer<typeof AppNameSchema>;
export type SubtitleResult = z.infer<typeof SubtitleSchema>;
export type ShortDescriptionResult = z.infer<typeof ShortDescriptionSchema>;
export type DescriptionResult = z.infer<typeof DescriptionSchema>;
export type PromotionalTextResult = z.infer<typeof PromotionalTextSchema>;
export type KeywordsResult = z.infer<typeof KeywordsSchema>;
export type WhatsNewResult = z.infer<typeof WhatsNewSchema>;
export type CategoryResult = z.infer<typeof CategorySchema>;
export type KeywordResearchResult = z.infer<typeof KeywordResearchSchema>;
export type KeywordGapResult = z.infer<typeof KeywordGapSchema>;
export type CompetitiveAnalysisResult = z.infer<typeof CompetitiveAnalysisSchema>;
export type MarketIntelligenceResult = z.infer<typeof MarketIntelligenceSchema>;
