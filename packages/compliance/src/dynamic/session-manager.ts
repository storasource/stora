import type {
  TestSession,
  TestSessionStatus,
  DynamicTestConfig,
  ComplianceObservation,
  ScreenshotEvidence,
  Severity,
} from '../types';

export class SessionManager {
  private session: TestSession | null = null;

  createSession(
    projectId: string,
    userId: string,
    config: DynamicTestConfig
  ): TestSession {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.session = {
      id: sessionId,
      projectId,
      userId,
      config,
      status: 'pending',
      progress: 0,
      startedAt: new Date(),
      screensExplored: 0,
      observationsCount: 0,
      criticalCount: 0,
      highCount: 0,
      evidenceCount: 0,
    };

    return this.session;
  }

  getSession(): TestSession | null {
    return this.session;
  }

  updateStatus(status: TestSessionStatus, error?: string): void {
    if (!this.session) return;

    this.session.status = status;

    if (error) {
      this.session.error = error;
    }

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      this.session.endedAt = new Date();
    }
  }

  updateProgress(progress: number): void {
    if (!this.session) return;
    this.session.progress = Math.min(100, Math.max(0, progress));
  }

  incrementScreensExplored(): void {
    if (!this.session) return;
    this.session.screensExplored++;
  }

  addObservation(observation: ComplianceObservation): void {
    if (!this.session) return;

    this.session.observationsCount++;

    if (observation.severity === 'critical') {
      this.session.criticalCount++;
    } else if (observation.severity === 'high') {
      this.session.highCount++;
    }
  }

  addEvidence(): void {
    if (!this.session) return;
    this.session.evidenceCount++;
  }

  addLogEntry(message: string): void {
    if (!this.session) return;

    if (!this.session.log) {
      this.session.log = [];
    }

    const timestamp = new Date().toISOString();
    this.session.log.push(`[${timestamp}] ${message}`);

    if (this.session.log.length > 100) {
      this.session.log = this.session.log.slice(-100);
    }
  }

  calculateResult(
    observations: ComplianceObservation[]
  ): 'pass' | 'fail' | 'warning' {
    const criticalCount = observations.filter(
      (obs) => obs.severity === 'critical'
    ).length;
    const highCount = observations.filter(
      (obs) => obs.severity === 'high'
    ).length;

    if (criticalCount > 0) return 'fail';
    if (highCount > 2) return 'fail';
    if (highCount > 0) return 'warning';
    return 'pass';
  }

  calculateScore(observations: ComplianceObservation[]): number {
    let score = 100;

    for (const obs of observations) {
      switch (obs.severity) {
        case 'critical':
          score -= 20;
          break;
        case 'high':
          score -= 10;
          break;
        case 'medium':
          score -= 5;
          break;
        case 'low':
          score -= 2;
          break;
      }
    }

    return Math.max(0, score);
  }

  finalizeSession(
    observations: ComplianceObservation[],
    evidence: ScreenshotEvidence[]
  ): void {
    if (!this.session) return;

    this.session.result = this.calculateResult(observations);
    this.session.overallScore = this.calculateScore(observations);
    this.session.observationsCount = observations.length;
    this.session.evidenceCount = evidence.length;

    this.session.criticalCount = observations.filter(
      (obs) => obs.severity === 'critical'
    ).length;
    this.session.highCount = observations.filter(
      (obs) => obs.severity === 'high'
    ).length;

    this.updateStatus('completed');
    this.updateProgress(100);
  }
}
