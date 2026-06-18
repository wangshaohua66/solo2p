const express = require('express');
const router = express.Router();

const donorController = require('../controllers/donorController');
const bloodController = require('../controllers/bloodController');
const inventoryController = require('../controllers/inventoryController');
const allocationController = require('../controllers/allocationController');
const { authenticate, authorize, ROLES } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: 献血者管理
 *   description: 献血者登记、初筛、采血袋管理、屏蔽名单
 */

/**
 * @swagger
 * /api/donors:
 *   post:
 *     tags: [献血者管理]
 *     summary: 登记献血者
 *     description: 采血护士登记献血者个人信息与健康征询表
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id_card_no, name, gender, birth_date]
 *             properties:
 *               id_card_no:
 *                 type: string
 *                 example: "110101199001011234"
 *               name:
 *                 type: string
 *                 example: "张三"
 *               gender:
 *                 type: string
 *                 enum: [男, 女]
 *                 example: "男"
 *               birth_date:
 *                 type: string
 *                 format: date
 *                 example: "1990-01-01"
 *               phone:
 *                 type: string
 *                 example: "13800138000"
 *               address:
 *                 type: string
 *                 example: "北京市朝阳区"
 *               health_answers:
 *                 type: object
 *                 example: {"近期无感冒": true, "未服用药物": true}
 *     responses:
 *       201:
 *         description: 登记成功
 *         content:
 *           application/json:
 *             example:
 *               id: 1
 *               donor_card_no: "D202401010001"
 *               id_card_no: "110101199001011234"
 *               name: "张三"
 *               gender: "男"
 *               birth_date: "1990-01-01"
 *               donation_count: 0
 */
router.post('/donors', authenticate, authorize(ROLES.NURSE), donorController.registerDonor);

/**
 * @swagger
 * /api/donors/search:
 *   get:
 *     tags: [献血者管理]
 *     summary: 搜索献血者
 *     parameters:
 *       - in: query
 *         name: name
 *         schema: {type: string}
 *       - in: query
 *         name: id_card_no
 *         schema: {type: string}
 *       - in: query
 *         name: blood_type_abo
 *         schema: {type: string, enum: [A,B,AB,O]}
 *       - in: query
 *         name: page
 *         schema: {type: integer, default: 1}
 *       - in: query
 *         name: page_size
 *         schema: {type: integer, default: 20}
 *     responses:
 *       200:
 *         description: 搜索结果
 */
router.get('/donors/search', authenticate, donorController.searchDonors);

/**
 * @swagger
 * /api/donors/{id}:
 *   get:
 *     tags: [献血者管理]
 *     summary: 获取献血者详情（含献血历史、屏蔽状态）
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: {type: string}
 *         description: 献血者ID、献血证号或身份证号
 *     responses:
 *       200:
 *         description: 献血者详情
 */
router.get('/donors/:id', authenticate, donorController.getDonorById);

/**
 * @swagger
 * /api/screenings:
 *   post:
 *     tags: [献血者管理]
 *     summary: 录入初筛结果
 *     description: 录入血型、血红蛋白、ALT、传染病标志物快速检测结果
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [donor_id]
 *             properties:
 *               donor_id:
 *                 type: integer
 *                 example: 1
 *               hemoglobin:
 *                 type: number
 *                 example: 145
 *               alt:
 *                 type: integer
 *                 example: 25
 *               hbsag:
 *                 type: string
 *                 enum: [阴性, 阳性]
 *                 example: "阴性"
 *               anti_hcv:
 *                 type: string
 *                 enum: [阴性, 阳性]
 *                 example: "阴性"
 *               anti_hiv:
 *                 type: string
 *                 enum: [阴性, 阳性]
 *                 example: "阴性"
 *               syphilis:
 *                 type: string
 *                 enum: [阴性, 阳性]
 *                 example: "阴性"
 *               blood_type_abo:
 *                 type: string
 *                 enum: [A,B,AB,O]
 *                 example: "A"
 *               blood_type_rh:
 *                 type: string
 *                 enum: ["+", "-"]
 *                 example: "+"
 *     responses:
 *       201:
 *         description: 初筛记录创建成功
 */
router.post('/screenings', authenticate, authorize(ROLES.NURSE), donorController.createScreening);

