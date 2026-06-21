-- ============================================================
-- 二手车交易服务中心 - 数据库初始化脚本
-- Database: used_vehicle_transaction (MySQL 8.0+)
-- 生成时间: 2024-06
-- ============================================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS `used_vehicle_transaction`
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE `used_vehicle_transaction`;

-- ============================================================
-- 表结构
-- ============================================================

-- 1. 车辆信息表
CREATE TABLE IF NOT EXISTS `vehicles` (
    `Id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `Vin` VARCHAR(17) NOT NULL COMMENT 'VIN码17位',
    `PlateNumber` VARCHAR(20) NOT NULL COMMENT '车牌号',
    `Brand` VARCHAR(50) NOT NULL COMMENT '品牌',
    `Model` VARCHAR(50) NOT NULL COMMENT '型号',
    `Series` VARCHAR(50) NULL COMMENT '车系',
    `Color` VARCHAR(10) NULL COMMENT '颜色',
    `ManufactureYear` INT NULL COMMENT '出厂年',
    `ManufactureMonth` INT NULL COMMENT '出厂月',
    `FirstRegistrationDate` DATETIME NULL COMMENT '首次注册日期',
    `Mileage` INT NULL COMMENT '里程(公里)',
    `EngineNumber` VARCHAR(20) NULL COMMENT '发动机号',
    `FrameNumber` VARCHAR(20) NULL COMMENT '车架号',
    `Displacement` DECIMAL(10,2) NULL COMMENT '排量(L)',
    `Power` INT NULL COMMENT '功率(kW)',
    `FuelType` VARCHAR(20) NULL COMMENT '燃料类型',
    `Transmission` VARCHAR(20) NULL COMMENT '变速箱类型',
    `EnvironmentalStandard` VARCHAR(50) NULL COMMENT '排放标准',
    `EstimatedPrice` DECIMAL(12,2) NULL COMMENT '估价(元)',
    `Status` INT NOT NULL DEFAULT 0 COMMENT '0待合规 1合规未过 2合规通过 3鉴定中 4鉴定完 5可交易 6交易中 7已完成 8异常中 99驳回',
    `Remark` VARCHAR(500) NULL COMMENT '备注',
    `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `CreatedBy` BIGINT NOT NULL,
    `UpdatedAt` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    `UpdatedBy` BIGINT NULL,
    `IsDeleted` TINYINT(1) NOT NULL DEFAULT 0,
    `DeletedAt` DATETIME NULL,
    `DeletedBy` BIGINT NULL,
    `RowVersion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `IX_vehicles_Vin` (`Vin`),
    KEY `IX_vehicles_PlateNumber` (`PlateNumber`),
    KEY `IX_vehicles_Brand_Model` (`Brand`, `Model`),
    KEY `IX_vehicles_Status` (`Status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='车辆信息表';

-- 2. 合规校验记录表
CREATE TABLE IF NOT EXISTS `compliance_check_records` (
    `Id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `VehicleId` BIGINT NOT NULL,
    `CheckBatchNo` VARCHAR(50) NOT NULL COMMENT '批次号',
    `OverallStatus` INT NOT NULL DEFAULT 0 COMMENT '0待检 1进行中 2通过 3未通过 4超时 5异常',
    `CheckTime` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '校验时间',
    `TotalItems` INT NOT NULL DEFAULT 12 COMMENT '总项目数',
    `PassedItems` INT NOT NULL DEFAULT 0 COMMENT '通过项',
    `FailedItems` INT NOT NULL DEFAULT 0 COMMENT '不通过项',
    `ExceptionItems` INT NOT NULL DEFAULT 0 COMMENT '异常项',
    `FailureReasons` VARCHAR(2000) NULL COMMENT '不通过原因汇总',
    `IsManualReviewed` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否人工复核',
    `ReviewResult` INT NULL COMMENT '1通过 2驳回 3待补充',
    `ReviewedBy` BIGINT NULL,
    `ReviewedAt` DATETIME NULL,
    `ReviewRemark` VARCHAR(500) NULL,
    `HasExceptionApproval` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '例外审批',
    `ApprovedBy` BIGINT NULL,
    `ApprovedAt` DATETIME NULL,
    `ApprovalRemark` VARCHAR(500) NULL,
    `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `CreatedBy` BIGINT NOT NULL,
    `UpdatedAt` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    `UpdatedBy` BIGINT NULL,
    `IsDeleted` TINYINT(1) NOT NULL DEFAULT 0,
    `DeletedAt` DATETIME NULL,
    `DeletedBy` BIGINT NULL,
    UNIQUE KEY `IX_compliance_check_records_CheckBatchNo` (`CheckBatchNo`),
    KEY `IX_compliance_check_records_VehicleId` (`VehicleId`),
    KEY `IX_compliance_check_records_CheckTime` (`CheckTime`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='合规校验记录表';

-- 3. 合规校验明细表
CREATE TABLE IF NOT EXISTS `compliance_check_items` (
    `Id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `CheckRecordId` BIGINT NOT NULL,
    `ItemType` INT NOT NULL COMMENT '1环保 2事故 3抵押 4查封 5年检 6保险 7改装 8盗抢 9税费 10报废 11发动机号 12车架号',
    `ItemName` VARCHAR(100) NOT NULL,
    `ItemNameEn` VARCHAR(100) NOT NULL,
    `Status` INT NOT NULL DEFAULT 0,
    `Passed` TINYINT(1) NOT NULL DEFAULT 0,
    `Detail` VARCHAR(500) NULL,
    `RawData` VARCHAR(1000) NULL,
    `DurationMs` INT NOT NULL DEFAULT 0,
    `FailureReason` VARCHAR(200) NULL,
    `FailureReasonEn` VARCHAR(200) NULL,
    `SourceSystem` VARCHAR(100) NULL COMMENT '来源系统',
    `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `CreatedBy` BIGINT NOT NULL,
    `UpdatedAt` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    `UpdatedBy` BIGINT NULL,
    `IsDeleted` TINYINT(1) NOT NULL DEFAULT 0,
    `DeletedAt` DATETIME NULL,
    `DeletedBy` BIGINT NULL,
    KEY `IX_compliance_check_items_CheckRecordId` (`CheckRecordId`),
    KEY `IX_compliance_check_items_ItemType` (`ItemType`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='合规校验明细表';

-- 4. 检测指标库 (148项)
CREATE TABLE IF NOT EXISTS `inspection_item_library` (
    `Id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `ItemCode` VARCHAR(20) NOT NULL COMMENT '项目编码 ENG-001等',
    `Category` INT NOT NULL COMMENT '1发动机 2底盘 3车身 4电气 5路试',
    `ItemName` VARCHAR(100) NOT NULL,
    `ItemNameEn` VARCHAR(100) NOT NULL,
    `Description` VARCHAR(500) NULL,
    `SortOrder` INT NOT NULL DEFAULT 0,
    `MaxScore` INT NOT NULL DEFAULT 10,
    `Weight` DECIMAL(5,4) NOT NULL COMMENT '权重',
    `ScoreCriteria` VARCHAR(500) NULL COMMENT '评分标准',
    `Required` TINYINT(1) NOT NULL DEFAULT 1,
    `AllowPhoto` TINYINT(1) NOT NULL DEFAULT 1,
    `MinPhotos` INT NULL,
    `MaxPhotos` INT NULL,
    `IsActive` TINYINT(1) NOT NULL DEFAULT 1,
    `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `CreatedBy` BIGINT NOT NULL,
    `UpdatedAt` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    `UpdatedBy` BIGINT NULL,
    `IsDeleted` TINYINT(1) NOT NULL DEFAULT 0,
    `DeletedAt` DATETIME NULL,
    `DeletedBy` BIGINT NULL,
    UNIQUE KEY `IX_inspection_item_library_ItemCode` (`ItemCode`),
    KEY `IX_inspection_item_library_Category` (`Category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='检测指标库';

-- 5. 鉴定工单表
CREATE TABLE IF NOT EXISTS `inspection_orders` (
    `Id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `VehicleId` BIGINT NOT NULL,
    `OrderNo` VARCHAR(50) NOT NULL COMMENT '工单号',
    `InspectorId` BIGINT NOT NULL,
    `InspectorName` VARCHAR(50) NULL,
    `Status` INT NOT NULL DEFAULT 0 COMMENT '0创建 1已派单 2进行中 3已完成 4已审核 5已驳回 6已取消',
    `StartTime` DATETIME NULL,
    `EndTime` DATETIME NULL,
    `DurationMinutes` INT NULL,
    `EngineScore` DECIMAL(6,2) NOT NULL DEFAULT 0,
    `ChassisScore` DECIMAL(6,2) NOT NULL DEFAULT 0,
    `BodyScore` DECIMAL(6,2) NOT NULL DEFAULT 0,
    `ElectricalScore` DECIMAL(6,2) NOT NULL DEFAULT 0,
    `RoadTestScore` DECIMAL(6,2) NOT NULL DEFAULT 0,
    `TotalScore` DECIMAL(6,2) NOT NULL DEFAULT 0,
    `Grade` INT NULL COMMENT '4优秀 3良好 2一般 1较差',
    `GeneralComment` VARCHAR(2000) NULL,
    `MajorIssues` VARCHAR(500) NULL,
    `SafetyConcerns` VARCHAR(500) NULL,
    `ReviewedBy` BIGINT NULL,
    `ReviewedAt` DATETIME NULL,
    `ReviewComment` VARCHAR(500) NULL,
    `ReportFilePath` VARCHAR(255) NULL,
    `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `CreatedBy` BIGINT NOT NULL,
    `UpdatedAt` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    `UpdatedBy` BIGINT NULL,
    `IsDeleted` TINYINT(1) NOT NULL DEFAULT 0,
    `DeletedAt` DATETIME NULL,
    `DeletedBy` BIGINT NULL,
    UNIQUE KEY `IX_inspection_orders_OrderNo` (`OrderNo`),
    KEY `IX_inspection_orders_VehicleId` (`VehicleId`),
    KEY `IX_inspection_orders_InspectorId` (`InspectorId`),
    KEY `IX_inspection_orders_Status` (`Status`),
    KEY `IX_inspection_orders_CreatedAt` (`CreatedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='鉴定工单表';

-- 6. 鉴定项目得分表
CREATE TABLE IF NOT EXISTS `inspection_item_results` (
    `Id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `InspectionOrderId` BIGINT NOT NULL,
    `InspectionItemId` BIGINT NOT NULL,
    `Category` INT NOT NULL,
    `Score` INT NOT NULL DEFAULT 0,
    `Description` VARCHAR(1000) NULL,
    `Finding` VARCHAR(2000) NULL COMMENT '检测发现',
    `HasDefect` TINYINT(1) NOT NULL DEFAULT 0,
    `DefectLevel` VARCHAR(100) NULL COMMENT '缺陷等级',
    `PhotoCount` INT NOT NULL DEFAULT 0,
    `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `CreatedBy` BIGINT NOT NULL,
    `UpdatedAt` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    `UpdatedBy` BIGINT NULL,
    `IsDeleted` TINYINT(1) NOT NULL DEFAULT 0,
    `DeletedAt` DATETIME NULL,
    `DeletedBy` BIGINT NULL,
    KEY `IX_inspection_item_results_InspectionOrderId` (`InspectionOrderId`),
    KEY `IX_inspection_item_results_InspectionItemId` (`InspectionItemId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='鉴定项目得分表';

-- 7. 鉴定照片表
CREATE TABLE IF NOT EXISTS `inspection_photos` (
    `Id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `InspectionOrderId` BIGINT NOT NULL,
    `ItemResultId` BIGINT NULL,
    `Category` INT NULL,
    `FilePath` VARCHAR(255) NOT NULL,
    `OriginalFileName` VARCHAR(255) NULL,
    `FileSize` BIGINT NOT NULL,
    `ContentType` VARCHAR(100) NULL,
    `Description` VARCHAR(500) NULL,
    `SortOrder` INT NOT NULL DEFAULT 0,
    `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `CreatedBy` BIGINT NOT NULL,
    `UpdatedAt` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    `UpdatedBy` BIGINT NULL,
    `IsDeleted` TINYINT(1) NOT NULL DEFAULT 0,
    `DeletedAt` DATETIME NULL,
    `DeletedBy` BIGINT NULL,
    KEY `IX_inspection_photos_InspectionOrderId` (`InspectionOrderId`),
    KEY `IX_inspection_photos_ItemResultId` (`ItemResultId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='鉴定照片表';

-- 8. 交易登记表
CREATE TABLE IF NOT EXISTS `vehicle_transactions` (
    `Id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `TransactionNo` VARCHAR(50) NOT NULL,
    `VehicleId` BIGINT NOT NULL,
    `SellerName` VARCHAR(50) NOT NULL,
    `SellerIdNumber` VARCHAR(18) NOT NULL,
    `SellerPhone` VARCHAR(20) NULL,
    `SellerAddress` VARCHAR(200) NULL,
    `BuyerName` VARCHAR(50) NOT NULL,
    `BuyerIdNumber` VARCHAR(18) NOT NULL,
    `BuyerPhone` VARCHAR(20) NULL,
    `BuyerAddress` VARCHAR(200) NULL,
    `TransactionPrice` DECIMAL(12,2) NOT NULL,
    `TransactionDate` DATETIME NOT NULL,
    `TransactionLocation` VARCHAR(100) NULL,
    `InspectionOrderId` BIGINT NULL,
    `Status` INT NOT NULL DEFAULT 0 COMMENT '0创建 1待流程 2进行中 3已完成 4中止 5取消 6异常',
    `TaxAmount` DECIMAL(12,2) NULL,
    `ServiceFee` DECIMAL(12,2) NULL,
    `OldPlateNumber` VARCHAR(50) NULL,
    `NewPlateNumber` VARCHAR(50) NULL,
    `RegisteredBy` BIGINT NULL,
    `RegistrarName` VARCHAR(50) NULL,
    `RegistrationDate` DATETIME NULL,
    `Remark` VARCHAR(500) NULL,
    `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `CreatedBy` BIGINT NOT NULL,
    `UpdatedAt` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    `UpdatedBy` BIGINT NULL,
    `IsDeleted` TINYINT(1) NOT NULL DEFAULT 0,
    `DeletedAt` DATETIME NULL,
    `DeletedBy` BIGINT NULL,
    UNIQUE KEY `IX_vehicle_transactions_TransactionNo` (`TransactionNo`),
    KEY `IX_vehicle_transactions_VehicleId` (`VehicleId`),
    KEY `IX_vehicle_transactions_BuyerName` (`BuyerName`),
    KEY `IX_vehicle_transactions_SellerName` (`SellerName`),
    KEY `IX_vehicle_transactions_Status` (`Status`),
    KEY `IX_vehicle_transactions_TransactionDate` (`TransactionDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='交易登记表';

-- 9. 流程实例表
CREATE TABLE IF NOT EXISTS `workflow_instances` (
    `Id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `TransactionId` BIGINT NOT NULL,
    `InstanceNo` VARCHAR(50) NOT NULL,
    `TotalNodes` INT NOT NULL DEFAULT 8,
    `CompletedNodes` INT NOT NULL DEFAULT 0,
    `CurrentNodeIndex` INT NOT NULL DEFAULT 0,
    `Status` INT NOT NULL DEFAULT 0 COMMENT '0待启动 1进行中 2完成 3跳过 4超时 5失败',
    `StartTime` DATETIME NULL,
    `EndTime` DATETIME NULL,
    `TotalDurationMinutes` INT NULL,
    `HasTimedOutNodes` TINYINT(1) NOT NULL DEFAULT 0,
    `Remark` VARCHAR(500) NULL,
    `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `CreatedBy` BIGINT NOT NULL,
    `UpdatedAt` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    `UpdatedBy` BIGINT NULL,
    `IsDeleted` TINYINT(1) NOT NULL DEFAULT 0,
    `DeletedAt` DATETIME NULL,
    `DeletedBy` BIGINT NULL,
    UNIQUE KEY `IX_workflow_instances_InstanceNo` (`InstanceNo`),
    KEY `IX_workflow_instances_TransactionId` (`TransactionId`),
    KEY `IX_workflow_instances_Status` (`Status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='流程实例表';

-- 10. 流程节点执行表
CREATE TABLE IF NOT EXISTS `workflow_node_executions` (
    `Id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `InstanceId` BIGINT NOT NULL,
    `NodeType` INT NOT NULL COMMENT '1环保 2安检 3税费 4受理 5行驶证 6号牌 7归档 8通知',
    `NodeName` VARCHAR(100) NOT NULL,
    `NodeNameEn` VARCHAR(100) NOT NULL,
    `SortOrder` INT NOT NULL,
    `IsParallel` TINYINT(1) NOT NULL DEFAULT 0,
    `Prerequisites` VARCHAR(500) NULL,
    `Status` INT NOT NULL DEFAULT 0 COMMENT '0待办 1进行中 2完成 3跳过 4超时 5失败',
    `ScheduledStartTime` DATETIME NULL,
    `ScheduledEndTime` DATETIME NOT NULL,
    `TimeLimitMinutes` INT NOT NULL,
    `StartTime` DATETIME NULL,
    `EndTime` DATETIME NULL,
    `DurationMinutes` INT NULL,
    `AssignedTo` BIGINT NULL,
    `AssigneeName` VARCHAR(50) NULL,
    `CompletedBy` BIGINT NULL,
    `CompleterName` VARCHAR(50) NULL,
    `ResultData` VARCHAR(1000) NULL,
    `Remark` VARCHAR(500) NULL,
    `ReminderCount` INT NOT NULL DEFAULT 0,
    `LastReminderTime` DATETIME NULL,
    `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `CreatedBy` BIGINT NOT NULL,
    `UpdatedAt` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    `UpdatedBy` BIGINT NULL,
    `IsDeleted` TINYINT(1) NOT NULL DEFAULT 0,
    `DeletedAt` DATETIME NULL,
    `DeletedBy` BIGINT NULL,
    KEY `IX_workflow_node_executions_InstanceId` (`InstanceId`),
    KEY `IX_workflow_node_executions_NodeType` (`NodeType`),
    KEY `IX_workflow_node_executions_Status` (`Status`),
    KEY `IX_workflow_node_executions_ScheduledEndTime` (`ScheduledEndTime`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='流程节点执行表';

-- 11. 档案文件表
CREATE TABLE IF NOT EXISTS `archive_files` (
    `Id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `TransactionId` BIGINT NULL,
    `VehicleId` BIGINT NULL,
    `ArchiveType` INT NOT NULL COMMENT '1登记证 2行驶证 3身份证 4鉴定报告 5交易合同 6税费凭证 7保险单 99其他',
    `ArchiveTypeName` VARCHAR(100) NOT NULL,
    `FileName` VARCHAR(255) NOT NULL,
    `OriginalFileName` VARCHAR(255) NOT NULL,
    `FilePath` VARCHAR(255) NOT NULL,
    `FileSize` BIGINT NOT NULL,
    `ContentType` VARCHAR(100) NOT NULL,
    `FileExtension` VARCHAR(50) NOT NULL,
    `FileHash` VARCHAR(64) NULL,
    `OcrProcessed` TINYINT(1) NOT NULL DEFAULT 0,
    `OcrText` TEXT NULL,
    `Keywords` VARCHAR(500) NULL,
    `SortOrder` INT NOT NULL DEFAULT 0,
    `Description` VARCHAR(500) NULL,
    `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `CreatedBy` BIGINT NOT NULL,
    `UpdatedAt` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    `UpdatedBy` BIGINT NULL,
    `IsDeleted` TINYINT(1) NOT NULL DEFAULT 0,
    `DeletedAt` DATETIME NULL,
    `DeletedBy` BIGINT NULL,
    KEY `IX_archive_files_TransactionId` (`TransactionId`),
    KEY `IX_archive_files_VehicleId` (`VehicleId`),
    KEY `IX_archive_files_ArchiveType` (`ArchiveType`),
    KEY `IX_archive_files_FileHash` (`FileHash`),
    KEY `IX_archive_files_CreatedAt` (`CreatedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='档案文件表';

-- 12. 异常案件表
CREATE TABLE IF NOT EXISTS `exception_cases` (
    `Id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `CaseNo` VARCHAR(50) NOT NULL,
    `CaseType` INT NOT NULL COMMENT '1抵押 2查封 3环保 4发动机号 5车架号 6事故 7缺材料 8身份 9税费 99其他',
    `CaseTypeName` VARCHAR(100) NOT NULL,
    `VehicleId` BIGINT NULL,
    `TransactionId` BIGINT NULL,
    `Title` VARCHAR(200) NOT NULL,
    `Description` TEXT NOT NULL,
    `Status` INT NOT NULL DEFAULT 0 COMMENT '0创建 1调查中 2待审批 3处理中 4已解决 5已关闭 6已驳回',
    `SourceModule` VARCHAR(50) NULL COMMENT '来源模块',
    `AssignedTo` BIGINT NULL,
    `AssigneeName` VARCHAR(50) NULL,
    `DueDate` DATETIME NULL,
    `Priority` INT NOT NULL DEFAULT 1 COMMENT '1-5 数字越大优先级越高',
    `ProcessingCount` INT NOT NULL DEFAULT 0,
    `Resolution` VARCHAR(500) NULL,
    `ResolvedAt` DATETIME NULL,
    `ResolvedBy` BIGINT NULL,
    `ResolverName` VARCHAR(50) NULL,
    `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `CreatedBy` BIGINT NOT NULL,
    `UpdatedAt` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    `UpdatedBy` BIGINT NULL,
    `IsDeleted` TINYINT(1) NOT NULL DEFAULT 0,
    `DeletedAt` DATETIME NULL,
    `DeletedBy` BIGINT NULL,
    UNIQUE KEY `IX_exception_cases_CaseNo` (`CaseNo`),
    KEY `IX_exception_cases_VehicleId` (`VehicleId`),
    KEY `IX_exception_cases_TransactionId` (`TransactionId`),
    KEY `IX_exception_cases_CaseType` (`CaseType`),
    KEY `IX_exception_cases_Status` (`Status`),
    KEY `IX_exception_cases_CreatedAt` (`CreatedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='异常案件表';

-- 13. 异常案件处理日志
CREATE TABLE IF NOT EXISTS `exception_case_logs` (
    `Id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `CaseId` BIGINT NOT NULL,
    `OldStatus` INT NOT NULL,
    `NewStatus` INT NOT NULL,
    `Action` VARCHAR(1000) NOT NULL,
    `Remark` TEXT NULL,
    `OperatorId` BIGINT NOT NULL,
    `OperatorName` VARCHAR(50) NOT NULL,
    `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `CreatedBy` BIGINT NOT NULL,
    `UpdatedAt` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    `UpdatedBy` BIGINT NULL,
    `IsDeleted` TINYINT(1) NOT NULL DEFAULT 0,
    `DeletedAt` DATETIME NULL,
    `DeletedBy` BIGINT NULL,
    KEY `IX_exception_case_logs_CaseId` (`CaseId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='异常案件处理日志';

-- 14. 系统用户表
CREATE TABLE IF NOT EXISTS `system_users` (
    `Id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `Username` VARCHAR(50) NOT NULL,
    `EmployeeNo` VARCHAR(50) NOT NULL,
    `RealName` VARCHAR(50) NOT NULL,
    `Role` INT NOT NULL COMMENT '1管理员 2审核员 3鉴定师 4登记员 5查看员',
    `Phone` VARCHAR(20) NULL,
    `Email` VARCHAR(100) NULL,
    `Department` VARCHAR(200) NULL,
    `IsActive` TINYINT(1) NOT NULL DEFAULT 1,
    `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `CreatedBy` BIGINT NOT NULL,
    `UpdatedAt` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    `UpdatedBy` BIGINT NULL,
    `IsDeleted` TINYINT(1) NOT NULL DEFAULT 0,
    `DeletedAt` DATETIME NULL,
    `DeletedBy` BIGINT NULL,
    UNIQUE KEY `IX_system_users_Username` (`Username`),
    UNIQUE KEY `IX_system_users_EmployeeNo` (`EmployeeNo`),
    KEY `IX_system_users_Role` (`Role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统用户表';

-- ============================================================
-- 初始数据
-- ============================================================

-- 系统用户
INSERT INTO `system_users` (`Id`, `Username`, `EmployeeNo`, `RealName`, `Role`, `Phone`, `Email`, `Department`, `IsActive`, `CreatedAt`, `CreatedBy`) VALUES
(1, 'admin', 'ADM001', '系统管理员', 1, '13800000000', 'admin@example.com', '信息部', 1, '2024-01-01 00:00:00', 1),
(2, 'auditor01', 'AUD001', '张审核', 2, '13800000001', 'zhang@example.com', '审核科', 1, '2024-01-01 00:00:00', 1),
(3, 'inspector01', 'INS001', '李鉴定', 3, '13800000002', 'li@example.com', '鉴定科', 1, '2024-01-01 00:00:00', 1),
(4, 'clerk01', 'CLK001', '王登记', 4, '13800000003', 'wang@example.com', '登记科', 1, '2024-01-01 00:00:00', 1);

-- 检测指标库 (148项: 发动机32 + 底盘28 + 车身45 + 电气18 + 路试25)
DELIMITER //
DROP PROCEDURE IF EXISTS seed_inspection_items //
CREATE PROCEDURE seed_inspection_items()
BEGIN
    DECLARE i INT DEFAULT 1;
    WHILE i <= 32 DO
        INSERT INTO `inspection_item_library` (`ItemCode`, `Category`, `ItemName`, `ItemNameEn`, `Description`, `SortOrder`, `MaxScore`, `Weight`, `ScoreCriteria`, `Required`, `AllowPhoto`, `MinPhotos`, `MaxPhotos`, `IsActive`, `CreatedAt`, `CreatedBy`)
        VALUES (CONCAT('ENG-', LPAD(i, 3, '0')), 1, CONCAT('发动机检测项目', i), CONCAT('Engine Inspection Item ', i), CONCAT('发动机系统第', i, '项检测指标'), i, 10, 0.30/32, '满分10分，根据检测情况酌情扣分', 1, 1, 0, 3, 1, '2024-01-01 00:00:00', 1);
        SET i = i + 1;
    END WHILE;

    SET i = 1;
    WHILE i <= 28 DO
        INSERT INTO `inspection_item_library` (`ItemCode`, `Category`, `ItemName`, `ItemNameEn`, `Description`, `SortOrder`, `MaxScore`, `Weight`, `ScoreCriteria`, `Required`, `AllowPhoto`, `MinPhotos`, `MaxPhotos`, `IsActive`, `CreatedAt`, `CreatedBy`)
        VALUES (CONCAT('CHS-', LPAD(i, 3, '0')), 2, CONCAT('底盘检测项目', i), CONCAT('Chassis Inspection Item ', i), CONCAT('底盘系统第', i, '项检测指标'), i, 10, 0.20/28, '满分10分，根据检测情况酌情扣分', 1, 1, 0, 2, 1, '2024-01-01 00:00:00', 1);
        SET i = i + 1;
    END WHILE;

    SET i = 1;
    WHILE i <= 45 DO
        INSERT INTO `inspection_item_library` (`ItemCode`, `Category`, `ItemName`, `ItemNameEn`, `Description`, `SortOrder`, `MaxScore`, `Weight`, `ScoreCriteria`, `Required`, `AllowPhoto`, `MinPhotos`, `MaxPhotos`, `IsActive`, `CreatedAt`, `CreatedBy`)
        VALUES (CONCAT('BDY-', LPAD(i, 3, '0')), 3, CONCAT('车身检测项目', i), CONCAT('Body Inspection Item ', i), CONCAT('车身外观内饰第', i, '项检测指标'), i, 10, 0.25/45, '满分10分，根据检测情况酌情扣分', 1, 1, 1, 3, 1, '2024-01-01 00:00:00', 1);
        SET i = i + 1;
    END WHILE;

    SET i = 1;
    WHILE i <= 18 DO
        INSERT INTO `inspection_item_library` (`ItemCode`, `Category`, `ItemName`, `ItemNameEn`, `Description`, `SortOrder`, `MaxScore`, `Weight`, `ScoreCriteria`, `Required`, `AllowPhoto`, `MinPhotos`, `MaxPhotos`, `IsActive`, `CreatedAt`, `CreatedBy`)
        VALUES (CONCAT('ELE-', LPAD(i, 3, '0')), 4, CONCAT('电气检测项目', i), CONCAT('Electrical Inspection Item ', i), CONCAT('电气系统第', i, '项检测指标'), i, 10, 0.10/18, '满分10分，根据检测情况酌情扣分', 1, 1, 0, 2, 1, '2024-01-01 00:00:00', 1);
        SET i = i + 1;
    END WHILE;

    SET i = 1;
    WHILE i <= 25 DO
        INSERT INTO `inspection_item_library` (`ItemCode`, `Category`, `ItemName`, `ItemNameEn`, `Description`, `SortOrder`, `MaxScore`, `Weight`, `ScoreCriteria`, `Required`, `AllowPhoto`, `MinPhotos`, `MaxPhotos`, `IsActive`, `CreatedAt`, `CreatedBy`)
        VALUES (CONCAT('RDT-', LPAD(i, 3, '0')), 5, CONCAT('路试检测项目', i), CONCAT('Road Test Inspection Item ', i), CONCAT('道路试验第', i, '项检测指标'), i, 10, 0.15/25, '满分10分，根据检测情况酌情扣分', 1, 0, 0, 0, 1, '2024-01-01 00:00:00', 1);
        SET i = i + 1;
    END WHILE;
END //
DELIMITER ;
CALL seed_inspection_items();
DROP PROCEDURE IF EXISTS seed_inspection_items;

-- ============================================================
-- 性能优化: 建议分区和索引
-- ============================================================

-- 对于500万级的交易记录表，建议按月分区
-- ALTER TABLE `vehicle_transactions` PARTITION BY RANGE (TO_DAYS(`TransactionDate`)) (
--     PARTITION p202401 VALUES LESS THAN (TO_DAYS('2024-02-01')),
--     PARTITION p202402 VALUES LESS THAN (TO_DAYS('2024-03-01')),
--     ...
-- );

-- 组合索引建议
-- CREATE INDEX IX_tx_status_date ON vehicle_transactions(Status, TransactionDate);
-- CREATE INDEX IX_io_vehicle_status ON inspection_orders(VehicleId, Status);
-- CREATE INDEX IX_af_type_created ON archive_files(ArchiveType, CreatedAt);
-- CREATE INDEX IX_ec_type_status ON exception_cases(CaseType, Status);
