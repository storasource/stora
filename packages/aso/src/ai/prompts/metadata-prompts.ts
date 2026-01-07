/**
 * AI Prompts for Metadata Generation
 * Comprehensive prompts for all App Store Connect and Google Play Console fields
 */

import { Platform, IOS_CATEGORIES, ANDROID_CATEGORIES } from '../../types.js';

export class MetadataPrompts {
  /**
   * Generate app name prompt
   */
  static appName(context: {
    currentName?: string;
    description: string;
    category: string;
    platform: Platform;
    keywords?: string[];
    competitors?: string[];
    features?: string[];
  }): string {
    const charLimit = context.platform === 'ios' ? 30 : 50;
    
    return `You are an expert ASO (App Store Optimization) specialist. Generate optimal app names for ${context.platform === 'ios' ? 'iOS App Store' : 'Google Play Store'}.

APP CONTEXT:
${context.currentName ? `Current Name: "${context.currentName}"` : ''}
Description: ${context.description.substring(0, 300)}${context.description.length > 300 ? '...' : ''}
Category: ${context.category}
${context.features && context.features.length > 0 ? `Key Features: ${context.features.slice(0, 5).join(', ')}` : ''}
${context.keywords && context.keywords.length > 0 ? `Target Keywords: ${context.keywords.slice(0, 5).join(', ')}` : ''}
${context.competitors && context.competitors.length > 0 ? `Top Competitors: ${context.competitors.slice(0, 3).join(', ')}` : ''}

PLATFORM REQUIREMENTS:
- Maximum ${charLimit} characters (STRICT - must be enforced)
- ${context.platform === 'ios' ? 'iOS users prefer clean, simple names' : 'Android allows longer, more descriptive names'}

APP NAME GUIDELINES:
1. **Simplicity**: Easy to remember and spell
2. **Clarity**: Hints at what the app does
3. **Distinctiveness**: Stands out from competitors
4. **Brandability**: Works as a brand name
5. **Keyword**: Include ONE primary keyword if natural

AVOID:
- Generic terms like "app", "best", "ultimate", "pro" (unless part of brand)
- Special characters (except &, -, spaces)
- All caps or excessive capitalization
- Similarity to existing apps
- Misleading names

STRATEGY:
- Front-load important words (users see first ~20 chars in search)
- Make it memorable and unique
- If including keyword, make it flow naturally
- Consider: Does it sound good when spoken?

Generate 5 variations ranked by effectiveness (score 0-100).

For each variation provide:
- name: The app name (must be ≤${charLimit} characters)
- score: Quality score based on clarity, brandability, keyword presence
- reasoning: Why this name works and its strengths
- keywords: Which keywords are naturally included
- characterCount: Exact character count

Return as JSON matching this structure.`;
  }
  
  /**
   * Generate subtitle prompt (iOS only)
   */
  static subtitle(context: {
    appName: string;
    description: string;
    category: string;
    keywords?: string[];
    valueProposition?: string;
    features?: string[];
  }): string {
    return `You are an expert ASO specialist. Generate optimal subtitles for iOS App Store.

APP CONTEXT:
App Name: "${context.appName}"
Description: ${context.description.substring(0, 300)}${context.description.length > 300 ? '...' : ''}
Category: ${context.category}
${context.features && context.features.length > 0 ? `Key Features: ${context.features.slice(0, 5).join(', ')}` : ''}
${context.keywords && context.keywords.length > 0 ? `Target Keywords: ${context.keywords.slice(0, 5).join(', ')}` : ''}
${context.valueProposition ? `Value Proposition: ${context.valueProposition}` : ''}

SUBTITLE REQUIREMENTS:
- Maximum 30 characters (STRICT)
- Appears below app name throughout App Store
- Summarizes the app in a concise phrase

SUBTITLE GUIDELINES:
1. **Explain VALUE, not just describe**: What does the user gain?
2. **Complement the app name**: Don't repeat what's already in the name
3. **Be specific**: Avoid generic phrases like "world's best" or "amazing app"
4. **Highlight differentiation**: What makes this unique?
5. **Include keywords naturally**: If they fit and add value
6. **Target audience**: Use language they understand and appreciate

GOOD SUBTITLE PATTERNS:
- "[Function] + [Benefit]": "Task Manager & Planner"
- "[Adjective] + [Core Feature]": "Fast & Private Messaging"
- "[Use Case] + [Tool]": "Photo Editor with AI"
- "[Action] + [Result]": "Track Workouts, Build Muscle"

AVOID:
- Generic descriptions ("world's best", "amazing", "#1")
- Just listing features without benefit
- Unnecessary words or filler
- All caps or excessive punctuation
- Repeating the app name

Generate 5 variations ranked by effectiveness (score 0-100).

For each variation provide:
- subtitle: The subtitle text (must be ≤30 characters)
- score: Quality score based on clarity, value communication, keyword presence
- reasoning: Why this subtitle is effective
- characterCount: Exact character count

Return as JSON matching this structure.`;
  }
  
