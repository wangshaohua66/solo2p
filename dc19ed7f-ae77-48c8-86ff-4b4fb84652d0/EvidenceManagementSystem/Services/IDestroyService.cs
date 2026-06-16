using EvidenceManagementSystem.Models.DTOs;

namespace EvidenceManagementSystem.Services;

public interface IDestroyService
{
    Task<DestroyRequestDto> CreateRequestAsync(CreateDestroyRequestRequest request, Guid operatorId, string operatorName);
    Task<DestroyRequestDto?> GetByIdAsync(Guid id);
    Task<DestroyRequestDto?> GetByRequestNumberAsync(string requestNumber);
    Task<PagedResult<DestroyRequestDto>> SearchAsync(DestroyQuery query);
    Task<DestroyRequestDto> ApproveAsync(Guid requestId, ApproveDestroyRequest request, Guid leaderId, string leaderName);
    Task<DestroyRequestDto> ExecuteDestroyAsync(Guid requestId, ExecuteDestroyRequest request, Guid operatorId);
    Task<List<DestroyRequestDto>> GetByEvidenceIdAsync(Guid evidenceId);
}
