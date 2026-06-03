import { Module } from '@nestjs/common';
import { ConversationSessionsRepository } from './repositories/conversation-sessions.repository';
import { ConversationSessionsService } from './services/conversation-sessions.service';

@Module({
  providers: [ConversationSessionsService, ConversationSessionsRepository],
  exports: [ConversationSessionsService, ConversationSessionsRepository],
})
export class ConversationSessionsModule {}