  /**
   * Generate short description prompt (Android only)
   */
  static shortDescription(context: {
    appName: string;
    description: string;
    keywords?: string[];
    uniqueFeatures?: string[];
    category?: string;
  }): string {
    return `You are an expert ASO specialist. Generate optimal short descriptions for Google Play Store.

APP CONTEXT:
App Name: "${context.appName}"
${context.category ? `Category: ${context.category}` : ''}
Full Description: ${context.description.substring(0, 400)}${context.description.length > 400 ? '...' : ''}
${context.keywords && context.keywords.length > 0 ? `Key Features: ${context.keywords.slice(0, 5).join(', ')}` : ''}
${context.uniqueFeatures && context.uniqueFeatures.length > 0 ? `Unique Features: ${context.uniqueFeatures.join(', ')}` : ''}

SHORT DESCRIPTION REQUIREMENTS:
- Maximum 80 characters (STRICT)
- First text users see on Google Play
- Quick synopsis that sparks interest

SHORT DESCRIPTION GUIDELINES:
1. **Hook immediately**: Capture attention in 80 chars
2. **Communicate value**: What's the key benefit?
3. **Be specific**: Make it unique to this app
4. **Natural keywords**: Include relevant search terms
5. **Clear and concise**: Every character counts

GOOD PATTERNS:
- "[Action] + [Benefit]": "Track expenses and save money effortlessly"
- "[Problem] + [Solution]": "Never forget a task. Stay organized daily"
- "[Unique Feature]": "AI-powered photo editor with one-tap enhancements"

AVOID:
- Generic terms ("best", "#1", "top rated", "must-have")
- Call-to-actions ("download now", "try today")
- Marketing hype without substance
- Keyword stuffing
- Slang unless target audience uses it naturally

Generate 5 variations ranked by effectiveness (score 0-100).

For each variation provide:
- shortDescription: The text (must be ≤80 characters)
- score: Quality score based on hook strength, clarity, keyword presence
- reasoning: Why this description works
- characterCount: Exact character count

Return as JSON matching this structure.`;
  }
  
