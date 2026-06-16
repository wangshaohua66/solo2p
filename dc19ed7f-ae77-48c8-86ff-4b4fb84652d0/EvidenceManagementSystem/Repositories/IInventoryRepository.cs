using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Models.Entities;

namespace EvidenceManagementSystem.Repositories;

public interface IInventoryRepository : IRepository<InventoryTask>
{
    Task<PagedResult<InventoryTask>> SearchAsync(InventoryQuery query);
    Task<InventoryTask?> GetByTaskNumberAsync(string taskNumber);
    Task<InventoryItem?> GetItemByBarcodeAsync(Guid taskId, string barcode);
    Task<List<InventoryItem>> GetItemsByTaskIdAsync(Guid taskId);
    Task AddItemAsync(InventoryItem item);
    Task UpdateItemAsync(InventoryItem item);
}
