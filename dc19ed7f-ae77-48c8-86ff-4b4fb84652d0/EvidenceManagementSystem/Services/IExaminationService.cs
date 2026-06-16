using EvidenceManagementSystem.Models.DTOs;

namespace EvidenceManagementSystem.Services;

public interface IExaminationService
{
    Task<ExaminationTaskDto> CreateTaskAsync(CreateExaminationTaskRequest request, Guid operatorId, string operatorName);
    Task<ExaminationTaskDto?> GetByIdAsync(Guid id);
    Task<ExaminationTaskDto?> GetByTaskNumberAsync(string taskNumber);
    Task<PagedResult<ExaminationTaskDto>> SearchAsync(ExaminationQuery query);
    Task<ExaminationTaskDto> StartExaminationAsync(Guid taskId, StartExaminationRequest request, Guid examinerId);
    Task<ExaminationRecordDto> AddRecordAsync(Guid taskId, AddExaminationRecordRequest request, Guid examinerId);
    Task<ExaminationTaskDto> SubmitReportAsync(Guid taskId, SubmitReportRequest request, Guid examinerId);
    Task<ExaminationTaskDto> ReviewReportAsync(Guid taskId, ReviewReportRequest request, Guid reviewerId);
    Task<ExaminationTaskDto> IssueReportAsync(Guid taskId, Guid reviewerId);
    Task<List<ExaminationRecordDto>> GetRecordsByTaskIdAsync(Guid taskId);
}