  /**
   * Generate full description prompt
   */
  static description(context: {
    appName: string;
    subtitle?: string;
    shortDescription?: string;
    category: string;
    platform: Platform;
    currentDescription?: string;
    keywords?: string[];
    features?: string[];
    targetAudience?: string;
    competitors?: Array<{ name: string; description: string }>;
    uniqueValue?: string;
  }): string {
    const platformSpecific = context.platform === 'ios' ? `
iOS-SPECIFIC CONSIDERATIONS:
- Emphasize privacy and security (iOS users value this)
- Mention iOS-exclusive features (Widgets, Shortcuts, etc.)
- Professional yet warm tone
` : `
ANDROID-SPECIFIC CONSIDERATIONS:
- Keywords in description matter for search ranking
- Can be slightly more detailed about functionality
- Mention Android-exclusive features (Material Design, etc.)
- Include technical details if relevant to audience
`;

    const tone = context.category === 'Games' ? 'Exciting and immersive' :
                context.category === 'Business' || context.category === 'Productivity' ? 'Professional yet approachable' :
                'Friendly and engaging';

    const keywordNote = context.platform === 'android'
      ? '- IMPORTANT: Keywords in description affect Android search ranking'
      : '- Keywords here don\'t affect iOS search (use keyword field instead)';

    return `You are an expert ASO specialist. Generate an optimal ${context.platform === 'ios' ? 'App Store' : 'Google Play'} description.

APP CONTEXT:
App Name: "${context.appName}"
${context.subtitle ? `Subtitle: "${context.subtitle}"` : ''}
${context.shortDescription ? `Short Description: "${context.shortDescription}"` : ''}
Category: ${context.category}
Platform: ${context.platform === 'ios' ? 'iOS App Store (Apple)' : 'Google Play Store (Android)'}
${context.currentDescription ? `\nCurrent Description:\n${context.currentDescription.substring(0, 500)}${context.currentDescription.length > 500 ? '...' : ''}` : ''}
${context.keywords && context.keywords.length > 0 ? `\nTarget Keywords: ${context.keywords.join(', ')}` : ''}
${context.features && context.features.length > 0 ? `\nKey Features:\n${context.features.map((f, i) => `  ${i + 1}. ${f}`).join('\n')}` : ''}
${context.targetAudience ? `\nTarget Audience: ${context.targetAudience}` : ''}
${context.uniqueValue ? `\nUnique Value Proposition: ${context.uniqueValue}` : ''}
${context.competitors && context.competitors.length > 0 ? `\nTop Competitors:\n${context.competitors.slice(0, 3).map(c => `  - ${c.name}: ${c.description.substring(0, 100)}...`).join('\n')}` : ''}

DESCRIPTION REQUIREMENTS:
- Maximum 4000 characters
- ${context.platform === 'ios' ? 'First 1-2 sentences are CRITICAL (visible without tapping "more")' : 'Keywords in description affect search ranking'}
- Must be engaging and informative

REQUIRED STRUCTURE:
1. **HOOK** (1-2 sentences, ~50-100 words)
   - Grab attention immediately
   - State the core value proposition
   - Make users want to read more
   - This is what shows before "...more"

2. **VALUE PROPOSITION** (1 paragraph, ~100-150 words)
   - What makes this app unique?
   - Why should users choose this over competitors?
   - What problem does it solve?
   - What benefit do users get?

3. **KEY FEATURES** (Bullet list, ~200-300 words)
   - Use bullets (• or -) for scannability
   - Focus on benefits, not just features
   - 5-8 main features
   - Each feature: what it does + why it matters
   - Naturally incorporate keywords

4. **SOCIAL PROOF** (Optional, ~50-100 words)
   - User testimonials (if available)
   - Awards or recognition
   - Download count or ratings (if impressive)
   - Press mentions

5. **CALL TO ACTION** (1-2 sentences, ~30-50 words)
   - Encourage download
   - Create urgency or excitement
   - Mention any special offers

WRITING GUIDELINES:
 - **Tone**: ${tone}
 - **Keywords**: Naturally incorporate 2-3% keyword density
   ${keywordNote}
 - **Readability**: Use short paragraphs, clear language, active voice
 - **Specificity**: Be concrete, not vague ("Save 2 hours daily" vs "Save time")
 - **Benefits over features**: Tell users what they gain
 - **Target audience**: Use terminology they understand

${platformSpecific}

AVOID:
- Keyword stuffing or unnatural keyword placement
- Generic marketing speak without substance
- Specific prices (shown elsewhere, vary by region)
- Excessive emojis or special characters
- False claims or exaggerations
- Competitor comparisons
- Outdated information

Generate a compelling, conversion-optimized description that balances keyword optimization with readability.

Provide:
- description: The full description text
- keywordDensity: Percentage of text that is target keywords (aim for 2-3%)
- readabilityScore: Flesch Reading Ease score estimate (60-70 is ideal)
- characterCount: Total character count
- structure: Break down into the required sections:
  - hook: The opening hook
  - valueProposition: The value prop paragraph
  - features: Array of feature bullets
  - socialProof: Social proof section (if applicable)
  - callToAction: The closing CTA

Return as JSON matching this structure.`;
  }
  
  /**
   * Generate promotional text prompt (iOS only)
   */
  static promotionalText(context: {
    appName: string;
    currentUpdate?: string;
    upcomingFeatures?: string[];
    limitedOffer?: string;
    seasonalEvent?: string;
    milestone?: string;
  }): string {
    return `You are an expert ASO specialist. Generate optimal promotional text for iOS App Store.

APP CONTEXT:
App Name: "${context.appName}"
${context.currentUpdate ? `Recent Update: ${context.currentUpdate}` : ''}
${context.upcomingFeatures && context.upcomingFeatures.length > 0 ? `Upcoming Features: ${context.upcomingFeatures.join(', ')}` : ''}
${context.limitedOffer ? `Special Offer: ${context.limitedOffer}` : ''}
${context.seasonalEvent ? `Seasonal Event: ${context.seasonalEvent}` : ''}
${context.milestone ? `Milestone: ${context.milestone}` : ''}

PROMOTIONAL TEXT REQUIREMENTS:
- Maximum 170 characters (STRICT)
- Appears at TOP of description page
- Can be updated ANYTIME without app submission
- Does NOT affect search ranking (don't use for keywords)

USE CASES:
1. **Feature Announcements**: Highlight new features or updates
2. **Limited-Time Promotions**: Sales, discounts, special offers
3. **Seasonal Content**: Holiday events, themed updates
4. **Milestones**: User count, downloads, awards
5. **Time-Sensitive News**: Conference attendance, partnerships, events

PROMOTIONAL TEXT GUIDELINES:
1. **Create urgency**: When appropriate (limited time, exclusive)
2. **Be specific**: Include dates, percentages, concrete details
3. **Action-oriented**: What's new, what's happening
4. **Timely**: Keep it current and relevant
5. **Exciting**: Generate interest and FOMO

GOOD PATTERNS:
- "New: [Feature] now available! Try it today."
- "Limited time: 50% off premium features until [date]"
- "Holiday special: [Event content] + exclusive [items]"
- "10 million users! Thank you for making us #1 in [category]"
- "Join us at [event] - special announcement coming soon!"

AVOID:
- Keyword stuffing (doesn't help ranking)
- Permanent content (gets outdated)
- Vague claims without details
- Repeating description content

Generate 3 variations for different use cases:
1. Feature announcement
2. Limited-time promotion
3. Seasonal/timely update

For each variation provide:
- text: The promotional text (must be ≤170 characters)
- useCase: Which use case this serves
- reasoning: Why this is effective for the use case
- characterCount: Exact character count

Return as JSON matching this structure.`;
  }
  
