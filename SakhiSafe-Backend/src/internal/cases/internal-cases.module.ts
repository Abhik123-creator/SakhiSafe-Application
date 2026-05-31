import { Module } from '@nestjs/common';
import { CasesRepository } from '../../cases/repositories/cases.repository';
import { CasesService } from '../../cases/services/cases.service';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { InternalCasesController } from './internal-cases.controller';

@Module({
  imports: [InternalAuthModule],
  controllers: [InternalCasesController],
  providers: [CasesService, CasesRepository],
})
export class InternalCasesModule {}
