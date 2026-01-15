/**
 * @stora-sh/compliance - Type definitions
 */

/**
 * Target platform for compliance checking.
 *
 * Specifies which app store guidelines to validate against. Use 'both'
 * to check against iOS App Store and Google Play Store simultaneously.
 */
export type Platform = 'ios' | 'android' | 'both';

/**
 * Severity level for compliance issues.
 *
 * Indicates the impact of an issue on app store approval likelihood:
 * - `critical`: Likely to cause rejection
 * - `high`: Serious issue that should be fixed
 * - `medium`: Recommended to address before submission
 * - `low`: Minor improvement suggested
 * - `info`: Informational note, no action required
 */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Represents a single compliance issue detected in the app.
 *
 * Contains details about the issue including its severity, category,
 * a human-readable description, and an optional recommendation for how
 * to resolve it.
 */
export interface ComplianceIssue {
  /** Unique identifier for the issue */
  id: string;
  /** Severity level */
  severity: Severity;
  /** Category (Privacy, Security, Legal, etc.) */
  category: string;
  /** Short title */
  title: string;
  /** Detailed message */
  message: string;
  /** Recommended fix */
  recommendation?: string;
  /** Whether this can be auto-fixed */
  autoFixable?: boolean;
}

/**
 * Score metrics for a compliance category.
 *
 * Represents the compliance score for a specific category such as Privacy,
 * Security, or Legal. The [weight] determines how much this category
 * contributes to the overall compliance score.
 */
export interface CategoryScore {
  /** Score for this category (0-100) */
  score: number;
  /** Weight of this category in overall score */
  weight: number;
  /** Number of issues in this category */
  issues: number;
}

/**
 * Contains the results of a compliance analysis.
 *
 * Returned by [analyzeCompliance] after scanning the app project.
 * Includes an overall score, letter grade, detailed issues list,
 * and per-category breakdowns.
 *
 * @example
 * ```typescript
 * const result = await analyzeCompliance(projectDir, options);
 * console.log(`Score: ${result.score}/100 (${result.grade})`);
 * console.log(`Issues: ${result.issues.length}`);
 * ```
 */
export interface ComplianceResult {
  /** Overall compliance score (0-100) */
  score: number;
  /** Letter grade (A+, A, B+, etc.) */
  grade: string;
  /** Estimated likelihood of passing review (0-1) */
  passLikelihood: number;
  /** List of compliance issues */
  issues: ComplianceIssue[];
  /** Scores by category */
  categories: Record<string, CategoryScore>;
}

/**
 * Contains results from AI-powered compliance analysis.
 *
 * Returned when AI analysis is enabled. Includes issues discovered by
 * the AI that rule-based checks may have missed, refined recommendations
 * for existing issues, and a prioritized action plan.
 */
export interface AIComplianceResult {
  /** New issues discovered by AI */
  discoveredIssues: ComplianceIssue[];
  /** Refined recommendations for existing issues */
  refinedIssues: Array<{
    originalId: string;
    newSeverity?: Severity;
    refinedRecommendation?: string;
    additionalContext?: string;
  }>;
  /** Overall assessment summary */
  overallAssessment: string;
  /** Prioritized list of actions */
  prioritizedActions: Array<{
    priority: number;
    action: string;
    impact: 'high' | 'medium' | 'low';
    effort: 'high' | 'medium' | 'low';
    relatedIssueIds: string[];
  }>;
  /** Estimated likelihood of first-submission approval (0-100) */
  estimatedApprovalLikelihood: number;
  /** Tokens used for this analysis */
  tokensUsed?: number;
}

/**
 * Extended compliance result with optional AI analysis.
 *
 * Combines the standard [ComplianceResult] with additional insights
 * from AI-powered analysis when enabled. This is the primary return
 * type from [analyzeCompliance].
 */
export interface EnhancedComplianceResult extends ComplianceResult {
  /** AI-powered analysis results (if enabled) */
  aiAnalysis?: AIComplianceResult;
}

/**
 * Configuration options for compliance analysis.
 *
 * Controls the target platform, strictness level of checks, and whether
 * to enable AI-powered analysis for deeper insights.
 */
export interface ComplianceConfig {
  /** Target platform */
  platform: Platform;
  /** Strictness level */
  strictness?: 'strict' | 'balanced' | 'lenient';
  /** Enable AI-powered analysis */
  enableAI?: boolean;
}

/**
 * Context information passed to the AI evaluator.
 *
 * Contains comprehensive app metadata, detected characteristics, permissions,
 * third-party SDKs, and configuration snippets for AI-powered analysis.
 * Built using [buildEvaluationContext] from app info and scan results.
 */
export interface ComplianceEvaluationContext {
  appName: string;
  version: string;
  framework: string;
  bundleId?: string;
  packageName?: string;
  platforms: ('ios' | 'android')[];
  inferredAgeRating?: string;
  isKidsApp?: boolean;
  permissions: { ios?: string[]; android?: string[] };
  thirdPartySDKs?: string[];
  hasPrivacyPolicy?: boolean;
  privacyPolicyUrl?: string;
  hasAds?: boolean;
  hasInAppPurchases?: boolean;
  hasSubscriptions?: boolean;
  existingIssues: Array<{
    id: string;
    severity: Severity;
    category: string;
    title: string;
    description: string;
    recommendation?: string;
  }>;
  configSnippets?: {
    infoPlist?: string;
    androidManifest?: string;
    pubspec?: string;
    privacyManifest?: string;
  };
}
