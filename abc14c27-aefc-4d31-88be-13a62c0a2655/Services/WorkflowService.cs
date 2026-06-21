using System.Text.Json;
using AutoMapper;
using AutoMapper.QueryableExtensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using UsedVehicleTransaction.Common;
using UsedVehicleTransaction.Data;
using UsedVehicleTransaction.DTOs;
using UsedVehicleTransaction.Enums;
using UsedVehicleTransaction.Models;

namespace UsedVehicleTransaction.Services;

public class WorkflowService : IWorkflowService
{
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly IMemoryCache _cache;
    private readonly ILogger<WorkflowService> _logger;

    public WorkflowService(
        ApplicationDbContext context,
        IMapper mapper,
        IMemoryCache cache,
        ILogger<WorkflowService> logger)
    {
        _context = context;
        _mapper = mapper;
        _cache = cache;
        _logger = logger;
    }

    private static readonly List<(WorkflowNodeType Type, string Name, string NameEn, int TimeLimit, bool IsParallel, string[] Prerequisites)> WorkflowDefinition = new()
    {
        (WorkflowNodeType.EnvironmentalReview, "环保审核", "Environmental Review", 30, false, new[] { "TransactionCreated" }),
        (WorkflowNodeType.SafetyInspection, "安检证明核验", "Safety Inspection Verification", 45, false, new[] { "EnvironmentalReview" }),
        (WorkflowNodeType.TaxCalculation, "税费核算", "Tax Calculation", 20, true, new[] { "EnvironmentalReview" }),
        (WorkflowNodeType.RegistrationAcceptance, "登记受理", "Registration Acceptance", 60, false, new[] { "SafetyInspection", "TaxCalculation" }),
        (WorkflowNodeType.DrivingLicenseChange, "行驶证变更", "Driving License Change", 30, false, new[] { "RegistrationAcceptance" }),
        (WorkflowNodeType.PlateIssuance, "号牌发放", "Plate Issuance", 20, false, new[] { "DrivingLicenseChange" }),
        (WorkflowNodeType.ArchiveStorage, "档案归档", "Archive Storage", 20, true, new[] { "RegistrationAcceptance" }),
        (WorkflowNodeType.Notification, "办结通知", "Completion Notification", 10, false, new[] { "PlateIssuance", "ArchiveStorage" })
    };

