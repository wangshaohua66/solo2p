using Microsoft.AspNetCore.Mvc;
using FireTraining.Models;
using FireTraining.Services;

namespace FireTraining.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StatisticController : ControllerBase
{
    private readonly IStatisticService _statisticService;

    public StatisticController(IStatisticService statisticService)
    {
        _statisticService = statisticService;
    }

    [HttpGet("overview")]
    public async Task<ActionResult<object>> GetOverview(
        [FromQuery] StatisticFilter filter,
        CancellationToken cancellationToken)
    {
        var trainingStats = await _statisticService.GetTrainingStatisticsAsync(filter, cancellationToken);
        var examStats = await _statisticService.GetExamStatisticsAsync(filter, cancellationToken);
        var equipmentStats = await _statisticService.GetEquipmentStatisticsAsync(filter, cancellationToken);

        var overview = new
        {
            trainingCoverage = trainingStats.TrainingCoverage,
            examPassRate = examStats.PassRate,
            equipmentUtilization = equipmentStats.UtilizationRate,
            totalFirefighters = trainingStats.TotalParticipants,
            trainingStats,
            examStats,
            equipmentStats
        };

        return Ok(overview);
    }

    [HttpGet("training")]
    public async Task<ActionResult<TrainingStatistics>> GetTrainingStatistics(
        [FromQuery] StatisticFilter filter,
        CancellationToken cancellationToken)
    {
        var stats = await _statisticService.GetTrainingStatisticsAsync(filter, cancellationToken);
        return Ok(stats);
    }

    [HttpGet("training/trend")]
    public async Task<ActionResult<IEnumerable<PeriodStatistic>>> GetTrainingTrend(
        [FromQuery] StatisticFilter filter,
        CancellationToken cancellationToken)
    {
        var stats = await _statisticService.GetTrainingStatisticsAsync(filter, cancellationToken);
        return Ok(stats.TrendData);
    }

    [HttpGet("training/by-station")]
    public async Task<ActionResult<IEnumerable<StationStatistic>>> GetTrainingByStation(
        [FromQuery] StatisticFilter filter,
        CancellationToken cancellationToken)
    {
        var stats = await _statisticService.GetTrainingStatisticsAsync(filter, cancellationToken);
        return Ok(stats.ByStation);
    }

    [HttpGet("training/by-level")]
    public async Task<ActionResult<IEnumerable<LevelStatistic>>> GetTrainingByLevel(
        [FromQuery] StatisticFilter filter,
        CancellationToken cancellationToken)
    {
        var stats = await _statisticService.GetTrainingStatisticsAsync(filter, cancellationToken);
        return Ok(stats.ByLevel);
    }

    [HttpGet("training/by-specialty")]
    public async Task<ActionResult<IEnumerable<SpecialtyStatistic>>> GetTrainingBySpecialty(
        [FromQuery] StatisticFilter filter,
        CancellationToken cancellationToken)
    {
        var stats = await _statisticService.GetTrainingStatisticsAsync(filter, cancellationToken);
        return Ok(stats.BySpecialty);
    }

    [HttpGet("exam")]
    public async Task<ActionResult<ExamStatistics>> GetExamStatistics(
        [FromQuery] StatisticFilter filter,
        CancellationToken cancellationToken)
    {
        var stats = await _statisticService.GetExamStatisticsAsync(filter, cancellationToken);
        return Ok(stats);
    }

    [HttpGet("exam/trend")]
    public async Task<ActionResult<IEnumerable<PeriodStatistic>>> GetExamTrend(
        [FromQuery] StatisticFilter filter,
        CancellationToken cancellationToken)
    {
        var stats = await _statisticService.GetExamStatisticsAsync(filter, cancellationToken);
        return Ok(stats.TrendData);
    }

    [HttpGet("exam/by-station")]
    public async Task<ActionResult<IEnumerable<StationStatistic>>> GetExamByStation(
        [FromQuery] StatisticFilter filter,
        CancellationToken cancellationToken)
    {
        var stats = await _statisticService.GetExamStatisticsAsync(filter, cancellationToken);
        return Ok(stats.ByStation);
    }

