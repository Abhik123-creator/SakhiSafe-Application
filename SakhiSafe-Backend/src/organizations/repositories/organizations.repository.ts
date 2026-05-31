import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrganizationDto } from '../dto/create-organization.dto';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';

@Injectable()
export class OrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.organization.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' } });
  }

  findById(id: string) {
    return this.prisma.organization.findFirst({ where: { id, deletedAt: null } });
  }

  create(dto: CreateOrganizationDto) {
    return this.prisma.organization.create({ data: dto });
  }

  update(id: string, dto: UpdateOrganizationDto) {
    return this.prisma.organization.update({ where: { id }, data: dto });
  }
}
