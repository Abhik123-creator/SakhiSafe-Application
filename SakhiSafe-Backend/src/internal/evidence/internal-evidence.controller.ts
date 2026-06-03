import { Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { SkipResponseTransform } from '../../common/decorators/skip-response-transform.decorator';
import { UploadImageEvidenceDto } from '../../evidence/dto/upload-image-evidence.dto';
import { EvidenceService, MAX_IMAGE_EVIDENCE_BYTES } from '../../evidence/services/evidence.service';
import { UploadedImageFile } from '../../evidence/services/uploaded-image-file';
import { ServiceJwtGuard } from '../internal-auth/service-jwt.guard';

@ApiTags('Internal Evidence')
@ApiBearerAuth('service-jwt')
@SkipResponseTransform()
@UseGuards(ServiceJwtGuard)
@Controller('internal/v1/evidence')
export class InternalEvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Post('upload-image')
  @ApiOperation({ summary: 'Upload private image evidence metadata and file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['careSeekerId', 'sessionId', 'incidentId', 'source', 'uploadedBy', 'file'],
      properties: {
        careSeekerId: { type: 'string', format: 'uuid' },
        sessionId: { type: 'string', format: 'uuid' },
        incidentId: { type: 'string', format: 'uuid' },
        source: { type: 'string', enum: ['WHATSAPP', 'WEB', 'ADMIN'] },
        uploadedBy: { type: 'string', enum: ['CARE_SEEKER', 'ADMIN', 'AI_SERVICE'] },
        caption: { type: 'string' },
        description: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_EVIDENCE_BYTES } }))
  uploadImage(@Body() dto: UploadImageEvidenceDto, @UploadedFile() file?: UploadedImageFile) {
    return this.evidenceService.uploadImage(dto, file);
  }
}
