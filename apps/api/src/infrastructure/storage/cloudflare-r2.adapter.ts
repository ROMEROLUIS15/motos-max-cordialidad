import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StoragePort } from '../../application/ports/storage.port';
import { captureException } from '../observability/sentry';

/**
 * Cloudflare R2 implementation of StoragePort. R2 is S3-compatible, so we use
 * the AWS S3 SDK pointed at the R2 endpoint. Config comes from env vars.
 */
@Injectable()
export class CloudflareR2Adapter implements StoragePort {
  private readonly logger = new Logger(CloudflareR2Adapter.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const accountId = process.env['R2_ACCOUNT_ID'] ?? '';
    this.bucket = process.env['R2_BUCKET_NAME'] ?? '';
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env['R2_ACCESS_KEY_ID'] ?? '',
        secretAccessKey: process.env['R2_SECRET_ACCESS_KEY'] ?? '',
      },
    });
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );
    } catch (error) {
      this.logger.error(`R2 upload failed for key ${key}`, error as Error);
      captureException(error, { integration: 'cloudflare_r2', op: 'upload', key });
      throw error;
    }
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (error) {
      this.logger.error(`R2 delete failed for key ${key}`, error as Error);
      throw error;
    }
  }
}
