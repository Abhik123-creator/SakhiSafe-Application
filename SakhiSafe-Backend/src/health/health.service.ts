import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check() {
    return {
      status: 'ok',
      database: (await this.prisma.isHealthy()) ? 'ok' : 'down',
      timestamp: new Date().toISOString(),
    };
  }
}
