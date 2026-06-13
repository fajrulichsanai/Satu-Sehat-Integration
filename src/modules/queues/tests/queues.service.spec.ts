import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QueuesService } from '../queues.service';
import { Queue } from '../entities/queue.entity';
import { Practitioner } from '../../practitioners/entities/practitioner.entity';
import { DataSource } from 'typeorm';

const mockQueueRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnThis(),
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  query: jest.fn(),
};
const mockPractitionerRepo = { findOne: jest.fn() };
const mockDataSource = { transaction: jest.fn() };

describe('QueuesService', () => {
  let service: QueuesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueuesService,
        { provide: getRepositoryToken(Queue), useValue: mockQueueRepo },
        {
          provide: getRepositoryToken(Practitioner),
          useValue: mockPractitionerRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();
    service = module.get<QueuesService>(QueuesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('updateStatus', () => {
    it('should throw NotFoundException if queue not found', async () => {
      mockQueueRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateStatus(999, 1, { status: 'called' as any }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid transition', async () => {
      mockQueueRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        status: 'done',
      });
      await expect(
        service.updateStatus(1, 1, { status: 'waiting' as any }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
