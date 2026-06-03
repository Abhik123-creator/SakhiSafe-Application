import { Module } from '@nestjs/common';
import { EvidenceRepository } from '../../evidence/repositories/evidence.repository';
import { EvidenceService } from '../../evidence/services/evidence.service';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { InternalEvidenceController } from './internal-evidence.controller';

@Module({
  imports: [InternalAuthModule],
  controllers: [InternalEvidenceController],
  providers: [EvidenceService, EvidenceRepository],
})
export class InternalEvidenceModule {}
