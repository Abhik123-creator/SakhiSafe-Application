import { Module } from '@nestjs/common';
import { CaseNotesModule } from '../../case-notes/case-notes.module';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { InternalCaseNotesController } from './internal-case-notes.controller';

@Module({
  imports: [InternalAuthModule, CaseNotesModule],
  controllers: [InternalCaseNotesController],
})
export class InternalCaseNotesModule {}
