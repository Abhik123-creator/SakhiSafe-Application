import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { Prisma } from '@prisma/client';
import { normalizePhone } from '../../common/utils/phone.util';
import { ImageAnalysisCaseNoteDto } from '../dto/image-analysis-case-note.dto';
import { CaseNotesRepository } from '../repositories/case-notes.repository';
import { IncidentConfidenceService } from './incident-confidence.service';
import { ImageAnalysisPayload, RawImageAnalysisPayload } from './image-analysis.types';
import { UploadedImageFile } from '../../evidence/services/uploaded-image-file';
import { MAX_IMAGE_EVIDENCE_BYTES } from '../../evidence/services/evidence.service';

@Injectable()
export class CaseNotesService {
  private readonly logger = new Logger(CaseNotesService.name);
  private readonly uploadRoot = resolve(process.cwd(), 'private', 'uploads', 'evidence');

  constructor(
    private readonly caseNotesRepository: CaseNotesRepository,
    private readonly incidentConfidenceService: IncidentConfidenceService,
  ) {}

  async createImageAnalysis(dto: ImageAnalysisCaseNoteDto, file?: UploadedImageFile) {
    this.validateImageFile(file);
    const analysis = this.parseAndValidateAnalysis(dto.aiAnalysisJson);
    const aiSummary = this.resolveAiSummary(dto, analysis);
    const aiConfidence = Number(dto.aiConfidence);
    if (!Number.isFinite(aiConfidence) || aiConfidence < 0 || aiConfidence > 1) {
      throw new BadRequestException('aiConfidence must be between 0 and 1');
    }

    const normalizedPhone = normalizePhone(dto.careSeekerPhone);
    if (!normalizedPhone) {
      throw new BadRequestException('careSeekerPhone is required');
    }

    const careSeeker =
      (await this.caseNotesRepository.findCareSeekerByPhone(normalizedPhone)) ??
      (await this.caseNotesRepository.createCareSeeker(normalizedPhone));

    const session = await this.findOrCreateSession(careSeeker.id, dto.sessionId);
    const incident = await this.findOrCreateIncident(careSeeker.id, session.id, dto.incidentId);
    const caseRecord = await this.findOrCreateCase(careSeeker.id, dto.caseId);
    const sha256Hash = createHash('sha256').update(file.buffer).digest('hex');

    if (dto.whatsappMessageId) {
      const existingEvidence = await this.caseNotesRepository.findEvidenceByWhatsappMessage(dto.whatsappMessageId);
      if (existingEvidence && existingEvidence.sha256Hash === sha256Hash) {
        const existingNote = await this.caseNotesRepository.findNote(incident.id, caseRecord.id);
        return {
          caseNoteId: existingNote?.id,
          incidentId: incident.id,
          caseId: caseRecord.id,
          evidenceId: existingEvidence.id,
          careSeekerId: careSeeker.id,
          sessionId: session.id,
          aiAnalysisSaved: true,
        };
      }
    }

    const storedFile = await this.storeFile(file);
    const evidence = await this.caseNotesRepository.createEvidence({
      careSeeker: { connect: { id: careSeeker.id } },
      session: { connect: { id: session.id } },
      incident: { connect: { id: incident.id } },
      case: { connect: { id: caseRecord.id } },
      source: this.normalizeEvidenceSource(dto.source),
      evidenceType: 'IMAGE',
      originalFileName: basename(file.originalname || 'image'),
      storedFileName: storedFile.storedFileName,
      storagePath: storedFile.storagePath,
      mimeType: file.mimetype,
      fileSize: file.size,
      sha256Hash,
      whatsappMessageId: dto.whatsappMessageId,
      whatsappMediaId: dto.whatsappMediaId,
      aiAnalysisStatus: 'COMPLETED',
      aiAnalysisJson: analysis as unknown as Prisma.InputJsonValue,
      aiConfidence,
      aiSummary,
      caption: dto.caption ?? dto.survivorFriendlySummary ?? analysis.survivorFriendlySummary ?? aiSummary,
      description: dto.description?.trim() || aiSummary,
      uploadedBy: 'AI_SERVICE',
      status: 'ACTIVE',
    });

    await this.caseNotesRepository.createImageMessage({
      session: { connect: { id: session.id } },
      evidence: { connect: { id: evidence.id } },
      direction: 'INBOUND',
      messageType: 'IMAGE',
      messageText: dto.caption ?? aiSummary,
      mediaId: dto.whatsappMediaId,
      rawPayload: {
        whatsappMessageId: dto.whatsappMessageId,
        whatsappMediaId: dto.whatsappMediaId,
      },
    });
    await this.caseNotesRepository.touchSession(session.id);

    const existingNote = await this.caseNotesRepository.findNote(incident.id, caseRecord.id);
    const existingNoteText = existingNote?.noteText ?? caseRecord.notes ?? '';
    const hasTextDisclosure = Boolean(existingNoteText.trim());
    const finalConfidence = this.incidentConfidenceService.calculateFinalConfidence(analysis, hasTextDisclosure);
    await this.caseNotesRepository.updateIncidentConfidence(incident.id, finalConfidence);
    await this.caseNotesRepository.updateCaseConfidence(caseRecord.id, finalConfidence);

    this.logger.log(
      `[MEDIA_IMAGE_ANALYSIS_SAVED] evidenceId=${evidence.id} incidentId=${incident.id} caseId=${caseRecord.id}`,
    );

    return {
      caseNoteId: existingNote?.id,
      incidentId: incident.id,
      caseId: caseRecord.id,
      evidenceId: evidence.id,
      careSeekerId: careSeeker.id,
      sessionId: session.id,
      aiAnalysisSaved: true,
      mediaObservationSaved: true,
    };
  }

