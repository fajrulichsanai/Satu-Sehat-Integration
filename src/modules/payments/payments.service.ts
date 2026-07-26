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
import { CreatePaymentDto } from '../billing/dto/billing.dto';

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
        billing.status === BillingStatus.CANCELLED
      ) {
        throw new BadRequestException(
          `Billing sudah berstatus '${billing.status}'`,
        );
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
