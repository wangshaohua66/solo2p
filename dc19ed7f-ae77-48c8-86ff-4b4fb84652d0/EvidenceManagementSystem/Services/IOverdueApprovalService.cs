using EvidenceManagementSystem.Models.DTOs;

namespace EvidenceManagementSystem.Services;

public interface IOverdueApprovalService
{
    Task<OverdueApprovalDto> SubmitApprovalAsync(SubmitOverdueApprovalRequest request, Guid operatorId, string operatorName);
    Task<OverdueApprovalDto> ApproveAsync(Guid approvalId, ApproveOverdueRequest request, Guid operatorId, string operatorName);
    Task<OverdueApprovalDto> RejectAsync(Guid approvalId, RejectOverdueRequest request, Guid operatorId, string operatorName);
    Task<OverdueApprovalDto?> GetByIdAsync(Guid id);
    Task<PagedResult<OverdueApprovalDto>> SearchAsync(OverdueApprovalQuery query);
}
