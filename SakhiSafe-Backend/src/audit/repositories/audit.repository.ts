import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAuditLogDto } from '../dto/create-audit-log.dto';

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  }

  create(dto: CreateAuditLogDto) {
    return this.prisma.auditLog.create({ data: dto as Prisma.AuditLogUncheckedCreateInput });
  }
}
