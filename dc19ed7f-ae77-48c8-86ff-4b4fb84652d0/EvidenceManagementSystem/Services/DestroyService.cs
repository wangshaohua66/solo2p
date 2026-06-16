using EvidenceManagementSystem.Common;
using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Models.Entities;
using EvidenceManagementSystem.Models.Enums;
using EvidenceManagementSystem.Repositories;

namespace EvidenceManagementSystem.Services;

public class DestroyService : IDestroyService
{
    private readonly IDestroyRequestRepository _destroyRepository;
    private readonly IEvidenceRepository _evidenceRepository;
    private readonly IUserRepository _userRepository;
    private readonly IChainRecordRepository _chainRepository;

    public DestroyService(
        IDestroyRequestRepository destroyRepository,
        IEvidenceRepository evidenceRepository,
        IUserRepository userRepository,
        IChainRecordRepository chainRepository)
    {
        _destroyRepository = destroyRepository;
        _evidenceRepository = evidenceRepository;
        _userRepository = userRepository;
        _chainRepository = chainRepository;
    }

    public async Task<DestroyRequestDto> CreateRequestAsync(CreateDestroyRequestRequest request, Guid operatorId, string operatorName)
    {
        var evidence = await _evidenceRepository.GetByIdAsync(request.EvidenceId)
            ?? throw new BusinessException("物证不存在", 404);

        if (evidence.IsDestroyed)
        {
            throw new BusinessException("物证已被销毁", 400);
        }

        var requestNumber = BarcodeGenerator.GenerateTaskNumber("XH");

        var destroyRequest = new DestroyRequest
        {
            Id = Guid.NewGuid(),
            RequestNumber = requestNumber,
            EvidenceId = request.EvidenceId,
            Reason = request.Reason,
            RequestedById = operatorId,
            RequestedAt = DateTime.UtcNow,
            IsApproved = false,
            IsExecuted = false,
            Remark = request.Remark
        };

        var created = await _destroyRepository.AddAsync(destroyRequest);
        return await MapToDto(created);
    }

    public async Task<DestroyRequestDto?> GetByIdAsync(Guid id)
    {
        var request = await _destroyRepository.GetByIdAsync(id);
        return request == null ? null : await MapToDto(request);
    }

    public async Task<DestroyRequestDto?> GetByRequestNumberAsync(string requestNumber)
    {
        var request = await _destroyRepository.GetByRequestNumberAsync(requestNumber);
        return request == null ? null : await MapToDto(request);
    }

    public async Task<PagedResult<DestroyRequestDto>> SearchAsync(DestroyQuery query)
    {
        var result = await _destroyRepository.SearchAsync(query);
        var dtos = new List<DestroyRequestDto>();
        foreach (var req in result.Items)
        {
            dtos.Add(await MapToDto(req));
        }

        return new PagedResult<DestroyRequestDto>
        {
            Items = dtos,
            TotalCount = result.TotalCount,
            PageNumber = result.PageNumber,
            PageSize = result.PageSize
        };
    }

    public async Task<DestroyRequestDto> ApproveAsync(Guid requestId, ApproveDestroyRequest request, Guid leaderId, string leaderName)
    {
        var destroyRequest = await _destroyRepository.GetByIdAsync(requestId)
            ?? throw new BusinessException("销毁申请不存在", 404);

        if (destroyRequest.IsApproved)
        {
            throw new BusinessException("申请已审批", 400);
        }

        destroyRequest.IsApproved = request.IsApproved;
        destroyRequest.ApprovedById = leaderId;
        destroyRequest.ApprovedAt = DateTime.UtcNow;
        destroyRequest.ApprovalOpinion = request.ApprovalOpinion;

        await _destroyRepository.UpdateAsync(destroyRequest);
        return await MapToDto(destroyRequest);
    }

