import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RefundRequest,
  RefundStatus,
} from '../refund-request/entities/refund-request.entity';
import { Billing, BillingStatus } from './entities/billing.entity';
import { ApproveRefundDto, CreateRefundRequestDto } from './dto/billing.dto';

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    @InjectRepository(RefundRequest)
    private readonly refundRepository: Repository<RefundRequest>,
    @InjectRepository(Billing)
    private readonly billingRepository: Repository<Billing>,
  ) {}

  async createRequest(
    billingId: number,
    clinicId: number,
    dto: CreateRefundRequestDto,
    userId: number,
  ) {
    this.logger.log(`[CREATE] Membuat permintaan refund | billingId=${billingId}, clinicId=${clinicId}, amount=${dto.amount}`);
    const billing = await this.billingRepository.findOne({
      where: { id: billingId, clinicId },
    });
    if (!billing)
      throw new NotFoundException(
        `Billing dengan ID ${billingId} tidak ditemukan`,
      );

    if (
      billing.status !== BillingStatus.PAID &&
      billing.status !== BillingStatus.PARTIAL
    ) {
      throw new BadRequestException(
        'Refund hanya bisa diminta untuk billing yang sudah dibayar',
      );
    }

    if (dto.amount! > Number(billing.paidAmount)) {
      throw new BadRequestException(
        'Jumlah refund melebihi total yang sudah dibayar',
      );
    }

    const existing = await this.refundRepository.findOne({
      where: { billingId, status: RefundStatus.PENDING_APPROVAL },
    });
    if (existing) {
      throw new BadRequestException(
        'Sudah ada permintaan refund yang sedang pending',
      );
    }

    const refund = this.refundRepository.create({
      billingId,
      amount: dto.amount!,
      reason: dto.reason!,
      status: RefundStatus.PENDING_APPROVAL,
      createdBy: userId,
    } as any);
    const saved = await this.refundRepository.save(refund);
    // this.logger.log(`[CREATE] Permintaan refund berhasil dibuat | id=${saved.id}, billingId=${billingId}`);
    return saved;
  }

  async processApproval(
    billingId: number,
    refundId: number,
    clinicId: number,
    dto: ApproveRefundDto,
    userId: number,
  ) {
    this.logger.log(`[UPDATE] Proses approval refund | billingId=${billingId}, refundId=${refundId}, action=${dto.action}`);
    const billing = await this.billingRepository.findOne({
      where: { id: billingId, clinicId },
    });
    if (!billing)
      throw new NotFoundException(
        `Billing dengan ID ${billingId} tidak ditemukan`,
      );

    const refund = await this.refundRepository.findOne({
      where: { id: refundId, billingId },
    });
    if (!refund)
      throw new NotFoundException(
        `Refund request dengan ID ${refundId} tidak ditemukan`,
      );

    if (refund.status !== RefundStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Refund request sudah diproses sebelumnya');
    }

    refund.status =
      dto.action === 'approved' ? RefundStatus.APPROVED : RefundStatus.REJECTED;
    refund.approvedBy = userId;
    refund.approvedAt = new Date();
    refund.approvalNote = dto.approvalNote as string;
    refund.updatedBy = userId;

    if (dto.action === 'approved') {
      billing.status = BillingStatus.REFUNDED;
      await this.billingRepository.save(billing);
    }

    const result = await this.refundRepository.save(refund);
    this.logger.log(`[UPDATE] Refund berhasil diproses | refundId=${refundId}, status=${result.status}`);
    return result;
  }
}
