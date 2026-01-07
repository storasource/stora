/**
 * @stora/compliance - Type definitions
 */

export type Platform = 'ios' | 'android' | 'both';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

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

export interface CategoryScore {
  /** Score for this category (0-100) */
  score: number;
  /** Weight of this category in overall score */
  weight: number;
  /** Number of issues in this category */
  issues: number;
}

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

export interface EnhancedComplianceResult extends ComplianceResult {
  /** AI-powered analysis results (if enabled) */
  aiAnalysis?: AIComplianceResult;
}

export interface ComplianceConfig {
  /** Target platform */
  platform: Platform;
  /** Strictness level */
  strictness?: 'strict' | 'balanced' | 'lenient';
  /** Enable AI-powered analysis */
  enableAI?: boolean;
}

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
