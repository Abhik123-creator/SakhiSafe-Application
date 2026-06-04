import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  IncidentCategory,
  IncidentSeverity,
  IncidentSource,
  IncidentStatus,
  IncidentUrgency,
  Prisma,
} from '@prisma/client';
import { AiUpsertIncidentDto } from '../dto/ai-upsert-incident.dto';
import { EnsureDraftIncidentDto } from '../dto/ensure-draft-incident.dto';
import { IncidentLlmOutputDto } from '../dto/incident-llm-output.dto';
import { ListIncidentsDto } from '../dto/list-incidents.dto';
import { UpdateIncidentDto } from '../dto/update-incident.dto';
import { IncidentsRepository } from '../repositories/incidents.repository';

type AiIncidentPayload = {
  source: IncidentSource;
  title?: string;
  summary?: string;
  description?: string;
  category?: IncidentCategory;
  severity?: IncidentSeverity;
  urgency?: IncidentUrgency;
  incidentDateText?: string;
  locationText?: string;
  perpetratorRelation?: string;
  status?: IncidentStatus;
  riskSignals?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  missingFields?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  needsHumanReview: boolean;
  aiGenerated: boolean;
  aiConfidence?: number;
  caseNote?: string;
};

@Injectable()
export class IncidentsService {
  private readonly logger = new Logger(IncidentsService.name);

  constructor(private readonly incidentsRepository: IncidentsRepository) {}

  async aiUpsert(dto: AiUpsertIncidentDto) {
    await this.ensureCareSeekerAndSession(dto.careSeekerId, dto.sessionId);

    const existing = await this.incidentsRepository.findOpenBySession(dto.sessionId);
    const data = this.toIncidentData(dto, existing?.manuallyEdited ?? false);

    if (existing) {
      this.logger.log(`Updating AI incident ${existing.id} for session ${dto.sessionId}`);
      return this.incidentsRepository.update(existing.id, data);
    }

    this.logger.log(`Creating AI incident for session ${dto.sessionId}`);
    return this.incidentsRepository.create({
      ...data,
      title: data.title ?? 'AI incident intake',
      careSeeker: { connect: { id: dto.careSeekerId } },
      session: { connect: { id: dto.sessionId } },
    });
  }

  async findActiveBySession(sessionId: string) {
    const incident = await this.incidentsRepository.findActiveBySession(sessionId);
    if (!incident) {
      throw new NotFoundException();
    }
    return incident;
  }

  async ensureDraftForSession(dto: EnsureDraftIncidentDto) {
    await this.ensureCareSeekerAndSession(dto.careSeekerId, dto.sessionId);
    const existing = await this.incidentsRepository.findActiveBySession(dto.sessionId);
    if (existing) {
      return existing;
    }

    const incident = await this.incidentsRepository.create({
      careSeeker: { connect: { id: dto.careSeekerId } },
      session: { connect: { id: dto.sessionId } },
      source: dto.source,
      title: 'Image evidence received from WhatsApp',
      summary: 'The care seeker sent image evidence through WhatsApp. Context has not been provided yet.',
      description:
        'An image was received from the care seeker through WhatsApp and attached as evidence. The meaning of the image has not yet been confirmed.',
      category: 'UNKNOWN',
      severity: 'UNKNOWN',
      urgency: 'UNKNOWN',
      status: 'DRAFT',
      aiGenerated: false,
      needsHumanReview: false,
    });
    this.logger.log(`[INCIDENT_DRAFT_ENSURED_FOR_IMAGE] incidentId=${incident.id} sessionId=${dto.sessionId}`);
    return incident;
  }

  async findAll(filters: ListIncidentsDto) {
    const result = await this.incidentsRepository.findAll(filters);
    return {
      data: result.items.map((incident) => ({
        id: incident.id,
        title: incident.title,
        careSeekerPhoneNumber:
          incident.careSeeker.whatsappPhoneNumber ?? incident.careSeeker.phoneNumber ?? incident.careSeeker.phone,
        category: incident.category,
        severity: incident.severity,
        urgency: incident.urgency,
        status: incident.status,
        needsHumanReview: incident.needsHumanReview,
        aiGenerated: incident.aiGenerated,
        updatedAt: incident.updatedAt,
      })),
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    };
  }

