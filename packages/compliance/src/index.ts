/**
 * @stora-sh/compliance
 *
 * AI-powered compliance checking for iOS App Store and Google Play.
 *
 * @example
 * ```typescript
 * import { analyzeCompliance } from '@stora-sh/compliance';
 *
 * const result = await analyzeCompliance('./my-app', {
 *   platform: 'ios',
 *   enableAI: true,
 * });
 *
 * console.log(`Compliance score: ${result.score}/100`);
 * console.log(`Grade: ${result.grade}`);
 * console.log(`Issues: ${result.issues.length}`);
 * ```
 */

import fs from 'fs-extra';
import path from 'path';
import type {
  Platform,
  ComplianceResult,
  ComplianceIssue,
  ComplianceConfig,
  CategoryScore,
  EnhancedComplianceResult,
  AIComplianceResult,
} from './types.js';
import {
  evaluateComplianceWithAI,
  buildEvaluationContext,
  isAIEvaluationAvailable,
} from './ai-evaluator.js';

// Re-export types
export type {
  Platform,
  Severity,
  ComplianceIssue,
  CategoryScore,
  ComplianceResult,
  EnhancedComplianceResult,
  AIComplianceResult,
  ComplianceConfig,
  ComplianceEvaluationContext,
} from './types.js';

// Re-export AI utilities
export {
  evaluateComplianceWithAI,
  buildEvaluationContext,
  isAIEvaluationAvailable,
} from './ai-evaluator.js';

/**
 * Options for compliance analysis.
 *
 * Extends [ComplianceConfig] with additional metadata about the app
 * used for reporting and AI analysis context.
 */
export interface AnalyzeOptions extends ComplianceConfig {
  /** App name (for reporting) */
  appName?: string;
  /** App version */
  version?: string;
  /** Framework (react-native, flutter, native) */
  framework?: string;
}

/**
 * Analyzes an app project for compliance with store guidelines.
 *
 * Scans the project directory for iOS Info.plist and Android Manifest
 * configuration files, checking for common compliance issues such as
 * missing privacy descriptions, security misconfigurations, and
 * outdated SDK versions.
 *
 * When AI analysis is enabled, additionally sends app context to
 * Google Gemini for deeper inspection that rule-based checks may miss.
 *
 * @param projectDir - Path to the root of the app project
 * @param options - Configuration options for the analysis
 * @returns A promise resolving to the compliance result with score and issues
 *
 * @example
 * ```typescript
 * const result = await analyzeCompliance('./my-app', {
 *   platform: 'ios',
 *   enableAI: true,
 *   strictness: 'strict',
 * });
 *
 * if (result.score < 80) {
 *   console.log('Fix these issues before submitting:');
 *   result.issues.forEach(issue => console.log(`- ${issue.title}`));
 * }
 * ```
 */
