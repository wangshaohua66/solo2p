using BlueprintReview.Data;
using BlueprintReview.DTOs;
using BlueprintReview.Models;
using MongoDB.Driver;

namespace BlueprintReview.Services;

public interface IReviewWorkflowService
{
    Task<List<ReviewWorkflowTemplate>> GetTemplatesAsync();
    Task<ReviewWorkflowTemplate> CreateTemplateAsync(CreateWorkflowTemplateRequest request, string userId);
    Task<bool> DeleteTemplateAsync(string id);
    Task<List<ReviewWorkflow>> GetByDocumentAsync(string documentId);
    Task<ReviewWorkflow?> GetByIdAsync(string id);
    Task<ReviewWorkflow> StartWorkflowAsync(CreateWorkflowRequest request, string userId, string userName);
    Task<ReviewWorkflow?> TakeActionAsync(string workflowId, ReviewerActionRequest request, string userId, string userName);
    Task<ReviewWorkflow?> EscalateAsync(string workflowId, EscalateRequest request, string userId, string userName);
    Task<bool> CancelWorkflowAsync(string id);
    Task CheckAndSendRemindersAsync();
}

public class ReviewWorkflowService : IReviewWorkflowService
{
    private readonly IMongoDbContext _dbContext;
    private readonly IWebSocketService _webSocketService;
    private readonly ILogger<ReviewWorkflowService> _logger;

    public ReviewWorkflowService(IMongoDbContext dbContext, IWebSocketService webSocketService, ILogger<ReviewWorkflowService> logger)
    {
        _dbContext = dbContext;
        _webSocketService = webSocketService;
        _logger = logger;
    }

    public async Task<List<ReviewWorkflowTemplate>> GetTemplatesAsync()
    {
        return await _dbContext.ReviewWorkflowTemplates
            .Find(_ => true)
            .SortByDescending(t => t.IsDefault)
            .ThenByDescending(t => t.CreatedAt)
            .ToListAsync();
    }

    public async Task<ReviewWorkflowTemplate> CreateTemplateAsync(CreateWorkflowTemplateRequest request, string userId)
    {
        var template = new ReviewWorkflowTemplate
        {
            Name = request.Name,
            Description = request.Description,
            Stages = request.Stages,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = userId,
            IsDefault = request.IsDefault
        };

        if (request.IsDefault)
        {
            var unsetDefault = Builders<ReviewWorkflowTemplate>.Update.Set(t => t.IsDefault, false);
            await _dbContext.ReviewWorkflowTemplates.UpdateManyAsync(_ => true, unsetDefault);
        }

        await _dbContext.ReviewWorkflowTemplates.InsertOneAsync(template);
        return template;
    }

    public async Task<bool> DeleteTemplateAsync(string id)
    {
        var result = await _dbContext.ReviewWorkflowTemplates.DeleteOneAsync(t => t.Id == id);
        return result.DeletedCount > 0;
    }

    public async Task<List<ReviewWorkflow>> GetByDocumentAsync(string documentId)
    {
        return await _dbContext.ReviewWorkflows
            .Find(w => w.DocumentId == documentId && !w.IsCancelled)
            .SortByDescending(w => w.StartedAt)
            .ToListAsync();
    }

    public async Task<ReviewWorkflow?> GetByIdAsync(string id)
    {
        return await _dbContext.ReviewWorkflows.Find(w => w.Id == id).FirstOrDefaultAsync();
    }

    public async Task<ReviewWorkflow> StartWorkflowAsync(CreateWorkflowRequest request, string userId, string userName)
    {
        var template = await _dbContext.ReviewWorkflowTemplates
            .Find(t => t.Id == request.TemplateId)
            .FirstOrDefaultAsync();

        if (template == null)
            throw new InvalidOperationException("审批模板不存在");

        var document = await _dbContext.Documents
            .Find(d => d.Id == request.DocumentId)
            .FirstOrDefaultAsync();

        if (document == null)
            throw new InvalidOperationException("图纸不存在");

        var stages = template.Stages.OrderBy(s => s.Order).Select(config => new ReviewStage
        {
            Id = config.Id,
            Config = config,
            Reviewers = config.Reviewers.Zip(config.ReviewerNames, (uid, name) => new ReviewerRecord
            {
                UserId = uid,
                UserName = name,
                Status = ReviewStatus.Pending,
                AssignedAt = DateTime.UtcNow
            }).ToList(),
            Status = ReviewStatus.Pending,
            IsCurrent = false,
            IsCompleted = false
        }).ToList();

        if (stages.Count > 0)
        {
            stages[0].IsCurrent = true;
            stages[0].Status = ReviewStatus.InProgress;
            stages[0].StartedAt = DateTime.UtcNow;
        }

        var workflow = new ReviewWorkflow
        {
            DocumentId = request.DocumentId,
            DocumentName = document.Name,
            TemplateId = template.Id,
            TemplateName = template.Name,
            Stages = stages,
            CurrentStageIndex = stages.Count > 0 ? 0 : -1,
            Status = ReviewStatus.InProgress,
            InitiatorId = userId,
            InitiatorName = userName,
            StartedAt = DateTime.UtcNow
        };

        await _dbContext.ReviewWorkflows.InsertOneAsync(workflow);

        var docUpdate = Builders<Document>.Update
            .Set(d => d.Status, DocumentStatus.UnderReview)
            .Set(d => d.UpdatedAt, DateTime.UtcNow);
        await _dbContext.Documents.UpdateOneAsync(d => d.Id == request.DocumentId, docUpdate);

        return workflow;
    }

