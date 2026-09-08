import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from '../payments.service';
import { Billing, BillingStatus } from '../../billing/entities/billing.entity';
import { Payment } from '../entities/payment.entity';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let dataSource: { transaction: jest.Mock };
  let manager: { findOne: jest.Mock; save: jest.Mock };

  const clinicId = 1;
  const userId = 9;

  beforeEach(async () => {
    let nextPaymentId = 1;
    manager = {
      findOne: jest.fn(),
      save: jest.fn((entity: any, data?: any) => {
        if (entity === Payment) {
          const payload = data.id ? data : { id: nextPaymentId++, ...data };
          return Promise.resolve(payload);
        }
        return Promise.resolve(data ?? entity);
      }),
    };
    dataSource = { transaction: jest.fn((cb: any) => cb(manager)) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Billing), useValue: {} },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('records a partial payment and marks billing PARTIAL (positive)', async () => {
    manager.findOne.mockResolvedValue({
      id: 1,
      clinicId,
      status: BillingStatus.UNPAID,
      paidAmount: 0,
      outstandingAmount: 100000,
    });

    const result = await service.createPayment(
      1,
      clinicId,
      { amount: 40000, method: 'cash' } as any,
      userId,
    );

    expect(result.paidAmount).toBe(40000);
    expect(result.outstandingAmount).toBe(60000);
    expect(result.billingStatus).toBe(BillingStatus.PARTIAL);
    expect(result.receiptNumber).toMatch(/^RCP-\d{4}-\d{4}-\d{6}-\d+$/);
  });

  it('marks billing PAID once the full outstanding amount is paid (positive)', async () => {
    manager.findOne.mockResolvedValue({
      id: 1,
      clinicId,
      status: BillingStatus.PARTIAL,
      paidAmount: 40000,
      outstandingAmount: 60000,
    });

    const result = await service.createPayment(
      1,
      clinicId,
      { amount: 60000, method: 'cash' } as any,
      userId,
    );

    expect(result.billingStatus).toBe(BillingStatus.PAID);
    expect(result.outstandingAmount).toBe(0);
  });

  it('clamps outstandingAmount to 0 rather than going negative on an exact-match payment (edge)', async () => {
    manager.findOne.mockResolvedValue({
      id: 1,
      clinicId,
      status: BillingStatus.UNPAID,
      paidAmount: 0,
      outstandingAmount: 50000,
    });

    const result = await service.createPayment(
      1,
      clinicId,
      { amount: 50000, method: 'cash' } as any,
      userId,
    );

    expect(result.outstandingAmount).toBe(0);
  });

  it('throws NotFoundException when the billing does not exist (negative)', async () => {
    manager.findOne.mockResolvedValue(null);
    await expect(
      service.createPayment(999, clinicId, { amount: 10 } as any, userId),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when billing is already PAID (negative)', async () => {
    manager.findOne.mockResolvedValue({
      id: 1,
      clinicId,
      status: BillingStatus.PAID,
      outstandingAmount: 0,
    });
    await expect(
      service.createPayment(1, clinicId, { amount: 1000 } as any, userId),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when billing is CANCELLED (negative)', async () => {
    manager.findOne.mockResolvedValue({
      id: 1,
      clinicId,
      status: BillingStatus.CANCELLED,
      outstandingAmount: 50000,
    });
    await expect(
      service.createPayment(1, clinicId, { amount: 1000 } as any, userId),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when payment amount exceeds outstanding amount (negative)', async () => {
    manager.findOne.mockResolvedValue({
      id: 1,
      clinicId,
      status: BillingStatus.UNPAID,
      paidAmount: 0,
      outstandingAmount: 50000,
    });
    await expect(
      service.createPayment(
        1,
        clinicId,
        { amount: 999999, method: 'cash' } as any,
        userId,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
