using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Models.Entities;

namespace EvidenceManagementSystem.Repositories;

public interface IExaminationRepository : IRepository<ExaminationTask>
{
    Task<PagedResult<ExaminationTask>> SearchAsync(ExaminationQuery query);
    Task<ExaminationTask?> GetByTaskNumberAsync(string taskNumber);
    Task<List<ExaminationTask>> GetByEvidenceIdAsync(Guid evidenceId);
    Task<List<ExaminationTask>> GetByExaminerIdAsync(Guid examinerId);
    Task<int> GetCountByStatusAsync(int status);
}
