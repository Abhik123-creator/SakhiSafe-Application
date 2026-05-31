import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePersonAtRiskDto } from '../dto/create-person-at-risk.dto';
import { UpdatePersonAtRiskDto } from '../dto/update-person-at-risk.dto';

@Injectable()
export class PersonsAtRiskRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.personAtRisk.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' } });
  }

  findById(id: string) {
    return this.prisma.personAtRisk.findFirst({ where: { id, deletedAt: null } });
  }

  create(dto: CreatePersonAtRiskDto) {
    return this.prisma.personAtRisk.create({ data: dto });
  }

  update(id: string, dto: UpdatePersonAtRiskDto) {
    return this.prisma.personAtRisk.update({ where: { id }, data: dto });
  }
}