export async function analyzeCompliance(
  projectDir: string,
  options: AnalyzeOptions
): Promise<EnhancedComplianceResult> {
  const { platform, enableAI = true } = options;

  const issues: ComplianceIssue[] = [];
  const categories: Record<string, CategoryScore> = {};

  // Run platform-specific checks
  if (platform === 'ios' || platform === 'both') {
    const iosIssues = await checkiOSCompliance(projectDir);
    issues.push(...iosIssues);
  }

  if (platform === 'android' || platform === 'both') {
    const androidIssues = await checkAndroidCompliance(projectDir);
    issues.push(...androidIssues);
  }

  // Run common checks
  const commonIssues = await checkCommonCompliance(projectDir);
  issues.push(...commonIssues);

  // Calculate category scores
  const issuesByCategory = groupIssuesByCategory(issues);
  for (const [category, categoryIssues] of Object.entries(issuesByCategory)) {
    const score = calculateCategoryScore(categoryIssues);
    categories[category] = {
      score,
      weight: getCategoryWeight(category),
      issues: categoryIssues.length,
    };
  }

  // Calculate overall score
  let score = calculateOverallScore(categories, issues);
  let grade = getGrade(score);
  let passLikelihood = calculatePassLikelihood(score, issues);

  const baseResult: ComplianceResult = {
    score,
    grade,
    passLikelihood,
    issues,
    categories,
  };

  // Run AI-powered analysis if available and enabled
  let aiAnalysis: AIComplianceResult | undefined;

  if (enableAI && isAIEvaluationAvailable()) {
    try {
      const platforms: ('ios' | 'android')[] =
        platform === 'ios' ? ['ios'] : platform === 'android' ? ['android'] : ['ios', 'android'];

      const evaluationContext = buildEvaluationContext(
        {
          name: options.appName || 'App',
          version: options.version || '1.0.0',
          framework: options.framework || 'unknown',
          platforms,
        },
        {
          hasPrivacyPolicy: false,
        },
        issues
      );

      aiAnalysis = await evaluateComplianceWithAI(evaluationContext, {
        onProgress: (msg) => console.log(`  ${msg}`),
      });

      // Merge AI-discovered issues
      if (aiAnalysis.discoveredIssues.length > 0) {
        baseResult.issues = [...baseResult.issues, ...aiAnalysis.discoveredIssues];

        const newScore = recalculateScore(baseResult.issues);
        baseResult.score = newScore.score;
        baseResult.grade = newScore.grade;
        baseResult.passLikelihood = aiAnalysis.estimatedApprovalLikelihood / 100;
      }

      // Apply refined recommendations
      if (aiAnalysis.refinedIssues.length > 0) {
        for (const refinement of aiAnalysis.refinedIssues) {
          const issue = baseResult.issues.find((i) => i.id === refinement.originalId);
          if (issue) {
            if (refinement.newSeverity) {
              issue.severity = refinement.newSeverity;
            }
            if (refinement.refinedRecommendation) {
              issue.recommendation = refinement.refinedRecommendation;
            }
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`AI analysis failed: ${errorMessage}`);
    }
  }

  return {
    ...baseResult,
    aiAnalysis,
  };
}

function recalculateScore(issues: ComplianceIssue[]): { score: number; grade: string } {
  let deduction = 0;

  for (const issue of issues) {
    switch (issue.severity) {
      case 'critical':
        deduction += 25;
        break;
      case 'high':
        deduction += 15;
        break;
      case 'medium':
        deduction += 8;
        break;
      case 'low':
        deduction += 3;
        break;
    }
  }

  const score = Math.max(0, 100 - deduction);
  return {
    score,
    grade: getGrade(score),
  };
}

async function checkiOSCompliance(projectDir: string): Promise<ComplianceIssue[]> {
  const issues: ComplianceIssue[] = [];
  const iosDir = path.join(projectDir, 'ios');

  if (await fs.pathExists(iosDir)) {
    const entries = await fs.readdir(iosDir, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'Pods') continue;

      const plistPath = path.join(iosDir, entry.name, 'Info.plist');
      if (await fs.pathExists(plistPath)) {
        try {
          const content = await fs.readFile(plistPath, 'utf-8');

          // Check privacy usage descriptions
          const privacyKeys = [
            { key: 'NSCameraUsageDescription', name: 'Camera' },
            { key: 'NSPhotoLibraryUsageDescription', name: 'Photo Library' },
            { key: 'NSLocationWhenInUseUsageDescription', name: 'Location' },
            { key: 'NSMicrophoneUsageDescription', name: 'Microphone' },
            { key: 'NSContactsUsageDescription', name: 'Contacts' },
          ];

          for (const { key, name } of privacyKeys) {
            if (content.includes(key)) {
              const match = content.match(
                new RegExp(`<key>${key}<\\/key>\\s*<string>([^<]*)<\\/string>`)
              );
              if (match && match[1].length < 10) {
                issues.push({
                  id: `ios-privacy-${key}`,
                  severity: 'medium',
                  category: 'Privacy',
                  title: `Insufficient ${name} usage description`,
                  message: `The ${name} usage description should be more descriptive.`,
                  recommendation: 'Provide a clear explanation of why your app needs this permission.',
                  autoFixable: false,
                });
              }
            }
          }

          // Check for App Transport Security
          if (content.includes('NSAllowsArbitraryLoads') && content.includes('<true/>')) {
            issues.push({
              id: 'ios-ats-disabled',
              severity: 'high',
              category: 'Security',
              title: 'App Transport Security disabled',
              message: 'NSAllowsArbitraryLoads is set to true.',
              recommendation: 'Enable ATS and add specific domain exceptions only.',
              autoFixable: false,
            });
          }
        } catch {
          // Ignore parsing errors
        }
        break;
      }
    }
  }

  return issues;
}

async function checkAndroidCompliance(projectDir: string): Promise<ComplianceIssue[]> {
  const issues: ComplianceIssue[] = [];
  const manifestPath = path.join(projectDir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

  if (await fs.pathExists(manifestPath)) {
    try {
      const content = await fs.readFile(manifestPath, 'utf-8');

      // Check for targetSdkVersion
      const targetSdkMatch = content.match(/targetSdkVersion\s*=\s*["']?(\d+)["']?/);
      if (targetSdkMatch) {
        const targetSdk = parseInt(targetSdkMatch[1], 10);
        const minRequiredSdk = 34;

        if (targetSdk < minRequiredSdk) {
          issues.push({
            id: 'android-old-target-sdk',
            severity: 'critical',
            category: 'Compatibility',
            title: 'Target SDK version too low',
            message: `Target SDK ${targetSdk} is below the required minimum.`,
            recommendation: `Update targetSdkVersion to at least ${minRequiredSdk}.`,
            autoFixable: true,
          });
        }
      }
    } catch {
      // Ignore parsing errors
    }
  }

  return issues;
}

async function checkCommonCompliance(projectDir: string): Promise<ComplianceIssue[]> {
  const issues: ComplianceIssue[] = [];

  // Check for privacy policy
  const commonPaths = ['PRIVACY.md', 'privacy-policy.md', 'docs/privacy.md'];
  let hasPrivacyPolicy = false;

  for (const policyPath of commonPaths) {
    if (await fs.pathExists(path.join(projectDir, policyPath))) {
      hasPrivacyPolicy = true;
      break;
    }
  }

  if (!hasPrivacyPolicy) {
    issues.push({
      id: 'common-no-privacy-policy',
      severity: 'high',
      category: 'Legal',
      title: 'Privacy policy not found',
      message: 'No privacy policy document found.',
      recommendation: 'Create a privacy policy and link it in your store listing.',
      autoFixable: false,
    });
  }

  return issues;
}

function groupIssuesByCategory(issues: ComplianceIssue[]): Record<string, ComplianceIssue[]> {
  const grouped: Record<string, ComplianceIssue[]> = {};

  for (const issue of issues) {
    if (!grouped[issue.category]) {
      grouped[issue.category] = [];
    }
    grouped[issue.category].push(issue);
  }

  return grouped;
}

function calculateCategoryScore(issues: ComplianceIssue[]): number {
  if (issues.length === 0) return 100;

  let deduction = 0;
  for (const issue of issues) {
    switch (issue.severity) {
      case 'critical':
        deduction += 30;
        break;
      case 'high':
        deduction += 20;
        break;
      case 'medium':
        deduction += 10;
        break;
      case 'low':
        deduction += 5;
        break;
      case 'info':
        deduction += 0;
        break;
    }
  }

  return Math.max(0, 100 - deduction);
}

function getCategoryWeight(category: string): number {
  const weights: Record<string, number> = {
    Privacy: 0.25,
    Security: 0.25,
    Legal: 0.2,
    Configuration: 0.15,
    Compatibility: 0.15,
  };

  return weights[category] || 0.1;
}

function calculateOverallScore(
  categories: Record<string, CategoryScore>,
  issues: ComplianceIssue[]
): number {
  if (Object.keys(categories).length === 0) {
    return 100;
  }

  let totalWeight = 0;
  let weightedScore = 0;

  for (const [, data] of Object.entries(categories)) {
    weightedScore += data.score * data.weight;
    totalWeight += data.weight;
  }

  if (totalWeight === 0) return 100;

  return Math.round(weightedScore / totalWeight);
}

function getGrade(score: number): string {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  return 'F';
}

function calculatePassLikelihood(score: number, issues: ComplianceIssue[]): number {
  let likelihood = score / 100;

  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  likelihood -= criticalCount * 0.15;

  const highCount = issues.filter((i) => i.severity === 'high').length;
  likelihood -= highCount * 0.05;

  return Math.max(0, Math.min(1, likelihood));
}

export default analyzeCompliance;
