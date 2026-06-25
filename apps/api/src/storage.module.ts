import { Module } from '@nestjs/common';
import { STORAGE_PORT } from './application/ports/storage.port';
import { CloudflareR2Adapter } from './infrastructure/storage/cloudflare-r2.adapter';
import { ImageProcessorService } from './infrastructure/storage/image-processor.service';

/**
 * Shared storage infrastructure (Cloudflare R2 + image processing). Leaf module
 * with no dependencies, imported by Workshop/Commerce/Settings.
 */
@Module({
  providers: [
    { provide: STORAGE_PORT, useClass: CloudflareR2Adapter },
    ImageProcessorService,
  ],
  exports: [STORAGE_PORT, ImageProcessorService],
})
export class StorageModule {}
