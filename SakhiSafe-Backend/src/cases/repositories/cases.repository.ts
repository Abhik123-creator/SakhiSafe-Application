import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const include = { personAtRisk: true, organization: true, assignedTo: true, createdBy: true };

@Injectable()
export class CasesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.case.findMany({ where: { deletedAt: null }, include, orderBy: { createdAt: 'desc' } });
  }

  findById(id: string) {
    return this.prisma.case.findFirst({ where: { id, deletedAt: null }, include });
  }

  create(data: Prisma.CaseCreateInput) {
    return this.prisma.case.create({ data, include });
  }

  update(id: string, data: Prisma.CaseUpdateInput) {
    return this.prisma.case.update({ where: { id }, data, include });
  }
}
