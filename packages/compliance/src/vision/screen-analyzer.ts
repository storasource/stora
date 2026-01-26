import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  buildCompliancePrompt,
  buildCategorizationPrompt,
  SCREEN_CAPTION_PROMPT,
} from './prompts';
import type {
  ComplianceObservation,
  EvidenceCategory,
  Severity,
} from '../types';

export interface ScreenAnalysisResult {
  observations: ComplianceObservation[];
  caption: string;
  category: EvidenceCategory;
  confidence: number;
}

export interface AnalysisContext {
  sessionId: string;
  evidenceId: string;
  screenName?: string;
  appCategory?: string;
  store: 'app_store' | 'play_store' | 'both';
  ageRating?: string;
}

export class ScreenAnalyzer {
  private genAI: GoogleGenerativeAI;
  private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  }

  async analyzeScreen(
    imageData: Buffer | string,
    context: AnalysisContext
  ): Promise<ScreenAnalysisResult> {
    const imageBase64 =
      typeof imageData === 'string' ? imageData : imageData.toString('base64');

    const [complianceResult, captionResult, categoryResult] = await Promise.all([
      this.analyzeCompliance(imageBase64, context),
      this.generateCaption(imageBase64),
      this.categorizeEvidence(imageBase64, context.screenName),
    ]);

    const observations: ComplianceObservation[] = complianceResult.observations.map((obs) => ({
      id: `obs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: context.sessionId,
      timestamp: new Date(),
      type: obs.type,
      severity: obs.severity,
      policyId: obs.policyId,
      title: obs.title,
      description: obs.description,
      recommendation: obs.recommendation,
      confidence: obs.confidence,
      evidenceIds: [context.evidenceId],
      screenName: context.screenName,
    }));

    return {
      observations,
      caption: captionResult,
      category: categoryResult,
      confidence: this.calculateOverallConfidence(observations),
    };
  }

  private async analyzeCompliance(
    imageBase64: string,
    context: AnalysisContext
  ): Promise<{
    observations: Array<{
      type: 'compliance_violation';
      severity: Severity;
      policyId: string;
      title: string;
      description: string;
      recommendation?: string;
      confidence: number;
    }>;
  }> {
    const prompt = buildCompliancePrompt({
      screenName: context.screenName,
      category: context.appCategory,
      store: context.store,
      ageRating: context.ageRating,
    });

    try {
      const result = await this.model.generateContent([
        {
          inlineData: {
            mimeType: 'image/png',
            data: imageBase64,
          },
        },
        { text: prompt },
      ]);

      const response = result.response;
      const text = response.text();

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return { observations: [] };
      }

      const parsed = JSON.parse(jsonMatch[0]);

      const observations = Array.isArray(parsed)
        ? parsed.map((obs) => ({
            type: 'compliance_violation' as const,
            severity: obs.severity as Severity,
            policyId: obs.policyId as string,
            title: obs.title as string,
            description: obs.description as string,
            recommendation: obs.recommendation as string | undefined,
            confidence: (obs.confidence as number) || 50,
          }))
        : [];

      return { observations };
    } catch (error) {
      console.error('Compliance analysis failed:', error);
      return { observations: [] };
    }
  }

  private async generateCaption(imageBase64: string): Promise<string> {
    try {
      const result = await this.model.generateContent([
        {
          inlineData: {
            mimeType: 'image/png',
            data: imageBase64,
          },
        },
        { text: SCREEN_CAPTION_PROMPT },
      ]);

      return result.response.text().trim();
    } catch (error) {
      console.error('Caption generation failed:', error);
      return 'Screenshot captured';
    }
  }

  private async categorizeEvidence(
    imageBase64: string,
    screenName?: string
  ): Promise<EvidenceCategory> {
    const prompt = buildCategorizationPrompt(screenName);

    try {
      const result = await this.model.generateContent([
        {
          inlineData: {
            mimeType: 'image/png',
            data: imageBase64,
          },
        },
        { text: prompt },
      ]);

      const category = result.response.text().trim().toLowerCase();

      const validCategories: EvidenceCategory[] = [
        'onboarding',
        'authentication',
        'permissions',
        'commerce',
        'content',
        'navigation',
        'error_state',
        'other',
      ];

      return validCategories.includes(category as EvidenceCategory)
        ? (category as EvidenceCategory)
        : 'other';
    } catch (error) {
      console.error('Evidence categorization failed:', error);
      return 'other';
    }
  }

  private calculateOverallConfidence(
    observations: ComplianceObservation[]
  ): number {
    if (observations.length === 0) return 100;

    const sum = observations.reduce((acc, obs) => acc + obs.confidence, 0);
    return Math.round(sum / observations.length);
  }

  async batchAnalyze(
    screenshots: Array<{ imageData: Buffer | string; context: AnalysisContext }>
  ): Promise<ScreenAnalysisResult[]> {
    const batchSize = 5;
    const results: ScreenAnalysisResult[] = [];

    for (let i = 0; i < screenshots.length; i += batchSize) {
      const batch = screenshots.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(({ imageData, context }) =>
          this.analyzeScreen(imageData, context)
        )
      );
      results.push(...batchResults);
    }

    return results;
  }
}
