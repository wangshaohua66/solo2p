'use strict';

const { MongoClient, ObjectId } = require('mongodb');
const Redis = require('ioredis');
const crypto = require('crypto');
const { logger } = require('../utils/logger');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/drug_compliance';
const REDIS_URI = process.env.REDIS_URI || 'redis://localhost:6379';
const MONGO_DB = process.env.MONGO_DB || 'drug_compliance';

const COLLECTIONS = {
  EVENTS: 'compliance_events',
  TASKS: 'collection_tasks',
  ALERTS: 'alerts',
  CAPTCHA: 'captcha_tasks',
  DEDUP: 'dedup_cache',
  REVISIONS: 'event_revisions',
  REPORTS: 'reports',
  SESSIONS: 'platform_sessions',
};

class Repository {
  constructor() {
    this.mongoClient = null;
    this.db = null;
    this.redis = null;
  }

  async init() {
    await Promise.all([this.initMongo(), this.initRedis()]);
    await this.ensureIndexes();
    logger.info('存储层初始化完成 (MongoDB + Redis)');
  }

  async initMongo() {
    this.mongoClient = new MongoClient(MONGO_URI, {
      maxPoolSize: 50,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
    });
    await this.mongoClient.connect();
    this.db = this.mongoClient.db(MONGO_DB);
    logger.info('MongoDB 连接成功');
  }

  async initRedis() {
    this.redis = new Redis(REDIS_URI, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    this.redis.on('error', (err) => logger.error('Redis 错误', { error: err.message }));
    await this.redis.connect();
    logger.info('Redis 连接成功');
  }

  async ensureIndexes() {
    const col = this.collection(COLLECTIONS.EVENTS);
    await col.createIndex({ source_platform: 1, notice_no: 1 }, { unique: true, name: 'idx_source_notice' });
    await col.createIndex({ event_type: 1, publish_date: -1 }, { name: 'idx_type_date' });
    await col.createIndex({ drug_name: 'text', approval_no: 'text', title: 'text' }, { name: 'idx_text_search' });
    await col.createIndex({ urgency: 1, createdAt: -1 }, { name: 'idx_urgency_created' });

    await this.collection(COLLECTIONS.TASKS).createIndex({ platform: 1, createdAt: -1 }, { name: 'idx_task_platform_date' });
    await this.collection(COLLECTIONS.TASKS).createIndex({ status: 1 }, { name: 'idx_task_status' });
    await this.collection(COLLECTIONS.ALERTS).createIndex({ ruleId: 1, eventId: 1, createdAt: -1 }, { name: 'idx_alert_rule_event' });
    await this.collection(COLLECTIONS.CAPTCHA).createIndex({ status: 1, createdAt: -1 }, { name: 'idx_captcha_status' });
    await this.collection(COLLECTIONS.SESSIONS).createIndex({ platform: 1, username: 1 }, { unique: true, name: 'idx_session_platform_user' });
    logger.debug('MongoDB 索引已就绪');
  }

  collection(name) {
    return this.db.collection(name);
  }

  makeDedupKey(source_platform, notice_no) {
    return `dedup:${source_platform}:${notice_no || ''}`;
  }

  hashEventFields(event) {
    const critical = [
      event.drug_name, event.approval_no, event.urgency, event.publish_date,
      event.title, event.detail_url, event.license_no, event.expiry_date, event.gsp_result,
      event.sample_result, event.bid_winner, event.bid_price, event.adr_severity,
    ].filter(Boolean).join('|');
    return crypto.createHash('sha256').update(critical).digest('hex');
  }

  async checkDuplicate(source_platform, notice_no) {
    if (!notice_no) return null;
    const key = this.makeDedupKey(source_platform, notice_no);
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached);
    const found = await this.collection(COLLECTIONS.EVENTS).findOne(
      { source_platform, notice_no },
      { projection: { _id: 1, hash: 1, notice_no: 1, source_platform: 1 } }
    );
    if (found) {
      await this.redis.setex(key, 86400, JSON.stringify(found));
      return found;
    }
    return null;
  }

