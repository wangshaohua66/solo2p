'use strict';

const crypto = require('crypto');
const fs = require('fs');
const forge = require('node-forge');

function sha256(value) {
  if (value === null || value === undefined) return '';
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function randomInt(maxExclusive) {
  return crypto.randomInt(0, maxExclusive);
}

function pick(set) {
  return set[randomInt(set.length)];
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const CHARSETS = {
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  lower: 'abcdefghijkmnpqrstuvwxyz',
  digits: '23456789',
  symbols: '!@#$%^&*-_=+?'
};

function generatePassword(options) {
  const opts = options || {};
  const length = Math.max(opts.length || 24, 8);
  const useUpper = opts.upper !== false;
  const useLower = opts.lower !== false;
  const useDigits = opts.digits !== false;
  const useSymbols = opts.symbols !== false;

  const sets = [];
  const guaranteed = [];
  if (useUpper) { sets.push(CHARSETS.upper); guaranteed.push(pick(CHARSETS.upper)); }
  if (useLower) { sets.push(CHARSETS.lower); guaranteed.push(pick(CHARSETS.lower)); }
  if (useDigits) { sets.push(CHARSETS.digits); guaranteed.push(pick(CHARSETS.digits)); }
  if (useSymbols) { sets.push(CHARSETS.symbols); guaranteed.push(pick(CHARSETS.symbols)); }
  if (!sets.length) sets.push(CHARSETS.lower);

  const all = sets.join('');
  const remaining = length - guaranteed.length;
  const chars = guaranteed.slice();
  for (let i = 0; i < Math.max(remaining, 0); i++) chars.push(pick(all));

  return shuffle(chars).join('');
}

function getField(cert, tag) {
  const attrs = cert.subject.attributes;
  const found = attrs.find((a) => a.name === tag || a.shortName === tag);
  return found ? found.value : '';
}

function getIssuerField(cert, tag) {
  const attrs = cert.issuer.attributes;
  const found = attrs.find((a) => a.name === tag || a.shortName === tag);
  return found ? found.value : '';
}

function getSANs(cert) {
  const ext = cert.getExtension('subjectAltName');
  if (!ext || !ext.altNames) return [];
  return ext.altNames
    .filter((a) => a.type === 2 || a.type === 6 || a.type === 7)
    .map((a) => ({ type: a.type === 2 ? 'DNS' : a.type === 6 ? 'URI' : 'IP', value: a.value }));
}

function toIsoDate(date) {
  if (!date) return '';
  return date.toISOString();
}

function parseCertificate(input, formatHint) {
  let cert;
  const isBuffer = Buffer.isBuffer(input);
  const str = isBuffer ? input.toString('utf8') : String(input);
  const looksPem = str.includes('-----BEGIN CERTIFICATE-----');

  if (looksPem || formatHint === 'pem') {
    cert = forge.pki.certificateFromPem(str);
  } else {
    const der = isBuffer ? input : Buffer.from(str, 'base64');
    const asn1 = forge.asn1.fromDer(der.toString('binary'));
    cert = forge.pki.certificateFromAsn1(asn1);
  }

  const notBefore = cert.validity.notBefore;
  const notAfter = cert.validity.notAfter;
  const now = new Date();
  const msRemaining = notAfter.getTime() - now.getTime();
  const daysRemaining = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
  const isExpired = msRemaining <= 0;

  const derBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const fingerprint = crypto.createHash('sha256').update(Buffer.from(derBytes, 'binary')).digest('hex').toUpperCase();

  return {
    cn: getField(cert, 'commonName'),
    sans: getSANs(cert),
    issuer: getIssuerField(cert, 'commonName'),
    issuerOrg: getIssuerField(cert, 'organizationName'),
    notBefore: toIsoDate(notBefore),
    notAfter: toIsoDate(notAfter),
    serialNumber: cert.serialNumber,
    fingerprint,
    daysRemaining,
    isExpired,
    publicKeyAlgorithm: cert.publicKey ? 'RSA/ECDSA' : 'unknown',
    signatureAlgorithm: cert.siginfo ? cert.siginfo.algorithmOid : ''
  };
}

function parseCertificateFile(filePath, formatHint) {
  const buf = fs.readFileSync(filePath);
  return parseCertificate(buf, formatHint);
}

function expiryTier(daysRemaining, isExpired) {
  if (isExpired) return 'expired';
  if (daysRemaining <= 3) return 'critical';
  if (daysRemaining <= 7) return 'high';
  if (daysRemaining <= 14) return 'medium';
  if (daysRemaining <= 30) return 'low';
  return 'ok';
}

const TIER_RANK = { expired: 0, critical: 1, high: 2, medium: 3, low: 4, ok: 5 };
const TIER_LABEL = {
  expired: '已过期',
  critical: '紧急(<=3天)',
  high: '高(<=7天)',
  medium: '中(<=14天)',
  low: '低(<=30天)',
  ok: '正常'
};

function deriveKey(passphrase, salt) {
  return crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
}

function encrypt(plaintext, passphrase) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(passphrase, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const blob = {
    v: 1,
    alg: 'aes-256-gcm',
    kdf: 'pbkdf2-sha256-100000',
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ct.toString('base64')
  };
  return blob;
}

function encryptToPayload(object, passphrase) {
  const json = JSON.stringify(object);
  return encrypt(json, passphrase);
}

function decrypt(blob, passphrase) {
  const salt = Buffer.from(blob.salt, 'base64');
  const iv = Buffer.from(blob.iv, 'base64');
  const tag = Buffer.from(blob.tag, 'base64');
  const ct = Buffer.from(blob.ciphertext, 'base64');
  const key = deriveKey(passphrase, salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}

function decryptPayload(blob, passphrase) {
  const json = decrypt(blob, passphrase);
  return JSON.parse(json);
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  sha256,
  generatePassword,
  parseCertificate,
  parseCertificateFile,
  expiryTier,
  TIER_RANK,
  TIER_LABEL,
  encrypt,
  decrypt,
  encryptToPayload,
  decryptPayload,
  constantTimeEqual
};
