import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { UploadImageEvidenceDto } from '../dto/upload-image-evidence.dto';
import { EvidenceRepository } from '../repositories/evidence.repository';
import { UploadedImageFile } from './uploaded-image-file';

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_IMAGE_EVIDENCE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class EvidenceService {
  private readonly logger = new Logger(EvidenceService.name);
  private readonly uploadRoot = resolve(process.cwd(), 'private', 'uploads', 'evidence');

  constructor(private readonly evidenceRepository: EvidenceRepository) {}

  async uploadImage(dto: UploadImageEvidenceDto, file?: UploadedImageFile) {
    this.logger.log('[EVIDENCE_IMAGE_UPLOAD_STARTED]');
    await this.validateRelationships(dto);
    this.validateImageFile(file);
    this.logger.log('[EVIDENCE_IMAGE_VALIDATED]');

    const now = new Date();
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const extension = this.extensionFor(file.mimetype, file.originalname);
    const storedFileName = `${randomUUID()}${extension}`;
    const storageDirectory = join(this.uploadRoot, year, month);
    const storagePath = join(storageDirectory, storedFileName);
    await mkdir(storageDirectory, { recursive: true });
    await writeFile(storagePath, file.buffer);
    this.logger.log('[EVIDENCE_IMAGE_STORED]');

    const evidence = await this.evidenceRepository.create({
      careSeeker: { connect: { id: dto.careSeekerId } },
      session: { connect: { id: dto.sessionId } },
      incident: { connect: { id: dto.incidentId } },
      source: dto.source,
      evidenceType: 'IMAGE',
      originalFileName: basename(file.originalname || 'image'),
      storedFileName,
      storagePath,
      mimeType: file.mimetype,
      fileSize: file.size,
      sha256Hash: createHash('sha256').update(file.buffer).digest('hex'),
      caption: dto.caption,
      description: dto.description,
      uploadedBy: dto.uploadedBy,
      status: 'ACTIVE',
    });
    this.logger.log(`[EVIDENCE_RECORD_CREATED] evidenceId=${evidence.id}`);
    this.logger.log('[EVIDENCE_IMAGE_UPLOAD_COMPLETED]');
    return evidence;
  }

  listActiveByIncident(incidentId: string) {
    return this.evidenceRepository.findActiveByIncident(incidentId);
  }

  async getActiveFile(id: string) {
    const evidence = await this.evidenceRepository.findActiveById(id);
    if (!evidence) {
      throw new NotFoundException();
    }
    return evidence;
  }

  async delete(id: string) {
    const evidence = await this.getActiveFile(id);
    // TODO: Define physical deletion/retention policy for audit-safe evidence cleanup.
    return this.evidenceRepository.softDelete(evidence.id);
  }

  private async validateRelationships(dto: UploadImageEvidenceDto) {
    const careSeeker = await this.evidenceRepository.careSeekerExists(dto.careSeekerId);
    if (!careSeeker) {
      throw new BadRequestException(`Care seeker ${dto.careSeekerId} does not exist`);
    }

    const session = await this.evidenceRepository.sessionBelongsToCareSeeker(dto.sessionId, dto.careSeekerId);
    if (!session) {
      throw new BadRequestException(`Conversation session ${dto.sessionId} does not belong to care seeker ${dto.careSeekerId}`);
    }

    const incident = await this.evidenceRepository.incidentBelongsToSession(
      dto.incidentId,
      dto.careSeekerId,
      dto.sessionId,
    );
    if (!incident) {
      throw new BadRequestException(`Incident ${dto.incidentId} does not belong to care seeker/session`);
    }
  }

  private validateImageFile(file?: UploadedImageFile): asserts file is UploadedImageFile {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Only image/jpeg, image/png, and image/webp files are allowed');
    }
    if (file.size > MAX_IMAGE_EVIDENCE_BYTES) {
      throw new BadRequestException('Image file must be 5MB or smaller');
    }
  }

  private extensionFor(mimeType: string, originalFileName: string) {
    const fallback = mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg';
    const extension = extname(originalFileName).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.webp'].includes(extension) ? extension : fallback;
  }
}
