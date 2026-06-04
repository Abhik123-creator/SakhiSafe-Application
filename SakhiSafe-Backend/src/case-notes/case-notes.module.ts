import { Module } from '@nestjs/common';
import { CaseNotesRepository } from './repositories/case-notes.repository';
import { CaseNotesService } from './services/case-notes.service';
import { IncidentConfidenceService } from './services/incident-confidence.service';

@Module({
  providers: [CaseNotesService, CaseNotesRepository, IncidentConfidenceService],
  exports: [CaseNotesService, CaseNotesRepository, IncidentConfidenceService],
})
export class CaseNotesModule {}
