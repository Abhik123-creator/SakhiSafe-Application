import { Module } from '@nestjs/common';
import { CasesController } from './controllers/cases.controller';
import { CasesRepository } from './repositories/cases.repository';
import { CasesService } from './services/cases.service';

@Module({
  controllers: [CasesController],
  providers: [CasesService, CasesRepository],
  exports: [CasesService],
})
export class CasesModule {}
