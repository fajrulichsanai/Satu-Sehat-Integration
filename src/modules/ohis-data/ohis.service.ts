import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OhisData } from '../ohis-data/entities/ohis-data.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import { UpsertOhisDto } from './dto/ohis.dto';

const INDEX_TEETH = ['16', '11', '26', '46', '31', '36'];

@Injectable()
export class OhisService {
  constructor(
    @InjectRepository(OhisData)
    private readonly ohisRepo: Repository<OhisData>,
    @InjectRepository(Encounter)
    private readonly encounterRepo: Repository<Encounter>,
  ) {}

  async findByEncounter(encounterId: number, clinicId: number) {
    await this.verifyEncounter(encounterId, clinicId);
    const data = await this.ohisRepo.findOne({ where: { encounterId } });
    if (!data) return null;
    return {
      scores: data.scores,
      summary: {
        diS: Number(data.diS),
        ciS: Number(data.ciS),
        ohiS: Number(data.ohiS),
        interpretation: data.interpretation,
      },
    };
  }

  async upsert(
    encounterId: number,
    clinicId: number,
    dto: UpsertOhisDto,
    userId: number,
  ) {
    await this.verifyEncounter(encounterId, clinicId);

    const summary = this.calculateOhis(dto.scores);

    let record = await this.ohisRepo.findOne({ where: { encounterId } });
    if (record) {
      record.scores = dto.scores;
      record.diS = summary.diS;
      record.ciS = summary.ciS;
      record.ohiS = summary.ohiS;
      record.interpretation = summary.interpretation;
      record.updatedBy = userId;
    } else {
      record = this.ohisRepo.create({
        encounterId,
        scores: dto.scores,
        diS: summary.diS,
        ciS: summary.ciS,
        ohiS: summary.ohiS,
        interpretation: summary.interpretation,
        createdBy: userId,
      });
    }
    await this.ohisRepo.save(record);
    return { summary, savedAt: new Date() };
  }

  private calculateOhis(
    scores: Record<string, { debris: number; calculus: number }>,
  ) {
    const teethKeys = Object.keys(scores);
    if (teethKeys.length === 0)
      throw new BadRequestException('Scores tidak boleh kosong');

    let totalDebris = 0;
    let totalCalculus = 0;
    let count = 0;

    for (const tooth of teethKeys) {
      const s = scores[tooth];
      if (s && typeof s.debris === 'number' && typeof s.calculus === 'number') {
        totalDebris += s.debris;
        totalCalculus += s.calculus;
        count++;
      }
    }

    if (count === 0) throw new BadRequestException('Data skor tidak valid');

    const diS = parseFloat((totalDebris / count).toFixed(2));
    const ciS = parseFloat((totalCalculus / count).toFixed(2));
    const ohiS = parseFloat((diS + ciS).toFixed(2));

    let interpretation: string;
    if (ohiS <= 1.2) interpretation = 'Baik (Good)';
    else if (ohiS <= 3.0) interpretation = 'Sedang (Fair)';
    else interpretation = 'Buruk (Poor)';

    return { diS, ciS, ohiS, interpretation };
  }

  private async verifyEncounter(
    encounterId: number,
    clinicId: number,
  ): Promise<void> {
    const enc = await this.encounterRepo.findOne({
      where: { id: encounterId, clinicId },
    });
    if (!enc)
      throw new NotFoundException(
        `Encounter dengan ID ${encounterId} tidak ditemukan`,
      );
  }
}
