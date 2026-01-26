export const COMPLIANCE_ANALYSIS_PROMPT = `You are an expert App Store and Google Play reviewer analyzing mobile app screenshots for compliance violations.

Analyze this screenshot and identify any potential compliance issues across these categories:

**Privacy & Data Collection:**
- Missing or inadequate privacy disclosures
- Unclear data usage explanations
- Inappropriate data collection for app type
- Missing consent mechanisms
- COPPA violations (kids apps)

**User Interface & Experience:**
- Misleading UI elements
- Hidden fees or costs
- Unclear subscription terms
- Deceptive design patterns (dark patterns)
- Accessibility violations

**Content Policy:**
- Inappropriate content for age rating
- Objectionable content (violence, gambling, adult content)
- Intellectual property violations
- Misleading claims or false advertising

**Commerce & Monetization:**
- IAP implementation violations
- Unclear pricing information
- Misleading subscription flows
- Alternative payment method violations (iOS)

**Technical Requirements:**
- Broken UI elements
- Placeholder content in production
- Missing required functionality
- Performance issues visible in UI

For each issue you identify, provide:
1. **Severity**: critical | high | medium | low
2. **Policy ID**: Specific policy violated (e.g., "App Store 5.1.1" or "Play Store Families Policy")
3. **Title**: Brief issue title
4. **Description**: What's wrong and why it's a violation
5. **Recommendation**: Specific action to fix it
6. **Confidence**: Your confidence score (0-100)

IMPORTANT:
- Only report CLEAR violations you can see in the screenshot
- Do NOT speculate about functionality not visible
- Be conservative with severity ratings
- Provide actionable recommendations
- If no violations found, return empty array

Current context:
- Screen name: {screenName}
- App category: {category}
- Target store: {store}
- Age rating: {ageRating}

Return a JSON array of observations in this exact format:
[
  {
    "severity": "high",
    "policyId": "App Store 5.1.1",
    "title": "Hidden subscription auto-renewal",
    "description": "The subscription screen does not clearly display auto-renewal terms before purchase",
    "recommendation": "Add prominent text explaining auto-renewal, cancellation policy, and pricing before the purchase button",
    "confidence": 85
  }
]

If no violations found, return: []`;

export const SCREEN_CAPTION_PROMPT = `Generate a concise, descriptive caption for this mobile app screenshot.

The caption should:
- Identify the screen type (login, onboarding, checkout, etc.)
- Describe key UI elements visible
- Note any important user actions shown
- Be 1-2 sentences maximum
- Use objective, technical language

Examples:
- "Login screen with email/password fields and social auth buttons (Google, Apple)"
- "Product detail page showing price, description, and 'Add to Cart' button"
- "Permission request dialog asking for camera access with explanatory text"

Return only the caption text, no additional formatting or explanation.`;

export const EVIDENCE_CATEGORIZATION_PROMPT = `Categorize this mobile app screenshot into the most appropriate evidence category.

Available categories:
- onboarding: Welcome screens, tutorials, first-run experience
- authentication: Login, signup, password reset screens
- permissions: Permission request dialogs, settings screens
- commerce: Pricing, checkout, subscription flows, purchases
- content: Main app content, feeds, media viewers
- navigation: Tab bars, menus, navigation flows
- error_state: Error messages, empty states, loading states
- other: Anything that doesn't fit above categories

Current screen name: {screenName}

Return only the category name (lowercase, underscore-separated), nothing else.`;

export function buildCompliancePrompt(context: {
  screenName?: string;
  category?: string;
  store: 'app_store' | 'play_store' | 'both';
  ageRating?: string;
}): string {
  return COMPLIANCE_ANALYSIS_PROMPT.replace('{screenName}', context.screenName || 'Unknown')
    .replace('{category}', context.category || 'General')
    .replace('{store}', context.store === 'both' ? 'App Store & Play Store' : context.store === 'app_store' ? 'App Store' : 'Play Store')
    .replace('{ageRating}', context.ageRating || '12+');
}

export function buildCategorizationPrompt(screenName?: string): string {
  return EVIDENCE_CATEGORIZATION_PROMPT.replace('{screenName}', screenName || 'Unknown');
}
