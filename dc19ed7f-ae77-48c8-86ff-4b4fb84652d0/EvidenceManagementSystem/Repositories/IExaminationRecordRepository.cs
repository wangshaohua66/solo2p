using EvidenceManagementSystem.Models.Entities;

namespace EvidenceManagementSystem.Repositories;

public interface IExaminationRecordRepository : IRepository<ExaminationRecord>
{
    Task<List<ExaminationRecord>> GetByTaskIdAsync(Guid taskId);
    Task<ExaminationRecord?> GetByTaskAndRoundAsync(Guid taskId, int roundNumber);
}
