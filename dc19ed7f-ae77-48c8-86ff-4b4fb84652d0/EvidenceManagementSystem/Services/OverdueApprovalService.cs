using System.Text.Json;
using EvidenceManagementSystem.Common;
using EvidenceManagementSystem.Data;
using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Models.Entities;
using EvidenceManagementSystem.Models.Enums;
using EvidenceManagementSystem.Repositories;
using Microsoft.EntityFrameworkCore;

namespace EvidenceManagementSystem.Services;

public class OverdueApprovalService : IOverdueApprovalService
{
    private readonly AppDbContext _context;
    private readonly IOverdueApprovalRepository _approvalRepository;
    private readonly IOverdueWarningRepository _warningRepository;
    private readonly IEvidenceRepository _evidenceRepository;
    private readonly IChainRecordRepository _chainRepository;
    private readonly IUserRepository _userRepository;

    public OverdueApprovalService(
        AppDbContext context,
        IOverdueApprovalRepository approvalRepository,
        IOverdueWarningRepository warningRepository,
        IEvidenceRepository evidenceRepository,
        IChainRecordRepository chainRepository,
        IUserRepository userRepository)
    {
        _context = context;
        _approvalRepository = approvalRepository;
        _warningRepository = warningRepository;
        _evidenceRepository = evidenceRepository;
        _chainRepository = chainRepository;
        _userRepository = userRepository;
    }

