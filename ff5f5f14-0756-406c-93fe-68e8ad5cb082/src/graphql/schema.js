const { gql } = require('apollo-server-express');
const { getDb } = require('../models/db');
const matchingService = require('../services/matchingService');
const expiryService = require('../services/expiryService');

const typeDefs = gql`
  type User {
    id: Int
    username: String
    role: String
    full_name: String
    hospital_id: Int
    hospital: Hospital
    created_at: String
  }

  type Hospital {
    id: Int
    code: String
    name: String
    address: String
    contact_person: String
    contact_phone: String
    created_at: String
  }

  type Donor {
    id: Int
    donor_card_no: String
    id_card_no: String
    name: String
    gender: String
    birth_date: String
    blood_type_abo: String
    blood_type_rh: String
    blood_type_full: String
    phone: String
    address: String
    donation_count: Int
    last_donation_date: String
    health_answers: JSON
    is_blocked: Boolean
    block_reason: String
    created_at: String
    updated_at: String
    donation_history: [BloodBag]
    screenings: [DonorScreening]
  }

  type DonorScreening {
    id: Int
    donor_id: Int
    donor: Donor
    screening_date: String
    hemoglobin: Float
    alt: Int
    hbsag: String
    anti_hcv: String
    anti_hiv: String
    syphilis: String
    blood_type_abo: String
    blood_type_rh: String
    result: String
    performed_by: Int
    performed_by_user: User
    created_at: String
  }

  type BloodBag {
    id: Int
    bag_no: String
    donor_id: Int
    donor: Donor
    screening_id: Int
    screening: DonorScreening
    collection_date: String
    collection_site: String
    volume: Float
    status: String
    collected_by: Int
    collected_by_user: User
    created_at: String
    test_records: [TestRecord]
    component_products: [ComponentProduct]
  }

  type TestRecord {
    id: Int
    bag_id: Int
    blood_bag: BloodBag
    test_batch_no: String
    test_date: String
    hbsag: String
    anti_hcv: String
    anti_hiv: String
    syphilis: String
    result: String
    tested_by: Int
    tested_by_user: User
    created_at: String
  }

  type ComponentProduct {
    id: Int
    product_code: String
    parent_bag_id: Int
    parent_bag: BloodBag
    component_type: String
    blood_type_abo: String
    blood_type_rh: String
    blood_type_full: String
    volume: Float
    preparation_date: String
    expiry_date: String
    preparation_batch_no: String
    prepared_by: Int
    prepared_by_user: User
    created_at: String
    inventory: InventoryBatch
  }

  type InventoryBatch {
    id: Int
    product_id: Int
    product: ComponentProduct
    storage_location: String
    status: String
    expiry_date: String
    expiry_warning_level: String
    days_remaining: Int
    lock_reason: String
    created_at: String
    updated_at: String
    matching_result: MatchingResult
  }

  type BloodRequest {
    id: Int
    request_no: String
    hospital_id: Int
    hospital: Hospital
    patient_name: String
    patient_gender: String
    patient_age: Int
    patient_blood_type_abo: String
    patient_blood_type_rh: String
    component_type: String
    quantity: Int
    urgency: String
    clinical_diagnosis: String
    cross_match_required: Int
    status: String
    priority_score: Int
    requested_by: Int
    requested_by_user: User
    created_at: String
    matching_results: [MatchingResult]
    delivery_tasks: [DeliveryTask]
  }

  type MatchingResult {
    id: Int
    request_id: Int
    request: BloodRequest
    inventory_id: Int
    inventory: InventoryBatch
    major_match_result: String
    minor_match_result: String
    final_result: String
    matched_at: String
    matched_by: Int
    matched_by_user: User
  }

  type DeliveryTask {
    id: Int
    task_no: String
    request_id: Int
    request: BloodRequest
    cooler_box_no: String
    temperature_logger_no: String
    departure_temperature: Float
    departure_time: String
    estimated_arrival: String
    dispatcher_id: Int
    dispatcher: User
    status: String
    created_at: String
    confirmation: DeliveryConfirmation
  }

  type DeliveryConfirmation {
    id: Int
    delivery_task_id: Int
    delivery_task: DeliveryTask
    arrival_temperature: Float
    arrival_time: String
    received_by: String
    receiver_signature: String
    remarks: String
    created_at: String
  }

  type BlocklistEntry {
    id: Int
    donor_id: Int
    donor: Donor
    reason: String
    permanent: Int
    blocked_by: Int
    blocked_by_user: User
    blocked_at: String
    expires_at: String
  }

  type SafetyThreshold {
    id: Int
    blood_type_abo: String
    blood_type_rh: String
    component_type: String
    min_quantity: Int
    warning_quantity: Int
    created_at: String
  }

  type InventorySummary {
    blood_type_abo: String
    blood_type_rh: String
    blood_type_full: String
    component_type: String
    total_quantity: Int
    available_quantity: Int
    min_quantity: Int
    warning_quantity: Int
    min_days_remaining: Float
    stock_status: String
    stock_shortfall: Int
  }

  type CrossMatchResult {
    request_id: Int
    request: BloodRequest
    matched_count: Int
    requested_count: Int
    is_fully_matched: Boolean
    duration_ms: Int
    matched_units: [InventoryBatch]
  }

  type ExpiryScanResult {
    scanned: Int
    expired: Int
    updated: Int
    duration_ms: Int
  }

  scalar JSON

  type Query {
    donors(name: String, id_card_no: String, donor_card_no: String, blood_type_abo: String, blood_type_rh: String, page: Int, page_size: Int): [Donor]
    donor(id: Int!): Donor
    blood_bags(status: String, donor_id: Int, page: Int, page_size: Int): [BloodBag]
    blood_bag(id: Int!): BloodBag
    test_records(bag_id: Int, test_batch_no: String, page: Int, page_size: Int): [TestRecord]
    component_products(parent_bag_id: Int, component_type: String, blood_type_abo: String, blood_type_rh: String, page: Int, page_size: Int): [ComponentProduct]
    inventory(
      blood_type_abo: String,
      blood_type_rh: String,
      component_type: String,
      status: String,
      expiry_from: String,
      expiry_to: String,
      page: Int,
      page_size: Int
    ): [InventoryBatch]
    inventory_summary(
      blood_type_abo: String,
      blood_type_rh: String,
      component_type: String,
      status: String
    ): [InventorySummary]
    inventory_details(
      blood_type_abo: String,
      blood_type_rh: String,
      component_type: String,
      status: String,
      expiry_from: String,
      expiry_to: String,
      page: Int,
      page_size: Int
    ): [InventoryBatch]
    blood_requests(hospital_id: Int, status: String, urgency: String, page: Int, page_size: Int): [BloodRequest]
    blood_request(id: Int!): BloodRequest
    delivery_tasks(status: String, request_id: Int, page: Int, page_size: Int): [DeliveryTask]
    delivery_task(id: Int!): DeliveryTask
    hospitals: [Hospital]
    hospital(id: Int!): Hospital
    blocklist: [BlocklistEntry]
    safety_thresholds: [SafetyThreshold]
    expiry_warnings: [JSON]
    pending_requests_by_priority: [BloodRequest]
  }

  type Mutation {
    registerDonor(
      id_card_no: String!,
      name: String!,
      gender: String!,
      birth_date: String!,
      phone: String,
      address: String,
      health_answers: JSON
    ): Donor
    createScreening(
      donor_id: Int!,
      hemoglobin: Float,
      alt: Int,
      hbsag: String,
      anti_hcv: String,
      anti_hiv: String,
      syphilis: String,
      blood_type_abo: String,
      blood_type_rh: String,
      screening_date: String
    ): DonorScreening
    createBloodBag(
      donor_id: Int!,
      screening_id: Int!,
      collection_date: String,
      collection_site: String,
      volume: Float
    ): BloodBag
    addToBlocklist(
      donor_id: Int!,
      reason: String!,
      permanent: Int,
      expires_at: String
    ): BlocklistEntry
    createTestRecord(
      bag_id: Int!,
      test_batch_no: String!,
      test_date: String,
      hbsag: String!,
      anti_hcv: String!,
      anti_hiv: String!,
      syphilis: String!
    ): TestRecord
    createComponentProducts(
      parent_bag_id: Int!,
      components: [ComponentInput]!,
      preparation_date: String,
      preparation_batch_no: String
    ): [ComponentProduct]
    manualScrapInventory(id: Int!, reason: String!): InventoryBatch
    updateSafetyThreshold(id: Int!, min_quantity: Int!, warning_quantity: Int!): SafetyThreshold
    runExpiryScan: ExpiryScanResult
    stockOut(inventory_ids: [Int]!): JSON
    createBloodRequest(
      hospital_id: Int!,
      patient_name: String,
      patient_gender: String,
      patient_age: Int,
      patient_blood_type_abo: String!,
      patient_blood_type_rh: String!,
      component_type: String!,
      quantity: Int!,
      urgency: String!,
      clinical_diagnosis: String,
      cross_match_required: Int
    ): BloodRequest
    performCrossMatch(request_id: Int!): CrossMatchResult
    createDeliveryTask(
      request_id: Int!,
      cooler_box_no: String!,
      temperature_logger_no: String,
      departure_temperature: Float
    ): DeliveryTask
    confirmDelivery(
      delivery_task_id: Int!,
      arrival_temperature: Float!,
      received_by: String!,
      remarks: String
    ): DeliveryConfirmation
  }

  input ComponentInput {
    component_type: String!
    volume: Float
  }
`;

