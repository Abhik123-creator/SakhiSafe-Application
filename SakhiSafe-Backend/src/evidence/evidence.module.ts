import { Module } from '@nestjs/common';
import { EvidenceAccessService } from '../common/services/evidence-access.service';
import { UsersModule } from '../users/users.module';
import { AdminEvidenceController } from './controllers/admin-evidence.controller';
import { EvidenceRepository } from './repositories/evidence.repository';
import { EvidenceService } from './services/evidence.service';

@Module({
  imports: [UsersModule],
  controllers: [AdminEvidenceController],
  providers: [EvidenceService, EvidenceRepository, EvidenceAccessService],
  exports: [EvidenceService, EvidenceRepository],
})
export class EvidenceModule {}