  /**
   * Generate keywords prompt (iOS only)
   */
  static keywords(context: {
    appName: string;
    description: string;
    category: string;
    currentKeywords?: string[];
    competitorKeywords?: string[];
    targetAudience?: string;
    keywordOpportunities?: Array<{ keyword: string; score: number }>;
    features?: string[];
  }): string {
    return `You are an expert ASO specialist specializing in iOS App Store keyword optimization. Generate the optimal keyword string.

APP CONTEXT:
App Name: "${context.appName}"
Category: ${context.category}
Description: ${context.description.substring(0, 300)}${context.description.length > 300 ? '...' : ''}
${context.features && context.features.length > 0 ? `\nKey Features: ${context.features.slice(0, 5).join(', ')}` : ''}
${context.currentKeywords && context.currentKeywords.length > 0 ? `\nCurrent Keywords: ${context.currentKeywords.join(', ')}` : ''}
${context.competitorKeywords && context.competitorKeywords.length > 0 ? `\nCompetitor Keywords (frequently used): ${context.competitorKeywords.slice(0, 15).join(', ')}` : ''}
${context.targetAudience ? `\nTarget Audience: ${context.targetAudience}` : ''}
${context.keywordOpportunities && context.keywordOpportunities.length > 0 ? `\nHigh-Opportunity Keywords:\n${context.keywordOpportunities.slice(0, 10).map(k => `  - ${k.keyword} (score: ${k.score})`).join('\n')}` : ''}

iOS KEYWORD FIELD REQUIREMENTS:
- Maximum 100 characters total (STRICT)
- Comma-separated with NO spaces after commas
- Critical for App Store search ranking
- Can be updated with each version submission

KEYWORD STRING FORMAT:
word1,word2,phrase one,phrase two,word3

KEYWORD SELECTION STRATEGY:

1. **MIX OF VOLUMES**:
   - High-volume (competitive but high traffic): 30-40%
   - Medium-volume (balanced): 40-50%
   - Long-tail (less competitive): 20-30%

2. **KEYWORD CATEGORIES TO INCLUDE**:
   - Primary: App category/core purpose (2-3 keywords)
   - Features: Specific functionality (3-4 keywords)
   - Benefits: What users gain (2-3 keywords)
   - Problems: What it solves (2-3 keywords)
   - Alternatives: Synonyms/related terms (2-3 keywords)

3. **SEARCH INTENT**:
   - Transactional: Users ready to download
   - Informational: Users researching
   - Navigational: Users seeking specific solution

MAXIMIZE CHARACTER USAGE:

DO:
- Use spaces to separate words within phrases: "real estate"
- Include singular form only if plural is included: "recipe" covers "recipes"
- Focus on functional, specific terms
- Balance popular vs niche keywords

DON'T:
- Add spaces after commas: "word1, word2" ❌ → "word1,word2" ✓
- Include plurals if singular exists: "task,tasks" ❌ → "task" ✓
- Use category names: "Productivity" already indexed
- Use app name: "${context.appName}" already indexed
- Duplicate words across keywords: "task list,task manager" → "task,list,manager"
- Use special characters: "# @ %" (no ranking benefit)
- Include "app" or category name

STRICTLY FORBIDDEN:
- Trademarked terms (unless you own them)
- Celebrity names
- Competitor app names
- Irrelevant terms
- Inappropriate/offensive terms

KEYWORD RESEARCH:
Based on the app context and competitive analysis, select keywords that:
1. Users actually search for (search volume)
2. You can realistically rank for (difficulty)
3. Are highly relevant to app functionality (relevance)
4. Competitors are succeeding with (competitive validation)

Generate the OPTIMAL keyword string that maximizes the 100-character limit.

Provide:
- keywordString: The complete keyword string (comma-separated, no spaces after commas)
- characterCount: Exact character count (must be ≤100)
- keywords: Array of individual keywords extracted from the string
- reasoning: Strategy behind keyword selection and why these keywords were chosen

Return as JSON matching this structure.`;
  }
  
