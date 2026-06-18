const request = require('supertest');
const express = require('express');
const { initDatabase, getDb } = require('../src/models/db');
const restRoutes = require('../src/routes/restRoutes');
const fs = require('fs');
const path = require('path');

describe('API集成测试', () => {
  let app;
  let db;

  beforeAll(() => {
    const dbPath = path.join(__dirname, '../data/blood_center_test.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    process.env.DB_PATH = dbPath;
    initDatabase();
    db = getDb();

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = { id: 1, role: 'nurse' };
      next();
    });
    app.use('/api', restRoutes);
  });

  describe('献血者管理API', () => {
    test('POST /api/donors - 登记献血者成功', async () => {
      const response = await request(app)
        .post('/api/donors')
        .set('X-User-ID', '1')
        .send({
          id_card_no: '110101199001011234',
          name: '测试献血者',
          gender: '男',
          birth_date: '1990-01-01',
          phone: '13800138000'
        });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('测试献血者');
      expect(response.body.donor_card_no).toBeDefined();
    });

    test('GET /api/donors/search - 搜索献血者', async () => {
      const response = await request(app)
        .get('/api/donors/search?name=测试')
        .set('X-User-ID', '1');

      expect(response.status).toBe(200);
      expect(response.body.items).toBeDefined();
      expect(response.body.items.length).toBeGreaterThan(0);
    });

    test('POST /api/screenings - 创建初筛记录', async () => {
      const donor = db.prepare('SELECT * FROM donors ORDER BY id DESC LIMIT 1').get();
      const response = await request(app)
        .post('/api/screenings')
        .set('X-User-ID', '1')
        .send({
          donor_id: donor.id,
          hemoglobin: 145,
          alt: 25,
          hbsag: '阴性',
          anti_hcv: '阴性',
          anti_hiv: '阴性',
          syphilis: '阴性',
          blood_type_abo: 'A',
          blood_type_rh: '+'
        });

      expect(response.status).toBe(201);
      expect(response.body.result).toBe('合格');
    });

    test('POST /api/blood-bags - 登记采血袋', async () => {
      const donor = db.prepare('SELECT * FROM donors ORDER BY id DESC LIMIT 1').get();
      const screening = db.prepare('SELECT * FROM donor_screenings ORDER BY id DESC LIMIT 1').get();

      const response = await request(app)
        .post('/api/blood-bags')
        .set('X-User-ID', '1')
        .send({
          donor_id: donor.id,
          screening_id: screening.id,
          collection_date: '2024-01-01',
          volume: 200
        });

      expect(response.status).toBe(201);
      expect(response.body.bag_no).toBeDefined();
      expect(response.body.status).toBe('待检测');
    });
  });

  describe('血液检测与制备API', () => {
    test('POST /api/test-records - 录入检测结果', async () => {
      const bag = db.prepare('SELECT * FROM blood_bags ORDER BY id DESC LIMIT 1').get();

      const nurseApp = express();
      nurseApp.use(express.json());
      nurseApp.use((req, res, next) => {
        req.user = { id: 2, role: 'technician' };
        next();
      });
      nurseApp.use('/api', restRoutes);

      const response = await request(nurseApp)
        .post('/api/test-records')
        .set('X-User-ID', '2')
        .send({
          bag_id: bag.id,
          test_batch_no: 'TEST20240101001',
          hbsag: '阴性',
          anti_hcv: '阴性',
          anti_hiv: '阴性',
          syphilis: '阴性'
        });

      expect(response.status).toBe(201);
      expect(response.body.test.result).toBe('合格');
      expect(response.body.bag.status).toBe('检测合格');
    });

    test('POST /api/component-products - 成分制备', async () => {
      const bag = db.prepare('SELECT * FROM blood_bags WHERE status = ? ORDER BY id DESC LIMIT 1').get('检测合格');

      const prepApp = express();
      prepApp.use(express.json());
      prepApp.use((req, res, next) => {
        req.user = { id: 3, role: 'preparator' };
        next();
      });
      prepApp.use('/api', restRoutes);

      const response = await request(prepApp)
        .post('/api/component-products')
        .set('X-User-ID', '3')
        .send({
          parent_bag_id: bag.id,
          components: [
            { component_type: '红细胞悬液', volume: 150 },
            { component_type: '新鲜冰冻血浆', volume: 100 }
          ]
        });

      expect(response.status).toBe(201);
      expect(response.body.products.length).toBe(2);
    });
  });

  describe('库存管理API', () => {
    test('GET /api/inventory/summary - 库存汇总查询', async () => {
      const startTime = Date.now();
      const response = await request(app)
        .get('/api/inventory/summary')
        .set('X-User-ID', '4');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100);
    });

    test('GET /api/inventory/details - 库存详情查询', async () => {
      const startTime = Date.now();
      const response = await request(app)
        .get('/api/inventory/details?status=在库&page=1&page_size=50')
        .set('X-User-ID', '4');

      expect(response.status).toBe(200);
      expect(response.body.items).toBeDefined();
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100);
    });

    test('GET /api/safety-thresholds - 安全库存阈值', async () => {
      const response = await request(app)
        .get('/api/safety-thresholds')
        .set('X-User-ID', '4');

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(32);
    });

    test('POST /api/inventory/expiry-scan - 效期扫描', async () => {
      const startTime = Date.now();
      const response = await request(app)
        .post('/api/inventory/expiry-scan')
        .set('X-User-ID', '4');

      expect(response.status).toBe(200);
      expect(response.body.scanned).toBeGreaterThanOrEqual(0);
      const duration = response.body.duration_ms || Date.now() - startTime;
      expect(duration).toBeLessThan(3000);
    });
  });

  describe('用血申请与配血API', () => {
    test('POST /api/blood-requests - 提交用血申请', async () => {
      const hospApp = express();
      hospApp.use(express.json());
      hospApp.use((req, res, next) => {
        req.user = { id: 6, role: 'hospital', hospital_id: 1 };
        next();
      });
      hospApp.use('/api', restRoutes);

      const response = await request(hospApp)
        .post('/api/blood-requests')
        .set('X-User-ID', '6')
        .send({
          hospital_id: 1,
          patient_name: '测试患者',
          patient_blood_type_abo: 'A',
          patient_blood_type_rh: '+',
          component_type: '红细胞悬液',
          quantity: 2,
          urgency: '常规',
          clinical_diagnosis: '测试诊断'
        });

      expect(response.status).toBe(201);
      expect(response.body.request_no).toBeDefined();
      expect(response.body.status).toBe('待配血');
    });

    test('GET /api/blood-requests - 查询申请列表', async () => {
      const response = await request(app)
        .get('/api/blood-requests')
        .set('X-User-ID', '6');

      expect(response.status).toBe(200);
      expect(response.body.items).toBeDefined();
    });

    test('GET /api/hospitals - 医院列表', async () => {
      const response = await request(app)
        .get('/api/hospitals')
        .set('X-User-ID', '6');

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(18);
    });
  });

  describe('统计报表API', () => {
    test('GET /api/statistics - 统计报表', async () => {
      const response = await request(app)
        .get('/api/statistics?year=2024&month=1')
        .set('X-User-ID', '4');

      expect(response.status).toBe(200);
      expect(response.body.collection).toBeDefined();
      expect(response.body.testing).toBeDefined();
      expect(response.body.component_preparation).toBeDefined();
      expect(response.body.clinical_supply).toBeDefined();
    });
  });

  describe('角色鉴权测试', () => {
    test('无权限角色访问应返回403', async () => {
      const hospApp = express();
      hospApp.use(express.json());
      hospApp.use((req, res, next) => {
        req.user = { id: 6, role: 'hospital' };
        next();
      });
      hospApp.use('/api', restRoutes);

      const response = await request(hospApp)
        .post('/api/test-records')
        .set('X-User-ID', '6')
        .send({
          bag_id: 1,
          test_batch_no: 'TEST',
          hbsag: '阴性',
          anti_hcv: '阴性',
          anti_hiv: '阴性',
          syphilis: '阴性'
        });

      expect(response.status).toBe(403);
    });

    test('未认证访问应返回401', async () => {
      const noAuthApp = express();
      noAuthApp.use(express.json());
      noAuthApp.use('/api', restRoutes);

      const response = await request(noAuthApp)
        .get('/api/donors/search');

      expect(response.status).toBe(401);
    });
  });
});
