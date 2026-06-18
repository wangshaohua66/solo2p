using WaterManagement.API.Data;
using WaterManagement.API.DTOs;
using WaterManagement.API.Models;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;
using MongoDB.Driver;

namespace WaterManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
[SwaggerTag("巡检任务管理")]
public class InspectionController : ControllerBase
{
    private readonly IMongoDbContext _db;

    public InspectionController(IMongoDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    [SwaggerOperation(Summary = "获取巡检任务列表", Description = "支持按状态、巡检员、时间范围筛选")]
    [ProducesResponseType(typeof(ApiResponse<List<InspectionTaskDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<InspectionTaskDto>>>> GetList(
        [FromQuery] string? status = null,
        [FromQuery] string? inspectorId = null,
        [FromQuery] string? facilityType = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var filter = Builders<InspectionTask>.Filter.Empty;

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<InspectionStatus>(status, true, out var statusEnum))
            filter &= Builders<InspectionTask>.Filter.Eq(t => t.Status, statusEnum);
        if (!string.IsNullOrEmpty(inspectorId))
            filter &= Builders<InspectionTask>.Filter.Eq(t => t.InspectorId, inspectorId);
        if (!string.IsNullOrEmpty(facilityType))
            filter &= Builders<InspectionTask>.Filter.Eq(t => t.FacilityType, facilityType);
        if (fromDate.HasValue)
            filter &= Builders<InspectionTask>.Filter.Gte(t => t.ScheduledDate, fromDate.Value);
        if (toDate.HasValue)
            filter &= Builders<InspectionTask>.Filter.Lte(t => t.ScheduledDate, toDate.Value);

        var total = await _db.InspectionTasks.CountDocumentsAsync(filter);
        var tasks = await _db.InspectionTasks
            .Find(filter)
            .SortByDescending(t => t.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync();

        var dtos = tasks.Select(MapToListDto).ToList();
        return Ok(ApiResponse<List<InspectionTaskDto>>.Ok(dtos, total));
    }

    [HttpGet("{id}")]
    [SwaggerOperation(Summary = "获取任务详情", Description = "根据ID获取巡检任务详细信息")]
    [ProducesResponseType(typeof(ApiResponse<InspectionTaskDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<InspectionTaskDetailDto>>> GetById(string id)
    {
        var task = await _db.InspectionTasks.Find(t => t.Id == id).FirstOrDefaultAsync();
        if (task == null)
            return NotFound(ApiResponse.Fail("NOT_FOUND", "任务不存在"));

        return Ok(ApiResponse<InspectionTaskDetailDto>.Ok(MapToDetailDto(task)));
    }

    [HttpPost]
    [SwaggerOperation(Summary = "创建巡检任务", Description = "手动创建单个巡检任务")]
    [ProducesResponseType(typeof(ApiResponse<InspectionTaskDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<InspectionTaskDto>>> Create([FromBody] InspectionTaskDto dto)
    {
        if (string.IsNullOrEmpty(dto.Title))
            return BadRequest(ApiResponse.Fail("VALIDATION_ERROR", "任务标题不能为空",
                new Dictionary<string, string> { ["title"] = "任务标题不能为空" }));

        var now = DateTime.UtcNow;
        var task = new InspectionTask
        {
            TaskCode = $"IT{now:yyyyMMdd}{Random.Shared.Next(1000, 9999)}",
            Title = dto.Title,
            FacilityType = dto.FacilityType,
            FacilityName = dto.FacilityName,
            InspectorId = dto.InspectorId,
            InspectorName = dto.InspectorName,
            Route = new List<string>(),
            Status = InspectionStatus.Pending,
            ScheduledDate = dto.ScheduledDate == default ? now : dto.ScheduledDate,
            CreatedAt = now,
            UpdatedAt = now
        };

        await _db.InspectionTasks.InsertOneAsync(task);
        return Ok(ApiResponse<InspectionTaskDto>.Ok(MapToListDto(task)));
    }

    [HttpPost("generate-plan")]
    [SwaggerOperation(Summary = "生成月度巡检计划", Description = "自动生成指定月份的巡检任务并分配")]
    [ProducesResponseType(typeof(ApiResponse<int>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<int>>> GeneratePlan([FromBody] InspectionPlanGenerateDto dto)
    {
        if (string.IsNullOrEmpty(dto.Month))
            return BadRequest(ApiResponse.Fail("VALIDATION_ERROR", "月份不能为空",
                new Dictionary<string, string> { ["month"] = "月份不能为空" }));

        var inspectors = await _db.Contacts
            .Find(c => c.Role == ContactRole.Inspector)
            .ToListAsync();

        if (inspectors.Count == 0)
            return BadRequest(ApiResponse.Fail("NO_INSPECTORS", "没有可用的巡检员"));

        var facilities = new[] { "主坝", "副坝", "溢洪道", "输水洞", "发电厂房", "观测设施", "管理房", "交通桥" };
        var types = new[] { "大坝", "溢洪道", "输水建筑物", "附属设施" };
        var reservoirs = await _db.Reservoirs.Find(_ => true).ToListAsync();

        var tasks = new List<InspectionTask>();
        var now = DateTime.UtcNow;
        int inspectorIndex = 0;

        foreach (var res in reservoirs)
        {
            for (int i = 0; i < facilities.Length; i++)
            {
                var inspector = inspectors[inspectorIndex % inspectors.Count];
                inspectorIndex++;

                var scheduledDate = ParseMonth(dto.Month).AddDays(Random.Shared.Next(0, 28));

                var task = new InspectionTask
                {
                    TaskCode = $"IT{dto.Month.Replace("-", "")}{Random.Shared.Next(1000, 9999)}",
                    PlanMonth = dto.Month,
                    Title = $"{res.Name} - {facilities[i]}巡检",
                    FacilityType = types[i % types.Length],
                    FacilityName = facilities[i],
                    InspectorId = inspector.Id,
                    InspectorName = inspector.Name,
                    Route = new List<string> { "起点", facilities[i], "终点" },
                    Status = InspectionStatus.Pending,
                    ScheduledDate = scheduledDate,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                tasks.Add(task);
            }
        }

        if (tasks.Count > 0)
            await _db.InspectionTasks.InsertManyAsync(tasks);

        return Ok(ApiResponse<int>.Ok(tasks.Count));
    }

    [HttpPost("{taskId}/defects")]
    [SwaggerOperation(Summary = "上报缺陷", Description = "巡检员在任务中上报发现的缺陷")]
    [ProducesResponseType(typeof(ApiResponse<DefectDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<DefectDto>>> AddDefect(
        string taskId, [FromBody] DefectReportDto dto)
    {
        var task = await _db.InspectionTasks.Find(t => t.Id == taskId).FirstOrDefaultAsync();
        if (task == null)
            return NotFound(ApiResponse.Fail("NOT_FOUND", "任务不存在"));

        var errors = new Dictionary<string, string>();
        if (string.IsNullOrEmpty(dto.PartName))
            errors["partName"] = "工程部位不能为空";
        if (string.IsNullOrEmpty(dto.Description))
            errors["description"] = "缺陷描述不能为空";
        if (errors.Count > 0)
            return BadRequest(ApiResponse.Fail("VALIDATION_ERROR", "参数验证失败", errors));

        var defect = new Defect
        {
            PartName = dto.PartName,
            Description = dto.Description,
            Severity = dto.Severity,
            Location = dto.Location,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            Photos = dto.Photos ?? new List<string>(),
            ReporterName = dto.ReporterName ?? task.InspectorName,
            ReportTime = DateTime.UtcNow,
            Status = DefectStatus.Reported
        };

        task.Defects.Add(defect);
        task.Status = InspectionStatus.HasDefect;
        task.UpdatedAt = DateTime.UtcNow;

        if (!task.StartTime.HasValue)
            task.StartTime = DateTime.UtcNow;

        await _db.InspectionTasks.ReplaceOneAsync(t => t.Id == taskId, task);

        var defectDto = MapDefectToDto(defect);
        return Ok(ApiResponse<DefectDto>.Ok(defectDto));
    }

    [HttpPut("{taskId}/defects/{defectId}/resolve")]
    [SwaggerOperation(Summary = "处理缺陷", Description = "标记缺陷为已处理")]
    [ProducesResponseType(typeof(ApiResponse<DefectDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<DefectDto>>> ResolveDefect(
        string taskId, string defectId, [FromBody] DefectResolveDto dto)
    {
        var task = await _db.InspectionTasks.Find(t => t.Id == taskId).FirstOrDefaultAsync();
        if (task == null)
            return NotFound(ApiResponse.Fail("NOT_FOUND", "任务不存在"));

        var defect = task.Defects.FirstOrDefault(d => d.DefectId == defectId);
        if (defect == null)
            return NotFound(ApiResponse.Fail("NOT_FOUND", "缺陷不存在"));

        defect.Status = DefectStatus.Resolved;
        defect.ResolveTime = DateTime.UtcNow;
        defect.ResolveRemark = dto.ResolveRemark;

        var allResolved = task.Defects.All(d => d.Status == DefectStatus.Resolved || d.Status == DefectStatus.Closed);
        if (allResolved && task.Status == InspectionStatus.HasDefect)
            task.Status = InspectionStatus.Completed;

        task.UpdatedAt = DateTime.UtcNow;
        await _db.InspectionTasks.ReplaceOneAsync(t => t.Id == taskId, task);

        return Ok(ApiResponse<DefectDto>.Ok(MapDefectToDto(defect)));
    }

    [HttpPut("{taskId}/complete")]
    [SwaggerOperation(Summary = "完成任务", Description = "标记巡检任务为已完成")]
    [ProducesResponseType(typeof(ApiResponse<InspectionTaskDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<InspectionTaskDto>>> CompleteTask(string taskId)
    {
        var task = await _db.InspectionTasks.Find(t => t.Id == taskId).FirstOrDefaultAsync();
        if (task == null)
            return NotFound(ApiResponse.Fail("NOT_FOUND", "任务不存在"));

        if (task.Status == InspectionStatus.HasDefect)
            return BadRequest(ApiResponse.Fail("HAS_DEFECT", "存在未处理的缺陷，不能完成任务"));

        task.Status = InspectionStatus.Completed;
        task.EndTime = DateTime.UtcNow;
        task.UpdatedAt = DateTime.UtcNow;

        await _db.InspectionTasks.ReplaceOneAsync(t => t.Id == taskId, task);
        return Ok(ApiResponse<InspectionTaskDto>.Ok(MapToListDto(task)));
    }

    [HttpGet("stats")]
    [SwaggerOperation(Summary = "巡检统计", Description = "返回任务数量、缺陷分布等统计数据")]
    [ProducesResponseType(typeof(ApiResponse<InspectionStatsDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<InspectionStatsDto>>> GetStats(
        [FromQuery] string? severity = null,
        [FromQuery] string? defectStatus = null)
    {
        var tasks = await _db.InspectionTasks.Find(_ => true).ToListAsync();
        var allDefects = tasks.SelectMany(t => t.Defects).ToList();

        var filteredDefects = allDefects;
        if (!string.IsNullOrEmpty(severity) && Enum.TryParse<DefectSeverity>(severity, true, out var sev))
            filteredDefects = filteredDefects.Where(d => d.Severity == sev).ToList();
        if (!string.IsNullOrEmpty(defectStatus) && Enum.TryParse<DefectStatus>(defectStatus, true, out var ds))
            filteredDefects = filteredDefects.Where(d => d.Status == ds).ToList();

        var bySeverity = new Dictionary<string, int>
        {
            ["一般"] = filteredDefects.Count(d => d.Severity == DefectSeverity.Minor),
            ["较重"] = filteredDefects.Count(d => d.Severity == DefectSeverity.Major),
            ["严重"] = filteredDefects.Count(d => d.Severity == DefectSeverity.Critical)
        };

        var byPart = filteredDefects
            .GroupBy(d => d.PartName)
            .Select(g => new DefectPartStat { Part = g.Key, Count = g.Count() })
            .OrderByDescending(p => p.Count)
            .Take(10)
            .ToList();

        var stats = new InspectionStatsDto
        {
            TotalTasks = tasks.Count,
            PendingTasks = tasks.Count(t => t.Status == InspectionStatus.Pending),
            InProgressTasks = tasks.Count(t => t.Status == InspectionStatus.InProgress),
            CompletedTasks = tasks.Count(t => t.Status == InspectionStatus.Completed),
            HasDefectTasks = tasks.Count(t => t.Status == InspectionStatus.HasDefect),
            TotalDefects = allDefects.Count,
            ResolvedDefects = allDefects.Count(d => d.Status == DefectStatus.Resolved || d.Status == DefectStatus.Closed),
            DefectsBySeverity = bySeverity,
            DefectsByPart = byPart
        };

        return Ok(ApiResponse<InspectionStatsDto>.Ok(stats));
    }

    private static DateTime ParseMonth(string month)
    {
        if (DateTime.TryParse(month + "-01", out var dt))
            return dt;
        return DateTime.UtcNow;
    }

    private static InspectionTaskDto MapToListDto(InspectionTask t)
    {
        return new InspectionTaskDto
        {
            Id = t.Id,
            TaskCode = t.TaskCode,
            PlanId = t.PlanId,
            PlanMonth = t.PlanMonth,
            Title = t.Title,
            FacilityType = t.FacilityType,
            FacilityName = t.FacilityName,
            InspectorId = t.InspectorId,
            InspectorName = t.InspectorName,
            Status = t.Status,
            StatusName = GetStatusName(t.Status),
            ScheduledDate = t.ScheduledDate,
            StartTime = t.StartTime,
            EndTime = t.EndTime,
            DefectCount = t.Defects.Count,
            CreatedAt = t.CreatedAt
        };
    }

    private static InspectionTaskDetailDto MapToDetailDto(InspectionTask t)
    {
        return new InspectionTaskDetailDto
        {
            Id = t.Id,
            TaskCode = t.TaskCode,
            PlanId = t.PlanId,
            PlanMonth = t.PlanMonth,
            Title = t.Title,
            FacilityType = t.FacilityType,
            FacilityName = t.FacilityName,
            InspectorId = t.InspectorId,
            InspectorName = t.InspectorName,
            Status = t.Status,
            StatusName = GetStatusName(t.Status),
            ScheduledDate = t.ScheduledDate,
            StartTime = t.StartTime,
            EndTime = t.EndTime,
            DefectCount = t.Defects.Count,
            CreatedAt = t.CreatedAt,
            Route = t.Route,
            Defects = t.Defects.Select(MapDefectToDto).ToList(),
            Remark = t.Remark
        };
    }

    private static DefectDto MapDefectToDto(Defect d)
    {
        return new DefectDto
        {
            DefectId = d.DefectId,
            PartName = d.PartName,
            Description = d.Description,
            Severity = d.Severity,
            SeverityName = GetSeverityName(d.Severity),
            Status = d.Status,
            StatusName = GetDefectStatusName(d.Status),
            Location = d.Location,
            Latitude = d.Latitude,
            Longitude = d.Longitude,
            Photos = d.Photos,
            ReporterName = d.ReporterName,
            ReportTime = d.ReportTime,
            ResolveTime = d.ResolveTime,
            ResolveRemark = d.ResolveRemark
        };
    }

    private static string GetStatusName(InspectionStatus status) => status switch
    {
        InspectionStatus.Pending => "待执行",
        InspectionStatus.InProgress => "进行中",
        InspectionStatus.Completed => "已完成",
        InspectionStatus.HasDefect => "有缺陷",
        InspectionStatus.Closed => "已关闭",
        _ => "未知"
    };

    private static string GetSeverityName(DefectSeverity severity) => severity switch
    {
        DefectSeverity.Minor => "一般",
        DefectSeverity.Major => "较重",
        DefectSeverity.Critical => "严重",
        _ => "未知"
    };

    private static string GetDefectStatusName(DefectStatus status) => status switch
    {
        DefectStatus.Reported => "已上报",
        DefectStatus.Confirmed => "已确认",
        DefectStatus.InProgress => "处理中",
        DefectStatus.Resolved => "已解决",
        DefectStatus.Closed => "已关闭",
        _ => "未知"
    };
}
