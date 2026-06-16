using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Models.Entities;

namespace EvidenceManagementSystem.Services;

public interface IEvidenceService
{
    Task<EvidenceDto> CreateAsync(CreateEvidenceRequest request, Guid operatorId, string operatorName);
    Task<EvidenceDto?> GetByIdAsync(Guid id);
    Task<EvidenceDto?> GetByBarcodeAsync(string barcode);
    Task<PagedResult<EvidenceDto>> SearchAsync(EvidenceQuery query);
    Task<EvidenceDto> UpdateAsync(Guid id, UpdateEvidenceRequest request, Guid operatorId);
    Task<EvidenceDto> InboundAsync(InboundRequest request, Guid operatorId, string operatorName);
    Task<EvidenceDto> OutboundAsync(OutboundRequest request, Guid operatorId, string operatorName);
    Task<bool> DeleteAsync(Guid id);
}
