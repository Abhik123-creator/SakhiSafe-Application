import { Module } from '@nestjs/common';
import { ConversationMessagesRepository } from './repositories/conversation-messages.repository';
import { ConversationMessagesService } from './services/conversation-messages.service';

@Module({
  providers: [ConversationMessagesService, ConversationMessagesRepository],
  exports: [ConversationMessagesService],
})
export class ConversationMessagesModule {}
