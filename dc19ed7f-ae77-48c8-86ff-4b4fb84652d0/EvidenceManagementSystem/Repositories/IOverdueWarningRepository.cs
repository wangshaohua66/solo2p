using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Models.Entities;

namespace EvidenceManagementSystem.Repositories;

public interface IOverdueWarningRepository : IRepository<OverdueWarning>
{
    Task<PagedResult<OverdueWarning>> SearchAsync(OverdueWarningQuery query);
    Task<List<OverdueWarning>> GetUnresolvedWarningsAsync();
    Task<List<OverdueWarning>> GetUnnotifiedWarningsAsync();
    Task MarkAsNotifiedAsync(Guid id);
    Task ResolveWarningAsync(Guid id, string remark);
}
