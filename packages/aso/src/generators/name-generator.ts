/**
 * App Store Name Generator
 *
 * Uses AI to generate unique, App Store-optimized app names
 * that are unlikely to conflict with existing apps.
 */

import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';

export interface NameGeneratorOptions {
  baseName: string;
  description?: string;
  category?: string;
  keywords?: string[];
  style?: 'descriptive' | 'creative' | 'minimal' | 'professional';
  maxLength?: number;
  platform?: 'ios' | 'android' | 'both';
}

export interface GeneratedName {
  name: string;
  subtitle?: string;
  reasoning: string;
  uniquenessScore: number; // 1-10
}

/**
 * Generate unique App Store names using AI
 * Returns multiple suggestions ranked by quality
 */
export async function generateAppStoreNames(options: NameGeneratorOptions): Promise<GeneratedName[]> {
  const {
    baseName,
    description = '',
    category = 'Utilities',
    keywords = [],
    style = 'descriptive',
    maxLength = 30,
    platform = 'ios',
  } = options;

  const prompt = buildNameGenerationPrompt({
    baseName,
    description,
    category,
    keywords,
    style,
    maxLength,
    platform,
  });

  try {
    // Try Gemini Pro first (excellent for creative naming and instruction following)
    const result = await generateText({
      model: google('gemini-1.5-pro') as any,
      prompt,
      temperature: 0.8,
    });

    return parseNameSuggestions(result.text, baseName);
  } catch (error) {
    // Fallback to Gemini Flash
    try {
      const result = await generateText({
        model: google('gemini-2.0-flash-exp') as any,
        prompt,
        temperature: 0.8,
      });
      return parseNameSuggestions(result.text, baseName);
    } catch {
      // Return fallback suggestions if AI fails
      return generateFallbackNames(baseName);
    }
  }
}

/**
 * Build the prompt for name generation
 */
function buildNameGenerationPrompt(options: {
  baseName: string;
  description: string;
  category: string;
  keywords: string[];
  style: string;
  maxLength: number;
  platform: string;
}): string {
  const { baseName, description, category, keywords, style, maxLength, platform } = options;

  return `You are an App Store Optimization (ASO) expert specializing in app naming.

Generate 5 unique, creative app names based on the following:

BASE NAME: ${baseName}
DESCRIPTION: ${description || 'Not provided'}
CATEGORY: ${category}
KEYWORDS: ${keywords.length > 0 ? keywords.join(', ') : 'Not provided'}
STYLE: ${style}
MAX LENGTH: ${maxLength} characters
PLATFORM: ${platform}

REQUIREMENTS:
1. Names must be UNIQUE and unlikely to conflict with existing apps
2. Include the base name "${baseName}" or a recognizable variation
3. Names should be memorable and easy to spell
4. Follow App Store naming best practices:
   - Be descriptive but concise
   - Include a key benefit or feature when possible
   - Avoid generic terms alone
5. Each name should have a different approach/angle
6. Stay within ${maxLength} characters

STYLE GUIDELINES for "${style}":
${getStyleGuidelines(style)}

OUTPUT FORMAT (JSON array):
[
  {
    "name": "App Name Here",
    "subtitle": "Optional subtitle for iOS (max 30 chars)",
    "reasoning": "Brief explanation of why this name works",
    "uniquenessScore": 8
  }
]

Generate exactly 5 suggestions, ordered by quality (best first).
Return ONLY the JSON array, no other text.`;
}

/**
 * Get style-specific guidelines
 */
function getStyleGuidelines(style: string): string {
  switch (style) {
    case 'descriptive':
      return `- Focus on what the app does
- Include action words or benefits
- Example: "Doddle - Creative Drawing Studio"`;
    case 'creative':
      return `- Be playful and memorable
- Use wordplay or unique phrasing
- Example: "Doddle: Sketch Your Imagination"`;
    case 'minimal':
      return `- Keep it short and simple
- Focus on brand recognition
- Example: "Doddle Draw"`;
    case 'professional':
      return `- Sound established and trustworthy
- Use industry-standard terminology
- Example: "Doddle Professional Art Suite"`;
    default:
      return '- Balance creativity with clarity';
  }
}

/**
 * Parse AI-generated name suggestions
 */
function parseNameSuggestions(text: string, baseName: string): GeneratedName[] {
  try {
    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return generateFallbackNames(baseName);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed)) {
      return generateFallbackNames(baseName);
    }

    return parsed
      .map((item: any) => ({
        name: String(item.name || '').substring(0, 50),
        subtitle: item.subtitle ? String(item.subtitle).substring(0, 30) : undefined,
        reasoning: String(item.reasoning || 'AI-generated suggestion'),
        uniquenessScore: Math.min(10, Math.max(1, Number(item.uniquenessScore) || 7)),
      }))
      .filter((item: GeneratedName) => item.name.length > 0);
  } catch {
    return generateFallbackNames(baseName);
  }
}

/**
 * Generate fallback names if AI fails
 */
function generateFallbackNames(baseName: string): GeneratedName[] {
  const timestamp = new Date().toISOString().split('T')[0];
  const sanitized = baseName.charAt(0).toUpperCase() + baseName.slice(1).toLowerCase();

  return [
    {
      name: `${sanitized} [${timestamp}]`,
      reasoning: 'Timestamp suffix ensures uniqueness',
      uniquenessScore: 9,
    },
    {
      name: `${sanitized} App`,
      subtitle: 'Simple and direct',
      reasoning: 'Simple suffix differentiates from other uses of the name',
      uniquenessScore: 6,
    },
    {
      name: `${sanitized} - Mobile`,
      subtitle: 'Platform indicator',
      reasoning: 'Platform indicator helps with discoverability',
      uniquenessScore: 6,
    },
    {
      name: `My ${sanitized}`,
      subtitle: 'Personal touch',
      reasoning: 'Personal prefix creates emotional connection',
      uniquenessScore: 5,
    },
    {
      name: `${sanitized} Pro`,
      subtitle: 'Professional edition',
      reasoning: 'Pro suffix implies advanced features',
      uniquenessScore: 5,
    },
  ];
}

/**
 * Quick helper to generate a single unique name with timestamp
 * Used for automatic fallback during deployment
 */
export function generateTimestampedName(baseName: string): string {
  const timestamp = new Date().toISOString().split('T')[0];
  return `${baseName} [${timestamp}]`;
}

/**
 * Generate a unique SKU from app name
 */
export function generateUniqueSku(appName: string): string {
  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const sanitizedName = appName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30);
  return `${sanitizedName}-${timestamp}`;
}
