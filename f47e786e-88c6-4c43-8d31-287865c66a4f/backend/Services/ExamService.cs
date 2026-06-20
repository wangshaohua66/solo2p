using Microsoft.EntityFrameworkCore;
using FireTraining.Data;
using FireTraining.Models;
using System.Text.Json;

namespace FireTraining.Services;

public interface IExamService
{
    Task<List<Question>> GetQuestionsAsync(int? categoryId, QuestionType? type, DifficultyLevel? difficulty, string? keyword, int page = 1, int pageSize = 20, CancellationToken cancellationToken = default);
    Task<int> GetQuestionCountAsync(int? categoryId, QuestionType? type, DifficultyLevel? difficulty, string? keyword, CancellationToken cancellationToken = default);
    Task<Question?> GetQuestionByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<Question> CreateQuestionAsync(Question question, CancellationToken cancellationToken = default);
    Task<Question?> UpdateQuestionAsync(Question question, CancellationToken cancellationToken = default);
    Task<bool> DeleteQuestionAsync(int id, CancellationToken cancellationToken = default);

    Task<ExamPaperGenerationResult> GeneratePaperAsync(PaperGenerationConfig config, CancellationToken cancellationToken = default);
    Task<ExamPaper?> GetPaperByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<List<ExamPaper>> GetPapersAsync(int? specialtyId, int? levelId, PaperStatus? status, CancellationToken cancellationToken = default);

    Task<bool> SubmitPracticalScoreAsync(int examScoreId, List<PracticalScoreSubmission> scores, int gradedBy, CancellationToken cancellationToken = default);
    Task<bool> CheckScoreDeviationAsync(int examId, int firefighterId, decimal score, decimal threshold = 10, CancellationToken cancellationToken = default);
    Task TriggerReassessmentAsync(int examScoreId, string? reason, CancellationToken cancellationToken = default);

    Task<List<ExamScore>> GetExamScoresAsync(int? examId, int? stationId, int? levelId, ExamResultStatus? status, int page = 1, int pageSize = 20, CancellationToken cancellationToken = default);
}

public class ExamService : IExamService
{
    private readonly AppDbContext _context;

    public ExamService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<Question>> GetQuestionsAsync(
        int? categoryId,
        QuestionType? type,
        DifficultyLevel? difficulty,
        string? keyword,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Questions
            .Include(q => q.Category)
            .Where(q => q.IsActive);

        if (categoryId.HasValue)
        {
            var categoryIds = await GetCategoryAndChildrenIdsAsync(categoryId.Value, cancellationToken);
            query = query.Where(q => categoryIds.Contains(q.CategoryId));
        }

        if (type.HasValue)
        {
            query = query.Where(q => q.Type == type.Value);
        }

        if (difficulty.HasValue)
        {
            query = query.Where(q => q.Difficulty == difficulty.Value);
        }

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            query = query.Where(q => q.Content.Contains(keyword));
        }

        return await query
            .OrderByDescending(q => q.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
    }

    public async Task<int> GetQuestionCountAsync(
        int? categoryId,
        QuestionType? type,
        DifficultyLevel? difficulty,
        string? keyword,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Questions
            .Where(q => q.IsActive);

        if (categoryId.HasValue)
        {
            var categoryIds = await GetCategoryAndChildrenIdsAsync(categoryId.Value, cancellationToken);
            query = query.Where(q => categoryIds.Contains(q.CategoryId));
        }

        if (type.HasValue)
        {
            query = query.Where(q => q.Type == type.Value);
        }

        if (difficulty.HasValue)
        {
            query = query.Where(q => q.Difficulty == difficulty.Value);
        }

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            query = query.Where(q => q.Content.Contains(keyword));
        }

