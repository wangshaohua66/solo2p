using WaterManagement.API.Data;
using WaterManagement.API.Models;
using MongoDB.Driver;

namespace WaterManagement.API.Services;

public interface IDataSeeder
{
    Task SeedAsync();
}

public class DataSeeder : IDataSeeder
{
    private readonly IMongoDbContext _db;

    public DataSeeder(IMongoDbContext db)
    {
        _db = db;
    }

    public async Task SeedAsync()
    {
        await _db.CreateIndexesAsync();

        if (await _db.Reservoirs.CountDocumentsAsync(_ => true) > 0)
            return;

        var reservoirs = SeedReservoirs();
        var rainfallStations = SeedRainfallStations(reservoirs);
        var gates = SeedGates(reservoirs);
        var contacts = SeedContacts();
        var emergencyPlans = SeedEmergencyPlans(reservoirs);
        var inspectionTasks = SeedInspectionTasks(contacts);
        var dispatchOrders = await SeedDispatchOrdersAsync(gates, contacts, reservoirs);
        SeedLevees();
        await SeedInitialReadingsAsync(reservoirs, rainfallStations);
    }

    private List<Reservoir> SeedReservoirs()
    {
        var reservoirs = new List<Reservoir>
        {
            new() { Code = "RS001", Name = "青山水库", Type = "reservoir", Longitude = 119.5, Latitude = 30.2,
                Capacity = 28500, NormalPoolLevel = 85.5, FloodLimitLevel = 82.0, WarningLevel = 83.5,
                DangerLevel = 86.0, DeadLevel = 65.0, WatershedArea = 412, GateCount = 3, Status = "normal" },
            new() { Code = "RS002", Name = "翠湖水库", Type = "reservoir", Longitude = 119.8, Latitude = 30.5,
                Capacity = 15200, NormalPoolLevel = 72.0, FloodLimitLevel = 69.5, WarningLevel = 70.0,
                DangerLevel = 72.5, DeadLevel = 55.0, WatershedArea = 218, GateCount = 2, Status = "normal" },
            new() { Code = "RS003", Name = "龙潭水库", Type = "reservoir", Longitude = 119.2, Latitude = 30.8,
                Capacity = 42000, NormalPoolLevel = 128.0, FloodLimitLevel = 125.0, WarningLevel = 126.5,
                DangerLevel = 129.0, DeadLevel = 100.0, WatershedArea = 650, GateCount = 4, Status = "normal" },
            new() { Code = "RS004", Name = "凤栖水库", Type = "reservoir", Longitude = 120.1, Latitude = 30.0,
                Capacity = 8500, NormalPoolLevel = 58.5, FloodLimitLevel = 56.0, WarningLevel = 57.0,
                DangerLevel = 59.0, DeadLevel = 42.0, WatershedArea = 128, GateCount = 2, Status = "normal" },
            new() { Code = "RS005", Name = "白云水库", Type = "reservoir", Longitude = 119.0, Latitude = 30.4,
                Capacity = 18800, NormalPoolLevel = 95.0, FloodLimitLevel = 92.0, WarningLevel = 93.5,
                DangerLevel = 96.0, DeadLevel = 75.0, WatershedArea = 295, GateCount = 3, Status = "normal" },
            new() { Code = "RS006", Name = "红旗水库", Type = "reservoir", Longitude = 119.7, Latitude = 31.0,
                Capacity = 12600, NormalPoolLevel = 68.0, FloodLimitLevel = 65.5, WarningLevel = 66.5,
                DangerLevel = 69.0, DeadLevel = 50.0, WatershedArea = 186, GateCount = 2, Status = "normal" },
            new() { Code = "RS007", Name = "东溪水库", Type = "reservoir", Longitude = 120.3, Latitude = 30.6,
                Capacity = 21500, NormalPoolLevel = 105.0, FloodLimitLevel = 102.0, WarningLevel = 103.5,
                DangerLevel = 106.0, DeadLevel = 82.0, WatershedArea = 342, GateCount = 3, Status = "normal" },
            new() { Code = "RS008", Name = "西涧水库", Type = "reservoir", Longitude = 118.8, Latitude = 30.1,
                Capacity = 9800, NormalPoolLevel = 78.5, FloodLimitLevel = 76.0, WarningLevel = 77.0,
                DangerLevel = 79.5, DeadLevel = 60.0, WatershedArea = 152, GateCount = 2, Status = "normal" }
        };

        _db.Reservoirs.InsertMany(reservoirs);
        return reservoirs;
    }

