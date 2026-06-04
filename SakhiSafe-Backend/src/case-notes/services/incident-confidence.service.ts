import { Injectable } from '@nestjs/common';
import { ImageAnalysisPayload } from './image-analysis.types';

@Injectable()
export class IncidentConfidenceService {
  calculateImageEvidenceScore(analysis: ImageAnalysisPayload) {
    let score = 0;

    if (analysis.visibleInjuryPresent) score += 0.25;

    const meaningfulTypes = (analysis.possibleInjuryTypes ?? []).filter(
      (type) => type && type.toLowerCase() !== 'unclear',
    );
    if (meaningfulTypes.length > 0) score += 0.2;

    if (analysis.severityEstimate === 'medium') score += 0.2;
    if (analysis.severityEstimate === 'high') score += 0.35;

    if (analysis.urgentCareRecommended) score += 0.15;

    if (analysis.imageQuality === 'poor') score -= 0.2;
    if (analysis.confidence < 0.5) score -= 0.1;

    return Math.max(0, Math.min(1, score));
  }

  calculateFinalConfidence(analysis: ImageAnalysisPayload, hasTextDisclosure: boolean) {
    const textDisclosureScore = hasTextDisclosure ? 0.6 : 0;
    const imageEvidenceScore = this.calculateImageEvidenceScore(analysis);
    const repeatedPatternScore = 0;
    const urgencyScore = analysis.urgentCareRecommended ? 0.8 : 0;

    const finalConfidence =
      textDisclosureScore * 0.45 + imageEvidenceScore * 0.3 + repeatedPatternScore * 0.15 + urgencyScore * 0.1;

    return Math.max(0, Math.min(hasTextDisclosure ? 1 : 0.55, finalConfidence));
  }
}
