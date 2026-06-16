using EvidenceManagementSystem.Common;
using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Models.Entities;
using EvidenceManagementSystem.Models.Enums;
using EvidenceManagementSystem.Repositories;

namespace EvidenceManagementSystem.Services;

public class ExaminationService : IExaminationService
{
    private readonly IExaminationRepository _examinationRepository;
    private readonly IExaminationRecordRepository _recordRepository;
    private readonly IEvidenceRepository _evidenceRepository;
    private readonly IUserRepository _userRepository;
    private readonly IChainRecordRepository _chainRepository;

    public ExaminationService(
        IExaminationRepository examinationRepository,
        IExaminationRecordRepository recordRepository,
        IEvidenceRepository evidenceRepository,
        IUserRepository userRepository,
        IChainRecordRepository chainRepository)
    {
        _examinationRepository = examinationRepository;
        _recordRepository = recordRepository;
        _evidenceRepository = evidenceRepository;
        _userRepository = userRepository;
        _chainRepository = chainRepository;
    }

    public async Task<ExaminationTaskDto> CreateTaskAsync(CreateExaminationTaskRequest request, Guid operatorId, string operatorName)
    {
        var evidence = await _evidenceRepository.GetByIdAsync(request.EvidenceId)
            ?? throw new BusinessException("物证不存在", 404);

        if (evidence.IsDestroyed)
        {
            throw new BusinessException("已销毁物证无法进行鉴定", 400);
        }

        var examiner = await _userRepository.GetByIdAsync(request.ExaminerId)
            ?? throw new BusinessException("鉴定人不存在", 404);

        var taskNumber = BarcodeGenerator.GenerateTaskNumber("JD");

        var task = new ExaminationTask
        {
            Id = Guid.NewGuid(),
            EvidenceId = request.EvidenceId,
            TaskNumber = taskNumber,
            ExaminationType = request.ExaminationType,
            Description = request.Description,
            ExaminerId = request.ExaminerId,
            Status = ExaminationStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        var created = await _examinationRepository.AddAsync(task);
        return await MapToDto(created);
    }

    public async Task<ExaminationTaskDto?> GetByIdAsync(Guid id)
    {
        var task = await _examinationRepository.GetByIdAsync(id);
        return task == null ? null : await MapToDto(task);
    }

    public async Task<ExaminationTaskDto?> GetByTaskNumberAsync(string taskNumber)
    {
        var task = await _examinationRepository.GetByTaskNumberAsync(taskNumber);
        return task == null ? null : await MapToDto(task);
    }

    public async Task<PagedResult<ExaminationTaskDto>> SearchAsync(ExaminationQuery query)
    {
        var result = await _examinationRepository.SearchAsync(query);
        var dtos = new List<ExaminationTaskDto>();
        foreach (var task in result.Items)
        {
            dtos.Add(await MapToDto(task));
        }

        return new PagedResult<ExaminationTaskDto>
        {
            Items = dtos,
            TotalCount = result.TotalCount,
            PageNumber = result.PageNumber,
            PageSize = result.PageSize
        };
    }

    public async Task<ExaminationTaskDto> StartExaminationAsync(Guid taskId, StartExaminationRequest request, Guid examinerId)
    {
        var task = await _examinationRepository.GetByIdAsync(taskId)
            ?? throw new BusinessException("鉴定任务不存在", 404);

        if (task.ExaminerId != examinerId)
        {
            throw new BusinessException("只能开始自己的鉴定任务", 403);
        }

        if (task.Status != ExaminationStatus.Pending && task.Status != ExaminationStatus.Rejected)
        {
            throw new BusinessException("当前状态无法开始鉴定", 400);
        }

        task.Status = ExaminationStatus.InProgress;
        task.StartedAt = DateTime.UtcNow;
        task.InstrumentInfo = request.InstrumentInfo;
        task.UpdatedAt = DateTime.UtcNow;

        await _examinationRepository.UpdateAsync(task);

        var evidence = await _evidenceRepository.GetByIdAsync(task.EvidenceId);
        if (evidence != null)
        {
            var examiner = await _userRepository.GetByIdAsync(examinerId);
            await AddChainRecord(task.EvidenceId, ChainOperationType.ExaminationStart,
                evidence.Status, EvidenceStatus.InExamination,
                examinerId, examiner?.RealName ?? "未知",
                null, $"开始鉴定: {task.TaskNumber}");

            evidence.Status = EvidenceStatus.InExamination;
            evidence.UpdatedAt = DateTime.UtcNow;
            await _evidenceRepository.UpdateAsync(evidence);
        }

        return await MapToDto(task);
    }

    public async Task<ExaminationRecordDto> AddRecordAsync(Guid taskId, AddExaminationRecordRequest request, Guid examinerId)
    {
        var task = await _examinationRepository.GetByIdAsync(taskId)
            ?? throw new BusinessException("鉴定任务不存在", 404);

        if (task.ExaminerId != examinerId)
        {
            throw new BusinessException("只能为自己的鉴定任务添加记录", 403);
        }

        if (task.Status != ExaminationStatus.InProgress)
        {
            throw new BusinessException("当前状态无法添加鉴定记录", 400);
        }

        var examiner = await _userRepository.GetByIdAsync(examinerId);

        var record = new ExaminationRecord
        {
            Id = Guid.NewGuid(),
            ExaminationTaskId = taskId,
            RoundNumber = request.RoundNumber,
            RecordContent = request.RecordContent,
            InstrumentUsed = request.InstrumentUsed,
            AnalysisData = request.AnalysisData,
            ImageHash = request.ImageHash,
            RecordedAt = DateTime.UtcNow,
            RecordedById = examinerId
        };

        var created = await _recordRepository.AddAsync(record);

        return new ExaminationRecordDto
        {
            Id = created.Id,
            RoundNumber = created.RoundNumber,
            RecordContent = created.RecordContent,
            InstrumentUsed = created.InstrumentUsed,
            AnalysisData = created.AnalysisData,
            ImageHash = created.ImageHash,
            RecordedAt = created.RecordedAt,
            RecordedById = created.RecordedById,
            RecordedByName = examiner?.RealName ?? string.Empty
        };
    }

    public async Task<ExaminationTaskDto> SubmitReportAsync(Guid taskId, SubmitReportRequest request, Guid examinerId)
    {
        var task = await _examinationRepository.GetByIdAsync(taskId)
            ?? throw new BusinessException("鉴定任务不存在", 404);

        if (task.ExaminerId != examinerId)
        {
            throw new BusinessException("只能提交自己的鉴定报告", 403);
        }

        if (task.Status != ExaminationStatus.InProgress)
        {
            throw new BusinessException("当前状态无法提交报告", 400);
        }

        task.Status = ExaminationStatus.Submitted;
        task.Conclusion = request.Conclusion;
        task.ReportDraft = request.ReportDraft;
        task.SubmittedAt = DateTime.UtcNow;
        task.UpdatedAt = DateTime.UtcNow;

        await _examinationRepository.UpdateAsync(task);
        return await MapToDto(task);
    }

    public async Task<ExaminationTaskDto> ReviewReportAsync(Guid taskId, ReviewReportRequest request, Guid reviewerId)
    {
        var task = await _examinationRepository.GetByIdAsync(taskId)
            ?? throw new BusinessException("鉴定任务不存在", 404);

        if (task.Status != ExaminationStatus.Submitted && task.Status != ExaminationStatus.UnderReview)
        {
            throw new BusinessException("当前状态无法审核", 400);
        }

        var reviewer = await _userRepository.GetByIdAsync(reviewerId);

        if (request.IsApproved)
        {
            task.Status = ExaminationStatus.Approved;
            task.ReviewerId = reviewerId;
            task.ReviewOpinion = request.Opinion;
            task.ReviewedAt = DateTime.UtcNow;
        }
        else
        {
            task.Status = ExaminationStatus.Rejected;
            task.ReviewerId = reviewerId;
            task.RejectReason = request.RejectReason;
            task.ReviewedAt = DateTime.UtcNow;
            task.RevisionCount++;
        }

        task.UpdatedAt = DateTime.UtcNow;
        await _examinationRepository.UpdateAsync(task);

        return await MapToDto(task);
    }

    public async Task<ExaminationTaskDto> IssueReportAsync(Guid taskId, Guid reviewerId)
    {
        var task = await _examinationRepository.GetByIdAsync(taskId)
            ?? throw new BusinessException("鉴定任务不存在", 404);

        if (task.Status != ExaminationStatus.Approved)
        {
            throw new BusinessException("只有审核通过的报告才能签发", 400);
        }

        task.Status = ExaminationStatus.Issued;
        task.IssuedAt = DateTime.UtcNow;
        task.UpdatedAt = DateTime.UtcNow;

        await _examinationRepository.UpdateAsync(task);

        var evidence = await _evidenceRepository.GetByIdAsync(task.EvidenceId);
        if (evidence != null)
        {
            var reviewer = await _userRepository.GetByIdAsync(reviewerId);
            await AddChainRecord(task.EvidenceId, ChainOperationType.ExaminationComplete,
                evidence.Status, EvidenceStatus.ExaminationCompleted,
                reviewerId, reviewer?.RealName ?? "未知",
                null, $"鉴定完成: {task.TaskNumber}");

            evidence.Status = EvidenceStatus.ExaminationCompleted;
            evidence.UpdatedAt = DateTime.UtcNow;
            await _evidenceRepository.UpdateAsync(evidence);
        }

        return await MapToDto(task);
    }

    public async Task<List<ExaminationRecordDto>> GetRecordsByTaskIdAsync(Guid taskId)
    {
        var records = await _recordRepository.GetByTaskIdAsync(taskId);
        var dtos = new List<ExaminationRecordDto>();
        foreach (var record in records)
        {
            var recorder = await _userRepository.GetByIdAsync(record.RecordedById);
            dtos.Add(new ExaminationRecordDto
            {
                Id = record.Id,
                RoundNumber = record.RoundNumber,
                RecordContent = record.RecordContent,
                InstrumentUsed = record.InstrumentUsed,
                AnalysisData = record.AnalysisData,
                ImageHash = record.ImageHash,
                RecordedAt = record.RecordedAt,
                RecordedById = record.RecordedById,
                RecordedByName = recorder?.RealName ?? string.Empty
            });
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

    private async Task<ExaminationTaskDto> MapToDto(ExaminationTask task)
    {
        var evidence = await _evidenceRepository.GetByIdAsync(task.EvidenceId);
        var examiner = await _userRepository.GetByIdAsync(task.ExaminerId);
        var reviewer = task.ReviewerId.HasValue ? await _userRepository.GetByIdAsync(task.ReviewerId.Value) : null;
        var records = await _recordRepository.GetByTaskIdAsync(task.Id);

        var recordDtos = new List<ExaminationRecordDto>();
        foreach (var r in records)
        {
            var recorder = await _userRepository.GetByIdAsync(r.RecordedById);
            recordDtos.Add(new ExaminationRecordDto
            {
                Id = r.Id,
                RoundNumber = r.RoundNumber,
                RecordContent = r.RecordContent,
                InstrumentUsed = r.InstrumentUsed,
                AnalysisData = r.AnalysisData,
                ImageHash = r.ImageHash,
                RecordedAt = r.RecordedAt,
                RecordedById = r.RecordedById,
                RecordedByName = recorder?.RealName ?? string.Empty
            });
        }

        return new ExaminationTaskDto
        {
            Id = task.Id,
            EvidenceId = task.EvidenceId,
            EvidenceBarcode = evidence?.Barcode ?? string.Empty,
            EvidenceName = evidence?.Name ?? string.Empty,
            TaskNumber = task.TaskNumber,
            ExaminationType = task.ExaminationType,
            Description = task.Description,
            ExaminerId = task.ExaminerId,
            ExaminerName = examiner?.RealName ?? string.Empty,
            ReviewerId = task.ReviewerId,
            ReviewerName = reviewer?.RealName,
            Status = task.Status,
            StartedAt = task.StartedAt,
            CompletedAt = task.CompletedAt,
            SubmittedAt = task.SubmittedAt,
            ReviewedAt = task.ReviewedAt,
            IssuedAt = task.IssuedAt,
            InstrumentInfo = task.InstrumentInfo,
            Conclusion = task.Conclusion,
            ReviewOpinion = task.ReviewOpinion,
            RejectReason = task.RejectReason,
            RevisionCount = task.RevisionCount,
            CreatedAt = task.CreatedAt,
            ExaminationRecords = recordDtos
        };
    }
}
