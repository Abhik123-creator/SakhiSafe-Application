import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EvidenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  careSeekerExists(id: string) {
    return this.prisma.careSeeker.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  }

  sessionBelongsToCareSeeker(sessionId: string, careSeekerId: string) {
    return this.prisma.conversationSession.findFirst({ where: { id: sessionId, careSeekerId }, select: { id: true } });
  }

  incidentBelongsToSession(incidentId: string, careSeekerId: string, sessionId: string) {
    return this.prisma.incident.findFirst({
      where: { id: incidentId, careSeekerId, sessionId },
      select: { id: true },
    });
  }

  create(data: Prisma.EvidenceCreateInput) {
    return this.prisma.evidence.create({ data });
  }

  findActiveByIncident(incidentId: string) {
    return this.prisma.evidence.findMany({
      where: { incidentId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        evidenceType: true,
        mimeType: true,
        fileSize: true,
        caption: true,
        createdAt: true,
        uploadedBy: true,
      },
    });
  }

  findActiveById(id: string) {
    return this.prisma.evidence.findFirst({ where: { id, status: 'ACTIVE' } });
  }

  softDelete(id: string) {
    return this.prisma.evidence.update({ where: { id }, data: { status: 'DELETED' } });
  }
}
