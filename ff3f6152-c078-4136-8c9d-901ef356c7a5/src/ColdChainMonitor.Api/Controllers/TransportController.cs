using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ColdChainMonitor.Application.Services;
using ColdChainMonitor.Application.DTOs;
using ColdChainMonitor.Domain.Enums;

namespace ColdChainMonitor.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
[Authorize]
public class TransportController : ControllerBase
{
    private readonly TransportService _transportService;
    private readonly AuditService _auditService;

    public TransportController(TransportService transportService, AuditService auditService)
    {
        _transportService = transportService;
        _auditService = auditService;
    }

    [HttpGet]
    public async Task<ApiResponse<CursorPagedResult<TransportTaskDto>>> GetTasks(
        [FromQuery] TransportStatus? status,
        [FromQuery] string? keyword,
        [FromQuery] string? vehicleId,
        [FromQuery] string? driverId,
        [FromQuery] DateTime? startTime,
        [FromQuery] DateTime? endTime,
        [FromQuery] string? cursor,
        [FromQuery] int limit = 20,
        [FromQuery] bool sortDesc = true)
    {
        var request = new TransportTaskQueryRequest
        {
            Status = status,
            Keyword = keyword,
            VehicleId = vehicleId,
            DriverId = driverId,
            StartTime = startTime,
            EndTime = endTime,
            Cursor = cursor,
            Limit = limit,
            SortDesc = sortDesc
        };

        var result = await _transportService.GetPagedAsync(request);
        return ApiResponse<CursorPagedResult<TransportTaskDto>>.Success(result);
    }

    [HttpGet("{id}")]
    public async Task<ApiResponse<TransportTaskDto>> GetById(string id)
    {
        var task = await _transportService.GetByIdAsync(id);
        if (task == null)
        {
            return ApiResponse<TransportTaskDto>.Error(2001, "运输任务不存在");
        }
        return ApiResponse<TransportTaskDto>.Success(task);
    }

    [HttpGet("taskNo/{taskNo}")]
    public async Task<ApiResponse<TransportTaskDto>> GetByTaskNo(string taskNo)
    {
        var task = await _transportService.GetByTaskNoAsync(taskNo);
        if (task == null)
        {
            return ApiResponse<TransportTaskDto>.Error(2001, "运输任务不存在");
        }
        return ApiResponse<TransportTaskDto>.Success(task);
    }

    [HttpPost]
    [Authorize(Roles = "Dispatcher,Admin")]
    public async Task<ApiResponse<TransportTaskDto>> Create([FromBody] CreateTransportTaskRequest request)
    {
        var operatorId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var operatorName = User.FindFirst("realName")?.Value;

        var task = await _transportService.CreateAsync(request, operatorId!, operatorName!);
        return ApiResponse<TransportTaskDto>.Success(task, "任务创建成功");
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Dispatcher,Admin")]
    public async Task<ApiResponse<TransportTaskDto>> Update(string id, [FromBody] UpdateTransportTaskRequest request)
    {
        var operatorId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var operatorName = User.FindFirst("realName")?.Value;

        var task = await _transportService.UpdateAsync(id, request, operatorId!, operatorName!);
        if (task == null)
        {
            return ApiResponse<TransportTaskDto>.Error(2001, "运输任务不存在");
        }
        return ApiResponse<TransportTaskDto>.Success(task, "任务更新成功");
    }

    [HttpPost("{id}/start")]
    [Authorize(Roles = "Dispatcher,Driver,Admin")]
    public async Task<ApiResponse<TransportTaskDto>> StartTask(string id, [FromBody] TransportTaskStatusRequest request)
    {
        var operatorId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var operatorName = User.FindFirst("realName")?.Value;

        var task = await _transportService.StartTaskAsync(id, operatorId!, operatorName!, request.Remarks);
        if (task == null)
        {
            return ApiResponse<TransportTaskDto>.Error(2001, "运输任务不存在");
        }
        return ApiResponse<TransportTaskDto>.Success(task, "任务已发车");
    }

    [HttpPost("{id}/arrive")]
    [Authorize(Roles = "Driver,Admin")]
    public async Task<ApiResponse<TransportTaskDto>> ArriveTask(string id, [FromBody] TransportTaskStatusRequest request)
    {
        var operatorId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var operatorName = User.FindFirst("realName")?.Value;

        var task = await _transportService.ArriveTaskAsync(id, operatorId!, operatorName!, request.Remarks);
        if (task == null)
        {
            return ApiResponse<TransportTaskDto>.Error(2001, "运输任务不存在");
        }
        return ApiResponse<TransportTaskDto>.Success(task, "任务已到达");
    }

    [HttpPost("{id}/start-quality-check")]
    [Authorize(Roles = "QualityInspector,Admin")]
    public async Task<ApiResponse<TransportTaskDto>> StartQualityCheck(string id, [FromBody] TransportTaskStatusRequest request)
    {
        var operatorId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var operatorName = User.FindFirst("realName")?.Value;

        var task = await _transportService.StartQualityCheckAsync(id, operatorId!, operatorName!, request.Remarks);
        if (task == null)
        {
            return ApiResponse<TransportTaskDto>.Error(2001, "运输任务不存在");
        }
        return ApiResponse<TransportTaskDto>.Success(task, "质检已启动");
    }

    [HttpPost("{id}/complete")]
    [Authorize(Roles = "Dispatcher,Admin")]
    public async Task<ApiResponse<TransportTaskDto>> CompleteTask(string id, [FromBody] TransportTaskStatusRequest request)
    {
        var operatorId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var operatorName = User.FindFirst("realName")?.Value;

        var task = await _transportService.CompleteTaskAsync(id, operatorId!, operatorName!, request.Remarks);
        if (task == null)
        {
            return ApiResponse<TransportTaskDto>.Error(2001, "运输任务不存在");
        }
        return ApiResponse<TransportTaskDto>.Success(task, "任务已完成");
    }

    [HttpPost("{id}/cancel")]
    [Authorize(Roles = "Dispatcher,Admin")]
    public async Task<ApiResponse<TransportTaskDto>> CancelTask(string id, [FromBody] TransportTaskStatusRequest request)
    {
        var operatorId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var operatorName = User.FindFirst("realName")?.Value;

        var task = await _transportService.CancelTaskAsync(id, operatorId!, operatorName!, request.Remarks);
        if (task == null)
        {
            return ApiResponse<TransportTaskDto>.Error(2001, "运输任务不存在");
        }
        return ApiResponse<TransportTaskDto>.Success(task, "任务已取消");
    }

    [HttpPost("{id}/loading")]
    [Authorize(Roles = "Driver,Admin")]
    public async Task<ApiResponse> ConfirmLoading(string id, [FromBody] LoadingOperationRequest request)
    {
        var result = await _transportService.ConfirmLoadingAsync(id, request);
        if (!result)
        {
            return ApiResponse.Error(2002, "装卸货确认失败");
        }
        return ApiResponse.Success("装卸货确认成功");
    }
}
