import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import dotenv from 'dotenv';
import { createLogger } from './logger';

dotenv.config();

const logger = createLogger('imageProcessor');

export interface ImageResizeConfig {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export interface WatermarkConfig {
  text: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  opacity?: number;
  fontSize?: number;
  color?: string;
}

export interface PlatformImageConfig {
  amazon: ImageResizeConfig;
  ebay: ImageResizeConfig;
  shopee: ImageResizeConfig;
  lazada: ImageResizeConfig;
  tiktok: ImageResizeConfig;
}

const PLATFORM_CONFIG: PlatformImageConfig = {
  amazon: { maxWidth: 2000, maxHeight: 2000, quality: 85, format: 'jpeg' },
  ebay: { maxWidth: 1600, maxHeight: 1600, quality: 80, format: 'jpeg' },
  shopee: { maxWidth: 1200, maxHeight: 1200, quality: 80, format: 'jpeg' },
  lazada: { maxWidth: 1200, maxHeight: 1200, quality: 80, format: 'jpeg' },
  tiktok: { maxWidth: 1080, maxHeight: 1920, quality: 85, format: 'jpeg' }
};

class ImageProcessor {
  private outputDir: string;

  constructor() {
    this.outputDir = path.join(process.cwd(), 'data', 'processed-images');
    this.ensureOutputDir();
  }

  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async processImage(
    inputPath: string,
    platform: keyof PlatformImageConfig,
    sku: string,
    watermark?: WatermarkConfig
  ): Promise<string> {
    const startTime = Date.now();
    logger.debug(`Processing image for ${platform}: ${inputPath}`);

    try {
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}`);
      }

      const config = PLATFORM_CONFIG[platform];
      const ext = path.extname(inputPath);
      const basename = path.basename(inputPath, ext);
      const outputExt = config.format === 'webp' ? '.webp' : '.jpg';
      const outputPath = path.join(
        this.outputDir,
        `${sku}-${platform}-${basename}${outputExt}`
      );

      let pipeline = sharp(inputPath);

      const metadata = await pipeline.metadata();
      if (metadata.width && metadata.height) {
        const resizeOpts = this.calculateResize(
          metadata.width,
          metadata.height,
          config.maxWidth || 2000,
          config.maxHeight || 2000
        );
        
        if (resizeOpts) {
          pipeline = pipeline.resize(resizeOpts.width, resizeOpts.height, {
            fit: 'inside',
            withoutEnlargement: true
          });
        }
      }

      pipeline = pipeline.rotate();

      if (watermark) {
        pipeline = await this.addWatermark(pipeline, metadata.width || 1000, metadata.height || 1000, watermark);
      }

      if (config.format === 'jpeg') {
        pipeline = pipeline.jpeg({ quality: config.quality, progressive: true });
      } else if (config.format === 'png') {
        pipeline = pipeline.png({ quality: config.quality, compressionLevel: 6 });
      } else if (config.format === 'webp') {
        pipeline = pipeline.webp({ quality: config.quality });
      }

      await pipeline.toFile(outputPath);

      const stats = fs.statSync(outputPath);
      const elapsed = Date.now() - startTime;
      
      logger.info(`Image processed: ${outputPath}`, {
        platform,
        sku,
        size: stats.size,
        elapsed
      });

      return outputPath;
    } catch (error) {
      logger.error(`Failed to process image ${inputPath}`, error);
      throw error;
    }
  }

  async processImages(
    inputPaths: string[],
    platform: keyof PlatformImageConfig,
    sku: string,
    watermark?: WatermarkConfig
  ): Promise<string[]> {
    logger.info(`Processing ${inputPaths.length} images for ${sku} on ${platform}`);
    
    const results: string[] = [];
    
    for (const inputPath of inputPaths) {
      try {
        const processed = await this.processImage(inputPath, platform, sku, watermark);
        results.push(processed);
      } catch (error) {
        logger.warn(`Skipping failed image: ${inputPath}`, error);
      }
    }

    if (results.length === 0 && inputPaths.length > 0) {
      throw new Error('All images failed to process');
    }

    return results;
  }

  private calculateResize(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } | null {
    if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
      return null;
    }

    const ratio = Math.min(maxWidth / originalWidth, maxHeight / originalHeight);
    return {
      width: Math.round(originalWidth * ratio),
      height: Math.round(originalHeight * ratio)
    };
  }

  private async addWatermark(
    pipeline: sharp.Sharp,
    imageWidth: number,
    imageHeight: number,
    watermark: WatermarkConfig
  ): Promise<sharp.Sharp> {
    const fontSize = watermark.fontSize || Math.max(12, Math.round(Math.min(imageWidth, imageHeight) * 0.04));
    const padding = Math.round(Math.min(imageWidth, imageHeight) * 0.02);
    const text = watermark.text;
    const opacity = watermark.opacity || 0.3;
    const color = watermark.color || 'white';

    const position = watermark.position || 'center';
    
    let textX: string | number = '50%';
    let textY: string | number = '50%';
    let textAnchor = 'middle';
    let dominantBaseline = 'middle';
    let rotateX = imageWidth / 2;
    let rotateY = imageHeight / 2;
    
    const maxTextWidth = imageWidth - 2 * padding;
    const maxTextHeight = imageHeight - 2 * padding;
    
    const estimatedTextWidth = text.length * fontSize * 0.6;
    if (estimatedTextWidth > maxTextWidth) {
      logger.warn('Watermark text may exceed image bounds, consider reducing font size');
    }
    
    switch (position) {
      case 'top-left':
        textX = padding;
        textY = padding;
        textAnchor = 'start';
        dominantBaseline = 'hanging';
        rotateX = padding;
        rotateY = padding;
        break;
      case 'top-right':
        textX = imageWidth - padding;
        textY = padding;
        textAnchor = 'end';
        dominantBaseline = 'hanging';
        rotateX = imageWidth - padding;
        rotateY = padding;
        break;
      case 'bottom-left':
        textX = padding;
        textY = imageHeight - padding;
        textAnchor = 'start';
        dominantBaseline = 'baseline';
        rotateX = padding;
        rotateY = imageHeight - padding;
        break;
      case 'bottom-right':
        textX = imageWidth - padding;
        textY = imageHeight - padding;
        textAnchor = 'end';
        dominantBaseline = 'baseline';
        rotateX = imageWidth - padding;
        rotateY = imageHeight - padding;
        break;
      case 'center':
      default:
        textX = '50%';
        textY = '50%';
        textAnchor = 'middle';
        dominantBaseline = 'middle';
        rotateX = imageWidth / 2;
        rotateY = imageHeight / 2;
        break;
    }

    const svgWatermark = `
      <svg width="${imageWidth}" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .watermark {
            font-family: Arial, sans-serif;
            font-size: ${fontSize}px;
            fill: ${color};
            opacity: ${opacity};
            font-weight: bold;
          }
        </style>
        <text x="${textX}" y="${textY}" text-anchor="${textAnchor}" dominant-baseline="${dominantBaseline}" class="watermark" transform="rotate(-45 ${rotateX} ${rotateY})">
          ${text}
        </text>
      </svg>
    `;

    const watermarkBuffer = Buffer.from(svgWatermark);
    
    const left = 0;
    const top = 0;

    return pipeline.composite([{
      input: watermarkBuffer,
      left,
      top,
      blend: 'over'
    }]);
  }

  async validateImage(inputPath: string, platform: keyof PlatformImageConfig): Promise<boolean> {
    try {
      const metadata = await sharp(inputPath).metadata();
      const config = PLATFORM_CONFIG[platform];
      
      if (!metadata.width || !metadata.height) {
        return false;
      }

      const minWidth = 500;
      const minHeight = 500;
      
      if (metadata.width < minWidth || metadata.height < minHeight) {
        logger.warn(`Image too small: ${metadata.width}x${metadata.height}, min: ${minWidth}x${minHeight}`);
        return false;
      }

      if (!metadata.format || !['jpeg', 'png', 'webp', 'gif', 'tiff'].includes(metadata.format)) {
        logger.warn(`Unsupported image format: ${metadata.format}`);
        return false;
      }

      const stat = fs.statSync(inputPath);
      const maxSize = 10 * 1024 * 1024;
      if (stat.size > maxSize) {
        logger.warn(`Image too large: ${stat.size} bytes, max: ${maxSize}`);
        return false;
      }

      return true;
    } catch (error) {
      logger.error(`Image validation failed for ${inputPath}`, error);
      return false;
    }
  }

  async getImageInfo(inputPath: string): Promise<{
    width: number;
    height: number;
    format: string;
    size: number;
  }> {
    const metadata = await sharp(inputPath).metadata();
    const stat = fs.statSync(inputPath);

    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      size: stat.size
    };
  }

  async createThumbnail(inputPath: string, size = 200): Promise<string> {
    const basename = path.basename(inputPath, path.extname(inputPath));
    const outputPath = path.join(this.outputDir, `thumbnails`, `${basename}-${size}px.jpg`);
    
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await sharp(inputPath)
      .resize(size, size, { fit: 'cover' })
      .jpeg({ quality: 70 })
      .toFile(outputPath);

    return outputPath;
  }

  cleanupOldFiles(maxAgeMs = 7 * 24 * 60 * 60 * 1000): void {
    try {
      const now = Date.now();
      const files = fs.readdirSync(this.outputDir);
      let cleaned = 0;

      for (const file of files) {
        const filePath = path.join(this.outputDir, file);
        const stat = fs.statSync(filePath);
        
        if (now - stat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.info(`Cleaned up ${cleaned} old processed images`);
      }
    } catch (error) {
      logger.error('Failed to cleanup old images', error);
    }
  }
}

export const imageProcessor = new ImageProcessor();

export default ImageProcessor;
