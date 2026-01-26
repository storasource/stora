import { MobileUse, COMPLIANCE_PROMPT, ComplianceObserver, type TaskConfig } from 'mobile-use';
import { EvidenceCollector } from './evidence-collector';
import { SessionManager } from './session-manager';
import type {
  DynamicTestConfig,
  DynamicComplianceResult,
  ComplianceEvent,
  ObservationType,
  Severity,
} from '../types';

export type EventCallback = (event: ComplianceEvent) => void;

interface OrchestratorOptions {
  projectId: string;
  userId: string;
  bundleId: string;
  apiKey: string;
  config: DynamicTestConfig;
  onEvent?: EventCallback;
}

export class ComplianceOrchestrator {
  private mobileUse: MobileUse;
  private evidence: EvidenceCollector;
  private session: SessionManager;
  private onEvent?: EventCallback;
  private config: DynamicTestConfig;
  private bundleId: string;
  private observations: any[] = [];

  constructor(options: OrchestratorOptions) {
    this.mobileUse = new MobileUse(options.apiKey);
    this.evidence = new EvidenceCollector();
    this.session = new SessionManager();
    this.config = options.config;
    this.bundleId = options.bundleId;
    this.onEvent = options.onEvent;

    const testSession = this.session.createSession(
      options.projectId,
      options.userId,
      options.config
    );

    this.emitEvent({
      type: 'session_started',
      sessionId: testSession.id,
      timestamp: new Date(),
      data: {
        sessionId: testSession.id,
        config: options.config,
      },
    });
  }

  async run(): Promise<DynamicComplianceResult> {
    const currentSession = this.session.getSession();
    if (!currentSession) {
      throw new Error('No active session');
    }

    try {
      this.session.updateStatus('preparing');
      this.session.addLogEntry('Initializing Mobile-Use Agent...');

      this.session.updateStatus('exploring');
      this.session.addLogEntry('Starting app exploration');

      // Create a bridge observer to pipe MobileUse observations to Stora events
      const bridgeObserver = {
        onStep: async (step: any) => {
          const observations = await new ComplianceObserver().onStep(step);
          
          for (const obs of observations) {
            // Map MobileUse Observation to Stora Observation
            const storaObs = {
              id: `obs_${Date.now()}_${Math.random()}`,
              sessionId: currentSession.id,
              timestamp: new Date(obs.timestamp),
              type: 'compliance_violation' as ObservationType, // Simplified mapping
              severity: obs.severity as Severity || 'medium',
              title: obs.title,
              description: obs.description || '',
              evidenceIds: [], // Linked later
              confidence: 0.9
            };

            this.observations.push(storaObs);
            this.session.addObservation(storaObs);
            this.emitEvent({
              type: 'observation_detected',
              sessionId: currentSession.id,
              timestamp: new Date(),
              data: storaObs,
            });
            this.session.addLogEntry(`[${obs.severity}] ${obs.title}`);
          }

          // Emit progress
          const progress = Math.round((step.stepNumber / (this.config.maxSteps || 50)) * 100);
          this.session.updateProgress(progress);
          this.emitEvent({
            type: 'exploration_progress',
            sessionId: currentSession.id,
            timestamp: new Date(),
            data: {
              progress,
              screensExplored: step.stepNumber,
              currentScreen: 'App Screen',
              action: step.decision.action,
            },
          });

          return observations;
        }
      };

      const taskConfig: TaskConfig = {
        bundleId: this.bundleId,
        task: 'Audit the app for App Store compliance violations, specifically focusing on payment methods, ads, and content policy.',
        maxSteps: this.config.maxSteps || 50,
        // Map other config options
      };

      const result = await this.mobileUse.executeTask(taskConfig, {
        promptBuilder: COMPLIANCE_PROMPT,
        observers: [bridgeObserver]
      });

      this.session.updateStatus('analyzing');
      this.session.addLogEntry('Finalizing analysis and generating report');

      // Finalize session
      const allObservations = this.observations;
      const allEvidence = this.evidence.getAllEvidence();

      const finalResult: DynamicComplianceResult = {
        session: this.session.getSession()!,
        observations: allObservations,
        evidence: allEvidence,
        summary: this.generateSummary(allObservations, allEvidence),
      };

      this.emitEvent({
        type: 'session_completed',
        sessionId: currentSession.id,
        timestamp: new Date(),
        data: { result: finalResult },
      });

      return finalResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.session.updateStatus('failed', errorMessage);
      this.emitEvent({
        type: 'session_failed',
        sessionId: currentSession.id,
        timestamp: new Date(),
        data: { error: errorMessage, stage: 'execution' },
      });
      throw error;
    }
  }

  private generateSummary(
    observations: DynamicComplianceResult['observations'],
    evidence: DynamicComplianceResult['evidence']
  ): DynamicComplianceResult['summary'] {
    // Reuse existing logic or simplify
    return {
      totalScreensExplored: this.session.getSession()?.screensExplored || 0,
      totalDuration: 0,
      observationsByType: {
        compliance_violation: observations.length,
        ux_issue: 0,
        content_issue: 0,
        accessibility_issue: 0,
        performance_issue: 0,
      },
      observationsBySeverity: {
        critical: observations.filter(o => o.severity === 'critical').length,
        high: observations.filter(o => o.severity === 'high').length,
        medium: observations.filter(o => o.severity === 'medium').length,
        low: observations.filter(o => o.severity === 'low').length,
        info: observations.filter(o => o.severity === 'info').length,
      },
      topViolations: [],
      passLikelihood: 0.5,
      recommendedActions: ['Review violations'],
    };
  }

  private emitEvent(event: ComplianceEvent): void {
    if (this.onEvent) {
      this.onEvent(event);
    }
  }
}
