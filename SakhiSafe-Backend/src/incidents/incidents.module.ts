import { Module } from '@nestjs/common';
import { EvidenceAccessService } from '../common/services/evidence-access.service';
import { UsersModule } from '../users/users.module';
import { AdminIncidentsController } from './controllers/admin-incidents.controller';
import { IncidentsRepository } from './repositories/incidents.repository';
import { IncidentsService } from './services/incidents.service';

@Module({
  imports: [UsersModule],
  controllers: [AdminIncidentsController],
  providers: [IncidentsService, IncidentsRepository, EvidenceAccessService],
  exports: [IncidentsService, IncidentsRepository],
})
export class IncidentsModule {}
