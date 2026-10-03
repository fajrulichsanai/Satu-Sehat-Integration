import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataRequestsService } from '../data-requests.service';
import {
  DataRequestStatus,
  DataRequestType,
} from '../entities/data-request.entity';

jest.mock('resend', () => ({
  Resend: jest
    .fn()
    .mockImplementation(() => ({
      emails: { send: jest.fn().mockResolvedValue({}) },
    })),
}));

describe('DataRequestsService', () => {
  let service: DataRequestsService;
  let repo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let userRepo: { find: jest.Mock; findOne: jest.Mock };
  let clinicRepo: { findOne: jest.Mock };

  beforeEach(() => {
    repo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((d) => Promise.resolve({ id: 1, ...d })),
    };
    userRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };
    clinicRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 5, name: 'Klinik A' }),
    };
    const config = { get: jest.fn((_k: string, d?: string) => d) };
    service = new DataRequestsService(
      repo as any,
      userRepo as any,
      clinicRepo as any,
      config as any,
    );
  });

  describe('create', () => {
    it('saves a pending request for the clinic (positive)', async () => {
      repo.findOne.mockResolvedValue(null);
      const result = await service.create(5, 9, {
        type: DataRequestType.EXPORT,
        reason: '  pindah sistem  ',
      });
      expect(result).toMatchObject({
        clinicId: 5,
        requestedById: 9,
        type: DataRequestType.EXPORT,
        reason: 'pindah sistem',
        status: DataRequestStatus.PENDING,
      });
    });

    it('refuses a second open request of the same type (negative)', async () => {
      repo.findOne.mockResolvedValue({
        id: 3,
        status: DataRequestStatus.PENDING,
      });
      await expect(
        service.create(5, 9, { type: DataRequestType.CLOSE_ACCOUNT }),
      ).rejects.toThrow(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('completes an open request and stamps who handled it (positive)', async () => {
      repo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 5,
        requestedById: 9,
        status: DataRequestStatus.PENDING,
        adminNote: null,
      });
      const result = await service.update(1, 2, {
        status: DataRequestStatus.COMPLETED,
        adminNote: 'File dikirim ke email',
      });
      expect(result.status).toBe(DataRequestStatus.COMPLETED);
      expect(result.handledById).toBe(2);
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(result.adminNote).toBe('File dikirim ke email');
    });

    it('requires a reason when rejecting (negative)', async () => {
      repo.findOne.mockResolvedValue({
        id: 1,
        status: DataRequestStatus.PENDING,
      });
      await expect(
        service.update(1, 2, { status: DataRequestStatus.REJECTED }),
      ).rejects.toThrow(BadRequestException);
    });

    it('does not reopen a finished request (negative)', async () => {
      repo.findOne.mockResolvedValue({
        id: 1,
        status: DataRequestStatus.COMPLETED,
      });
      await expect(
        service.update(1, 2, { status: DataRequestStatus.IN_PROGRESS }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFound for an unknown request (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.update(99, 2, { status: DataRequestStatus.COMPLETED }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
