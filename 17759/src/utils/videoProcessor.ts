import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { createLogger } from './logger';
import type { PlatformType } from '../../types';

const logger = createLogger('video-processor');

export interface VideoConfig {
  maxWidth: number;
  maxHeight: number;
  maxDuration: number;
  videoCodec: string;
  audioCodec: string;
  bitrate: string;
  format: string;
}

export interface WatermarkConfig {
  text?: string;
  imagePath?: string;
  position: string;
  opacity: number;
  fontSize: number;
}

const PLATFORM_CONFIG: Record<PlatformType, VideoConfig> = {
  amazon: {
    maxWidth: 1920,
    maxHeight: 1080,
    maxDuration: 120,
    videoCodec: 'libx264',
    audioCodec: 'aac',
    bitrate: '5M',
    format: 'mp4'
  },
  ebay: {
    maxWidth: 1920,
    maxHeight: 1080,
    maxDuration: 60,
    videoCodec: 'libx264',
    audioCodec: 'aac',
    bitrate: '4M',
    format: 'mp4'
  },
  shopee: {
    maxWidth: 1080,
    maxHeight: 1920,
    maxDuration: 60,
    videoCodec: 'libx264',
    audioCodec: 'aac',
    bitrate: '4M',
    format: 'mp4'
  },
  lazada: {
    maxWidth: 1080,
    maxHeight: 1920,
    maxDuration: 60,
    videoCodec: 'libx264',
    audioCodec: 'aac',
    bitrate: '4M',
    format: 'mp4'
  },
  tiktok: {
    maxWidth: 1080,
    maxHeight: 1920,
    maxDuration: 60,
    videoCodec: 'libx264',
    audioCodec: 'aac',
    bitrate: '6M',
    format: 'mp4'
  }
};

const DEFAULT_OUTPUT_DIR = 'data/processed-videos';

class VideoProcessor {
  private outputDir: string;

  constructor(outputDir?: string) {
    this.outputDir = outputDir || DEFAULT_OUTPUT_DIR;
    this.ensureOutputDir();
  }

  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  private ensureFfmpegAvailable(): boolean {
    try {
      const ffmpegPath = require('fluent-ffmpeg').FfmpegCommand.prototype._getFfmpegPath();
      if (!ffmpegPath) return false;
      return true;
    } catch (e) {
      logger.warn('ffmpeg not available, video processing will be skipped', e);
      return false;
    }
  }

  public async processVideo(
    inputPath: string,
    platform: PlatformType,
    sku: string,
    watermark?: WatermarkConfig
  ): Promise<string> {
    const config = PLATFORM_CONFIG[platform];
    const outputPath = this.generateOutputPath(inputPath, sku, platform);

    logger.info(`Processing video for ${platform}: ${inputPath}`, { sku, platform });

    try {
      if (!this.ensureFfmpegAvailable()) {
        logger.warn('ffmpeg not available, returning original video path');
        return inputPath;
      }

      if (!fs.existsSync(inputPath)) {
        throw new Error(`Video file not found: ${inputPath}`);
      }

      const result = await this.transcodeVideo(inputPath, outputPath, config, watermark);

      logger.info(`Video processed successfully: ${outputPath}`);
      return result;
    } catch (error) {
      logger.error(`Failed to process video for ${sku} on ${platform}`, error);
      return inputPath;
    }
  }

  private transcodeVideo(
    inputPath: string,
    outputPath: string,
    config: VideoConfig,
    watermark?: WatermarkConfig
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath)
        .videoCodec(config.videoCodec)
        .audioCodec(config.audioCodec)
        .videoBitrate(config.bitrate)
        .format(config.format)
        .outputOptions([
          '-preset', 'medium',
          '-crf', '23',
          '-movflags', '+faststart',
          `-s`, `${config.maxWidth}x${config.maxHeight}`,
          `-t`, config.maxDuration.toString()
        ]);