    [HttpGet("exam/by-level")]
    public async Task<ActionResult<IEnumerable<LevelStatistic>>> GetExamByLevel(
        [FromQuery] StatisticFilter filter,
        CancellationToken cancellationToken)
    {
        var stats = await _statisticService.GetExamStatisticsAsync(filter, cancellationToken);
        return Ok(stats.ByLevel);
    }

    [HttpGet("equipment")]
    public async Task<ActionResult<EquipmentStatistics>> GetEquipmentStatistics(
        [FromQuery] StatisticFilter filter,
        CancellationToken cancellationToken)
    {
        var stats = await _statisticService.GetEquipmentStatisticsAsync(filter, cancellationToken);
        return Ok(stats);
    }

    [HttpGet("progress")]
    public async Task<ActionResult<IEnumerable<LearningProgress>>> GetLearningProgress(
        int? stationId,
        int? levelId,
        int? specialtyId,
        ProgressStatus? status,
        string? keyword,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var progressList = await _statisticService.GetLearningProgressListAsync(
            stationId, levelId, specialtyId, status, keyword, page, pageSize, cancellationToken);

        var total = await _statisticService.GetLearningProgressCountAsync(
            stationId, levelId, specialtyId, status, keyword, cancellationToken);

        return Ok(new { total, data = progressList });
    }

    [HttpGet("progress/firefighter/{firefighterId}")]
    public async Task<ActionResult<LearningProgress>> GetFirefighterProgress(
        int firefighterId,
        CancellationToken cancellationToken)
    {
        var progress = await _statisticService.GetFirefighterProgressAsync(firefighterId, cancellationToken);
        if (progress == null)
            return NotFound();

        return Ok(progress);
    }

    [HttpPost("progress/update/{firefighterId}")]
    public async Task<IActionResult> UpdateProgress(
        int firefighterId,
        CancellationToken cancellationToken)
    {
        await _statisticService.UpdateProgressAsync(firefighterId, cancellationToken);
        return NoContent();
    }

    [HttpGet("progress/at-risk")]
    public async Task<ActionResult<IEnumerable<Firefighter>>> GetAtRiskFirefighters(
        int? stationId,
        int? levelId,
        CancellationToken cancellationToken)
    {
        var firefighters = await _statisticService.GetAtRiskFirefightersAsync(stationId, levelId, cancellationToken);
        return Ok(firefighters);
    }

    [HttpGet("reports/export")]
    public async Task<IActionResult> ExportReport(
        [FromQuery] StatisticFilter filter,
        [FromQuery] ReportType reportType,
        CancellationToken cancellationToken)
    {
        var data = await _statisticService.ExportReportAsync(filter, reportType, cancellationToken);

        var fileName = $"{reportType}报表_{DateTime.Now:yyyyMMdd}.csv";
        return File(data, "text/csv; charset=utf-8", fileName);
    }

    [HttpGet("reports/comprehensive")]
    public async Task<ActionResult<object>> GetComprehensiveReport(
        [FromQuery] StatisticFilter filter,
        CancellationToken cancellationToken)
    {
        var trainingStats = await _statisticService.GetTrainingStatisticsAsync(filter, cancellationToken);
        var examStats = await _statisticService.GetExamStatisticsAsync(filter, cancellationToken);
        var equipmentStats = await _statisticService.GetEquipmentStatisticsAsync(filter, cancellationToken);

        var atRiskFirefighters = await _statisticService.GetAtRiskFirefightersAsync(
            filter.FireStationId, filter.LevelId, cancellationToken);

        var report = new
        {
            ReportPeriod = new
            {
                StartDate = filter.StartDate,
                EndDate = filter.EndDate,
                GeneratedAt = DateTime.UtcNow
            },
            Summary = new
            {
                TrainingCoverage = trainingStats.TrainingCoverage,
                ExamPassRate = examStats.PassRate,
                EquipmentUtilization = equipmentStats.UtilizationRate,
                AtRiskFirefighterCount = atRiskFirefighters.Count
            },
            TrainingStats = trainingStats,
            ExamStats = examStats,
            EquipmentStats = equipmentStats,
            AtRiskFirefighters = atRiskFirefighters
        };

        return Ok(report);
    }
}