  private async findOrCreateSession(careSeekerId: string, sessionId?: string) {
    if (sessionId) {
      const session = await this.caseNotesRepository.findSession(sessionId, careSeekerId);
      if (!session) {
        throw new BadRequestException(`Conversation session ${sessionId} does not belong to care seeker`);
      }
      return session;
    }

    const existing = await this.caseNotesRepository.findActiveSession(careSeekerId);
    return existing ?? this.caseNotesRepository.createSession(careSeekerId);
  }

  private async findOrCreateIncident(careSeekerId: string, sessionId: string, incidentId?: string) {
    if (incidentId) {
      const incident = await this.caseNotesRepository.findIncident(incidentId, careSeekerId);
      if (!incident) {
        throw new BadRequestException(`Incident ${incidentId} does not belong to care seeker`);
      }
      return incident;
    }

    const existing = await this.caseNotesRepository.findActiveIncidentBySession(sessionId);
    return existing ?? this.caseNotesRepository.createDraftIncident(careSeekerId, sessionId);
  }

  private async findOrCreateCase(careSeekerId: string, caseId?: string) {
    if (caseId) {
      const caseRecord = await this.caseNotesRepository.findCase(caseId, careSeekerId);
      if (!caseRecord) {
        throw new BadRequestException(`Case ${caseId} does not belong to care seeker`);
      }
      return caseRecord;
    }

    const existing = await this.caseNotesRepository.findOpenCaseByCareSeeker(careSeekerId);
    return existing ?? this.caseNotesRepository.createDraftCase(careSeekerId);
  }

  private async storeFile(file: UploadedImageFile) {
    const now = new Date();
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const extension = this.extensionFor(file.mimetype, file.originalname);
    const storedFileName = `${randomUUID()}${extension}`;
    const storageDirectory = join(this.uploadRoot, year, month);
    const storagePath = join(storageDirectory, storedFileName);
    await mkdir(storageDirectory, { recursive: true });
    await writeFile(storagePath, file.buffer);
    return { storedFileName, storagePath };
  }

