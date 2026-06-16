using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Models.Entities;

namespace EvidenceManagementSystem.Repositories;

public interface IDestroyRequestRepository : IRepository<DestroyRequest>
{
    Task<PagedResult<DestroyRequest>> SearchAsync(DestroyQuery query);
    Task<DestroyRequest?> GetByRequestNumberAsync(string requestNumber);
    Task<List<DestroyRequest>> GetByEvidenceIdAsync(Guid evidenceId);
}
