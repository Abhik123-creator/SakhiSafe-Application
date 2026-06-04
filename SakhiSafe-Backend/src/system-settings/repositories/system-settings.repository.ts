import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SystemSettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
  }

  upsert(key: string, value: Prisma.InputJsonValue, updatedById?: string, isSensitive = false, description?: string) {
    return this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, value, updatedById, isSensitive, description },
      update: { value, updatedById, isSensitive, description },
    });
  }
}
