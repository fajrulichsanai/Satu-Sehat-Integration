import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Medication } from '../../entities/medication.entity';
import { MedicationStockLog, StockLogType } from '../../entities/medication-stock-log.entity';
import {
  AdjustStockDto,
  CreateMedicationDto,
  MedicationQueryDto,
  UpdateMedicationDto,
} from './dto/medication.dto';

@Injectable()
export class MedicationsService {
  constructor(
    @InjectRepository(Medication)
    private readonly medicationRepository: Repository<Medication>,
    @InjectRepository(MedicationStockLog)
    private readonly stockLogRepository: Repository<MedicationStockLog>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(clinicId: number, query: MedicationQueryDto) {
    const qb = this.medicationRepository
      .createQueryBuilder('m')
      .where('m.clinicId = :clinicId AND m.isActive = true', { clinicId });

    if (query.search) {
      qb.andWhere('(m.name LIKE :s OR m.genericName LIKE :s)', { s: `%${query.search}%` });
    }

    if (query.lowStock) {
      qb.andWhere('m.quantity <= m.minStock');
    }

    if (query.nearExpiry) {
      qb.andWhere('m.expirationDate IS NOT NULL AND m.expirationDate <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)');
    }

    qb.orderBy('m.name', 'ASC');

    const page = query.page || 1;
    const limit = query.limit || 20;
    const [items, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();

    return {
      data: items.map((m) => this.toResponse(m)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: number, clinicId: number): Promise<Medication> {
    const med = await this.medicationRepository.findOne({ where: { id, clinicId } });
    if (!med) throw new NotFoundException(`Obat dengan ID ${id} tidak ditemukan`);
    return med;
  }

  async create(clinicId: number, dto: CreateMedicationDto, userId: number): Promise<Medication> {
    const med = this.medicationRepository.create({
      clinicId,
      name: dto.name,
      genericName: dto.genericName,
      strength: dto.strength,
      strengthUnit: dto.strengthUnit,
      dosageForm: dto.dosageForm,
      quantity: dto.quantity ?? 0,
      minStock: dto.minStock ?? 0,
      price: dto.price ?? 0,
      supplier: dto.supplier,
      expirationDate: dto.expirationDate ? new Date(dto.expirationDate) : undefined,
      createdBy: userId,
    });
    return this.medicationRepository.save(med);
  }

  async update(id: number, clinicId: number, dto: UpdateMedicationDto, userId: number): Promise<Medication> {
    const med = await this.findOne(id, clinicId);
    Object.assign(med, {
      name: dto.name ?? med.name,
      genericName: dto.genericName ?? med.genericName,
      strength: dto.strength ?? med.strength,
      strengthUnit: dto.strengthUnit ?? med.strengthUnit,
      dosageForm: dto.dosageForm ?? med.dosageForm,
      minStock: dto.minStock ?? med.minStock,
      price: dto.price ?? med.price,
      supplier: dto.supplier ?? med.supplier,
      expirationDate: dto.expirationDate ? new Date(dto.expirationDate) : med.expirationDate,
      isActive: dto.isActive ?? med.isActive,
      updatedBy: userId,
    });
    return this.medicationRepository.save(med);
  }

  async adjustStock(id: number, clinicId: number, dto: AdjustStockDto, userId: number) {
    return this.dataSource.transaction(async (manager) => {
      const med = await manager.findOne(Medication, { where: { id, clinicId }, lock: { mode: 'pessimistic_write' } });
      if (!med) throw new NotFoundException(`Obat dengan ID ${id} tidak ditemukan`);

      const previousQuantity = med.quantity;
      let newQuantity: number;

      if (dto.type === StockLogType.IN) {
        newQuantity = previousQuantity + dto.quantity;
      } else if (dto.type === StockLogType.OUT) {
        if (previousQuantity < dto.quantity) {
          throw new BadRequestException('Stok tidak mencukupi untuk pengeluaran');
        }
        newQuantity = previousQuantity - dto.quantity;
      } else {
        newQuantity = dto.quantity;
      }

      med.quantity = newQuantity;
      med.updatedBy = userId;
      if (dto.expirationDate) med.expirationDate = new Date(dto.expirationDate);
      await manager.save(med);

      await manager.save(MedicationStockLog, {
        medicationId: id,
        type: dto.type,
        quantity: dto.quantity,
        previousQuantity,
        newQuantity,
        reason: dto.reason,
        batchNo: dto.batchNo,
        expirationDate: dto.expirationDate ? new Date(dto.expirationDate) : undefined,
        referenceType: 'adjustment',
        createdBy: userId,
      });

      return { medicationId: id, previousQuantity, adjustedQuantity: dto.quantity, newQuantity };
    });
  }

  private toResponse(m: Medication) {
    const today = new Date();
    const thirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    return {
      medicationId: m.id,
      name: m.name,
      genericName: m.genericName,
      strength: m.strength,
      dosageForm: m.dosageForm,
      quantity: m.quantity,
      minStock: m.minStock,
      price: m.price,
      expirationDate: m.expirationDate,
      isLowStock: m.quantity <= m.minStock,
      isNearExpiry: m.expirationDate ? new Date(m.expirationDate) <= thirtyDays : false,
    };
  }
}