    private List<RainfallStation> SeedRainfallStations(List<Reservoir> reservoirs)
    {
        var stations = new List<RainfallStation>
        {
            new() { Code = "RN001", Name = "上游雨量站", Type = "rainfall", Longitude = 119.3, Latitude = 30.5, Status = "normal" },
            new() { Code = "RN002", Name = "中游雨量站", Type = "rainfall", Longitude = 119.6, Latitude = 30.3, Status = "normal" },
            new() { Code = "RN003", Name = "下游雨量站", Type = "rainfall", Longitude = 120.0, Latitude = 30.1, Status = "normal" },
            new() { Code = "RN004", Name = "北坡雨量站", Type = "rainfall", Longitude = 119.4, Latitude = 30.9, Status = "normal" },
            new() { Code = "RN005", Name = "南坡雨量站", Type = "rainfall", Longitude = 119.7, Latitude = 29.8, Status = "normal" },
            new() { Code = "RN006", Name = "东峰雨量站", Type = "rainfall", Longitude = 120.2, Latitude = 30.7, Status = "normal" },
            new() { Code = "RN007", Name = "西谷雨量站", Type = "rainfall", Longitude = 118.9, Latitude = 30.6, Status = "normal" },
            new() { Code = "RN008", Name = "中央雨量站", Type = "rainfall", Longitude = 119.6, Latitude = 30.4, Status = "normal" },
            new() { Code = "RN009", Name = "河口雨量站", Type = "rainfall", Longitude = 120.1, Latitude = 30.3, Status = "normal" },
            new() { Code = "RN010", Name = "山坳雨量站", Type = "rainfall", Longitude = 119.1, Latitude = 30.2, Status = "normal" },
            new() { Code = "RN011", Name = "岭背雨量站", Type = "rainfall", Longitude = 119.9, Latitude = 30.8, Status = "normal" },
            new() { Code = "RN012", Name = "桥头雨量站", Type = "rainfall", Longitude = 119.5, Latitude = 30.0, Status = "normal" }
        };

        _db.RainfallStations.InsertMany(stations);
        return stations;
    }

    private List<Gate> SeedGates(List<Reservoir> reservoirs)
    {
        var gates = new List<Gate>();
        int gateIndex = 0;
        string[] gateTypes = { "溢洪道", "输水洞", "泄洪洞", "发电洞" };

        foreach (var res in reservoirs)
        {
            for (int i = 0; i < res.GateCount; i++)
            {
                gateIndex++;
                gates.Add(new Gate
                {
                    Code = $"GT{gateIndex:D3}",
                    Name = $"{res.Name} {gateTypes[i % gateTypes.Length]}闸",
                    Type = gateTypes[i % gateTypes.Length],
                    ReservoirId = res.Id,
                    ReservoirName = res.Name,
                    MaxOpening = 8 + i * 2,
                    CurrentOpening = 0,
                    Width = 6 + i * 1.5,
                    Elevation = res.NormalPoolLevel - 5,
                    Status = "operational"
                });
            }
        }

        _db.Gates.InsertMany(gates);
        return gates;
    }

