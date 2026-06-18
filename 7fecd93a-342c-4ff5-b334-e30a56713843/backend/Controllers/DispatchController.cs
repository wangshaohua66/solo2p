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
[SwaggerTag("闸门调度管理")]
public class DispatchController : ControllerBase
{
    private readonly IMongoDbContext _db;
    private readonly INotificationService _notificationService;

    public DispatchController(IMongoDbContext db, INotificationService notificationService)
    {
        _db = db;
        _notificationService = notificationService;
    }

    [HttpGet("gates")]
    [SwaggerOperation(Summary = "获取闸门列表", Description = "返回所有闸门信息")]
    [ProducesResponseType(typeof(ApiResponse<List<Gate>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<Gate>>>> GetGates(
        [FromQuery] string? reservoirId = null)
    {
        var filter = Builders<Gate>.Filter.Empty;
        if (!string.IsNullOrEmpty(reservoirId))
            filter &= Builders<Gate>.Filter.Eq(g => g.ReservoirId, reservoirId);

        var gates = await _db.Gates.Find(filter).ToListAsync();
        return Ok(ApiResponse<List<Gate>>.Ok(gates));
    }

    [HttpGet("receivers")]
    [SwaggerOperation(Summary = "获取指令接收人", Description = "返回可接收调度指令的人员列表")]
    [ProducesResponseType(typeof(ApiResponse<List<ContactDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<ContactDto>>>> GetReceivers()
    {
        var contacts = await _db.Contacts
            .Find(c => c.Role == ContactRole.Maintenance || c.Role == ContactRole.Inspector)
            .SortBy(c => c.SortOrder)
            .ToListAsync();

        var dtos = contacts.Select(c => new ContactDto
        {
            Id = c.Id,
            Name = c.Name,
            Role = c.Role,
            RoleName = c.RoleName,
            Phone = c.Phone,
            Department = c.Department,
            Position = c.Position,
            IsOnDuty = c.IsOnDuty
        }).ToList();

        return Ok(ApiResponse<List<ContactDto>>.Ok(dtos));
    }

    [HttpGet]
    [SwaggerOperation(Summary = "获取调度指令列表", Description = "支持按状态、闸门、时间范围筛选")]
    [ProducesResponseType(typeof(ApiResponse<List<DispatchOrderDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<DispatchOrderDto>>>> GetList(
        [FromQuery] string? status = null,
        [FromQuery] string? reservoirId = null,
        [FromQuery] string? receiverId = null,
        [FromQuery] DateTime? fromTime = null,
        [FromQuery] DateTime? toTime = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var filter = Builders<DispatchOrder>.Filter.Empty;

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<DispatchStatus>(status, true, out var statusEnum))
            filter &= Builders<DispatchOrder>.Filter.Eq(o => o.Status, statusEnum);
        if (!string.IsNullOrEmpty(reservoirId))
            filter &= Builders<DispatchOrder>.Filter.Eq(o => o.ReservoirId, reservoirId);
        if (!string.IsNullOrEmpty(receiverId))
            filter &= Builders<DispatchOrder>.Filter.Eq(o => o.ReceiverId, receiverId);
        if (fromTime.HasValue)
            filter &= Builders<DispatchOrder>.Filter.Gte(o => o.CreatedAt, fromTime.Value);
        if (toTime.HasValue)
            filter &= Builders<DispatchOrder>.Filter.Lte(o => o.CreatedAt, toTime.Value);

        var total = await _db.DispatchOrders.CountDocumentsAsync(filter);
        var orders = await _db.DispatchOrders
            .Find(filter)
            .SortByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync();

        var dtos = orders.Select(MapToDto).ToList();
        return Ok(ApiResponse<List<DispatchOrderDto>>.Ok(dtos, total));
    }

    [HttpGet("{id}")]
    [SwaggerOperation(Summary = "获取指令详情", Description = "根据ID获取调度指令详细信息")]
    [ProducesResponseType(typeof(ApiResponse<DispatchOrderDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<DispatchOrderDto>>> GetById(string id)
    {
        var order = await _db.DispatchOrders.Find(o => o.Id == id).FirstOrDefaultAsync();
        if (order == null)
            return NotFound(ApiResponse.Fail("NOT_FOUND", "指令不存在"));

        return Ok(ApiResponse<DispatchOrderDto>.Ok(MapToDto(order)));
    }

    [HttpPost]
    [SwaggerOperation(Summary = "创建调度指令", Description = "调度员下发新的闸门调度指令")]
    [ProducesResponseType(typeof(ApiResponse<DispatchOrderDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<DispatchOrderDto>>> Create([FromBody] DispatchOrderCreateDto dto)
    {
        var errors = new Dictionary<string, string>();

        if (string.IsNullOrEmpty(dto.GateId))
            errors["gateId"] = "请选择闸门";
        if (string.IsNullOrEmpty(dto.ReceiverId))
            errors["receiverId"] = "请选择接收人";
        if (dto.TargetOpening <= 0)
            errors["targetOpening"] = "开度必须大于0";

        if (errors.Count > 0)
            return BadRequest(ApiResponse.Fail("VALIDATION_ERROR", "参数验证失败", errors));

        var gate = await _db.Gates.Find(g => g.Id == dto.GateId).FirstOrDefaultAsync();
        if (gate == null)
            return NotFound(ApiResponse.Fail("NOT_FOUND", "闸门不存在"));

        if (dto.TargetOpening > gate.MaxOpening)
            return BadRequest(ApiResponse.Fail("VALIDATION_ERROR", $"开度超过闸门最大值({gate.MaxOpening})",
                new Dictionary<string, string> { ["targetOpening"] = $"开度超过闸门最大值({gate.MaxOpening})" }));

        var receiver = await _db.Contacts.Find(c => c.Id == dto.ReceiverId).FirstOrDefaultAsync();
        if (receiver == null)
            return NotFound(ApiResponse.Fail("NOT_FOUND", "接收人不存在"));

        var now = DateTime.UtcNow;
        var count = await _db.DispatchOrders.CountDocumentsAsync(_ => true);
        var orderCode = $"DD{now:yyyyMMdd}{(int)count + 1 + 100}";

        var order = new DispatchOrder
        {
            OrderCode = orderCode,
            GateId = gate.Id,
            GateName = gate.Name,
            ReservoirId = gate.ReservoirId,
            ReservoirName = gate.ReservoirName,
            TargetOpening = dto.TargetOpening,
            Status = DispatchStatus.Pending,
            Priority = dto.Priority,
            Reason = dto.Reason,
            Instructions = dto.Instructions,
            SenderName = dto.SenderName ?? "调度员",
            ReceiverId = receiver.Id,
            ReceiverName = receiver.Name,
            ConfirmDeadline = now.AddMinutes(dto.ConfirmDeadlineMinutes),
            CreatedAt = now,
            UpdatedAt = now
        };

        order.TraceLogs.Add(new DispatchTraceLog
        {
            Timestamp = now,
            Status = DispatchStatus.Pending,
            OperatorName = dto.SenderName ?? "调度员",
            Remark = "指令创建"
        });

        await _db.DispatchOrders.InsertOneAsync(order);

        await SendDispatchNotification(order, "新调度指令");
        order.Status = DispatchStatus.Sent;
        order.SendTime = now;
        order.TraceLogs.Add(new DispatchTraceLog
        {
            Timestamp = now,
            Status = DispatchStatus.Sent,
            OperatorName = "系统",
            Remark = "指令已发送通知"
        });
        await _db.DispatchOrders.ReplaceOneAsync(o => o.Id == order.Id, order);

        return Ok(ApiResponse<DispatchOrderDto>.Ok(MapToDto(order)));
    }

    [HttpPut("{id}/confirm")]
    [SwaggerOperation(Summary = "确认并回填指令", Description = "接收人确认执行情况并回填实际开度")]
    [ProducesResponseType(typeof(ApiResponse<DispatchOrderDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<DispatchOrderDto>>> Confirm(
        string id, [FromBody] DispatchOrderConfirmDto dto)
    {
        var order = await _db.DispatchOrders.Find(o => o.Id == id).FirstOrDefaultAsync();
        if (order == null)
            return NotFound(ApiResponse.Fail("NOT_FOUND", "指令不存在"));

        if (order.Status == DispatchStatus.Confirmed || order.Status == DispatchStatus.Closed)
            return BadRequest(ApiResponse.Fail("INVALID_STATUS", "指令已确认，无法重复确认"));

        var now = DateTime.UtcNow;
        order.ActualOpening = dto.ActualOpening;
        order.ConfirmTime = now;
        order.Status = DispatchStatus.Confirmed;
        order.UpdatedAt = now;

        order.TraceLogs.Add(new DispatchTraceLog
        {
            Timestamp = now,
            Status = DispatchStatus.Confirmed,
            OperatorName = dto.OperatorName ?? order.ReceiverName,
            Remark = dto.Remark ?? "已确认执行"
        });

        await _db.DispatchOrders.ReplaceOneAsync(o => o.Id == id, order);
        return Ok(ApiResponse<DispatchOrderDto>.Ok(MapToDto(order)));
    }

    [HttpPut("{id}/close")]
    [SwaggerOperation(Summary = "关闭指令", Description = "管理员关闭已完成的调度指令")]
    [ProducesResponseType(typeof(ApiResponse<DispatchOrderDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<DispatchOrderDto>>> Close(
        string id, [FromBody] DispatchOrderCloseDto dto)
    {
        var order = await _db.DispatchOrders.Find(o => o.Id == id).FirstOrDefaultAsync();
        if (order == null)
            return NotFound(ApiResponse.Fail("NOT_FOUND", "指令不存在"));

        var now = DateTime.UtcNow;
        order.Status = DispatchStatus.Closed;
        order.CloseTime = now;
        order.UpdatedAt = now;

        order.TraceLogs.Add(new DispatchTraceLog
        {
            Timestamp = now,
            Status = DispatchStatus.Closed,
            OperatorName = dto.OperatorName ?? "管理员",
            Remark = dto.Remark ?? "指令关闭"
        });

        await _db.DispatchOrders.ReplaceOneAsync(o => o.Id == id, order);
        return Ok(ApiResponse<DispatchOrderDto>.Ok(MapToDto(order)));
    }

    [HttpGet("{id}/trace")]
    [SwaggerOperation(Summary = "获取指令全流程追溯", Description = "返回指令的所有状态变更记录")]
    [ProducesResponseType(typeof(ApiResponse<List<DispatchTraceDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<DispatchTraceDto>>>> GetTrace(string id)
    {
        var order = await _db.DispatchOrders.Find(o => o.Id == id).FirstOrDefaultAsync();
        if (order == null)
            return NotFound(ApiResponse.Fail("NOT_FOUND", "指令不存在"));

        var traces = order.TraceLogs.Select(t => new DispatchTraceDto
        {
            Timestamp = t.Timestamp,
            Status = t.Status,
            StatusName = GetStatusName(t.Status),
            OperatorName = t.OperatorName,
            Remark = t.Remark
        }).ToList();

        return Ok(ApiResponse<List<DispatchTraceDto>>.Ok(traces));
    }

    [HttpGet("stats")]
    [SwaggerOperation(Summary = "调度操作统计", Description = "返回指令状态分布、闸门操作次数等统计数据")]
    [ProducesResponseType(typeof(ApiResponse<DispatchStatsDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<DispatchStatsDto>>> GetStats()
    {
        var allOrders = await _db.DispatchOrders.Find(_ => true).ToListAsync();
        var byGate = allOrders
            .GroupBy(o => o.GateName)
            .Select(g => new DispatchGateStat
            {
                Gate = g.Key,
                Count = g.Count(),
                Confirmed = g.Count(o => o.Status == DispatchStatus.Confirmed || o.Status == DispatchStatus.Closed)
            })
            .OrderByDescending(g => g.Count)
            .Take(10)
            .ToList();

        int confirmed = allOrders.Count(o => o.Status == DispatchStatus.Confirmed || o.Status == DispatchStatus.Closed);
        int total = allOrders.Count;

        var avgConfirmMinutes = allOrders
            .Where(o => o.ConfirmTime.HasValue && o.SendTime.HasValue)
            .Select(o => (o.ConfirmTime!.Value - o.SendTime!.Value).TotalMinutes)
            .DefaultIfEmpty(0)
            .Average();

        var stats = new DispatchStatsDto
        {
            TotalOrders = total,
            PendingOrders = allOrders.Count(o => o.Status == DispatchStatus.Pending || o.Status == DispatchStatus.Sent || o.Status == DispatchStatus.Delivered),
            ConfirmedOrders = confirmed,
            OverdueOrders = allOrders.Count(o => o.Status == DispatchStatus.Overdue),
            ClosedOrders = allOrders.Count(o => o.Status == DispatchStatus.Closed),
            ConfirmRate = total > 0 ? Math.Round((double)confirmed / total * 100, 1) : 0,
            AvgConfirmMinutes = Math.Round(avgConfirmMinutes, 1),
            ByGate = byGate
        };

        return Ok(ApiResponse<DispatchStatsDto>.Ok(stats));
    }

    private async Task SendDispatchNotification(DispatchOrder order, string title)
    {
        try
        {
            var request = new NotifyRequestDto
            {
                ContactIds = new List<string> { order.ReceiverId },
                Title = title,
                Message = $"{order.OrderCode}: {order.GateName} 开度 {order.TargetOpening}m - {order.Instructions}",
                Channel = NotificationChannel.AppPush,
                SenderName = order.SenderName,
                RelatedType = "dispatch",
                RelatedId = order.Id
            };
            await _notificationService.SendBatchNotificationAsync(request);
        }
        catch
        {
        }
    }

    private static DispatchOrderDto MapToDto(DispatchOrder o)
    {
        var remaining = (int)(o.ConfirmDeadline - DateTime.UtcNow).TotalSeconds;
        return new DispatchOrderDto
        {
            Id = o.Id,
            OrderCode = o.OrderCode,
            GateId = o.GateId,
            GateName = o.GateName,
            ReservoirId = o.ReservoirId,
            ReservoirName = o.ReservoirName,
            TargetOpening = o.TargetOpening,
            ActualOpening = o.ActualOpening,
            Status = o.Status,
            StatusName = GetStatusName(o.Status),
            Priority = o.Priority,
            Reason = o.Reason,
            Instructions = o.Instructions,
            SenderName = o.SenderName,
            ReceiverId = o.ReceiverId,
            ReceiverName = o.ReceiverName,
            ConfirmDeadline = o.ConfirmDeadline,
            SendTime = o.SendTime,
            DeliverTime = o.DeliverTime,
            ConfirmTime = o.ConfirmTime,
            CloseTime = o.CloseTime,
            CreatedAt = o.CreatedAt,
            RemainingSeconds = Math.Max(0, remaining)
        };
    }

    private static string GetStatusName(DispatchStatus status) => status switch
    {
        DispatchStatus.Pending => "待发送",
        DispatchStatus.Sent => "已发送",
        DispatchStatus.Delivered => "已送达",
        DispatchStatus.Confirmed => "已确认",
        DispatchStatus.Closed => "已关闭",
        DispatchStatus.Overdue => "已超期",
        DispatchStatus.Cancelled => "已取消",
        _ => "未知"
    };
}
