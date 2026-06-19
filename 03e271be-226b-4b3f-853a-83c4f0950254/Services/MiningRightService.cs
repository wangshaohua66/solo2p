using Microsoft.EntityFrameworkCore;
using MiningGovApi.Data;
using MiningGovApi.Models;
using MiningGovApi.Models.DTOs;

namespace MiningGovApi.Services;

public interface IMiningRightService
{
    Task<MiningRightDto> CreateAsync(MiningRightCreateDto dto, int userId);
    Task<MiningRightDto> GetByIdAsync(int id);
    Task<PagedResult<MiningRightDto>> QueryAsync(MiningRightQueryDto query);
    Task<MiningRightDto> SubmitForApprovalAsync(int id, int userId);
    Task<MiningRightDto> ApproveAsync(MiningRightApprovalDto dto, int approverId);
    Task CheckAndRemindPendingApprovalsAsync();
}

public class MiningRightService : IMiningRightService
{
    private readonly AppDbContext _dbContext;
    private const int MaxApprovalLevels = 4;
    private const int ApprovalTimeoutHours = 48;

    public MiningRightService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<MiningRightDto> CreateAsync(MiningRightCreateDto dto, int userId)
    {
        var mine = await _dbContext.Mines.FindAsync(dto.MineId);
        if (mine == null)
        {
            throw new KeyNotFoundException($"矿山ID {dto.MineId} 不存在");
        }

        if (dto.ValidTo <= dto.ValidFrom)
        {
            throw new ArgumentException("有效期结束时间必须大于开始时间");
        }

        var licenseNo = $"CK{DateTime.Now:yyyyMMddHHmmss}{new Random().Next(1000, 9999)}";

        var miningRight = new MiningRight
        {
            LicenseNo = licenseNo,
            MineId = dto.MineId,
            MineType = dto.MineType,
            MiningArea = dto.MiningArea,
            ValidFrom = dto.ValidFrom,
            ValidTo = dto.ValidTo,
            Holder = dto.Holder,
            Status = MiningRightStatus.Draft,
            ChangeType = dto.ChangeType,
            Remark = dto.Remark,
            CreatedAt = DateTime.UtcNow,
            CurrentApprovalLevel = null
        };

        _dbContext.MiningRights.Add(miningRight);
        await _dbContext.SaveChangesAsync();

        return await MapToDtoAsync(miningRight);
    }

    public async Task<MiningRightDto> GetByIdAsync(int id)
    {
        var miningRight = await _dbContext.MiningRights
            .Include(mr => mr.Mine)
            .Include(mr => mr.Approvals)
                .ThenInclude(a => a.Approver)
            .FirstOrDefaultAsync(mr => mr.Id == id);

        if (miningRight == null)
        {
            throw new KeyNotFoundException($"采矿权ID {id} 不存在");
        }

        return await MapToDtoAsync(miningRight);
    }

