using EvidenceManagementSystem.Data;
using EvidenceManagementSystem.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace EvidenceManagementSystem.Repositories;

public class ExaminationRecordRepository : Repository<ExaminationRecord>, IExaminationRecordRepository
{
    public ExaminationRecordRepository(AppDbContext context) : base(context)
    {
    }

    public async Task<List<ExaminationRecord>> GetByTaskIdAsync(Guid taskId)
    {
        return await _dbSet
            .Where(r => r.ExaminationTaskId == taskId)
            .OrderBy(r => r.RoundNumber)
            .ToListAsync();
    }

    public async Task<ExaminationRecord?> GetByTaskAndRoundAsync(Guid taskId, int roundNumber)
    {
        return await _dbSet
            .FirstOrDefaultAsync(r => r.ExaminationTaskId == taskId && r.RoundNumber == roundNumber);
    }
}
