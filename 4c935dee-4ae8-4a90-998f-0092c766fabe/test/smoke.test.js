'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const crypto = require('../lib/crypto');
const scanner = require('../lib/scanner');
const store = require('../lib/store');
const util = require('../lib/util');
const config = require('../config');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => { passed += 1; console.log(`  \u2713 ${name}`); })
    .catch((err) => { failed += 1; failures.push({ name, err }); console.log(`  \u2717 ${name}: ${err.message}`); });
}

function makeTmpHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-test-'));
  process.env.SC_HOME = dir;
  process.env.SC_STORE_PATH = path.join(dir, 'store.json');
  process.env.SC_AUDIT_MAX_SIZE = '2048';
  return dir;
}

function ensureFixtures(dir) {
  const marker = path.join(dir, 'svc-a', 'application.yml');
  if (fs.existsSync(marker)) return;
  const forge = require('node-forge');
  fs.mkdirSync(path.join(dir, 'svc-a'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'svc-b'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'svc-a', 'application.yml'), [
    'spring:',
    '  datasource:',
    '    url: jdbc:mysql://db:3306/app',
    '    username: app',
    '    password: SuperSecret123!',
    '  redis:',
    '    password: RedisPass456!',
    '  kafka:',
    '    sasl:',
    '      password: KafkaSasl789!',
    'alipay:',
    '  private-key: MIIBVwIBADANBgkqhkiG9w0BAQEFAASCAUEw',
    '  app-secret: wxSecretAbc89',
    'jwt:',
    '  secret: jwtSigningBase64',
    ''
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'svc-b', '.env'), [
    'DB_PASSWORD=envDbPass001',
    'REDIS_PASSWORD=envRedis002',
    'API_KEY=sk_live_abc789',
    ''
  ].join('\n'));
  const mk = (cn, daysFromNow, file) => {
    const kp = forge.pki.rsa.generateKeyPair(1024);
    const c = forge.pki.createCertificate();
    c.publicKey = kp.publicKey;
    c.serialNumber = '01';
    c.validity.notBefore = new Date();
    c.validity.notAfter = new Date(Date.now() + daysFromNow * 86400000);
    c.setSubject([{ name: 'commonName', value: cn }]);
    c.setIssuer([{ name: 'commonName', value: 'Test CA' }]);
    c.sign(kp.privateKey);
    fs.writeFileSync(path.join(dir, file), forge.pki.certificateToPem(c));
  };
  mk('old.example.com', -2, path.join('svc-b', 'expired.crt'));
  mk('api.example.com', 5, path.join('svc-a', 'tls.crt'));
  mk('stable.example.com', 400, path.join('svc-b', 'long.crt'));
}