    private List<Contact> SeedContacts()
    {
        var contacts = new List<Contact>();
        int sortOrder = 0;

        string[] adminNames = { "张局长", "李副局长", "王总工" };
        foreach (var name in adminNames)
        {
            sortOrder++;
            contacts.Add(new Contact
            {
                Name = name,
                Role = ContactRole.Admin,
                RoleName = "管理员",
                Phone = $"138{sortOrder:D8}",
                Department = "局领导",
                Position = sortOrder == 1 ? "局长" : sortOrder == 2 ? "副局长" : "总工程师",
                IsOnDuty = true,
                SortOrder = sortOrder
            });
        }

        string[] dispatcherNames = { "陈调度", "刘调度", "赵调度", "孙调度", "周调度", "吴调度" };
        foreach (var name in dispatcherNames)
        {
            sortOrder++;
            contacts.Add(new Contact
            {
                Name = name,
                Role = ContactRole.Dispatcher,
                RoleName = "调度员",
                Phone = $"139{sortOrder:D8}",
                Department = "调度中心",
                Position = "高级调度员",
                IsOnDuty = true,
                SortOrder = sortOrder
            });
        }

        string[] inspectorNames = {
            "黄巡检", "朱巡检", "林巡检", "何巡检", "罗巡检",
            "郑巡检", "梁巡检", "谢巡检", "宋巡检", "唐巡检",
            "许巡检", "韩巡检", "冯巡检", "邓巡检", "曹巡检",
            "彭巡检", "曾巡检", "肖巡检", "田巡检", "董巡检",
            "袁巡检", "潘巡检", "于巡检", "蒋巡检", "蔡巡检",
            "余巡检", "杜巡检", "叶巡检", "程巡检", "苏巡检"
        };
        for (int i = 0; i < inspectorNames.Length; i++)
        {
            sortOrder++;
            contacts.Add(new Contact
            {
                Name = inspectorNames[i],
                Role = ContactRole.Inspector,
                RoleName = "巡检员",
                Phone = $"137{sortOrder:D8}",
                Department = i < 15 ? "巡检一组" : "巡检二组",
                Position = "巡检员",
                IsOnDuty = true,
                SortOrder = sortOrder
            });
        }

        string[] maintenanceNames = { "杨维护", "黄维护", "周维护", "吴维护" };
        foreach (var name in maintenanceNames)
        {
            sortOrder++;
            contacts.Add(new Contact
            {
                Name = name,
                Role = ContactRole.Maintenance,
                RoleName = "维护人员",
                Phone = $"136{sortOrder:D8}",
                Department = "工程维护科",
                Position = "技术员",
                IsOnDuty = true,
                SortOrder = sortOrder
            });
        }

        string[] leaderNames = { "市局领导", "区县领导" };
        foreach (var name in leaderNames)
        {
            sortOrder++;
            contacts.Add(new Contact
            {
                Name = name,
                Role = ContactRole.Leader,
                RoleName = "领导",
                Phone = $"135{sortOrder:D8}",
                Department = "上级主管",
                Position = "分管领导",
                IsOnDuty = true,
                SortOrder = sortOrder
            });
        }

        _db.Contacts.InsertMany(contacts);
        return contacts;
    }

    private List<EmergencyPlan> SeedEmergencyPlans(List<Reservoir> reservoirs)
    {
        var allPlans = new List<EmergencyPlan>();

        foreach (var res in reservoirs)
        {
            for (int v = 1; v <= 3; v++)
            {
                var plan = new EmergencyPlan
                {
                    ReservoirId = res.Id,
                    ReservoirName = res.Name,
                    PlanName = $"{res.Name}防洪调度预案",
                    Version = $"v{v}.0",
                    VersionNumber = v,
                    IsCurrent = v == 3,
                    Status = v == 3 ? "approved" : "archived",
                    ApprovedBy = v == 3 ? "张局长" : null,
                    ApprovedAt = v == 3 ? DateTime.UtcNow.AddDays(-30 * v) : null,
                    Description = v == 3
                        ? $"{res.Name} 2024年度最新防洪调度预案，经局务会审议通过。"
                        : $"{res.Name} 历史版本预案 v{v}.0",
                    Levels = GeneratePlanLevels(res, v)
                };
                allPlans.Add(plan);
            }
        }

        _db.EmergencyPlans.InsertMany(allPlans);
        return allPlans;
    }

