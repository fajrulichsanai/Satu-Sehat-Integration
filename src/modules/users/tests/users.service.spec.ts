import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from '../users.service';
import { User } from '../entities/user.entity';
import { Practitioner } from '../../practitioners/entities/practitioner.entity';

const mockRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue([]),
};

const mockPractitionerRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
        {
          provide: getRepositoryToken(Practitioner),
          useValue: mockPractitionerRepo,
        },
      ],
    }).compile();
    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => expect(service).toBeDefined());

  const owner = { userId: 1, role: 'owner' as any, clinicId: 1 };

  describe('findOne', () => {
    it('should throw NotFoundException if user not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999, owner)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('activate', () => {
    it('should throw NotFoundException if user not in clinic', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.activate(999, owner)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should activate pending user', async () => {
      const user = { id: 2, clinicId: 1, isActive: false, role: 'pending' };
      mockRepo.findOne.mockResolvedValue(user);
      mockRepo.save.mockResolvedValue({ ...user, isActive: true });
      await service.activate(2, owner);
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });
});
