/**
 * ASO Scorer
 * Calculates comprehensive ASO scores and grades
 */

export interface ScoringInput {
  title: string;
  subtitle?: string;
  shortDescription?: string;
  description: string;
  keywords?: string;
  category?: string;
  platform: 'ios' | 'android';
  
  // Performance data (if available)
  rating?: number;
  reviews?: number;
  
  // Analysis results
  keywordOpportunities?: number;
  competitorCount?: number;
}

export interface ASOScoreResult {
  overall: number; // 0-100
  title: number;
  description: number;
  keywords: number;
  competitive: number;
  grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
  
  breakdown: {
    titleIssues: string[];
    titleStrengths: string[];
    descriptionIssues: string[];
    descriptionStrengths: string[];
    keywordIssues: string[];
    keywordStrengths: string[];
  };
  
  predictions: {
    currentConversionRate: number;
    optimizedConversionRate: number;
    improvement: number;
    currentVisibility: number;
    optimizedVisibility: number;
    estimatedDownloadIncrease: number;
  };
  
  priorityActions: Array<{
    action: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    expectedImpact: number;
    reasoning: string;
  }>;
}

export class ASOScorer {
  /**
   * Calculate comprehensive ASO score
   */
  calculateScore(input: ScoringInput): ASOScoreResult {
    // Calculate component scores
    const titleScore = this.scoreTitleQuality(input);
    const descriptionScore = this.scoreDescriptionQuality(input);
    const keywordScore = this.scoreKeywordEffectiveness(input);
    const competitiveScore = this.scoreCompetitivePosition(input);
    
    // Weighted overall score
    const overall = Math.round(
      titleScore * 0.25 +
      descriptionScore * 0.25 +
      keywordScore * 0.30 +
      competitiveScore * 0.20
    );
    
    // Calculate grade
    const grade = this.calculateGrade(overall);
    
    // Generate breakdown
    const breakdown = this.generateBreakdown(input, titleScore, descriptionScore, keywordScore);
    
    // Generate predictions
    const predictions = this.generatePredictions(overall, titleScore, descriptionScore, keywordScore);
    
    // Generate priority actions
    const priorityActions = this.generatePriorityActions(breakdown, predictions);
    
    return {
      overall,
      title: titleScore,
      description: descriptionScore,
      keywords: keywordScore,
      competitive: competitiveScore,
      grade,
      breakdown,
      predictions,
      priorityActions,
    };
  }
  
