import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { PublicService } from '../public.service';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { ReservationsService } from '../../reservations/reservations.service';

describe('PublicService', () => {
  let service: PublicService;
  let clinicRepo: { findOne: jest.Mock };
  let reservationsService: {
    createPublic: jest.Mock;
    getStatusByToken: jest.Mock;
    getBookedSlots: jest.Mock;
  };

  beforeEach(async () => {
    clinicRepo = { findOne: jest.fn() };
    reservationsService = {
      createPublic: jest.fn(),
      getStatusByToken: jest.fn(),
      getBookedSlots: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicService,
        { provide: getRepositoryToken(Clinic), useValue: clinicRepo },
        { provide: ReservationsService, useValue: reservationsService },
      ],
    }).compile();

    service = module.get<PublicService>(PublicService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('getClinicInfo', () => {
    it('returns the clinic when active/setup-complete (positive)', async () => {
      clinicRepo.findOne.mockResolvedValue({ id: 1, name: 'Klinik A' });
      const result = await service.getClinicInfo(1);
      expect(result.name).toBe('Klinik A');
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
        status: 'pending',
        internalField: 'should not leak',
      });

      const result = await service.createReservation({} as any);

      expect(result).toEqual({
        token: 'TOK123',
        reservationDate: '2026-06-15',
        jamSlot: '09:00',
        patientName: 'Budi',
        status: 'pending',
      });
    });
  });

  describe('getReservationStatus', () => {
    it('delegates to reservationsService by token (positive)', async () => {
      reservationsService.getStatusByToken.mockResolvedValue({ status: 'confirmed' });
      const result = await service.getReservationStatus({ token: 'TOK123' } as any);
      expect(result.status).toBe('confirmed');
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
  });
});
