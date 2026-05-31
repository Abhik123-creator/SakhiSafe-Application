import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateModuleDto } from '../dto/create-module.dto';
import { UpdateModuleDto } from '../dto/update-module.dto';

@Injectable()
export class ModulesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.appModule.findMany({ orderBy: { key: 'asc' } });
  }

  findById(id: string) {
    return this.prisma.appModule.findUnique({ where: { id } });
  }

  create(dto: CreateModuleDto) {
    return this.prisma.appModule.create({ data: dto });
  }

  update(id: string, dto: UpdateModuleDto) {
    return this.prisma.appModule.update({ where: { id }, data: dto });
  }

  async toggle(id: string) {
    const moduleRecord = await this.prisma.appModule.findUniqueOrThrow({ where: { id } });
    return this.prisma.appModule.update({ where: { id }, data: { isEnabled: !moduleRecord.isEnabled } });
  }

  delete(id: string) {
    return this.prisma.appModule.delete({ where: { id } });
  }
}
