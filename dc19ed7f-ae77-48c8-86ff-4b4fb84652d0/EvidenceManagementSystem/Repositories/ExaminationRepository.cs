using EvidenceManagementSystem.Data;
using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Models.Entities;
using EvidenceManagementSystem.Models.Enums;
using Microsoft.EntityFrameworkCore;

namespace EvidenceManagementSystem.Repositories;

public class ExaminationRepository : Repository<ExaminationTask>, IExaminationRepository
{
    public ExaminationRepository(AppDbContext context) : base(context)
    {
    }

    public async Task<PagedResult<ExaminationTask>> SearchAsync(ExaminationQuery query)
    {
        var q = _dbSet.AsQueryable();

        if (query.Status.HasValue)
            q = q.Where(e => e.Status == query.Status.Value);
        if (query.ExaminerId.HasValue)
            q = q.Where(e => e.ExaminerId == query.ExaminerId.Value);
        if (query.ReviewerId.HasValue)
            q = q.Where(e => e.ReviewerId == query.ReviewerId.Value);
        if (query.EvidenceId.HasValue)
            q = q.Where(e => e.EvidenceId == query.EvidenceId.Value);
        if (!string.IsNullOrEmpty(query.TaskNumber))
            q = q.Where(e => e.TaskNumber.Contains(query.TaskNumber));
        if (!string.IsNullOrEmpty(query.Keyword))
            q = q.Where(e => e.TaskNumber.Contains(query.Keyword) ||
                            e.ExaminationType.Contains(query.Keyword));
        if (query.StartDate.HasValue)
            q = q.Where(e => e.CreatedAt >= query.StartDate.Value);
        if (query.EndDate.HasValue)
            q = q.Where(e => e.CreatedAt <= query.EndDate.Value);

        var totalCount = await q.CountAsync();

        var items = await q
            .Include(e => e.Examiner)
            .Include(e => e.Reviewer)
            .Include(e => e.Evidence)
            .OrderByDescending(e => e.CreatedAt)
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return new PagedResult<ExaminationTask>
        {
            Items = items,
            TotalCount = totalCount,
            PageNumber = query.PageNumber,
            PageSize = query.PageSize
        };
    }

    public async Task<ExaminationTask?> GetByTaskNumberAsync(string taskNumber)
    {
        return await _dbSet
            .Include(e => e.Examiner)
            .Include(e => e.Reviewer)
            .Include(e => e.Evidence)
            .Include(e => e.ExaminationRecords)
            .FirstOrDefaultAsync(e => e.TaskNumber == taskNumber);
    }

    public async Task<List<ExaminationTask>> GetByEvidenceIdAsync(Guid evidenceId)
    {
        return await _dbSet
            .Where(e => e.EvidenceId == evidenceId)
            .OrderByDescending(e => e.CreatedAt)
            .ToListAsync();
    }

    public async Task<List<ExaminationTask>> GetByExaminerIdAsync(Guid examinerId)
    {
        return await _dbSet
            .Where(e => e.ExaminerId == examinerId)
            .OrderByDescending(e => e.CreatedAt)
            .ToListAsync();
    }

    public async Task<int> GetCountByStatusAsync(int status)
    {
        return await _dbSet.CountAsync(e => e.Status == (ExaminationStatus)status);
    }
}
