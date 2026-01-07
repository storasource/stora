/**
 * AI-Powered Compliance Evaluator
 *
 * Uses Google Gemini to perform deep analysis of app compliance,
 * discovering issues that rule-based checks might miss.
 */

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import type {
  ComplianceIssue,
  AIComplianceResult,
  Severity,
  ComplianceEvaluationContext,
} from './types.js';

export interface AIEvaluatorOptions {
  /** Use Gemini Pro for maximum quality (default: false, uses Flash) */
  usePro?: boolean;
  /** Progress callback */
  onProgress?: (message: string) => void;
}

const SYSTEM_PROMPT = `You are an expert mobile app compliance analyst specializing in Apple App Store and Google Play Store guidelines. Your task is to analyze app configurations and identify compliance issues that could lead to app rejection.

Focus on:
1. Privacy and data handling compliance
2. Security best practices
3. Legal requirements (COPPA, GDPR, etc.)
4. Platform-specific guidelines
5. Content policies
6. In-app purchase and subscription rules
7. Advertising policies
8. Kids' category requirements

Respond with a JSON object containing:
- discoveredIssues: Array of new issues you found
- refinedIssues: Array of refinements to existing issues
- overallAssessment: A brief summary
- prioritizedActions: Array of recommended actions
- estimatedApprovalLikelihood: A number 0-100`;

/**
 * Evaluate compliance using AI for deep analysis
 */
export async function evaluateComplianceWithAI(
  context: ComplianceEvaluationContext,
  options: AIEvaluatorOptions = {}
): Promise<AIComplianceResult> {
  const { usePro = false, onProgress } = options;

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is required for AI compliance evaluation');
  }

  const modelId = usePro ? 'gemini-1.5-pro' : 'gemini-2.0-flash';
  const modelName = usePro ? 'Gemini 1.5 Pro' : 'Gemini 2.0 Flash';

  onProgress?.(`Analyzing compliance with ${modelName}...`);

  try {
    const model = google(modelId);
    const userPrompt = buildUserPrompt(context);

    const { text, usage } = await generateText({
      model,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      maxTokens: 4000,
      temperature: 0.2,
    });

    onProgress?.('Parsing AI analysis results...');

    const result = parseAIResponse(text);

    const discoveredIssues: ComplianceIssue[] = result.discoveredIssues.map((issue) => ({
      id: issue.id,
      severity: mapAISeverity(issue.severity),
      category: issue.category,
      title: issue.title,
      message: issue.description,
      recommendation: issue.recommendation,
      autoFixable: false,
    }));

    onProgress?.(`AI discovered ${discoveredIssues.length} additional issues`);

    return {
      discoveredIssues,
      refinedIssues: result.refinedIssues.map((r) => ({
        ...r,
        newSeverity: r.newSeverity ? mapAISeverity(r.newSeverity) : undefined,
      })),
      overallAssessment: result.overallAssessment,
      prioritizedActions: result.prioritizedActions,
      estimatedApprovalLikelihood: result.estimatedApprovalLikelihood,
      tokensUsed: usage?.totalTokens,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`AI compliance evaluation failed: ${message}`);
  }
}

function buildUserPrompt(context: ComplianceEvaluationContext): string {
  return `Analyze the following app for compliance issues:

App Information:
- Name: ${context.appName}
- Version: ${context.version}
- Framework: ${context.framework}
- Bundle ID: ${context.bundleId || 'N/A'}
- Package Name: ${context.packageName || 'N/A'}
- Platforms: ${context.platforms.join(', ')}

App Characteristics:
- Inferred Age Rating: ${context.inferredAgeRating || 'Unknown'}
- Kids App: ${context.isKidsApp ? 'Yes' : 'No'}
- Has Privacy Policy: ${context.hasPrivacyPolicy ? 'Yes' : 'No'}
- Privacy Policy URL: ${context.privacyPolicyUrl || 'N/A'}
- Has Ads: ${context.hasAds ? 'Yes' : 'No'}
- Has In-App Purchases: ${context.hasInAppPurchases ? 'Yes' : 'No'}
- Has Subscriptions: ${context.hasSubscriptions ? 'Yes' : 'No'}

Permissions:
- iOS: ${context.permissions.ios?.join(', ') || 'None'}
- Android: ${context.permissions.android?.join(', ') || 'None'}

Third-Party SDKs: ${context.thirdPartySDKs?.join(', ') || 'None detected'}

Existing Issues Found:
${context.existingIssues.map((i) => `- [${i.severity}] ${i.title}: ${i.description}`).join('\n') || 'None'}

${context.configSnippets ? `Configuration Snippets:
${context.configSnippets.infoPlist ? `Info.plist (excerpt):\n${context.configSnippets.infoPlist.slice(0, 2000)}\n` : ''}
${context.configSnippets.androidManifest ? `AndroidManifest.xml (excerpt):\n${context.configSnippets.androidManifest.slice(0, 2000)}\n` : ''}` : ''}

Please analyze this app and identify any additional compliance issues or refinements to existing issues.`;
}

