/**
 * AI Prompts for Keyword Research
 */

import { Platform } from '../../types.js';

export class KeywordPrompts {
  /**
   * Comprehensive keyword research prompt
   */
  static research(context: {
    appName: string;
    description: string;
    category: string;
    platform: Platform;
    currentKeywords?: string[];
    competitorKeywords?: Map<string, { count: number; competitors: string[] }>;
    targetAudience?: string;
    features?: string[];
  }): string {
    const topCompetitorKeywords = context.competitorKeywords 
      ? Array.from(context.competitorKeywords.entries())
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 25)
          .map(([kw, usage]) => `"${kw}" - used by ${usage.count} competitors`)
      : [];
    
    return `You are an expert ASO specialist with deep knowledge of ${context.platform === 'ios' ? 'iOS App Store' : 'Google Play Store'} search algorithms. Research and suggest 30 high-opportunity keywords for this mobile app.

APP INFORMATION:
Name: "${context.appName}"
Description: ${context.description.substring(0, 400)}${context.description.length > 400 ? '...' : ''}
Category: ${context.category}
Platform: ${context.platform === 'ios' ? 'iOS App Store (Apple)' : 'Google Play Store (Android)'}
${context.features && context.features.length > 0 ? `\nKey Features:\n${context.features.slice(0, 8).map((f, i) => `  ${i + 1}. ${f}`).join('\n')}` : ''}
${context.currentKeywords && context.currentKeywords.length > 0 ? `\nCurrent Keywords: ${context.currentKeywords.join(', ')}` : ''}
${context.targetAudience ? `\nTarget Audience: ${context.targetAudience}` : ''}

${topCompetitorKeywords.length > 0 ? `
COMPETITOR KEYWORD ANALYSIS (what's working for competitors):
${topCompetitorKeywords.join('\n')}

Use this competitive data to inform your keyword selection. Keywords used by multiple successful competitors are validated market opportunities.
` : ''}

YOUR TASK:
Provide exactly 30 strategically selected keywords that will maximize this app's discoverability and attract the right users. Balance volume with achievability.

REQUIRED KEYWORD MIX:
- 8 HEAD TERMS (1-2 words, high volume 5000+, competitive 70-90 difficulty)
  Example: "meditation", "task manager", "photo editor"
  
- 16 LONG-TAIL (3-4 words, moderate volume 500-5000, medium 40-70 difficulty)
  Example: "daily meditation app", "simple task manager", "ai photo editor"
  
- 6 NICHE (4+ words or very specific, low volume <500, low <40 difficulty)
  Example: "guided meditation for sleep", "kanban task manager for teams"

KEYWORD CATEGORIES (ensure diversity):

1. PRIMARY KEYWORDS (6-8): Core app category and purpose
   - What category is this app in?
   - What is the primary function?
   Example: "meditation app", "mindfulness", "wellness"

2. FEATURE KEYWORDS (8-10): Specific functionality
   - What does the app DO?
   - What tools/features does it have?
   Example: "guided sessions", "breathing exercises", "sleep sounds"

3. BENEFIT KEYWORDS (5-7): What users gain
   - What outcomes do users get?
   - What problems are solved?
   Example: "reduce stress", "better sleep", "focus improvement"

4. PROBLEM-SOLUTION KEYWORDS (3-5): User pain points
   - What problems do users have?
   - How does the app solve them?
   Example: "anxiety relief", "can't sleep", "stress management"

5. ALTERNATIVE KEYWORDS (3-5): Different ways to say the same thing
   - Synonyms and related terms
   - Regional variations
   Example: "meditation" / "mindfulness", "exercise" / "workout"

6. TRENDING/CONTEXTUAL (0-3): If relevant to the app
   - Current trends
   - Seasonal terms
   - Emerging needs
   Example: "mental health", "work from home wellness"

SEARCH INTENT TYPES (balance across all 30 keywords):
- **Transactional** (50%): Users ready to download
  Example: "meditation app", "download task manager"
  
- **Informational** (30%): Users researching/learning
  Example: "how to meditate", "best productivity apps"
  
- **Navigational** (20%): Users seeking specific solution
  Example: "headspace alternative", "free meditation"

ESTIMATION GUIDELINES (be realistic):

**Search Volume** (monthly searches):
- 10,000+: Ultra-high (e.g., "games", "music", "chat")
- 5,000-10,000: High (e.g., "meditation app", "task manager")
- 1,000-5,000: Moderate (e.g., "guided meditation", "kanban board")
- 500-1,000: Low-moderate (e.g., "sleep meditation music")
- 100-500: Low (e.g., "pomodoro task timer")
- <100: Niche (e.g., "bilateral stimulation meditation")

**Difficulty** (ranking difficulty 0-100):
- 90-100: Extremely competitive - major apps dominate (e.g., "games", "facebook")
- 75-89: Very competitive - established apps (e.g., "meditation", "fitness")
- 60-74: Competitive - medium competition (e.g., "habit tracker")
- 40-59: Moderate - achievable with good ASO (e.g., "daily journal app")
- 20-39: Low competition - long-tail (e.g., "gratitude journal with prompts")
- 0-19: Very low - niche terms (e.g., "binaural beats meditation timer")

Consider:
- Brand strength needed to rank
- Number of competitors
- Quality of top-ranking apps
- Search result saturation

**Relevance** (how relevant to THIS specific app, 0-100):
- 100: Perfect match - core functionality (e.g., "meditation" for meditation app)
- 85-99: Highly relevant - main features (e.g., "guided meditation")
- 70-84: Relevant - secondary features (e.g., "sleep sounds" if app has this)
- 50-69: Somewhat related - tangential features (e.g., "relaxation" for meditation app)
- <50: Loosely related - avoid unless strategic

**Trend**:
- **Rising**: Growing in popularity (new technology, emerging needs, seasonal growth)
  Example: "AI meditation", "mental health apps", "remote work wellness"
  
- **Stable**: Consistent search volume over time (evergreen needs)
  Example: "meditation", "task manager", "calendar app"
  
- **Declining**: Decreasing interest (outdated tech, fading trends)
  Example: "blackberry apps", "flash games"

KEYWORD RESEARCH BEST PRACTICES:

1. **User Intent Focus**: What are users actually typing when they need this app?
2. **Competitive Validation**: If competitors succeed with a keyword, it's worth considering
3. **Specificity Wins**: "task manager for students" > "task app"
4. **Natural Language**: Use phrases people actually say
5. **Platform Differences**:
   ${context.platform === 'ios' ? 
     '- iOS: Keywords go in dedicated field, not description' : 
     '- Android: Keywords in description matter, use naturally'}

AVOID:
- Trademark violations (competitor brands, celebrity names)
- Irrelevant keywords just for volume
- Offensive or inappropriate terms
- Made-up words nobody searches for
- Pure brand terms (unless you're an alternative)

For each of the 30 keywords provide:
- keyword: Exact keyword phrase (how users search)
- searchVolume: Realistic monthly search estimate
- difficulty: Ranking difficulty 0-100
- relevance: Relevance to this app 0-100
- trend: "rising", "stable", or "declining"
- reasoning: Why this keyword is valuable (be specific, mention volume/difficulty/relevance trade-off)
- variations: 2-3 related keyword variations users might also search
- category: Which category this falls into (primary/feature/benefit/problem-solution/alternative)

Ensure you provide EXACTLY 30 keywords with proper distribution across categories and intent types.

Return as JSON array of keywords.`;
  }
  
