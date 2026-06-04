import { Module } from '@nestjs/common';
import { InternalCareSeekersModule } from './care-seekers/internal-care-seekers.module';
import { InternalCasesModule } from './cases/internal-cases.module';
import { InternalCaseNotesModule } from './case-notes/internal-case-notes.module';
import { InternalConversationMessagesModule } from './conversation-messages/internal-conversation-messages.module';
import { InternalConversationSessionsModule } from './conversation-sessions/internal-conversation-sessions.module';
import { InternalEvidenceModule } from './evidence/internal-evidence.module';
import { InternalIncidentsModule } from './incidents/internal-incidents.module';
import { InternalAuthModule } from './internal-auth/internal-auth.module';
import { InternalHealthController } from './internal-auth/internal-health.controller';

@Module({
  imports: [
    InternalAuthModule,
    InternalCareSeekersModule,
    InternalCasesModule,
    InternalCaseNotesModule,
    InternalConversationSessionsModule,
    InternalConversationMessagesModule,
    InternalIncidentsModule,
    InternalEvidenceModule,
  ],
  controllers: [InternalHealthController],
})
export class InternalModule {}
