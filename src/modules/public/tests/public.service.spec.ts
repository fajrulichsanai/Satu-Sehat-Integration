import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { PublicService } from '../public.service';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { Practitioner } from '../../practitioners/entities/practitioner.entity';
import { ReservationsService } from '../../reservations/reservations.service';

describe('PublicService', () => {
  let service: PublicService;
  let clinicRepo: { findOne: jest.Mock };
  let practitionerRepo: { find: jest.Mock };
  let reservationsService: {
    createPublic: jest.Mock;
    getStatusByToken: jest.Mock;
    getBookedSlots: jest.Mock;
    cancelByToken: jest.Mock;
  };

  beforeEach(async () => {
    clinicRepo = { findOne: jest.fn() };
    practitionerRepo = { find: jest.fn().mockResolvedValue([]) };
    reservationsService = {
      createPublic: jest.fn(),
      getStatusByToken: jest.fn(),
      getBookedSlots: jest.fn().mockResolvedValue([]),
      cancelByToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicService,
        { provide: getRepositoryToken(Clinic), useValue: clinicRepo },
        {
          provide: getRepositoryToken(Practitioner),
          useValue: practitionerRepo,
        },
        { provide: ReservationsService, useValue: reservationsService },
      ],
    }).compile();

    service = module.get<PublicService>(PublicService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('getClinicInfo', () => {
    it('returns the clinic with its active practitioners when active/setup-complete (positive)', async () => {
      clinicRepo.findOne.mockResolvedValue({ id: 1, name: 'Klinik A' });
      practitionerRepo.find.mockResolvedValue([{ id: 2, name: 'drg. Budi' }]);

      const result = await service.getClinicInfo(1);

      expect(result.name).toBe('Klinik A');
      expect(result.practitioners).toEqual([{ id: 2, name: 'drg. Budi' }]);
      expect(practitionerRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clinicId: 1, isActive: true } }),
      );
    });

    it('throws NotFoundException when clinic is missing or not set up (negative)', async () => {
      clinicRepo.findOne.mockResolvedValue(null);
      await expect(service.getClinicInfo(999)).rejects.toThrow(
        NotFoundException,
      );
      expect(clinicRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 999, setupComplete: true },
        }),
      );
    });
  });

  describe('createReservation', () => {
    it('returns a trimmed-down reservation confirmation (positive)', async () => {
      reservationsService.createPublic.mockResolvedValue({
        token: 'TOK123',
        reservationDate: '2026-06-15',
        jamSlot: '09:00',
        patientName: 'Budi',
        practitionerId: 2,
        status: 'pending',
        internalField: 'should not leak',
      });

      const result = await service.createReservation({} as any);

      expect(result).toEqual({
        token: 'TOK123',
        reservationDate: '2026-06-15',
        jamSlot: '09:00',
        patientName: 'Budi',
        practitionerId: 2,
        status: 'pending',
      });
    });
  });

  describe('getReservationStatus', () => {
    it('shapes the response and resolves the practitioner name from the relation (positive)', async () => {
      reservationsService.getStatusByToken.mockResolvedValue({
        token: 'TOK123',
        patientName: 'Budi',
        reservationDate: '2026-06-15',
        jamSlot: '09:00',
        status: 'confirmed',
        practitionerId: 2,
        practitioner: { id: 2, name: 'drg. Budi' },
      });

      const result = await service.getReservationStatus({
        token: 'TOK123',
      } as any);

      expect(result).toEqual({
        token: 'TOK123',
        patientName: 'Budi',
        reservationDate: '2026-06-15',
        jamSlot: '09:00',
        status: 'confirmed',
        practitionerId: 2,
        practitionerName: 'drg. Budi',
      });
    });

    it('reports a null practitionerName when no practitioner is linked (edge)', async () => {
      reservationsService.getStatusByToken.mockResolvedValue({
        token: 'TOK123',
        patientName: 'Budi',
        reservationDate: '2026-06-15',
        jamSlot: '09:00',
        status: 'pending',
        practitionerId: null,
        practitioner: null,
      });

      const result = await service.getReservationStatus({
        token: 'TOK123',
      } as any);
      expect(result.practitionerName).toBeNull();
    });
  });

  describe('cancelReservation', () => {
    it('delegates to reservationsService and returns token/status (positive)', async () => {
      reservationsService.cancelByToken.mockResolvedValue({
        token: 'TOK123',
        status: 'cancelled',
        internalField: 'should not leak',
      });

      const result = await service.cancelReservation('TOK123');

      expect(reservationsService.cancelByToken).toHaveBeenCalledWith('TOK123');
      expect(result).toEqual({ token: 'TOK123', status: 'cancelled' });
    });
  });

  describe('getAvailableSlots', () => {
    it('generates 30-minute slots within operational hours (positive)', async () => {
      clinicRepo.findOne.mockResolvedValue({
        id: 1,
        operationalHours: { senin: '08:00-09:30' },
      });

      const result = await service.getAvailableSlots({
        clinicId: 1,
        date: '2026-06-15', // a Monday
      } as any);

      expect(result.isOpen).toBe(true);
      expect(result.slots).toEqual(['08:00', '08:30', '09:00']);
    });

    it('excludes slots already booked (positive)', async () => {
      clinicRepo.findOne.mockResolvedValue({
        id: 1,
        operationalHours: { senin: '08:00-09:30' },
      });
      reservationsService.getBookedSlots.mockResolvedValue(['08:30']);

      const result = await service.getAvailableSlots({
        clinicId: 1,
        date: '2026-06-15',
      } as any);

      expect(result.slots).toEqual(['08:00', '09:00']);
    });

    it('reports isOpen=false with no slots when the clinic is closed that day (negative/edge)', async () => {
      clinicRepo.findOne.mockResolvedValue({
        id: 1,
        operationalHours: { senin: 'Tutup' },
      });

      const result = await service.getAvailableSlots({
        clinicId: 1,
        date: '2026-06-15',
      } as any);

      expect(result).toEqual({ date: '2026-06-15', isOpen: false, slots: [] });
      expect(reservationsService.getBookedSlots).not.toHaveBeenCalled();
    });

    it('reports isOpen=false when no operational hours are configured for that day (negative/edge)', async () => {
      clinicRepo.findOne.mockResolvedValue({
        id: 1,
        operationalHours: {},
      });

      const result = await service.getAvailableSlots({
        clinicId: 1,
        date: '2026-06-15',
      } as any);

      expect(result.isOpen).toBe(false);
    });

    it('throws NotFoundException when the clinic is missing or inactive (negative)', async () => {
      clinicRepo.findOne.mockResolvedValue(null);
      await expect(
        service.getAvailableSlots({ clinicId: 999, date: '2026-06-15' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('passes practitionerId through to getBookedSlots when filtering by doctor (positive)', async () => {
      clinicRepo.findOne.mockResolvedValue({
        id: 1,
        operationalHours: { senin: '08:00-09:00' },
      });

      await service.getAvailableSlots({
        clinicId: 1,
        date: '2026-06-15',
        practitionerId: 5,
      } as any);

      expect(reservationsService.getBookedSlots).toHaveBeenCalledWith(
        1,
        '2026-06-15',
        5,
      );
    });

    describe('past-time filtering for today', () => {
      beforeEach(() => {
        // 2026-06-15T10:30:00Z = 17:30 WIB (Monday)
        jest.useFakeTimers().setSystemTime(new Date('2026-06-15T10:30:00Z'));
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it("excludes slots already past in the clinic's timezone for today (edge)", async () => {
        clinicRepo.findOne.mockResolvedValue({
          id: 1,
          operationalHours: { senin: '08:00-20:00' },
        });

        const result = await service.getAvailableSlots({
          clinicId: 1,
          date: '2026-06-15',
        } as any);

        expect(result.slots).toEqual(['18:00', '18:30', '19:00', '19:30']);
      });

      it('does not filter slots for a future date (edge)', async () => {
        clinicRepo.findOne.mockResolvedValue({
          id: 1,
          operationalHours: { selasa: '08:00-09:00' },
        });

        const result = await service.getAvailableSlots({
          clinicId: 1,
          date: '2026-06-16',
        } as any);

        expect(result.slots).toEqual(['08:00', '08:30']);
      });
    });
  });
});
