import type { ComplianceObservation } from '../types';

export interface ContentIssue {
  type:
    | 'inappropriate_content'
    | 'misleading_information'
    | 'placeholder_content'
    | 'broken_images'
    | 'spelling_errors';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
}

export class ContentObserver {
  async observe(
    screenshot: Buffer,
    context: {
      sessionId: string;
      evidenceId: string;
      screenName?: string;
      ageRating?: string;
    }
  ): Promise<ComplianceObservation[]> {
    return [];
  }
}
