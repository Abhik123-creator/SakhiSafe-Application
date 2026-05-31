import { Global, Module } from '@nestjs/common';
import { AuditController } from './controllers/audit.controller';
import { AuditRepository } from './repositories/audit.repository';
import { AuditService } from './services/audit.service';

@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditRepository],
  exports: [AuditService],
})
export class AuditModule {}