    public async Task<OverdueApprovalDto> SubmitApprovalAsync(
        SubmitOverdueApprovalRequest request,
        Guid operatorId,
        string operatorName)
    {
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var warning = await _warningRepository.GetByIdAsync(request.WarningId)
                ?? throw new BusinessException("预警记录不存在", 404);

            if (!warning.IsOverdue)
                throw new BusinessException("该预警非超期预警，无需审批", 400);

            if (warning.Resolved)
                throw new BusinessException("该预警已处理", 400);

            var existingApproval = await _approvalRepository.GetByWarningIdAsync(request.WarningId);
            if (existingApproval != null && existingApproval.Status == OverdueApprovalStatus.Pending)
                throw new BusinessException("该超期物证已有待审批的申请", 400);

            var evidence = await _evidenceRepository.GetByIdAsync(warning.EvidenceId)
                ?? throw new BusinessException("物证不存在", 404);

            var daysOverdue = (int)(DateTime.UtcNow - warning.ExpectedExpiryDate).TotalDays;

            var approval = new OverdueApproval
            {
                Id = Guid.NewGuid(),
                EvidenceId = warning.EvidenceId,
                WarningId = warning.Id,
                Barcode = warning.Barcode,
                EvidenceName = warning.EvidenceName,
                Justification = request.Justification,
                ExpectedExpiryDate = warning.ExpectedExpiryDate,
                DaysOverdue = daysOverdue,
                Status = OverdueApprovalStatus.Pending,
                SubmittedById = operatorId,
                SubmittedAt = DateTime.UtcNow
            };

            var createdApproval = await _approvalRepository.AddAsync(approval);

            var chainRecord = new ChainRecord
            {
                Id = Guid.NewGuid(),
                EvidenceId = evidence.Id,
                SequenceNumber = await _chainRepository.GetNextSequenceNumberAsync(evidence.Id),
                OperationType = ChainOperationType.OverdueApprovalSubmitted,
                OperatorId = operatorId,
                OperatorName = operatorName,
                OperationTime = DateTime.UtcNow,
                StatusBefore = evidence.Status,
                StatusAfter = evidence.Status,
                Remark = $"提交超期解除审批：{request.Justification}",
                RecordHash = string.Empty
            };
            var chainData = JsonSerializer.Serialize(new
            {
                chainRecord.EvidenceId,
                chainRecord.SequenceNumber,
                chainRecord.OperationType,
                chainRecord.OperatorId,
                chainRecord.OperationTime,
                chainRecord.StatusBefore,
                chainRecord.StatusAfter,
                chainRecord.Remark
            });
            chainRecord.RecordHash = HashHelper.ComputeSha256Hash(chainData);
            await _chainRepository.AddAsync(chainRecord);

            await transaction.CommitAsync();
            return await MapToDto(createdApproval);
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<OverdueApprovalDto> ApproveAsync(
        Guid approvalId,
        ApproveOverdueRequest request,
        Guid operatorId,
        string operatorName)
    {
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var approval = await _approvalRepository.GetByIdAsync(approvalId)
                ?? throw new BusinessException("审批申请不存在", 404);

            if (approval.Status != OverdueApprovalStatus.Pending)
                throw new BusinessException("该申请已处理", 400);

            var warning = await _warningRepository.GetByIdAsync(approval.WarningId)
                ?? throw new BusinessException("预警记录不存在", 404);

            var evidence = await _evidenceRepository.GetByIdAsync(approval.EvidenceId)
                ?? throw new BusinessException("物证不存在", 404);

            approval.Status = OverdueApprovalStatus.Approved;
            approval.ApprovedById = operatorId;
            approval.ApprovedAt = DateTime.UtcNow;
            approval.ApprovalRemark = request.ApprovalRemark;
            await _approvalRepository.UpdateAsync(approval);

            warning.Resolved = true;
            warning.ResolvedAt = DateTime.UtcNow;
            warning.ResolveRemark = $"审批通过：{request.ApprovalRemark}";
            await _warningRepository.UpdateAsync(warning);

            var oldStatus = evidence.Status;
            evidence.IsOverdue = false;
            if (evidence.Status == EvidenceStatus.Overdue)
            {
                evidence.Status = EvidenceStatus.InStorage;
            }
            evidence.UpdatedAt = DateTime.UtcNow;
            await _evidenceRepository.UpdateAsync(evidence);

            var chainRecord = new ChainRecord
            {
                Id = Guid.NewGuid(),
                EvidenceId = evidence.Id,
                SequenceNumber = await _chainRepository.GetNextSequenceNumberAsync(evidence.Id),
                OperationType = ChainOperationType.OverdueApprovalApproved,
                OperatorId = operatorId,
                OperatorName = operatorName,
                OperationTime = DateTime.UtcNow,
                StatusBefore = oldStatus,
                StatusAfter = evidence.Status,
                Remark = $"超期解除审批通过：{request.ApprovalRemark}",
                RecordHash = string.Empty
            };
            var chainData = JsonSerializer.Serialize(new
            {
                chainRecord.EvidenceId,
                chainRecord.SequenceNumber,
                chainRecord.OperationType,
                chainRecord.OperatorId,
                chainRecord.OperationTime,
                chainRecord.StatusBefore,
                chainRecord.StatusAfter,
                chainRecord.Remark
            });
            chainRecord.RecordHash = HashHelper.ComputeSha256Hash(chainData);
            await _chainRepository.AddAsync(chainRecord);

            await transaction.CommitAsync();
            return await MapToDto(approval);
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<OverdueApprovalDto> RejectAsync(
        Guid approvalId,
        RejectOverdueRequest request,
        Guid operatorId,
        string operatorName)
    {
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var approval = await _approvalRepository.GetByIdAsync(approvalId)
                ?? throw new BusinessException("审批申请不存在", 404);

            if (approval.Status != OverdueApprovalStatus.Pending)
                throw new BusinessException("该申请已处理", 400);

            var evidence = await _evidenceRepository.GetByIdAsync(approval.EvidenceId)
                ?? throw new BusinessException("物证不存在", 404);

            approval.Status = OverdueApprovalStatus.Rejected;
            approval.ApprovedById = operatorId;
            approval.ApprovedAt = DateTime.UtcNow;
            approval.RejectReason = request.RejectReason;
            await _approvalRepository.UpdateAsync(approval);

            var chainRecord = new ChainRecord
            {
                Id = Guid.NewGuid(),
                EvidenceId = evidence.Id,
                SequenceNumber = await _chainRepository.GetNextSequenceNumberAsync(evidence.Id),
                OperationType = ChainOperationType.OverdueApprovalRejected,
                OperatorId = operatorId,
                OperatorName = operatorName,
                OperationTime = DateTime.UtcNow,
                StatusBefore = evidence.Status,
                StatusAfter = evidence.Status,
                Remark = $"超期解除审批被拒绝：{request.RejectReason}",
                RecordHash = string.Empty
            };
            var chainData = JsonSerializer.Serialize(new
            {
                chainRecord.EvidenceId,
                chainRecord.SequenceNumber,
                chainRecord.OperationType,
                chainRecord.OperatorId,
                chainRecord.OperationTime,
                chainRecord.StatusBefore,
                chainRecord.StatusAfter,
                chainRecord.Remark
            });
            chainRecord.RecordHash = HashHelper.ComputeSha256Hash(chainData);
            await _chainRepository.AddAsync(chainRecord);

            await transaction.CommitAsync();
            return await MapToDto(approval);
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<OverdueApprovalDto?> GetByIdAsync(Guid id)
    {
        var approval = await _approvalRepository.GetByIdAsync(id);
        return approval == null ? null : await MapToDto(approval);
    }

    public async Task<PagedResult<OverdueApprovalDto>> SearchAsync(OverdueApprovalQuery query)
    {
        var result = await _approvalRepository.SearchAsync(query);
        var dtos = new List<OverdueApprovalDto>();
        foreach (var approval in result.Items)
        {
            dtos.Add(await MapToDto(approval));
        }

        return new PagedResult<OverdueApprovalDto>
        {
            Items = dtos,
            TotalCount = result.TotalCount,
            PageNumber = result.PageNumber,
            PageSize = result.PageSize
        };
    }

    private async Task<OverdueApprovalDto> MapToDto(OverdueApproval approval)
    {
        var submitter = await _userRepository.GetByIdAsync(approval.SubmittedById);
        var approver = approval.ApprovedById.HasValue
            ? await _userRepository.GetByIdAsync(approval.ApprovedById.Value)
            : null;

        return new OverdueApprovalDto
        {
            Id = approval.Id,
            EvidenceId = approval.EvidenceId,
            WarningId = approval.WarningId,
            Barcode = approval.Barcode,
            EvidenceName = approval.EvidenceName,
            Justification = approval.Justification,
            ExpectedExpiryDate = approval.ExpectedExpiryDate,
            DaysOverdue = approval.DaysOverdue,
            Status = approval.Status,
            SubmittedById = approval.SubmittedById,
            SubmittedByName = submitter?.RealName ?? string.Empty,
            SubmittedAt = approval.SubmittedAt,
            ApprovedById = approval.ApprovedById,
            ApprovedByName = approver?.RealName,
            ApprovedAt = approval.ApprovedAt,
            ApprovalRemark = approval.ApprovalRemark,
            RejectReason = approval.RejectReason
        };
    }
}
