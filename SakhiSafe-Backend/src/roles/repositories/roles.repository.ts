import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoleDto } from '../dto/create-role.dto';

@Injectable()
export class RolesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.role.findMany({ orderBy: { name: 'asc' } });
  }

  create(dto: CreateRoleDto) {
    return this.prisma.role.upsert({
      where: { name: dto.name },
      create: dto,
      update: { description: dto.description },
    });
  }
}
