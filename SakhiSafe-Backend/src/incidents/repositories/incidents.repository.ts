import { Injectable } from '@nestjs/common';
import { IncidentSource, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ListIncidentsDto } from '../dto/list-incidents.dto';

const detailInclude = {
  careSeeker: true,
  session: {
    include: {
      messages: { orderBy: { createdAt: 'asc' as const } },
    },
  },
  evidence: {
    where: { status: 'ACTIVE' as const },
    orderBy: { createdAt: 'desc' as const },
    select: {
      id: true,
      evidenceType: true,
      mimeType: true,
      fileSize: true,
      caption: true,
      createdAt: true,
      uploadedBy: true,
    },
  },
};

@Injectable()
export class IncidentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  careSeekerExists(id: string) {
    return this.prisma.careSeeker.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  }

  sessionBelongsToCareSeeker(sessionId: string, careSeekerId: string) {
    return this.prisma.conversationSession.findFirst({ where: { id: sessionId, careSeekerId }, select: { id: true } });
  }

  findOpenBySession(sessionId: string) {
    return this.prisma.incident.findFirst({
      where: { sessionId, status: { in: ['DRAFT', 'OPEN', 'UNDER_REVIEW'] } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  findActiveBySession(sessionId: string) {
    return this.prisma.incident.findFirst({
      where: { sessionId, status: { in: ['DRAFT', 'OPEN', 'UNDER_REVIEW'] } },
      include: detailInclude,
      orderBy: { updatedAt: 'desc' },
    });
  }

  create(data: Prisma.IncidentCreateInput) {
    return this.prisma.incident.create({ data, include: detailInclude });
  }

  update(id: string, data: Prisma.IncidentUpdateInput) {
    return this.prisma.incident.update({ where: { id }, data, include: detailInclude });
  }

  async findAll(filters: ListIncidentsDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const where: Prisma.IncidentWhereInput = {
      status: filters.status,
      severity: filters.severity,
      urgency: filters.urgency,
      needsHumanReview: filters.needsHumanReview,
      source: filters.source,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.incident.findMany({
        where,
        include: { careSeeker: true },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.incident.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  findById(id: string) {
    return this.prisma.incident.findUnique({ where: { id }, include: detailInclude });
  }

  findBySource(source: IncidentSource) {
    return this.prisma.incident.findMany({ where: { source } });
  }
}
