import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipResponseTransform } from '../../common/decorators/skip-response-transform.decorator';
import { GetOrCreateActiveSessionDto } from '../../conversation-sessions/dto/get-or-create-active-session.dto';
import { ConversationSessionsService } from '../../conversation-sessions/services/conversation-sessions.service';
import { ServiceJwtGuard } from '../internal-auth/service-jwt.guard';

@ApiTags('Internal Conversation Sessions')
@ApiBearerAuth('service-jwt')
@SkipResponseTransform()
@UseGuards(ServiceJwtGuard)
@Controller('internal/v1/conversation-sessions')
export class InternalConversationSessionsController {
  constructor(private readonly conversationSessionsService: ConversationSessionsService) {}

  @Post('get-or-create-active')
  @ApiOperation({ summary: 'Get or create active conversation session' })
  getOrCreateActive(@Body() dto: GetOrCreateActiveSessionDto) {
    return this.conversationSessionsService.getOrCreateActive(dto);
  }
}
