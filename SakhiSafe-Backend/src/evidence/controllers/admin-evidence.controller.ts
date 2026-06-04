import { Controller, Delete, Get, Header, Param, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createReadStream } from 'node:fs';
import type { Response } from 'express';
import { ModuleKey, PermissionAction } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SkipResponseTransform } from '../../common/decorators/skip-response-transform.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { EvidenceService } from '../services/evidence.service';

@ApiTags('admin evidence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/v1')
export class AdminEvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Get('incidents/:id/evidence')
  @RequirePermission(ModuleKey.EVIDENCE, PermissionAction.VIEW)
  @ApiOperation({ summary: 'List active image evidence for an incident' })
  findByIncident(@Param('id') id: string) {
    return this.evidenceService.listActiveByIncident(id);
  }

  @Get('evidence/:id/file')
  @RequirePermission(ModuleKey.EVIDENCE, PermissionAction.VIEW)
  @SkipResponseTransform()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Stream private image evidence file' })
  async streamFile(@Param('id') id: string, @Res({ passthrough: true }) response: Response) {
    const evidence = await this.evidenceService.getActiveFile(id);
    response.setHeader('Content-Type', evidence.mimeType);
    const fileName = (evidence.originalFileName ?? evidence.storedFileName).replaceAll('"', '');
    response.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    return new StreamableFile(createReadStream(evidence.storagePath));
  }

  @Delete('evidence/:id')
  @RequirePermission(ModuleKey.EVIDENCE, PermissionAction.DELETE)
  @ApiOperation({ summary: 'Soft delete evidence record' })
  delete(@Param('id') id: string) {
    return this.evidenceService.delete(id);
  }
}
