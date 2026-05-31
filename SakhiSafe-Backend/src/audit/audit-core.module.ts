import { Module } from '@nestjs/common';
import { AuditRepository } from './repositories/audit.repository';
import { AuditService } from './services/audit.service';

@Module({
  providers: [AuditService, AuditRepository],
  exports: [AuditService],
})
export class AuditCoreModule {}