/**
 * @swagger
 * /api/blood-bags:
 *   post:
 *     tags: [献血者管理]
 *     summary: 登记采血袋
 *     description: 关联初筛合格献血者与采血袋编号
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [donor_id, screening_id]
 *             properties:
 *               donor_id:
 *                 type: integer
 *                 example: 1
 *               screening_id:
 *                 type: integer
 *                 example: 1
 *               collection_date:
 *                 type: string
 *                 format: date
 *               collection_site:
 *                 type: string
 *                 example: "中心采血点"
 *               volume:
 *                 type: number
 *                 example: 200
 *     responses:
 *       201:
 *         description: 采血袋登记成功
 */
router.post('/blood-bags', authenticate, authorize(ROLES.NURSE), donorController.createBloodBag);

/**
 * @swagger
 * /api/blood-bags:
 *   get:
 *     tags: [血液检测与制备]
 *     summary: 查询采血袋列表
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: {type: string}
 *       - in: query
 *         name: donor_id
 *         schema: {type: integer}
 *     responses:
 *       200:
 *         description: 采血袋列表
 */
router.get('/blood-bags', authenticate, bloodController.getBloodBags);

/**
 * @swagger
 * /api/blocklist:
 *   post:
 *     tags: [献血者管理]
 *     summary: 添加屏蔽名单
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [donor_id, reason]
 *             properties:
 *               donor_id:
 *                 type: integer
 *               reason:
 *                 type: string
 *               permanent:
 *                 type: integer
 *                 default: 1
 *               expires_at:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: 添加成功
 */
router.post('/blocklist', authenticate, authorize(ROLES.NURSE), donorController.addToBlocklist);

/**
 * @swagger
 * /api/blocklist:
 *   get:
 *     tags: [献血者管理]
 *     summary: 查询屏蔽名单
 *     responses:
 *       200:
 *         description: 屏蔽名单列表
 */
router.get('/blocklist', authenticate, donorController.getBlocklist);

/**
 * @swagger
 * tags:
 *   name: 血液检测与制备
 *   description: ELISA检测、成分制备
 */

/**
 * @swagger
 * /api/test-records:
 *   post:
 *     tags: [血液检测与制备]
 *     summary: 录入ELISA检测结果
 *     description: 检验技师录入HBsAg、Anti-HCV、Anti-HIV、梅毒检测结果
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bag_id, test_batch_no, hbsag, anti_hcv, anti_hiv, syphilis]
 *             properties:
 *               bag_id:
 *                 type: integer
 *                 example: 1
 *               test_batch_no:
 *                 type: string
 *                 example: "TEST20240101001"
 *               test_date:
 *                 type: string
 *                 format: date
 *               hbsag:
 *                 type: string
 *                 enum: [阴性, 阳性]
 *                 example: "阴性"
 *               anti_hcv:
 *                 type: string
 *                 enum: [阴性, 阳性]
 *                 example: "阴性"
 *               anti_hiv:
 *                 type: string
 *                 enum: [阴性, 阳性]
 *                 example: "阴性"
 *               syphilis:
 *                 type: string
 *                 enum: [阴性, 阳性]
 *                 example: "阴性"
 *     responses:
 *       201:
 *         description: 检测记录创建成功
 */
router.post('/test-records', authenticate, authorize(ROLES.TECHNICIAN), bloodController.createTestRecord);

/**
 * @swagger
 * /api/test-records:
 *   get:
 *     tags: [血液检测与制备]
 *     summary: 查询检测记录
 *     parameters:
 *       - in: query
 *         name: bag_id
 *         schema: {type: integer}
 *       - in: query
 *         name: test_batch_no
 *         schema: {type: string}
 *     responses:
 *       200:
 *         description: 检测记录列表
 */
router.get('/test-records', authenticate, bloodController.getTestRecords);

/**
 * @swagger
 * /api/component-products:
 *   post:
 *     tags: [血液检测与制备]
 *     summary: 成分制备
 *     description: 成分制备员将合格全血拆分为红细胞悬液、血浆、冷沉淀等子产品
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [parent_bag_id, components]
 *             properties:
 *               parent_bag_id:
 *                 type: integer
 *                 example: 1
 *               preparation_date:
 *                 type: string
 *                 format: date
 *               preparation_batch_no:
 *                 type: string
 *               components:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     component_type:
 *                       type: string
 *                       enum: [红细胞悬液, 新鲜冰冻血浆, 冷沉淀, 血小板]
 *                     volume:
 *                       type: number
 *                       example: 200
 *     responses:
 *       201:
 *         description: 成分制备完成
 */
