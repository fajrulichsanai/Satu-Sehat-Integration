import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Procedure, ProcedureStatus } from '../procedures/entities/procedure.entity';
import { Encounter } from './entities/encounter.entity';
import { EncounterStatus } from '../../enums';
import { CreateProcedureDto } from './dto/procedure.dto';

const VALID_TOOTH_NUMBERS = new Set([
  '11','12','13','14','15','16','17','18',
  '21','22','23','24','25','26','27','28',
  '31','32','33','34','35','36','37','38',
  '41','42','43','44','45','46','47','48',
  '51','52','53','54','55',
  '61','62','63','64','65',
  '71','72','73','74','75',
  '81','82','83','84','85',
]);

@Injectable()
export class ProceduresService {
  constructor(
    @InjectRepository(Procedure)
    private readonly procedureRepository: Repository<Procedure>,
    @InjectRepository(Encounter)
    private readonly encounterRepository: Repository<Encounter>,
  ) {}

  async findAll(encounterId: number, clinicId: number) {
    await this.verifyEncounter(encounterId, clinicId);
    return this.procedureRepository.find({ where: { encounterId }, order: { createdAt: 'ASC' } });
  }

  async create(encounterId: number, clinicId: number, dto: CreateProcedureDto, userId: number) {
    const encounter = await this.verifyEncounter(encounterId, clinicId);

    if (encounter.status === EncounterStatus.FINISHED) {
      throw new ForbiddenException('Tidak dapat menambah prosedur pada encounter yang sudah selesai');
    }

    if (dto.toothNumber && !VALID_TOOTH_NUMBERS.has(dto.toothNumber)) {
      throw new BadRequestException(`Nomor gigi '${dto.toothNumber}' tidak valid (gunakan notasi FDI)`);
    }

    const procedure = this.procedureRepository.create({
      encounterId,
      icd9Code: dto.icd9Code,
      procedureName: dto.procedureName,
      status: dto.status || ProcedureStatus.COMPLETED,
      performedStart: new Date(dto.performedStart),
      performedEnd: dto.performedEnd ? new Date(dto.performedEnd) : undefined,
      reasonDiagnosisId: dto.reasonDiagnosisId,
      toothNumber: dto.toothNumber,
      note: dto.note,
      createdBy: userId,
    });

    return this.procedureRepository.save(procedure);
  }

  async remove(encounterId: number, procedureId: number, clinicId: number): Promise<void> {
    const encounter = await this.verifyEncounter(encounterId, clinicId);

    if (encounter.status === EncounterStatus.FINISHED) {
      throw new ForbiddenException('Tidak dapat menghapus prosedur pada encounter yang sudah selesai');
    }

    const procedure = await this.procedureRepository.findOne({
      where: { id: procedureId, encounterId },
    });
    if (!procedure) {
      throw new NotFoundException(`Prosedur dengan ID ${procedureId} tidak ditemukan`);
    }

    await this.procedureRepository.remove(procedure);
  }

  private async verifyEncounter(encounterId: number, clinicId: number): Promise<Encounter> {
    const encounter = await this.encounterRepository.findOne({ where: { id: encounterId, clinicId } });
    if (!encounter) {
      throw new NotFoundException(`Encounter dengan ID ${encounterId} tidak ditemukan`);
    }
    return encounter;
  }
}
