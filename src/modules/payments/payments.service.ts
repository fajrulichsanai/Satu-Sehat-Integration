import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Billing, BillingStatus } from '../billing/entities/billing.entity';
import { Payment } from './entities/payment.entity';
import { CreatePaymentDto, UpdatePaymentDto } from '../billing/dto/billing.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Billing)
    private readonly billingRepository: Repository<Billing>,
    private readonly dataSource: DataSource,
  ) {}

  async createPayment(
    billingId: number,
    clinicId: number,
    dto: CreatePaymentDto,
    userId: number,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const billing = await manager.findOne(Billing, {
        where: { id: billingId, clinicId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!billing)
        throw new NotFoundException(
          `Billing dengan ID ${billingId} tidak ditemukan`,
        );

      if (
        billing.status === BillingStatus.PAID ||
        billing.status === BillingStatus.CANCELLED ||
        billing.status === BillingStatus.REFUNDED
      ) {
        throw new BadRequestException(
          `Billing sudah berstatus '${billing.status}'`,
        );
      }

      // Rp 0 is only a real payment when nothing is owed (free visit, a
      // follow-up already paid for); otherwise it would record nothing.
      if (!dto.amount && Number(billing.outstandingAmount) > 0) {
        throw new BadRequestException('Jumlah pembayaran harus lebih dari 0');
      }

      if ((dto.amount || 0) > billing.outstandingAmount) {
        throw new BadRequestException(
          `Jumlah pembayaran (${dto.amount}) melebihi sisa tagihan (${billing.outstandingAmount})`,
        );
      }

      const paidAt = new Date();
      const payment = await manager.save(Payment, {
        billingId,
        receiptNumber: `TMP-${randomUUID()}`,
        method: dto.method,
        amount: dto.amount,
        note: dto.note,
        paidAt,
        createdBy: userId,
      });

      const receiptNumber = this.generateReceiptNumber(paidAt, payment.id);
      payment.receiptNumber = receiptNumber;
      await manager.save(Payment, payment);

      billing.paidAmount = Number(billing.paidAmount) + (dto.amount || 0);
      billing.outstandingAmount =
        Number(billing.outstandingAmount) - (dto.amount || 0);
      billing.updatedBy = userId;

      if (billing.outstandingAmount <= 0) {
        billing.status = BillingStatus.PAID;
        billing.outstandingAmount = 0;
      } else {
        billing.status = BillingStatus.PARTIAL;
      }

      await manager.save(billing);

      return {
        paymentId: payment.id,
        receiptNumber,
        paidAmount: billing.paidAmount,
        outstandingAmount: billing.outstandingAmount,
        billingStatus: billing.status,
      };
    });
  }

  /**
   * Corrects an already-recorded payment's amount/method/note — e.g. a
   * typo'd amount — without creating a new payment row. Billing's
   * paidAmount/outstandingAmount/status are recomputed from the delta.
   */
  async updatePayment(
    billingId: number,
    paymentId: number,
    clinicId: number,
    dto: UpdatePaymentDto,
    userId: number,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const billing = await manager.findOne(Billing, {
        where: { id: billingId, clinicId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!billing) {
        throw new NotFoundException(
          `Billing dengan ID ${billingId} tidak ditemukan`,
        );
      }
      if (
        billing.status === BillingStatus.CANCELLED ||
        billing.status === BillingStatus.REFUNDED
      ) {
        throw new BadRequestException(
          `Billing sudah berstatus '${billing.status}', pembayarannya tidak bisa diubah`,
        );
      }

      const payment = await manager.findOne(Payment, {
        where: { id: paymentId, billingId },
      });
      if (!payment) {
        throw new NotFoundException(
          `Pembayaran dengan ID ${paymentId} tidak ditemukan`,
        );
      }

      if (dto.amount !== undefined) {
        const delta = dto.amount - Number(payment.amount);
        const newPaidAmount = Number(billing.paidAmount) + delta;
        if (newPaidAmount < 0) {
          throw new BadRequestException(
            'Total pembayaran tagihan ini tidak boleh jadi negatif',
          );
        }
        if (newPaidAmount > Number(billing.grandTotal)) {
          throw new BadRequestException(
            `Jumlah pembayaran melebihi total tagihan (${billing.grandTotal})`,
          );
        }
        payment.amount = dto.amount;
        billing.paidAmount = newPaidAmount;
        billing.outstandingAmount = Math.max(
          0,
          Number(billing.grandTotal) - newPaidAmount,
        );
        billing.status =
          billing.outstandingAmount <= 0
            ? BillingStatus.PAID
            : newPaidAmount > 0
              ? BillingStatus.PARTIAL
              : BillingStatus.UNPAID;
      }
      if (dto.method !== undefined) payment.method = dto.method;
      if (dto.note !== undefined) payment.note = dto.note;

      await manager.save(Payment, payment);
      billing.updatedBy = userId;
      await manager.save(billing);

      return {
        paymentId: payment.id,
        amount: payment.amount,
        paidAmount: billing.paidAmount,
        outstandingAmount: billing.outstandingAmount,
        billingStatus: billing.status,
      };
    });
  }

  private generateReceiptNumber(paidAt: Date, paymentId: number): string {
    const year = paidAt.getFullYear();
    const day = String(paidAt.getDate()).padStart(2, '0');
    const month = String(paidAt.getMonth() + 1).padStart(2, '0');
    const hours = String(paidAt.getHours()).padStart(2, '0');
    const minutes = String(paidAt.getMinutes()).padStart(2, '0');
    const seconds = String(paidAt.getSeconds()).padStart(2, '0');
    return `RCP-${year}-${day}${month}-${hours}${minutes}${seconds}-${paymentId}`;
  }
}
