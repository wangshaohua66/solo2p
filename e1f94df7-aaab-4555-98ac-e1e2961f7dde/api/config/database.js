import { v4 as uuidv4 } from 'uuid';

class Collection {
  constructor(name) {
    this.name = name;
    this._data = new Map();
  }

  _addTimestamps(doc) {
    const now = new Date().toISOString();
    return {
      ...doc,
      created_at: doc.created_at || now,
      updated_at: now,
    };
  }

  find(query = {}) {
    const results = [];
    for (const doc of this._data.values()) {
      if (this._match(doc, query)) {
        results.push({ ...doc });
      }
    }
    return results;
  }

  findOne(query = {}) {
    for (const doc of this._data.values()) {
      if (this._match(doc, query)) {
        return { ...doc };
      }
    }
    return null;
  }

  findById(id) {
    const doc = this._data.get(id);
    return doc ? { ...doc } : null;
  }

  insertOne(doc) {
    const _id = doc._id || uuidv4();
    const newDoc = this._addTimestamps({ ...doc, _id });
    this._data.set(_id, newDoc);
    return { ...newDoc };
  }

  updateOne(query, update) {
    const doc = this.findOne(query);
    if (!doc) return null;
    const updated = this._addTimestamps({ ...doc, ...update });
    this._data.set(doc._id, updated);
    return { ...updated };
  }

  updateById(id, update) {
    const doc = this._data.get(id);
    if (!doc) return null;
    const updated = this._addTimestamps({ ...doc, ...update });
    this._data.set(id, updated);
    return { ...updated };
  }

  deleteOne(query) {
    const doc = this.findOne(query);
    if (!doc) return null;
    this._data.delete(doc._id);
    return doc;
  }

  deleteById(id) {
    const doc = this._data.get(id);
    if (!doc) return null;
    this._data.delete(id);
    return doc;
  }

  count(query = {}) {
    return this.find(query).length;
  }

  aggregate(pipeline) {
    let results = this.find();
    for (const stage of pipeline) {
      if (stage.$match) {
        results = results.filter((doc) => this._match(doc, stage.$match));
      } else if (stage.$group) {
        results = this._aggregateGroup(results, stage.$group);
      } else if (stage.$sort) {
        results = this._aggregateSort(results, stage.$sort);
      } else if (stage.$limit) {
        results = results.slice(0, stage.$limit);
      } else if (stage.$skip) {
        results = results.slice(stage.$skip);
      }
    }
    return results;
  }

  _aggregateGroup(docs, group) {
    const groupId = group._id;
    const groups = new Map();
    for (const doc of docs) {
      const key = groupId === null ? null : this._getNestedValue(doc, groupId.replace('$', ''));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(doc);
    }
    const results = [];
    for (const [key, groupDocs] of groups) {
      const result = { _id: key };
      for (const [field, expr] of Object.entries(group)) {
        if (field === '_id') continue;
        if (expr.$sum) {
          if (typeof expr.$sum === 'number') {
            result[field] = groupDocs.length * expr.$sum;
          } else {
            const path = expr.$sum.replace('$', '');
            result[field] = groupDocs.reduce((sum, d) => sum + (this._getNestedValue(d, path) || 0), 0);
          }
        } else if (expr.$avg) {
          const path = expr.$avg.replace('$', '');
          const values = groupDocs.map((d) => this._getNestedValue(d, path)).filter((v) => v != null);
          result[field] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        } else if (expr.$count) {
          result[field] = groupDocs.length;
        }
      }
      results.push(result);
    }
    return results;
  }

  _aggregateSort(docs, sort) {
    const entries = Object.entries(sort);
    return [...docs].sort((a, b) => {
      for (const [field, order] of entries) {
        const va = this._getNestedValue(a, field);
        const vb = this._getNestedValue(b, field);
        if (va < vb) return -1 * order;
        if (va > vb) return 1 * order;
      }
      return 0;
    });
  }

  _getNestedValue(obj, path) {
    return path.split('.').reduce((o, k) => o && o[k], obj);
  }

  _match(doc, query) {
    for (const [key, value] of Object.entries(query)) {
      const docValue = this._getNestedValue(doc, key);
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (value.$ne !== undefined && docValue === value.$ne) return false;
        if (value.$in !== undefined && !value.$in.includes(docValue)) return false;
        if (value.$gte !== undefined && docValue < value.$gte) return false;
        if (value.$lte !== undefined && docValue > value.$lte) return false;
        if (value.$gt !== undefined && docValue <= value.$gt) return false;
        if (value.$lt !== undefined && docValue >= value.$lt) return false;
        if (value.$regex !== undefined) {
          const regex = new RegExp(value.$regex, value.$options || '');
          if (!regex.test(docValue)) return false;
        }
      } else {
        if (docValue !== value) return false;
      }
    }
    return true;
  }

  clear() {
    this._data.clear();
  }

  insertMany(docs) {
    return docs.map((doc) => this.insertOne(doc));
  }
}

class Database {
  constructor() {
    this.collections = {
      users: new Collection('users'),
      lots: new Collection('lots'),
      auctions: new Collection('auctions'),
      bids: new Collection('bids'),
      settlements: new Collection('settlements'),
      deposits: new Collection('deposits'),
    };
  }

  collection(name) {
    return this.collections[name];
  }
}

const db = new Database();

export default db;
export { Database, Collection };
