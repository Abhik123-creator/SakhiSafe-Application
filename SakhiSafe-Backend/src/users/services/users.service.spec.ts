import { ConfigService } from '@nestjs/config';
import { RoleName } from '@prisma/client';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const repository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findByEvidenceAccessCodeHash: jest.fn(),
    update: jest.fn(),
  };
  const mailerService = {
    sendMail: jest.fn(),
  };
  const service = new UsersService(
    repository as any,
    { get: (key: string) => (key === 'auth.bcryptSaltRounds' ? 4 : 'test-secret') } as unknown as ConfigService,
    mailerService as any,
  );

  it('creates a user with a hashed password and default role', async () => {
    repository.create.mockResolvedValue({ id: 'user-id', email: 'test@example.com', fullName: 'Test User' });
    repository.findByEvidenceAccessCodeHash.mockResolvedValue(null);
    await service.create({ email: 'test@example.com', password: 'Password123', fullName: 'Test User' });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@example.com',
        passwordHash: expect.any(String),
        evidenceAccessCodeHash: expect.any(String),
        evidenceAccessCodeIssuedAt: expect.any(Date),
      }),
      [RoleName.ORGANIZATION],
    );
    expect(mailerService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: 'Your SakhiSafe evidence access code',
        text: expect.stringMatching(/\b\d{6}\b/),
      }),
    );
  });
});