    private static List<ResponseLevelConfig> GeneratePlanLevels(Reservoir res, int version)
    {
        var levels = new List<ResponseLevelConfig>();

        var configs = new[]
        {
            new { Level = ResponseLevel.Level4, Name = "Ⅳ级响应(蓝色)", Color = "blue",
                Trigger = res.WarningLevel - 1.5, Role = "值班员" },
            new { Level = ResponseLevel.Level3, Name = "Ⅲ级响应(黄色)", Color = "yellow",
                Trigger = res.WarningLevel, Role = "调度员" },
            new { Level = ResponseLevel.Level2, Name = "Ⅱ级响应(橙色)", Color = "orange",
                Trigger = res.WarningLevel + 1.5, Role = "副局长" },
            new { Level = ResponseLevel.Level1, Name = "Ⅰ级响应(红色)", Color = "red",
                Trigger = res.DangerLevel, Role = "局长" }
        };

        int order = 0;
        foreach (var cfg in configs)
        {
            var level = new ResponseLevelConfig
            {
                Level = cfg.Level,
                LevelName = cfg.Name,
                TriggerWaterLevel = cfg.Trigger,
                Color = cfg.Color,
                Description = $"当水位达到 {cfg.Trigger:F1}m 时启动{cfg.Name}",
                ResponsibleRoles = new List<string> { cfg.Role, "相关科室负责人" }
            };

            var measures = new List<ResponseMeasure>
            {
                new() { Order = ++order, Category = "监测", Title = "加强监测", Content = "加密水位、流量监测频次，每30分钟上报一次" },
                new() { Order = ++order, Category = "调度", Title = "闸门调度", Content = $"根据水情调整泄洪闸开度，控制下泄流量不超过安全值" },
                new() { Order = ++order, Category = "巡查", Title = "工程巡查", Content = "组织人员对大坝、溢洪道等重点部位进行巡查" },
                new() { Order = ++order, Category = "通讯", Title = "通讯保障", Content = "确保通讯系统畅通，24小时有人值守" }
            };

            if (cfg.Level == ResponseLevel.Level3 || cfg.Level == ResponseLevel.Level2 || cfg.Level == ResponseLevel.Level1)
                measures.Add(new ResponseMeasure { Order = ++order, Category = "预警", Title = "发布预警", Content = $"向相关区域发布{cfg.Name}预警信息" });

            if (cfg.Level == ResponseLevel.Level2 || cfg.Level == ResponseLevel.Level1)
                measures.Add(new ResponseMeasure { Order = ++order, Category = "转移", Title = "人员转移", Content = "组织下游危险区域群众安全转移" });

            if (cfg.Level == ResponseLevel.Level1)
            {
                measures.Add(new ResponseMeasure { Order = ++order, Category = "抢险", Title = "工程抢险", Content = "组织抢险队伍对工程险情进行抢护" });
                measures.Add(new ResponseMeasure { Order = ++order, Category = "上报", Title = "上级报告", Content = "向上级水行政主管部门和地方政府报告汛情" });
            }

            if (version > 1)
                measures.Add(new ResponseMeasure
                {
                    Order = ++order,
                    Category = "应急",
                    Title = "物资调配" + (version > 2 ? " (优化)" : ""),
                    Content = "统筹调配应急物资和装备" + (version > 2 ? "，优化物资调度流程" : "")
                });

            level.Measures = measures;
        }

        return levels;
    }

