import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReservationsService } from '../reservations.service';
import { Reservation } from '../entities/reservation.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { ReservationSource, ReservationStatus } from '../../../enums';

function buildQb(overrides: Partial<Record<string, any>> = {}) {
  return {
    select: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    ...overrides,
  };
}

describe('ReservationsService', () => {
  let service: ReservationsService;
  let reservationRepo: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };
  let clinicRepo: { findOne: jest.Mock };
  let patientRepo: { findOne: jest.Mock };

  const clinicId = 1;

  beforeEach(async () => {
    reservationRepo = {
      createQueryBuilder: jest.fn(() => buildQb()),
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    clinicRepo = { findOne: jest.fn() };
    patientRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: getRepositoryToken(Reservation), useValue: reservationRepo },
        { provide: getRepositoryToken(Clinic), useValue: clinicRepo },
        { provide: getRepositoryToken(Patient), useValue: patientRepo },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('getBookedSlots', () => {
    it('normalizes jamSlot values to HH:MM (positive)', async () => {
      const qb = buildQb({
        getRawMany: jest.fn().mockResolvedValue([{ jamSlot: '09:00:00' }]),
      });
      reservationRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getBookedSlots(clinicId, '2026-06-15');

      expect(result).toEqual(['09:00']);
    });

    it('excludes cancelled reservations via the query filter (positive)', async () => {
      const qb = buildQb();
      reservationRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getBookedSlots(clinicId, '2026-06-15');

      expect(qb.andWhere).toHaveBeenCalledWith('r.status != :cancelled', {
        cancelled: ReservationStatus.CANCELLED,
      });
    });

    it('filters by practitionerId only when provided (positive/edge)', async () => {
      const qb = buildQb();
      reservationRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getBookedSlots(clinicId, '2026-06-15', 5);

      expect(qb.andWhere).toHaveBeenCalledWith('r.practitionerId = :practitionerId', {
        practitionerId: 5,
      });
    });
  });

  describe('findOne', () => {
    it('returns the reservation when found (positive)', async () => {
      reservationRepo.findOne.mockResolvedValue({ id: 1, clinicId });
      const result = await service.findOne(1, clinicId);
      expect(result).toEqual({ id: 1, clinicId });
    });

    it('throws NotFoundException when missing (negative)', async () => {
      reservationRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999, clinicId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates a reservation with an explicit phone number (positive)', async () => {
      const result = await service.create(clinicId, {
        patientName: 'Budi',
        patientPhone: '0812',
        reservationDate: '2026-06-15',
      } as any);

      expect(result.status).toBe(ReservationStatus.PENDING);
      expect(result.token).toHaveLength(8);
    });

    it('falls back to the linked patient’s phone when none is given (positive)', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 3, clinicId, phone: '0899' });

      const result = await service.create(clinicId, {
        patientId: 3,
        patientName: 'Budi',
        reservationDate: '2026-06-15',
      } as any);

      expect(result.patientPhone).toBe('0899');
    });

    it('trims whitespace from an explicitly given phone number (edge)', async () => {
      const result = await service.create(clinicId, {
        patientName: 'Budi',
        patientPhone: '  0812  ',
        reservationDate: '2026-06-15',
      } as any);
      expect(result.patientPhone).toBe('0812');
    });

    it('throws NotFoundException when the linked patient does not exist in the clinic (negative)', async () => {
      patientRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create(clinicId, {
          patientId: 999,
          patientName: 'Budi',
          reservationDate: '2026-06-15',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when no phone number is available at all (negative)', async () => {
      await expect(
        service.create(clinicId, {
          patientName: 'Budi',
          reservationDate: '2026-06-15',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('defaults source to DASHBOARD when not specified (edge)', async () => {
      const result = await service.create(clinicId, {
        patientName: 'Budi',
        patientPhone: '0812',
        reservationDate: '2026-06-15',
      } as any);
      expect(result.source).toBe(ReservationSource.DASHBOARD);
    });
  });

  describe('createPublic', () => {
    it('creates a WEBSITE-sourced reservation for an active clinic (positive)', async () => {
      clinicRepo.findOne.mockResolvedValue({ id: clinicId, setupComplete: true });

      const result = await service.createPublic({
        clinicId,
        patientName: 'Budi',
        patientPhone: '0812',
        reservationDate: '2026-06-15',
      } as any);

      expect(result.source).toBe(ReservationSource.WEBSITE);
    });

    it('throws NotFoundException for an inactive/missing clinic (negative)', async () => {
      clinicRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createPublic({ clinicId: 999 } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('allows PENDING -> CONFIRMED and stamps confirmedAt (positive)', async () => {
      reservationRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId,
        status: ReservationStatus.PENDING,
      });

      const result = await service.updateStatus(1, clinicId, {
        status: ReservationStatus.CONFIRMED,
      } as any);

      expect(result.status).toBe(ReservationStatus.CONFIRMED);
      expect(result.confirmedAt).toBeInstanceOf(Date);
    });

    it('allows CONFIRMED -> CANCELLED and records the reason (positive)', async () => {
      reservationRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId,
        status: ReservationStatus.CONFIRMED,
      });

      const result = await service.updateStatus(1, clinicId, {
        status: ReservationStatus.CANCELLED,
        cancelledReason: 'Pasien batal',
      } as any);

      expect(result.cancelledReason).toBe('Pasien batal');
    });

    it('rejects an illegal transition, e.g. PENDING -> COMPLETED (negative)', async () => {
      reservationRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId,
        status: ReservationStatus.PENDING,
      });
      await expect(
        service.updateStatus(1, clinicId, {
          status: ReservationStatus.COMPLETED,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects any transition out of a terminal COMPLETED state (negative)', async () => {
      reservationRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId,
        status: ReservationStatus.COMPLETED,
      });
      await expect(
        service.updateStatus(1, clinicId, {
          status: ReservationStatus.PENDING,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reschedule', () => {
    it('updates date and slot for an active reservation (positive)', async () => {
      reservationRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId,
        status: ReservationStatus.PENDING,
        reservationDate: '2026-06-15',
        jamSlot: '09:00',
      });

      const result = await service.reschedule(1, clinicId, {
        reservationDate: '2026-06-20',
        jamSlot: '10:00',
      } as any);

      expect(result.reservationDate).toBe('2026-06-20');
      expect(result.jamSlot).toBe('10:00');
    });

    it('throws BadRequestException when rescheduling a CANCELLED reservation (negative)', async () => {
      reservationRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId,
        status: ReservationStatus.CANCELLED,
      });
      await expect(
        service.reschedule(1, clinicId, { reservationDate: '2026-06-20' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when rescheduling a COMPLETED reservation (negative)', async () => {
      reservationRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId,
        status: ReservationStatus.COMPLETED,
      });
      await expect(
        service.reschedule(1, clinicId, { reservationDate: '2026-06-20' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('linkPatient', () => {
    it('links a patient to a PENDING reservation (positive)', async () => {
      reservationRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId,
        status: ReservationStatus.PENDING,
      });
      const result = await service.linkPatient(1, clinicId, { patientId: 5 } as any);
      expect(result.patientId).toBe(5);
    });

    it('throws BadRequestException for a CANCELLED reservation (negative)', async () => {
      reservationRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId,
        status: ReservationStatus.CANCELLED,
      });
      await expect(
        service.linkPatient(1, clinicId, { patientId: 5 } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('removes the reservation when found (positive)', async () => {
      const r = { id: 1, clinicId };
      reservationRepo.findOne.mockResolvedValue(r);
      await service.remove(1, clinicId);
      expect(reservationRepo.remove).toHaveBeenCalledWith(r);
    });

    it('throws NotFoundException when missing (negative)', async () => {
      reservationRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(999, clinicId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getStatusByToken', () => {
    it('returns the reservation for a valid token (positive)', async () => {
      reservationRepo.findOne.mockResolvedValue({ id: 1, token: 'TOK123' });
      const result = await service.getStatusByToken('TOK123');
      expect(result.token).toBe('TOK123');
    });

    it('throws NotFoundException for an unknown token (negative)', async () => {
      reservationRepo.findOne.mockResolvedValue(null);
      await expect(service.getStatusByToken('UNKNOWN')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('generateToken', () => {
    it('generates an 8-character alphanumeric token (positive)', () => {
      const token = service.generateToken();
      expect(token).toMatch(/^[A-Z0-9]{8}$/);
    });

    it('generates different tokens across calls with overwhelming probability (edge)', () => {
      const tokens = new Set(Array.from({ length: 20 }, () => service.generateToken()));
      expect(tokens.size).toBeGreaterThan(1);
    });
  });
});
