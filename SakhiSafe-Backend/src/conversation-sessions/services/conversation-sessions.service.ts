import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { GetOrCreateActiveSessionDto } from '../dto/get-or-create-active-session.dto';
import { ConversationSessionsRepository } from '../repositories/conversation-sessions.repository';

@Injectable()
export class ConversationSessionsService {
  private readonly logger = new Logger(ConversationSessionsService.name);

  constructor(private readonly conversationSessionsRepository: ConversationSessionsRepository) {}

  async getOrCreateActive(dto: GetOrCreateActiveSessionDto) {
    const careSeeker = await this.conversationSessionsRepository.careSeekerExists(dto.careSeekerId);
    if (!careSeeker) {
      throw new BadRequestException(`Care seeker ${dto.careSeekerId} does not exist`);
    }

    const existing = await this.conversationSessionsRepository.findActive(dto.careSeekerId, dto.channel);
    if (existing) {
      this.logger.log(`Reusing active ${dto.channel} session ${existing.id} for care seeker ${dto.careSeekerId}`);
      return this.conversationSessionsRepository.touch(existing.id);
    }

    this.logger.log(`Creating active ${dto.channel} session for care seeker ${dto.careSeekerId}`);
    return this.conversationSessionsRepository.create({
      careSeeker: { connect: { id: dto.careSeekerId } },
      channel: dto.channel,
      status: 'ACTIVE',
    });
  }

  touch(id: string) {
    return this.conversationSessionsRepository.touch(id);
  }
}
