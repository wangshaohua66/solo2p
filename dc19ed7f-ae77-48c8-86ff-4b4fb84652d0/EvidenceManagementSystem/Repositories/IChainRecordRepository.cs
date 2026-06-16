using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Models.Entities;

namespace EvidenceManagementSystem.Repositories;

public interface IChainRecordRepository : IRepository<ChainRecord>
{
    Task<List<ChainRecord>> GetByEvidenceIdAsync(Guid evidenceId);
    Task<PagedResult<ChainRecord>> SearchAsync(ChainQuery query);
    Task<ChainRecord?> GetLastRecordAsync(Guid evidenceId);
    Task<int> GetNextSequenceNumberAsync(Guid evidenceId);
    Task<List<ChainRecord>> GetChainForwardAsync(Guid evidenceId, DateTime fromTime);
    Task<List<ChainRecord>> GetChainBackwardAsync(Guid evidenceId, DateTime toTime);
}
