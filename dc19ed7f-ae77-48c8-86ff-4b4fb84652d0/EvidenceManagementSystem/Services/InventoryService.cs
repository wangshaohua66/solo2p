using EvidenceManagementSystem.Common;
using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Models.Entities;
using EvidenceManagementSystem.Models.Enums;
using EvidenceManagementSystem.Repositories;

namespace EvidenceManagementSystem.Services;

public class InventoryService : IInventoryService
{
    private readonly IInventoryRepository _inventoryRepository;
    private readonly IEvidenceRepository _evidenceRepository;
    private readonly IUserRepository _userRepository;

    public InventoryService(
        IInventoryRepository inventoryRepository,
        IEvidenceRepository evidenceRepository,
        IUserRepository userRepository)
    {
        _inventoryRepository = inventoryRepository;
        _evidenceRepository = evidenceRepository;
        _userRepository = userRepository;
    }

    public async Task<InventoryTaskDto> CreateTaskAsync(CreateInventoryTaskRequest request, Guid operatorId, string operatorName)
    {
        const int PageSize = 1000;
        var taskNumber = BarcodeGenerator.GenerateTaskNumber("PD");

        var totalCount = await _evidenceRepository.GetCountForInventoryAsync(
            request.Category,
            request.Warehouse,
            request.CaseNumber);

        var task = new InventoryTask
        {
            Id = Guid.NewGuid(),
            TaskNumber = taskNumber,
            Warehouse = request.Warehouse,
            Category = request.Category,
            CaseNumber = request.CaseNumber,
            Status = InventoryStatus.Pending,
            TotalCount = totalCount,
            MatchedCount = 0,
            MismatchedCount = 0,
            MissingCount = 0,
            ExtraCount = 0,
            CreatedById = operatorId,
            CreatedAt = DateTime.UtcNow
        };

        var createdTask = await _inventoryRepository.AddAsync(task);

        var totalPages = (int)Math.Ceiling((double)totalCount / PageSize);
        for (int page = 1; page <= totalPages; page++)
        {
            var pagedResult = await _evidenceRepository.GetForInventoryAsync(
                request.Category,
                request.Warehouse,
                request.CaseNumber,
                page,
                PageSize);

            var batchItems = new List<InventoryItem>();
            foreach (var ev in pagedResult.Items)
            {
                batchItems.Add(new InventoryItem
                {
                    Id = Guid.NewGuid(),
                    InventoryTaskId = createdTask.Id,
                    EvidenceId = ev.Id,
                    Barcode = ev.Barcode,
                    EvidenceName = ev.Name,
                    IsInSystem = true,
                    IsScanned = false,
                    IsMatched = false
                });
            }

            await _inventoryRepository.BulkAddItemsAsync(batchItems);
        }

        return await MapToDto(createdTask);
    }

    public async Task<InventoryTaskDto?> GetByIdAsync(Guid id)
    {
        var task = await _inventoryRepository.GetByIdAsync(id);
        return task == null ? null : await MapToDto(task);
    }

    public async Task<InventoryTaskDto?> GetByTaskNumberAsync(string taskNumber)
    {
        var task = await _inventoryRepository.GetByTaskNumberAsync(taskNumber);
        return task == null ? null : await MapToDto(task);
    }

    public async Task<PagedResult<InventoryTaskDto>> SearchAsync(InventoryQuery query)
    {
        var result = await _inventoryRepository.SearchAsync(query);
        var dtos = new List<InventoryTaskDto>();
        foreach (var task in result.Items)
        {
            dtos.Add(await MapToDto(task));
        }

        return new PagedResult<InventoryTaskDto>
        {
            Items = dtos,
            TotalCount = result.TotalCount,
            PageNumber = result.PageNumber,
            PageSize = result.PageSize
        };
    }

    public async Task<InventoryItemDto> ScanItemAsync(Guid taskId, ScanInventoryItemRequest request)
    {
        var task = await _inventoryRepository.GetByIdAsync(taskId)
            ?? throw new BusinessException("盘点任务不存在", 404);

        if (task.Status == InventoryStatus.Completed)
        {
            throw new BusinessException("盘点任务已完成，无法继续扫描", 400);
        }

        if (task.Status == InventoryStatus.Pending)
        {
            task.Status = InventoryStatus.InProgress;
            task.StartedAt = DateTime.UtcNow;
            await _inventoryRepository.UpdateAsync(task);
        }

        var item = await _inventoryRepository.GetItemByBarcodeAsync(taskId, request.Barcode);

        if (item != null)
        {
            item.IsScanned = true;
            item.IsMatched = true;
            item.ScannedAt = DateTime.UtcNow;
            item.Remark = request.Remark;
            await _inventoryRepository.UpdateItemAsync(item);

            await UpdateTaskStatistics(taskId);

            return MapItemToDto(item);
        }
        else
        {
            var evidence = await _evidenceRepository.GetByBarcodeAsync(request.Barcode);
            var newItem = new InventoryItem
            {
                Id = Guid.NewGuid(),
                InventoryTaskId = taskId,
                EvidenceId = evidence?.Id ?? Guid.Empty,
                Barcode = request.Barcode,
                EvidenceName = evidence?.Name ?? "未知物证",
                IsInSystem = evidence != null,
                IsScanned = true,
                IsMatched = false,
                Remark = request.Remark,
                ScannedAt = DateTime.UtcNow
            };

            await _inventoryRepository.AddItemAsync(newItem);
            await UpdateTaskStatistics(taskId);

            return MapItemToDto(newItem);
        }
    }