router.post('/component-products', authenticate, authorize(ROLES.PREPARATOR), bloodController.createComponentProducts);

/**
 * @swagger
 * /api/component-products:
 *   get:
 *     tags: [血液检测与制备]
 *     summary: 查询成分产品
 *     parameters:
 *       - in: query
 *         name: parent_bag_id
 *         schema: {type: integer}
 *       - in: query
 *         name: component_type
 *         schema: {type: string}
 *       - in: query
 *         name: blood_type_abo
 *         schema: {type: string}
 *     responses:
 *       200:
 *         description: 成分产品列表
 */
router.get('/component-products', authenticate, bloodController.getComponentProducts);

/**
 * @swagger
 * tags:
 *   name: 库存管理
 *   description: 库存查询、效期预警、报废、安全阈值
 */

/**
 * @swagger
 * /api/inventory/summary:
 *   get:
 *     tags: [库存管理]
 *     summary: 库存水位汇总
 *     description: 按血型品种统计可用库存量、安全库存状态
 *     parameters:
 *       - in: query
 *         name: blood_type_abo
 *         schema: {type: string, enum: [A,B,AB,O]}
 *       - in: query
 *         name: blood_type_rh
 *         schema: {type: string, enum: ["+", "-"]}
 *       - in: query
 *         name: component_type
 *         schema: {type: string}
 *     responses:
 *       200:
 *         description: 库存汇总
 *         content:
 *           application/json:
 *             example:
 *               - blood_type_abo: "A"
 *                 blood_type_full: "A+"
 *                 component_type: "红细胞悬液"
 *                 available_quantity: 45
 *                 min_quantity: 10
 *                 warning_quantity: 30
 *                 stock_status: "正常"
 *                 stock_shortfall: 0
 */
router.get('/inventory/summary', authenticate, inventoryController.getInventorySummary);

/**
 * @swagger
 * /api/inventory/details:
 *   get:
 *     tags: [库存管理]
 *     summary: 库存明细查询
 *     description: 多维度组合查询库存，含效期预警级别
 *     parameters:
 *       - in: query
 *         name: blood_type_abo
 *         schema: {type: string}
 *       - in: query
 *         name: blood_type_rh
 *         schema: {type: string}
 *       - in: query
 *         name: component_type
 *         schema: {type: string}
 *       - in: query
 *         name: status
 *         schema: {type: string, enum: [在库, 已锁定, 已出库, 报废]}
 *       - in: query
 *         name: expiry_from
 *         schema: {type: string, format: date}
 *       - in: query
 *         name: expiry_to
 *         schema: {type: string, format: date}
 *       - in: query
 *         name: page
 *         schema: {type: integer, default: 1}
 *       - in: query
 *         name: page_size
 *         schema: {type: integer, default: 50}
 *     responses:
 *       200:
 *         description: 库存明细
 */
router.get('/inventory/details', authenticate, inventoryController.getInventoryDetails);

/**
 * @swagger
 * /api/inventory/scrap:
 *   post:
 *     tags: [库存管理]
 *     summary: 手动报废库存
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id, reason]
 *             properties:
 *               id:
 *                 type: integer
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: 报废成功
 */
router.post('/inventory/scrap', authenticate, authorize(ROLES.INVENTORY), inventoryController.manualScrapInventory);

/**
 * @swagger
 * /api/inventory/stock-out:
 *   post:
 *     tags: [库存管理]
 *     summary: 血液出库
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [inventory_ids]
 *             properties:
 *               inventory_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: 出库成功
 */
router.post('/inventory/stock-out', authenticate, authorize(ROLES.INVENTORY), inventoryController.stockOut);

/**
 * @swagger
 * /api/inventory/expiry-scan:
 *   post:
 *     tags: [库存管理]
 *     summary: 执行效期扫描
 *     description: 扫描全库效期，自动标记过期血液报废，更新预警级别
 *     responses:
 *       200:
 *         description: 扫描完成
 *         content:
 *           application/json:
 *             example:
 *               scanned: 1250
 *               expired: 5
 *               updated: 1245
 *               duration_ms: 450
 */
router.post('/inventory/expiry-scan', authenticate, authorize(ROLES.INVENTORY), inventoryController.runExpiryScan);

/**
 * @swagger
 * /api/inventory/expiry-warnings:
 *   get:
 *     tags: [库存管理]
 *     summary: 效期预警统计
 *     description: 按血型品种统计黄色/橙色/红色/过期预警数量
 *     responses:
 *       200:
 *         description: 预警统计
 */
