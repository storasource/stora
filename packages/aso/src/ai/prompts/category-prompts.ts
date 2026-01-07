/**
 * Category Classification Prompts
 * AI prompts for classifying app categories based on features
 */

export const categoryClassificationPrompt = `You are an expert ASO specialist with deep knowledge of app store categories. Analyze this mobile app's features and classify it into the most appropriate category.

APP INFORMATION:
Framework: {framework}
Detected Features:
{features}

AVAILABLE iOS CATEGORIES:
- Books
- Business
- Developer Tools
- Education
- Entertainment
- Finance
- Food & Drink
- Games
- Graphics & Design
- Health & Fitness
- Lifestyle
- Medical
- Music
- Navigation
- News
- Photo & Video
- Productivity
- Reference
- Shopping
- Social Networking
- Sports
- Travel
- Utilities
- Weather

AVAILABLE ANDROID CATEGORIES:
- Art & Design
- Auto & Vehicles
- Beauty
- Books & Reference
- Business
- Comics
- Communication
- Dating
- Education
- Entertainment
- Events
- Finance
- Food & Drink
- Health & Fitness
- House & Home
- Libraries & Demo
- Lifestyle
- Maps & Navigation
- Medical
- Music & Audio
- News & Magazines
- Parenting
- Personalization
- Photography
- Productivity
- Shopping
- Social
- Sports
- Tools
- Travel & Local
- Video Players & Editors
- Weather

CLASSIFICATION GUIDELINES:
1. Choose the category that BEST fits the app's primary purpose
2. Consider user intent and how they would search for this app
3. Look at the core features and functionality
4. Choose from the available categories above
5. Provide high confidence for clear matches, lower for ambiguous apps

ANALYSIS PROCESS:
1. Identify the app's main purpose from features
2. Match to most relevant category
3. Consider if it's a utility, entertainment, productivity, or niche app
4. Validate against real app store examples

Return your classification as JSON:
{
  "category": "Most appropriate category name",
  "confidence": 85, // 0-100 confidence score
  "reasoning": "Brief explanation of why this category fits"
}`;

export const enhancedCategoryPrompt = `You are an expert mobile app categorizer. Based on the app's features, screens, and functionality, determine the most appropriate app store category.

APP DETAILS:
Name: {appName}
Framework: {framework}
Description: {description}

DETECTED SCREENS:
{screens}

DETECTED FEATURES:
{features}

DETECTED WIDGETS:
{widgets}

CATEGORY SELECTION CRITERIA:
1. PRIMARY PURPOSE: What is the main thing users do with this app?
2. USER INTENT: How would users search for and discover this app?
3. CORE FEATURES: Which features define the app's value proposition?
4. COMPETITIVE LANDSCAPE: Which category has similar successful apps?

AVAILABLE CATEGORIES:
{iOS/Android categories}

EXAMPLES:
- Canvas screen + drawing tools → Art & Design
- Task lists + calendar → Productivity
- Social feeds + messaging → Social Networking
- Music player + playlists → Music
- Photo editor + filters → Photo & Video

CLASSIFY THIS APP:
1. Analyze the screens and features
2. Determine the primary user journey
3. Match to the most appropriate category
4. Provide reasoning and confidence level

Return as JSON:
{
  "primaryCategory": "Category name",
  "secondaryCategory": "Optional secondary category",
  "confidence": 90,
  "reasoning": "Why this category fits based on features and screens",
  "alternativeCategories": ["Option1", "Option2"]
}`;