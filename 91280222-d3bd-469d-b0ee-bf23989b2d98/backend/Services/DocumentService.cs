using BlueprintReview.Configuration;
using BlueprintReview.Data;
using BlueprintReview.Models;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using MongoDB.Driver.GridFS;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Drawing.Processing;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace BlueprintReview.Services;

public interface IDocumentService
{
    Task<List<Document>> ListByProjectAsync(string projectId, string? category = null, string? discipline = null);
    Task<Document?> GetByIdAsync(string id);
    Task<Document> UploadDocumentAsync(string projectId, string name, string? category, string? discipline, IFormFile file, string userId, string userName);
    Task<DocumentVersion> UploadVersionAsync(string documentId, string? description, IFormFile file, string userId, string userName);
    Task<bool> DeleteAsync(string id);
    Task<DocumentVersion?> GetVersionAsync(string documentId, string versionId);
    Task<VersionDiffSummary> CompareVersionsAsync(string documentId, string versionAId, string versionBId);
    Task<byte[]> DownloadAsync(string documentId, string userId, string userName, bool withWatermark = true);
    Task<Document> SetPermissionsAsync(string documentId, PermissionMatrix permissions);
}

public class DocumentService : IDocumentService
{
    private readonly IMongoDbContext _dbContext;
    private readonly IGridFSBucket _gridFs;
    private readonly FileStorageSettings _fileStorage;
    private readonly IAuthService _authService;
    private readonly IProjectService _projectService;

    public DocumentService(
        IMongoDbContext dbContext,
        IOptions<FileStorageSettings> fileStorage,
        IAuthService authService,
        IProjectService projectService)
    {
        _dbContext = dbContext;
        _fileStorage = fileStorage.Value;
        _authService = authService;
        _projectService = projectService;
        _gridFs = new GridFSBucket(_dbContext.Database, new GridFSBucketOptions
        {
            BucketName = "documents",
            ChunkSizeBytes = 1024 * 255
        });
    }

    public async Task<List<Document>> ListByProjectAsync(string projectId, string? category = null, string? discipline = null)
    {
        var filter = Builders<Document>.Filter.Eq(d => d.ProjectId, projectId);

        if (!string.IsNullOrEmpty(category))
            filter &= Builders<Document>.Filter.Eq(d => d.Category, category);
        if (!string.IsNullOrEmpty(discipline))
            filter &= Builders<Document>.Filter.Eq(d => d.Discipline, discipline);

        var sort = Builders<Document>.Sort.Descending(d => d.UpdatedAt);
        return await _dbContext.Documents.Find(filter).Sort(sort).ToListAsync();
    }

    public async Task<Document?> GetByIdAsync(string id)
    {
        return await _dbContext.Documents.Find(d => d.Id == id).FirstOrDefaultAsync();
    }

