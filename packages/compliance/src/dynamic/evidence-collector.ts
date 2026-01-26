import type { ScreenshotEvidence, EvidenceCategory } from '../types';

export interface EvidenceUploadResult {
  url: string;
  evidenceId: string;
}

export class EvidenceCollector {
  private evidence: Map<string, ScreenshotEvidence> = new Map();

  async collectEvidence(
    screenshot: Buffer,
    context: {
      sessionId: string;
      screenName?: string;
      category: EvidenceCategory;
      caption?: string;
      observationIds: string[];
      device: {
        model: string;
        osVersion: string;
        orientation: 'portrait' | 'landscape';
      };
      width: number;
      height: number;
    }
  ): Promise<ScreenshotEvidence> {
    const evidenceId = `ev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const uploadResult = await this.uploadToBlob(screenshot, evidenceId);

    const evidence: ScreenshotEvidence = {
      id: evidenceId,
      sessionId: context.sessionId,
      url: uploadResult.url,
      timestamp: new Date(),
      category: context.category,
      screenName: context.screenName,
      caption: context.caption,
      observationIds: context.observationIds,
      width: context.width,
      height: context.height,
      device: context.device,
    };

    this.evidence.set(evidenceId, evidence);

    return evidence;
  }

  private async uploadToBlob(
    screenshot: Buffer,
    evidenceId: string
  ): Promise<{ url: string }> {
    return {
      url: `blob://temporary/${evidenceId}.png`,
    };
  }

  getEvidence(evidenceId: string): ScreenshotEvidence | undefined {
    return this.evidence.get(evidenceId);
  }

  getAllEvidence(): ScreenshotEvidence[] {
    return Array.from(this.evidence.values());
  }

  getEvidenceByCategory(category: EvidenceCategory): ScreenshotEvidence[] {
    return Array.from(this.evidence.values()).filter(
      (ev) => ev.category === category
    );
  }

  getEvidenceByObservation(observationId: string): ScreenshotEvidence[] {
    return Array.from(this.evidence.values()).filter((ev) =>
      ev.observationIds.includes(observationId)
    );
  }

  clear(): void {
    this.evidence.clear();
  }
}
