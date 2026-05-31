import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';

@Injectable()
export class RolesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.role.findMany({ orderBy: { name: 'asc' } });
  }

  findById(id: string) {
    return this.prisma.role.findUnique({ where: { id } });
  }

  create(dto: CreateRoleDto) {
    return this.prisma.role.upsert({
      where: { name: dto.name },
      create: dto,
      update: { description: dto.description },
    });
  }

  update(id: string, dto: UpdateRoleDto) {
    return this.prisma.role.update({ where: { id }, data: dto });
  }

  delete(id: string) {
    return this.prisma.role.delete({ where: { id } });
  }
}
