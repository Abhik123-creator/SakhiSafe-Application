import { BadRequestException } from '@nestjs/common';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EvidenceService } from './evidence.service';

describe('EvidenceService', () => {
  const repository = {
    careSeekerExists: jest.fn(),
    create: jest.fn(),
    findActiveById: jest.fn(),
    findActiveByIncident: jest.fn(),
    incidentBelongsToSession: jest.fn(),
    sessionBelongsToCareSeeker: jest.fn(),
    softDelete: jest.fn(),
  };
  const service = new EvidenceService(repository as any);
  const dto = {
    careSeekerId: 'care-seeker-id',
    sessionId: 'session-id',
    incidentId: 'incident-id',
    source: 'WHATSAPP' as const,
    uploadedBy: 'CARE_SEEKER' as const,
    caption: 'Photo caption',
  };
  const imageFile = {
    originalname: 'image.png',
    mimetype: 'image/png',
    size: 4,
    buffer: Buffer.from('file'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository.careSeekerExists.mockResolvedValue({ id: 'care-seeker-id' });
    repository.sessionBelongsToCareSeeker.mockResolvedValue({ id: 'session-id' });
    repository.incidentBelongsToSession.mockResolvedValue({ id: 'incident-id' });
  });

  afterEach(() => {
    rmSync(join(process.cwd(), 'private'), { recursive: true, force: true });
  });

  it('rejects non-image files', async () => {
    await expect(
      service.uploadImage(dto, { ...imageFile, mimetype: 'application/pdf', originalname: 'file.pdf' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects oversized files', async () => {
    await expect(service.uploadImage(dto, { ...imageFile, size: 6 * 1024 * 1024 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('validates care seeker/session/incident relationship', async () => {
    repository.incidentBelongsToSession.mockResolvedValue(null);

    await expect(service.uploadImage(dto, imageFile)).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('stores metadata and creates evidence', async () => {
    repository.create.mockResolvedValue({ id: 'evidence-id' });

    await service.uploadImage(dto, imageFile);

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        evidenceType: 'IMAGE',
        mimeType: 'image/png',
        fileSize: 4,
        caption: 'Photo caption',
        sha256Hash: expect.any(String),
      }),
    );
  });

  it('returns active image metadata for an incident', async () => {
    repository.findActiveByIncident.mockResolvedValue([{ id: 'evidence-id', status: 'ACTIVE' }]);

    await expect(service.listActiveByIncident('incident-id')).resolves.toEqual([{ id: 'evidence-id', status: 'ACTIVE' }]);
  });

  it('streams only active evidence files', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'evidence-'));
    const storagePath = join(directory, 'image.png');
    writeFileSync(storagePath, 'image');
    repository.findActiveById.mockResolvedValue({ id: 'evidence-id', storagePath, mimeType: 'image/png' });

    await expect(service.getActiveFile('evidence-id')).resolves.toEqual(
      expect.objectContaining({ id: 'evidence-id', storagePath }),
    );
  });

  it('deleted evidence does not appear in active evidence list', async () => {
    repository.findActiveByIncident.mockResolvedValue([]);

    await expect(service.listActiveByIncident('incident-id')).resolves.toEqual([]);
  });
});