  /**
   * Score title quality
   */
  private scoreTitleQuality(input: ScoringInput): number {
    let score = 100;
    const maxLength = input.platform === 'ios' ? 30 : 50;
    
    // Length check
    if (!input.title || input.title.length === 0) {
      return 0;
    }
    
    if (input.title.length > maxLength) {
      score -= 30; // Major penalty for exceeding limit
    } else if (input.title.length < 10) {
      score -= 15; // Too short
    } else if (input.title.length > maxLength * 0.9) {
      score -= 5; // Close to limit, good use of space
    }
    
    // Keyword presence (simple heuristic)
    const hasRelevantKeyword = /\b(app|tool|manager|tracker|helper|pro|plus)\b/i.test(input.title);
    if (hasRelevantKeyword) {
      score += 5;
    }
    
    // Avoid special characters (except &, -, :)
    if (/[!@#$%^*()+=\[\]{}|\\";'<>?/]/.test(input.title)) {
      score -= 10;
    }
    
    // Avoid all caps
    if (input.title === input.title.toUpperCase() && input.title.length > 3) {
      score -= 15;
    }
    
    // Clear and readable (has spaces)
    const wordCount = input.title.split(/\s+/).length;
    if (wordCount < 2) {
      score -= 5; // Single word titles less discoverable
    } else if (wordCount > 5) {
      score -= 10; // Too wordy
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Score description quality
   */
  private scoreDescriptionQuality(input: ScoringInput): number {
    let score = 100;
    
    if (!input.description || input.description.length === 0) {
      return 0;
    }
    
    const minLength = input.platform === 'ios' ? 100 : 80;
    const maxLength = 4000;
    
    // Length check
    if (input.description.length < minLength) {
      score -= 40; // Too short
    } else if (input.description.length < 200) {
      score -= 20; // Short but acceptable
    } else if (input.description.length > 500) {
      score += 10; // Good length
    }
    
    if (input.description.length > maxLength) {
      score -= 20;
    }
    
    // Structure checks
    const hasBullets = /[•\-\*]\s/.test(input.description);
    if (hasBullets) {
      score += 10; // Good formatting
    }
    
    // Call to action
    const hasCTA = /\b(download|try|get|start|install|join)\b/i.test(input.description);
    if (hasCTA) {
      score += 5;
    }
    
    // Keyword density (rough estimate)
    const words = input.description.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const diversity = uniqueWords.size / words.length;
    
    if (diversity < 0.3) {
      score -= 20; // Too repetitive, likely keyword stuffing
    } else if (diversity > 0.7) {
      score += 5; // Good variety
    }
    
    // Readability (simple check for sentence structure)
    const sentences = input.description.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length < 3) {
      score -= 10; // Too few sentences
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Score keyword effectiveness
   */
  private scoreKeywordEffectiveness(input: ScoringInput): number {
    if (input.platform === 'android') {
      // Android doesn't have separate keyword field
      // Score based on keyword presence in description
      return this.scoreAndroidKeywords(input);
    }
    
    // iOS keyword scoring
    let score = 100;
    
    if (!input.keywords || input.keywords.length === 0) {
      return 0;
    }
    
    const keywordList = input.keywords.split(',').map(k => k.trim()).filter(k => k);
    const maxChars = 100;
    
    // Length check
    if (input.keywords.length > maxChars) {
      score -= 30;
    } else if (input.keywords.length > maxChars * 0.9) {
      score += 10; // Good use of space
    } else if (input.keywords.length < maxChars * 0.7) {
      score -= 15; // Underutilizing the field
    }
    
    // Keyword count
    if (keywordList.length < 5) {
      score -= 20;
    } else if (keywordList.length >= 10) {
      score += 10;
    }
    
    // Check for duplicates
    const lowerKeywords = keywordList.map(k => k.toLowerCase());
    const duplicates = lowerKeywords.filter((k, i) => lowerKeywords.indexOf(k) !== i);
    if (duplicates.length > 0) {
      score -= 15;
    }
    
    // Check for wasted characters (spaces after commas)
    if (/,\s/.test(input.keywords)) {
      score -= 10;
    }
    
    // Check for app name or category in keywords (wasted)
    if (input.title) {
      const titleWords = input.title.toLowerCase().split(/\s+/);
      const wastesSpace = titleWords.some(word => 
        word.length > 3 && lowerKeywords.some(k => k.includes(word))
      );
      if (wastesSpace) {
        score -= 10;
      }
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Score Android keywords (in description)
   */
  private scoreAndroidKeywords(input: ScoringInput): number {
    let score = 70; // Base score for having a description
    
    if (!input.description) return 0;
    
    const words = input.description.toLowerCase().split(/\s+/);
    const wordFreq = new Map<string, number>();
    
    for (const word of words) {
      if (word.length >= 4) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    }
    
    // Check for keyword diversity
    const totalWords = words.length;
    const uniqueWords = wordFreq.size;
    
    if (uniqueWords / totalWords > 0.6) {
      score += 15; // Good keyword diversity
    }
    
    // Check for keyword density (not too repetitive)
    const maxFreq = Math.max(...wordFreq.values());
    if (maxFreq > totalWords * 0.05) { // More than 5% repetition
      score -= 15; // Too repetitive
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Score competitive position
   */
  private scoreCompetitivePosition(input: ScoringInput): number {
    let score = 50; // Default moderate score
    
    // Factor in keyword opportunities
    if (input.keywordOpportunities) {
      if (input.keywordOpportunities > 20) {
        score += 25; // Many opportunities
      } else if (input.keywordOpportunities > 10) {
        score += 15;
      } else {
        score += 5;
      }
    }
    
    // Factor in competitor count
    if (input.competitorCount !== undefined) {
      if (input.competitorCount < 5) {
        score += 15; // Low competition
      } else if (input.competitorCount < 10) {
        score += 10;
      } else if (input.competitorCount > 20) {
        score -= 10; // Very competitive
      }
    }
    
    // Factor in ratings (if available)
    if (input.rating) {
      if (input.rating >= 4.5) {
        score += 10;
      } else if (input.rating >= 4.0) {
        score += 5;
      } else if (input.rating < 3.5) {
        score -= 15;
      }
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Calculate letter grade
   */
  private calculateGrade(score: number): 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F' {
    if (score >= 97) return 'A+';
    if (score >= 93) return 'A';
    if (score >= 90) return 'A-';
    if (score >= 87) return 'B+';
    if (score >= 83) return 'B';
    if (score >= 80) return 'B-';
    if (score >= 77) return 'C+';
    if (score >= 73) return 'C';
    if (score >= 70) return 'C-';
    if (score >= 60) return 'D';
    return 'F';
  }
  
  /**
   * Generate detailed breakdown
   */
  private generateBreakdown(
    input: ScoringInput,
    titleScore: number,
    descriptionScore: number,
    keywordScore: number
  ) {
    const breakdown = {
      titleIssues: [] as string[],
      titleStrengths: [] as string[],
      descriptionIssues: [] as string[],
      descriptionStrengths: [] as string[],
      keywordIssues: [] as string[],
      keywordStrengths: [] as string[],
    };
    
    const maxTitleLength = input.platform === 'ios' ? 30 : 50;
    
    // Title analysis
    if (input.title.length > maxTitleLength) {
      breakdown.titleIssues.push(`Exceeds ${maxTitleLength} character limit`);
    } else if (input.title.length > maxTitleLength * 0.8) {
      breakdown.titleStrengths.push('Good use of available characters');
    }
    
    if (input.title.length < 15) {
      breakdown.titleIssues.push('Too short - consider adding descriptive keywords');
    }
    
    if (!/\s/.test(input.title)) {
      breakdown.titleIssues.push('Single word - consider multi-word title');
    }
    
    // Description analysis
    if (input.description.length < 200) {
      breakdown.descriptionIssues.push('Too short - expand with more details');
    } else if (input.description.length > 500) {
      breakdown.descriptionStrengths.push('Comprehensive description');
    }
    
    if (!/[•\-\*]/.test(input.description)) {
      breakdown.descriptionIssues.push('No bullet points - consider adding feature list');
    } else {
      breakdown.descriptionStrengths.push('Well-formatted with bullets');
    }
    
    if (!/\b(download|try|get|start)\b/i.test(input.description)) {
      breakdown.descriptionIssues.push('Missing call-to-action');
    }
    
    // Keyword analysis
    if (input.platform === 'ios' && input.keywords) {
      if (input.keywords.length < 70) {
        breakdown.keywordIssues.push('Underutilizing keyword space');
      } else if (input.keywords.length > 95) {
        breakdown.keywordStrengths.push('Excellent use of keyword space');
      }
      
      const keywordList = input.keywords.split(',').map(k => k.trim());
      if (keywordList.length < 8) {
        breakdown.keywordIssues.push('Too few keywords');
      }
    }
    
    return breakdown;
  }
  
  /**
   * Generate conversion predictions
   */
  private generatePredictions(
    overall: number,
    titleScore: number,
    descriptionScore: number,
    keywordScore: number
  ) {
    // Base conversion rate estimation (2.5% average)
    const baseConversion = 2.5;
    
    // Current conversion based on scores
    const currentConversion = baseConversion * (overall / 100);
    
    // Potential improvements
    const titleImprovement = (100 - titleScore) * 0.01;
    const descImprovement = (100 - descriptionScore) * 0.01;
    const keywordImprovement = (100 - keywordScore) * 0.015;
    
    const optimizedConversion = currentConversion + titleImprovement + descImprovement + keywordImprovement;
    
    // Visibility score (0-100)
    const currentVisibility = Math.round(overall * 0.8); // 80% correlation with overall score
    const optimizedVisibility = Math.min(100, currentVisibility + 15);
    
    // Download increase estimation
    const downloadIncrease = ((optimizedConversion - currentConversion) / currentConversion) * 100;
    
    return {
      currentConversionRate: Math.round(currentConversion * 100) / 100,
      optimizedConversionRate: Math.round(optimizedConversion * 100) / 100,
      improvement: Math.round(downloadIncrease * 10) / 10,
      currentVisibility,
      optimizedVisibility,
      estimatedDownloadIncrease: Math.round(downloadIncrease),
    };
  }
  
  /**
   * Generate priority actions
   */
  private generatePriorityActions(
    breakdown: any,
    predictions: any
  ): Array<{
    action: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    expectedImpact: number;
    reasoning: string;
  }> {
    const actions: Array<{
      action: string;
      priority: 'critical' | 'high' | 'medium' | 'low';
      expectedImpact: number;
      reasoning: string;
    }> = [];
    
    // Title issues
    breakdown.titleIssues.forEach((issue: string) => {
      if (issue.includes('Exceeds')) {
        actions.push({
          action: 'Shorten title to meet character limit',
          priority: 'critical',
          expectedImpact: 30,
          reasoning: 'App Store/Play Store will reject apps with titles exceeding limit',
        });
      } else if (issue.includes('short')) {
        actions.push({
          action: 'Expand title with descriptive keywords',
          priority: 'high',
          expectedImpact: 15,
          reasoning: 'Longer titles with keywords improve discoverability',
        });
      }
    });
    
    // Description issues
    breakdown.descriptionIssues.forEach((issue: string) => {
      if (issue.includes('short')) {
        actions.push({
          action: 'Expand description with features and benefits',
          priority: 'high',
          expectedImpact: 20,
          reasoning: 'Comprehensive descriptions improve conversion rates',
        });
      } else if (issue.includes('bullet')) {
        actions.push({
          action: 'Add bullet-pointed feature list',
          priority: 'medium',
          expectedImpact: 10,
          reasoning: 'Bullets improve scannability and user engagement',
        });
      } else if (issue.includes('call-to-action')) {
        actions.push({
          action: 'Add compelling call-to-action',
          priority: 'medium',
          expectedImpact: 8,
          reasoning: 'CTAs increase download intent',
        });
      }
    });
    
    // Keyword issues
    breakdown.keywordIssues.forEach((issue: string) => {
      if (issue.includes('Underutilizing')) {
        actions.push({
          action: 'Add more relevant keywords to fill 100 characters',
          priority: 'high',
          expectedImpact: 25,
          reasoning: 'More keywords = more search visibility',
        });
      } else if (issue.includes('few keywords')) {
        actions.push({
          action: 'Research and add high-opportunity keywords',
          priority: 'high',
          expectedImpact: 20,
          reasoning: 'More keywords increase chances of discovery',
        });
      }
    });
    
    // Sort by priority and expected impact
    return actions.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.expectedImpact - a.expectedImpact;
    });
  }
}

export default ASOScorer;