    public async Task<ApiResponse<WorkflowInstanceDto>> StartWorkflowAsync(WorkflowStartDto dto, long operatorId)
    {
        _logger.LogInformation("Starting workflow for TransactionId: {TransactionId}", dto.TransactionId);

        var transaction = await _context.VehicleTransactions.FindAsync(dto.TransactionId);
        if (transaction == null)
        {
            return ApiResponse<WorkflowInstanceDto>.Fail(ErrorCodes.TransactionNotFound.Code, ErrorCodes.TransactionNotFound.MessageZh, ErrorCodes.TransactionNotFound.MessageEn);
        }

        if (transaction.Status == TransactionStatus.Completed)
        {
            return ApiResponse<WorkflowInstanceDto>.Fail(ErrorCodes.TransactionInvalidStatus.Code, "该交易已完成，无需重复发起流程", "Transaction already completed");
        }

        var activeInstance = await _context.WorkflowInstances
            .Include(w => w.NodeExecutions)
            .FirstOrDefaultAsync(w => w.TransactionId == dto.TransactionId &&
                w.Status != WorkflowNodeStatus.Completed &&
                w.Status != WorkflowNodeStatus.Failed);

        if (activeInstance != null)
        {
            return ApiResponse<WorkflowInstanceDto>.Fail(ErrorCodes.BadRequest.Code, "该交易已存在进行中的过户流程", "An active workflow already exists for this transaction");
        }

        using var txn = await _context.Database.BeginTransactionAsync();
        try
        {
            var instanceNo = $"WF{DateTime.Now:yyyyMMddHHmmss}{Random.Shared.Next(1000, 9999)}";
            var now = DateTime.UtcNow;

            var instance = new WorkflowInstance
            {
                TransactionId = dto.TransactionId,
                InstanceNo = instanceNo,
                TotalNodes = WorkflowDefinition.Count,
                CompletedNodes = 0,
                CurrentNodeIndex = 0,
                Status = WorkflowNodeStatus.InProgress,
                StartTime = now,
                CreatedBy = operatorId
            };

            _context.WorkflowInstances.Add(instance);
            await _context.SaveChangesAsync();

            var sortOrder = 1;
            foreach (var (nodeType, name, nameEn, timeLimit, isParallel, prerequisites) in WorkflowDefinition)
            {
                var node = new WorkflowNodeExecution
                {
                    InstanceId = instance.Id,
                    NodeType = nodeType,
                    NodeName = name,
                    NodeNameEn = nameEn,
                    SortOrder = sortOrder++,
                    IsParallel = isParallel,
                    Prerequisites = prerequisites.Length > 0 ? string.Join(",", prerequisites) : null,
                    Status = WorkflowNodeStatus.Pending,
                    TimeLimitMinutes = timeLimit,
                    ScheduledEndTime = now.AddMinutes(timeLimit),
                    CreatedBy = operatorId
                };
                _context.WorkflowNodeExecutions.Add(node);
            }

            await _context.SaveChangesAsync();

            transaction.Status = TransactionStatus.InProgress;
            transaction.UpdatedBy = operatorId;
            await _context.SaveChangesAsync();

            var firstPendingNodes = await _context.WorkflowNodeExecutions
                .Where(n => n.InstanceId == instance.Id && CanNodeStart(n, new List<string> { "TransactionCreated" }))
                .ToListAsync();

            foreach (var node in firstPendingNodes)
            {
                node.Status = WorkflowNodeStatus.InProgress;
                node.ScheduledStartTime = now;
                node.ScheduledEndTime = now.AddMinutes(node.TimeLimitMinutes);
            }

            await _context.SaveChangesAsync();

            await txn.CommitAsync();

            instance.NodeExecutions = await _context.WorkflowNodeExecutions
                .AsNoTracking()
                .Where(n => n.InstanceId == instance.Id)
                .OrderBy(n => n.SortOrder)
                .ToListAsync();

            var result = _mapper.Map<WorkflowInstanceDto>(instance);
            _logger.LogInformation("Workflow started: InstanceNo={InstanceNo}, TransactionId={TransactionId}", instanceNo, dto.TransactionId);

            return ApiResponse<WorkflowInstanceDto>.Success(result, "过户流程已启动", "Transfer workflow started successfully");
        }
        catch (Exception ex)
        {
            await txn.RollbackAsync();
            _logger.LogError(ex, "Failed to start workflow for TransactionId: {TransactionId}", dto.TransactionId);
            return ApiResponse<WorkflowInstanceDto>.Fail(ErrorCodes.InternalServerError.Code, ErrorCodes.InternalServerError.MessageZh, ErrorCodes.InternalServerError.MessageEn);
        }
    }

    private static bool CanNodeStart(WorkflowNodeExecution node, List<string> completedNodeTypes)
    {
        if (string.IsNullOrEmpty(node.Prerequisites)) return true;
        var prereqs = node.Prerequisites.Split(',', StringSplitOptions.RemoveEmptyEntries);
        return prereqs.All(p => completedNodeTypes.Contains(p));
    }

