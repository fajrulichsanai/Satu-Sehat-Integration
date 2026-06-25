import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Billing, BillingStatus } from './entities/billing.entity';
import {
  BillingItem,
  DiscountType,
} from '../billing-item/entities/billing-item.entity';
import { Tarif } from '../tarif/entities/tarif.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import {
  BillingItemDto,
  BillingQueryDto,
  CreateBillingDto,
} from './dto/billing.dto';

@Injectable()
export class BillingsService {
  private readonly logger = new Logger(BillingsService.name);

  constructor(
    @InjectRepository(Billing)
    private readonly billingRepository: Repository<Billing>,
    @InjectRepository(BillingItem)
    private readonly billingItemRepository: Repository<BillingItem>,
    @InjectRepository(Tarif)
    private readonly tarifRepository: Repository<Tarif>,
    @InjectRepository(Encounter)
    private readonly encounterRepository: Repository<Encounter>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(clinicId: number, query: BillingQueryDto) {
    this.logger.log(`[GET-ALL] Mengambil daftar billing | clinicId=${clinicId}, status=${query.status || 'all'}`);
    const qb = this.billingRepository
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.patient', 'patient')
      .where('b.clinicId = :clinicId', { clinicId });

    if (query.status) {
      qb.andWhere('b.status = :status', { status: query.status });
    }
    if (query.dateFrom) {
      qb.andWhere('DATE(b.createdAt) >= :dateFrom', {
        dateFrom: query.dateFrom,
      });
    }
    if (query.dateTo) {
      qb.andWhere('DATE(b.createdAt) <= :dateTo', { dateTo: query.dateTo });
    }
    if (query.patientId) {
      qb.andWhere('b.patientId = :patientId', { patientId: query.patientId });
    }

    qb.orderBy('b.createdAt', 'DESC');

    const page = query.page || 1;
    const limit = query.limit || 20;
    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: items.map((b) => ({
        billingId: b.id,
        encounterId: b.encounterId,
        invoiceNumber: b.invoiceNumber,
        patientName: b.patient?.name,
        grandTotal: b.grandTotal,
        paidAmount: b.paidAmount,
        outstandingAmount: b.outstandingAmount,
        status: b.status,
        createdAt: b.createdAt,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: number, clinicId: number) {
    this.logger.log(`[GET] Mengambil detail billing | id=${id}, clinicId=${clinicId}`);
    const billing = await this.billingRepository.findOne({
      where: { id, clinicId },
      relations: { patient: true, items: true, payments: true },
    });
    if (!billing) {
      this.logger.warn(`[GET] Billing tidak ditemukan | id=${id}, clinicId=${clinicId}`);
      throw new NotFoundException(`Billing dengan ID ${id} tidak ditemukan`);
    }
    return billing;
  }

  async create(clinicId: number, dto: CreateBillingDto, userId: number) {
    this.logger.log(`[CREATE] Membuat billing baru | clinicId=${clinicId}, encounterId=${dto.encounterId}`);
    const encounter = await this.encounterRepository.findOne({
      where: { id: dto.encounterId, clinicId },
    });
    if (!encounter)
      throw new NotFoundException(
        `Encounter dengan ID ${dto.encounterId} tidak ditemukan`,
      );

    const existingBilling = await this.billingRepository.findOne({
      where: { encounterId: dto.encounterId, clinicId },
    });
    if (existingBilling && existingBilling.status !== BillingStatus.CANCELLED) {
      throw new ConflictException('Encounter ini sudah memiliki billing aktif');
    }

    return this.dataSource.transaction(async (manager) => {
      let subtotal = 0;
      const processedItems: Array<{
        tarifId?: number;
        name: string;
        quantity: number;
        unitPrice: number;
        discount: number;
        discountType: DiscountType;
        subtotal: number;
      }> = [];

      for (const item of dto.items!) {
        const qty = item.quantity || 1;
        const discountType = item.discountType || DiscountType.NOMINAL;
        const discountValue = item.discount || 0;

        if (item.tarifId) {
          const tarif = await manager.findOne(Tarif, {
            where: { id: item.tarifId, clinicId },
          });
          if (!tarif)
            throw new NotFoundException(
              `Tarif ID ${item.tarifId} tidak ditemukan`,
            );

          if (
            discountType === DiscountType.NOMINAL &&
            discountValue > tarif.diskonMaksimal
          ) {
            throw new UnprocessableEntityException(
              `Diskon untuk '${tarif.name}' melebihi batas maksimal (Rp ${tarif.diskonMaksimal})`,
            );
          }
          if (
            discountType === DiscountType.PERCENT &&
            discountValue > (tarif.diskonMaksimal / tarif.hargaJual) * 100
          ) {
            throw new UnprocessableEntityException(
              `Diskon % untuk '${tarif.name}' melebihi batas maksimal`,
            );
          }
        }

        const discountNominal =
          discountType === DiscountType.PERCENT
            ? (item.unitPrice! * discountValue) / 100
            : discountValue;

        const itemSubtotal = (item.unitPrice! - discountNominal) * qty;
        subtotal += itemSubtotal;

        processedItems.push({
          tarifId: item.tarifId ?? undefined,
          name: item.name!,
          quantity: qty,
          unitPrice: item.unitPrice!,
          discount: discountValue,
          discountType,
          subtotal: itemSubtotal,
        });
      }

      // Apply total discount
      let totalDiscountNominal = 0;
      if (dto.totalDiscount && dto.totalDiscount > 0) {
        totalDiscountNominal =
          dto.totalDiscountType === DiscountType.PERCENT
            ? (subtotal * dto.totalDiscount) / 100
            : dto.totalDiscount;
      }
      const grandTotal = subtotal - totalDiscountNominal;

      const invoiceNumber = await this.generateInvoiceNumber(manager, clinicId);

      const billing = await manager.save(Billing, {
        clinicId,
        encounterId: dto.encounterId,
        patientId: encounter.patientId,
        invoiceNumber,
        subtotal,
        totalDiscount: totalDiscountNominal,
        grandTotal,
        paidAmount: 0,
        outstandingAmount: grandTotal,
        status: BillingStatus.UNPAID,
        notes: dto.notes,
        createdBy: userId,
      });

      await manager.save(
        BillingItem,
        processedItems.map((i) => ({
          ...i,
          billingId: billing.id,
          createdBy: userId,
        })),
      );

      this.logger.log(`[CREATE] Billing berhasil dibuat | id=${billing.id}, invoiceNumber=${billing.invoiceNumber}, clinicId=${clinicId}`);
      return billing;
    });
  }

  private async generateInvoiceNumber(
    manager: any,
    clinicId: number,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const result = await manager.query(
      `SELECT COUNT(*) AS total FROM billings WHERE clinic_id = ? AND YEAR(created_at) = ?`,
      [clinicId, year],
    );
    const seq = parseInt(result[0].total, 10) + 1;
    return `INV-${year}-${String(seq).padStart(5, '0')}`;
  }
}
