import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import sharp from 'sharp';

export const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
const TWO_MB = 2 * 1024 * 1024;

export interface ProcessedImage {
  buffer: Buffer;
  contentType: string;
  extension: string;
}

@Injectable()
export class ImageProcessorService {
  assertAllowed(mimeType: string): void {
    if (!ALLOWED_IMAGE_MIME.includes(mimeType as (typeof ALLOWED_IMAGE_MIME)[number])) {
      throw new UnprocessableEntityException(
        `Formato no permitido. Formatos aceptados: ${ALLOWED_IMAGE_MIME.join(', ')}`,
      );
    }
  }

  /**
   * Compresses images over 2MB (quality 80). PNG is always converted to WebP.
   * Returns the (possibly transformed) buffer plus its content type/extension.
   */
  async process(buffer: Buffer, mimeType: string): Promise<ProcessedImage> {
    this.assertAllowed(mimeType);

    const isPng = mimeType === 'image/png';
    const tooLarge = buffer.length > TWO_MB;

    if (!isPng && !tooLarge) {
      const extension = mimeType === 'image/webp' ? 'webp' : 'jpg';
      return { buffer, contentType: mimeType, extension };
    }

    // PNG → WebP, or compress oversized JPEG/WebP keeping their format.
    if (isPng) {
      const out = await sharp(buffer).webp({ quality: 80 }).toBuffer();
      return { buffer: out, contentType: 'image/webp', extension: 'webp' };
    }

    if (mimeType === 'image/webp') {
      const out = await sharp(buffer).webp({ quality: 80 }).toBuffer();
      return { buffer: out, contentType: 'image/webp', extension: 'webp' };
    }

    const out = await sharp(buffer).jpeg({ quality: 80 }).toBuffer();
    return { buffer: out, contentType: 'image/jpeg', extension: 'jpg' };
  }
}
