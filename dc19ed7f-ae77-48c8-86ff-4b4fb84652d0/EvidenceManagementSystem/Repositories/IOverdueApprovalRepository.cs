using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Models.Entities;

namespace EvidenceManagementSystem.Repositories;

public interface IOverdueApprovalRepository : IRepository<OverdueApproval>
{
    Task<PagedResult<OverdueApproval>> SearchAsync(OverdueApprovalQuery query);
    Task<OverdueApproval?> GetByWarningIdAsync(Guid warningId);
}
