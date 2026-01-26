import { ScreenAnalyzer } from '../vision/screen-analyzer';
import type {
  ComplianceObservation,
  ScreenshotEvidence,
  EvidenceCategory,
} from '../types';
import type { AnalysisContext } from '../vision/screen-analyzer';

export interface ObserverResult {
  observations: ComplianceObservation[];
  evidence: Partial<ScreenshotEvidence>;
}

export class ComplianceObserver {
  private analyzer: ScreenAnalyzer;

  constructor(apiKey: string) {
    this.analyzer = new ScreenAnalyzer(apiKey);
  }

  async observe(
    screenshot: Buffer,
    context: {
      sessionId: string;
      evidenceId: string;
      screenName?: string;
      appCategory?: string;
      store: 'app_store' | 'play_store' | 'both';
      ageRating?: string;
      device: {
        model: string;
        osVersion: string;
        orientation: 'portrait' | 'landscape';
      };
      width: number;
      height: number;
    }
  ): Promise<ObserverResult> {
    const analysisContext: AnalysisContext = {
      sessionId: context.sessionId,
      evidenceId: context.evidenceId,
      screenName: context.screenName,
      appCategory: context.appCategory,
      store: context.store,
      ageRating: context.ageRating,
    };

    const result = await this.analyzer.analyzeScreen(screenshot, analysisContext);

    const evidence: Partial<ScreenshotEvidence> = {
      id: context.evidenceId,
      sessionId: context.sessionId,
      timestamp: new Date(),
      category: result.category,
      screenName: context.screenName,
      caption: result.caption,
      observationIds: result.observations.map((obs) => obs.id),
      width: context.width,
      height: context.height,
      device: context.device,
    };

    return {
      observations: result.observations,
      evidence,
    };
  }

  async batchObserve(
    screenshots: Array<{
      screenshot: Buffer;
      context: {
        sessionId: string;
        evidenceId: string;
        screenName?: string;
        appCategory?: string;
        store: 'app_store' | 'play_store' | 'both';
        ageRating?: string;
        device: {
          model: string;
          osVersion: string;
          orientation: 'portrait' | 'landscape';
        };
        width: number;
        height: number;
      };
    }>
  ): Promise<ObserverResult[]> {
    return Promise.all(
      screenshots.map(({ screenshot, context }) =>
        this.observe(screenshot, context)
      )
    );
  }
}
