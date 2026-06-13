import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OwnerCode } from './entities/owner-code.entity';
import { OwnerCodeService } from './owner-code.service';
import { OwnerCodeController } from './owner-code.controller';

@Module({
  imports: [TypeOrmModule.forFeature([OwnerCode])],
  providers: [OwnerCodeService],
  controllers: [OwnerCodeController],
  exports: [OwnerCodeService],
})
export class OwnerCodeModule {}
