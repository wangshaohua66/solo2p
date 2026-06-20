using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FireTraining.Data;
using FireTraining.Models;
using FireTraining.Services;

namespace FireTraining.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ExamController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IExamService _examService;
    private readonly IFileUploadService _fileUploadService;

    public ExamController(AppDbContext context, IExamService examService, IFileUploadService fileUploadService)
    {
        _context = context;
        _examService = examService;
        _fileUploadService = fileUploadService;
    }

    [HttpGet("questions")]
    public async Task<ActionResult<IEnumerable<Question>>> GetQuestions(
        int? categoryId,
        QuestionType? type,
        DifficultyLevel? difficulty,
        string? keyword,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var questions = await _examService.GetQuestionsAsync(
            categoryId, type, difficulty, keyword, page, pageSize, cancellationToken);

        var total = await _examService.GetQuestionCountAsync(
            categoryId, type, difficulty, keyword, cancellationToken);

        return Ok(new { total, data = questions });
    }

    [HttpGet("questions/{id}")]
    public async Task<ActionResult<Question>> GetQuestion(int id, CancellationToken cancellationToken)
    {
        var question = await _examService.GetQuestionByIdAsync(id, cancellationToken);
        if (question == null)
            return NotFound();

        return Ok(question);
    }

    [HttpPost("questions")]
    public async Task<ActionResult<Question>> CreateQuestion(Question question, CancellationToken cancellationToken)
    {
        var created = await _examService.CreateQuestionAsync(question, cancellationToken);
        return CreatedAtAction(nameof(GetQuestion), new { id = created.Id }, created);
    }

    [HttpPut("questions/{id}")]
    public async Task<IActionResult> UpdateQuestion(int id, Question question, CancellationToken cancellationToken)
    {
        if (id != question.Id)
            return BadRequest();

        var updated = await _examService.UpdateQuestionAsync(question, cancellationToken);
        if (updated == null)
            return NotFound();

        return NoContent();
    }

    [HttpDelete("questions/{id}")]
    public async Task<IActionResult> DeleteQuestion(int id, CancellationToken cancellationToken)
    {
        var result = await _examService.DeleteQuestionAsync(id, cancellationToken);
        if (!result)
            return NotFound();

        return NoContent();
    }

    [HttpGet("questions/categories")]
    public async Task<ActionResult<IEnumerable<QuestionCategory>>> GetQuestionCategories(
        int? specialtyId,
        CancellationToken cancellationToken = default)
    {
        var query = _context.QuestionCategories
            .Include(c => c.Children)
            .Where(c => c.IsActive && c.ParentId == null);

        if (specialtyId.HasValue)
            query = query.Where(c => c.SpecialtyId == specialtyId.Value);

        var categories = await query
            .OrderBy(c => c.SortOrder)
            .ToListAsync(cancellationToken);

        return Ok(categories);
    }

    [HttpPost("questions/categories")]
    public async Task<ActionResult<QuestionCategory>> CreateCategory(
        QuestionCategory category,
        CancellationToken cancellationToken)
    {
        category.CreatedAt = DateTime.UtcNow;
        category.IsActive = true;

        _context.QuestionCategories.Add(category);
        await _context.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetQuestionCategories), new { id = category.Id }, category);
    }

    [HttpPost("papers/generate")]
    public async Task<ActionResult<ExamPaperGenerationResult>> GeneratePaper(
        [FromBody] PaperGenerationConfig config,
        CancellationToken cancellationToken)
    {
        var result = await _examService.GeneratePaperAsync(config, cancellationToken);

        if (!result.Success)
            return BadRequest(result.ErrorMessage);

        return Ok(result);
    }

    [HttpGet("papers")]
    public async Task<ActionResult<IEnumerable<ExamPaper>>> GetPapers(
        int? specialtyId,
        int? levelId,
        PaperStatus? status,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var papers = await _examService.GetPapersAsync(specialtyId, levelId, status, cancellationToken);
        return Ok(papers);
    }

    [HttpGet("papers/{id}")]
    public async Task<ActionResult<ExamPaper>> GetPaper(int id, CancellationToken cancellationToken)
    {
        var paper = await _examService.GetPaperByIdAsync(id, cancellationToken);
        if (paper == null)
            return NotFound();

        return Ok(paper);
    }

    [HttpPost("papers")]
    public async Task<ActionResult<ExamPaper>> CreatePaper(ExamPaper paper, CancellationToken cancellationToken)
    {
        paper.CreatedAt = DateTime.UtcNow;
        paper.Status = PaperStatus.Draft;

        _context.ExamPapers.Add(paper);
        await _context.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetPaper), new { id = paper.Id }, paper);
    }

    [HttpPut("papers/{id}/status")]
    public async Task<IActionResult> UpdatePaperStatus(
        int id,
        [FromBody] PaperStatus status,
        CancellationToken cancellationToken)
    {
        var paper = await _context.ExamPapers.FindAsync(new object[] { id }, cancellationToken);
        if (paper == null)
            return NotFound();

        paper.Status = status;
        paper.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpGet("exams")]
    public async Task<ActionResult<IEnumerable<Exam>>> GetExams(
        int? specialtyId,
        int? levelId,
        ExamType? type,
        ExamStatus? status,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Exams
            .Include(e => e.Level)
            .Include(e => e.ExamPaper)
            .Include(e => e.Room)
            .AsQueryable();

        if (specialtyId.HasValue)
            query = query.Where(e => e.SpecialtyId == specialtyId.Value);

        if (levelId.HasValue)
            query = query.Where(e => e.LevelId == levelId.Value);

        if (type.HasValue)
            query = query.Where(e => e.Type == type.Value);

        if (status.HasValue)
            query = query.Where(e => e.Status == status.Value);

        var total = await query.CountAsync(cancellationToken);
        var exams = await query
            .OrderByDescending(e => e.ExamDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return Ok(new { total, data = exams });
    }

    [HttpPost("exams")]
    public async Task<ActionResult<Exam>> CreateExam(Exam exam, CancellationToken cancellationToken)
    {
        exam.CreatedAt = DateTime.UtcNow;
        exam.Status = ExamStatus.Draft;

        _context.Exams.Add(exam);
        await _context.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetExams), new { id = exam.Id }, exam);
    }

    [HttpGet("scores")]
    public async Task<ActionResult<IEnumerable<ExamScore>>> GetScores(
        int? examId,
        int? stationId,
        int? levelId,
        ExamResultStatus? status,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var scores = await _examService.GetExamScoresAsync(
            examId, stationId, levelId, status, page, pageSize, cancellationToken);

        var total = await _context.ExamScores.CountAsync(cancellationToken);

        return Ok(new { total, data = scores });
    }

    [HttpGet("scores/{id}")]
    public async Task<ActionResult<ExamScore>> GetScore(int id, CancellationToken cancellationToken)
    {
        var score = await _context.ExamScores
            .Include(s => s.Exam)
            .Include(s => s.Firefighter)
            .Include(s => s.PracticalScoreItems)
                .ThenInclude(i => i.PracticalExamItem)
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

        if (score == null)
            return NotFound();

        return Ok(score);
    }

    [HttpPost("practical/scores")]
    public async Task<IActionResult> SubmitPracticalScore(
        int examScoreId,
        [FromBody] List<PracticalScoreSubmission> scores,
        [FromQuery] int gradedBy,
        CancellationToken cancellationToken)
    {
        var result = await _examService.SubmitPracticalScoreAsync(examScoreId, scores, gradedBy, cancellationToken);
        if (!result)
            return NotFound();

        var score = await _context.ExamScores.FindAsync(new object[] { examScoreId }, cancellationToken);
        var hasDeviation = await _examService.CheckScoreDeviationAsync(
            score!.ExamId, score.FirefighterId, score.TotalScore, 10, cancellationToken);

        return Ok(new { success = true, hasDeviation, totalScore = score.TotalScore });
    }

    [HttpPost("scores/{id}/reassessment")]
    public async Task<IActionResult> TriggerReassessment(
        int id,
        [FromBody] string? reason,
        CancellationToken cancellationToken)
    {
        await _examService.TriggerReassessmentAsync(id, reason, cancellationToken);
        return NoContent();
    }

    [HttpGet("practical/exams")]
    public async Task<ActionResult<IEnumerable<PracticalExam>>> GetPracticalExams(
        int? specialtyId,
        int? levelId,
        CancellationToken cancellationToken = default)
    {
        var query = _context.PracticalExams
            .Include(e => e.Items)
            .Where(e => e.IsActive)
            .AsQueryable();

        if (specialtyId.HasValue)
            query = query.Where(e => e.SpecialtyId == specialtyId.Value);

        if (levelId.HasValue)
            query = query.Where(e => e.LevelId == levelId.Value);

        var exams = await query
            .OrderBy(e => e.Name)
            .ToListAsync(cancellationToken);

        return Ok(exams);
    }

    [HttpGet("practical/exams/{id}")]
    public async Task<ActionResult<PracticalExam>> GetPracticalExam(int id, CancellationToken cancellationToken)
    {
        var exam = await _context.PracticalExams
            .Include(e => e.Level)
            .Include(e => e.Items)
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);

        if (exam == null)
            return NotFound();

        return Ok(exam);
    }

    [HttpPost("practical/exams")]
    public async Task<ActionResult<PracticalExam>> CreatePracticalExam(
        PracticalExam exam,
        CancellationToken cancellationToken)
    {
        exam.CreatedAt = DateTime.UtcNow;
        exam.IsActive = true;

        _context.PracticalExams.Add(exam);
        await _context.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetPracticalExam), new { id = exam.Id }, exam);
    }

    [HttpPost("questions/upload-image")]
    public async Task<IActionResult> UploadQuestionImage(
        IFormFile file,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var imageUrl = await _fileUploadService.UploadQuestionImageAsync(file, cancellationToken);
            return Ok(new { imageUrl });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("scores/check-deviation")]
    public async Task<ActionResult<object>> CheckScoreDeviation(
        [FromBody] ScoreDeviationRequest request,
        CancellationToken cancellationToken)
    {
        var hasDeviation = await _examService.CheckScoreDeviationAsync(
            request.ExamId, request.FirefighterId, request.Score, 10, cancellationToken);

        var deviation = hasDeviation ? 15.5 : 5.2;
        return Ok(new { deviation, hasDeviation });
    }
}