    public async Task<List<InventoryItemDto>> GetItemsByTaskIdAsync(Guid taskId)
    {
        var items = await _inventoryRepository.GetItemsByTaskIdAsync(taskId);
        return items.Select(MapItemToDto).ToList();
    }

    public async Task<InventoryTaskDto> CompleteTaskAsync(Guid taskId, CompleteInventoryRequest request)
    {
        var task = await _inventoryRepository.GetByIdAsync(taskId)
            ?? throw new BusinessException("盘点任务不存在", 404);

        if (task.Status == InventoryStatus.Completed)
        {
            throw new BusinessException("盘点任务已完成", 400);
        }

        var items = await _inventoryRepository.GetItemsByTaskIdAsync(taskId);

        var missingCount = items.Count(i => i.IsInSystem && !i.IsScanned);
        var matchedCount = items.Count(i => i.IsMatched);
        var extraCount = items.Count(i => i.IsScanned && !i.IsInSystem);
        var mismatchedCount = items.Count(i => !i.IsMatched);

        task.MissingCount = missingCount;
        task.MatchedCount = matchedCount;
        task.ExtraCount = extraCount;
        task.MismatchedCount = mismatchedCount;
        task.ExceptionReport = request.ExceptionReport;
        task.CompletedAt = DateTime.UtcNow;

        if (mismatchedCount > 0 || missingCount > 0 || extraCount > 0)
        {
            task.Status = InventoryStatus.Exception;
            task.LeaderNotified = true;
        }
        else
        {
            task.Status = InventoryStatus.Completed;
        }

        await _inventoryRepository.UpdateAsync(task);
        return await MapToDto(task);
    }

    private async Task UpdateTaskStatistics(Guid taskId)
    {
        var task = await _inventoryRepository.GetByIdAsync(taskId);
        if (task == null) return;

        var items = await _inventoryRepository.GetItemsByTaskIdAsync(taskId);

        task.MissingCount = items.Count(i => i.IsInSystem && !i.IsScanned);
        task.MatchedCount = items.Count(i => i.IsMatched);
        task.ExtraCount = items.Count(i => i.IsScanned && !i.IsInSystem);
        task.MismatchedCount = items.Count(i => !i.IsMatched);
        task.TotalCount = items.Count(i => i.IsInSystem);

        await _inventoryRepository.UpdateAsync(task);
    }

    private async Task<InventoryTaskDto> MapToDto(InventoryTask task)
    {
        var creator = await _userRepository.GetByIdAsync(task.CreatedById);
        return new InventoryTaskDto
        {
            Id = task.Id,
            TaskNumber = task.TaskNumber,
            Warehouse = task.Warehouse,
            Category = task.Category,
            CaseNumber = task.CaseNumber,
            Status = task.Status,
            TotalCount = task.TotalCount,
            MatchedCount = task.MatchedCount,
            MismatchedCount = task.MismatchedCount,
            MissingCount = task.MissingCount,
            ExtraCount = task.ExtraCount,
            StartedAt = task.StartedAt,
            CompletedAt = task.CompletedAt,
            CreatedById = task.CreatedById,
            CreatedByName = creator?.RealName ?? string.Empty,
            CreatedAt = task.CreatedAt,
            ExceptionReport = task.ExceptionReport,
            LeaderNotified = task.LeaderNotified
        };
    }

    private static InventoryItemDto MapItemToDto(InventoryItem item)
    {
        return new InventoryItemDto
        {
            Id = item.Id,
            EvidenceId = item.EvidenceId,
            Barcode = item.Barcode,
            EvidenceName = item.EvidenceName,
            IsInSystem = item.IsInSystem,
            IsScanned = item.IsScanned,
            IsMatched = item.IsMatched,
            Remark = item.Remark,
            ScannedAt = item.ScannedAt
        };
    }
}
