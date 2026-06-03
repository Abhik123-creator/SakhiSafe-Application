import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipResponseTransform } from '../../common/decorators/skip-response-transform.decorator';
import { AiUpsertIncidentDto } from '../../incidents/dto/ai-upsert-incident.dto';
import { EnsureDraftIncidentDto } from '../../incidents/dto/ensure-draft-incident.dto';
import { IncidentsService } from '../../incidents/services/incidents.service';
import { ServiceJwtGuard } from '../internal-auth/service-jwt.guard';

@ApiTags('Internal Incidents')
@ApiBearerAuth('service-jwt')
@SkipResponseTransform()
@UseGuards(ServiceJwtGuard)
@Controller('internal/v1/incidents')
export class InternalIncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post('ai-upsert')
  @ApiOperation({ summary: 'Create or update the AI incident for a conversation session' })
  aiUpsert(@Body() dto: AiUpsertIncidentDto) {
    return this.incidentsService.aiUpsert(dto);
  }

  @Get('active-by-session/:sessionId')
  @ApiOperation({ summary: 'Get active incident for a conversation session' })
  activeBySession(@Param('sessionId') sessionId: string) {
    return this.incidentsService.findActiveBySession(sessionId);
  }

  @Post('ensure-draft-for-session')
  @ApiOperation({ summary: 'Ensure a draft incident exists for image evidence' })
  ensureDraftForSession(@Body() dto: EnsureDraftIncidentDto) {
    return this.incidentsService.ensureDraftForSession(dto);
  }
}