  /**
   * Generate What's New prompt
   */
  static whatsNew(context: {
    appName: string;
    version: string;
    platform: Platform;
    changes?: string[];
    bugFixes?: string[];
    newFeatures?: string[];
    userFeedback?: string[];
  }): string {
    const charLimit = context.platform === 'ios' ? 4000 : 500;
    
    return `You are an expert ASO specialist. Generate engaging "What's New" release notes for version ${context.version}.

APP CONTEXT:
App Name: "${context.appName}"
Version: ${context.version}
Platform: ${context.platform === 'ios' ? 'iOS App Store (4000 char limit)' : 'Google Play Store (500 char limit)'}
${context.newFeatures && context.newFeatures.length > 0 ? `\nNew Features:\n${context.newFeatures.map((f, i) => `  ${i + 1}. ${f}`).join('\n')}` : ''}
${context.changes && context.changes.length > 0 ? `\nImprovements:\n${context.changes.map((c, i) => `  ${i + 1}. ${c}`).join('\n')}` : ''}
${context.bugFixes && context.bugFixes.length > 0 ? `\nBug Fixes:\n${context.bugFixes.map((b, i) => `  ${i + 1}. ${b}`).join('\n')}` : ''}
${context.userFeedback && context.userFeedback.length > 0 ? `\nBased on User Feedback:\n${context.userFeedback.join('\n')}` : ''}

WHAT'S NEW REQUIREMENTS:
- Maximum ${charLimit} characters
- Appears on product page and Updates tab
- Shows users what changed in this version

WHAT'S NEW GUIDELINES:
1. **Order by importance**: Most exciting/important first
2. **Be specific**: Don't just say "bug fixes" - say what was fixed
3. **User-focused**: Benefits, not technical details
4. **Engaging tone**: Make users excited to update
5. **Acknowledge feedback**: If you fixed user-reported issues, say so!

STRUCTURE (in order):
1. **NEW FEATURES** (if any)
   - Lead with most exciting new capability
   - Explain benefit, not just feature name
   - Use bullet points for multiple features

2. **IMPROVEMENTS** (if any)
   - What got better/faster/easier
   - Specific enhancements

3. **BUG FIXES** (if any)
   - Be transparent about what was fixed
   - "We fixed the issue where..."
   - If many small fixes: "Various bug fixes and stability improvements"

4. **CALL TO ACTION** (optional)
   - "Try it now!"
   - "Let us know what you think!"
   - "Have feedback? Contact us at..."

TONE:
- Friendly and conversational
- Excited about improvements
- Grateful to users (especially if fixing their reported issues)
- Professional but not corporate

${context.platform === 'android' ? `
ANDROID SPECIFIC:
- Only 500 characters - be VERY concise
- Prioritize ruthlessly
- Bullet points still recommended
- Skip intro/outro if space is tight
` : `
iOS SPECIFIC:
- 4000 characters - can be more detailed
- Can add personality and context
- Good place for thank-you message to users
`}

GOOD PATTERNS:
✓ "NEW: Dark mode! Your eyes will thank you 😎"
✓ "IMPROVED: 2x faster loading times"
✓ "FIXED: The crash when opening large files (thanks for reporting!)"
✓ "Based on your feedback, we added..."

AVOID:
✗ "Bug fixes and improvements" (too vague)
✗ "We completely rebuilt the backend" (users don't care about technical details)
✗ "Various minor updates" (not engaging)

Generate compelling release notes that make users excited to update.

Provide:
- text: The complete What's New text
- characterCount: Exact character count (must be <= ${charLimit})
- sections: Break down the content:
  - newFeatures: Array of new feature descriptions (if any)
  - improvements: Array of improvements (if any)
  - bugFixes: Array of bug fixes (if any)
  - callToAction: Closing message (if any)

Return as JSON matching this structure.`;
  }
}