  async upsertEvent(normalizedEvent) {
    const { source_platform, notice_no } = normalizedEvent;
    const newHash = this.hashEventFields(normalizedEvent);
    const existing = await this.checkDuplicate(source_platform, notice_no);

    if (existing) {
      if (existing.hash === newHash) {
        return { status: 'duplicate', id: existing._id, changed: false };
      }
      const old = await this.collection(COLLECTIONS.EVENTS).findOne({ _id: existing._id });
      await this.collection(COLLECTIONS.REVISIONS).insertOne({
        eventId: existing._id,
        oldData: old,
        newData: { ...normalizedEvent, hash: newHash },
        changedAt: new Date(),
        changeType: 'revision',
      });
      const result = await this.collection(COLLECTIONS.EVENTS).findOneAndUpdate(
        { _id: existing._id },
        { $set: { ...normalizedEvent, hash: newHash, updatedAt: new Date(), isRevision: true, revisionCount: (old.revisionCount || 0) + 1 } },
        { returnDocument: 'after' }
      );
      await this.redis.setex(this.makeDedupKey(source_platform, notice_no), 86400, JSON.stringify({ _id: result.value._id, hash: newHash }));
      return { status: 'updated', id: result.value._id, changed: true, event: result.value };
    }

    const doc = {
      ...normalizedEvent,
      hash: newHash,
      createdAt: new Date(),
      updatedAt: new Date(),
      revisionCount: 0,
    };
    const result = await this.collection(COLLECTIONS.EVENTS).insertOne(doc);
    if (notice_no) {
      await this.redis.setex(this.makeDedupKey(source_platform, notice_no), 86400, JSON.stringify({ _id: result.insertedId, hash: newHash }));
    }
    return { status: 'inserted', id: result.insertedId, changed: true, event: doc };
  }

  async batchUpsertEvents(events) {
    const summary = { inserted: 0, updated: 0, duplicate: 0, errors: 0, ids: [] };
    for (const ev of events) {
      try {
        const r = await this.upsertEvent(ev);
        summary[r.status]++;
        if (r.id) summary.ids.push(r.id);
      } catch (err) {
        summary.errors++;
        logger.error('批量入库失败一条', { error: err.message, drug: ev.drug_name });
      }
    }
    return summary;
  }

  async findEvents(filter = {}, options = {}) {
    const col = this.collection(COLLECTIONS.EVENTS);
    const cursor = col.find(filter, {
      sort: options.sort || { createdAt: -1 },
      limit: options.limit || 100,
      skip: options.skip || 0,
      ...options.projection ? { projection: options.projection } : {},
    });
    return {
      items: await cursor.toArray(),
      total: await col.countDocuments(filter),
    };
  }

  async aggregateStats(pipeline) {
    return this.collection(COLLECTIONS.EVENTS).aggregate(pipeline).toArray();
  }

  async createTask(taskDoc) {
    const doc = { ...taskDoc, createdAt: new Date(), updatedAt: new Date(), status: 'pending', attempts: 0, captchaIntercepts: 0 };
    const r = await this.collection(COLLECTIONS.TASKS).insertOne(doc);
    doc._id = r.insertedId;
    return doc;
  }

