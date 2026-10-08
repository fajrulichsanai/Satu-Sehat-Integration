import { SatusehatModule } from '../satusehat/satusehat.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PractitionersController } from './practitioners.controller';
import { PractitionersService } from './practitioners.service';
import { Practitioner } from './entities/practitioner.entity';
import { User } from '../users/entities/user.entity';
import { PractitionerRevision } from './entities/practitioner-revision.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Practitioner, PractitionerRevision, User]),
    AuditLogModule,
    SatusehatModule,
  ],
  controllers: [PractitionersController],
  providers: [PractitionersService],
  exports: [PractitionersService],
})
export class PractitionersModule {}