    public async Task<ReviewWorkflow?> TakeActionAsync(string workflowId, ReviewerActionRequest request, string userId, string userName)
    {
        var workflow = await GetByIdAsync(workflowId);
        if (workflow == null || workflow.IsCancelled) return null;
        if (workflow.Status != ReviewStatus.InProgress)
            throw new InvalidOperationException("审批流未在进行中");

        var currentStage = workflow.Stages.ElementAtOrDefault(workflow.CurrentStageIndex);
        if (currentStage == null || !currentStage.IsCurrent)
            throw new InvalidOperationException("当前阶段无效");

        var reviewerRecord = currentStage.Reviewers.FirstOrDefault(r => r.UserId == userId);
        if (reviewerRecord == null)
            throw new UnauthorizedAccessException("您不是当前阶段的审批人");

        if (currentStage.Config.RequireComment && string.IsNullOrWhiteSpace(request.Comment))
            throw new InvalidOperationException("当前阶段必须填写审批意见");

        reviewerRecord.Action = request.Action;
        reviewerRecord.Comment = request.Comment;
        reviewerRecord.Status = request.Action == ReviewerAction.Approve
            ? ReviewStatus.Approved
            : request.Action == ReviewerAction.Reject
                ? ReviewStatus.Rejected
                : ReviewStatus.NeedsRevision;
        reviewerRecord.CompletedAt = DateTime.UtcNow;

        var stageResult = EvaluateStageStatus(currentStage);

        if (stageResult == ReviewStageResult.Rejected || stageResult == ReviewStageResult.NeedsRevision)
        {
            currentStage.Status = stageResult == ReviewStageResult.Rejected
                ? ReviewStatus.Rejected
                : ReviewStatus.NeedsRevision;
            currentStage.IsCompleted = true;
            currentStage.IsCurrent = false;
            currentStage.CompletedAt = DateTime.UtcNow;

            workflow.Status = stageResult == ReviewStageResult.Rejected
                ? ReviewStatus.Rejected
                : ReviewStatus.NeedsRevision;
            workflow.CompletedAt = DateTime.UtcNow;

            var docStatus = stageResult == ReviewStageResult.Rejected
                ? DocumentStatus.Rejected
                : DocumentStatus.NeedsRevision;
            var docUpdate = Builders<Document>.Update
                .Set(d => d.Status, docStatus)
                .Set(d => d.UpdatedAt, DateTime.UtcNow);
            await _dbContext.Documents.UpdateOneAsync(d => d.Id == workflow.DocumentId, docUpdate);
        }
        else if (stageResult == ReviewStageResult.Approved)
        {
            currentStage.Status = ReviewStatus.Approved;
            currentStage.IsCompleted = true;
            currentStage.IsCurrent = false;
            currentStage.CompletedAt = DateTime.UtcNow;

            if (workflow.CurrentStageIndex >= workflow.Stages.Count - 1)
            {
                workflow.Status = ReviewStatus.Approved;
                workflow.CompletedAt = DateTime.UtcNow;

                var docUpdate = Builders<Document>.Update
                    .Set(d => d.Status, DocumentStatus.Approved)
                    .Set(d => d.UpdatedAt, DateTime.UtcNow);
                await _dbContext.Documents.UpdateOneAsync(d => d.Id == workflow.DocumentId, docUpdate);
            }
            else
            {
                workflow.CurrentStageIndex++;
                var nextStage = workflow.Stages[workflow.CurrentStageIndex];
                nextStage.IsCurrent = true;
                nextStage.Status = ReviewStatus.InProgress;
                nextStage.StartedAt = DateTime.UtcNow;
            }
        }

        var replaceResult = await _dbContext.ReviewWorkflows.ReplaceOneAsync(
            w => w.Id == workflowId,
            workflow
        );

        return replaceResult.ModifiedCount > 0 ? workflow : null;
    }