  async updateTask(taskId, patch) {
    return this.collection(COLLECTIONS.TASKS).findOneAndUpdate(
      { _id: new ObjectId(taskId) },
      { $set: { ...patch, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
  }

  async incrementTaskAttempts(taskId) {
    return this.collection(COLLECTIONS.TASKS).findOneAndUpdate(
      { _id: new ObjectId(taskId) },
      { $inc: { attempts: 1 }, $set: { updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
  }

  async incrementCaptchaCount(taskId) {
    return this.collection(COLLECTIONS.TASKS).findOneAndUpdate(
      { _id: new ObjectId(taskId) },
      { $inc: { captchaIntercepts: 1 } },
      { returnDocument: 'after' }
    );
  }

  async findTasks(filter = {}, options = {}) {
    const col = this.collection(COLLECTIONS.TASKS);
    const cursor = col.find(filter, {
      sort: options.sort || { createdAt: -1 },
      limit: options.limit || 50,
    });
    return { items: await cursor.toArray(), total: await col.countDocuments(filter) };
  }

  async saveAlert(alertDoc) {
    const doc = { ...alertDoc, createdAt: new Date() };
    const r = await this.collection(COLLECTIONS.ALERTS).insertOne(doc);
    await this.redis.publish('alerts:new', JSON.stringify({ ...doc, _id: r.insertedId }));
    return { ...doc, _id: r.insertedId };
  }

  async findAlerts(filter = {}, options = {}) {
    const col = this.collection(COLLECTIONS.ALERTS);
    const cursor = col.find(filter, {
      sort: options.sort || { createdAt: -1 },
      limit: options.limit || 50,
    });
    return { items: await cursor.toArray(), total: await col.countDocuments(filter) };
  }

  async saveCaptchaTask(captchaDoc) {
    const doc = { ...captchaDoc, status: 'pending', createdAt: new Date() };
    const r = await this.collection(COLLECTIONS.CAPTCHA).insertOne(doc);
    doc._id = r.insertedId;
    await this.redis.rpush('captcha:queue', JSON.stringify({ id: r.insertedId, platform: doc.platform, taskId: doc.taskId }));
    await this.redis.publish('captcha:pending', JSON.stringify(doc));
    return doc;
  }

  async getPendingCaptcha() {
    const item = await this.redis.lpop('captcha:queue');
    if (!item) return null;
    const parsed = JSON.parse(item);
    return this.collection(COLLECTIONS.CAPTCHA).findOne({ _id: new ObjectId(parsed.id) });
  }

  async peekPendingCaptchas(limit = 10) {
    const items = await this.collection(COLLECTIONS.CAPTCHA)
      .find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
    return items;
  }

  async resolveCaptcha(captchaId, result, resolvedBy = 'system') {
    return this.collection(COLLECTIONS.CAPTCHA).findOneAndUpdate(
      { _id: new ObjectId(captchaId) },
      { $set: { status: 'resolved', result, resolvedBy, resolvedAt: new Date() } },
      { returnDocument: 'after' }
    );
  }

  async waitForCaptchaResult(captchaId, timeoutMs = 600000) {
    const start = Date.now();
    const key = `captcha:result:${captchaId}`;
    while (Date.now() - start < timeoutMs) {
      const result = await this.redis.get(key);
      if (result) {
        const parsed = JSON.parse(result);
        await this.redis.del(key);
        return parsed;
      }
      const doc = await this.collection(COLLECTIONS.CAPTCHA).findOne({ _id: new ObjectId(captchaId) });
      if (doc && doc.status === 'resolved') {
        return doc.result;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error(`验证码处理超时 ${timeoutMs / 1000}s`);
  }

  async submitCaptchaResult(captchaId, result, operator = 'agent') {
    await this.resolveCaptcha(captchaId, result, operator);
    await this.redis.setex(`captcha:result:${captchaId}`, 300, JSON.stringify(result));
    await this.redis.publish(`captcha:resolved:${captchaId}`, JSON.stringify({ result, operator }));
    return true;
  }

  async saveSession(platform, username, cookies, expiresAt = null) {
    return this.collection(COLLECTIONS.SESSIONS).updateOne(
      { platform, username },
      { $set: { cookies, expiresAt, lastUsed: new Date(), updatedAt: new Date() } },
      { upsert: true }
    );
  }

  async loadSession(platform, username) {
    return this.collection(COLLECTIONS.SESSIONS).findOne({ platform, username });
  }

  async clearExpiredSessions() {
    return this.collection(COLLECTIONS.SESSIONS).deleteMany({ expiresAt: { $lt: new Date() } });
  }

  async saveReport(reportDoc) {
    const doc = { ...reportDoc, createdAt: new Date() };
    const r = await this.collection(COLLECTIONS.REPORTS).insertOne(doc);
    return { ...doc, _id: r.insertedId };
  }

  async close() {
    try {
      await this.mongoClient?.close();
      await this.redis?.quit();
      logger.info('存储层连接已关闭');
    } catch (e) { /* ignore */ }
  }

  get ObjectId() { return ObjectId; }
  get COLLECTIONS() { return COLLECTIONS; }
}

module.exports = new Repository();
