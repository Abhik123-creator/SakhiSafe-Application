import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateConversationMessageDto } from '../dto/create-conversation-message.dto';
import { ConversationMessagesRepository } from '../repositories/conversation-messages.repository';

@Injectable()
export class ConversationMessagesService {
  private readonly logger = new Logger(ConversationMessagesService.name);

  constructor(private readonly conversationMessagesRepository: ConversationMessagesRepository) {}

  async create(dto: CreateConversationMessageDto) {
    const session = await this.conversationMessagesRepository.sessionExists(dto.sessionId);
    if (!session) {
      throw new BadRequestException(`Conversation session ${dto.sessionId} does not exist`);
    }

    const message = await this.conversationMessagesRepository.create({
      session: { connect: { id: dto.sessionId } },
      direction: dto.direction,
      messageType: dto.messageType,
      messageText: dto.messageText,
      mediaId: dto.mediaId,
      evidence: dto.evidenceId ? { connect: { id: dto.evidenceId } } : undefined,
      rawPayload: dto.rawPayload as Prisma.InputJsonValue,
    });
    await this.conversationMessagesRepository.touchSession(dto.sessionId, message.createdAt);
    this.logger.log(`Stored ${dto.direction} ${dto.messageType} message ${message.id} for session ${dto.sessionId}`);
    return message;
  }
}
