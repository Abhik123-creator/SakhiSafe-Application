import { CareSeekersService } from './care-seekers.service';

describe('CareSeekersService intake', () => {
  const repository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    findByPhone: jest.fn(),
    findByPhoneNumbers: jest.fn(),
    update: jest.fn(),
  };
  const service = new CareSeekersService(repository as any);

  beforeEach(() => jest.clearAllMocks());

  it('creates a care seeker for a new phone number', async () => {
    repository.findByPhoneNumbers.mockResolvedValue(null);
    repository.create.mockResolvedValue({ id: 'care-seeker-id' });

    await service.getOrCreate({
      phoneNumber: '+91 99999 99999',
      whatsappPhoneNumber: '+91 99999 99999',
      displayName: 'WhatsApp Care Seeker',
      source: 'WHATSAPP',
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumber: '919999999999',
        whatsappPhoneNumber: '919999999999',
        displayName: 'WhatsApp Care Seeker',
        source: 'WHATSAPP',
      }),
    );
  });

  it('reuses an existing care seeker for the same phone number', async () => {
    const existing = { id: 'care-seeker-id' };
    repository.findByPhoneNumbers.mockResolvedValue(existing);

    const result = await service.getOrCreate({ phoneNumber: '+919999999999', source: 'WHATSAPP' });

    expect(result).toBe(existing);
    expect(repository.create).not.toHaveBeenCalled();
  });
});
