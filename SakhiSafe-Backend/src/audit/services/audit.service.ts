import { Injectable, Logger } from '@nestjs/common';
import { CreateAuditLogDto } from '../dto/create-audit-log.dto';
import { AuditRepository } from '../repositories/audit.repository';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly auditRepository: AuditRepository) {}

  findAll() {
    return this.auditRepository.findAll();
  }

  async create(dto: CreateAuditLogDto) {
    try {
      return await this.auditRepository.create(dto);
    } catch (error) {
      this.logger.warn('Audit log write failed');
      return null;
    }
  }
}
