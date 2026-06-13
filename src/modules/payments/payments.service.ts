import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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

  async createPayment(billingId: number, clinicId: number, dto: CreatePaymentDto, userId: number) {
    return this.dataSource.transaction(async (manager) => {
      const billing = await manager.findOne(Billing, {
        where: { id: billingId, clinicId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!billing) throw new NotFoundException(`Billing dengan ID ${billingId} tidak ditemukan`);

      if (billing.status === BillingStatus.PAID || billing.status === BillingStatus.CANCELLED) {
        throw new BadRequestException(`Billing sudah berstatus '${billing.status}'`);
      }

      if ((dto.amount || 0) > billing.outstandingAmount) {
        throw new BadRequestException(
          `Jumlah pembayaran (${dto.amount}) melebihi sisa tagihan (${billing.outstandingAmount})`,
        );
      }

      const receiptNumber = await this.generateReceiptNumber(manager, clinicId);

      const payment = await manager.save(Payment, {
        billingId,
        receiptNumber,
        method: dto.method,
        amount: dto.amount,
        note: dto.note,
        paidAt: new Date(),
        createdBy: userId,
      });

      billing.paidAmount = Number(billing.paidAmount) + (dto.amount || 0);
      billing.outstandingAmount = Number(billing.outstandingAmount) - (dto.amount || 0);
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

  private async generateReceiptNumber(manager: any, clinicId: number): Promise<string> {
    const year = new Date().getFullYear();
    const result = await manager.query(
      `SELECT COUNT(*) AS total FROM payments p
       INNER JOIN billings b ON p.billing_id = b.id
       WHERE b.clinic_id = ? AND YEAR(p.paid_at) = ?`,
      [clinicId, year],
    );
    const seq = parseInt(result[0].total, 10) + 1;
    return `RCP-${year}-${String(seq).padStart(5, '0')}`;
  }
}
