import { IncidentsService } from './incidents.service';

describe('IncidentsService', () => {
  const repository = {
    careSeekerExists: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
    findActiveBySession: jest.fn(),
    findById: jest.fn(),
    findOpenBySession: jest.fn(),
    sessionBelongsToCareSeeker: jest.fn(),
    update: jest.fn(),
  };
  const service = new IncidentsService(repository as any);

  beforeEach(() => {
    jest.clearAllMocks();
    repository.careSeekerExists.mockResolvedValue({ id: 'care-seeker-id' });
    repository.sessionBelongsToCareSeeker.mockResolvedValue({ id: 'session-id' });
  });

  const aiUpsertDto = {
    careSeekerId: 'care-seeker-id',
    sessionId: 'session-id',
    source: 'WHATSAPP' as const,
    llmOutput: {
      title: 'Reported physical assault',
      summary: 'The care seeker reported assault.',
      description: 'The care seeker stated that her husband assaulted her at home.',
      category: 'DOMESTIC_VIOLENCE' as const,
      severity: 'HIGH' as const,
      urgency: 'URGENT' as const,
      riskSignals: ['physical assault'],
      missingFields: ['current safety'],
      needsHumanReview: false,
      aiConfidence: 0.82,
      caseNote: 'AI detected high risk.',
    },
  };

  it('creates the first AI incident for a session', async () => {
    repository.findOpenBySession.mockResolvedValue(null);
    repository.create.mockResolvedValue({ id: 'incident-id' });

    await service.aiUpsert(aiUpsertDto);

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Reported physical assault',
        status: 'OPEN',
        needsHumanReview: true,
        aiGenerated: true,
      }),
    );
  });

  it('updates the same incident on a second AI upsert for the same session', async () => {
    repository.findOpenBySession.mockResolvedValue({ id: 'incident-id', manuallyEdited: false });
    repository.update.mockResolvedValue({ id: 'incident-id' });

    await service.aiUpsert(aiUpsertDto);

    expect(repository.update).toHaveBeenCalledWith('incident-id', expect.any(Object));
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('does not create duplicate incidents for the same active session', async () => {
    repository.findOpenBySession.mockResolvedValue({ id: 'incident-id', manuallyEdited: false });

    await service.aiUpsert(aiUpsertDto);

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('forces human review for critical severity', async () => {
    repository.findOpenBySession.mockResolvedValue(null);
    repository.create.mockResolvedValue({ id: 'incident-id' });

    await service.aiUpsert({ ...aiUpsertDto, llmOutput: { ...aiUpsertDto.llmOutput, severity: 'CRITICAL' } });

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ needsHumanReview: true }));
  });

  it('returns organized admin incident list data', async () => {
    repository.findAll.mockResolvedValue({
      items: [
        {
          id: 'incident-id',
          title: 'Case title',
          careSeeker: { whatsappPhoneNumber: '919999999999', phoneNumber: null, phone: null },
          category: 'DOMESTIC_VIOLENCE',
          severity: 'HIGH',
          urgency: 'URGENT',
          status: 'OPEN',
          needsHumanReview: true,
          aiGenerated: true,
          updatedAt: new Date('2026-06-03T00:00:00.000Z'),
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });

    const result = await service.findAll({});

    expect(result.data[0]).toEqual(expect.objectContaining({ careSeekerPhoneNumber: '919999999999' }));
    expect(result.meta.total).toBe(1);
  });

  it('returns incident detail with conversation timeline', async () => {
    repository.findById.mockResolvedValue({
      id: 'incident-id',
      careSeeker: { id: 'care-seeker-id', fullName: 'Anonymous', displayName: null, source: 'WHATSAPP', status: 'ACTIVE' },
      session: {
        id: 'session-id',
        careSeekerId: 'care-seeker-id',
        channel: 'WHATSAPP',
        status: 'ACTIVE',
        startedAt: new Date(),
        lastMessageAt: new Date(),
        messages: [{ id: 'message-id', messageText: 'Help' }],
      },
    });

    const result = await service.findById('incident-id');

    expect(result.conversationMessagesTimeline).toEqual([{ id: 'message-id', messageText: 'Help' }]);
  });

  it('marks incident as manually edited on admin patch', async () => {
    repository.findById.mockResolvedValue({ id: 'incident-id', careSeeker: null, session: null });
    repository.update.mockResolvedValue({ id: 'incident-id' });

    await service.update('incident-id', { title: 'Corrected title' });

    expect(repository.update).toHaveBeenCalledWith(
      'incident-id',
      expect.objectContaining({ title: 'Corrected title', manuallyEdited: true }),
    );
  });

  it('active-by-session returns an existing active incident', async () => {
    repository.findActiveBySession.mockResolvedValue({ id: 'incident-id' });

    await expect(service.findActiveBySession('session-id')).resolves.toEqual({ id: 'incident-id' });
  });

  it('ensure-draft-for-session creates a draft when none exists', async () => {
    repository.findActiveBySession.mockResolvedValue(null);
    repository.create.mockResolvedValue({ id: 'incident-id', status: 'DRAFT' });

    await service.ensureDraftForSession({ careSeekerId: 'care-seeker-id', sessionId: 'session-id', source: 'WHATSAPP' });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Image evidence received from WhatsApp',
        status: 'DRAFT',
        category: 'UNKNOWN',
        severity: 'UNKNOWN',
        urgency: 'UNKNOWN',
      }),
    );
  });

  it('ensure-draft-for-session reuses an existing active incident', async () => {
    repository.findActiveBySession.mockResolvedValue({ id: 'incident-id', status: 'OPEN' });

    const result = await service.ensureDraftForSession({
      careSeekerId: 'care-seeker-id',
      sessionId: 'session-id',
      source: 'WHATSAPP',
    });

    expect(result).toEqual({ id: 'incident-id', status: 'OPEN' });
    expect(repository.create).not.toHaveBeenCalled();
  });
});