const resolvers = {
  Donor: {
    blood_type_full: (parent) => `${parent.blood_type_abo || ''}${parent.blood_type_rh || ''}`,
    is_blocked: async (parent, _, { db }) => {
      const bl = db.prepare('SELECT * FROM blocklist WHERE donor_id = ? AND permanent = 1').get(parent.id);
      return !!bl;
    },
    block_reason: async (parent, _, { db }) => {
      const bl = db.prepare('SELECT * FROM blocklist WHERE donor_id = ? ORDER BY blocked_at DESC LIMIT 1').get(parent.id);
      return bl ? bl.reason : null;
    },
    donation_history: async (parent, _, { db }) => {
      return db.prepare(`
        SELECT bb.*, ds.result as screening_result
        FROM blood_bags bb
        LEFT JOIN donor_screenings ds ON bb.screening_id = ds.id
        WHERE bb.donor_id = ?
        ORDER BY bb.collection_date DESC
      `).all(parent.id);
    },
    screenings: async (parent, _, { db }) => {
      return db.prepare('SELECT * FROM donor_screenings WHERE donor_id = ? ORDER BY screening_date DESC').all(parent.id);
    },
    health_answers: (parent) => parent.health_answers ? JSON.parse(parent.health_answers) : null
  },
  BloodBag: {
    donor: async (parent, _, { db }) => {
      return db.prepare('SELECT * FROM donors WHERE id = ?').get(parent.donor_id);
    },
    screening: async (parent, _, { db }) => {
      return parent.screening_id ? db.prepare('SELECT * FROM donor_screenings WHERE id = ?').get(parent.screening_id) : null;
    },
    collected_by_user: async (parent, _, { db }) => {
      return db.prepare('SELECT * FROM users WHERE id = ?').get(parent.collected_by);
    },
    test_records: async (parent, _, { db }) => {
      return db.prepare('SELECT * FROM test_records WHERE bag_id = ? ORDER BY test_date DESC').all(parent.id);
    },
    component_products: async (parent, _, { db }) => {
      return db.prepare('SELECT * FROM component_products WHERE parent_bag_id = ? ORDER BY preparation_date DESC').all(parent.id);
    }
  },
  ComponentProduct: {
    parent_bag: async (parent, _, { db }) => {
      return db.prepare('SELECT * FROM blood_bags WHERE id = ?').get(parent.parent_bag_id);
    },
    blood_type_full: (parent) => `${parent.blood_type_abo}${parent.blood_type_rh}`,
    prepared_by_user: async (parent, _, { db }) => {
      return db.prepare('SELECT * FROM users WHERE id = ?').get(parent.prepared_by);
    },
    inventory: async (parent, _, { db }) => {
      return db.prepare('SELECT * FROM inventory_batches WHERE product_id = ?').get(parent.id);
    }
  },
  InventoryBatch: {
    product: async (parent, _, { db }) => {
      return db.prepare('SELECT * FROM component_products WHERE id = ?').get(parent.product_id);
    },
    days_remaining: (parent) => {
      return expiryService.daysUntilExpiry(parent.expiry_date);
    },
    expiry_warning_level: (parent) => {
      const days = expiryService.daysUntilExpiry(parent.expiry_date);
      return expiryService.getWarningLevel(days);
    },
    matching_result: async (parent, _, { db }) => {
      return db.prepare('SELECT * FROM matching_results WHERE inventory_id = ?').get(parent.id);
    }
  },
  BloodRequest: {
    hospital: async (parent, _, { db }) => {
      return db.prepare('SELECT * FROM hospitals WHERE id = ?').get(parent.hospital_id);
    },
    requested_by_user: async (parent, _, { db }) => {
      return parent.requested_by ? db.prepare('SELECT * FROM users WHERE id = ?').get(parent.requested_by) : null;
    },
    matching_results: async (parent, _, { db }) => {
      return db.prepare(`
        SELECT mr.*,
          cp.product_code, cp.component_type, cp.blood_type_abo, cp.blood_type_rh, cp.expiry_date
        FROM matching_results mr
        JOIN inventory_batches ib ON mr.inventory_id = ib.id
        JOIN component_products cp ON ib.product_id = cp.id
        WHERE mr.request_id = ?
      `).all(parent.id);
    },
    delivery_tasks: async (parent, _, { db }) => {
      return db.prepare('SELECT * FROM delivery_tasks WHERE request_id = ? ORDER BY created_at DESC').all(parent.id);
    }
  },
  MatchingResult: {
    request: async (parent, _, { db }) => {
      return db.prepare('SELECT * FROM blood_requests WHERE id = ?').get(parent.request_id);
    },
    inventory: async (parent, _, { db }) => {
      return db.prepare('SELECT * FROM inventory_batches WHERE id = ?').get(parent.inventory_id);
    },
    matched_by_user: async (parent, _, { db }) => {
      return parent.matched_by ? db.prepare('SELECT * FROM users WHERE id = ?').get(parent.matched_by) : null;
    }
  },
  DeliveryTask: {
    request: async (parent, _, { db }) => {
      return db.prepare('SELECT * FROM blood_requests WHERE id = ?').get(parent.request_id);
    },
    dispatcher: async (parent, _, { db }) => {
      return db.prepare('SELECT * FROM users WHERE id = ?').get(parent.dispatcher_id);
    },
    confirmation: async (parent, _, { db }) => {
      return db.prepare('SELECT * FROM delivery_confirmations WHERE delivery_task_id = ?').get(parent.id);
    }
  },
  DeliveryConfirmation: {
    delivery_task: async (parent, _, { db }) => {
      return db.prepare('SELECT * FROM delivery_tasks WHERE id = ?').get(parent.delivery_task_id);
    }
  },
  Hospital: {
  },
  BlocklistEntry: {
    donor: async (parent, _, { db }) => {
      return db.prepare('SELECT * FROM donors WHERE id = ?').get(parent.donor_id);
    },
    blocked_by_user: async (parent, _, { db }) => {
      return db.prepare('SELECT * FROM users WHERE id = ?').get(parent.blocked_by);
    }
  },
  DonorScreening: {
    donor: async (parent, _, { db }) => {
      return db.prepare('SELECT * FROM donors WHERE id = ?').get(parent.donor_id);
    },
    performed_by_user: async (parent, _, { db }) => {
      return db.prepare('SELECT * FROM users WHERE id = ?').get(parent.performed_by);
    }
  },
  TestRecord: {
    blood_bag: async (parent, _, { db }) => {
      return db.prepare('SELECT * FROM blood_bags WHERE id = ?').get(parent.bag_id);
    },
    tested_by_user: async (parent, _, { db }) => {
      return db.prepare('SELECT * FROM users WHERE id = ?').get(parent.tested_by);
    }
  },
  User: {
    hospital: async (parent, _, { db }) => {
      return parent.hospital_id ? db.prepare('SELECT * FROM hospitals WHERE id = ?').get(parent.hospital_id) : null;
    }
  },
  Query: {
    donors: async (_, { name, id_card_no, donor_card_no, blood_type_abo, blood_type_rh, page = 1, page_size = 20 }, { db }) => {
      let sql = 'SELECT * FROM donors WHERE 1=1';
      const params = [];
      if (name) { sql += ' AND name LIKE ?'; params.push(`%${name}%`); }
      if (id_card_no) { sql += ' AND id_card_no LIKE ?'; params.push(`%${id_card_no}%`); }
      if (donor_card_no) { sql += ' AND donor_card_no LIKE ?'; params.push(`%${donor_card_no}%`); }
      if (blood_type_abo) { sql += ' AND blood_type_abo = ?'; params.push(blood_type_abo); }
      if (blood_type_rh) { sql += ' AND blood_type_rh = ?'; params.push(blood_type_rh); }
      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(page_size, (page - 1) * page_size);
      return db.prepare(sql).all(...params);
    },
    donor: async (_, { id }, { db }) => {
      return db.prepare('SELECT * FROM donors WHERE id = ?').get(id);
    },
    blood_bags: async (_, { status, donor_id, page = 1, page_size = 20 }, { db }) => {
      let sql = 'SELECT * FROM blood_bags WHERE 1=1';
      const params = [];
      if (status) { sql += ' AND status = ?'; params.push(status); }
      if (donor_id) { sql += ' AND donor_id = ?'; params.push(donor_id); }
      sql += ' ORDER BY collection_date DESC LIMIT ? OFFSET ?';
      params.push(page_size, (page - 1) * page_size);
      return db.prepare(sql).all(...params);
    },
    blood_bag: async (_, { id }, { db }) => {
      return db.prepare('SELECT * FROM blood_bags WHERE id = ?').get(id);
    },
    test_records: async (_, { bag_id, test_batch_no, page = 1, page_size = 20 }, { db }) => {
      let sql = 'SELECT * FROM test_records WHERE 1=1';
      const params = [];
      if (bag_id) { sql += ' AND bag_id = ?'; params.push(bag_id); }
      if (test_batch_no) { sql += ' AND test_batch_no = ?'; params.push(test_batch_no); }
      sql += ' ORDER BY test_date DESC LIMIT ? OFFSET ?';
      params.push(page_size, (page - 1) * page_size);
      return db.prepare(sql).all(...params);
    },
    component_products: async (_, { parent_bag_id, component_type, blood_type_abo, blood_type_rh, page = 1, page_size = 20 }, { db }) => {
      let sql = 'SELECT * FROM component_products WHERE 1=1';
      const params = [];
      if (parent_bag_id) { sql += ' AND parent_bag_id = ?'; params.push(parent_bag_id); }
      if (component_type) { sql += ' AND component_type = ?'; params.push(component_type); }
      if (blood_type_abo) { sql += ' AND blood_type_abo = ?'; params.push(blood_type_abo); }
      if (blood_type_rh) { sql += ' AND blood_type_rh = ?'; params.push(blood_type_rh); }
      sql += ' ORDER BY preparation_date DESC LIMIT ? OFFSET ?';
      params.push(page_size, (page - 1) * page_size);
      return db.prepare(sql).all(...params);
    },
    inventory: async (_, { blood_type_abo, blood_type_rh, component_type, status, expiry_from, expiry_to, page = 1, page_size = 50 }, { db }) => {
      let sql = `
        SELECT ib.*
        FROM inventory_batches ib
        JOIN component_products cp ON ib.product_id = cp.id
        WHERE 1=1
      `;
      const params = [];
      if (blood_type_abo) { sql += ' AND cp.blood_type_abo = ?'; params.push(blood_type_abo); }
      if (blood_type_rh) { sql += ' AND cp.blood_type_rh = ?'; params.push(blood_type_rh); }
      if (component_type) { sql += ' AND cp.component_type = ?'; params.push(component_type); }
      if (status) { sql += ' AND ib.status = ?'; params.push(status); }
      if (expiry_from) { sql += ' AND ib.expiry_date >= ?'; params.push(expiry_from); }
      if (expiry_to) { sql += ' AND ib.expiry_date <= ?'; params.push(expiry_to); }
      sql += ' ORDER BY ib.expiry_date ASC LIMIT ? OFFSET ?';
      params.push(page_size, (page - 1) * page_size);
      return db.prepare(sql).all(...params);
    },
    inventory_summary: async (_, { blood_type_abo, blood_type_rh, component_type, status }, { db }) => {
      let sql = `
        SELECT
          cp.blood_type_abo,
          cp.blood_type_rh,
          cp.blood_type_abo || cp.blood_type_rh as blood_type_full,
          cp.component_type,
          COUNT(*) as total_quantity,
          SUM(CASE WHEN ib.status = '在库' THEN 1 ELSE 0 END) as available_quantity,
          sst.min_quantity,
          sst.warning_quantity,
          MIN(julianday(ib.expiry_date) - julianday('now')) as min_days_remaining
        FROM inventory_batches ib
        JOIN component_products cp ON ib.product_id = cp.id
        LEFT JOIN safety_stock_thresholds sst
          ON cp.blood_type_abo = sst.blood_type_abo
          AND cp.blood_type_rh = sst.blood_type_rh
          AND cp.component_type = sst.component_type
        WHERE 1=1
      `;
      const params = [];
      if (blood_type_abo) { sql += ' AND cp.blood_type_abo = ?'; params.push(blood_type_abo); }
      if (blood_type_rh) { sql += ' AND cp.blood_type_rh = ?'; params.push(blood_type_rh); }
      if (component_type) { sql += ' AND cp.component_type = ?'; params.push(component_type); }
      if (status) { sql += ' AND ib.status = ?'; params.push(status); }
      sql += ' GROUP BY cp.blood_type_abo, cp.blood_type_rh, cp.component_type ORDER BY cp.blood_type_abo, cp.blood_type_rh, cp.component_type';
      const results = db.prepare(sql).all(...params);
      return results.map(s => ({
        ...s,
        stock_status: s.available_quantity <= (s.min_quantity || 0) ? '低于安全库存' :
                      s.available_quantity <= (s.warning_quantity || 0) ? '预警' : '正常',
        stock_shortfall: Math.max(0, (s.warning_quantity || 0) - (s.available_quantity || 0))
      }));
    },
    inventory_details: async (parent, args, context) => {
      return resolvers.Query.inventory(parent, args, context);
    },
    blood_requests: async (_, { hospital_id, status, urgency, page = 1, page_size = 20 }, { db }) => {
      let sql = 'SELECT * FROM blood_requests WHERE 1=1';
      const params = [];
      if (hospital_id) { sql += ' AND hospital_id = ?'; params.push(hospital_id); }
      if (status) { sql += ' AND status = ?'; params.push(status); }
      if (urgency) { sql += ' AND urgency = ?'; params.push(urgency); }
      sql += ' ORDER BY priority_score DESC, created_at ASC LIMIT ? OFFSET ?';
      params.push(page_size, (page - 1) * page_size);
      return db.prepare(sql).all(...params);
    },
    blood_request: async (_, { id }, { db }) => {
      return db.prepare('SELECT * FROM blood_requests WHERE id = ?').get(id);
    },
    delivery_tasks: async (_, { status, request_id, page = 1, page_size = 20 }, { db }) => {
      let sql = 'SELECT * FROM delivery_tasks WHERE 1=1';
      const params = [];
      if (status) { sql += ' AND status = ?'; params.push(status); }
      if (request_id) { sql += ' AND request_id = ?'; params.push(request_id); }
      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(page_size, (page - 1) * page_size);
      return db.prepare(sql).all(...params);
    },
    delivery_task: async (_, { id }, { db }) => {
      return db.prepare('SELECT * FROM delivery_tasks WHERE id = ?').get(id);
    },
    hospitals: async (_, __, { db }) => {
      return db.prepare('SELECT * FROM hospitals ORDER BY name').all();
    },
    hospital: async (_, { id }, { db }) => {
      return db.prepare('SELECT * FROM hospitals WHERE id = ?').get(id);
    },
    blocklist: async (_, __, { db }) => {
      return db.prepare('SELECT * FROM blocklist ORDER BY blocked_at DESC').all();
    },
    safety_thresholds: async (_, __, { db }) => {
      return db.prepare('SELECT * FROM safety_stock_thresholds ORDER BY blood_type_abo, blood_type_rh, component_type').all();
    },
    expiry_warnings: async (_, __, { db }) => {
      return expiryService.getExpiryStats();
    },
    pending_requests_by_priority: async (_, __, { db }) => {
      return matchingService.getPendingRequestsByPriority();
    }
  },
  Mutation: {
    registerDonor: async (_, args, { db, user }) => {
      const { id_card_no, name, gender, birth_date, phone, address, health_answers } = args;
      const donorCardNo = `D${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
      const info = db.prepare(`
        INSERT INTO donors (donor_card_no, id_card_no, name, gender, birth_date, phone, address, health_answers)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(donorCardNo, id_card_no, name, gender, birth_date, phone, address, JSON.stringify(health_answers || {}));
      return db.prepare('SELECT * FROM donors WHERE id = ?').get(info.lastInsertRowid);
    },
    createScreening: async (_, args, { db, user }) => {
      const { donor_id, hemoglobin, alt, hbsag, anti_hcv, anti_hiv, syphilis, blood_type_abo, blood_type_rh, screening_date } = args;
      let result = '合格';
      if (hemoglobin && hemoglobin < 120) result = '不合格';
      if (alt && alt > 40) result = '不合格';
      if (hbsag === '阳性' || anti_hcv === '阳性' || anti_hiv === '阳性' || syphilis === '阳性') result = '不合格';
      const info = db.prepare(`
        INSERT INTO donor_screenings (donor_id, screening_date, hemoglobin, alt, hbsag, anti_hcv, anti_hiv, syphilis, blood_type_abo, blood_type_rh, result, performed_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        donor_id, screening_date || new Date().toISOString().slice(0, 10),
        hemoglobin, alt, hbsag, anti_hcv, anti_hiv, syphilis,
        blood_type_abo, blood_type_rh, result, user.id
      );
      if (result === '合格' && blood_type_abo && blood_type_rh) {
        db.prepare('UPDATE donors SET blood_type_abo = ?, blood_type_rh = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(blood_type_abo, blood_type_rh, donor_id);
      }
      return db.prepare('SELECT * FROM donor_screenings WHERE id = ?').get(info.lastInsertRowid);
    },
    createBloodBag: async (_, args, { db, user }) => {
      const { donor_id, screening_id, collection_date, collection_site, volume } = args;
      const bagNo = `B${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      const info = db.prepare(`
        INSERT INTO blood_bags (bag_no, donor_id, screening_id, collection_date, collection_site, volume, collected_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(bagNo, donor_id, screening_id, collection_date || new Date().toISOString().slice(0, 10), collection_site || '中心采血点', volume || 200, user.id);
      db.prepare('UPDATE donors SET donation_count = donation_count + 1, last_donation_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(collection_date || new Date().toISOString().slice(0, 10), donor_id);
      return db.prepare('SELECT * FROM blood_bags WHERE id = ?').get(info.lastInsertRowid);
    },
    addToBlocklist: async (_, args, { db, user }) => {
      const { donor_id, reason, permanent = 1, expires_at } = args;
      const info = db.prepare(`
        INSERT INTO blocklist (donor_id, reason, permanent, blocked_by, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(donor_id, reason, permanent, user.id, expires_at);
      return db.prepare('SELECT * FROM blocklist WHERE id = ?').get(info.lastInsertRowid);
    },
    createTestRecord: async (_, args, { db, user }) => {
      const { bag_id, test_batch_no, test_date, hbsag, anti_hcv, anti_hiv, syphilis } = args;
      let result = '合格';
      if (hbsag === '阳性' || anti_hcv === '阳性' || anti_hiv === '阳性' || syphilis === '阳性') result = '不合格';
      const info = db.prepare(`
        INSERT INTO test_records (bag_id, test_batch_no, test_date, hbsag, anti_hcv, anti_hiv, syphilis, result, tested_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(bag_id, test_batch_no, test_date || new Date().toISOString().slice(0, 10), hbsag, anti_hcv, anti_hiv, syphilis, result, user.id);
      const newStatus = result === '合格' ? '检测合格' : '检测不合格';
      db.prepare('UPDATE blood_bags SET status = ? WHERE id = ?').run(newStatus, bag_id);
      return db.prepare('SELECT * FROM test_records WHERE id = ?').get(info.lastInsertRowid);
    },
    createComponentProducts: async (_, args, { db, user }) => {
      const { parent_bag_id, components, preparation_date, preparation_batch_no } = args;
      const parentBag = db.prepare(`
        SELECT bb.*, d.blood_type_abo, d.blood_type_rh
        FROM blood_bags bb JOIN donors d ON bb.donor_id = d.id WHERE bb.id = ?
      `).get(parent_bag_id);
      const prepDate = preparation_date || new Date().toISOString().slice(0, 10);
      const batchNo = preparation_batch_no || `PREP${Date.now()}`;
      const shelfLife = { '红细胞悬液': 35, '新鲜冰冻血浆': 365, '冷沉淀': 365, '血小板': 5, '全血': 35 };
      const products = [];
      for (const comp of components) {
        const expiryDate = new Date(prepDate);
        expiryDate.setDate(expiryDate.getDate() + (shelfLife[comp.component_type] || 35));
        const productCode = `P${comp.component_type.slice(0, 2).toUpperCase()}${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
        const pInfo = db.prepare(`
          INSERT INTO component_products (
            product_code, parent_bag_id, component_type, blood_type_abo, blood_type_rh,
            volume, preparation_date, expiry_date, preparation_batch_no, prepared_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          productCode, parent_bag_id, comp.component_type,
          parentBag.blood_type_abo, parentBag.blood_type_rh,
          comp.volume || 200, prepDate, expiryDate.toISOString().slice(0, 10), batchNo, user.id
        );
        const product = db.prepare('SELECT * FROM component_products WHERE id = ?').get(pInfo.lastInsertRowid);
        db.prepare(`INSERT INTO inventory_batches (product_id, status, expiry_date) VALUES (?, '在库', ?)`)
          .run(product.id, product.expiry_date);
        products.push(product);
      }
      db.prepare('UPDATE blood_bags SET status = ? WHERE id = ?').run('已制备', parent_bag_id);
      return products;
    },
    manualScrapInventory: async (_, { id, reason }, { db }) => {
      db.prepare(`UPDATE inventory_batches SET status = '报废', lock_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(reason, id);
      return db.prepare('SELECT * FROM inventory_batches WHERE id = ?').get(id);
    },
    updateSafetyThreshold: async (_, { id, min_quantity, warning_quantity }, { db }) => {
      db.prepare(`UPDATE safety_stock_thresholds SET min_quantity = ?, warning_quantity = ? WHERE id = ?`)
        .run(min_quantity, warning_quantity, id);
      return db.prepare('SELECT * FROM safety_stock_thresholds WHERE id = ?').get(id);
    },
    runExpiryScan: async () => {
      return expiryService.scanExpiry();
    },
    stockOut: async (_, { inventory_ids }, { db }) => {
      for (const id of inventory_ids) {
        db.prepare(`UPDATE inventory_batches SET status = '已出库', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
      }
      return { success: true, count: inventory_ids.length };
    },
    createBloodRequest: async (_, args, { db, user }) => {
      const {
        hospital_id, patient_name, patient_gender, patient_age,
        patient_blood_type_abo, patient_blood_type_rh, component_type, quantity, urgency, clinical_diagnosis, cross_match_required
      } = args;
      const requestNo = `REQ${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
      const priority = urgency === '急诊' ? 100 : urgency === '紧急' ? 50 : 0;
      const info = db.prepare(`
        INSERT INTO blood_requests (
          request_no, hospital_id, patient_name, patient_gender, patient_age,
          patient_blood_type_abo, patient_blood_type_rh, component_type, quantity,
          urgency, clinical_diagnosis, cross_match_required, priority_score, requested_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        requestNo, hospital_id, patient_name, patient_gender, patient_age,
        patient_blood_type_abo, patient_blood_type_rh,
        component_type, quantity, urgency, clinical_diagnosis,
        cross_match_required !== undefined ? cross_match_required : 1,
        priority, user ? user.id : null
      );
      return db.prepare('SELECT * FROM blood_requests WHERE id = ?').get(info.lastInsertRowid);
    },
    performCrossMatch: async (_, { request_id }, { db, user }) => {
      const result = matchingService.findMatchingInventory(request_id);
      if (result.matched_units.length > 0) {
        matchingService.saveMatchingResults(request_id, result.matched_units, user ? user.id : null);
      }
      return {
        request_id,
        request: db.prepare('SELECT * FROM blood_requests WHERE id = ?').get(request_id),
        matched_count: result.matched_count,
        requested_count: result.requested_count,
        is_fully_matched: result.is_fully_matched,
        duration_ms: result.duration_ms,
        matched_units: result.matched_units.map(u => db.prepare('SELECT * FROM inventory_batches WHERE id = ?').get(u.inventory_id))
      };
    },
    createDeliveryTask: async (_, args, { db, user }) => {
      const { request_id, cooler_box_no, temperature_logger_no, departure_temperature } = args;
      const taskNo = `DEL${Date.now()}`;
      const now = new Date().toISOString();
      const estimated = new Date();
      estimated.setHours(estimated.getHours() + 2);
      const info = db.prepare(`
        INSERT INTO delivery_tasks (
          task_no, request_id, cooler_box_no, temperature_logger_no,
          departure_temperature, departure_time, estimated_arrival, dispatcher_id, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '运输中')
      `).run(taskNo, request_id, cooler_box_no, temperature_logger_no, departure_temperature, now, estimated.toISOString(), user.id);
      db.prepare(`UPDATE blood_requests SET status = '配送中' WHERE id = ?`).run(request_id);
      return db.prepare('SELECT * FROM delivery_tasks WHERE id = ?').get(info.lastInsertRowid);
    },
    confirmDelivery: async (_, args, { db }) => {
      const { delivery_task_id, arrival_temperature, received_by, remarks } = args;
      const task = db.prepare('SELECT * FROM delivery_tasks WHERE id = ?').get(delivery_task_id);
      const now = new Date().toISOString();
      const info = db.prepare(`
        INSERT INTO delivery_confirmations (
          delivery_task_id, arrival_temperature, arrival_time, received_by, remarks
        ) VALUES (?, ?, ?, ?, ?)
      `).run(delivery_task_id, arrival_temperature, now, received_by, remarks);
      db.prepare(`UPDATE delivery_tasks SET status = '已签收' WHERE id = ?`).run(delivery_task_id);
      db.prepare(`UPDATE blood_requests SET status = '已完成' WHERE id = ?`).run(task.request_id);
      return db.prepare('SELECT * FROM delivery_confirmations WHERE id = ?').get(info.lastInsertRowid);
    }
  }
};

function getContext({ req }) {
  const db = getDb();
  const userId = req.headers['x-user-id'] || req.headers.authorization?.replace('Bearer ', '');
  let user = null;
  if (userId) {
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  }
  return { db, user };
}

module.exports = {
  typeDefs,
  resolvers,
  getContext
};
