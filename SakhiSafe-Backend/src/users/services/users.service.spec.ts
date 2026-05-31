import { ConfigService } from '@nestjs/config';
import { RoleName } from '@prisma/client';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const repository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    update: jest.fn(),
  };
  const service = new UsersService(repository as any, { get: () => 4 } as unknown as ConfigService);

  it('creates a user with a hashed password and default role', async () => {
    repository.create.mockResolvedValue({ id: 'user-id' });
    await service.create({ email: 'test@example.com', password: 'Password123', name: 'Test User' });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@example.com', passwordHash: expect.any(String) }),
      [RoleName.NGO_WORKER],
    );
  });
});
