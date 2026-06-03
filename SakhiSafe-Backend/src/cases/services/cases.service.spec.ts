import { CasesService } from './cases.service';

describe('CasesService', () => {
  const repository = {
    careSeekerExists: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
  };
  const service = new CasesService(repository as any);

  it('connects related entities when creating a case', async () => {
    repository.careSeekerExists.mockResolvedValue({ id: 'care-seeker-id' });
    repository.create.mockResolvedValue({ id: 'case-id' });
    await service.create({ title: 'Safety follow-up', careSeekerId: 'care-seeker-id' }, 'creator-id');
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        careSeeker: { connect: { id: 'care-seeker-id' } },
        createdBy: { connect: { id: 'creator-id' } },
      }),
    );
  });
});
