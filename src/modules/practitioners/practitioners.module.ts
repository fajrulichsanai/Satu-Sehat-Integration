import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PractitionersController } from './practitioners.controller';
import { PractitionersService } from './practitioners.service';
import { Practitioner } from './entities/practitioner.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Practitioner])],
  controllers: [PractitionersController],
  providers: [PractitionersService],
  exports: [PractitionersService],
})
export class PractitionersModule {}
