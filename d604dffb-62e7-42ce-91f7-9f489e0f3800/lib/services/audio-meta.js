import fs from 'fs-extra';
import path from 'path';
import { parseFile } from 'music-metadata';

const WAV_HEADER_SIZE = 44;
const AIFF_HEADER_SIZE = 54;

function parseWavHeader(buffer) {
  if (buffer.length < WAV_HEADER_SIZE) return null;
  const chunkId = buffer.toString('ascii', 0, 4);
  if (chunkId !== 'RIFF') return null;
  const format = buffer.toString('ascii', 8, 12);
  if (format !== 'WAVE') return null;
  const audioFormat = buffer.readUInt16LE(20);
  const numChannels = buffer.readUInt16LE(22);
  const sampleRate = buffer.readUInt32LE(24);
  const byteRate = buffer.readUInt32LE(28);
  const blockAlign = buffer.readUInt16LE(32);
  const bitsPerSample = buffer.readUInt16LE(34);
  const dataSize = buffer.readUInt32LE(40);
  const duration = dataSize / byteRate;
  return {
    format: 'WAV',
    audioFormat,
    sampleRate,
    bitsPerSample,
    numChannels,
    byteRate,
    blockAlign,
    duration,
    dataSize
  };
}

function parseAiffHeader(buffer) {
  if (buffer.length < AIFF_HEADER_SIZE) return null;
  const form = buffer.toString('ascii', 0, 4);
  if (form !== 'FORM') return null;
  const aiff = buffer.toString('ascii', 8, 12);
  if (aiff !== 'AIFF' && aiff !== 'AIFC') return null;
  let offset = 12;
  let commChunk = null;
  let ssndChunk = null;
  while (offset < buffer.length - 8) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32BE(offset + 4);
    if (chunkId === 'COMM') {
      const numChannels = buffer.readUInt16BE(offset + 8);
      const numSampleFrames = buffer.readUInt32BE(offset + 10);
      const sampleSize = buffer.readUInt16BE(offset + 14);
      const sampleRateBytes = buffer.slice(offset + 16, offset + 26);
      const sampleRate = parseFloat(readExtendedFloat(sampleRateBytes));
      const duration = numSampleFrames / sampleRate;
      commChunk = { numChannels, sampleSize, sampleRate, numSampleFrames, duration };
    } else if (chunkId === 'SSND') {
      ssndChunk = { offset: buffer.readUInt32BE(offset + 8), blockSize: buffer.readUInt32BE(offset + 12), size: chunkSize };
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  if (!commChunk) return null;
  return {
    format: aiff,
    sampleRate: commChunk.sampleRate,
    bitsPerSample: commChunk.sampleSize,
    numChannels: commChunk.numChannels,
    duration: commChunk.duration,
    dataSize: ssndChunk ? ssndChunk.size : 0
  };
}

function readExtendedFloat(bytes) {
  const sign = bytes[0] & 0x80;
  const exponent = ((bytes[0] & 0x7F) << 8) | (bytes[1] & 0xFF);
  const mantissaHi = bytes.readUInt32BE(2);
  const mantissaLo = bytes.readUInt32BE(6);
  if (exponent === 0 && mantissaHi === 0 && mantissaLo === 0) return 0;
  const mantissa = (mantissaHi * 0x100000000 + mantissaLo) / 0x10000000000000000;
  const value = Math.pow(2, exponent - 16383) * (1 + mantissa);
  return sign ? -value : value;
}

async function parseWithFallback(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const fileSize = fs.statSync(filePath).size;
  try {
    const metadata = await parseFile(filePath, { duration: true, skipCovers: true });
    return {
      format: metadata.format.container || ext.slice(1).toUpperCase(),
      sampleRate: metadata.format.sampleRate || 44100,
      bitsPerSample: metadata.format.bitsPerSample || 16,
      numChannels: metadata.format.numberOfChannels || 2,
      duration: metadata.format.duration || 0,
      bitRate: metadata.format.bitrate,
      codec: metadata.format.codec,
      lossless: metadata.format.lossless,
      fileSize,
      title: metadata.common.title,
      artist: metadata.common.artist,
      album: metadata.common.album
    };
  } catch (err) {
    const fd = fs.openSync(filePath, 'r');
    try {
      if (ext === '.wav') {
        const buffer = Buffer.alloc(Math.min(WAV_HEADER_SIZE + 1024, fileSize));
        fs.readSync(fd, buffer, 0, buffer.length, 0);
        const parsed = parseWavHeader(buffer);
        if (parsed) {
          return {
            format: parsed.format,
            sampleRate: parsed.sampleRate,
            bitsPerSample: parsed.bitsPerSample,
            numChannels: parsed.numChannels,
            duration: parsed.duration,
            bitRate: parsed.byteRate * 8,
            fileSize,
            lossless: true
          };
        }
      } else if (ext === '.aiff' || ext === '.aif') {
        const buffer = Buffer.alloc(Math.min(4096, fileSize));
        fs.readSync(fd, buffer, 0, buffer.length, 0);
        const parsed = parseAiffHeader(buffer);
        if (parsed) {
          return {
            format: parsed.format,
            sampleRate: parsed.sampleRate,
            bitsPerSample: parsed.bitsPerSample,
            numChannels: parsed.numChannels,
            duration: parsed.duration,
            fileSize,
            lossless: true
          };
        }
      }
      return {
        format: ext.slice(1).toUpperCase(),
        sampleRate: 44100,
        bitsPerSample: 16,
        numChannels: 2,
        duration: 0,
        fileSize,
        note: '无法解析元数据，请使用专业软件检查'
      };
    } finally {
      fs.closeSync(fd);
    }
  }
}

export async function extractAudioMetadata(filePath) {
  const startTime = Date.now();
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`文件不存在: ${absolutePath}`);
  }
  const stat = fs.statSync(absolutePath);
  if (!stat.isFile()) {
    throw new Error(`路径不是文件: ${absolutePath}`);
  }
  const meta = await parseWithFallback(absolutePath);
  const elapsed = Date.now() - startTime;
  return {
    ...meta,
    filePath: absolutePath,
    fileName: path.basename(absolutePath),
    fileExtension: path.extname(absolutePath).toLowerCase(),
    fileSize: stat.size,
    createdAt: stat.birthtime.toISOString(),
    modifiedAt: stat.mtime.toISOString(),
    parseTimeMs: elapsed
  };
}

