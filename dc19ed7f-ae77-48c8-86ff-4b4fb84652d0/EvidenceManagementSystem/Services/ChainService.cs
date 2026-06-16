using EvidenceManagementSystem.Common;
using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Models.Entities;
using EvidenceManagementSystem.Repositories;

namespace EvidenceManagementSystem.Services;

public class ChainService : IChainService
{
    private readonly IChainRecordRepository _chainRepository;
    private readonly IEvidenceRepository _evidenceRepository;

    public ChainService(IChainRecordRepository chainRepository, IEvidenceRepository evidenceRepository)
    {
        _chainRepository = chainRepository;
        _evidenceRepository = evidenceRepository;
    }

    public async Task<ChainRecordDto?> GetByIdAsync(Guid id)
    {
        var record = await _chainRepository.GetByIdAsync(id);
        return record == null ? null : await MapToDto(record);
    }

    public async Task<PagedResult<ChainRecordDto>> SearchAsync(ChainQuery query)
    {
        var result = await _chainRepository.SearchAsync(query);
        var dtos = new List<ChainRecordDto>();
        foreach (var item in result.Items)
        {
            dtos.Add(await MapToDto(item));
        }

        return new PagedResult<ChainRecordDto>
        {
            Items = dtos,
            TotalCount = result.TotalCount,
            PageNumber = result.PageNumber,
            PageSize = result.PageSize
        };
    }

    public async Task<List<ChainRecordDto>> GetChainByEvidenceIdAsync(Guid evidenceId)
    {
        var records = await _chainRepository.GetByEvidenceIdAsync(evidenceId);
        var dtos = new List<ChainRecordDto>();
        foreach (var record in records)
        {
            dtos.Add(await MapToDto(record));
        }
        return dtos;
    }

    public async Task<List<ChainRecordDto>> GetChainForwardAsync(Guid evidenceId, DateTime fromTime)
    {
        var records = await _chainRepository.GetChainForwardAsync(evidenceId, fromTime);
        var dtos = new List<ChainRecordDto>();
        foreach (var record in records)
        {
            dtos.Add(await MapToDto(record));
        }
        return dtos;
    }

    public async Task<List<ChainRecordDto>> GetChainBackwardAsync(Guid evidenceId, DateTime toTime)
    {
        var records = await _chainRepository.GetChainBackwardAsync(evidenceId, toTime);
        var dtos = new List<ChainRecordDto>();
        foreach (var record in records)
        {
            dtos.Add(await MapToDto(record));
        }
        return dtos;
    }

    public async Task<bool> VerifyChainIntegrityAsync(Guid evidenceId)
    {
        var records = await _chainRepository.GetByEvidenceIdAsync(evidenceId);
        if (records.Count == 0)
            return true;

        var orderedRecords = records.OrderBy(r => r.SequenceNumber).ToList();

        for (int i = 0; i < orderedRecords.Count; i++)
        {
            var current = orderedRecords[i];
            var hashInput = $"{current.Id}{current.EvidenceId}{current.OperationType}" +
                           $"{current.OperatorId}{current.OperationTime}{current.PreviousRecordHash}{current.SequenceNumber}";
            var computedHash = HashHelper.ComputeSha256Hash(hashInput);

            if (computedHash != current.RecordHash)
                return false;

            if (i > 0)
            {
                var previous = orderedRecords[i - 1];
                if (current.PreviousRecordHash != previous.RecordHash)
                    return false;
            }
            else
            {
                if (current.PreviousRecordHash != string.Empty)
                    return false;
            }
        }

        return true;
    }

    private async Task<ChainRecordDto> MapToDto(ChainRecord record)
    {
        var evidence = await _evidenceRepository.GetByIdAsync(record.EvidenceId);
        return new ChainRecordDto
        {
            Id = record.Id,
            EvidenceId = record.EvidenceId,
            EvidenceBarcode = evidence?.Barcode ?? string.Empty,
            EvidenceName = evidence?.Name ?? string.Empty,
            OperationType = record.OperationType,
            StatusBefore = record.StatusBefore,
            StatusAfter = record.StatusAfter,
            OperatorId = record.OperatorId,
            OperatorName = record.OperatorName,
            OperationTime = record.OperationTime,
            FromDepartment = record.FromDepartment,
            ToDepartment = record.ToDepartment,
            ImageHash = record.ImageHash,
            Remark = record.Remark,
            SequenceNumber = record.SequenceNumber,
            RecordHash = record.RecordHash,
            PreviousRecordHash = record.PreviousRecordHash
        };
    }
}
