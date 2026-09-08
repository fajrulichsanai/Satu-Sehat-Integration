import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ConsentTemplatesService } from '../consent-templates.service';
import { ConsentTemplate } from '../entities/consent-template.entity';

describe('ConsentTemplatesService', () => {
  let service: ConsentTemplatesService;
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsentTemplatesService,
        { provide: getRepositoryToken(ConsentTemplate), useValue: repo },
      ],
    }).compile();

    service = module.get<ConsentTemplatesService>(ConsentTemplatesService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('findAll', () => {
    it('lists templates for the clinic ordered by id (positive)', async () => {
      repo.find.mockResolvedValue([{ id: 1 }]);
      const result = await service.findAll(1);
      expect(result).toHaveLength(1);
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clinicId: 1 } }),
      );
    });
  });

  describe('upsert', () => {
    it('updates an existing template for the tarif (positive)', async () => {
      repo.findOne.mockResolvedValue({ id: 1, title: 'Old' });
      await service.upsert(1, 5, { title: 'New', content: 'C' } as any, 9);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'New', updatedBy: 9 }),
      );
    });

    it('creates a new template when none exists yet (positive)', async () => {
      repo.findOne.mockResolvedValue(null);
      await service.upsert(1, 5, { title: 'New', content: 'C' } as any, 9);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ clinicId: 1, tarifId: 5, createdBy: 9 }),
      );
    });
  });

  describe('remove', () => {
    it('deletes the template when it exists (positive)', async () => {
      repo.findOne.mockResolvedValue({ id: 1 });
      await service.remove(1, 5);
      expect(repo.delete).toHaveBeenCalledWith({ id: 1 });
    });

    it('throws NotFoundException when no template is configured (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove(1, 5)).rejects.toThrow(NotFoundException);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  describe('findByTarif', () => {
    it('returns the template scoped to clinic+tarif (positive)', async () => {
      repo.findOne.mockResolvedValue({ id: 1 });
      const result = await service.findByTarif(1, 5);
      expect(result).toEqual({ id: 1 });
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { clinicId: 1, tarifId: 5 },
      });
    });
  });
});
