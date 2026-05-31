import { Module } from '@nestjs/common';
import { PersonsAtRiskController } from './controllers/persons-at-risk.controller';
import { PersonsAtRiskRepository } from './repositories/persons-at-risk.repository';
import { PersonsAtRiskService } from './services/persons-at-risk.service';

@Module({
  controllers: [PersonsAtRiskController],
  providers: [PersonsAtRiskService, PersonsAtRiskRepository],
  exports: [PersonsAtRiskService],
})
export class PersonsAtRiskModule {}