  /**
   * Keyword gap analysis prompt
   */
  static gapAnalysis(context: {
    currentKeywords: string[];
    competitors: Array<{ name: string; keywords: string[] }>;
    category: string;
    appDescription: string;
  }): string {
    const competitorKeywordUsage = new Map<string, number>();
    
    // Count keyword usage across competitors
    context.competitors.forEach(comp => {
      comp.keywords.forEach(kw => {
        const lower = kw.toLowerCase();
        competitorKeywordUsage.set(lower, (competitorKeywordUsage.get(lower) || 0) + 1);
      });
    });
    
    // Find gaps (competitor keywords we don't have)
    const currentSet = new Set(context.currentKeywords.map(k => k.toLowerCase()));
    const gaps = Array.from(competitorKeywordUsage.entries())
      .filter(([kw]) => !currentSet.has(kw))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([kw, count]) => `"${kw}" - used by ${count} competitor(s)`);
    
    return `You are an expert ASO strategist. Analyze keyword gaps and identify opportunities.

CURRENT SITUATION:
App Description: ${context.appDescription.substring(0, 300)}
Category: ${context.category}
Current Keywords: ${context.currentKeywords.join(', ')}

COMPETITOR ANALYSIS:
${context.competitors.map(c => `${c.name}: ${c.keywords.slice(0, 8).join(', ')}`).join('\n')}

KEYWORD GAPS IDENTIFIED (competitors use these, we don't):
${gaps.join('\n')}

YOUR TASK:
Analyze these keyword gaps and identify the top 15 most valuable keywords we should consider adding.

For each gap keyword, determine:
1. Why are competitors using this keyword?
2. Is it relevant to our app's functionality?
3. What's the opportunity cost of NOT using it?
4. What's the expected impact of adding it?
5. Priority level (high/medium/low)

EVALUATION CRITERIA:
- **High Priority**: High competitor usage (3+), highly relevant, clear opportunity
- **Medium Priority**: Moderate usage (2), relevant, good potential
- **Low Priority**: Low usage (1), tangentially relevant, nice-to-have

For each of the top 15 gap keywords provide:
- keyword: The gap keyword
- competitorsUsing: Number of competitors using it
- reasoning: Why we should (or shouldn't) add this keyword
- priority: "high", "medium", or "low"
- expectedImpact: Estimated impact on downloads (% increase, be conservative)

Return as JSON object with "gaps" array.`;
  }
  
  /**
   * Keyword optimization prompt for existing keywords
   */
  static optimize(context: {
    currentKeywords: string[];
    appName: string;
    category: string;
    performance?: Array<{ keyword: string; rank?: number; traffic?: number }>;
  }): string {
    return `You are an expert ASO specialist. Analyze and optimize the current keyword strategy.

CURRENT KEYWORDS:
${context.currentKeywords.join(', ')}

APP CONTEXT:
App Name: "${context.appName}"
Category: ${context.category}
${context.performance ? `\nKeyword Performance:\n${context.performance.slice(0, 10).map(p => `  "${p.keyword}" - Rank: ${p.rank || 'N/A'}, Traffic: ${p.traffic || 'N/A'}`).join('\n')}` : ''}

YOUR TASK:
Analyze these keywords and provide optimization recommendations:

1. UNDERPERFORMING KEYWORDS:
   - Which keywords should be REMOVED?
   - Why are they not working?
   - What should replace them?

2. OPTIMIZATION OPPORTUNITIES:
   - Which keywords should be REPLACED with better alternatives?
   - What are the better alternatives?
   - Why would the replacement perform better?

3. MISSING KEYWORDS:
   - What obvious high-value keywords are missing?
   - Why should they be added?

For each recommendation provide:
- action: "add", "remove", or "replace"
- keyword: The keyword in question
- replacement: If replacing, what's the new keyword
- priority: "high", "medium", or "low"
- expectedImpact: Expected impact (% increase in relevant metric)
- reasoning: Why this change will improve performance

Return as JSON with recommendations array.`;
  }
}
