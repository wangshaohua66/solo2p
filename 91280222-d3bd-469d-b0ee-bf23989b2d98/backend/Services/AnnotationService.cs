using BlueprintReview.Data;
using BlueprintReview.DTOs;
using BlueprintReview.Models;
using MongoDB.Driver;

namespace BlueprintReview.Services;

public interface IAnnotationService
{
    Task<List<Annotation>> GetByDocumentAsync(string documentId, string? versionId = null, AnnotationStatus? status = null, int? pageNumber = null);
    Task<Annotation?> GetByIdAsync(string id);
    Task<Annotation> CreateAsync(CreateAnnotationRequest request, string userId, string userName);
    Task<Annotation?> UpdateAsync(string id, UpdateAnnotationRequest request);
    Task<bool> DeleteAsync(string id);
    Task<AnnotationReply> AddReplyAsync(string annotationId, AddReplyRequest request, string userId, string userName);
    Task<bool> DeleteReplyAsync(string annotationId, string replyId);
    Task<List<Annotation>> MigrateAsync(List<string> annotationIds, string targetVersionId, string userId, string userName);
    Task<List<AnnotationConflict>> DetectConflictAsync(DetectConflictRequest request, string excludeUserId);
    Task ResolveConflictAsync(string annotationId, string action);
}

public class AnnotationService : IAnnotationService
{
    private readonly IMongoDbContext _dbContext;