    public async Task<ApiResponse<WorkflowNodeExecutionDto>> ProcessNodeAsync(WorkflowNodeProcessDto dto, long operatorId)
    {
        _logger.LogInformation("Processing workflow node: NodeExecutionId={NodeExecutionId}, ProcessorId={ProcessorId}", dto.NodeExecutionId, dto.ProcessorId);

        var node = await _context.WorkflowNodeExecutions
            .Include(n => n.Instance)
            .FirstOrDefaultAsync(n => n.Id == dto.NodeExecutionId);

        if (node == null)
        {
            return ApiResponse<WorkflowNodeExecutionDto>.Fail(ErrorCodes.WorkflowNodeNotFound.Code, ErrorCodes.WorkflowNodeNotFound.MessageZh, ErrorCodes.WorkflowNodeNotFound.MessageEn);
        }

        if (node.Status != WorkflowNodeStatus.Pending && node.Status != WorkflowNodeStatus.InProgress)
        {
            return ApiResponse<WorkflowNodeExecutionDto>.Fail(ErrorCodes.WorkflowInvalidTransition.Code, ErrorCodes.WorkflowInvalidTransition.MessageZh, ErrorCodes.WorkflowInvalidTransition.MessageEn);
        }

        if (node.Status == WorkflowNodeStatus.Pending)
        {
            var completedNodes = await _context.WorkflowNodeExecutions
                .Where(n => n.InstanceId == node.InstanceId && n.Status == WorkflowNodeStatus.Completed)
                .Select(n => n.NodeType.ToString())
                .ToListAsync();

            if (!CanNodeStart(node, completedNodes))
            {
                return ApiResponse<WorkflowNodeExecutionDto>.Fail(ErrorCodes.WorkflowPrerequisiteNotMet.Code, ErrorCodes.WorkflowPrerequisiteNotMet.MessageZh, ErrorCodes.WorkflowPrerequisiteNotMet.MessageEn);
            }
        }

        var now = DateTime.UtcNow;
        node.Status = WorkflowNodeStatus.Completed;
        node.StartTime ??= now;
        node.EndTime = now;
        node.DurationMinutes = (int)(node.EndTime.Value - node.StartTime.Value).TotalMinutes;
        node.CompletedBy = dto.ProcessorId;
        node.CompleterName = dto.ProcessorName;
        node.ResultData = dto.ResultData;
        node.Remark = dto.Remark;
        node.UpdatedBy = operatorId;

        var completedNodesAfter = await _context.WorkflowNodeExecutions
            .Where(n => n.InstanceId == node.InstanceId && n.Status == WorkflowNodeStatus.Completed)
            .Select(n => n.NodeType.ToString())
            .ToListAsync();

        if (!completedNodesAfter.Contains(node.NodeType.ToString()))
        {
            completedNodesAfter.Add(node.NodeType.ToString());
        }

        var pendingNodes = await _context.WorkflowNodeExecutions
            .Where(n => n.InstanceId == node.InstanceId && n.Status == WorkflowNodeStatus.Pending)
            .ToListAsync();

        foreach (var pendingNode in pendingNodes)
        {
            if (CanNodeStart(pendingNode, completedNodesAfter))
            {
                pendingNode.Status = WorkflowNodeStatus.InProgress;
                pendingNode.ScheduledStartTime = now;
                pendingNode.ScheduledEndTime = now.AddMinutes(pendingNode.TimeLimitMinutes);
                pendingNode.AssignedTo = dto.ProcessorId;
                pendingNode.AssigneeName = dto.ProcessorName;
            }
        }

        if (node.Instance != null)
        {
            node.Instance.CompletedNodes = completedNodesAfter.Count;
            var inProgressOrPending = pendingNodes.Any(n => n.Status == WorkflowNodeStatus.InProgress || n.Status == WorkflowNodeStatus.Pending);

            if (!inProgressOrPending)
            {
                node.Instance.Status = WorkflowNodeStatus.Completed;
                node.Instance.EndTime = now;
                node.Instance.TotalDurationMinutes = (int)(now - (node.Instance.StartTime ?? now)).TotalMinutes;

                var transaction = await _context.VehicleTransactions.FindAsync(node.Instance.TransactionId);
                if (transaction != null)
                {
                    transaction.Status = TransactionStatus.Completed;
                    transaction.RegistrationDate = now;
                    transaction.UpdatedBy = operatorId;
                }

                var vehicle = await _context.Vehicles.FindAsync(transaction?.VehicleId ?? 0);
                if (vehicle != null)
                {
                    vehicle.Status = VehicleStatus.TransactionCompleted;
                    vehicle.UpdatedBy = operatorId;
                }
            }
            else
            {
                var currentSort = pendingNodes.Where(n => n.Status == WorkflowNodeStatus.InProgress).Min(n => (int?)n.SortOrder);
                if (currentSort.HasValue)
                {
                    node.Instance.CurrentNodeIndex = currentSort.Value;
                }
            }
        }

        await _context.SaveChangesAsync();

        _cache.Remove($"workflow_instance_{node.InstanceId}");

        var result = _mapper.Map<WorkflowNodeExecutionDto>(node);
        return ApiResponse<WorkflowNodeExecutionDto>.Success(result, $"节点[{node.NodeName}]办理完成", $"Node [{node.NodeNameEn}] completed successfully");
    }

