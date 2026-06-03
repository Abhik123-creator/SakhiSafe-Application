import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ConversationMessagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  sessionExists(id: string) {
    return this.prisma.conversationSession.findUnique({ where: { id }, select: { id: true } });
  }

  create(data: Prisma.ConversationMessageCreateInput) {
    return this.prisma.conversationMessage.create({ data });
  }

  touchSession(id: string, lastMessageAt = new Date()) {
    return this.prisma.conversationSession.update({ where: { id }, data: { lastMessageAt } });
  }
}