    private List<InspectionTask> SeedInspectionTasks(List<Contact> contacts)
    {
        var inspectors = contacts.Where(c => c.Role == ContactRole.Inspector).Take(8).ToList();
        var facilities = new[] { "主坝", "副坝", "溢洪道", "输水洞", "发电厂房", "观测设施" };
        var tasks = new List<InspectionTask>();
        var now = DateTime.UtcNow;

        for (int i = 0; i < 10; i++)
        {
            var inspector = inspectors[i % inspectors.Count];
            var facility = facilities[i % facilities.Length];
            var status = i switch
            {
                < 3 => InspectionStatus.Pending,
                < 6 => InspectionStatus.InProgress,
                < 8 => InspectionStatus.Completed,
                _ => InspectionStatus.HasDefect
            };

            var task = new InspectionTask
            {
                TaskCode = $"IT{now:yyyyMMdd}{100 + i}",
                PlanMonth = $"{now:yyyy-MM}",
                Title = $"月度巡检 - {facility}",
                FacilityType = i % 2 == 0 ? "大坝" : "溢洪道",
                FacilityName = facility,
                InspectorId = inspector.Id,
                InspectorName = inspector.Name,
                Route = new List<string> { "起点", facility, "终点" },
                Status = status,
                ScheduledDate = now.AddDays(i - 5),
                StartTime = status != InspectionStatus.Pending ? now.AddDays(i - 5).AddHours(8) : null,
                EndTime = status == InspectionStatus.Completed || status == InspectionStatus.HasDefect
                    ? now.AddDays(i - 5).AddHours(12) : null,
                CreatedAt = now.AddDays(-10 + i),
                UpdatedAt = now.AddDays(-i)
            };

            if (status == InspectionStatus.HasDefect)
            {
                task.Defects = new List<Defect>
                {
                    new()
                    {
                        PartName = facility + "墙面",
                        Description = "发现渗水痕迹，面积约0.5平方米",
                        Severity = i % 3 == 0 ? DefectSeverity.Critical :
                                   i % 3 == 1 ? DefectSeverity.Major : DefectSeverity.Minor,
                        Status = DefectStatus.Reported,
                        Location = facility + "下游侧",
                        ReporterName = inspector.Name,
                        ReportTime = now.AddDays(i - 5).AddHours(10)
                    }
                };
            }

            tasks.Add(task);
        }

        _db.InspectionTasks.InsertMany(tasks);
        return tasks;
    }

    private async Task<List<DispatchOrder>> SeedDispatchOrdersAsync(
        List<Gate> gates, List<Contact> contacts, List<Reservoir> reservoirs)
    {
        var orders = new List<DispatchOrder>();
        var maintainers = contacts.Where(c => c.Role == ContactRole.Maintenance).ToList();
        var dispatchers = contacts.Where(c => c.Role == ContactRole.Dispatcher).Take(3).ToList();
        var now = DateTime.UtcNow;

        for (int i = 0; i < 14; i++)
        {
            var gate = gates[i % gates.Count];
            var receiver = maintainers[i % maintainers.Count];
            var sender = dispatchers[i % dispatchers.Count];
            var status = i switch
            {
                < 3 => DispatchStatus.Pending,
                < 6 => DispatchStatus.Sent,
                < 8 => DispatchStatus.Delivered,
                < 11 => DispatchStatus.Confirmed,
                < 13 => DispatchStatus.Closed,
                _ => DispatchStatus.Overdue
            };

            var createTime = now.AddHours(-i * 6);
            var order = new DispatchOrder
            {
                OrderCode = $"DD{createTime:yyyyMMdd}{100 + i}",
                GateId = gate.Id,
                GateName = gate.Name,
                ReservoirId = gate.ReservoirId,
                ReservoirName = gate.ReservoirName,
                TargetOpening = 1.5 + (i % 5) * 0.5,
                ActualOpening = status >= DispatchStatus.Confirmed ? 1.5 + (i % 5) * 0.5 : null,
                Status = status,
                Priority = i % 5 == 0 ? "high" : "normal",
                Reason = "日常水位调节",
                Instructions = "根据水情调度方案，调整闸门开度",
                SenderId = sender.Id,
                SenderName = sender.Name,
                ReceiverId = receiver.Id,
                ReceiverName = receiver.Name,
                ConfirmDeadline = createTime.AddMinutes(30),
                SendTime = status >= DispatchStatus.Sent ? createTime.AddMinutes(5) : null,
                DeliverTime = status >= DispatchStatus.Delivered ? createTime.AddMinutes(8) : null,
                ConfirmTime = status >= DispatchStatus.Confirmed ? createTime.AddMinutes(20) : null,
                CloseTime = status == DispatchStatus.Closed ? createTime.AddHours(2) : null,
                CreatedAt = createTime,
                UpdatedAt = createTime
            };

            order.TraceLogs.Add(new DispatchTraceLog
            {
                Timestamp = createTime,
                Status = DispatchStatus.Pending,
                OperatorName = sender.Name,
                Remark = "指令创建"
            });

            if (status >= DispatchStatus.Sent)
                order.TraceLogs.Add(new DispatchTraceLog
                {
                    Timestamp = createTime.AddMinutes(5),
                    Status = DispatchStatus.Sent,
                    OperatorName = "系统",
                    Remark = "指令已发送"
                });

            if (status >= DispatchStatus.Delivered)
                order.TraceLogs.Add(new DispatchTraceLog
                {
                    Timestamp = createTime.AddMinutes(8),
                    Status = DispatchStatus.Delivered,
                    OperatorName = "系统",
                    Remark = "已送达接收人"
                });

            if (status >= DispatchStatus.Confirmed)
                order.TraceLogs.Add(new DispatchTraceLog
                {
                    Timestamp = createTime.AddMinutes(20),
                    Status = DispatchStatus.Confirmed,
                    OperatorName = receiver.Name,
                    Remark = "已确认执行，实际开度符合要求"
                });

            if (status == DispatchStatus.Closed)
                order.TraceLogs.Add(new DispatchTraceLog
                {
                    Timestamp = createTime.AddHours(2),
                    Status = DispatchStatus.Closed,
                    OperatorName = sender.Name,
                    Remark = "调度完成，关闭指令"
                });

            orders.Add(order);
        }

        await _db.DispatchOrders.InsertManyAsync(orders);
        return orders;
    }