    public async Task<ApiResponse<WorkflowNodeExecutionDto>> SkipNodeAsync(WorkflowNodeSkipDto dto, long operatorId)
    {
        _logger.LogInformation("Skipping workflow node: NodeExecutionId={NodeExecutionId}", dto.NodeExecutionId);

        var node = await _context.WorkflowNodeExecutions
            .Include(n => n.Instance)
            .FirstOrDefaultAsync(n => n.Id == dto.NodeExecutionId);

        if (node == null)
        {
            return ApiResponse<WorkflowNodeExecutionDto>.Fail(ErrorCodes.WorkflowNodeNotFound.Code, ErrorCodes.WorkflowNodeNotFound.MessageZh, ErrorCodes.WorkflowNodeNotFound.MessageEn);
        }

        if (node.Status == WorkflowNodeStatus.Completed)
        {
            return ApiResponse<WorkflowNodeExecutionDto>.Fail(ErrorCodes.WorkflowInvalidTransition.Code, "该节点已完成，无法跳过", "Node already completed, cannot skip");
        }

        var now = DateTime.UtcNow;
        node.Status = WorkflowNodeStatus.Skipped;
        node.StartTime ??= now;
        node.EndTime = now;
        node.CompletedBy = dto.ProcessorId;
        node.CompleterName = dto.ProcessorName;
        node.Remark = $"[跳过原因] {dto.SkipReason}";
        node.UpdatedBy = operatorId;

        var completedNodesAfter = await _context.WorkflowNodeExecutions
            .Where(n => n.InstanceId == node.InstanceId &&
                (n.Status == WorkflowNodeStatus.Completed || n.Status == WorkflowNodeStatus.Skipped))
            .Select(n => n.NodeType.ToString())
            .ToListAsync();

        if (!completedNodesAfter.Contains(node.NodeType.ToString()))
        {
            completedNodesAfter.Add(node.NodeType.ToString());
        }

        var pendingNodes = await _context.WorkflowNodeExecutions
            .Where(n => n.InstanceId == node.InstanceId && n.Status == WorkflowNodeStatus.Pending)
            .ToListAsync();

        foreach (var pendingNode in pendingNodes)
        {
            if (CanNodeStart(pendingNode, completedNodesAfter))
            {
                pendingNode.Status = WorkflowNodeStatus.InProgress;
                pendingNode.ScheduledStartTime = now;
                pendingNode.ScheduledEndTime = now.AddMinutes(pendingNode.TimeLimitMinutes);
            }
        }

        if (node.Instance != null)
        {
            node.Instance.CompletedNodes = completedNodesAfter.Count;
            var inProgressOrPending = pendingNodes.Any(n => n.Status == WorkflowNodeStatus.InProgress || n.Status == WorkflowNodeStatus.Pending);

            if (!inProgressOrPending)
            {
                node.Instance.Status = WorkflowNodeStatus.Completed;
                node.Instance.EndTime = now;
                node.Instance.TotalDurationMinutes = (int)(now - (node.Instance.StartTime ?? now)).TotalMinutes;
            }
        }

        await _context.SaveChangesAsync();

        _cache.Remove($"workflow_instance_{node.InstanceId}");

        var result = _mapper.Map<WorkflowNodeExecutionDto>(node);
        return ApiResponse<WorkflowNodeExecutionDto>.Success(result, $"节点[{node.NodeName}]已跳过", $"Node [{node.NodeNameEn}] skipped");
    }

    public async Task<ApiResponse<WorkflowInstanceDto>> GetInstanceByIdAsync(long instanceId)
    {
        var cacheKey = $"workflow_instance_{instanceId}";
        if (_cache.TryGetValue(cacheKey, out WorkflowInstanceDto? cached))
        {
            return ApiResponse<WorkflowInstanceDto>.Success(cached!);
        }

        var instance = await _context.WorkflowInstances
            .AsNoTracking()
            .Include(w => w.NodeExecutions)
            .FirstOrDefaultAsync(w => w.Id == instanceId);

        if (instance == null)
        {
            return ApiResponse<WorkflowInstanceDto>.Fail(ErrorCodes.NotFound.Code, "流程实例不存在", "Workflow instance not found");
        }

        var result = _mapper.Map<WorkflowInstanceDto>(instance);
        _cache.Set(cacheKey, result, TimeSpan.FromMinutes(2));
        return ApiResponse<WorkflowInstanceDto>.Success(result);
    }