export async function batchExtractMetadata(filePaths, concurrency = 10) {
  const results = [];
  const errors = [];
  let index = 0;
  async function worker() {
    while (index < filePaths.length) {
      const currentIndex = index++;
      const filePath = filePaths[currentIndex];
      try {
        const meta = await extractAudioMetadata(filePath);
        results.push({ index: currentIndex, success: true, data: meta });
      } catch (err) {
        errors.push({ index: currentIndex, success: false, file: filePath, error: err.message });
      }
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, filePaths.length) }, worker);
  await Promise.all(workers);
  results.sort((a, b) => a.index - b.index);
  return {
    success: results.map(r => r.data),
    errors,
    total: filePaths.length,
    successCount: results.length,
    errorCount: errors.length
  };
}

export function validateAudioSpecs(metadata, requirements = {}) {
  const issues = [];
  if (requirements.minSampleRate && metadata.sampleRate < requirements.minSampleRate) {
    issues.push(`采样率过低: ${metadata.sampleRate}Hz，要求不低于 ${requirements.minSampleRate}Hz`);
  }
  if (requirements.maxSampleRate && metadata.sampleRate > requirements.maxSampleRate) {
    issues.push(`采样率过高: ${metadata.sampleRate}Hz，要求不高于 ${requirements.maxSampleRate}Hz`);
  }
  if (requirements.sampleRate && metadata.sampleRate !== requirements.sampleRate) {
    issues.push(`采样率不符合要求: ${metadata.sampleRate}Hz，要求 ${requirements.sampleRate}Hz`);
  }
  if (requirements.minBitDepth && metadata.bitsPerSample < requirements.minBitDepth) {
    issues.push(`位深过低: ${metadata.bitsPerSample}bit，要求不低于 ${requirements.minBitDepth}bit`);
  }
  if (requirements.bitDepth && metadata.bitsPerSample !== requirements.bitDepth) {
    issues.push(`位深不符合要求: ${metadata.bitsPerSample}bit，要求 ${requirements.bitDepth}bit`);
  }
  if (requirements.channels && metadata.numChannels !== requirements.channels) {
    issues.push(`声道数不符合要求: ${metadata.numChannels}声道，要求 ${requirements.channels}声道`);
  }
  if (requirements.minDuration && metadata.duration < requirements.minDuration) {
    issues.push(`时长过短: ${metadata.duration.toFixed(2)}秒，要求不低于 ${requirements.minDuration}秒`);
  }
  if (requirements.maxDuration && metadata.duration > requirements.maxDuration) {
    issues.push(`时长过长: ${metadata.duration.toFixed(2)}秒，要求不高于 ${requirements.maxDuration}秒`);
  }
  if (requirements.lossless && !metadata.lossless) {
    issues.push('音频格式不是无损格式');
  }
  return {
    valid: issues.length === 0,
    issues,
    metadata
  };
}

export function compareMetadata(meta1, meta2) {
  const diffs = [];
  const keys = ['sampleRate', 'bitsPerSample', 'numChannels', 'duration', 'format', 'fileSize'];
  keys.forEach(key => {
    if (meta1[key] !== meta2[key]) {
      diffs.push({
        field: key,
        oldValue: meta1[key],
        newValue: meta2[key]
      });
    }
  });
  return {
    identical: diffs.length === 0,
    differences: diffs,
    durationChange: (meta2.duration || 0) - (meta1.duration || 0),
    sizeChange: (meta2.fileSize || 0) - (meta1.fileSize || 0)
  };
}