router.get('/inventory/expiry-warnings', authenticate, inventoryController.getExpiryWarnings);

/**
 * @swagger
 * /api/safety-thresholds:
 *   get:
 *     tags: [库存管理]
 *     summary: 查询安全库存阈值
 *     responses:
 *       200:
 *         description: 阈值列表
 */
router.get('/safety-thresholds', authenticate, inventoryController.getSafetyThresholds);

/**
 * @swagger
 * /api/safety-thresholds:
 *   put:
 *     tags: [库存管理]
 *     summary: 更新安全库存阈值
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id, min_quantity, warning_quantity]
 *             properties:
 *               id:
 *                 type: integer
 *               min_quantity:
 *                 type: integer
 *               warning_quantity:
 *                 type: integer
 *     responses:
 *       200:
 *         description: 更新成功
 */
router.put('/safety-thresholds', authenticate, authorize(ROLES.INVENTORY), inventoryController.updateSafetyThreshold);

/**
 * @swagger
 * tags:
 *   name: 用血申请与配血
 *   description: 医院用血申请、交叉配血、配送调度
 */

/**
 * @swagger
 * /api/blood-requests:
 *   post:
 *     tags: [用血申请与配血]
 *     summary: 提交用血申请
 *     description: 医院输血科提交用血申请单
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [hospital_id, patient_blood_type_abo, patient_blood_type_rh, component_type, quantity, urgency]
 *             properties:
 *               hospital_id:
 *                 type: integer
 *                 example: 1
 *               patient_name:
 *                 type: string
 *                 example: "李四"
 *               patient_gender:
 *                 type: string
 *                 enum: [男, 女]
 *               patient_age:
 *                 type: integer
 *                 example: 45
 *               patient_blood_type_abo:
 *                 type: string
 *                 enum: [A,B,AB,O]
 *                 example: "A"
 *               patient_blood_type_rh:
 *                 type: string
 *                 enum: ["+", "-"]
 *                 example: "+"
 *               component_type:
 *                 type: string
 *                 example: "红细胞悬液"
 *               quantity:
 *                 type: integer
 *                 example: 2
 *               urgency:
 *                 type: string
 *                 enum: [常规, 紧急, 急诊]
 *                 example: "常规"
 *               clinical_diagnosis:
 *                 type: string
 *                 example: "消化道出血"
 *               cross_match_required:
 *                 type: integer
 *                 default: 1
 *     responses:
 *       201:
 *         description: 申请提交成功
 */
router.post('/blood-requests', authenticate, authorize(ROLES.HOSPITAL), allocationController.createBloodRequest);

/**
 * @swagger
 * /api/blood-requests:
 *   get:
 *     tags: [用血申请与配血]
 *     summary: 查询用血申请列表
 *     parameters:
 *       - in: query
 *         name: hospital_id
 *         schema: {type: integer}
 *       - in: query
 *         name: status
 *         schema: {type: string}
 *       - in: query
 *         name: urgency
 *         schema: {type: string}
 *     responses:
 *       200:
 *         description: 申请列表
 */
router.get('/blood-requests', authenticate, allocationController.getBloodRequests);

/**
 * @swagger
 * /api/blood-requests/{id}:
 *   get:
 *     tags: [用血申请与配血]
 *     summary: 获取申请详情（含配血结果、配送状态）
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: {type: integer}
 *     responses:
 *       200:
 *         description: 申请详情
 */
router.get('/blood-requests/:id', authenticate, allocationController.getBloodRequestById);

/**
 * @swagger
 * /api/blood-requests/{request_id}/cross-match:
 *   post:
 *     tags: [用血申请与配血]
 *     summary: 执行交叉配血
 *     description: 执行主侧+次侧配血，按效期先出匹配库存，紧急申请优先
 *     parameters:
 *       - in: path
 *         name: request_id
 *         required: true
 *         schema: {type: integer}
 *     responses:
 *       200:
 *         description: 配血结果
 *         content:
 *           application/json:
 *             example:
 *               matched_count: 2
 *               requested_count: 2
 *               is_fully_matched: true
 *               duration_ms: 45
 */
router.post('/blood-requests/:request_id/cross-match', authenticate, authorize(ROLES.INVENTORY, ROLES.TECHNICIAN), allocationController.performCrossMatch);

