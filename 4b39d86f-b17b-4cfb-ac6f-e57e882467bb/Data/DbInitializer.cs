using HazChemSupervision.Models;

namespace HazChemSupervision.Data;

public static class DbInitializer
{
    public static async Task Initialize(AppDbContext context)
    {
        if (await context.Users.AnyAsync())
        {
            return;
        }

        var enterprises = new List<Enterprise>
        {
            new Enterprise
            {
                Name = "省石化集团有限公司",
                UnifiedSocialCreditCode = "91370000123456789A",
                Address = "济南市历下区工业南路100号",
                LegalPerson = "张三",
                ContactPhone = "0531-12345678",
                SafetyManager = "李四",
                SafetyManagerPhone = "13800138001",
                EnterpriseType = EnterpriseType.Production,
                HazardLevel = 1,
                IsActive = true,
                Longitude = 117.000000M,
                Latitude = 36.600000M,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new Enterprise
            {
                Name = "青岛化工股份有限公司",
                UnifiedSocialCreditCode = "91370200987654321B",
                Address = "青岛市黄岛区临港路50号",
                LegalPerson = "王五",
                ContactPhone = "0532-87654321",
                SafetyManager = "赵六",
                SafetyManagerPhone = "13900139001",
                EnterpriseType = EnterpriseType.Production,
                HazardLevel = 2,
                IsActive = true,
                Longitude = 120.100000M,
                Latitude = 35.900000M,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        };
        await context.Enterprises.AddRangeAsync(enterprises);
        await context.SaveChangesAsync();

        var warehouses = new List<Warehouse>
        {
            new Warehouse
            {
                Name = "石化集团一号仓库",
                Code = "WH-JN-001",
                EnterpriseId = enterprises[0].Id,
                Address = "济南市历下区工业南路100号院内",
                Longitude = 117.000100M,
                Latitude = 36.600100M,
                Type = WarehouseType.ExplosionProof,
                FireRatingLevel = 1,
                MaxCapacity = 5000,
                CurrentUsedCapacity = 0,
                Temperature = 25.0M,
                Humidity = 50.0M,
                AllowedHazardClass = HazardClass.Class1,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new Warehouse
            {
                Name = "石化集团二号仓库",
                Code = "WH-JN-002",
                EnterpriseId = enterprises[0].Id,
                Address = "济南市历下区工业南路100号院内",
                Longitude = 117.000200M,
                Latitude = 36.600200M,
                Type = WarehouseType.LowTemperature,
                FireRatingLevel = 2,
                MaxCapacity = 3000,
                CurrentUsedCapacity = 0,
                Temperature = 5.0M,
                Humidity = 40.0M,
                AllowedHazardClass = HazardClass.Class3,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        };
        await context.Warehouses.AddRangeAsync(warehouses);
        await context.SaveChangesAsync();

        var chemicals = new List<Chemical>
        {
            new Chemical
            {
                Code = "CHEM-001",
                Name = "浓硫酸",
                CasNo = "7664-93-9",
                UnNo = "1830",
                Category = ChemicalCategory.CorrosiveSubstances,
                MolecularFormula = "H2SO4",
                HazardClass = HazardClass.Class8,
                PackingGroup = "II",
                PhysicalProperties = "无色油状液体，有强烈刺激性气味",
                StorageRequirements = "储存于阴凉、通风的库房，库温不超过35℃，相对湿度不超过85%",
                EmergencyMeasures = "皮肤接触：立即脱去污染的衣着，用大量流动清水冲洗至少15分钟；眼睛接触：立即提起眼睑，用大量流动清水或生理盐水彻底冲洗至少15分钟",
                StandardPackingWeight = 50,
                Unit = "kg",
                EnterpriseId = enterprises[0].Id,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new Chemical
            {
                Code = "CHEM-002",
                Name = "甲醇",
                CasNo = "67-56-1",
                UnNo = "1230",
                Category = ChemicalCategory.FlammableLiquids,
                MolecularFormula = "CH3OH",
                HazardClass = HazardClass.Class3,
                PackingGroup = "II",
                PhysicalProperties = "无色澄清液体，有刺激性气味",
                StorageRequirements = "储存于阴凉、通风良好的专用库房内，远离火种、热源",
                EmergencyMeasures = "灭火剂：抗溶性泡沫、干粉、二氧化碳、砂土",
                StandardPackingWeight = 200,
                Unit = "L",
                EnterpriseId = enterprises[0].Id,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new Chemical
            {
                Code = "CHEM-003",
                Name = "液氨",
                CasNo = "7664-41-7",
                UnNo = "1005",
                Category = ChemicalCategory.CompressedGases,
                MolecularFormula = "NH3",
                HazardClass = HazardClass.Class2,
                PackingGroup = "II",
                PhysicalProperties = "无色气体，有强烈刺激性气味",
                StorageRequirements = "储存于阴凉、通风的库房，远离火种、热源，库温不宜超过30℃",
                EmergencyMeasures = "迅速撤离泄漏污染区人员至上风处，并立即隔离150m，严格限制出入",
                StandardPackingWeight = 1000,
                Unit = "kg",
                EnterpriseId = enterprises[1].Id,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        };
        await context.Chemicals.AddRangeAsync(chemicals);
        await context.SaveChangesAsync();

        var users = new List<User>
        {
            new User
            {
                Username = "admin",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123"),
                RealName = "系统管理员",
                IdCard = "370101199001010001",
                Phone = "13800000001",
                Email = "admin@example.gov.cn",
                Role = UserRole.Admin,
                EnterpriseId = null,
                Department = "应急管理厅",
                Position = "管理员",
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new User
            {
                Username = "supervisor",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Supervisor@123"),
                RealName = "监管人员",
                IdCard = "370101199001010002",
                Phone = "13800000002",
                Email = "supervisor@example.gov.cn",
                Role = UserRole.Supervisor,
                EnterpriseId = null,
                Department = "危化品监管处",
                Position = "科长",
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new User
            {
                Username = "enterprise01",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Enterprise@123"),
                RealName = "企业安全员",
                IdCard = "370101199001010003",
                Phone = "13800000003",
                Email = "safety@petrochem.com",
                Role = UserRole.Enterprise,
                EnterpriseId = enterprises[0].Id,
                Department = "安全环保部",
                Position = "安全员",
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        };
        await context.Users.AddRangeAsync(users);
        await context.SaveChangesAsync();

        var certificates = new List<Certificate>
        {
            new Certificate
            {
                CertificateNo = "SAFE-2024-0001",
                Type = CertificateType.SafetyProductionLicense,
                HolderName = "省石化集团有限公司",
                EnterpriseId = enterprises[0].Id,
                IssuingAuthority = "山东省应急管理厅",
                IssueDate = new DateTime(2024, 1, 1),
                ExpiryDate = new DateTime(2027, 1, 1),
                Status = CertificateStatus.Valid,
                Scope = "危险化学品生产",
                Verified = true,
                LastVerifiedTime = DateTime.UtcNow,
                VerificationResult = "证书有效",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new Certificate
            {
                CertificateNo = "SPEC-2024-0001",
                Type = CertificateType.SpecialOperationCertificate,
                HolderName = "李四",
                HolderIdCard = "370101198501010001",
                UserId = users[2].Id,
                IssuingAuthority = "济南市应急管理局",
                IssueDate = new DateTime(2024, 3, 1),
                ExpiryDate = new DateTime(2027, 3, 1),
                Status = CertificateStatus.Valid,
                Scope = "危险化学品特种作业",
                Verified = true,
                LastVerifiedTime = DateTime.UtcNow,
                VerificationResult = "证书有效",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        };
        await context.Certificates.AddRangeAsync(certificates);
        await context.SaveChangesAsync();

        var chemicalBatches = new List<ChemicalBatch>
        {
            new ChemicalBatch
            {
                BatchNo = "BATCH-JN-2024-0001",
                ChemicalId = chemicals[0].Id,
                EnterpriseId = enterprises[0].Id,
                WarehouseId = warehouses[0].Id,
                Quantity = 10000,
                Unit = "kg",
                ProductionDate = new DateTime(2024, 6, 1),
                ExpiryDate = new DateTime(2026, 6, 1),
                Status = BatchStatus.InStorage,
                RawMaterialInboundTime = new DateTime(2024, 6, 1, 8, 0, 0),
                RawMaterialOperatorId = users[2].Id,
                RawMaterialRemark = "原料硫酸入库验收合格",
                ProductionStartTime = new DateTime(2024, 6, 2, 8, 0, 0),
                ProductionEndTime = new DateTime(2024, 6, 3, 18, 0, 0),
                ProductionOperatorId = users[2].Id,
                ProductionProcessRecord = "稀释、提纯、检验全过程记录完整",
                InspectionTime = new DateTime(2024, 6, 4, 10, 0, 0),
                InspectorId = users[1].Id,
                InspectionReportUrl = "/reports/BATCH-JN-2024-0001.pdf",
                InspectionResult = "纯度98.5%，符合GB/T 534-2014标准",
                InspectionPassed = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new ChemicalBatch
            {
                BatchNo = "BATCH-JN-2024-0002",
                ChemicalId = chemicals[1].Id,
                EnterpriseId = enterprises[0].Id,
                WarehouseId = warehouses[1].Id,
                Quantity = 50000,
                Unit = "L",
                ProductionDate = new DateTime(2024, 6, 10),
                ExpiryDate = new DateTime(2025, 6, 10),
                Status = BatchStatus.InProduction,
                RawMaterialInboundTime = new DateTime(2024, 6, 10, 8, 0, 0),
                RawMaterialOperatorId = users[2].Id,
                ProductionStartTime = new DateTime(2024, 6, 11, 8, 0, 0),
                ProductionOperatorId = users[2].Id,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        };
        await context.ChemicalBatches.AddRangeAsync(chemicalBatches);
        await context.SaveChangesAsync();

        var processRecords = new List<ProcessRecord>
        {
            new ProcessRecord
            {
                ChemicalBatchId = chemicalBatches[0].Id,
                Stage = ProcessStage.RawMaterialInbound,
                OperatorId = users[2].Id,
                OperatorName = "企业安全员",
                CertificateNo = "SPEC-2024-0001",
                CertificateType = "SpecialOperationCertificate",
                CertificateExpiryDate = new DateTime(2027, 3, 1),
                CertificateValidated = true,
                ValidationResult = "证书有效",
                OperationRecord = "原料入库检查：包装完好、标识清晰、数量准确",
                Status = ProcessStatus.Completed,
                StartTime = new DateTime(2024, 6, 1, 8, 0, 0),
                EndTime = new DateTime(2024, 6, 1, 10, 0, 0),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new ProcessRecord
            {
                ChemicalBatchId = chemicalBatches[0].Id,
                Stage = ProcessStage.ProductionProcessing,
                OperatorId = users[2].Id,
                OperatorName = "企业安全员",
                CertificateNo = "SPEC-2024-0001",
                CertificateType = "SpecialOperationCertificate",
                CertificateExpiryDate = new DateTime(2027, 3, 1),
                CertificateValidated = true,
                ValidationResult = "证书有效",
                OperationRecord = "生产过程：投料、反应、精制、成品检验",
                Status = ProcessStatus.Completed,
                StartTime = new DateTime(2024, 6, 2, 8, 0, 0),
                EndTime = new DateTime(2024, 6, 3, 18, 0, 0),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new ProcessRecord
            {
                ChemicalBatchId = chemicalBatches[0].Id,
                Stage = ProcessStage.FinishedInspection,
                OperatorId = users[1].Id,
                OperatorName = "监管人员",
                CertificateNo = "INS-2024-0001",
                CertificateType = "InspectorCertificate",
                CertificateExpiryDate = new DateTime(2026, 12, 31),
                CertificateValidated = true,
                ValidationResult = "证书有效",
                OperationRecord = "成品检验：纯度98.5%，重金属含量符合标准",
                Status = ProcessStatus.Completed,
                StartTime = new DateTime(2024, 6, 4, 10, 0, 0),
                EndTime = new DateTime(2024, 6, 4, 15, 0, 0),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        };
        await context.ProcessRecords.AddRangeAsync(processRecords);
        await context.SaveChangesAsync();

        var inventories = new List<Inventory>
        {
            new Inventory
            {
                EnterpriseId = enterprises[0].Id,
                WarehouseId = warehouses[0].Id,
                ChemicalId = chemicals[0].Id,
                Quantity = 10000,
                ReservedQuantity = 0,
                Unit = "kg",
                MaxCapacity = 50000,
                MinSafeQuantity = 5000,
                ReorderLevel = 10000,
                EarliestExpiryDate = new DateTime(2026, 6, 1),
                Status = InventoryStatus.Normal,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new Inventory
            {
                EnterpriseId = enterprises[0].Id,
                WarehouseId = warehouses[1].Id,
                ChemicalId = chemicals[1].Id,
                Quantity = 50000,
                ReservedQuantity = 0,
                Unit = "L",
                MaxCapacity = 100000,
                MinSafeQuantity = 20000,
                ReorderLevel = 30000,
                EarliestExpiryDate = new DateTime(2025, 6, 10),
                Status = InventoryStatus.Normal,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        };
        await context.Inventories.AddRangeAsync(inventories);
        await context.SaveChangesAsync();

        var inventoryTransactions = new List<InventoryTransaction>
        {
            new InventoryTransaction
            {
                InventoryId = inventories[0].Id,
                ChemicalBatchId = chemicalBatches[0].Id,
                EnterpriseId = enterprises[0].Id,
                WarehouseId = warehouses[0].Id,
                ChemicalId = chemicals[0].Id,
                TransactionType = InventoryTransactionType.FinishedGoodsInbound,
                Quantity = 10000,
                BalanceBefore = 0,
                BalanceAfter = 10000,
                Unit = "kg",
                Remark = "BATCH-JN-2024-0001成品入库",
                OperatorId = users[2].Id,
                OperatorName = "企业安全员",
                TransactionTime = new DateTime(2024, 6, 5, 9, 0, 0),
                CreatedAt = DateTime.UtcNow
            },
            new InventoryTransaction
            {
                InventoryId = inventories[1].Id,
                ChemicalBatchId = chemicalBatches[1].Id,
                EnterpriseId = enterprises[0].Id,
                WarehouseId = warehouses[1].Id,
                ChemicalId = chemicals[1].Id,
                TransactionType = InventoryTransactionType.RawMaterialInbound,
                Quantity = 50000,
                BalanceBefore = 0,
                BalanceAfter = 50000,
                Unit = "L",
                Remark = "甲醇原料入库",
                OperatorId = users[2].Id,
                OperatorName = "企业安全员",
                TransactionTime = new DateTime(2024, 6, 10, 10, 0, 0),
                CreatedAt = DateTime.UtcNow
            }
        };
        await context.InventoryTransactions.AddRangeAsync(inventoryTransactions);
        await context.SaveChangesAsync();

        var hazardRectifications = new List<HazardRectification>
        {
            new HazardRectification
            {
                WorkOrderNo = "HAZARD-2024-0001",
                EnterpriseId = enterprises[0].Id,
                Source = HazardSource.OnSiteInspection,
                HazardDescription = "一号仓库消防通道部分被货物占用，影响紧急疏散",
                Level = HazardLevel.Major,
                ResponsiblePerson = "李四",
                ResponsiblePersonPhone = "13800138001",
                ResponsiblePersonId = users[2].Id,
                DiscoveryTime = new DateTime(2024, 6, 15, 10, 0, 0),
                Deadline = new DateTime(2024, 6, 25, 17, 0, 0),
                Status = HazardRectificationStatus.InProgress,
                AcceptanceCriteria = "消防通道完全畅通，宽度不小于2米，无任何障碍物",
                RectificationMeasures = "将占用通道的货物转移到备用仓储区，设置明显的通道标识",
                RectificationStartTime = new DateTime(2024, 6, 16, 8, 0, 0),
                IsEscalated = false,
                OverdueDays = 0,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new HazardRectification
            {
                WorkOrderNo = "HAZARD-2024-0002",
                EnterpriseId = enterprises[1].Id,
                Source = HazardSource.RemoteMonitoring,
                HazardDescription = "液氨储罐压力监测系统报警记录未及时处理",
                Level = HazardLevel.General,
                ResponsiblePerson = "赵六",
                ResponsiblePersonPhone = "13900139001",
                DiscoveryTime = new DateTime(2024, 6, 10, 14, 0, 0),
                Deadline = new DateTime(2024, 6, 15, 17, 0, 0),
                Status = HazardRectificationStatus.Overdue,
                AcceptanceCriteria = "建立报警处理台账，确保所有报警在30分钟内响应处理",
                IsEscalated = true,
                EscalationLevel = 1,
                EscalationTime = new DateTime(2024, 6, 16, 9, 0, 0),
                EscalationReason = "整改期限已过1天未完成",
                OverdueDays = 3,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        };
        await context.HazardRectifications.AddRangeAsync(hazardRectifications);
        await context.SaveChangesAsync();

        var emergencyDrills = new List<EmergencyDrill>
        {
            new EmergencyDrill
            {
                PlanNo = "DRILL-2024-Q2-001",
                Name = "2024年第二季度液氨泄漏应急演练",
                EnterpriseId = enterprises[1].Id,
                Type = DrillType.LeakageHandling,
                Status = DrillStatus.Planned,
                Year = 2024,
                Quarter = 2,
                PlannedStartTime = new DateTime(2024, 6, 20, 9, 0, 0),
                PlannedEndTime = new DateTime(2024, 6, 20, 12, 0, 0),
                Location = "青岛化工液氨储罐区",
                ScenarioDescription = "模拟液氨储罐阀门泄漏，开展泄漏处置、人员疏散、医疗救护演练",
                Objectives = "检验应急预案的可行性，提高应急处置能力",
                PlannedParticipants = 50,
                EstimatedCost = 20000,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new EmergencyDrill
            {
                PlanNo = "DRILL-2024-Q2-002",
                Name = "2024年第二季度消防应急演练",
                EnterpriseId = enterprises[0].Id,
                Type = DrillType.FireFighting,
                Status = DrillStatus.Evaluated,
                Year = 2024,
                Quarter = 2,
                PlannedStartTime = new DateTime(2024, 6, 5, 9, 0, 0),
                PlannedEndTime = new DateTime(2024, 6, 5, 11, 0, 0),
                ActualStartTime = new DateTime(2024, 6, 5, 9, 0, 0),
                ActualEndTime = new DateTime(2024, 6, 5, 11, 30, 0),
                Location = "省石化集团厂区",
                ScenarioDescription = "模拟仓库火灾，开展灭火、疏散演练",
                Objectives = "检验消防设施完好性，提高员工消防应急能力",
                PlannedParticipants = 30,
                ActualParticipants = 28,
                ParticipantsList = "安全环保部、生产部、仓储部共28人",
                MaterialsUsed = "灭火器、消防水带、防烟面具、担架",
                EstimatedCost = 5000,
                ActualCost = 4800,
                ExecutionRecord = "演练过程顺利，参演人员能够正确使用消防器材，疏散路线清晰",
                ProblemsFound = "部分员工佩戴防毒面具动作较慢",
                EvaluationResult = DrillEvaluationResult.Good,
                EvaluationComment = "演练组织有序，处置流程正确，需加强个人防护装备使用训练",
                EvaluatorId = users[1].Id,
                EvaluatorName = "监管人员",
                EvaluationTime = new DateTime(2024, 6, 5, 14, 0, 0),
                ImprovementMeasures = "每周组织一次个人防护装备使用培训",
                ReportUrl = "/reports/DRILL-2024-Q2-002.pdf",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        };
        await context.EmergencyDrills.AddRangeAsync(emergencyDrills);
        await context.SaveChangesAsync();

        var alerts = new List<Alert>
        {
            new Alert
            {
                AlertNo = "ALERT-2024-0001",
                Type = AlertType.HazardOverdue,
                Level = AlertLevel.Danger,
                Status = AlertStatus.New,
                EnterpriseId = enterprises[1].Id,
                HazardRectificationId = hazardRectifications[1].Id,
                Title = "隐患整改逾期未完成",
                Content = "隐患工单HAZARD-2024-0002整改期限已过3天仍未完成",
                Suggestion = "请立即升级督办，对责任企业进行约谈",
                RecipientRole = "Supervisor",
                IsRead = false,
                IsHandled = false,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new Alert
            {
                AlertNo = "ALERT-2024-0002",
                Type = AlertType.DrillSupervision,
                Level = AlertLevel.Warning,
                Status = AlertStatus.New,
                EnterpriseId = enterprises[1].Id,
                EmergencyDrillId = emergencyDrills[0].Id,
                Title = "应急演练即将到期",
                Content = "演练计划DRILL-2024-Q2-001计划于2024-06-20开展，目前尚未开始执行",
                Suggestion = "请督促企业按计划开展演练",
                RecipientRole = "Enterprise",
                RecipientUserId = users[2].Id,
                IsRead = false,
                IsHandled = false,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        };
        await context.Alerts.AddRangeAsync(alerts);
        await context.SaveChangesAsync();
    }
}
