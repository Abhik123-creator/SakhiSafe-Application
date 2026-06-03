import { StreamableFile } from '@nestjs/common';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AdminEvidenceController } from './admin-evidence.controller';

describe('AdminEvidenceController', () => {
  const evidenceService = {
    delete: jest.fn(),
    getActiveFile: jest.fn(),
    listActiveByIncident: jest.fn(),
  };
  const controller = new AdminEvidenceController(evidenceService as any);

  beforeEach(() => jest.clearAllMocks());

  it('lists image evidence metadata for an incident', async () => {
    evidenceService.listActiveByIncident.mockResolvedValue([{ id: 'evidence-id', evidenceType: 'IMAGE' }]);

    await expect(controller.findByIncident('incident-id')).resolves.toEqual([{ id: 'evidence-id', evidenceType: 'IMAGE' }]);
  });

  it('streams an active image file', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'evidence-controller-'));
    const storagePath = join(directory, 'image.png');
    writeFileSync(storagePath, 'image');
    evidenceService.getActiveFile.mockResolvedValue({
      id: 'evidence-id',
      storagePath,
      mimeType: 'image/png',
      originalFileName: 'image.png',
    });
    const response = { setHeader: jest.fn() };

    const result = await controller.streamFile('evidence-id', response as any);

    expect(result).toBeInstanceOf(StreamableFile);
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
  });
});