interface AIResponseResult {
  discoveredIssues: Array<{
    id: string;
    severity: string;
    category: string;
    title: string;
    description: string;
    recommendation: string;
  }>;
  refinedIssues: Array<{
    originalId: string;
    newSeverity?: string;
    refinedRecommendation?: string;
    additionalContext?: string;
  }>;
  overallAssessment: string;
  prioritizedActions: Array<{
    priority: number;
    action: string;
    impact: 'high' | 'medium' | 'low';
    effort: 'high' | 'medium' | 'low';
    relatedIssueIds: string[];
  }>;
  estimatedApprovalLikelihood: number;
}

function parseAIResponse(text: string): AIResponseResult {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonString = jsonMatch ? jsonMatch[1] : text;

  try {
    const parsed = JSON.parse(jsonString.trim());

    return {
      discoveredIssues: parsed.discoveredIssues || [],
      refinedIssues: parsed.refinedIssues || [],
      overallAssessment: parsed.overallAssessment || 'Analysis completed',
      prioritizedActions: parsed.prioritizedActions || [],
      estimatedApprovalLikelihood: parsed.estimatedApprovalLikelihood ?? 50,
    };
  } catch {
    console.warn('Failed to parse AI response as JSON, using fallback extraction');

    return {
      discoveredIssues: [],
      refinedIssues: [],
      overallAssessment: text.slice(0, 500),
      prioritizedActions: [],
      estimatedApprovalLikelihood: 50,
    };
  }
}

function mapAISeverity(severity: string): Severity {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'major':
      return 'high';
    case 'moderate':
      return 'medium';
    case 'minor':
      return 'low';
    default:
      return 'medium';
  }
}

/**
 * Check if AI evaluation is available
 */
export function isAIEvaluationAvailable(): boolean {
  return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
}

/**
 * Build evaluation context from app info
 */
export function buildEvaluationContext(
  appInfo: {
    name: string;
    version: string;
    framework: string;
    bundleId?: string;
    packageName?: string;
    platforms: ('ios' | 'android')[];
  },
  analysisData: {
    inferredAgeRating?: string;
    isKidsApp?: boolean;
    permissions?: { ios?: string[]; android?: string[] };
    thirdPartySDKs?: string[];
    hasPrivacyPolicy?: boolean;
    privacyPolicyUrl?: string;
    hasAds?: boolean;
    hasInAppPurchases?: boolean;
    hasSubscriptions?: boolean;
  },
  existingIssues: ComplianceIssue[],
  configSnippets?: {
    infoPlist?: string;
    androidManifest?: string;
    pubspec?: string;
    privacyManifest?: string;
  }
): ComplianceEvaluationContext {
  return {
    appName: appInfo.name,
    version: appInfo.version,
    framework: appInfo.framework,
    bundleId: appInfo.bundleId,
    packageName: appInfo.packageName,
    platforms: appInfo.platforms,
    inferredAgeRating: analysisData.inferredAgeRating,
    isKidsApp: analysisData.isKidsApp,
    permissions: analysisData.permissions || {},
    thirdPartySDKs: analysisData.thirdPartySDKs,
    hasPrivacyPolicy: analysisData.hasPrivacyPolicy,
    privacyPolicyUrl: analysisData.privacyPolicyUrl,
    hasAds: analysisData.hasAds,
    hasInAppPurchases: analysisData.hasInAppPurchases,
    hasSubscriptions: analysisData.hasSubscriptions,
    existingIssues: existingIssues.map((i) => ({
      id: i.id,
      severity: i.severity,
      category: i.category,
      title: i.title,
      description: i.message,
      recommendation: i.recommendation,
    })),
    configSnippets,
  };
}
