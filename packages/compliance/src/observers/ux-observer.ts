import type { ComplianceObservation } from '../types';

export interface UXIssue {
  type:
    | 'confusing_navigation'
    | 'poor_contrast'
    | 'small_tap_targets'
    | 'inconsistent_design'
    | 'cluttered_layout'
    | 'unclear_labels';
  severity: 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
}

export class UXObserver {
  async observe(
    screenshot: Buffer,
    context: {
      sessionId: string;
      evidenceId: string;
      screenName?: string;
    }
  ): Promise<ComplianceObservation[]> {
    return [];
  }
}
