import { BadRequestException } from '@nestjs/common';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { CaseNotesService } from './case-notes.service';
import { IncidentConfidenceService } from './incident-confidence.service';

describe('CaseNotesService', () => {
  const repository = {
    createCareSeeker: jest.fn(),
    createDraftCase: jest.fn(),
    createDraftIncident: jest.fn(),
    createEvidence: jest.fn(),
    createImageMessage: jest.fn(),
    createNote: jest.fn(),
    createSession: jest.fn(),
    findActiveIncidentBySession: jest.fn(),
    findActiveSession: jest.fn(),
    findCareSeekerByPhone: jest.fn(),
    findCase: jest.fn(),
    findEvidenceByWhatsappMessage: jest.fn(),
    findIncident: jest.fn(),
    findNote: jest.fn(),
    findOpenCaseByCareSeeker: jest.fn(),
    findSession: jest.fn(),
    touchSession: jest.fn(),
    updateCaseConfidence: jest.fn(),
    updateIncidentConfidence: jest.fn(),
    updateNote: jest.fn(),
  };
  const service = new CaseNotesService(repository as any, new IncidentConfidenceService());
  const analysis = {
    visibleInjuryPresent: true,
    imageQuality: 'fair',
    bodyPartVisible: 'arm',
    possibleVisibleIndicators: ['dark discoloration', 'swelling'],
    possibleInjuryTypes: ['bruise-like mark'],
    severityEstimate: 'medium',
    confidence: 0.72,
    urgentCareRecommended: false,
    professionalCaseNoteDescription:
      'The uploaded image appears to show localized dark discoloration and mild swelling on an arm-like area.',
  };
  const dto = {
    careSeekerPhone: '+91 99999 99999',
    aiAnalysisJson: JSON.stringify(analysis),
    aiConfidence: '0.72',
    aiSummary: 'Image observation saved.',
    whatsappMessageId: 'wamid-1',
    whatsappMediaId: 'media-1',
    source: 'whatsapp',
  };
  const file = {
    originalname: 'image.jpg',
    mimetype: 'image/jpeg',
    size: 5,
    buffer: Buffer.from('image'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findCareSeekerByPhone.mockResolvedValue(null);
    repository.createCareSeeker.mockResolvedValue({ id: 'care-seeker-id' });
    repository.findActiveSession.mockResolvedValue(null);
    repository.createSession.mockResolvedValue({ id: 'session-id' });
    repository.findActiveIncidentBySession.mockResolvedValue(null);
    repository.createDraftIncident.mockResolvedValue({ id: 'incident-id' });
    repository.findOpenCaseByCareSeeker.mockResolvedValue(null);
    repository.createDraftCase.mockResolvedValue({ id: 'case-id' });
    repository.findEvidenceByWhatsappMessage.mockResolvedValue(null);
    repository.createEvidence.mockResolvedValue({ id: 'evidence-id' });
    repository.createImageMessage.mockResolvedValue({ id: 'message-id' });
    repository.touchSession.mockResolvedValue({ id: 'session-id' });
    repository.findNote.mockResolvedValue({ id: 'note-id', noteText: 'Existing note.' });
    repository.updateNote.mockResolvedValue({ id: 'note-id', noteText: 'Existing note.\n\nAI Image Observation:' });
  });

  afterEach(() => {
    rmSync(join(process.cwd(), 'private'), { recursive: true, force: true });
  });

  it('creates a care seeker if phone does not exist and stores image analysis evidence', async () => {
    await service.createImageAnalysis(dto, file);

    expect(repository.createCareSeeker).toHaveBeenCalledWith('919999999999');
    expect(repository.createEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        aiAnalysisStatus: 'COMPLETED',
        aiConfidence: 0.72,
        aiSummary: 'Image observation saved.',
        whatsappMessageId: 'wamid-1',
      }),
    );
  });

  it('reuses existing care seeker, session, incident, and case', async () => {
    repository.findCareSeekerByPhone.mockResolvedValue({ id: 'care-seeker-id' });
    repository.findSession.mockResolvedValue({ id: 'session-id' });
    repository.findIncident.mockResolvedValue({ id: 'incident-id' });
    repository.findCase.mockResolvedValue({ id: 'case-id' });

    await service.createImageAnalysis({ ...dto, sessionId: 'session-id', incidentId: 'incident-id', caseId: 'case-id' }, file);

    expect(repository.createCareSeeker).not.toHaveBeenCalled();
    expect(repository.createSession).not.toHaveBeenCalled();
    expect(repository.createDraftIncident).not.toHaveBeenCalled();
    expect(repository.createDraftCase).not.toHaveBeenCalled();
  });

  it('stores media observation without mutating existing case note text', async () => {
    const result = await service.createImageAnalysis(dto, file);

    expect(result.caseNoteId).toBe('note-id');
    expect(result.mediaObservationSaved).toBe(true);
    expect(repository.updateNote).not.toHaveBeenCalled();
    expect(repository.createNote).not.toHaveBeenCalled();
  });

  it('does not create case notes when only a media observation is received', async () => {
    repository.findOpenCaseByCareSeeker.mockResolvedValue({ id: 'case-id', notes: 'Previous case note text.' });
    repository.findNote.mockResolvedValue(null);

    await service.createImageAnalysis(dto, file);

    expect(repository.createNote).not.toHaveBeenCalled();
    expect(repository.updateNote).not.toHaveBeenCalled();
    expect(repository.updateCaseConfidence).toHaveBeenCalledWith('case-id', expect.any(Number));
  });

  it('rejects invalid aiAnalysisJson', async () => {
    await expect(service.createImageAnalysis({ ...dto, aiAnalysisJson: '{bad json' }, file)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects non-image file', async () => {
    await expect(service.createImageAnalysis(dto, { ...file, mimetype: 'application/pdf' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('prevents duplicate evidence for same whatsappMessageId and hash', async () => {
    repository.findEvidenceByWhatsappMessage.mockResolvedValue({
      id: 'existing-evidence-id',
      sha256Hash: '6105d6cc76af400325e94d588ce511be5bfdbb73b437dc51eca43917d7a43e3d',
    });

    const result = await service.createImageAnalysis(dto, file);

    expect(result.evidenceId).toBe('existing-evidence-id');
    expect(repository.createEvidence).not.toHaveBeenCalled();
  });

  it('recalculates cautious confidence for image-only evidence', async () => {
    await service.createImageAnalysis(dto, file);

    expect(repository.updateIncidentConfidence).toHaveBeenCalledWith(
      'incident-id',
      expect.any(Number),
    );
    const confidence = repository.updateIncidentConfidence.mock.calls[0][1];
    expect(confidence).toBeLessThanOrEqual(0.55);
  });
});
