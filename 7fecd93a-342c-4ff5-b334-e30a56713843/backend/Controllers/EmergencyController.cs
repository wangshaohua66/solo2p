using WaterManagement.API.Data;
using WaterManagement.API.DTOs;
using WaterManagement.API.Models;
using WaterManagement.API.Services;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;
using MongoDB.Driver;

namespace WaterManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
[SwaggerTag("防汛预案与应急管理")]
public class EmergencyController : ControllerBase
{
    private readonly IMongoDbContext _db;
    private readonly INotificationService _notificationService;

    public EmergencyController(IMongoDbContext db, INotificationService notificationService)
    {
        _db = db;
        _notificationService = notificationService;
    }

    [HttpGet("plans")]
    [SwaggerOperation(Summary = "获取预案列表", Description = "返回所有水库的防汛预案列表")]
    [ProducesResponseType(typeof(ApiResponse<List<EmergencyPlanDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<EmergencyPlanDto>>>> GetPlans(
        [FromQuery] string? reservoirId = null)
    {
        var filter = Builders<EmergencyPlan>.Filter.Empty;
        if (!string.IsNullOrEmpty(reservoirId))
            filter &= Builders<EmergencyPlan>.Filter.Eq(p => p.ReservoirId, reservoirId);

        var plans = await _db.EmergencyPlans
            .Find(filter)
            .SortByDescending(p => p.VersionNumber)
            .ToListAsync();

        var dtos = plans.Select(MapPlanToDto).ToList();
        return Ok(ApiResponse<List<EmergencyPlanDto>>.Ok(dtos));
    }

    [HttpGet("plans/tree")]
    [SwaggerOperation(Summary = "获取预案树形结构", Description = "按水库分组的预案版本树")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<object>>> GetPlanTree()
    {
        var reservoirs = await _db.Reservoirs.Find(_ => true).ToListAsync();
        var tree = new List<object>();

        foreach (var res in reservoirs)
        {
            var plans = await _db.EmergencyPlans
                .Find(p => p.ReservoirId == res.Id)
                .SortByDescending(p => p.VersionNumber)
                .ToListAsync();

            tree.Add(new
            {
                id = "res_" + res.Id,
                name = res.Name,
                type = "reservoir",
                children = plans.Select(p => new
                {
                    id = p.Id,
                    name = p.PlanName + " v" + p.Version,
                    type = "plan",
                    isCurrent = p.IsCurrent,
                    children = p.Levels.Select(l => new
                    {
                        id = p.Id + "_" + l.Level,
                        name = l.LevelName,
                        type = "level",
                        level = l.Level,
                        triggerLevel = l.TriggerWaterLevel,
                        color = l.Color,
                        measureCount = l.Measures.Count
                    }).ToList()
                }).ToList()
            });
        }

        return Ok(ApiResponse<object>.Ok(tree));
    }

    [HttpGet("plans/{id}")]
    [SwaggerOperation(Summary = "获取预案详情", Description = "根据ID获取防汛预案详细内容")]
    [ProducesResponseType(typeof(ApiResponse<EmergencyPlanDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<EmergencyPlanDto>>> GetPlan(string id)
    {
        var plan = await _db.EmergencyPlans.Find(p => p.Id == id).FirstOrDefaultAsync();
        if (plan == null)
            return NotFound(ApiResponse.Fail("NOT_FOUND", "预案不存在"));

        return Ok(ApiResponse<EmergencyPlanDto>.Ok(MapPlanToDto(plan)));
    }

    [HttpGet("plans/{reservoirId}/versions")]
    [SwaggerOperation(Summary = "获取预案版本列表", Description = "返回指定水库的所有预案版本")]
    [ProducesResponseType(typeof(ApiResponse<List<PlanVersionInfo>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<PlanVersionInfo>>>> GetVersions(string reservoirId)
    {
        var plans = await _db.EmergencyPlans
            .Find(p => p.ReservoirId == reservoirId)
            .SortByDescending(p => p.VersionNumber)
            .ToListAsync();

        var versions = plans.Select(p => new PlanVersionInfo
        {
            Id = p.Id,
            Version = p.Version,
            VersionNumber = p.VersionNumber,
            IsCurrent = p.IsCurrent,
            Status = p.Status,
            UpdatedAt = p.UpdatedAt
        }).ToList();

        return Ok(ApiResponse<List<PlanVersionInfo>>.Ok(versions));
    }

    [HttpGet("plans/{reservoirId}/diff")]
    [SwaggerOperation(Summary = "比对预案版本差异", Description = "对比两个版本预案的差异")]
    [ProducesResponseType(typeof(ApiResponse<PlanDiffDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<PlanDiffDto>>> GetDiff(
        string reservoirId, [FromQuery] string v1, [FromQuery] string v2)
    {
        var plan1 = await _db.EmergencyPlans
            .Find(p => p.ReservoirId == reservoirId && p.Version == v1)
            .FirstOrDefaultAsync();
        var plan2 = await _db.EmergencyPlans
            .Find(p => p.ReservoirId == reservoirId && p.Version == v2)
            .FirstOrDefaultAsync();

        if (plan1 == null || plan2 == null)
            return NotFound(ApiResponse.Fail("NOT_FOUND", "预案版本不存在"));

        var differences = ComputeDifferences(plan1, plan2);
        var diff = new PlanDiffDto
        {
            ReservoirId = reservoirId,
            OldVersion = v1,
            NewVersion = v2,
            Differences = differences
        };

        return Ok(ApiResponse<PlanDiffDto>.Ok(diff));
    }

    [HttpGet("plans/{reservoirId}/match")]
    [SwaggerOperation(Summary = "匹配当前水位预案", Description = "根据水位自动匹配对应的响应级别预案")]
    [ProducesResponseType(typeof(ApiResponse<PlanMatchResult>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<PlanMatchResult>>> MatchPlan(
        string reservoirId, [FromQuery] double waterLevel)
    {
        var reservoir = await _db.Reservoirs.Find(r => r.Id == reservoirId).FirstOrDefaultAsync();
        if (reservoir == null)
            return NotFound(ApiResponse.Fail("NOT_FOUND", "水库不存在"));

        var plan = await _db.EmergencyPlans
            .Find(p => p.ReservoirId == reservoirId && p.IsCurrent)
            .FirstOrDefaultAsync();

        if (plan == null)
            return NotFound(ApiResponse.Fail("NO_CURRENT_PLAN", "暂无现行预案"));

        var sortedLevels = plan.Levels.OrderByDescending(l => l.TriggerWaterLevel).ToList();
        var matchedLevel = sortedLevels.FirstOrDefault(l => waterLevel >= l.TriggerWaterLevel)
                          ?? sortedLevels.LastOrDefault();

        if (matchedLevel == null)
            return BadRequest(ApiResponse.Fail("NO_LEVEL", "预案中无响应级别配置"));

        var result = new PlanMatchResult
        {
            ReservoirId = reservoirId,
            ReservoirName = reservoir.Name,
            CurrentWaterLevel = waterLevel,
            MatchedLevel = matchedLevel.Level,
            LevelName = matchedLevel.LevelName,
            Color = matchedLevel.Color,
            Description = matchedLevel.Description,
            Measures = matchedLevel.Measures.Select(m => new ResponseMeasureDto
            {
                MeasureId = m.MeasureId,
                Title = m.Title,
                Content = m.Content,
                Category = m.Category,
                Order = m.Order
            }).OrderBy(m => m.Order).ToList(),
            ResponsibleRoles = matchedLevel.ResponsibleRoles
        };

        return Ok(ApiResponse<PlanMatchResult>.Ok(result));
    }

    [HttpGet("contacts")]
    [SwaggerOperation(Summary = "获取通讯录", Description = "按角色分组的应急通讯录")]
    [ProducesResponseType(typeof(ApiResponse<List<ContactDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<ContactDto>>>> GetContacts(
        [FromQuery] string? role = null,
        [FromQuery] string? keyword = null)
    {
        var filter = Builders<Contact>.Filter.Empty;

        if (!string.IsNullOrEmpty(role) && Enum.TryParse<ContactRole>(role, true, out var roleEnum))
            filter &= Builders<Contact>.Filter.Eq(c => c.Role, roleEnum);

        if (!string.IsNullOrEmpty(keyword))
            filter &= Builders<Contact>.Filter.Or(
                Builders<Contact>.Filter.Where(c => c.Name.Contains(keyword)),
                Builders<Contact>.Filter.Where(c => c.Phone.Contains(keyword)),
                Builders<Contact>.Filter.Where(c => c.Department != null && c.Department.Contains(keyword))
            );

        var contacts = await _db.Contacts
            .Find(filter)
            .SortBy(c => c.SortOrder)
            .ToListAsync();

        var dtos = contacts.Select(c => new ContactDto
        {
            Id = c.Id,
            Name = c.Name,
            Role = c.Role,
            RoleName = c.RoleName,
            Phone = c.Phone,
            Email = c.Email,
            Department = c.Department,
            Position = c.Position,
            IsOnDuty = c.IsOnDuty
        }).ToList();

        return Ok(ApiResponse<List<ContactDto>>.Ok(dtos));
    }

    [HttpPost("notify")]
    [SwaggerOperation(Summary = "批量发送通知", Description = "向指定联系人发送应急通知")]
    [ProducesResponseType(typeof(ApiResponse<NotifyResult>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<NotifyResult>>> SendNotification(
        [FromBody] NotifyRequestDto request)
    {
        if (request.ContactIds == null || request.ContactIds.Count == 0)
            return BadRequest(ApiResponse.Fail("VALIDATION_ERROR", "请选择接收人",
                new Dictionary<string, string> { ["contactIds"] = "请选择接收人" }));

        if (string.IsNullOrEmpty(request.Message))
            return BadRequest(ApiResponse.Fail("VALIDATION_ERROR", "通知内容不能为空",
                new Dictionary<string, string> { ["message"] = "通知内容不能为空" }));

        var result = await _notificationService.SendBatchNotificationAsync(request);
        return Ok(ApiResponse<NotifyResult>.Ok(result));
    }

    [HttpGet("notify-logs")]
    [SwaggerOperation(Summary = "获取通知记录", Description = "返回通知发送与确认状态记录")]
    [ProducesResponseType(typeof(ApiResponse<List<NotificationLogDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<NotificationLogDto>>>> GetNotifyLogs(
        [FromQuery] string? batchId = null,
        [FromQuery] string? recipientId = null,
        [FromQuery] string? status = null)
    {
        NotificationStatus? statusEnum = null;
        if (!string.IsNullOrEmpty(status) && Enum.TryParse<NotificationStatus>(status, true, out var s))
            statusEnum = s;

        var logs = await _notificationService.GetNotificationLogsAsync(batchId, recipientId, statusEnum);
        return Ok(ApiResponse<List<NotificationLogDto>>.Ok(logs));
    }

    [HttpPut("notify-logs/{id}/read")]
    [SwaggerOperation(Summary = "标记通知已读", Description = "更新通知状态为已读")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse>> MarkAsRead(string id)
    {
        await _notificationService.UpdateNotificationStatusAsync(id, NotificationStatus.Read, "用户已读");
        return Ok(ApiResponse.Ok());
    }

    private static List<PlanDiffItem> ComputeDifferences(EmergencyPlan oldPlan, EmergencyPlan newPlan)
    {
        var diffs = new List<PlanDiffItem>();

        if (oldPlan.PlanName != newPlan.PlanName)
            diffs.Add(new PlanDiffItem
            {
                Path = "planName", Field = "预案名称",
                OldValue = oldPlan.PlanName, NewValue = newPlan.PlanName,
                ChangeType = "modified"
            });

        if (oldPlan.Description != newPlan.Description)
            diffs.Add(new PlanDiffItem
            {
                Path = "description", Field = "预案描述",
                OldValue = oldPlan.Description, NewValue = newPlan.Description,
                ChangeType = "modified"
            });

        var allLevels = oldPlan.Levels.Select(l => l.Level)
            .Union(newPlan.Levels.Select(l => l.Level))
            .Distinct()
            .OrderBy(l => l)
            .ToList();

        foreach (var level in allLevels)
        {
            var oldLevel = oldPlan.Levels.FirstOrDefault(l => l.Level == level);
            var newLevel = newPlan.Levels.FirstOrDefault(l => l.Level == level);

            if (oldLevel == null && newLevel != null)
            {
                diffs.Add(new PlanDiffItem
                {
                    Path = $"levels.{level}", Field = $"响应级别 {newLevel.LevelName}",
                    OldValue = null, NewValue = "新增",
                    ChangeType = "added"
                });
            }
            else if (oldLevel != null && newLevel == null)
            {
                diffs.Add(new PlanDiffItem
                {
                    Path = $"levels.{level}", Field = $"响应级别 {oldLevel.LevelName}",
                    OldValue = "删除", NewValue = null,
                    ChangeType = "deleted"
                });
            }
            else if (oldLevel != null && newLevel != null)
            {
                if (Math.Abs(oldLevel.TriggerWaterLevel - newLevel.TriggerWaterLevel) > 0.001)
                    diffs.Add(new PlanDiffItem
                    {
                        Path = $"levels.{level}.triggerWaterLevel",
                        Field = $"{newLevel.LevelName} - 触发水位",
                        OldValue = oldLevel.TriggerWaterLevel + " m",
                        NewValue = newLevel.TriggerWaterLevel + " m",
                        ChangeType = "modified"
                    });

                var oldMeasureIds = new HashSet<string>(oldLevel.Measures.Select(m => m.MeasureId));
                var newMeasureIds = new HashSet<string>(newLevel.Measures.Select(m => m.MeasureId));

                var added = newMeasureIds.Except(oldMeasureIds);
                var removed = oldMeasureIds.Except(newMeasureIds);
                var common = oldMeasureIds.Intersect(newMeasureIds);

                foreach (var mid in added)
                {
                    var m = newLevel.Measures.First(x => x.MeasureId == mid);
                    diffs.Add(new PlanDiffItem
                    {
                        Path = $"levels.{level}.measures.{mid}",
                        Field = $"{newLevel.LevelName} - 措施: {m.Title}",
                        OldValue = null, NewValue = m.Content,
                        ChangeType = "added"
                    });
                }

                foreach (var mid in removed)
                {
                    var m = oldLevel.Measures.First(x => x.MeasureId == mid);
                    diffs.Add(new PlanDiffItem
                    {
                        Path = $"levels.{level}.measures.{mid}",
                        Field = $"{oldLevel.LevelName} - 措施: {m.Title}",
                        OldValue = m.Content, NewValue = null,
                        ChangeType = "deleted"
                    });
                }

                foreach (var mid in common)
                {
                    var om = oldLevel.Measures.First(x => x.MeasureId == mid);
                    var nm = newLevel.Measures.First(x => x.MeasureId == mid);
                    if (om.Content != nm.Content || om.Title != nm.Title)
                        diffs.Add(new PlanDiffItem
                        {
                            Path = $"levels.{level}.measures.{mid}",
                            Field = $"{newLevel.LevelName} - 措施: {nm.Title}",
                            OldValue = om.Content, NewValue = nm.Content,
                            ChangeType = "modified"
                        });
                }
            }
        }

        return diffs;
    }

    [HttpPost("plans")]
    [SwaggerOperation(Summary = "新建预案", Description = "创建新的防汛应急预案")]
    [ProducesResponseType(typeof(ApiResponse<EmergencyPlanDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<EmergencyPlanDto>>> CreatePlan(
        [FromBody] EmergencyPlanCreateDto request)
    {
        if (string.IsNullOrEmpty(request.ReservoirId))
            return BadRequest(ApiResponse.Fail("VALIDATION_ERROR", "水库ID不能为空",
                new Dictionary<string, string> { ["reservoirId"] = "水库ID不能为空" }));

        if (string.IsNullOrEmpty(request.PlanName))
            return BadRequest(ApiResponse.Fail("VALIDATION_ERROR", "预案名称不能为空",
                new Dictionary<string, string> { ["planName"] = "预案名称不能为空" }));

        var reservoir = await _db.Reservoirs.Find(r => r.Id == request.ReservoirId).FirstOrDefaultAsync();
        if (reservoir == null)
            return NotFound(ApiResponse.Fail("NOT_FOUND", "水库不存在"));

        var existingPlans = await _db.EmergencyPlans
            .Find(p => p.ReservoirId == request.ReservoirId)
            .SortByDescending(p => p.VersionNumber)
            .ToListAsync();

        var maxVersionNumber = existingPlans.Count > 0 ? existingPlans.Max(p => p.VersionNumber) : 0;
        var newVersionNumber = maxVersionNumber + 1;

        var plan = new EmergencyPlan
        {
            ReservoirId = request.ReservoirId,
            ReservoirName = reservoir.Name,
            PlanName = request.PlanName,
            Version = string.IsNullOrEmpty(request.Version) ? $"1.{newVersionNumber}" : request.Version,
            VersionNumber = newVersionNumber,
            IsCurrent = true,
            Status = "draft",
            Description = request.Description,
            Levels = request.Levels?.Select(l => new ResponseLevelConfig
            {
                Level = l.Level,
                LevelName = l.LevelName,
                TriggerWaterLevel = l.TriggerWaterLevel,
                TriggerFlow = l.TriggerFlow,
                TriggerRainfall = l.TriggerRainfall,
                Color = l.Color,
                Description = l.Description,
                Measures = l.Measures?.Select(m => new ResponseMeasure
                {
                    MeasureId = string.IsNullOrEmpty(m.MeasureId) ? Guid.NewGuid().ToString("N") : m.MeasureId,
                    Title = m.Title,
                    Content = m.Content,
                    Category = m.Category,
                    Order = m.Order
                }).ToList() ?? new List<ResponseMeasure>(),
                ResponsibleRoles = l.ResponsibleRoles ?? new List<string>()
            }).ToList() ?? new List<ResponseLevelConfig>(),
            GeneralMeasures = request.GeneralMeasures ?? new List<string>(),
            EmergencyContacts = request.EmergencyContacts?.Select(c => new EmergencyContact
            {
                Name = c.Name,
                Role = c.Role,
                Phone = c.Phone,
                Department = c.Department
            }).ToList() ?? new List<EmergencyContact>(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var updateFilter = Builders<EmergencyPlan>.Filter.Eq(p => p.ReservoirId, request.ReservoirId);
        var update = Builders<EmergencyPlan>.Update.Set(p => p.IsCurrent, false);
        await _db.EmergencyPlans.UpdateManyAsync(updateFilter, update);

        await _db.EmergencyPlans.InsertOneAsync(plan);

        return Ok(ApiResponse<EmergencyPlanDto>.Ok(MapPlanToDto(plan)));
    }

    [HttpPut("plans/{id}")]
    [SwaggerOperation(Summary = "编辑预案", Description = "更新防汛应急预案，变更版本号时创建新版本")]
    [ProducesResponseType(typeof(ApiResponse<EmergencyPlanDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<EmergencyPlanDto>>> UpdatePlan(
        string id, [FromBody] EmergencyPlanUpdateDto request)
    {
        var existingPlan = await _db.EmergencyPlans.Find(p => p.Id == id).FirstOrDefaultAsync();
        if (existingPlan == null)
            return NotFound(ApiResponse.Fail("NOT_FOUND", "预案不存在"));

        bool createNewVersion = false;
        var reservoir = await _db.Reservoirs.Find(r => r.Id == existingPlan.ReservoirId).FirstOrDefaultAsync();
        if (reservoir == null)
            return NotFound(ApiResponse.Fail("NOT_FOUND", "关联水库不存在"));

        if (!string.IsNullOrEmpty(request.Status) && request.Status != existingPlan.Status)
        {
            if (request.Status == "approved")
                createNewVersion = true;
        }

        if (createNewVersion ||
            (request.Levels != null && !AreLevelsEqual(existingPlan.Levels, request.Levels)) ||
            (request.GeneralMeasures != null && !existingPlan.GeneralMeasures.SequenceEqual(request.GeneralMeasures)) ||
            (request.EmergencyContacts != null && !AreContactsEqual(existingPlan.EmergencyContacts, request.EmergencyContacts)) ||
            request.Description != existingPlan.Description ||
            (!string.IsNullOrEmpty(request.PlanName) && request.PlanName != existingPlan.PlanName))
        {
            createNewVersion = true;
        }

        if (createNewVersion)
        {
            var siblingPlans = await _db.EmergencyPlans
                .Find(p => p.ReservoirId == existingPlan.ReservoirId)
                .SortByDescending(p => p.VersionNumber)
                .ToListAsync();

            var maxVersionNumber = siblingPlans.Count > 0 ? siblingPlans.Max(p => p.VersionNumber) : existingPlan.VersionNumber;
            var newVersionNumber = maxVersionNumber + 1;

            var newPlan = new EmergencyPlan
            {
                ReservoirId = existingPlan.ReservoirId,
                ReservoirName = reservoir.Name,
                PlanName = string.IsNullOrEmpty(request.PlanName) ? existingPlan.PlanName : request.PlanName,
                Version = $"{newVersionNumber}.0",
                VersionNumber = newVersionNumber,
                IsCurrent = true,
                Status = string.IsNullOrEmpty(request.Status) ? existingPlan.Status : request.Status,
                ApprovedBy = request.ApprovedBy,
                ApprovedAt = request.Status == "approved" ? DateTime.UtcNow : existingPlan.ApprovedAt,
                Description = request.Description ?? existingPlan.Description,
                Levels = request.Levels?.Select(l => new ResponseLevelConfig
                {
                    Level = l.Level,
                    LevelName = l.LevelName,
                    TriggerWaterLevel = l.TriggerWaterLevel,
                    TriggerFlow = l.TriggerFlow,
                    TriggerRainfall = l.TriggerRainfall,
                    Color = l.Color,
                    Description = l.Description,
                    Measures = l.Measures?.Select(m => new ResponseMeasure
                    {
                        MeasureId = string.IsNullOrEmpty(m.MeasureId) ? Guid.NewGuid().ToString("N") : m.MeasureId,
                        Title = m.Title,
                        Content = m.Content,
                        Category = m.Category,
                        Order = m.Order
                    }).ToList() ?? new List<ResponseMeasure>(),
                    ResponsibleRoles = l.ResponsibleRoles ?? new List<string>()
                }).ToList() ?? existingPlan.Levels,
                GeneralMeasures = request.GeneralMeasures ?? existingPlan.GeneralMeasures,
                EmergencyContacts = request.EmergencyContacts?.Select(c => new EmergencyContact
                {
                    Name = c.Name,
                    Role = c.Role,
                    Phone = c.Phone,
                    Department = c.Department
                }).ToList() ?? existingPlan.EmergencyContacts,
                CreatedAt = existingPlan.CreatedAt,
                UpdatedAt = DateTime.UtcNow
            };

            var updateFilter = Builders<EmergencyPlan>.Filter.Eq(p => p.ReservoirId, existingPlan.ReservoirId);
            var update = Builders<EmergencyPlan>.Update.Set(p => p.IsCurrent, false);
            await _db.EmergencyPlans.UpdateManyAsync(updateFilter, update);

            await _db.EmergencyPlans.InsertOneAsync(newPlan);
            return Ok(ApiResponse<EmergencyPlanDto>.Ok(MapPlanToDto(newPlan)));
        }
        else
        {
            var updateDefinition = Builders<EmergencyPlan>.Update
                .Set(p => p.UpdatedAt, DateTime.UtcNow);

            if (!string.IsNullOrEmpty(request.PlanName))
                updateDefinition = updateDefinition.Set(p => p.PlanName, request.PlanName);
            if (!string.IsNullOrEmpty(request.Status))
                updateDefinition = updateDefinition.Set(p => p.Status, request.Status);
            if (!string.IsNullOrEmpty(request.ApprovedBy))
                updateDefinition = updateDefinition.Set(p => p.ApprovedBy, request.ApprovedBy);
            if (request.Status == "approved")
                updateDefinition = updateDefinition.Set(p => p.ApprovedAt, DateTime.UtcNow);

            await _db.EmergencyPlans.UpdateOneAsync(p => p.Id == id, updateDefinition);

            var updatedPlan = await _db.EmergencyPlans.Find(p => p.Id == id).FirstOrDefaultAsync();
            return Ok(ApiResponse<EmergencyPlanDto>.Ok(MapPlanToDto(updatedPlan!)));
        }
    }

    [HttpDelete("plans/{id}")]
    [SwaggerOperation(Summary = "删除预案", Description = "删除指定的防汛应急预案")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse>> DeletePlan(string id)
    {
        var plan = await _db.EmergencyPlans.Find(p => p.Id == id).FirstOrDefaultAsync();
        if (plan == null)
            return NotFound(ApiResponse.Fail("NOT_FOUND", "预案不存在"));

        await _db.EmergencyPlans.DeleteOneAsync(p => p.Id == id);

        if (plan.IsCurrent)
        {
            var siblingPlans = await _db.EmergencyPlans
                .Find(p => p.ReservoirId == plan.ReservoirId)
                .SortByDescending(p => p.VersionNumber)
                .ToListAsync();

            if (siblingPlans.Count > 0)
            {
                var latestPlan = siblingPlans.First();
                await _db.EmergencyPlans.UpdateOneAsync(
                    p => p.Id == latestPlan.Id,
                    Builders<EmergencyPlan>.Update.Set(p => p.IsCurrent, true));
            }
        }

        return Ok(ApiResponse.Ok());
    }

    private static bool AreLevelsEqual(List<ResponseLevelConfig> existing, List<ResponseLevelConfigDto> updated)
    {
        if (existing.Count != updated.Count) return false;
        for (int i = 0; i < existing.Count; i++)
        {
            var e = existing[i];
            var u = updated[i];
            if (e.Level != u.Level || e.LevelName != u.LevelName ||
                Math.Abs(e.TriggerWaterLevel - u.TriggerWaterLevel) > 0.001 ||
                e.TriggerFlow != u.TriggerFlow || e.TriggerRainfall != u.TriggerRainfall ||
                e.Color != u.Color || e.Description != u.Description ||
                !e.ResponsibleRoles.SequenceEqual(u.ResponsibleRoles))
                return false;
        }
        return true;
    }

    private static bool AreContactsEqual(List<EmergencyContact> existing, List<EmergencyContactDto> updated)
    {
        if (existing.Count != updated.Count) return false;
        for (int i = 0; i < existing.Count; i++)
        {
            var e = existing[i];
            var u = updated[i];
            if (e.Name != u.Name || e.Role != u.Role || e.Phone != u.Phone || e.Department != u.Department)
                return false;
        }
        return true;
    }

    private static EmergencyPlanDto MapPlanToDto(EmergencyPlan p)
    {
        return new EmergencyPlanDto
        {
            Id = p.Id,
            ReservoirId = p.ReservoirId,
            ReservoirName = p.ReservoirName,
            PlanName = p.PlanName,
            Version = p.Version,
            VersionNumber = p.VersionNumber,
            IsCurrent = p.IsCurrent,
            Status = p.Status,
            ApprovedAt = p.ApprovedAt,
            Description = p.Description,
            UpdatedAt = p.UpdatedAt,
            Levels = p.Levels.Select(l => new ResponseLevelConfigDto
            {
                Level = l.Level,
                LevelName = l.LevelName,
                TriggerWaterLevel = l.TriggerWaterLevel,
                TriggerFlow = l.TriggerFlow,
                TriggerRainfall = l.TriggerRainfall,
                Color = l.Color,
                Description = l.Description,
                Measures = l.Measures.Select(m => new ResponseMeasureDto
                {
                    MeasureId = m.MeasureId,
                    Title = m.Title,
                    Content = m.Content,
                    Category = m.Category,
                    Order = m.Order
                }).OrderBy(m => m.Order).ToList(),
                ResponsibleRoles = l.ResponsibleRoles
            }).ToList(),
            GeneralMeasures = p.GeneralMeasures,
            EmergencyContacts = p.EmergencyContacts.Select(c => new EmergencyContactDto
            {
                Name = c.Name,
                Role = c.Role,
                Phone = c.Phone,
                Department = c.Department
            }).ToList()
        };
    }
}
