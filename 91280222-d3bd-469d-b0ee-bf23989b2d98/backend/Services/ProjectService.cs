using BlueprintReview.Data;
using BlueprintReview.DTOs;
using BlueprintReview.Models;
using MongoDB.Driver;

namespace BlueprintReview.Services;

public interface IProjectService
{
    Task<List<Project>> ListAsync(string? status = null, string? keyword = null);
    Task<Project?> GetByIdAsync(string id);
    Task<Project> CreateAsync(CreateProjectRequest request, string userId);
    Task<Project?> UpdateAsync(string id, UpdateProjectRequest request);
    Task<bool> DeleteAsync(string id);
    Task<bool> AddMemberAsync(string projectId, string userId, UserRole role);
    Task<bool> RemoveMemberAsync(string projectId, string userId);
    Task<object> GetStatsAsync(string projectId);
    Task<byte[]> ExportReportAsync(string projectId, string? discipline = null, DateTime? startDate = null, DateTime? endDate = null);
    Task UpdateStatsAsync(string projectId);
}

public class ProjectService : IProjectService
{
    private readonly IMongoDbContext _dbContext;
    private readonly IAuthService _authService;

    public ProjectService(IMongoDbContext dbContext, IAuthService authService)
    {
        _dbContext = dbContext;
        _authService = authService;
    }

    public async Task<List<Project>> ListAsync(string? status = null, string? keyword = null)
    {
        var filter = Builders<Project>.Filter.Empty;

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<ProjectStatus>(status, true, out var statusEnum))
        {
            filter &= Builders<Project>.Filter.Eq(p => p.Status, statusEnum);
        }

        if (!string.IsNullOrEmpty(keyword))
        {
            filter &= Builders<Project>.Filter.Regex(p => p.Name, new MongoDB.Bson.BsonRegularExpression(keyword, "i"));
        }

