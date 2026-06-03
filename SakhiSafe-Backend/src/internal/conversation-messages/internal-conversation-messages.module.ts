import { Module } from '@nestjs/common';
import { ConversationMessagesModule } from '../../conversation-messages/conversation-messages.module';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { InternalConversationMessagesController } from './internal-conversation-messages.controller';

@Module({
  imports: [InternalAuthModule, ConversationMessagesModule],
  controllers: [InternalConversationMessagesController],
})
export class InternalConversationMessagesModule {}