    private async Task SeedInitialReadingsAsync(List<Reservoir> reservoirs, List<RainfallStation> rainfallStations)
    {
        var readings = new List<WaterLevelReading>();
        var now = DateTime.UtcNow;

        foreach (var res in reservoirs)
        {
            double baseLevel = res.FloodLimitLevel + 1.2;
            readings.Add(new WaterLevelReading
            {
                StationId = res.Id,
                StationCode = res.Code,
                StationName = res.Name,
                StationType = "reservoir",
                Timestamp = now,
                WaterLevel = Math.Round(baseLevel, 3),
                Inflow = 120 + Random.Shared.NextDouble() * 40,
                Outflow = 100 + Random.Shared.NextDouble() * 20,
                Storage = res.Capacity * 0.65,
                IsWarning = baseLevel >= res.WarningLevel,
                IsDanger = baseLevel >= res.DangerLevel,
                Source = "telemetry"
            });
        }

        foreach (var stn in rainfallStations)
        {
            readings.Add(new WaterLevelReading
            {
                StationId = stn.Id,
                StationCode = stn.Code,
                StationName = stn.Name,
                StationType = "rainfall",
                Timestamp = now,
                Rainfall = Math.Round(Random.Shared.NextDouble() * 8, 2),
                CumulativeRainfall = Math.Round(50 + Random.Shared.NextDouble() * 100, 2),
                Source = "telemetry"
            });
        }

        if (readings.Count > 0)
            await _db.WaterLevelReadings.InsertManyAsync(readings);
    }

