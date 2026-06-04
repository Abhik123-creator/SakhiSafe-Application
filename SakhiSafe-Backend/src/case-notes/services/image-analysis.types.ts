export interface ImageAnalysisPayload {
  visibleInjuryPresent: boolean;
  imageQuality: 'poor' | 'fair' | 'good';
  bodyPartVisible: string | null;
  possibleVisibleIndicators: string[];
  possibleInjuryTypes: string[];
  colorAndPatternObservation?: string;
  shapeSizeAndDistributionObservation?: string;
  surfaceConditionObservation?: string;
  severityEstimate: 'low' | 'medium' | 'high' | 'unknown';
  confidence: number;
  concerningSigns?: string[];
  urgentCareRecommended: boolean;
  nonMedicalDescription?: string;
  professionalCaseNoteDescription: string;
  survivorFriendlySummary?: string;
  recommendedFollowUpQuestions?: string[];
  limitations?: string[];
  safetyDisclaimer?: string;
}

export type RawImageAnalysisPayload = Partial<ImageAnalysisPayload> &
  Record<string, unknown>;
