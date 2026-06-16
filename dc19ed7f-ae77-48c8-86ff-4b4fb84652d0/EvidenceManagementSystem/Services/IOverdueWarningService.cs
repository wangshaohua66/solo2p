using EvidenceManagementSystem.Models.DTOs;

namespace EvidenceManagementSystem.Services;

public interface IOverdueWarningService
{
    Task GenerateWarningsAsync();
    Task<PagedResult<OverdueWarningDto>> SearchAsync(OverdueWarningQuery query);
    Task<List<OverdueWarningDto>> GetUnresolvedWarningsAsync();
    Task MarkAsNotifiedAsync(Guid id);
    Task ResolveWarningAsync(Guid id, string remark);
    Task<int> GetWarningCountAsync();
    Task<int> GetOverdueCountAsync();
}