        var sort = Builders<Project>.Sort.Descending(p => p.UpdatedAt);
        return await _dbContext.Projects.Find(filter).Sort(sort).ToListAsync();
    }

    public async Task<Project?> GetByIdAsync(string id)
    {
        var project = await _dbContext.Projects.Find(p => p.Id == id).FirstOrDefaultAsync();
        if (project != null)
        {
            await UpdateStatsAsync(id);
            project = await _dbContext.Projects.Find(p => p.Id == id).FirstOrDefaultAsync();
        }
        return project;
    }

    public async Task<Project> CreateAsync(CreateProjectRequest request, string userId)
    {
        var currentUser = await _authService.GetUserByIdAsync(userId);
        if (currentUser == null) throw new UnauthorizedAccessException();

        var members = new List<ProjectMember>
        {
            new()
            {
                UserId = userId,
                UserName = currentUser.Name,
                Role = UserRole.ProjectManager,
                JoinedAt = DateTime.UtcNow
            }
        };

        if (request.MemberIds != null)
        {
            foreach (var memberId in request.MemberIds.Where(id => id != userId))
            {
                var user = await _authService.GetUserByIdAsync(memberId);
                if (user != null)
                {
                    members.Add(new ProjectMember
                    {
                        UserId = memberId,
                        UserName = user.Name,
                        Role = UserRole.Reviewer,
                        JoinedAt = DateTime.UtcNow
                    });
                }
            }
        }

        var project = new Project
        {
            Name = request.Name,
            Description = request.Description,
            BuildingType = request.BuildingType,
            FloorCount = request.FloorCount,
            Area = request.Area,
            Status = ProjectStatus.Planning,
            Members = members,
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Stats = new ProjectStats()
        };

        await _dbContext.Projects.InsertOneAsync(project);
        return project;
    }

    public async Task<Project?> UpdateAsync(string id, UpdateProjectRequest request)
    {
        var update = Builders<Project>.Update.Set(p => p.UpdatedAt, DateTime.UtcNow);

        if (!string.IsNullOrEmpty(request.Name))
            update = update.Set(p => p.Name, request.Name);
        if (request.Description != null)
            update = update.Set(p => p.Description, request.Description);
        if (request.BuildingType != null)
            update = update.Set(p => p.BuildingType, request.BuildingType);
        if (request.FloorCount.HasValue)
            update = update.Set(p => p.FloorCount, request.FloorCount.Value);
        if (request.Area.HasValue)
            update = update.Set(p => p.Area, request.Area.Value);
        if (!string.IsNullOrEmpty(request.Status) && Enum.TryParse<ProjectStatus>(request.Status, true, out var status))
            update = update.Set(p => p.Status, status);

        var options = new FindOneAndUpdateOptions<Project>
        {
            ReturnDocument = ReturnDocument.After
        };

        return await _dbContext.Projects.FindOneAndUpdateAsync(p => p.Id == id, update, options);
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var session = await _dbContext.Database.Client.StartSessionAsync();
        try
        {
            session.StartTransaction();

            await _dbContext.Projects.DeleteOneAsync(session, p => p.Id == id);
            await _dbContext.Documents.DeleteManyAsync(session, d => d.ProjectId == id);

            var docs = await _dbContext.Documents.Find(d => d.ProjectId == id).ToListAsync();
            var docIds = docs.Select(d => d.Id).ToList();
            await _dbContext.Annotations.DeleteManyAsync(session, a => docIds.Contains(a.DocumentId));
            await _dbContext.ReviewWorkflows.DeleteManyAsync(session, w => docIds.Contains(w.DocumentId));

            await session.CommitTransactionAsync();
            return true;
        }
        catch
        {
            await session.AbortTransactionAsync();
            throw;
        }
    }

    public async Task<bool> AddMemberAsync(string projectId, string userId, UserRole role)
    {
        var user = await _authService.GetUserByIdAsync(userId);
        if (user == null) return false;

        var member = new ProjectMember
        {
            UserId = userId,
            UserName = user.Name,
            Role = role,
            JoinedAt = DateTime.UtcNow
        };

        var update = Builders<Project>.Update
            .AddToSet(p => p.Members, member)
            .Set(p => p.UpdatedAt, DateTime.UtcNow);

        var result = await _dbContext.Projects.UpdateOneAsync(p => p.Id == projectId, update);
        return result.ModifiedCount > 0;
    }

    public async Task<bool> RemoveMemberAsync(string projectId, string userId)
    {
        var update = Builders<Project>.Update
            .PullFilter(p => p.Members, m => m.UserId == userId)
            .Set(p => p.UpdatedAt, DateTime.UtcNow);

        var result = await _dbContext.Projects.UpdateOneAsync(p => p.Id == projectId, update);
        return result.ModifiedCount > 0;
    }

    public async Task<object> GetStatsAsync(string projectId)
    {
        await UpdateStatsAsync(projectId);
        var project = await GetByIdAsync(projectId);

        var annotations = await _dbContext.Annotations
            .Find(a => a.DocumentId != null)
            .ToListAsync();

        var docIds = (await _dbContext.Documents.Find(d => d.ProjectId == projectId).ToListAsync())
            .Select(d => d.Id)
            .ToList();

        var projectAnnotations = annotations.Where(a => docIds.Contains(a.DocumentId)).ToList();

        return new
        {
            project?.Stats,
            TotalProjects = 1,
            TotalDocuments = docIds.Count,
            TotalAnnotations = projectAnnotations.Count,
            CompletionRate = project?.Stats?.TotalAnnotations > 0
                ? Math.Round((double)(project.Stats.ResolvedAnnotations * 100) / project.Stats.TotalAnnotations, 1)
                : 0,
            SeverityStats = new
            {
                Low = projectAnnotations.Count(a => a.Severity == AnnotationSeverity.Low),
                Medium = projectAnnotations.Count(a => a.Severity == AnnotationSeverity.Medium),
                High = projectAnnotations.Count(a => a.Severity == AnnotationSeverity.High),
                Critical = projectAnnotations.Count(a => a.Severity == AnnotationSeverity.Critical)
            },
            StatusStats = new
            {
                Open = projectAnnotations.Count(a => a.Status == AnnotationStatus.Open),
                InProgress = projectAnnotations.Count(a => a.Status == AnnotationStatus.InProgress),
                Resolved = projectAnnotations.Count(a => a.Status == AnnotationStatus.Resolved),
                Rejected = projectAnnotations.Count(a => a.Status == AnnotationStatus.Rejected)
            },
            Projects = new[]
            {
                new
                {
                    project?.Id,
                    project?.Name,
                    Status = project?.Status.ToString(),
                    Progress = project?.Stats?.TotalAnnotations > 0
                        ? Math.Round((double)(project.Stats.ResolvedAnnotations * 100) / project.Stats.TotalAnnotations, 0)
                        : 0,
                    Annotations = project?.Stats?.TotalAnnotations ?? 0,
                    Resolved = project?.Stats?.ResolvedAnnotations ?? 0
                }
            }
        };
    }

    public async Task<byte[]> ExportReportAsync(string projectId, string? discipline = null, DateTime? startDate = null, DateTime? endDate = null)
    {
        await UpdateStatsAsync(projectId);
        var stats = await GetStatsAsync(projectId);

        var csv = "建筑图纸审阅报告\n";
        csv += $"导出时间,{DateTime.Now:yyyy-MM-dd HH:mm:ss}\n\n";
        csv += "统计摘要\n";
        csv += $"项目ID,{projectId}\n";

        return System.Text.Encoding.UTF8.GetBytes(csv);
    }

    public async Task UpdateStatsAsync(string projectId)
    {
        var documents = await _dbContext.Documents
            .Find(d => d.ProjectId == projectId)
            .ToListAsync();

        var docIds = documents.Select(d => d.Id).ToList();

        var annotations = await _dbContext.Annotations
            .Find(a => docIds.Contains(a.DocumentId))
            .ToListAsync();

        var workflows = await _dbContext.ReviewWorkflows
            .Find(w => docIds.Contains(w.DocumentId) && !w.IsCancelled)
            .ToListAsync();

        var stats = new ProjectStats
        {
            TotalDocuments = documents.Count,
            TotalAnnotations = annotations.Count,
            ResolvedAnnotations = annotations.Count(a => a.Status == AnnotationStatus.Resolved),
            PendingReviews = workflows.Count(w => w.Status == ReviewStatus.InProgress || w.Status == ReviewStatus.Pending),
            CompletedReviews = workflows.Count(w => w.Status == ReviewStatus.Approved)
        };

        var update = Builders<Project>.Update
            .Set(p => p.Stats, stats)
            .Set(p => p.UpdatedAt, DateTime.UtcNow);

        await _dbContext.Projects.UpdateOneAsync(p => p.Id == projectId, update);
    }
}
