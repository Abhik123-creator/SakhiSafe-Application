import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipResponseTransform } from '../../common/decorators/skip-response-transform.decorator';
import { CreateConversationMessageDto } from '../../conversation-messages/dto/create-conversation-message.dto';
import { ConversationMessagesService } from '../../conversation-messages/services/conversation-messages.service';
import { ServiceJwtGuard } from '../internal-auth/service-jwt.guard';

@ApiTags('Internal Conversation Messages')
@ApiBearerAuth('service-jwt')
@SkipResponseTransform()
@UseGuards(ServiceJwtGuard)
@Controller('internal/v1/conversation-messages')
export class InternalConversationMessagesController {
  constructor(private readonly conversationMessagesService: ConversationMessagesService) {}

  @Post()
  @ApiOperation({ summary: 'Store a conversation message' })
  create(@Body() dto: CreateConversationMessageDto) {
    return this.conversationMessagesService.create(dto);
  }
}
