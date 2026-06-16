using EvidenceManagementSystem.Models.DTOs;

namespace EvidenceManagementSystem.Services;

public interface IChainService
{
    Task<ChainRecordDto?> GetByIdAsync(Guid id);
    Task<PagedResult<ChainRecordDto>> SearchAsync(ChainQuery query);
    Task<List<ChainRecordDto>> GetChainByEvidenceIdAsync(Guid evidenceId);
    Task<List<ChainRecordDto>> GetChainForwardAsync(Guid evidenceId, DateTime fromTime);
    Task<List<ChainRecordDto>> GetChainBackwardAsync(Guid evidenceId, DateTime toTime);
    Task<bool> VerifyChainIntegrityAsync(Guid evidenceId);
}
