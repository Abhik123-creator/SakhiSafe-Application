import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { SkipResponseTransform } from '../../common/decorators/skip-response-transform.decorator';
import { AiUpsertIncidentDto } from '../../incidents/dto/ai-upsert-incident.dto';
import { EnsureDraftIncidentDto } from '../../incidents/dto/ensure-draft-incident.dto';
import { IncidentMissingFieldsResponseDto } from '../../incidents/dto/incident-missing-fields-response.dto';
import { IncidentsService } from '../../incidents/services/incidents.service';
import { ServiceJwtGuard } from '../internal-auth/service-jwt.guard';

@ApiTags('Internal Incidents')
@ApiBearerAuth('service-jwt')
@SkipResponseTransform()
@UseGuards(ServiceJwtGuard)
@Controller('internal/v1/incidents')
export class InternalIncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get('missing-fields/by-phone/:phone')
  @ApiOperation({ summary: 'Get missing fields for the latest active incident by care seeker phone' })
  @ApiParam({ name: 'phone', example: '917003801171' })
  @ApiOkResponse({ type: IncidentMissingFieldsResponseDto })
  missingFieldsByPhone(@Param('phone') phone: string) {
    return this.incidentsService.findMissingFieldsByCareSeekerPhone(phone);
  }

  @Get('active-by-phone/:phone')
  @ApiOperation({ summary: 'Get latest active incident by care seeker phone' })
  @ApiParam({ name: 'phone', example: '917003801171' })
  activeByPhone(@Param('phone') phone: string) {
    return this.incidentsService.findActiveByCareSeekerPhone(phone);
  }

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
