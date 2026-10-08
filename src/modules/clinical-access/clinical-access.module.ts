import { Global, Module } from '@nestjs/common';
import { ClinicalAccessService } from './clinical-access.service';
import { ClinicalAccessGuard } from './clinical-access.guard';

@Global()
@Module({
  providers: [ClinicalAccessService, ClinicalAccessGuard],
  exports: [ClinicalAccessService, ClinicalAccessGuard],
})
export class ClinicalAccessModule {}
