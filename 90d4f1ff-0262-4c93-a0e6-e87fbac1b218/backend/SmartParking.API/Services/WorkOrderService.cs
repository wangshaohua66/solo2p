using AutoMapper;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using SmartParking.API.Common;
using SmartParking.API.Data;
using SmartParking.API.Hubs;
using SmartParking.API.Models.DTOs;
using SmartParking.API.Models.Entities;
using SmartParking.API.Services.Interfaces;

namespace SmartParking.API.Services;

public class WorkOrderService : IWorkOrderService
{
    private readonly AppDbContext _db;
    private readonly IMapper _mapper;
    private readonly IHubContext<NotificationHub> _hub;
    private readonly ILogger<WorkOrderService> _logger;

    public WorkOrderService(
        AppDbContext db,
        IMapper mapper,
        IHubContext<NotificationHub> hub,
        ILogger<WorkOrderService> logger)
    {
        _db = db;
        _mapper = mapper;
        _hub = hub;
        _logger = logger;
    }

    public async Task<ApiResponse<PagedResult<WorkOrderDto>>> GetWorkOrdersAsync(PagedQuery query, string? status, string? assigneeId)
    {
        var q = _db.WorkOrders.AsNoTracking().AsQueryable();

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<WorkOrderStatus>(status, out var s))
            q = q.Where(w => w.Status == s);
        if (!string.IsNullOrEmpty(assigneeId))
            q = q.Where(w => w.AssigneeId == assigneeId);
        if (!string.IsNullOrEmpty(query.Keyword))
            q = q.Where(w => w.Title.Contains(query.Keyword)
                || (w.Description != null && w.Description.Contains(query.Keyword))
                || (w.PlateNumber != null && w.PlateNumber.Contains(query.Keyword)));

        q = query.SortDirection == SortDirection.Ascending
            ? q.OrderBy(w => w.CreatedAt)
            : q.OrderByDescending(w => w.CreatedAt);

        var total = await q.CountAsync();
        var items = await q
            .Skip((query.PageIndex - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return ApiResponse<PagedResult<WorkOrderDto>>.Success(
            PagedResult<WorkOrderDto>.Create(_mapper.Map<List<WorkOrderDto>>(items), total, query.PageIndex, query.PageSize));
    }

    public async Task<ApiResponse<WorkOrderDto>> CreateWorkOrderAsync(CreateWorkOrderRequest request, string reporterId)
    {
        try
        {
            var workOrder = _mapper.Map<WorkOrder>(request);
            workOrder.OrderNo = $"WO{DateTime.Now:yyyyMMddHHmmss}{Random.Shared.Next(1000, 9999)}";
            workOrder.ReporterId = reporterId;
            workOrder.Status = WorkOrderStatus.Pending;

            _db.WorkOrders.Add(workOrder);
            await _db.SaveChangesAsync();

            _logger.LogInformation("创建工单 {OrderNo}，类型 {Type}", workOrder.OrderNo, workOrder.Type);
            return ApiResponse<WorkOrderDto>.Success(_mapper.Map<WorkOrderDto>(workOrder));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "创建工单失败");
            return ApiResponse<WorkOrderDto>.Error("创建失败");
        }
    }

    public async Task<ApiResponse<WorkOrderDto>> AssignWorkOrderAsync(string orderId, string assigneeId)
    {
        var workOrder = await _db.WorkOrders.FindAsync(orderId);
        if (workOrder == null) return ApiResponse<WorkOrderDto>.Error("工单不存在", 404);

        workOrder.AssigneeId = assigneeId;
        workOrder.Status = WorkOrderStatus.Assigned;
        workOrder.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await _hub.PushWorkOrderAssigned(assigneeId, orderId);
        _logger.LogInformation("工单 {OrderNo} 已指派给 {AssigneeId}", orderId, assigneeId);

        return ApiResponse<WorkOrderDto>.Success(_mapper.Map<WorkOrderDto>(workOrder));
    }

    public async Task<ApiResponse<WorkOrderDto>> UpdateStatusAsync(string orderId, WorkOrderStatus status)
    {
        var workOrder = await _db.WorkOrders.FindAsync(orderId);
        if (workOrder == null) return ApiResponse<WorkOrderDto>.Error("工单不存在", 404);

        workOrder.Status = status;
        workOrder.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return ApiResponse<WorkOrderDto>.Success(_mapper.Map<WorkOrderDto>(workOrder));
    }

    public async Task<ApiResponse<WorkOrderDto>> GetByIdAsync(string orderId)
    {
        var workOrder = await _db.WorkOrders.FindAsync(orderId);
        if (workOrder == null) return ApiResponse<WorkOrderDto>.Error("工单不存在", 404);
        return ApiResponse<WorkOrderDto>.Success(_mapper.Map<WorkOrderDto>(workOrder));
    }
}
