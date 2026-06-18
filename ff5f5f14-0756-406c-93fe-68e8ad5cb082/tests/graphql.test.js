const { typeDefs, resolvers } = require('../src/graphql/schema');
const { graphql } = require('graphql');
const { initDatabase, getDb } = require('../src/models/db');
const fs = require('fs');
const path = require('path');

describe('GraphQL Schema测试', () => {
  let db;

  beforeAll(() => {
    const dbPath = path.join(__dirname, '../data/blood_center_graphql_test.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    initDatabase();
    db = getDb();
  });

  const executeQuery = async (query, variables = {}) => {
    return graphql({
      schema: require('graphql').buildSchema(typeDefs),
      source: query,
      variableValues: variables,
      contextValue: { db, user: { id: 1, role: 'nurse' } },
      fieldResolver: async (parent, args, context, info) => {
        const resolverFn = resolvers.Query?.[info.fieldName] || 
                          resolvers.Mutation?.[info.fieldName] ||
                          resolvers[parent?.__typename]?.[info.fieldName];
        if (typeof resolverFn === 'function') {
          return resolverFn(parent, args, context, info);
        }
        if (parent && info.fieldName in parent) {
          return parent[info.fieldName];
        }
        return null;
      }
    });
  };

  test('Schema包含所有核心实体类型', () => {
    const typeDefStr = typeDefs.toString();
    expect(typeDefStr).toContain('type Donor');
    expect(typeDefStr).toContain('type BloodBag');
    expect(typeDefStr).toContain('type TestRecord');
    expect(typeDefStr).toContain('type ComponentProduct');
    expect(typeDefStr).toContain('type InventoryBatch');
    expect(typeDefStr).toContain('type BloodRequest');
    expect(typeDefStr).toContain('type MatchingResult');
    expect(typeDefStr).toContain('type DeliveryTask');
    expect(typeDefStr).toContain('type DeliveryConfirmation');
    expect(typeDefStr).toContain('type BlocklistEntry');
    expect(typeDefStr).toContain('type Hospital');
    expect(typeDefStr).toContain('type User');
    expect(typeDefStr).toContain('type SafetyThreshold');
    expect(typeDefStr).toContain('type InventorySummary');
    expect(typeDefStr).toContain('type CrossMatchResult');
  });

  test('Query查询包含库存汇总', async () => {
    const query = `
      query {
        inventory_summary {
          blood_type_full
          component_type
          available_quantity
          stock_status
        }
      }
    `;

    expect(typeDefs.toString()).toContain('inventory_summary');
  });

  test('Query包含献血者查询', () => {
    expect(typeDefs.toString()).toContain('donors(');
    expect(typeDefs.toString()).toContain('donor(id: Int!): Donor');
  });

  test('Query包含库存多维度查询', () => {
    expect(typeDefs.toString()).toContain('inventory(');
    expect(typeDefs.toString()).toContain('blood_type_abo');
    expect(typeDefs.toString()).toContain('blood_type_rh');
    expect(typeDefs.toString()).toContain('component_type');
    expect(typeDefs.toString()).toContain('expiry_from');
    expect(typeDefs.toString()).toContain('expiry_to');
  });

  test('Mutation包含所有核心操作', () => {
    const typeDefStr = typeDefs.toString();
    expect(typeDefStr).toContain('registerDonor');
    expect(typeDefStr).toContain('createScreening');
    expect(typeDefStr).toContain('createBloodBag');
    expect(typeDefStr).toContain('createTestRecord');
    expect(typeDefStr).toContain('createComponentProducts');
    expect(typeDefStr).toContain('createBloodRequest');
    expect(typeDefStr).toContain('performCrossMatch');
    expect(typeDefStr).toContain('createDeliveryTask');
    expect(typeDefStr).toContain('confirmDelivery');
    expect(typeDefStr).toContain('runExpiryScan');
  });

  test('Donor类型包含关联字段', () => {
    const typeDefStr = typeDefs.toString();
    expect(typeDefStr).toContain('donation_history: [BloodBag]');
    expect(typeDefStr).toContain('screenings: [DonorScreening]');
    expect(typeDefStr).toContain('is_blocked: Boolean');
  });

  test('BloodRequest类型包含嵌套关联', () => {
    const typeDefStr = typeDefs.toString();
    expect(typeDefStr).toContain('matching_results: [MatchingResult]');
    expect(typeDefStr).toContain('delivery_tasks: [DeliveryTask]');
    expect(typeDefStr).toContain('hospital: Hospital');
  });

  test('InventoryBatch包含关联字段', () => {
    const typeDefStr = typeDefs.toString();
    expect(typeDefStr).toContain('product: ComponentProduct');
    expect(typeDefStr).toContain('expiry_warning_level: String');
    expect(typeDefStr).toContain('days_remaining: Int');
    expect(typeDefStr).toContain('matching_result: MatchingResult');
  });

  test('ComponentProduct包含追溯链', () => {
    const typeDefStr = typeDefs.toString();
    expect(typeDefStr).toContain('parent_bag: BloodBag');
    expect(typeDefStr).toContain('inventory: InventoryBatch');
  });

  test('DeliveryTask包含冷链追溯', () => {
    const typeDefStr = typeDefs.toString();
    expect(typeDefStr).toContain('cooler_box_no: String');
    expect(typeDefStr).toContain('temperature_logger_no: String');
    expect(typeDefStr).toContain('departure_temperature: Float');
    expect(typeDefStr).toContain('confirmation: DeliveryConfirmation');
  });

  test('DeliveryConfirmation包含确认信息', () => {
    const typeDefStr = typeDefs.toString();
    expect(typeDefStr).toContain('arrival_temperature: Float');
    expect(typeDefStr).toContain('arrival_time: String');
    expect(typeDefStr).toContain('received_by: String');
  });

  test('CrossMatchResult返回配血信息', () => {
    const typeDefStr = typeDefs.toString();
    expect(typeDefStr).toContain('matched_count: Int');
    expect(typeDefStr).toContain('requested_count: Int');
    expect(typeDefStr).toContain('is_fully_matched: Boolean');
    expect(typeDefStr).toContain('duration_ms: Int');
    expect(typeDefStr).toContain('matched_units: [InventoryBatch]');
  });

  test('ExpiryScanResult返回扫描结果', () => {
    const typeDefStr = typeDefs.toString();
    expect(typeDefStr).toContain('scanned: Int');
    expect(typeDefStr).toContain('expired: Int');
    expect(typeDefStr).toContain('updated: Int');
    expect(typeDefStr).toContain('duration_ms: Int');
  });

  test('所有Query字段都存在', () => {
    const typeDefStr = typeDefs.toString();
    const expectedQueries = [
      'donors', 'donor', 'blood_bags', 'blood_bag', 'test_records', 
      'component_products', 'inventory', 'inventory_summary', 'inventory_details',
      'blood_requests', 'blood_request', 'delivery_tasks', 'delivery_task',
      'hospitals', 'hospital', 'blocklist', 'safety_thresholds', 
      'expiry_warnings', 'pending_requests_by_priority'
    ];
    expectedQueries.forEach(q => {
      expect(typeDefStr).toContain(q + '(' || q + ':');
    });
  });

  test('InventorySummary包含所有汇总字段', () => {
    const typeDefStr = typeDefs.toString();
    expect(typeDefStr).toContain('total_quantity: Int');
    expect(typeDefStr).toContain('available_quantity: Int');
    expect(typeDefStr).toContain('min_quantity: Int');
    expect(typeDefStr).toContain('warning_quantity: Int');
    expect(typeDefStr).toContain('min_days_remaining: Float');
    expect(typeDefStr).toContain('stock_status: String');
    expect(typeDefStr).toContain('stock_shortfall: Int');
  });
});