      if (watermark) {
        if (watermark.text) {
          const filter = this.createTextWatermark(watermark);
          command = command.videoFilters(filter);
        } else if (watermark.imagePath && fs.existsSync(watermark.imagePath)) {
          const filter = this.createImageWatermark(watermark);
          command = command.complexFilter(filter);
        }
      }

      command
        .on('start', (cmd: string) => {
          logger.debug(`FFmpeg command: ${cmd}`);
        })
        .on('progress', (progress: any) => {
          logger.debug(`Processing: ${progress.percent?.toFixed(1) || 0}%`);
        })
        .on('end', () => {
          resolve(outputPath);
        })
        .on('error', (err: Error) => {
          reject(err);
        })
        .save(outputPath);
    });
  }

  private createTextWatermark(config: WatermarkConfig): string {
    const { text = '', position = 'bottomright', opacity = 0.5, fontSize = 24 } = config;
    
    let x: string;
    let y: string;
    
    switch (position) {
      case 'topleft':
      x = '10';
      y = '10';
      break;
    case 'topright':
      x = 'w-text_w-10';
      y = '10';
      break;
    case 'bottomleft':
      x = '10';
      y = 'h-text_h-10';
      break;
    case 'bottomright':
    default:
      x = 'w-text_w-10';
      y = 'h-text_h-10';
      break;
    }

    const color = `white@${opacity}`;
    return `drawtext=text='${text}':x=${x}:y=${y}:fontsize=${fontSize}:fontcolor=${color}:box=1:boxcolor=black@${opacity * 0.3}:boxborderw=5`;
  }

  private createImageWatermark(config: WatermarkConfig): any[] {
    const { imagePath = '', position = 'bottomright', opacity = 0.5 } = config;

    let x: string;
    let y: string;

    switch (position) {
      case 'topleft':
      x = '10';
      y = '10';
      break;
    case 'topright':
      x = 'main_w-overlay_w-10';
      y = '10';
      break;
    case 'bottomleft':
      x = '10';
      y = 'main_h-overlay_h-10';
      break;
    case 'bottomright':
    default:
      x = 'main_w-overlay_w-10';
      y = 'main_h-overlay_h-10';
      break;
    }

    return [
      {
        inputs: ['0:v', '1:v'],
        filter: 'scale2ref',
        options: {
          w: 'main_w/8',
          h: '-1'
        },
        outputs: ['wm', 'base']
      },
      {
        inputs: ['base', 'wm'],
        filter: 'overlay',
        options: {
          x,
          y,
          format: 'auto',
          alpha: opacity
        }
      }
    ];
  }

  private generateOutputPath(inputPath: string, sku: string, platform: PlatformType): string {
    const ext = path.extname(inputPath);
    const baseName = path.basename(inputPath, ext);
    const config = PLATFORM_CONFIG[platform];
    return path.join(this.outputDir, `${sku}-${platform}-${baseName}-${Date.now()}.${config.format}`);
  }

  public getVideoInfo(inputPath: string): Promise<{ duration: number; width: number; height: number }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err: Error, metadata: any) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find((s: any) => s.codec_type === 'video');
        resolve({
          duration: metadata.format.duration,
          width: videoStream?.width || 0,
          height: videoStream?.height || 0
        });
      });
    });
  }

  public async validateVideo(inputPath: string, platform: PlatformType): Promise<{ valid: boolean; issues: string[] }> {
    const config = PLATFORM_CONFIG[platform];
    const issues: string[] = [];

    try {
      const info = await this.getVideoInfo(inputPath);

      if (info.duration > config.maxDuration) {
        issues.push(`Duration ${info.duration.toFixed(1)}s exceeds ${config.maxDuration}s`);
      }

      if (info.width > config.maxWidth || info.height > config.maxHeight) {
        issues.push(`Resolution ${info.width}x${info.height} exceeds ${config.maxWidth}x${config.maxHeight}`);
      }

      return {
        valid: issues.length === 0,
        issues
      };
    } catch (error) {
      return {
        valid: false,
        issues: [`Failed to read video metadata: ${error}`]
      };
    }
  }
}

export const videoProcessor = new VideoProcessor();

export default VideoProcessor;
