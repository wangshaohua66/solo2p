const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const CHAR_SET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[n] = c >>> 0;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function generateCaptchaImage(options = {}) {
  const width = options.width || 200;
  const height = options.height || 80;
  const code = options.code || generateRandomCode(options.length || 4);
  const noiseLevel = options.noiseLevel || 0.15;
  const seed = options.seed || Date.now();

  const rng = mulberry32(seed);

  const pixels = Buffer.alloc(width * height * 3);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      const bgR = 240 + Math.floor(rng() * 15);
      const bgG = 240 + Math.floor(rng() * 15);
      const bgB = 240 + Math.floor(rng() * 15);
      pixels[idx] = bgR;
      pixels[idx + 1] = bgG;
      pixels[idx + 2] = bgB;
    }
  }

  const charSpacing = width / (code.length + 1);
  for (let ci = 0; ci < code.length; ci++) {
    const cx = Math.floor(charSpacing * (ci + 1));
    const cy = Math.floor(height / 2 + (rng() - 0.5) * 10);
    const charSize = Math.floor(height * 0.45);
    drawCharSimple(pixels, width, height, code[ci], cx, cy, charSize, rng);
  }

  for (let i = 0; i < Math.floor(width * height * noiseLevel); i++) {
    const x = Math.floor(rng() * width);
    const y = Math.floor(rng() * height);
    const idx = (y * width + x) * 3;
    pixels[idx] = Math.floor(rng() * 200);
    pixels[idx + 1] = Math.floor(rng() * 200);
    pixels[idx + 2] = Math.floor(rng() * 200);
  }

  for (let l = 0; l < 4; l++) {
    const x1 = Math.floor(rng() * width);
    const y1 = Math.floor(rng() * height);
    const x2 = Math.floor(rng() * width);
    const y2 = Math.floor(rng() * height);
    const r = Math.floor(rng() * 180);
    const g = Math.floor(rng() * 180);
    const b = Math.floor(rng() * 180);
    drawLine(pixels, width, height, x1, y1, x2, y2, r, g, b);
  }

  const pngBuffer = encodePNG(width, height, pixels);

  return {
    code,
    imageBuffer: pngBuffer,
    width,
    height,
    sizeKB: (pngBuffer.length / 1024).toFixed(2)
  };
}

function generateRandomCode(length = 4) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CHAR_SET.charAt(Math.floor(Math.random() * CHAR_SET.length));
  }
  return code;
}

function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function drawLine(pixels, w, h, x1, y1, x2, y2, r, g, b) {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = (x1 < x2) ? 1 : -1;
  const sy = (y1 < y2) ? 1 : -1;
  let err = dx - dy;

  while (true) {
    if (x1 >= 0 && x1 < w && y1 >= 0 && y1 < h) {
      const idx = (y1 * w + x1) * 3;
      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
    }
    if ((x1 === x2) && (y1 === y2)) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x1 += sx; }
    if (e2 < dx) { err += dx; y1 += sy; }
  }
}

const CHAR_GLYPHS = {
  'A': ['0110','1001','1001','1111','1001','1001'],
  'B': ['1110','1001','1110','1001','1001','1110'],
  'C': ['0111','1000','1000','1000','1000','0111'],
  'D': ['1110','1001','1001','1001','1001','1110'],
  'E': ['1111','1000','1110','1000','1000','1111'],
  'F': ['1111','1000','1110','1000','1000','1000'],
  'G': ['0111','1000','1011','1001','1001','0111'],
  'H': ['1001','1001','1111','1001','1001','1001'],
  'J': ['0001','0001','0001','0001','1001','0110'],
  'K': ['1001','1010','1100','1010','1010','1001'],
  'L': ['1000','1000','1000','1000','1000','1111'],
  'M': ['1001','1111','1111','1001','1001','1001'],
  'N': ['1001','1101','1101','1011','1011','1001'],
  'P': ['1110','1001','1001','1110','1000','1000'],
  'Q': ['0110','1001','1001','1001','1010','0101'],
  'R': ['1110','1001','1001','1110','1010','1001'],
  'S': ['0111','1000','0110','0001','0001','1110'],
  'T': ['11111','00100','00100','00100','00100','00100'],
  'U': ['1001','1001','1001','1001','1001','0110'],
  'V': ['1001','1001','1001','1001','0110','0010'],
  'W': ['1001','1001','1001','1111','1111','1001'],
  'X': ['1001','1001','0110','0110','1001','1001'],
  'Y': ['1001','1001','0110','0010','0010','0010'],
  'Z': ['1111','0001','0010','0100','1000','1111'],
  '2': ['0110','1001','0001','0010','0100','1111'],
  '3': ['1110','0001','0010','0001','1001','0110'],
  '4': ['0010','0110','1010','1111','0010','0010'],
  '5': ['1111','1000','1110','0001','0001','1110'],
  '6': ['0111','1000','1110','1001','1001','0110'],
  '7': ['1111','0001','0010','0100','0100','0100'],
  '8': ['0110','1001','0110','1001','1001','0110'],
  '9': ['0110','1001','1001','0111','0001','1110']
};

function drawCharSimple(pixels, w, h, char, cx, cy, size, rng) {
  const glyph = CHAR_GLYPHS[char.toUpperCase()] || CHAR_GLYPHS['A'];
  const rows = glyph.length;
  const cols = glyph[0].length;
  const pixelSize = Math.max(2, Math.floor(size / rows));
  const ox = cx - Math.floor(cols * pixelSize / 2);
  const oy = cy - Math.floor(rows * pixelSize / 2);
  const colorR = 50 + Math.floor(rng() * 120);
  const colorG = 50 + Math.floor(rng() * 120);
  const colorB = 50 + Math.floor(rng() * 120);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (glyph[y][x] === '1') {
        for (let py = 0; py < pixelSize; py++) {
          for (let px = 0; px < pixelSize; px++) {
            const drawX = ox + x * pixelSize + px;
            const drawY = oy + y * pixelSize + py;
            if (drawX >= 0 && drawX < w && drawY >= 0 && drawY < h) {
              const idx = (drawY * w + drawX) * 3;
              pixels[idx] = colorR;
              pixels[idx + 1] = colorG;
              pixels[idx + 2] = colorB;
            }
          }
        }
      }
    }
  }
}

function encodePNG(width, height, rgbPixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    rgbPixels.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  }

  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

function saveCaptchaToFile(outputPath, options = {}) {
  const result = generateCaptchaImage(options);
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, result.imageBuffer);
  return {
    ...result,
    filePath: outputPath
  };
}

module.exports = {
  generateCaptchaImage,
  generateRandomCode,
  saveCaptchaToFile,
  CHAR_SET
};