async function main() {
  console.log('crypto:');
  await test('generatePassword 满足复杂度', () => {
    const p = crypto.generatePassword({ length: 32 });
    assert.equal(p.length, 32);
    assert.ok(/[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p));
  });
  await test('sha256 稳定', () => {
    assert.equal(crypto.sha256('hello'), '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    assert.equal(crypto.sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
  await test('AES 加解密往返', () => {
    const blob = crypto.encryptToPayload({ a: 1, b: 'secret' }, 'pass');
    assert.deepEqual(crypto.decryptPayload(blob, 'pass'), { a: 1, b: 'secret' });
    assert.throws(() => crypto.decryptPayload(blob, 'wrong'), /authenticat/i);
  });
  await test('证书解析与分级', () => {
    const forge = require('node-forge');
    const kp = forge.pki.rsa.generateKeyPair(1024);
    const cert = forge.pki.createCertificate();
    cert.publicKey = kp.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date(Date.now() + 2 * 86400000);
    cert.setSubject([{ name: 'commonName', value: 'test.example.com' }]);
    cert.setIssuer([{ name: 'commonName', value: 'CA' }]);
    cert.sign(kp.privateKey);
    const info = crypto.parseCertificate(forge.pki.certificateToPem(cert));
    assert.equal(info.cn, 'test.example.com');
    assert.equal(info.issuer, 'CA');
    assert.ok(info.daysRemaining <= 2);
    assert.equal(crypto.expiryTier(info.daysRemaining, info.isExpired), 'critical');
  });

  console.log('scanner:');
  const fixtureDir = path.join(__dirname, '..', 'fixtures');
  ensureFixtures(fixtureDir);
  await test('扫描 fixtures 发现密钥并脱敏', async () => {
    const res = await scanner.scanDirectory(fixtureDir);
    assert.ok(res.files >= 2);
    const names = res.findings.map((f) => f.name);
    assert.ok(names.includes('DB_PASSWORD'));
    assert.ok(names.includes('API_KEY'));
    const pwd = res.findings.find((f) => f.name === 'password');
    assert.ok(pwd.preview.includes('***'));
    assert.ok(!res.findings.some((f) => f.preview.includes('changeme')));
  });
  await test('classifyKey 类型识别', () => {
    assert.equal(scanner.classifyKey('api_key'), 'apikey');
    assert.equal(scanner.classifyKey('access_token'), 'token');
    assert.equal(scanner.classifyKey('db.password'), 'password');
    assert.equal(scanner.classifyKey('normal_field'), null);
  });

  console.log('store:');
  makeTmpHome();
  await test('审计日志写入与查询', () => {
    store.recordAudit({ action: 'rotate', secretName: 'mysql/app', secretPath: 'mysql/app', status: 'success', beforeHash: 'aaa', afterHash: 'bbb' });
    store.recordAudit({ action: 'rotate', secretName: 'redis/cache', secretPath: 'redis/cache', status: 'failed' });
    const all = store.queryAudit({ action: 'rotate' });
    assert.equal(all.length, 2);
    const ok = store.queryAudit({ action: 'rotate', status: 'success' });
    assert.equal(ok.length, 1);
  });
  await test('密钥元数据 upsert/get', () => {
    store.upsertSecret('dev', { path: 'mysql/app', name: 'mysql/app', source: 'vault', lastHash: 'h1', lastRotatedAt: new Date().toISOString() });
    const secrets = store.getSecrets('dev');
    assert.equal(secrets.length, 1);
    assert.equal(secrets[0].lastHash, 'h1');
  });
  await test('审计日志按大小轮转', () => {
    for (let i = 0; i < 50; i++) store.recordAudit({ action: 'noop', secretName: `s${i}` });
    const rotated = fs.existsSync(`${store.auditPath()}.1`);
    assert.ok(rotated, '应生成 audit.jsonl.1 轮转文件');
  });
  await test('updateAuditRecord 更新审计记录字段', () => {
    const rec = store.recordAudit({ action: 'cert-alert', secretName: 'test.example.com', status: 'success', metadata: { tier: 'high', handled: false } });
    assert.equal(rec.metadata.handled, false);
    const updated = store.updateAuditRecord(rec.id, { metadata: { handled: true, handledAt: new Date().toISOString() } });
    assert.ok(updated);
    assert.equal(updated.metadata.handled, true);
    assert.ok(updated.metadata.handledAt);
    const queried = store.queryAudit({ action: 'cert-alert' }).find((r) => r.id === rec.id);
    assert.equal(queried.metadata.handled, true);
  });
  await test('store.json 路径可通过 SC_STORE_PATH 覆盖', () => {
    assert.ok(store.storePath().includes(os.tmpdir()));
  });
  await test('registerTemp + cleanupAllTemp 临时文件清理', () => {
    const tmpFile = path.join(os.tmpdir(), `sc-test-${Date.now()}.tmp`);
    fs.writeFileSync(tmpFile, 'test');
    store.registerTemp(tmpFile);
    assert.ok(fs.existsSync(tmpFile));
    store.cleanupAllTemp();
    assert.ok(!fs.existsSync(tmpFile));
  });

  console.log('util:');
  await test('pLimit 并发上限', async () => {
    let active = 0; let max = 0;
    const limit = util.pLimit(3);
    const tasks = Array.from({ length: 10 }, () => limit(async () => {
      active += 1; max = Math.max(max, active);
      await util.sleep(10); active -= 1;
    }));
    await Promise.all(tasks);
    assert.ok(max <= 3, `最大并发 ${max} 应 <= 3`);
  });
  await test('retry 对可重试错误重试', async () => {
    let n = 0;
    const fn = () => { n += 1; const e = new Error('boom'); e.code = 'ETIMEDOUT'; if (n < 3) throw e; return 'ok'; };
    const r = await util.retry(fn, { retries: 3, baseDelay: 1 });
    assert.equal(r, 'ok');
    assert.equal(n, 3);
  });
  await test('retry 不重试不可重试错误', async () => {
    const e = new Error('bad'); e.code = 'EINVALID';
    let n = 0;
    await assert.rejects(() => util.retry(() => { n += 1; throw e; }, { retries: 3, baseDelay: 1 }));
    assert.equal(n, 1);
  });
  await test('parseDuration', () => {
    assert.equal(util.parseDuration('30s'), 30000);
    assert.equal(util.parseDuration('7d'), 604800000);
    assert.equal(util.parseDuration('2h'), 7200000);
  });

  console.log('config:');
  await test('profiles 与切换', () => {
    config.ensureConfigFile();
    const list = config.listProfiles();
    assert.ok(list.length >= 4);
    config.setActiveProfile('staging');
    const prof = config.resolve({ profile: 'staging' });
    assert.equal(prof.name, 'staging');
  });
  await test('环境变量覆盖', () => {
    process.env.SC_VAULT_ADDR = 'http://override:8200';
    const prof = config.resolve({ profile: 'dev' });
    assert.equal(prof.vault.endpoint, 'http://override:8200');
    delete process.env.SC_VAULT_ADDR;
  });

  console.log('cli commands:');
  await test('scan 命令 (无 vault/k8s)', async () => {
    const scanCmd = require('../commands/scan');
    const r = await scanCmd.handler({ dir: [fixtureDir], vault: false, k8s: false, json: true, quiet: true });
    assert.ok(r.uniqueSecrets > 0);
  });
  await test('cert 命令', async () => {
    const certCmd = require('../commands/cert');
    const r = await certCmd.handler({ paths: [fixtureDir], json: true, quiet: true });
    assert.equal(r.summary.total, 3);
    assert.ok(r.summary.expired >= 1);
  });
  await test('diff 命令', async () => {
    const diffCmd = require('../commands/diff');
    const r = await diffCmd.handler({ dir: fixtureDir, k8s: false, json: true, quiet: true });
    assert.ok(r.references > 0);
  });
  await test('audit report 命令', async () => {
    const auditCmd = require('../commands/audit');
    const r = await auditCmd.handler({ mode: 'report', json: true, quiet: true });
    assert.ok('summary' in r);
  });

  console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
  if (failed) {
    console.log('\n失败详情:');
    failures.forEach((f) => console.log(`  - ${f.name}\n    ${f.err && f.err.stack ? f.err.stack : f.err}`));
    process.exit(1);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