    public async Task<ReviewWorkflow?> EscalateAsync(string workflowId, EscalateRequest request, string userId, string userName)
    {
        var workflow = await GetByIdAsync(workflowId);
        if (workflow == null || workflow.IsCancelled) return null;

        var currentStage = workflow.Stages.ElementAtOrDefault(workflow.CurrentStageIndex);
        if (currentStage == null)
            throw new InvalidOperationException("当前阶段无效");

        var targetUser = await _dbContext.Users
            .Find(u => u.Id == request.ToUserId)
            .FirstOrDefaultAsync();

        if (targetUser == null)
            throw new InvalidOperationException("目标用户不存在");

        currentStage.Reviewers.Add(new ReviewerRecord
        {
            UserId = request.ToUserId,
            UserName = targetUser.Name,
            Status = ReviewStatus.Pending,
            AssignedAt = DateTime.UtcNow
        });

        workflow.EscalationHistory.Add(new EscalationRecord
        {
            FromUserId = userId,
            FromUserName = userName,
            ToUserId = request.ToUserId,
            ToUserName = targetUser.Name,
            Reason = request.Reason,
            Timestamp = DateTime.UtcNow
        });

        workflow.Status = ReviewStatus.Escalated;

        await _dbContext.ReviewWorkflows.ReplaceOneAsync(w => w.Id == workflowId, workflow);
        return workflow;
    }

    public async Task<bool> CancelWorkflowAsync(string id)
    {
        var update = Builders<ReviewWorkflow>.Update
            .Set(w => w.IsCancelled, true)
            .Set(w => w.Status, ReviewStatus.Rejected)
            .Set(w => w.CompletedAt, DateTime.UtcNow);

        var result = await _dbContext.ReviewWorkflows.UpdateOneAsync(w => w.Id == id, update);

        if (result.ModifiedCount > 0)
        {
            var workflow = await GetByIdAsync(id);
            if (workflow != null)
            {
                var docUpdate = Builders<Document>.Update
                    .Set(d => d.Status, DocumentStatus.Draft)
                    .Set(d => d.UpdatedAt, DateTime.UtcNow);
                await _dbContext.Documents.UpdateOneAsync(d => d.Id == workflow.DocumentId, docUpdate);
            }
        }

        return result.ModifiedCount > 0;
    }

    public async Task CheckAndSendRemindersAsync()
    {
        var now = DateTime.UtcNow;
        var inProgressWorkflows = await _dbContext.ReviewWorkflows
            .Find(w => w.Status == ReviewStatus.InProgress && !w.IsCancelled)
            .ToListAsync();

        foreach (var workflow in inProgressWorkflows)
        {
            var currentStage = workflow.Stages.ElementAtOrDefault(workflow.CurrentStageIndex);
            if (currentStage == null || !currentStage.Config.DeadlineHours.HasValue) continue;

            var deadline = currentStage.StartedAt?.AddHours(currentStage.Config.DeadlineHours.Value);
            if (deadline.HasValue && now > deadline.Value)
            {
                foreach (var reviewer in currentStage.Reviewers.Where(r => r.Status == ReviewStatus.Pending))
                {
                    SendReminderNotification(reviewer.UserId, workflow.Id, currentStage.Config.Name);
                }
            }
        }
    }

    private ReviewStageResult EvaluateStageStatus(ReviewStage stage)
    {
        var completedReviewers = stage.Reviewers.Where(r => r.Status != ReviewStatus.Pending).ToList();

        if (completedReviewers.Any(r => r.Status == ReviewStatus.Rejected))
            return ReviewStageResult.Rejected;
        if (completedReviewers.Any(r => r.Status == ReviewStatus.NeedsRevision))
            return ReviewStageResult.NeedsRevision;

        if (stage.Config.Mode == ApprovalMode.And)
        {
            var allApproved = stage.Reviewers.All(r => r.Status == ReviewStatus.Approved);
            return allApproved ? ReviewStageResult.Approved : ReviewStageResult.Pending;
        }
        else
        {
            var requiredCount = stage.Config.RequiredApprovalCount ?? 1;
            var approvedCount = completedReviewers.Count(r => r.Status == ReviewStatus.Approved);
            return approvedCount >= requiredCount ? ReviewStageResult.Approved : ReviewStageResult.Pending;
        }
    }

    private async void SendReminderNotification(string userId, string workflowId, string stageName)
    {
        try
        {
            var workflow = await _dbContext.ReviewWorkflows.Find(w => w.Id == workflowId).FirstOrDefaultAsync();
            if (workflow == null) return;

            var notification = new
            {
                WorkflowId = workflowId,
                DocumentId = workflow.DocumentId,
                DocumentName = workflow.DocumentName,
                StageName = stageName,
                Message = $"您在图纸「{workflow.DocumentName}」的审批阶段「{stageName}」已超时，请尽快完成审批。",
                Type = "review_reminder",
                Severity = "warning",
                Timestamp = DateTime.UtcNow.ToString("o")
            };

            await _webSocketService.SendToUserAsync(userId, "review.reminder", notification, "system", "系统");

            _logger.LogInformation($"Review reminder sent to user {userId} for workflow {workflowId}, stage {stageName}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to send review reminder to user {userId}");
        }
    }

    private enum ReviewStageResult
    {
        Pending,
        Approved,
        Rejected,
        NeedsRevision
    }
}