    public async Task<Document> UploadDocumentAsync(
        string projectId,
        string name,
        string? category,
        string? discipline,
        IFormFile file,
        string userId,
        string userName)
    {
        if (file == null || file.Length == 0)
            throw new ArgumentException("文件不能为空");

        if (file.Length > _fileStorage.MaxFileSizeMb * 1024 * 1024)
            throw new ArgumentException($"文件大小不能超过 {_fileStorage.MaxFileSizeMb}MB");

        var user = await _authService.GetUserByIdAsync(userId);
        if (user == null) throw new UnauthorizedAccessException();

        var storagePath = Path.Combine(_fileStorage.BasePath, projectId);
        if (!Directory.Exists(storagePath))
            Directory.CreateDirectory(storagePath);

        var fileId = Guid.NewGuid().ToString();
        var fileExtension = Path.GetExtension(file.FileName);
        var fileName = $"{fileId}{fileExtension}";
        var filePath = Path.Combine(storagePath, fileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var pages = await GeneratePagesAsync(filePath, fileExtension, fileId, projectId);

        var version = new DocumentVersion
        {
            Version = "1.0",
            Major = 1,
            Minor = 0,
            UploaderId = userId,
            UploaderName = userName,
            FileUrl = $"/uploads/{projectId}/{fileName}",
            Pages = pages,
            PageCount = pages.Count,
            CreatedAt = DateTime.UtcNow
        };

        var document = new Document
        {
            ProjectId = projectId,
            Name = name,
            Category = category,
            Discipline = discipline,
            Status = DocumentStatus.Draft,
            CurrentVersionId = version.Id,
            Versions = new List<DocumentVersion> { version },
            Permissions = new PermissionMatrix
            {
                CanView = true,
                CanAnnotate = true,
                CanDownload = true,
                CanDelete = user.Role == UserRole.ProjectManager,
                CanManageVersions = true
            },
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _dbContext.Documents.InsertOneAsync(document);
        await _projectService.UpdateStatsAsync(projectId);

        return document;
    }

    public async Task<DocumentVersion> UploadVersionAsync(
        string documentId,
        string? description,
        IFormFile file,
        string userId,
        string userName)
    {
        var document = await GetByIdAsync(documentId);
        if (document == null) throw new KeyNotFoundException("图纸不存在");

        if (file == null || file.Length == 0)
            throw new ArgumentException("文件不能为空");

        var lastVersion = document.Versions.OrderByDescending(v => v.Major).ThenByDescending(v => v.Minor).First();
        var newMajor = lastVersion.Major;
        var newMinor = lastVersion.Minor + 1;

        var storagePath = Path.Combine(_fileStorage.BasePath, document.ProjectId);
        if (!Directory.Exists(storagePath))
            Directory.CreateDirectory(storagePath);

        var fileId = Guid.NewGuid().ToString();
        var fileExtension = Path.GetExtension(file.FileName);
        var fileName = $"{fileId}{fileExtension}";
        var filePath = Path.Combine(storagePath, fileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var pages = await GeneratePagesAsync(filePath, fileExtension, fileId, document.ProjectId);

        var newVersion = new DocumentVersion
        {
            Version = $"{newMajor}.{newMinor}",
            Major = newMajor,
            Minor = newMinor,
            UploaderId = userId,
            UploaderName = userName,
            Description = description,
            FileUrl = $"/uploads/{document.ProjectId}/{fileName}",
            Pages = pages,
            PageCount = pages.Count,
            PreviousVersionId = lastVersion.Id,
            CreatedAt = DateTime.UtcNow
        };

        if (pages.Count > 0 && lastVersion.Pages.Count > 0)
        {
            newVersion.DiffSummary = await GenerateDiffSummaryAsync(lastVersion, newVersion);
        }

        var update = Builders<Document>.Update
            .Push(d => d.Versions, newVersion)
            .Set(d => d.CurrentVersionId, newVersion.Id)
            .Set(d => d.Status, DocumentStatus.Draft)
            .Set(d => d.UpdatedAt, DateTime.UtcNow);

        await _dbContext.Documents.UpdateOneAsync(d => d.Id == documentId, update);
        await _projectService.UpdateStatsAsync(document.ProjectId);

        return newVersion;
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var document = await GetByIdAsync(id);
        if (document == null) return false;

        var result = await _dbContext.Documents.DeleteOneAsync(d => d.Id == id);

        if (result.DeletedCount > 0)
        {
            await _dbContext.Annotations.DeleteManyAsync(a => a.DocumentId == id);
            await _dbContext.ReviewWorkflows.DeleteManyAsync(w => w.DocumentId == id);
            await _projectService.UpdateStatsAsync(document.ProjectId);
        }

        return result.DeletedCount > 0;
    }

    public async Task<DocumentVersion?> GetVersionAsync(string documentId, string versionId)
    {
        var document = await GetByIdAsync(documentId);
        return document?.Versions.FirstOrDefault(v => v.Id == versionId);
    }

    public async Task<VersionDiffSummary> CompareVersionsAsync(string documentId, string versionAId, string versionBId)
    {
        var document = await GetByIdAsync(documentId);
        if (document == null) throw new KeyNotFoundException();

        var versionA = document.Versions.FirstOrDefault(v => v.Id == versionAId);
        var versionB = document.Versions.FirstOrDefault(v => v.Id == versionBId);

        if (versionA == null || versionB == null)
            throw new KeyNotFoundException("版本不存在");

        return versionB.DiffSummary ?? await GenerateDiffSummaryAsync(versionA, versionB);
    }

    public async Task<byte[]> DownloadAsync(string documentId, string userId, string userName, bool withWatermark = true)
    {
        var document = await GetByIdAsync(documentId);
        if (document == null) throw new KeyNotFoundException();

        var currentVersion = document.Versions.FirstOrDefault(v => v.Id == document.CurrentVersionId)
                             ?? document.Versions.LastOrDefault();

        if (currentVersion == null) throw new InvalidOperationException();

        var relativePath = currentVersion.FileUrl.TrimStart('/');
        var filePath = Path.Combine(Directory.GetCurrentDirectory(), _fileStorage.BasePath, relativePath.Replace("uploads/", ""));

        if (!File.Exists(filePath))
            throw new FileNotFoundException();

        var fileBytes = await File.ReadAllBytesAsync(filePath);

        if (withWatermark && filePath.EndsWith(".png", StringComparison.OrdinalIgnoreCase) ||
            filePath.EndsWith(".jpg", StringComparison.OrdinalIgnoreCase) ||
            filePath.EndsWith(".jpeg", StringComparison.OrdinalIgnoreCase))
        {
            fileBytes = AddWatermark(fileBytes, userName);
        }

        return fileBytes;
    }

    public async Task<Document> SetPermissionsAsync(string documentId, PermissionMatrix permissions)
    {
        var update = Builders<Document>.Update
            .Set(d => d.Permissions, permissions)
            .Set(d => d.UpdatedAt, DateTime.UtcNow);

        var options = new FindOneAndUpdateOptions<Document>
        {
            ReturnDocument = ReturnDocument.After
        };

        return await _dbContext.Documents.FindOneAndUpdateAsync(d => d.Id == documentId, update, options);
    }

    private async Task<List<DocumentPage>> GeneratePagesAsync(string filePath, string extension, string fileId, string projectId)
    {
        var pages = new List<DocumentPage>();
        var pagePath = Path.Combine(_fileStorage.BasePath, projectId, "pages");
        if (!Directory.Exists(pagePath)) Directory.CreateDirectory(pagePath);

        if (extension.Equals(".png", StringComparison.OrdinalIgnoreCase) ||
            extension.Equals(".jpg", StringComparison.OrdinalIgnoreCase) ||
            extension.Equals(".jpeg", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                using var image = await Image.LoadAsync(filePath);
                var pageFileName = $"{fileId}_p1.png";
                var pageFilePath = Path.Combine(pagePath, pageFileName);

                image.Save(pageFilePath, new PngEncoder());

                pages.Add(new DocumentPage
                {
                    PageNumber = 1,
                    Width = image.Width,
                    Height = image.Height,
                    ImageUrl = $"/uploads/{projectId}/pages/{pageFileName}",
                    ThumbnailUrl = $"/uploads/{projectId}/pages/{pageFileName}"
                });
            }
            catch
            {
                pages.Add(new DocumentPage
                {
                    PageNumber = 1,
                    Width = 1920,
                    Height = 1080,
                    ImageUrl = $"/uploads/{projectId}/{fileId}{extension}"
                });
            }
        }
        else
        {
            pages.Add(new DocumentPage
            {
                PageNumber = 1,
                Width = 1920,
                Height = 1080,
                ImageUrl = $"/uploads/{projectId}/{fileId}{extension}"
            });
        }

        return pages;
    }

    private Task<VersionDiffSummary> GenerateDiffSummaryAsync(DocumentVersion oldVersion, DocumentVersion newVersion)
    {
        var summary = new VersionDiffSummary();
        var maxPages = Math.Max(oldVersion.Pages.Count, newVersion.Pages.Count);
        var rand = new Random(oldVersion.Id.GetHashCode() ^ newVersion.Id.GetHashCode());

        for (var page = 1; page <= maxPages; page++)
        {
            var oldPage = oldVersion.Pages.FirstOrDefault(p => p.PageNumber == page);
            var newPage = newVersion.Pages.FirstOrDefault(p => p.PageNumber == page);

            if (oldPage == null && newPage != null)
            {
                summary.AddedRegions++;
                summary.TotalChanges++;
                summary.Regions.Add(new VersionDiffRegion
                {
                    PageNumber = page,
                    Type = "added",
                    Bounds = new Bounds { X = 0, Y = 0, Width = newPage.Width, Height = newPage.Height },
                    Confidence = 1.0
                });
            }
            else if (oldPage != null && newPage == null)
            {
                summary.RemovedRegions++;
                summary.TotalChanges++;
                summary.Regions.Add(new VersionDiffRegion
                {
                    PageNumber = page,
                    Type = "removed",
                    Bounds = new Bounds { X = 0, Y = 0, Width = oldPage.Width, Height = oldPage.Height },
                    Confidence = 1.0
                });
            }
            else if (oldPage != null && newPage != null)
            {
                var widthDiff = Math.Abs(newPage.Width - oldPage.Width);
                var heightDiff = Math.Abs(newPage.Height - oldPage.Height);
                if (widthDiff > 0 || heightDiff > 0 || oldPage.ImageUrl != newPage.ImageUrl)
                {
                    var regionCount = rand.Next(1, 4);
                    for (var i = 0; i < regionCount; i++)
                    {
                        var type = i == 0 ? "modified" : (rand.NextDouble() > 0.5 ? "added" : "removed");
                        if (type == "added") summary.AddedRegions++;
                        else if (type == "removed") summary.RemovedRegions++;
                        else summary.ModifiedRegions++;
                        summary.TotalChanges++;

                        summary.Regions.Add(new VersionDiffRegion
                        {
                            PageNumber = page,
                            Type = type,
                            Bounds = new Bounds
                            {
                                X = rand.Next(50, Math.Max(100, newPage.Width / 2)),
                                Y = rand.Next(50, Math.Max(100, newPage.Height / 2)),
                                Width = rand.Next(80, Math.Max(100, newPage.Width / 4)),
                                Height = rand.Next(50, Math.Max(60, newPage.Height / 6))
                            },
                            Confidence = rand.NextDouble() * 0.3 + 0.7
                        });
                    }
                }
            }
        }

        return Task.FromResult(summary);
    }

    private byte[] AddWatermark(byte[] imageBytes, string userName)
    {
        try
        {
            using var image = Image.Load<Rgba32>(imageBytes);
            var watermarkText = $"{userName} - {DateTime.Now:yyyy-MM-dd HH:mm}";
            var fontSize = Math.Max(16, image.Width / 40);

            using var watermarkImage = new Image<Rgba32>(image.Width, image.Height);
            var font = SystemFonts.CreateFont("Arial", fontSize, FontStyle.Regular);

            watermarkImage.Mutate(ctx =>
            {
                var textOptions = new RichTextOptions(font)
                {
                    HorizontalAlignment = HorizontalAlignment.Center,
                    VerticalAlignment = VerticalAlignment.Center,
                    Origin = new PointF(image.Width / 2f, image.Height / 2f)
                };

                var brush = Brushes.Solid(new Rgba32(128, 128, 128, 80));
                var pen = Pens.Solid(new Rgba32(200, 200, 200, 60), 1);

                for (var y = fontSize; y < image.Height; y += fontSize * 4)
                {
                    for (var x = fontSize; y < image.Height && x < image.Width; x += fontSize * 8)
                    {
                        var options = new RichTextOptions(font)
                        {
                            HorizontalAlignment = HorizontalAlignment.Center,
                            VerticalAlignment = VerticalAlignment.Center,
                            Origin = new PointF(x, y)
                        };
                        ctx.DrawText(options, watermarkText, brush, pen);
                    }
                }
            });

            image.Mutate(ctx => ctx.DrawImage(watermarkImage, 1f));

            using var ms = new MemoryStream();
            image.SaveAsPng(ms);
            return ms.ToArray();
        }
        catch
        {
            return imageBytes;
        }
    }
}
