using SpecialEquipmentInspection.Common;
using SpecialEquipmentInspection.Dtos;
using SpecialEquipmentInspection.Models;
using SpecialEquipmentInspection.Repositories;

namespace SpecialEquipmentInspection.Services;

public interface IInspectionService
{
    Task<InspectionPlan> CreatePlanAsync(CreatePlanDto dto, CurrentUser user);
    Task<InspectionPlan?> GetPlanAsync(int id);
    Task<PagedResult<InspectionPlan>> GetPlansAsync(int? year, string? region, PlanStatus? status, int page, int pageSize);

    Task<Inspection> CreateInspectionAsync(CreateInspectionDto dto, CurrentUser user);
    Task<Inspection?> GetInspectionAsync(int id, CurrentUser user);
    Task<PagedResult<Inspection>> GetInspectionsAsync(
        int? deviceId, int? inspectorId, InspectionStatus? status, InspectionResult? result,
        int? planId, DateTime? dateFrom, DateTime? dateTo, int page, int pageSize, CurrentUser user);
    Task<Inspection> StartInspectionAsync(int inspectionId, CurrentUser user);
    Task<Inspection> SubmitInspectionAsync(int inspectionId, SubmitInspectionDto dto, CurrentUser user);

    Task<Rectification> CreateRectificationAsync(RectificationCreateDto dto, CurrentUser user);
    Task<Rectification> SubmitRectificationFeedbackAsync(int rectificationId, RectificationFeedbackDto dto, CurrentUser user);
    Task<Rectification> ConfirmReinspectionAsync(int rectificationId, ReinspectionDto dto, CurrentUser user);
    Task<PagedResult<Rectification>> GetRectificationsAsync(
        int? inspectionId, int? deviceId, RectificationStatus? status, int page, int pageSize, CurrentUser user);

    Task<Report> GenerateReportAsync(int inspectionId, CurrentUser user);
    Task<Report?> GetReportAsync(int reportId);
    Task<Report?> GetReportByInspectionAsync(int inspectionId);
    Task<Report> ApproveReportAsync(int reportId, ApproveReportDto dto, CurrentUser user);
    Task<PagedResult<Report>> GetReportsAsync(ReportStatus? status, int page, int pageSize);
    Task<(byte[] Content, string FileName, string MimeType)> ExportReportAsync(int reportId, string format = "html");

    Task<InspectionStatistics> GetStatisticsAsync(int? year, string? region);

    Task<TimeSeriesStatistics> GetTimeSeriesStatisticsAsync(DateTime dateFrom, DateTime dateTo, TimeDimension dimension, string? region, DeviceType? deviceType);

    Task<List<SupervisionReport>> GenerateSupervisionReportsAsync(bool fullSync, CurrentUser user);
    Task<SupervisionReport?> SubmitToSupervisionAsync(int supervisionReportId, CurrentUser user);
    Task<PagedResult<SupervisionReport>> GetSupervisionReportsAsync(SupervisionReportStatus? status, int page, int pageSize);
}
