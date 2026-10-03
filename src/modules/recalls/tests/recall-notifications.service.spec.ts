import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { RecallNotificationsService } from '../recall-notifications.service';
import { PatientRecall, PatientRecallStatus } from '../entities/patient-recall.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { User } from '../../users/entities/user.entity';

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({ id: 'mock' }) },
  })),
}));

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('RecallNotificationsService', () => {
  let service: RecallNotificationsService;
  let recallRepo: { find: jest.Mock; save: jest.Mock };
  let clinicRepo: { findOne: jest.Mock };
  let userRepo: { find: jest.Mock };

  beforeEach(async () => {
    recallRepo = { find: jest.fn(), save: jest.fn().mockResolvedValue(undefined) };
    clinicRepo = { findOne: jest.fn().mockResolvedValue({ id: 1, name: 'Klinik A' }) };
    userRepo = { find: jest.fn().mockResolvedValue([{ email: 'owner@x.com' }]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecallNotificationsService,
        { provide: ConfigService, useValue: { get: jest.fn(() => 'test') } },
        { provide: getRepositoryToken(PatientRecall), useValue: recallRepo },
        { provide: getRepositoryToken(Clinic), useValue: clinicRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get<RecallNotificationsService>(
      RecallNotificationsService,
    );
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('sends a reminder and stamps notifiedH1At for recalls due tomorrow (positive)', async () => {
    recallRepo.find.mockResolvedValue([
      {
        id: 1,
        clinicId: 1,
        dueDate: daysFromNow(1),
        notifiedH1At: null,
        patientId: 10,
        patient: { name: 'Budi' },
        tarif: { name: 'Kontrol' },
      },
    ]);

    const sent = await service.sendH1Reminders();

    expect(sent).toBe(1);
    expect(recallRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({ notifiedH1At: expect.any(Date) }),
    ]);
  });

  it('skips recalls not due exactly tomorrow (negative/edge)', async () => {
    recallRepo.find.mockResolvedValue([
      { id: 1, clinicId: 1, dueDate: daysFromNow(3), notifiedH1At: null },
    ]);

    const sent = await service.sendH1Reminders();

    expect(sent).toBe(0);
    expect(recallRepo.save).not.toHaveBeenCalled();
  });

  it('skips recalls already notified (negative/edge)', async () => {
    recallRepo.find.mockResolvedValue([
      {
        id: 1,
        clinicId: 1,
        dueDate: daysFromNow(1),
        notifiedH1At: new Date(),
      },
    ]);

    const sent = await service.sendH1Reminders();
    expect(sent).toBe(0);
  });

  it('does not mark as notified when the clinic has no active admin/owner email (negative)', async () => {
    userRepo.find.mockResolvedValue([]);
    recallRepo.find.mockResolvedValue([
      {
        id: 1,
        clinicId: 1,
        dueDate: daysFromNow(1),
        notifiedH1At: null,
        patientId: 10,
      },
    ]);

    const sent = await service.sendH1Reminders();

    expect(sent).toBe(0);
    expect(recallRepo.save).not.toHaveBeenCalled();
  });

  it('groups multiple due recalls per clinic into a single email (positive)', async () => {
    recallRepo.find.mockResolvedValue([
      {
        id: 1,
        clinicId: 1,
        dueDate: daysFromNow(1),
        notifiedH1At: null,
        patientId: 10,
      },
      {
        id: 2,
        clinicId: 1,
        dueDate: daysFromNow(1),
        notifiedH1At: null,
        patientId: 11,
      },
    ]);

    const sent = await service.sendH1Reminders();

    expect(sent).toBe(2);
    expect(recallRepo.save).toHaveBeenCalledTimes(1);
  });

  it('returns 0 when there is nothing due (negative/edge)', async () => {
    recallRepo.find.mockResolvedValue([]);
    const sent = await service.sendH1Reminders();
    expect(sent).toBe(0);
  });
});