    public async Task<DestroyRequestDto> ExecuteDestroyAsync(Guid requestId, ExecuteDestroyRequest request, Guid operatorId)
    {
        var destroyRequest = await _destroyRepository.GetByIdAsync(requestId)
            ?? throw new BusinessException("销毁申请不存在", 404);

        if (!destroyRequest.IsApproved)
        {
            throw new BusinessException("销毁申请未通过审批，无法执行", 400);
        }

        if (destroyRequest.IsExecuted)
        {
            throw new BusinessException("销毁已执行", 400);
        }

        var evidence = await _evidenceRepository.GetByIdAsync(destroyRequest.EvidenceId);
        if (evidence == null)
        {
            throw new BusinessException("物证不存在", 404);
        }

        if (evidence.IsDestroyed)
        {
            throw new BusinessException("物证已销毁", 400);
        }

        var statusBefore = evidence.Status;
        evidence.IsDestroyed = true;
        evidence.DestroyedAt = DateTime.UtcNow;
        evidence.DestroyApprovedBy = destroyRequest.ApprovedById;
        evidence.DestroyRemark = request.Remark;
        evidence.Status = EvidenceStatus.Destroyed;
        evidence.UpdatedAt = DateTime.UtcNow;

        await _evidenceRepository.UpdateAsync(evidence);

        var operatorUser = await _userRepository.GetByIdAsync(operatorId);
        await AddChainRecord(evidence.Id, ChainOperationType.Destroy,
            statusBefore, EvidenceStatus.Destroyed,
            operatorId, operatorUser?.RealName ?? "未知",
            request.ImageHash, $"执行销毁: {destroyRequest.RequestNumber}");

        destroyRequest.IsExecuted = true;
        destroyRequest.ExecutedAt = DateTime.UtcNow;
        destroyRequest.Executor1Name = request.Executor1Name;
        destroyRequest.Executor2Name = request.Executor2Name;
        destroyRequest.ImageHash = request.ImageHash;
        destroyRequest.Remark = request.Remark;

        await _destroyRepository.UpdateAsync(destroyRequest);

        return await MapToDto(destroyRequest);
    }

    public async Task<List<DestroyRequestDto>> GetByEvidenceIdAsync(Guid evidenceId)
    {
        var requests = await _destroyRepository.GetByEvidenceIdAsync(evidenceId);
        var dtos = new List<DestroyRequestDto>();
        foreach (var req in requests)
        {
            dtos.Add(await MapToDto(req));
        }
        return dtos;
    }

    private async Task AddChainRecord(Guid evidenceId, ChainOperationType operationType,
        EvidenceStatus statusBefore, EvidenceStatus statusAfter,
        Guid operatorId, string operatorName,
        string? imageHash = null, string? remark = null)
    {
        var lastRecord = await _chainRepository.GetLastRecordAsync(evidenceId);
        var sequenceNumber = await _chainRepository.GetNextSequenceNumberAsync(evidenceId);

        var record = new ChainRecord
        {
            Id = Guid.NewGuid(),
            EvidenceId = evidenceId,
            OperationType = operationType,
            StatusBefore = statusBefore,
            StatusAfter = statusAfter,
            OperatorId = operatorId,
            OperatorName = operatorName,
            OperationTime = DateTime.UtcNow,
            ImageHash = imageHash,
            Remark = remark,
            PreviousRecordHash = lastRecord?.RecordHash ?? string.Empty,
            SequenceNumber = sequenceNumber
        };

        var hashInput = $"{record.Id}{record.EvidenceId}{record.OperationType}" +
                       $"{record.OperatorId}{record.OperationTime}{record.PreviousRecordHash}{record.SequenceNumber}";
        record.RecordHash = HashHelper.ComputeSha256Hash(hashInput);

        await _chainRepository.AddAsync(record);
    }

    private async Task<DestroyRequestDto> MapToDto(DestroyRequest request)
    {
        var evidence = await _evidenceRepository.GetByIdAsync(request.EvidenceId);
        var requester = await _userRepository.GetByIdAsync(request.RequestedById);
        var approver = request.ApprovedById.HasValue ? await _userRepository.GetByIdAsync(request.ApprovedById.Value) : null;

        return new DestroyRequestDto
        {
            Id = request.Id,
            RequestNumber = request.RequestNumber,
            EvidenceId = request.EvidenceId,
            EvidenceBarcode = evidence?.Barcode ?? string.Empty,
            EvidenceName = evidence?.Name ?? string.Empty,
            Reason = request.Reason,
            RequestedById = request.RequestedById,
            RequestedByName = requester?.RealName ?? string.Empty,
            RequestedAt = request.RequestedAt,
            ApprovedById = request.ApprovedById,
            ApprovedByName = approver?.RealName,
            ApprovedAt = request.ApprovedAt,
            IsApproved = request.IsApproved,
            ApprovalOpinion = request.ApprovalOpinion,
            IsExecuted = request.IsExecuted,
            ExecutedAt = request.ExecutedAt,
            Executor1Name = request.Executor1Name,
            Executor2Name = request.Executor2Name,
            ImageHash = request.ImageHash,
            Remark = request.Remark
        };
    }
}
