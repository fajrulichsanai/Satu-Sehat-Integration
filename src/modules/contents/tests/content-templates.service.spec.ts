import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContentTemplatesService } from '../content-templates.service';

describe('ContentTemplatesService', () => {
  let service: ContentTemplatesService;
  let taken: boolean;
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    exists: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  beforeEach(() => {
    taken = false;
    const qb = {
      where: jest.fn().mockReturnThis(),
      getExists: jest.fn(() => Promise.resolve(taken)),
    };
    repo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      exists: jest.fn(),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((d) => Promise.resolve({ id: 1, ...d })),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(() => qb),
    };
    service = new ContentTemplatesService(repo as any);
  });

  it('creates a template, using the name as the headline by default (positive)', async () => {
    const t = await service.create(5, 9, { name: '  Tambal ' });
    expect(t).toEqual(
      expect.objectContaining({
        clinicId: 5,
        name: 'Tambal',
        title: 'Tambal',
        showDisclaimer: true,
      }),
    );
  });

  it('refuses a second template with the same name, ignoring case (negative)', async () => {
    taken = true;
    await expect(
      service.create(5, 9, { name: 'tambal' } as any),
    ).rejects.toThrow(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('keeps the same name on update without a duplicate check (positive)', async () => {
    taken = true; // the template's own row
    repo.findOne.mockResolvedValue({
      id: 1,
      clinicId: 5,
      name: 'Tambal',
      title: 'Tambal',
    });
    const t = await service.update(1, 5, 9, {
      name: 'TAMBAL',
      title: 'Tambal estetik',
    });
    expect(t.name).toBe('TAMBAL');
    expect(t.title).toBe('Tambal estetik');
  });

  it("only finds the clinic's own templates (negative)", async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findOne(1, 6)).rejects.toThrow(NotFoundException);
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 1, clinicId: 6 },
    });
  });

  it('assertOwned passes for none or an own template, fails for others', async () => {
    await expect(service.assertOwned(5, null)).resolves.toBeUndefined();
    repo.exists.mockResolvedValue(true);
    await expect(service.assertOwned(5, 7)).resolves.toBeUndefined();
    repo.exists.mockResolvedValue(false);
    await expect(service.assertOwned(5, 8)).rejects.toThrow(
      BadRequestException,
    );
    expect(repo.exists).toHaveBeenLastCalledWith({
      where: { id: 8, clinicId: 5 },
    });
  });
});
