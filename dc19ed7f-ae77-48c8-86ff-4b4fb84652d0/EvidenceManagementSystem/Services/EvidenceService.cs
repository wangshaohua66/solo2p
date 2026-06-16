using EvidenceManagementSystem.Common;
using EvidenceManagementSystem.Data;
using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Models.Entities;
using EvidenceManagementSystem.Models.Enums;
using EvidenceManagementSystem.Repositories;
using Microsoft.EntityFrameworkCore;

namespace EvidenceManagementSystem.Services;

public class EvidenceService : IEvidenceService
{
    private readonly IEvidenceRepository _evidenceRepository;
    private readonly IChainRecordRepository _chainRepository;
    private readonly AppDbContext _context;

    public EvidenceService(
        IEvidenceRepository evidenceRepository,
        IChainRecordRepository chainRepository,
        AppDbContext context)
    {
        _evidenceRepository = evidenceRepository;
        _chainRepository = chainRepository;
        _context = context;
    }

    public async Task<EvidenceDto> CreateAsync(CreateEvidenceRequest request, Guid operatorId, string operatorName)
    {
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var categoryCode = BarcodeGenerator.GetCategoryCode((int)request.Category);
            var barcode = BarcodeGenerator.GenerateBarcode(categoryCode);

            var evidence = new Evidence
            {
                Id = Guid.NewGuid(),
                Barcode = barcode,
                CategoryCode = categoryCode,
                Category = request.Category,
                Name = request.Name,
                Description = request.Description,
                CaseNumber = request.CaseNumber,
                SuspectInfo = request.SuspectInfo,
                ExtractionTime = request.ExtractionTime,
                ExtractionLocation = request.ExtractionLocation,
                ExtractedBy = request.ExtractedBy,
                PackagingMethod = request.PackagingMethod,
                StorageCondition = request.StorageCondition,
                StorageLocation = request.StorageLocation,
                ShelfNumber = request.ShelfNumber,
                Status = EvidenceStatus.Registered,
                StorageDaysLimit = request.StorageDaysLimit,
                ReceivedAt = DateTime.UtcNow,
                IsOverdue = false,
                IsDestroyed = false,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = operatorId
            };

            var created = await _evidenceRepository.AddAsync(evidence);

            await AddChainRecord(created.Id, ChainOperationType.Register,
                EvidenceStatus.Registered, EvidenceStatus.Registered,
                operatorId, operatorName, null, null);

            await transaction.CommitAsync();
            return MapToDto(created);
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<EvidenceDto?> GetByIdAsync(Guid id)
    {
        var evidence = await _evidenceRepository.GetByIdAsync(id);
        return evidence == null ? null : MapToDto(evidence);
    }

    public async Task<EvidenceDto?> GetByBarcodeAsync(string barcode)
    {
        var evidence = await _evidenceRepository.GetByBarcodeAsync(barcode);
        return evidence == null ? null : MapToDto(evidence);
    }

    public async Task<PagedResult<EvidenceDto>> SearchAsync(EvidenceQuery query)
    {
        var result = await _evidenceRepository.SearchAsync(query);
        return new PagedResult<EvidenceDto>
        {
            Items = result.Items.Select(MapToDto).ToList(),
            TotalCount = result.TotalCount,
            PageNumber = result.PageNumber,
            PageSize = result.PageSize
        };
    }

    public async Task<EvidenceDto> UpdateAsync(Guid id, UpdateEvidenceRequest request, Guid operatorId)
    {
        var evidence = await _evidenceRepository.GetByIdAsync(id)
            ?? throw new BusinessException("物证不存在", 404);

        if (evidence.IsDestroyed)
        {
            throw new BusinessException("已销毁物证无法修改", 400);
        }

        if (!string.IsNullOrEmpty(request.Name))
            evidence.Name = request.Name;
        if (!string.IsNullOrEmpty(request.Description))
            evidence.Description = request.Description;
        if (!string.IsNullOrEmpty(request.StorageLocation))
            evidence.StorageLocation = request.StorageLocation;
        if (!string.IsNullOrEmpty(request.ShelfNumber))
            evidence.ShelfNumber = request.ShelfNumber;
        if (request.StorageCondition.HasValue)
            evidence.StorageCondition = request.StorageCondition.Value;

        evidence.UpdatedAt = DateTime.UtcNow;
        await _evidenceRepository.UpdateAsync(evidence);
        return MapToDto(evidence);
    }

    public async Task<EvidenceDto> InboundAsync(InboundRequest request, Guid operatorId, string operatorName)
    {
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var evidence = await _evidenceRepository.GetByIdAsync(request.EvidenceId)
                ?? throw new BusinessException("物证不存在", 404);

            if (evidence.IsDestroyed)
            {
                throw new BusinessException("已销毁物证无法入库", 400);
            }

            var statusBefore = evidence.Status;

            evidence.StorageLocation = request.StorageLocation;
            evidence.ShelfNumber = request.ShelfNumber;
            evidence.Status = EvidenceStatus.InStorage;
            evidence.StorageStartTime = DateTime.UtcNow;
            evidence.ExpectedExpiryDate = DateTime.UtcNow.AddDays(evidence.StorageDaysLimit);
            evidence.UpdatedAt = DateTime.UtcNow;

            await _evidenceRepository.UpdateAsync(evidence);

            await AddChainRecord(evidence.Id, ChainOperationType.Inbound,
                statusBefore, EvidenceStatus.InStorage,
                operatorId, operatorName, request.ImageHash, request.Remark);

            await transaction.CommitAsync();
            return MapToDto(evidence);
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<EvidenceDto> OutboundAsync(OutboundRequest request, Guid operatorId, string operatorName)
    {
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var evidence = await _evidenceRepository.GetByIdAsync(request.EvidenceId)
                ?? throw new BusinessException("物证不存在", 404);

            if (evidence.IsDestroyed)
            {
                throw new BusinessException("已销毁物证无法出库", 400);
            }

            if (evidence.IsOverdue)
            {
                throw new BusinessException("超期物证需经领导审批后方可出库", 403);
            }

            var statusBefore = evidence.Status;
            evidence.Status = EvidenceStatus.InExamination;
            evidence.UpdatedAt = DateTime.UtcNow;

            await _evidenceRepository.UpdateAsync(evidence);

            await AddChainRecord(evidence.Id, ChainOperationType.Outbound,
                statusBefore, EvidenceStatus.InExamination,
                operatorId, operatorName, request.ImageHash, request.Remark,
                null, request.ToDepartment);

            await transaction.CommitAsync();
            return MapToDto(evidence);
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var evidence = await _evidenceRepository.GetByIdAsync(id);
        if (evidence == null)
            return false;

        if (evidence.IsDestroyed)
        {
            throw new BusinessException("已销毁物证无法删除", 400);
        }

        await _evidenceRepository.DeleteAsync(evidence);
        return true;
    }

    private async Task AddChainRecord(Guid evidenceId, ChainOperationType operationType,
        EvidenceStatus statusBefore, EvidenceStatus statusAfter,
        Guid operatorId, string operatorName,
        string? imageHash = null, string? remark = null,
        string? fromDept = null, string? toDept = null)
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
            FromDepartment = fromDept,
            ToDepartment = toDept,
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

    private static EvidenceDto MapToDto(Evidence evidence)
    {
        return new EvidenceDto
        {
            Id = evidence.Id,
            Barcode = evidence.Barcode,
            CategoryCode = evidence.CategoryCode,
            Category = evidence.Category,
            Name = evidence.Name,
            Description = evidence.Description,
            CaseNumber = evidence.CaseNumber,
            SuspectInfo = evidence.SuspectInfo,
            ExtractionTime = evidence.ExtractionTime,
            ExtractionLocation = evidence.ExtractionLocation,
            ExtractedBy = evidence.ExtractedBy,
            PackagingMethod = evidence.PackagingMethod,
            StorageCondition = evidence.StorageCondition,
            StorageLocation = evidence.StorageLocation,
            ShelfNumber = evidence.ShelfNumber,
            Status = evidence.Status,
            StorageDaysLimit = evidence.StorageDaysLimit,
            ReceivedAt = evidence.ReceivedAt,
            StorageStartTime = evidence.StorageStartTime,
            ExpectedExpiryDate = evidence.ExpectedExpiryDate,
            IsOverdue = evidence.IsOverdue,
            IsDestroyed = evidence.IsDestroyed,
            CreatedAt = evidence.CreatedAt
        };
    }
}
