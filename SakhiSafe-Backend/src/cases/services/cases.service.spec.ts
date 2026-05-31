import { CasesService } from './cases.service';

describe('CasesService', () => {
  const repository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
  };
  const service = new CasesService(repository as any);

  it('connects related entities when creating a case', async () => {
    repository.create.mockResolvedValue({ id: 'case-id' });
    await service.create({ title: 'Safety follow-up', personAtRiskId: 'person-id' }, 'creator-id');
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        personAtRisk: { connect: { id: 'person-id' } },
        createdBy: { connect: { id: 'creator-id' } },
      }),
    );
  });
});
