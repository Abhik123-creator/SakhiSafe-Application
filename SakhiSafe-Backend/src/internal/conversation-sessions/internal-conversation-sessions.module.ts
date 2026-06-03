import { Module } from '@nestjs/common';
import { ConversationSessionsModule } from '../../conversation-sessions/conversation-sessions.module';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { InternalConversationSessionsController } from './internal-conversation-sessions.controller';

@Module({
  imports: [InternalAuthModule, ConversationSessionsModule],
  controllers: [InternalConversationSessionsController],
})
export class InternalConversationSessionsModule {}
