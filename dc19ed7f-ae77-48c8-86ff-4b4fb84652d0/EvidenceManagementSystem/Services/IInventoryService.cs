using EvidenceManagementSystem.Models.DTOs;

namespace EvidenceManagementSystem.Services;

public interface IInventoryService
{
    Task<InventoryTaskDto> CreateTaskAsync(CreateInventoryTaskRequest request, Guid operatorId, string operatorName);
    Task<InventoryTaskDto?> GetByIdAsync(Guid id);
    Task<InventoryTaskDto?> GetByTaskNumberAsync(string taskNumber);
    Task<PagedResult<InventoryTaskDto>> SearchAsync(InventoryQuery query);
    Task<InventoryItemDto> ScanItemAsync(Guid taskId, ScanInventoryItemRequest request);
    Task<List<InventoryItemDto>> GetItemsByTaskIdAsync(Guid taskId);
    Task<InventoryTaskDto> CompleteTaskAsync(Guid taskId, CompleteInventoryRequest request);
}