    public AnnotationService(IMongoDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<List<Annotation>> GetByDocumentAsync(
        string documentId,
        string? versionId = null,
        AnnotationStatus? status = null,
        int? pageNumber = null)
    {
        var filter = Builders<Annotation>.Filter.Eq(a => a.DocumentId, documentId);

        if (!string.IsNullOrEmpty(versionId))
        {
            filter &= Builders<Annotation>.Filter.Eq(a => a.VersionId, versionId);
        }

        if (status.HasValue)
        {
            filter &= Builders<Annotation>.Filter.Eq(a => a.Status, status.Value);
        }

        if (pageNumber.HasValue)
        {
            filter &= Builders<Annotation>.Filter.Eq(a => a.PageNumber, pageNumber.Value);
        }

        var sort = Builders<Annotation>.Sort.Descending(a => a.CreatedAt);
        return await _dbContext.Annotations.Find(filter).Sort(sort).ToListAsync();
    }

    public async Task<Annotation?> GetByIdAsync(string id)
    {
        return await _dbContext.Annotations.Find(a => a.Id == id).FirstOrDefaultAsync();
    }

    public async Task<Annotation> CreateAsync(CreateAnnotationRequest request, string userId, string userName)
    {
        var annotation = new Annotation
        {
            DocumentId = request.DocumentId,
            VersionId = request.VersionId,
            PageNumber = request.PageNumber,
            Geometry = request.Geometry,
            Content = request.Content,
            Severity = request.Severity,
            Status = AnnotationStatus.Open,
            AuthorId = userId,
            AuthorName = userName,
            AssigneeId = request.AssigneeId,
            Mentions = request.Mentions ?? new List<string>(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _dbContext.Annotations.InsertOneAsync(annotation);
        await UpdateDocumentStats(request.DocumentId);
        return annotation;
    }

    public async Task<Annotation?> UpdateAsync(string id, UpdateAnnotationRequest request)
    {
        var update = Builders<Annotation>.Update.Set(a => a.UpdatedAt, DateTime.UtcNow);

        if (!string.IsNullOrEmpty(request.Content))
        {
            update = update.Set(a => a.Content, request.Content);
        }

        if (request.Status.HasValue)
        {
            update = update.Set(a => a.Status, request.Status.Value);
        }

        if (request.Severity.HasValue)
        {
            update = update.Set(a => a.Severity, request.Severity.Value);
        }

        if (!string.IsNullOrEmpty(request.AssigneeId))
        {
            update = update.Set(a => a.AssigneeId, request.AssigneeId);
        }

        var options = new FindOneAndUpdateOptions<Annotation>
        {
            ReturnDocument = ReturnDocument.After
        };

        var result = await _dbContext.Annotations.FindOneAndUpdateAsync(
            a => a.Id == id,
            update,
            options
        );

        if (result != null)
        {
            await UpdateDocumentStats(result.DocumentId);
        }

        return result;
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var annotation = await GetByIdAsync(id);
        var result = await _dbContext.Annotations.DeleteOneAsync(a => a.Id == id);

        if (result.DeletedCount > 0 && annotation != null)
        {
            await UpdateDocumentStats(annotation.DocumentId);
        }

        return result.DeletedCount > 0;
    }

    public async Task<AnnotationReply> AddReplyAsync(string annotationId, AddReplyRequest request, string userId, string userName)
    {
        var reply = new AnnotationReply
        {
            Content = request.Content,
            AuthorId = userId,
            AuthorName = userName,
            Mentions = request.Mentions ?? new List<string>(),
            CreatedAt = DateTime.UtcNow
        };

        var update = Builders<Annotation>.Update
            .Push(a => a.Replies, reply)
            .Set(a => a.UpdatedAt, DateTime.UtcNow);

        await _dbContext.Annotations.UpdateOneAsync(a => a.Id == annotationId, update);
        return reply;
    }

    public async Task<bool> DeleteReplyAsync(string annotationId, string replyId)
    {
        var update = Builders<Annotation>.Update
            .PullFilter(a => a.Replies, r => r.Id == replyId)
            .Set(a => a.UpdatedAt, DateTime.UtcNow);

        var result = await _dbContext.Annotations.UpdateOneAsync(a => a.Id == annotationId, update);
        return result.ModifiedCount > 0;
    }

    public async Task<List<Annotation>> MigrateAsync(List<string> annotationIds, string targetVersionId, string userId, string userName)
    {
        var annotations = await _dbContext.Annotations
            .Find(a => annotationIds.Contains(a.Id))
            .ToListAsync();

        var migratedAnnotations = new List<Annotation>();

        foreach (var annotation in annotations)
        {
            if (annotation.Status == AnnotationStatus.Resolved) continue;

            var migrated = new Annotation
            {
                DocumentId = annotation.DocumentId,
                VersionId = targetVersionId,
                PageNumber = annotation.PageNumber,
                Geometry = annotation.Geometry,
                Content = annotation.Content,
                Status = AnnotationStatus.Open,
                Severity = annotation.Severity,
                AuthorId = annotation.AuthorId,
                AuthorName = annotation.AuthorName,
                AssigneeId = annotation.AssigneeId,
                AssigneeName = annotation.AssigneeName,
                Mentions = annotation.Mentions,
                MigratedFrom = annotation.Id,
                IsMigrated = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            migratedAnnotations.Add(migrated);
        }

        if (migratedAnnotations.Count > 0)
        {
            await _dbContext.Annotations.InsertManyAsync(migratedAnnotations);

            var originalIds = migratedAnnotations
                .Where(a => !string.IsNullOrEmpty(a.MigratedFrom))
                .Select(a => a.MigratedFrom!)
                .ToList();

            if (originalIds.Count > 0)
            {
                var resolveUpdate = Builders<Annotation>.Update
                    .Set(a => a.Status, AnnotationStatus.Resolved)
                    .Set(a => a.UpdatedAt, DateTime.UtcNow);
                await _dbContext.Annotations.UpdateManyAsync(
                    a => originalIds.Contains(a.Id) && a.Status != AnnotationStatus.Resolved,
                    resolveUpdate);
            }

            if (migratedAnnotations[0] != null)
            {
                await UpdateDocumentStats(migratedAnnotations[0].DocumentId);
            }
        }

        return migratedAnnotations;
    }

    public async Task<List<AnnotationConflict>> DetectConflictAsync(DetectConflictRequest request, string excludeUserId)
    {
        var conflicts = new List<AnnotationConflict>();

        var existingAnnotations = await _dbContext.Annotations
            .Find(a =>
                a.DocumentId == request.DocumentId &&
                a.VersionId == request.VersionId &&
                a.PageNumber == request.PageNumber &&
                a.AuthorId != excludeUserId &&
                a.Status != AnnotationStatus.Resolved
            )
            .ToListAsync();

        foreach (var existing in existingAnnotations)
        {
            var overlap = CalculateOverlap(request.Geometry, existing.Geometry);
            if (overlap > 0.15)
            {
                conflicts.Add(new AnnotationConflict
                {
                    AnnotationId = existing.Id,
                    OverlapArea = overlap,
                    UserId = existing.AuthorId,
                    UserName = existing.AuthorName,
                    Timestamp = DateTime.UtcNow
                });
            }
        }

        return conflicts;
    }

    public async Task ResolveConflictAsync(string annotationId, string action)
    {
        var update = Builders<Annotation>.Update.Set(a => a.Conflicts, new List<AnnotationConflict>());
        await _dbContext.Annotations.UpdateOneAsync(a => a.Id == annotationId, update);
    }

    private double CalculateOverlap(AnnotationGeometry geo1, AnnotationGeometry geo2)
    {
        var rect1 = GetBoundingBox(geo1);
        var rect2 = GetBoundingBox(geo2);

        var overlapX = Math.Max(0, Math.Min(rect1.X + rect1.Width, rect2.X + rect2.Width) - Math.Max(rect1.X, rect2.X));
        var overlapY = Math.Max(0, Math.Min(rect1.Y + rect1.Height, rect2.Y + rect2.Height) - Math.Max(rect1.Y, rect2.Y));
        var overlapArea = overlapX * overlapY;

        var area1 = rect1.Width * rect1.Height;
        var area2 = rect2.Width * rect2.Height;
        var minArea = Math.Min(area1, area2);

        return minArea > 0 ? overlapArea / minArea : 0;
    }

    private (double X, double Y, double Width, double Height) GetBoundingBox(AnnotationGeometry geo)
    {
        if (geo.Points.Count == 0)
            return (0, 0, 0, 0);

        switch (geo.Type)
        {
            case AnnotationType.Rectangle:
                if (geo.Points.Count >= 2)
                {
                    var x = Math.Min(geo.Points[0].X, geo.Points[1].X);
                    var y = Math.Min(geo.Points[0].Y, geo.Points[1].Y);
                    var w = geo.Width ?? Math.Abs(geo.Points[1].X - geo.Points[0].X);
                    var h = geo.Height ?? Math.Abs(geo.Points[1].Y - geo.Points[0].Y);
                    return (x, y, w, h);
                }
                break;
            case AnnotationType.Circle:
                var r = geo.Radius ?? 50;
                return (geo.Points[0].X - r, geo.Points[0].Y - r, r * 2, r * 2);
            case AnnotationType.Arrow:
            case AnnotationType.Freeform:
                var minX = geo.Points.Min(p => p.X);
                var minY = geo.Points.Min(p => p.Y);
                var maxX = geo.Points.Max(p => p.X);
                var maxY = geo.Points.Max(p => p.Y);
                return (minX, minY, maxX - minX, maxY - minY);
        }

        return (0, 0, 0, 0);
    }

    private async Task UpdateDocumentStats(string documentId)
    {
        var allAnnotations = await _dbContext.Annotations
            .Find(a => a.DocumentId == documentId)
            .ToListAsync();

        var resolvedCount = allAnnotations.Count(a => a.Status == AnnotationStatus.Resolved);

        var update = Builders<Document>.Update.Combine(
            Builders<Document>.Update.Set(d => d.UpdatedAt, DateTime.UtcNow)
        );

        await _dbContext.Documents.UpdateOneAsync(d => d.Id == documentId, update);

        var doc = await _dbContext.Documents.Find(d => d.Id == documentId).FirstOrDefaultAsync();
        if (doc != null)
        {
            var projectUpdate = Builders<Project>.Update
                .Inc(p => p.Stats.TotalAnnotations, 1)
                .Set(p => p.Stats.ResolvedAnnotations, resolvedCount)
                .Set(p => p.UpdatedAt, DateTime.UtcNow);

            await _dbContext.Projects.UpdateOneAsync(p => p.Id == doc.ProjectId, projectUpdate);
        }
    }
}