    public async Task<ApiResponse<List<WorkflowInstanceDto>>> GetInstancesByTransactionIdAsync(long transactionId)
    {
        var instances = await _context.WorkflowInstances
            .AsNoTracking()
            .Include(w => w.NodeExecutions)
            .Where(w => w.TransactionId == transactionId)
            .OrderByDescending(w => w.CreatedAt)
            .ProjectTo<WorkflowInstanceDto>(_mapper.ConfigurationProvider)
            .ToListAsync();

        return ApiResponse<List<WorkflowInstanceDto>>.Success(instances);
    }

    public async Task<ApiResponse<WorkflowInstanceDto>> GetCurrentStatusAsync(long transactionId)
    {
        var instance = await _context.WorkflowInstances
            .AsNoTracking()
            .Include(w => w.NodeExecutions)
            .Where(w => w.TransactionId == transactionId)
            .OrderByDescending(w => w.CreatedAt)
            .FirstOrDefaultAsync();

        if (instance == null)
        {
            return ApiResponse<WorkflowInstanceDto>.Fail(ErrorCodes.NotFound.Code, "该交易未启动过户流程", "No workflow started for this transaction");
        }

        var result = _mapper.Map<WorkflowInstanceDto>(instance);
        return ApiResponse<WorkflowInstanceDto>.Success(result);
    }

    public async Task<ApiResponse<int>> CheckTimeoutAndSendReminderAsync()
    {
        _logger.LogInformation("Checking workflow node timeouts...");

        var now = DateTime.UtcNow;
        var timeoutNodes = await _context.WorkflowNodeExecutions
            .Include(n => n.Instance)
            .Where(n => n.Status == WorkflowNodeStatus.InProgress && n.ScheduledEndTime < now)
            .ToListAsync();

        var reminderCount = 0;

        foreach (var node in timeoutNodes)
        {
            node.Status = WorkflowNodeStatus.TimedOut;
            node.ReminderCount++;
            node.LastReminderTime = now;
            reminderCount++;

            if (node.Instance != null)
            {
                node.Instance.HasTimedOutNodes = true;
            }

            var txnNo = node.Instance != null
                ? (await _context.VehicleTransactions.AsNoTracking().FirstOrDefaultAsync(t => t.Id == node.Instance.TransactionId))?.TransactionNo ?? "N/A"
                : "N/A";

            _logger.LogWarning("Workflow node timed out: NodeId={NodeId}, NodeName={NodeName}, TransactionNo={TxnNo}, ReminderCount={Count}",
                node.Id, node.NodeName, txnNo, node.ReminderCount);
        }

        var threshold15Min = now.AddMinutes(15);
        var threshold30MinAgo = now.AddMinutes(-30);

        var nearingTimeoutNodes = await _context.WorkflowNodeExecutions
            .Where(n => n.Status == WorkflowNodeStatus.InProgress &&
                n.ScheduledEndTime > now &&
                n.ScheduledEndTime <= threshold15Min &&
                (n.LastReminderTime == null || n.LastReminderTime <= threshold30MinAgo))
            .ToListAsync();

        foreach (var node in nearingTimeoutNodes)
        {
            node.ReminderCount++;
            node.LastReminderTime = now;
            reminderCount++;
            _logger.LogInformation("Sending workflow reminder: NodeId={NodeId}, NodeName={NodeName}, DueIn={Min}min",
                node.Id, node.NodeName, (int)(node.ScheduledEndTime - now).TotalMinutes);
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("Timeout check completed. {Count} nodes processed.", reminderCount);
        return ApiResponse<int>.Success(reminderCount, $"超时检查完成，共处理{reminderCount}个节点", $"Timeout check completed, {reminderCount} nodes processed");
    }
}
