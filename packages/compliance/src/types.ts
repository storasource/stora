/**
 * @stora-sh/compliance - Type definitions
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

// ============================================================================
// Dynamic Compliance Testing Types
// ============================================================================

export type ExplorationDepth = 'quick' | 'standard' | 'thorough' | 'exhaustive';

export type TestSessionStatus =
  | 'pending'
  | 'preparing'
  | 'exploring'
  | 'analyzing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ObservationType =
  | 'compliance_violation'
  | 'ux_issue'
  | 'content_issue'
  | 'accessibility_issue'
  | 'performance_issue';

export type EvidenceCategory =
  | 'onboarding'
  | 'authentication'
  | 'permissions'
  | 'commerce'
  | 'content'
  | 'navigation'
  | 'error_state'
  | 'other';

export interface DynamicTestConfig {
  /** Exploration depth/duration */
  depth: ExplorationDepth;
  /** Target platform */
  platform: 'ios' | 'android';
  /** Store policies to check */
  policies: ('app_store' | 'play_store')[];
  /** Simulator/device configuration */
  simulatorConfig: {
    deviceModel: string;
    osVersion: string;
    locale?: string;
    accessibility?: boolean;
  };
  /** Max test duration in minutes */
  maxDuration?: number;
  /** Max number of screens to explore */
  maxSteps?: number;
  /** Focus areas for exploration */
  focusAreas?: string[];
}

export interface ComplianceObservation {
  /** Unique observation ID */
  id: string;
  /** Session ID this belongs to */
  sessionId: string;
  /** Timestamp of observation */
  timestamp: Date;
  /** Type of observation */
  type: ObservationType;
  /** Severity level */
  severity: Severity;
  /** Store policy violated (if applicable) */
  policyId?: string;
  /** Title of the issue */
  title: string;
  /** Detailed description */
  description: string;
  /** Evidence screenshot IDs */
  evidenceIds: string[];
  /** Recommended action */
  recommendation?: string;
  /** Confidence score from AI analysis (0-100) */
  confidence: number;
  /** Screen/view where detected */
  screenName?: string;
}

export interface ScreenshotEvidence {
  /** Unique evidence ID */
  id: string;
  /** Session ID this belongs to */
  sessionId: string;
  /** Screenshot URL (Vercel Blob) */
  url: string;
  /** Timestamp captured */
  timestamp: Date;
  /** Evidence category */
  category: EvidenceCategory;
  /** Screen/view name */
  screenName?: string;
  /** AI-generated caption */
  caption?: string;
  /** Related observation IDs */
  observationIds: string[];
  /** Dimensions */
  width: number;
  height: number;
  /** Device info */
  device: {
    model: string;
    osVersion: string;
    orientation: 'portrait' | 'landscape';
  };
}

export interface TestSession {
  /** Unique session ID */
  id: string;
  /** Project/build ID */
  projectId: string;
  /** User ID who initiated */
  userId: string;
  /** Test configuration */
  config: DynamicTestConfig;
  /** Current status */
  status: TestSessionStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** Started timestamp */
  startedAt: Date;
  /** Completed/failed timestamp */
  endedAt?: Date;
  /** Total screens explored */
  screensExplored: number;
  /** Total observations found */
  observationsCount: number;
  /** Critical observations count */
  criticalCount: number;
  /** High severity observations count */
  highCount: number;
  /** Evidence screenshots collected */
  evidenceCount: number;
  /** Overall compliance score (0-100) */
  overallScore?: number;
  /** Pass/fail result */
  result?: 'pass' | 'fail' | 'warning';
  /** Error message if failed */
  error?: string;
  /** Exploration log (truncated) */
  log?: string[];
}

export interface DynamicComplianceResult {
  /** Test session details */
  session: TestSession;
  /** All observations found */
  observations: ComplianceObservation[];
  /** All evidence collected */
  evidence: ScreenshotEvidence[];
  /** Summary statistics */
  summary: {
    totalScreensExplored: number;
    totalDuration: number;
    observationsByType: Record<ObservationType, number>;
    observationsBySeverity: Record<Severity, number>;
    topViolations: Array<{
      policyId: string;
      count: number;
      severity: Severity;
    }>;
    passLikelihood: number;
    recommendedActions: string[];
  };
}

// ============================================================================
// Real-time Event Types (for SSE streaming)
// ============================================================================

export type ComplianceEventType =
  | 'session_started'
  | 'exploration_progress'
  | 'screen_captured'
  | 'observation_detected'
  | 'analysis_progress'
  | 'session_completed'
  | 'session_failed'
  | 'error';

export interface ComplianceEvent {
  type: ComplianceEventType;
  sessionId: string;
  timestamp: Date;
  data: unknown;
}

export interface SessionStartedEvent extends ComplianceEvent {
  type: 'session_started';
  data: {
    sessionId: string;
    config: DynamicTestConfig;
  };
}

export interface ExplorationProgressEvent extends ComplianceEvent {
  type: 'exploration_progress';
  data: {
    progress: number;
    screensExplored: number;
    currentScreen: string;
    action: string;
  };
}

export interface ScreenCapturedEvent extends ComplianceEvent {
  type: 'screen_captured';
  data: {
    evidenceId: string;
    screenName: string;
    category: EvidenceCategory;
    url: string;
  };
}

export interface ObservationDetectedEvent extends ComplianceEvent {
  type: 'observation_detected';
  data: ComplianceObservation;
}

export interface AnalysisProgressEvent extends ComplianceEvent {
  type: 'analysis_progress';
  data: {
    stage: string;
    progress: number;
    message: string;
  };
}

export interface SessionCompletedEvent extends ComplianceEvent {
  type: 'session_completed';
  data: {
    result: DynamicComplianceResult;
  };
}

export interface SessionFailedEvent extends ComplianceEvent {
  type: 'session_failed';
  data: {
    error: string;
    stage: string;
  };
}
