import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReservationsService } from '../reservations.service';
import { Reservation } from '../entities/reservation.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { ReservationSource, ReservationStatus } from '../../../enums';

describe('ReservationsService', () => {
  let service: ReservationsService;

  const mockReservationRepository = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockClinicRepository = {
    findOne: jest.fn(),
  };

  const mockPatientRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        {
          provide: getRepositoryToken(Reservation),
          useValue: mockReservationRepository,
        },
        { provide: getRepositoryToken(Clinic), useValue: mockClinicRepository },
        {
          provide: getRepositoryToken(Patient),
          useValue: mockPatientRepository,
        },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const clinicId = 1;
    const baseDto = {
      patientName: 'Budi Santoso',
      reservationDate: '2026-06-12',
      jamSlot: '09:00',
    } as any;

    it('rejects when there is no phone and no existing patient (negative)', async () => {
      await expect(service.create(clinicId, baseDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockReservationRepository.save).not.toHaveBeenCalled();
    });

    it('rejects when patientId does not belong to the clinic (negative)', async () => {
      mockPatientRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create(clinicId, { ...baseDto, patientId: 99 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates a reservation from a manual phone entry (positive)', async () => {
      mockReservationRepository.create.mockImplementation((r) => r);
      mockReservationRepository.save.mockImplementation((r) =>
        Promise.resolve({ id: 1, ...r }),
      );

      const result = await service.create(clinicId, {
        ...baseDto,
        patientPhone: '08123456789',
      });

      expect(result.status).toBe(ReservationStatus.PENDING);
      expect(result.source).toBe(ReservationSource.DASHBOARD);
      expect(result.patientPhone).toBe('08123456789');
    });

    it('backfills the phone from the linked patient when not provided (positive)', async () => {
      mockPatientRepository.findOne.mockResolvedValue({
        id: 5,
        clinicId,
        phone: '08199998888',
      });
      mockReservationRepository.create.mockImplementation((r) => r);
      mockReservationRepository.save.mockImplementation((r) =>
        Promise.resolve({ id: 2, ...r }),
      );

      const result = await service.create(clinicId, {
        ...baseDto,
        patientId: 5,
      });

      expect(result.patientPhone).toBe('08199998888');
    });
  });

  describe('createPublic', () => {
    const dto = {
      clinicId: 1,
      patientName: 'Budi',
      patientPhone: '08123456789',
      reservationDate: '2026-06-12',
    } as any;

    it('rejects when the clinic does not exist or setup is incomplete (negative)', async () => {
      mockClinicRepository.findOne.mockResolvedValue(null);

      await expect(service.createPublic(dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('creates a public (website) reservation for an active clinic (positive)', async () => {
      mockClinicRepository.findOne.mockResolvedValue({
        id: 1,
        setupComplete: true,
      });
      mockReservationRepository.create.mockImplementation((r) => r);
      mockReservationRepository.save.mockImplementation((r) =>
        Promise.resolve({ id: 3, ...r }),
      );

      const result = await service.createPublic(dto);

      expect(result.source).toBe(ReservationSource.WEBSITE);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the reservation does not exist for the clinic (negative)', async () => {
      mockReservationRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(1, 1)).rejects.toThrow(NotFoundException);
    });

    it('returns the reservation when found (positive)', async () => {
      const reservation = { id: 1, clinicId: 1 };
      mockReservationRepository.findOne.mockResolvedValue(reservation);

      await expect(service.findOne(1, 1)).resolves.toBe(reservation);
    });
  });

  describe('updateStatus', () => {
    it('rejects an illegal transition, e.g. completed -> confirmed (negative)', async () => {
      mockReservationRepository.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        status: ReservationStatus.COMPLETED,
      });

      await expect(
        service.updateStatus(1, 1, { status: ReservationStatus.CONFIRMED }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects skipping straight from pending to completed (negative)', async () => {
      mockReservationRepository.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        status: ReservationStatus.PENDING,
      });

      await expect(
        service.updateStatus(1, 1, { status: ReservationStatus.COMPLETED }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows pending -> confirmed and stamps confirmedAt (positive)', async () => {
      const reservation = {
        id: 1,
        clinicId: 1,
        status: ReservationStatus.PENDING,
      };
      mockReservationRepository.findOne.mockResolvedValue(reservation);
      mockReservationRepository.save.mockImplementation((r) =>
        Promise.resolve(r),
      );

      const result = await service.updateStatus(1, 1, {
        status: ReservationStatus.CONFIRMED,
      });

      expect(result.status).toBe(ReservationStatus.CONFIRMED);
      expect(result.confirmedAt).toBeInstanceOf(Date);
    });

    it('allows pending -> cancelled with a reason (positive)', async () => {
      const reservation = {
        id: 1,
        clinicId: 1,
        status: ReservationStatus.PENDING,
      };
      mockReservationRepository.findOne.mockResolvedValue(reservation);
      mockReservationRepository.save.mockImplementation((r) =>
        Promise.resolve(r),
      );

      const result = await service.updateStatus(1, 1, {
        status: ReservationStatus.CANCELLED,
        cancelledReason: 'Pasien membatalkan',
      });

      expect(result.status).toBe(ReservationStatus.CANCELLED);
      expect(result.cancelledReason).toBe('Pasien membatalkan');
    });
  });

  describe('reschedule', () => {
    it('rejects rescheduling a cancelled reservation (negative)', async () => {
      mockReservationRepository.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        status: ReservationStatus.CANCELLED,
      });

      await expect(
        service.reschedule(1, 1, { reservationDate: '2026-07-01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects rescheduling a completed reservation (negative)', async () => {
      mockReservationRepository.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        status: ReservationStatus.COMPLETED,
      });

      await expect(
        service.reschedule(1, 1, { reservationDate: '2026-07-01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('reschedules a pending reservation to a new date/slot (positive)', async () => {
      const reservation = {
        id: 1,
        clinicId: 1,
        status: ReservationStatus.PENDING,
        reservationDate: '2026-06-12',
        jamSlot: '09:00',
      };
      mockReservationRepository.findOne.mockResolvedValue(reservation);
      mockReservationRepository.save.mockImplementation((r) =>
        Promise.resolve(r),
      );

      const result = await service.reschedule(1, 1, {
        reservationDate: '2026-07-01',
        jamSlot: '14:00',
      });

      expect(result.reservationDate).toBe('2026-07-01');
      expect(result.jamSlot).toBe('14:00');
    });
  });

  describe('linkPatient', () => {
    it('rejects linking a patient to a completed reservation (negative)', async () => {
      mockReservationRepository.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        status: ReservationStatus.COMPLETED,
      });

      await expect(service.linkPatient(1, 1, { patientId: 5 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('links a patient to a pending reservation (positive)', async () => {
      const reservation = {
        id: 1,
        clinicId: 1,
        status: ReservationStatus.PENDING,
        patientId: undefined,
      };
      mockReservationRepository.findOne.mockResolvedValue(reservation);
      mockReservationRepository.save.mockImplementation((r) =>
        Promise.resolve(r),
      );

      const result = await service.linkPatient(1, 1, { patientId: 5 });

      expect(result.patientId).toBe(5);
    });
  });

  describe('remove', () => {
    it('throws when the reservation to delete does not exist (negative)', async () => {
      mockReservationRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(1, 1)).rejects.toThrow(NotFoundException);
      expect(mockReservationRepository.remove).not.toHaveBeenCalled();
    });

    it('removes an existing reservation (positive)', async () => {
      const reservation = { id: 1, clinicId: 1 };
      mockReservationRepository.findOne.mockResolvedValue(reservation);
      mockReservationRepository.remove.mockResolvedValue(reservation);

      await service.remove(1, 1);

      expect(mockReservationRepository.remove).toHaveBeenCalledWith(
        reservation,
      );
    });
  });

  describe('getStatusByToken', () => {
    it('throws NotFoundException for an unknown token (negative)', async () => {
      mockReservationRepository.findOne.mockResolvedValue(null);

      await expect(service.getStatusByToken('BADTOKEN')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the reservation status for a known token (positive)', async () => {
      const reservation = {
        id: 1,
        token: 'GOODTOKEN',
        status: ReservationStatus.PENDING,
      };
      mockReservationRepository.findOne.mockResolvedValue(reservation);

      await expect(service.getStatusByToken('GOODTOKEN')).resolves.toBe(
        reservation,
      );
    });
  });

  describe('generateToken', () => {
    it('generates an 8-character alphanumeric token (positive)', () => {
      const token = service.generateToken();
      expect(token).toMatch(/^[A-Z0-9]{8}$/);
    });
  });
});
