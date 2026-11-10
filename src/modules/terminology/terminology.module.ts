import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TerminologyConcept } from './entities/terminology-concept.entity';
import { TerminologyController } from './terminology.controller';
import { TerminologyService } from './terminology.service';
import { ClinicalCatalogService } from './clinical-catalog.service';

@Module({
  imports: [TypeOrmModule.forFeature([TerminologyConcept])],
  controllers: [TerminologyController],
  providers: [TerminologyService, ClinicalCatalogService],
  exports: [TerminologyService, ClinicalCatalogService],
})
export class TerminologyModule {}