/**
 * @swagger
 * /api/blood-requests/{id}/status:
 *   put:
 *     tags: [用血申请与配血]
 *     summary: 更新申请状态
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: {type: integer}
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: 更新成功
 */
router.put('/blood-requests/:id/status', authenticate, allocationController.updateRequestStatus);

/**
 * @swagger
 * /api/delivery-tasks:
 *   post:
 *     tags: [用血申请与配血]
 *     summary: 创建配送任务
 *     description: 配送调度员分配冷藏运输箱和温度记录仪
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [request_id, cooler_box_no]
 *             properties:
 *               request_id:
 *                 type: integer
 *                 example: 1
 *               cooler_box_no:
 *                 type: string
 *                 example: "COOLER001"
 *               temperature_logger_no:
 *                 type: string
 *                 example: "TEMP001"
 *               departure_temperature:
 *                 type: number
 *                 example: 4.5
 *     responses:
 *       201:
 *         description: 配送任务创建成功
 */
router.post('/delivery-tasks', authenticate, authorize(ROLES.DISPATCHER), allocationController.createDeliveryTask);

/**
 * @swagger
 * /api/delivery-tasks:
 *   get:
 *     tags: [用血申请与配血]
 *     summary: 查询配送任务
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: {type: string}
 *       - in: query
 *         name: request_id
 *         schema: {type: integer}
 *     responses:
 *       200:
 *         description: 配送任务列表
 */
router.get('/delivery-tasks', authenticate, allocationController.getDeliveryTasks);

/**
 * @swagger
 * /api/delivery-confirmations:
 *   post:
 *     tags: [用血申请与配血]
 *     summary: 确认送达
 *     description: 医院输血科确认接收，记录送达温度
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [delivery_task_id, arrival_temperature, received_by]
 *             properties:
 *               delivery_task_id:
 *                 type: integer
 *                 example: 1
 *               arrival_temperature:
 *                 type: number
 *                 example: 5.2
 *               received_by:
 *                 type: string
 *                 example: "王医生"
 *               remarks:
 *                 type: string
 *     responses:
 *       201:
 *         description: 确认成功
 */
router.post('/delivery-confirmations', authenticate, authorize(ROLES.HOSPITAL), allocationController.confirmDelivery);

/**
 * @swagger
 * /api/hospitals:
 *   get:
 *     tags: [用血申请与配血]
 *     summary: 查询医院列表
 *     responses:
 *       200:
 *         description: 医院列表
 */
router.get('/hospitals', authenticate, allocationController.getHospitals);

/**
 * @swagger
 * tags:
 *   name: 统计报表
 *   description: 采供血统计、监管上报
 */

/**
 * @swagger
 * /api/statistics:
 *   get:
 *     tags: [统计报表]
 *     summary: 采供血统计报表
 *     description: 按月度/季度生成采集量、检测不合格率、成分制备率、临床供应满足率
 *     parameters:
 *       - in: query
 *         name: period
 *         schema: {type: string, enum: [month, quarter], default: month}
 *       - in: query
 *         name: year
 *         required: true
 *         schema: {type: integer}
 *       - in: query
 *         name: month
 *         schema: {type: integer}
 *       - in: query
 *         name: quarter
 *         schema: {type: integer}
 *     responses:
 *       200:
 *         description: 统计报表
 *         content:
 *           application/json:
 *             example:
 *               collection:
 *                 units: 10000
 *                 volume_ml: 2000000
 *               testing:
 *                 total: 10000
 *                 passed: 9850
 *                 failed: 150
 *                 failure_rate_percent: 1.5
 *               component_preparation:
 *                 units: 8500
 *                 preparation_rate_percent: 85.0
 *               clinical_supply:
 *                 requested_units: 8000
 *                 supplied_units: 7600
 *                 fulfillment_rate_percent: 95.0
 */
router.get('/statistics', authenticate, inventoryController.getStatistics);

/**
 * @swagger
 * /api/statistics/export:
 *   get:
 *     tags: [统计报表]
 *     summary: 导出卫健委监管上报数据
 *     parameters:
 *       - in: query
 *         name: year
 *         required: true
 *         schema: {type: integer}
 *       - in: query
 *         name: month
 *         required: true
 *         schema: {type: integer}
 *     responses:
 *       200:
 *         description: 监管上报JSON文件
 */
router.get('/statistics/export', authenticate, inventoryController.exportRegulatoryData);

module.exports = router;
