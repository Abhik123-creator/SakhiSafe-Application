import { Module } from '@nestjs/common';
import { AdminEvidenceController } from './controllers/admin-evidence.controller';
import { EvidenceRepository } from './repositories/evidence.repository';
import { EvidenceService } from './services/evidence.service';

@Module({
  controllers: [AdminEvidenceController],
  providers: [EvidenceService, EvidenceRepository],
  exports: [EvidenceService, EvidenceRepository],
})
export class EvidenceModule {}
