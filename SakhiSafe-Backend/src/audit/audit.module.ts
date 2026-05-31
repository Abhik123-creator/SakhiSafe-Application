import { Module } from '@nestjs/common';
import { AuditCoreModule } from './audit-core.module';
import { AuditController } from './controllers/audit.controller';

@Module({
  imports: [AuditCoreModule],
  controllers: [AuditController],
})
export class AuditModule {}