    private List<Levee> SeedLevees()
    {
        var levees = new List<Levee>
        {
            new()
            {
                Code = "LV001",
                Name = "长江北岸大堤",
                RiverName = "长江",
                StartPoint = "三江口",
                EndPoint = "鹅鼻嘴",
                LengthKm = 22.5,
                DesignLevel = "1级",
                DesignWaterLevel = 8.5,
                GuaranteeWaterLevel = 7.8,
                WarningWaterLevel = 6.5,
                Material = "土堤",
                Status = "正常",
                ResponsibleUnit = "长江河道管理局",
                ResponsiblePerson = "王建国",
                ContactPhone = "13800138001",
                Description = "长江干流重要防洪堤段，保护沿江工业区和居民区"
            },
            new()
            {
                Code = "LV002",
                Name = "淮河南岸堤防",
                RiverName = "淮河",
                StartPoint = "蚌埠闸",
                EndPoint = "五河县城",
                LengthKm = 18.3,
                DesignLevel = "2级",
                DesignWaterLevel = 22.0,
                GuaranteeWaterLevel = 20.5,
                WarningWaterLevel = 18.5,
                Material = "混凝土",
                Status = "正常",
                ResponsibleUnit = "淮河河道管理处",
                ResponsiblePerson = "李明辉",
                ContactPhone = "13800138002",
                Description = "淮河中游重点堤防，保护蚌埠市及周边农田"
            },
            new()
            {
                Code = "LV003",
                Name = "黄河左岸防洪堤",
                RiverName = "黄河",
                StartPoint = "花园口",
                EndPoint = "东坝头",
                LengthKm = 24.8,
                DesignLevel = "1级",
                DesignWaterLevel = 96.0,
                GuaranteeWaterLevel = 94.5,
                WarningWaterLevel = 92.0,
                Material = "砌石",
                Status = "维护中",
                ResponsibleUnit = "黄河水利委员会",
                ResponsiblePerson = "张抗洪",
                ContactPhone = "13800138003",
                Description = "黄河下游标志性堤段，正在进行除险加固工程"
            },
            new()
            {
                Code = "LV004",
                Name = "松花江右岸大堤",
                RiverName = "松花江",
                StartPoint = "哈尔滨市区",
                EndPoint = "呼兰河口",
                LengthKm = 16.7,
                DesignLevel = "2级",
                DesignWaterLevel = 120.5,
                GuaranteeWaterLevel = 119.0,
                WarningWaterLevel = 117.5,
                Material = "复合材料",
                Status = "正常",
                ResponsibleUnit = "松辽水利委员会",
                ResponsiblePerson = "赵北防",
                ContactPhone = "13800138004",
                Description = "哈尔滨市城区防洪屏障，采用新型复合防渗材料"
            },
            new()
            {
                Code = "LV005",
                Name = "珠江三角洲海堤",
                RiverName = "珠江",
                StartPoint = "虎门炮台",
                EndPoint = "南沙港",
                LengthKm = 20.1,
                DesignLevel = "3级",
                DesignWaterLevel = 4.2,
                GuaranteeWaterLevel = 3.5,
                WarningWaterLevel = 2.8,
                Material = "混凝土",
                Status = "正常",
                ResponsibleUnit = "珠江水利委员会",
                ResponsiblePerson = "陈海防",
                ContactPhone = "13800138005",
                Description = "珠江口沿海防潮堤，同时抵御风暴潮和洪水"
            },
            new()
            {
                Code = "LV006",
                Name = "闽江左岸防洪堤",
                RiverName = "闽江",
                StartPoint = "福州市区",
                EndPoint = "马尾港",
                LengthKm = 15.6,
                DesignLevel = "3级",
                DesignWaterLevel = 10.8,
                GuaranteeWaterLevel = 9.5,
                WarningWaterLevel = 8.0,
                Material = "土堤",
                Status = "隐患",
                ResponsibleUnit = "闽江河道管理局",
                ResponsiblePerson = "林闽江",
                ContactPhone = "13800138006",
                Description = "福州市城市防洪堤，局部段存在渗漏隐患，已列入整治计划"
            },
            new()
            {
                Code = "LV007",
                Name = "赣江右岸大堤",
                RiverName = "赣江",
                StartPoint = "南昌大桥",
                EndPoint = "吴城镇",
                LengthKm = 23.4,
                DesignLevel = "2级",
                DesignWaterLevel = 24.5,
                GuaranteeWaterLevel = 23.0,
                WarningWaterLevel = 21.5,
                Material = "砌石",
                Status = "正常",
                ResponsibleUnit = "赣江河道管理处",
                ResponsiblePerson = "刘赣水",
                ContactPhone = "13800138007",
                Description = "南昌市防洪重点堤段，保护南昌主城区及赣抚平原"
            },
            new()
            {
                Code = "LV008",
                Name = "汉江东岸堤防",
                RiverName = "汉江",
                StartPoint = "丹江口坝下",
                EndPoint = "襄樊市区",
                LengthKm = 19.2,
                DesignLevel = "4级",
                DesignWaterLevel = 72.0,
                GuaranteeWaterLevel = 70.0,
                WarningWaterLevel = 68.0,
                Material = "复合材料",
                Status = "损毁",
                ResponsibleUnit = "汉江河道管理局",
                ResponsiblePerson = "周汉堤",
                ContactPhone = "13800138008",
                Description = "2023年汛期局部冲毁，正在组织抢险修复"
            }
        };

        _db.Levees.InsertMany(levees);
        return levees;
    }
}
