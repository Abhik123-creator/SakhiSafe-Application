import { ConversationSessionsService } from './conversation-sessions.service';

describe('ConversationSessionsService', () => {
  const repository = {
    careSeekerExists: jest.fn(),
    create: jest.fn(),
    findActive: jest.fn(),
    touch: jest.fn(),
  };
  const service = new ConversationSessionsService(repository as any);

  beforeEach(() => jest.clearAllMocks());

  it('reuses an active session', async () => {
    repository.careSeekerExists.mockResolvedValue({ id: 'care-seeker-id' });
    repository.findActive.mockResolvedValue({ id: 'session-id' });
    repository.touch.mockResolvedValue({ id: 'session-id' });

    await service.getOrCreateActive({ careSeekerId: 'care-seeker-id', channel: 'WHATSAPP' });

    expect(repository.touch).toHaveBeenCalledWith('session-id');
    expect(repository.create).not.toHaveBeenCalled();
  });
});
