using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Models.Entities;
using EvidenceManagementSystem.Models.Enums;

namespace EvidenceManagementSystem.Repositories;

public interface IEvidenceRepository : IRepository<Evidence>
{
    Task<Evidence?> GetByBarcodeAsync(string barcode);
    Task<PagedResult<Evidence>> SearchAsync(EvidenceQuery query);
    Task<int> GetCountByStatusAsync(EvidenceStatus status);
    Task<int> GetCountByCategoryAsync(EvidenceCategory category);
    Task<List<Evidence>> GetOverdueEvidencesAsync();
    Task<List<Evidence>> GetWarningEvidencesAsync(int daysBeforeExpiry);
    Task<bool> BarcodeExistsAsync(string barcode);
    Task<PagedResult<Evidence>> GetForInventoryAsync(EvidenceCategory? category, string? warehouse, string? caseNumber, int pageNumber, int pageSize);
    Task<int> GetCountForInventoryAsync(EvidenceCategory? category, string? warehouse, string? caseNumber);
}