    public async Task<PagedResult<MiningRightDto>> QueryAsync(MiningRightQueryDto query)
    {
        var q = _dbContext.MiningRights
            .Include(mr => mr.Mine)
            .Include(mr => mr.Approvals)
                .ThenInclude(a => a.Approver)
            .AsQueryable();

        if (query.MineId.HasValue)
            q = q.Where(mr => mr.MineId == query.MineId.Value);
        if (query.Status.HasValue)
            q = q.Where(mr => mr.Status == query.Status.Value);
        if (query.MineType.HasValue)
            q = q.Where(mr => mr.MineType == query.MineType.Value);
        if (query.ChangeType.HasValue)
            q = q.Where(mr => mr.ChangeType == query.ChangeType.Value);
        if (!string.IsNullOrEmpty(query.LicenseNo))
            q = q.Where(mr => mr.LicenseNo.Contains(query.LicenseNo));

        var totalCount = await q.CountAsync();
        var items = await q
            .OrderByDescending(mr => mr.CreatedAt)
            .Skip((query.PageIndex - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        var dtoTasks = items.Select(MapToDtoAsync);
        var dtos = (await Task.WhenAll(dtoTasks)).ToList();

        return new PagedResult<MiningRightDto>
        {
            TotalCount = totalCount,
            PageIndex = query.PageIndex,
            PageSize = query.PageSize,
            Items = dtos
        };
    }

    public async Task<MiningRightDto> SubmitForApprovalAsync(int id, int userId)
    {
        var miningRight = await _dbContext.MiningRights.FindAsync(id);
        if (miningRight == null)
        {
            throw new KeyNotFoundException($"采矿权ID {id} 不存在");
        }

        if (miningRight.Status != MiningRightStatus.Draft)
        {
            throw new InvalidOperationException("只有草稿状态的采矿权才能提交审批");
        }

        miningRight.Status = MiningRightStatus.PendingApproval;
        miningRight.CurrentApprovalLevel = 1;

        for (int level = 1; level <= MaxApprovalLevels; level++)
        {
            _dbContext.MiningRightApprovals.Add(new MiningRightApproval
            {
                MiningRightId = id,
                ApprovalLevel = level,
                Status = level == 1 ? ApprovalStatus.Pending : ApprovalStatus.Pending,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _dbContext.SaveChangesAsync();
        return await GetByIdAsync(id);
    }

    public async Task<MiningRightDto> ApproveAsync(MiningRightApprovalDto dto, int approverId)
    {
        var miningRight = await _dbContext.MiningRights
            .Include(mr => mr.Approvals)
            .FirstOrDefaultAsync(mr => mr.Id == dto.MiningRightId);

        if (miningRight == null)
        {
            throw new KeyNotFoundException($"采矿权ID {dto.MiningRightId} 不存在");
        }

        if (miningRight.Status != MiningRightStatus.PendingApproval)
        {
            throw new InvalidOperationException("当前状态不允许审批");
        }

        var currentLevel = miningRight.CurrentApprovalLevel ?? 1;
        var approval = miningRight.Approvals.FirstOrDefault(a => a.ApprovalLevel == currentLevel);

        if (approval == null)
        {
            throw new InvalidOperationException("未找到当前审批节点");
        }

        approval.ApproverId = approverId;
        approval.Status = dto.Status;
        approval.Opinion = dto.Opinion;
        approval.ProcessedAt = DateTime.UtcNow;

        if (dto.Status == ApprovalStatus.Rejected)
        {
            miningRight.Status = MiningRightStatus.Rejected;
            miningRight.CurrentApprovalLevel = null;
        }
        else if (dto.Status == ApprovalStatus.Approved)
        {
            if (currentLevel >= MaxApprovalLevels)
            {
                miningRight.Status = miningRight.ChangeType switch
                {
                    MiningRightChangeType.Cancellation => MiningRightStatus.Cancelled,
                    _ => MiningRightStatus.Active
                };
                miningRight.CurrentApprovalLevel = null;
                miningRight.ApprovedAt = DateTime.UtcNow;

                if (miningRight.ChangeType == MiningRightChangeType.Cancellation)
                {
                    miningRight.ValidTo = DateTime.UtcNow;
                }
            }
            else
            {
                miningRight.CurrentApprovalLevel = currentLevel + 1;
            }
        }

        await _dbContext.SaveChangesAsync();
        return await GetByIdAsync(dto.MiningRightId);
    }

    public async Task CheckAndRemindPendingApprovalsAsync()
    {
        var cutoffTime = DateTime.UtcNow.AddHours(-ApprovalTimeoutHours);
        var pendingApprovals = await _dbContext.MiningRightApprovals
            .Where(a => a.Status == ApprovalStatus.Pending && a.CreatedAt < cutoffTime)
            .Include(a => a.MiningRight)
            .ToListAsync();

        foreach (var approval in pendingApprovals)
        {
            if (approval.MiningRight != null && approval.ApprovalLevel < MaxApprovalLevels)
            {
                approval.MiningRight.CurrentApprovalLevel = approval.ApprovalLevel + 1;
            }
        }

        await _dbContext.SaveChangesAsync();
    }

    private async Task<MiningRightDto> MapToDtoAsync(MiningRight mr)
    {
        var mine = mr.Mine ?? await _dbContext.Mines.FindAsync(mr.MineId);
        return new MiningRightDto
        {
            Id = mr.Id,
            LicenseNo = mr.LicenseNo,
            MineId = mr.MineId,
            MineName = mine?.Name ?? string.Empty,
            MineType = mr.MineType,
            MiningArea = mr.MiningArea,
            ValidFrom = mr.ValidFrom,
            ValidTo = mr.ValidTo,
            Holder = mr.Holder,
            Status = mr.Status,
            ChangeType = mr.ChangeType,
            Remark = mr.Remark,
            CreatedAt = mr.CreatedAt,
            ApprovedAt = mr.ApprovedAt,
            CurrentApprovalLevel = mr.CurrentApprovalLevel,
            Approvals = mr.Approvals?.Select(a => new MiningRightApprovalDtoItem
            {
                Id = a.Id,
                ApprovalLevel = a.ApprovalLevel,
                ApproverId = a.ApproverId,
                ApproverName = a.Approver?.RealName,
                Status = a.Status,
                Opinion = a.Opinion,
                CreatedAt = a.CreatedAt,
                ProcessedAt = a.ProcessedAt
            }).ToList() ?? []
        };
    }
}