  async findById(id: string, options: { includeEvidence?: boolean } = {}) {
    const incident = await this.incidentsRepository.findById(id);
    if (!incident) {
      throw new NotFoundException();
    }

    return {
      ...incident,
      careSeeker: incident.careSeeker
        ? {
            id: incident.careSeeker.id,
            displayName: incident.careSeeker.displayName ?? incident.careSeeker.fullName,
            phoneNumber: incident.careSeeker.phoneNumber ?? incident.careSeeker.phone,
            whatsappPhoneNumber: incident.careSeeker.whatsappPhoneNumber,
            source: incident.careSeeker.source,
            status: incident.careSeeker.status,
          }
        : null,
      conversationSession: incident.session
        ? {
            id: incident.session.id,
            careSeekerId: incident.session.careSeekerId,
            channel: incident.session.channel,
            status: incident.session.status,
            startedAt: incident.session.startedAt,
            lastMessageAt: incident.session.lastMessageAt,
          }
        : null,
      conversationMessagesTimeline: incident.session?.messages ?? [],
      evidence: options.includeEvidence ? (incident.evidence ?? []) : [],
    };
  }

  async update(id: string, dto: UpdateIncidentDto) {
    await this.findById(id);
    return this.incidentsRepository.update(id, { ...dto, manuallyEdited: true });
  }

  private async ensureCareSeekerAndSession(careSeekerId: string, sessionId: string) {
    const careSeeker = await this.incidentsRepository.careSeekerExists(careSeekerId);
    if (!careSeeker) {
      throw new BadRequestException(`Care seeker ${careSeekerId} does not exist`);
    }

    const session = await this.incidentsRepository.sessionBelongsToCareSeeker(sessionId, careSeekerId);
    if (!session) {
      throw new BadRequestException(`Conversation session ${sessionId} does not belong to care seeker ${careSeekerId}`);
    }
  }

  private toIncidentData(dto: AiUpsertIncidentDto, preserveManualFields: boolean): AiIncidentPayload {
    const output = dto.llmOutput;
    const severity = output.severity ?? 'UNKNOWN';
    const needsHumanReview = this.needsHumanReview(output);
    const status = this.inferStatus(output);
    const aiFields = preserveManualFields
      ? {}
      : {
          title: output.title?.trim() || 'AI incident intake',
          summary: output.summary,
          description: output.description,
          category: output.category ?? 'UNKNOWN',
          severity,
          urgency: output.urgency ?? 'UNKNOWN',
          incidentDateText: output.incidentDateText,
          locationText: output.locationText,
          perpetratorRelation: output.perpetratorRelation,
          status,
        };

    return {
      ...aiFields,
      source: dto.source,
      riskSignals: output.riskSignals ?? Prisma.JsonNull,
      missingFields: output.missingFields ?? Prisma.JsonNull,
      needsHumanReview,
      aiGenerated: true,
      aiConfidence: output.aiConfidence,
      caseNote: output.caseNote,
    };
  }

  private inferStatus(output: IncidentLlmOutputDto): IncidentStatus {
    const hasMeaningfulCore =
      Boolean(output.title?.trim()) &&
      Boolean(output.summary?.trim()) &&
      Boolean(output.description?.trim()) &&
      Boolean(output.category && output.category !== 'UNKNOWN') &&
      Boolean(output.severity && output.severity !== 'UNKNOWN');

    return hasMeaningfulCore ? 'OPEN' : 'DRAFT';
  }

  private needsHumanReview(output: IncidentLlmOutputDto) {
    return output.needsHumanReview === true || this.isHighSeverity(output.severity);
  }

  private isHighSeverity(severity?: IncidentSeverity) {
    return severity === 'HIGH' || severity === 'CRITICAL';
  }
}
