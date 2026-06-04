import { Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { ImageAnalysisCaseNoteDto } from '../../case-notes/dto/image-analysis-case-note.dto';
import { CaseNotesService } from '../../case-notes/services/case-notes.service';
import { SkipResponseTransform } from '../../common/decorators/skip-response-transform.decorator';
import { MAX_IMAGE_EVIDENCE_BYTES } from '../../evidence/services/evidence.service';
import { UploadedImageFile } from '../../evidence/services/uploaded-image-file';
import { ServiceJwtGuard } from '../internal-auth/service-jwt.guard';

@ApiTags('Internal Case Notes')
@ApiBearerAuth('service-jwt')
@SkipResponseTransform()
@UseGuards(ServiceJwtGuard)
@Controller('internal/v1/case-notes')
export class InternalCaseNotesController {
  constructor(private readonly caseNotesService: CaseNotesService) {}

  @Post('image-analysis')
  @ApiOperation({ summary: 'Store image evidence and AI media observation' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'careSeekerPhone', 'aiAnalysisJson', 'aiConfidence', 'aiSummary'],
      properties: {
        file: { type: 'string', format: 'binary' },
        careSeekerPhone: { type: 'string' },
        caseId: { type: 'string', format: 'uuid' },
        incidentId: { type: 'string', format: 'uuid' },
        sessionId: { type: 'string', format: 'uuid' },
        whatsappMessageId: { type: 'string' },
        whatsappMediaId: { type: 'string' },
        source: { type: 'string', default: 'whatsapp' },
        aiAnalysisJson: { type: 'string' },
        aiConfidence: { type: 'number' },
        aiSummary: { type: 'string' },
        description: { type: 'string' },
        survivorFriendlySummary: { type: 'string' },
        caption: { type: 'string' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_EVIDENCE_BYTES } }))
  createImageAnalysis(@Body() dto: ImageAnalysisCaseNoteDto, @UploadedFile() file?: UploadedImageFile) {
    return this.caseNotesService.createImageAnalysis(dto, file);
  }
}
