import { Injectable } from '@nestjs/common';
import { ConversationChannel, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ConversationSessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActive(careSeekerId: string, channel: ConversationChannel) {
    return this.prisma.conversationSession.findFirst({
      where: { careSeekerId, channel, status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
    });
  }

  findById(id: string) {
    return this.prisma.conversationSession.findUnique({ where: { id } });
  }

  create(data: Prisma.ConversationSessionCreateInput) {
    return this.prisma.conversationSession.create({ data });
  }

  touch(id: string, lastMessageAt = new Date()) {
    return this.prisma.conversationSession.update({ where: { id }, data: { lastMessageAt } });
  }

  careSeekerExists(id: string) {
    return this.prisma.careSeeker.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  }
}