  private validateImageFile(file?: UploadedImageFile): asserts file is UploadedImageFile {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }
    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }
    if (file.size > MAX_IMAGE_EVIDENCE_BYTES) {
      throw new BadRequestException('Image file must be 5MB or smaller');
    }
  }

  private parseAndValidateAnalysis(raw: string): ImageAnalysisPayload {
    let analysis: ImageAnalysisPayload;
    try {
      analysis = this.normalizeAnalysisPayload(JSON.parse(raw) as RawImageAnalysisPayload);
    } catch {
      throw new BadRequestException('aiAnalysisJson must be valid JSON');
    }

    if (!['poor', 'fair', 'good'].includes(analysis.imageQuality)) {
      throw new BadRequestException('imageQuality must be poor, fair, or good');
    }
    if (!['low', 'medium', 'high', 'unknown'].includes(analysis.severityEstimate)) {
      throw new BadRequestException('severityEstimate must be low, medium, high, or unknown');
    }
    if (!Number.isFinite(analysis.confidence) || analysis.confidence < 0 || analysis.confidence > 1) {
      throw new BadRequestException('analysis confidence must be between 0 and 1');
    }
    if (!analysis.professionalCaseNoteDescription?.trim()) {
      throw new BadRequestException('professionalCaseNoteDescription is required');
    }

    analysis.possibleVisibleIndicators ??= [];
    analysis.possibleInjuryTypes ??= [];
    return analysis;
  }

  private normalizeAnalysisPayload(raw: RawImageAnalysisPayload): ImageAnalysisPayload {
    const possibleVisibleIndicators = this.stringArray(
      raw.possibleVisibleIndicators ?? raw.visibleIndicators ?? raw.riskIndicators ?? raw.observedSigns,
    );
    const possibleInjuryTypes = this.stringArray(raw.possibleInjuryTypes ?? raw.injuryTypes ?? raw.possibleFindings);
    const professionalCaseNoteDescription =
      this.firstText(
      raw.professionalCaseNoteDescription,
      raw.professionalSummary,
      raw.imageSummary,
      raw.summary,
      raw.aiSummary,
      raw.description,
      raw.observation,
      raw.nonMedicalDescription,
      ) ?? '';
    const imageQuality = this.enumValue(raw.imageQuality ?? raw.quality, ['poor', 'fair', 'good'], 'fair');
    const severityEstimate = this.enumValue(
      raw.severityEstimate ?? raw.severity ?? raw.riskLevel,
      ['low', 'medium', 'high', 'unknown'],
      'unknown',
    );
    const confidence = this.numberValue(raw.confidence ?? raw.aiConfidence, 0.5);

    return {
      ...raw,
      visibleInjuryPresent: Boolean(
        raw.visibleInjuryPresent ?? raw.visibleInjury ?? raw.injuryDetected ?? possibleInjuryTypes.length,
      ),
      imageQuality,
      bodyPartVisible: this.firstText(raw.bodyPartVisible, raw.bodyPart, raw.visibleArea) || null,
      possibleVisibleIndicators,
      possibleInjuryTypes,
      severityEstimate,
      confidence,
      urgentCareRecommended: Boolean(raw.urgentCareRecommended ?? raw.needsUrgentCare ?? raw.urgent),
      professionalCaseNoteDescription,
      survivorFriendlySummary: this.firstText(raw.survivorFriendlySummary, raw.userFriendlySummary, raw.friendlySummary),
      recommendedFollowUpQuestions: this.stringArray(raw.recommendedFollowUpQuestions ?? raw.followUpQuestions),
      limitations: this.stringArray(raw.limitations),
      concerningSigns: this.stringArray(raw.concerningSigns),
    };
  }

  private resolveAiSummary(dto: ImageAnalysisCaseNoteDto, analysis: ImageAnalysisPayload) {
    return (
      dto.aiSummary?.trim() ||
      analysis.survivorFriendlySummary?.trim() ||
      analysis.nonMedicalDescription?.trim() ||
      analysis.professionalCaseNoteDescription.trim()
    );
  }

  private firstText(...values: unknown[]) {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return undefined;
  }

  private stringArray(value: unknown) {
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim());
    }
    if (typeof value === 'string' && value.trim()) {
      return [value.trim()];
    }
    return [];
  }

  private enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T) {
    if (typeof value !== 'string') {
      return fallback;
    }
    const normalized = value.toLowerCase();
    return allowed.includes(normalized as T) ? (normalized as T) : fallback;
  }

  private numberValue(value: unknown, fallback: number) {
    const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    return Number.isFinite(numberValue) ? numberValue : fallback;
  }

  private formatImageObservation(analysis: ImageAnalysisPayload, confidence: number) {
    const indicators = analysis.possibleVisibleIndicators.length
      ? analysis.possibleVisibleIndicators.join(', ')
      : 'unknown';
    const base = `AI Image Observation:
${analysis.professionalCaseNoteDescription}

Visual Analysis Details:
- Image quality: ${analysis.imageQuality}
- Broad visible area: ${analysis.bodyPartVisible || 'unknown'}
- Possible visible indicators: ${indicators}
- Severity estimate: ${analysis.severityEstimate}
- AI confidence: ${confidence}

Limitations:
- This is not a medical diagnosis.
- This is not a legal conclusion.
- The image alone cannot confirm cause.
- Image quality may limit certainty.`;

    if (!analysis.urgentCareRecommended) {
      return base;
    }

    return `${base}

Urgent Attention Note:
Visible signs or provided context may require urgent medical attention. The care seeker should be asked whether they are in severe pain, bleeding, or immediate danger.`;
  }

  private normalizeEvidenceSource(source?: string) {
    const normalized = source?.trim().toUpperCase();
    if (normalized === 'WEB') return 'WEB';
    if (normalized === 'ADMIN' || normalized === 'ADMIN_UPLOAD') return 'ADMIN_UPLOAD';
    if (normalized === 'AI_SERVICE') return 'AI_SERVICE';
    return 'WHATSAPP';
  }

  private extensionFor(mimeType: string, originalFileName: string) {
    const extension = extname(originalFileName).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(extension)) {
      return extension;
    }
    if (mimeType === 'image/png') return '.png';
    if (mimeType === 'image/webp') return '.webp';
    return '.jpg';
  }
}
