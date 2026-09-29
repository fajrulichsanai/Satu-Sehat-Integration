import { Module } from '@nestjs/common';
import { S3StorageService } from './s3-storage.service';
import { FilesController } from './files.controller';

@Module({
  controllers: [FilesController],
  providers: [S3StorageService],
  exports: [S3StorageService],
})
export class StorageModule {}