        return await query.CountAsync(cancellationToken);
    }

    public async Task<Question?> GetQuestionByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        return await _context.Questions
            .Include(q => q.Category)
            .FirstOrDefaultAsync(q => q.Id == id, cancellationToken);
    }

    public async Task<Question> CreateQuestionAsync(Question question, CancellationToken cancellationToken = default)
    {
        question.CreatedAt = DateTime.UtcNow;
        question.IsActive = true;
        _context.Questions.Add(question);
        await _context.SaveChangesAsync(cancellationToken);
        return question;
    }

    public async Task<Question?> UpdateQuestionAsync(Question question, CancellationToken cancellationToken = default)
    {
        var existing = await _context.Questions.FindAsync(new object[] { question.Id }, cancellationToken);
        if (existing == null) return null;

        existing.Type = question.Type;
        existing.CategoryId = question.CategoryId;
        existing.Difficulty = question.Difficulty;
        existing.Content = question.Content;
        existing.OptionsJson = question.OptionsJson;
        existing.Answer = question.Answer;
        existing.Score = question.Score;
        existing.Analysis = question.Analysis;
        existing.ImageUrl = question.ImageUrl;
        existing.KnowledgePoints = question.KnowledgePoints;
        existing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        return existing;
    }

    public async Task<bool> DeleteQuestionAsync(int id, CancellationToken cancellationToken = default)
    {
        var question = await _context.Questions.FindAsync(new object[] { id }, cancellationToken);
        if (question == null) return false;

        question.IsActive = false;
        question.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<ExamPaperGenerationResult> GeneratePaperAsync(PaperGenerationConfig config, CancellationToken cancellationToken = default)
    {
        var result = new ExamPaperGenerationResult();
        var allQuestions = await _context.Questions
            .Where(q => q.IsActive && q.SpecialtyId == config.SpecialtyId)
            .ToListAsync(cancellationToken);

        if (!allQuestions.Any())
        {
            result.Success = false;
            result.ErrorMessage = "题库中没有符合条件的题目";
            return result;
        }

        var paperA = await GenerateSinglePaperAsync(config, allQuestions, 'A', cancellationToken);
        result.PaperA = paperA;

        if (config.GenerateABPaper)
        {
            var paperB = await GenerateSinglePaperAsync(config, allQuestions, 'B', cancellationToken);
            result.PaperB = paperB;
        }

        result.Success = true;
        return result;
    }

    private async Task<ExamPaper> GenerateSinglePaperAsync(
        PaperGenerationConfig config,
        List<Question> allQuestions,
        char version,
        CancellationToken cancellationToken = default)
    {
        var paper = new ExamPaper
        {
            Title = $"{AppCommon.GetLevelName(config.LevelId)} - {version}卷",
            SpecialtyId = config.SpecialtyId,
            LevelId = config.LevelId,
            Type = PaperType.Theory,
            PaperVersion = version,
            TotalScore = config.TotalScore,
            QuestionCount = config.QuestionCount,
            PassScore = config.PassScore,
            DurationMinutes = config.DurationMinutes,
            Status = PaperStatus.Draft,
            CreatedAt = DateTime.UtcNow
        };

        _context.ExamPapers.Add(paper);
        await _context.SaveChangesAsync(cancellationToken);

        var paperQuestions = new List<ExamPaperQuestion>();
        var usedQuestionIds = new HashSet<int>();
        var sortOrder = 1;

        var questionTypes = new Dictionary<QuestionType, int>
        {
            { QuestionType.Single, (int)Math.Round(config.QuestionCount * config.TypeDistribution.SinglePercentage / 100.0) },
            { QuestionType.Multiple, (int)Math.Round(config.QuestionCount * config.TypeDistribution.MultiplePercentage / 100.0) },
            { QuestionType.Judge, (int)Math.Round(config.QuestionCount * config.TypeDistribution.JudgePercentage / 100.0) },
            { QuestionType.Scenario, (int)Math.Round(config.QuestionCount * config.TypeDistribution.ScenarioPercentage / 100.0) }
        };

        var difficultyLevels = new Dictionary<DifficultyLevel, int>
        {
            { DifficultyLevel.Easy, (int)Math.Round(config.QuestionCount * config.DifficultyDistribution.EasyPercentage / 100.0) },
            { DifficultyLevel.Medium, (int)Math.Round(config.QuestionCount * config.DifficultyDistribution.MediumPercentage / 100.0) },
            { DifficultyLevel.Hard, (int)Math.Round(config.QuestionCount * config.DifficultyDistribution.HardPercentage / 100.0) }
        };

        foreach (var (type, count) in questionTypes)
        {
            foreach (var (difficulty, diffCount) in difficultyLevels)
            {
                var targetCount = (int)Math.Round((double)count * diffCount / config.QuestionCount);
                if (targetCount <= 0) continue;

                var availableQuestions = allQuestions
                    .Where(q => q.Type == type && q.Difficulty == difficulty && !usedQuestionIds.Contains(q.Id))
                    .OrderBy(_ => Guid.NewGuid())
                    .Take(targetCount)
                    .ToList();

                foreach (var q in availableQuestions)
                {
                    usedQuestionIds.Add(q.Id);
                    paperQuestions.Add(new ExamPaperQuestion
                    {
                        ExamPaperId = paper.Id,
                        QuestionId = q.Id,
                        SortOrder = sortOrder++,
                        Score = q.Score,
                        QuestionType = q.Type
                    });
                }
            }
        }

        while (paperQuestions.Count < config.QuestionCount)
        {
            var remaining = allQuestions.Where(q => !usedQuestionIds.Contains(q.Id)).ToList();
            if (!remaining.Any()) break;

            var q = remaining[Random.Shared.Next(remaining.Count)];
            usedQuestionIds.Add(q.Id);
            paperQuestions.Add(new ExamPaperQuestion
            {
                ExamPaperId = paper.Id,
                QuestionId = q.Id,
                SortOrder = sortOrder++,
                Score = q.Score,
                QuestionType = q.Type
            });
        }

        paper.QuestionCount = paperQuestions.Count;

        _context.ExamPaperQuestions.AddRange(paperQuestions);
        await _context.SaveChangesAsync(cancellationToken);

        paper.PaperQuestions = paperQuestions;
        return paper;
    }

    public async Task<ExamPaper?> GetPaperByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        return await _context.ExamPapers
            .Include(p => p.PaperQuestions)
                .ThenInclude(pq => pq.Question)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
    }

    public async Task<List<ExamPaper>> GetPapersAsync(int? specialtyId, int? levelId, PaperStatus? status, CancellationToken cancellationToken = default)
    {
        var query = _context.ExamPapers.AsQueryable();

        if (specialtyId.HasValue)
        {
            query = query.Where(p => p.SpecialtyId == specialtyId.Value);
        }

        if (levelId.HasValue)
        {
            query = query.Where(p => p.LevelId == levelId.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(p => p.Status == status.Value);
        }

        return await query
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<bool> SubmitPracticalScoreAsync(int examScoreId, List<PracticalScoreSubmission> scores, int gradedBy, CancellationToken cancellationToken = default)
    {
        var examScore = await _context.ExamScores
            .Include(es => es.PracticalScoreItems)
            .FirstOrDefaultAsync(es => es.Id == examScoreId, cancellationToken);

        if (examScore == null) return false;

        foreach (var submission in scores)
        {
            var existingItem = examScore.PracticalScoreItems?
                .FirstOrDefault(i => i.PracticalExamItemId == submission.PracticalExamItemId);

            if (existingItem != null)
            {
                existingItem.Score = submission.Score;
                existingItem.Notes = submission.Notes;
                existingItem.GradedBy = gradedBy;
                existingItem.GradedAt = DateTime.UtcNow;
                existingItem.ScoreTrail = UpdateScoreTrail(existingItem.ScoreTrail, submission.Score, gradedBy);
            }
            else
            {
                var newItem = new PracticalScoreItem
                {
                    ExamScoreId = examScoreId,
                    PracticalExamItemId = submission.PracticalExamItemId,
                    Score = submission.Score,
                    Notes = submission.Notes,
                    GradedBy = gradedBy,
                    GradedAt = DateTime.UtcNow,
                    ScoreTrail = $"初始评分: {submission.Score} (考官ID: {gradedBy}, 时间: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss})"
                };
                _context.PracticalScoreItems.Add(newItem);
            }
        }

        var totalScore = await CalculateWeightedScoreAsync(examScoreId, cancellationToken);
        examScore.TotalScore = totalScore;
        examScore.GradedBy = gradedBy;
        examScore.GradedAt = DateTime.UtcNow;
        examScore.Status = totalScore >= examScore.Exam?.PassScore ? ExamResultStatus.Passed : ExamResultStatus.Failed;
        examScore.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> CheckScoreDeviationAsync(int examId, int firefighterId, decimal score, decimal threshold = 10, CancellationToken cancellationToken = default)
    {
        var examScores = await _context.ExamScores
            .Where(es => es.ExamId == examId && es.Status == ExamResultStatus.Passed)
            .Select(es => es.TotalScore)
            .ToListAsync(cancellationToken);

        if (examScores.Count < 5) return false;

        var avg = examScores.Average();
        var deviation = Math.Abs(score - avg) / avg * 100;

        return deviation > threshold;
    }

    public async Task TriggerReassessmentAsync(int examScoreId, string? reason, CancellationToken cancellationToken = default)
    {
        var examScore = await _context.ExamScores.FindAsync(new object[] { examScoreId }, cancellationToken);
        if (examScore == null) return;

        examScore.Status = ExamResultStatus.Reassessment;
        examScore.NeedsReassessment = true;
        examScore.Comments = $"复评原因：{reason}\n{examScore.Comments}";
        examScore.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<List<ExamScore>> GetExamScoresAsync(
        int? examId,
        int? stationId,
        int? levelId,
        ExamResultStatus? status,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = _context.ExamScores
            .Include(es => es.Exam)
            .Include(es => es.Firefighter)
                .ThenInclude(f => f!.FireStation)
            .AsQueryable();

        if (examId.HasValue)
        {
            query = query.Where(es => es.ExamId == examId.Value);
        }

        if (stationId.HasValue)
        {
            query = query.Where(es => es.Firefighter.FireStationId == stationId.Value);
        }

        if (levelId.HasValue)
        {
            query = query.Where(es => es.Firefighter.LevelId == levelId.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(es => es.Status == status.Value);
        }

        return await query
            .OrderByDescending(es => es.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
    }

    private async Task<List<int>> GetCategoryAndChildrenIdsAsync(int categoryId, CancellationToken cancellationToken)
    {
        var category = await _context.QuestionCategories
            .Include(c => c.Children)
            .FirstOrDefaultAsync(c => c.Id == categoryId, cancellationToken);

        var ids = new List<int> { categoryId };

        if (category?.Children != null)
        {
            foreach (var child in category.Children)
            {
                ids.Add(child.Id);
            }
        }

        if (category == null || !category.Children?.Any() == true)
        {
            var parent = await _context.QuestionCategories
                .Where(c => c.ParentId == categoryId)
                .Select(c => c.Id)
                .ToListAsync(cancellationToken);

            if (parent.Any())
            {
                ids.AddRange(parent);
            }
            else
            {
                var children = await _context.QuestionCategories
                    .Where(c => c.ParentId == categoryId)
                    .Select(c => c.Id)
                    .ToListAsync(cancellationToken);
                ids.AddRange(children);
            }
        }

        return ids.Distinct().ToList();
    }

    private static string UpdateScoreTrail(string? existingTrail, decimal newScore, int gradedBy)
    {
        var entry = $"评分调整: {newScore} (考官ID: {gradedBy}, 时间: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss})";
        return string.IsNullOrEmpty(existingTrail) ? entry : $"{existingTrail}\n{entry}";
    }

    private async Task<decimal> CalculateWeightedScoreAsync(int examScoreId, CancellationToken cancellationToken)
    {
        var items = await _context.PracticalScoreItems
            .Include(psi => psi.PracticalExamItem)
            .Where(psi => psi.ExamScoreId == examScoreId)
            .ToListAsync(cancellationToken);

        if (!items.Any()) return 0;

        decimal totalWeightedScore = 0;
        decimal totalWeight = 0;

        foreach (var item in items)
        {
            if (item.PracticalExamItem == null) continue;

            var maxScore = item.PracticalExamItem.MaxScore;
            var weight = item.PracticalExamItem.Weight;

            if (maxScore > 0)
            {
                var percentage = item.Score / maxScore * 100;
                totalWeightedScore += percentage * weight / 100;
            }
            totalWeight += weight;
        }

        return totalWeight > 0 ? Math.Round(totalWeightedScore / totalWeight * 100, 2) : 0;
    }
}

public class ExamPaperGenerationResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public ExamPaper? PaperA { get; set; }
    public ExamPaper? PaperB { get; set; }
}

public class PracticalScoreSubmission
{
    public int PracticalExamItemId { get; set; }
    public decimal Score { get; set; }
    public string? Notes { get; set; }
}
