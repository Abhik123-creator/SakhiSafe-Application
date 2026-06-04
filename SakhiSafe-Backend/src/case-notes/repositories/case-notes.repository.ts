import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CaseNotesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCareSeekerByPhone(phone: string) {
    return this.prisma.careSeeker.findFirst({
      where: {
        deletedAt: null,
        OR: [{ phone }, { phone: `+${phone}` }, { phoneNumber: phone }, { whatsappPhoneNumber: phone }],
      },
    });
  }

  createCareSeeker(phone: string) {
    return this.prisma.careSeeker.create({
      data: {
        fullName: 'WhatsApp Care Seeker',
        displayName: 'WhatsApp Care Seeker',
        phone,
        phoneNumber: phone,
        whatsappPhoneNumber: phone,
        source: 'WHATSAPP',
        status: 'ACTIVE',
      },
    });
  }

  findSession(id: string, careSeekerId: string) {
    return this.prisma.conversationSession.findFirst({ where: { id, careSeekerId } });
  }

  findActiveSession(careSeekerId: string) {
    return this.prisma.conversationSession.findFirst({
      where: { careSeekerId, channel: 'WHATSAPP', status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
    });
  }

  createSession(careSeekerId: string) {
    return this.prisma.conversationSession.create({
      data: { careSeekerId, channel: 'WHATSAPP', status: 'ACTIVE' },
    });
  }

  touchSession(id: string) {
    return this.prisma.conversationSession.update({ where: { id }, data: { lastMessageAt: new Date() } });
  }

  findIncident(id: string, careSeekerId: string) {
    return this.prisma.incident.findFirst({ where: { id, careSeekerId } });
  }

  findActiveIncidentBySession(sessionId: string) {
    return this.prisma.incident.findFirst({
      where: { sessionId, status: { in: ['DRAFT', 'OPEN', 'UNDER_REVIEW'] } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  createDraftIncident(careSeekerId: string, sessionId: string) {
    return this.prisma.incident.create({
      data: {
        careSeekerId,
        sessionId,
        source: 'WHATSAPP',
        title: 'Image evidence received from WhatsApp',
        summary: 'The care seeker sent image evidence through WhatsApp. Context has not been provided yet.',
        description:
          'An image was received from the care seeker through WhatsApp and attached as evidence. The meaning of the image has not yet been confirmed.',
        category: 'UNKNOWN',
        severity: 'UNKNOWN',
        urgency: 'UNKNOWN',
        status: 'DRAFT',
        needsHumanReview: false,
        aiGenerated: false,
      },
    });
  }

  findCase(id: string, careSeekerId: string) {
    return this.prisma.case.findFirst({ where: { id, careSeekerId, deletedAt: null } });
  }

  findOpenCaseByCareSeeker(careSeekerId: string) {
    return this.prisma.case.findFirst({
      where: { careSeekerId, deletedAt: null, status: { in: ['OPEN', 'IN_PROGRESS', 'ESCALATED'] } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  createDraftCase(careSeekerId: string) {
    return this.prisma.case.create({
      data: {
        careSeekerId,
        title: 'Image evidence received from WhatsApp',
        summary: 'Image evidence was received through WhatsApp and needs review.',
        incidentDescription:
          'An image was received from the care seeker and stored as evidence. Additional context should be gathered.',
        status: 'OPEN',
        riskLevel: 'MEDIUM',
      },
    });
  }

  findEvidenceByWhatsappMessage(whatsappMessageId: string) {
    return this.prisma.evidence.findFirst({ where: { whatsappMessageId, status: 'ACTIVE' } });
  }

  createEvidence(data: Prisma.EvidenceCreateInput) {
    return this.prisma.evidence.create({ data });
  }

  createImageMessage(data: Prisma.ConversationMessageCreateInput) {
    return this.prisma.conversationMessage.create({ data });
  }

  findNote(incidentId?: string, caseId?: string) {
    return this.prisma.caseNote.findFirst({
      where: { OR: [{ incidentId: incidentId ?? undefined }, { caseId: caseId ?? undefined }] },
      orderBy: { updatedAt: 'desc' },
    });
  }

  createNote(data: Prisma.CaseNoteCreateInput) {
    return this.prisma.caseNote.create({ data });
  }

  updateNote(id: string, noteText: string) {
    return this.prisma.caseNote.update({ where: { id }, data: { noteText } });
  }

  updateIncidentConfidence(id: string, confidenceScore: number) {
    return this.prisma.incident.update({ where: { id }, data: { confidenceScore, aiConfidence: confidenceScore } });
  }

  updateCaseConfidence(id: string, confidenceScore: number) {
    return this.prisma.case.update({ where: { id }, data: { confidenceScore } });
  }
}
