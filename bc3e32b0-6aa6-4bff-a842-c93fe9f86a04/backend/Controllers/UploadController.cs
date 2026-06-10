using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PotteryStudio.Models;
using PotteryStudio.Services;
using System.Security.Claims;
using System.Collections.Concurrent;

namespace PotteryStudio.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UploadController : ControllerBase
{
    private readonly IImageService _imageService;
    private static readonly ConcurrentDictionary<string, ChunkUploadInfo> _chunkUploads = new();

    public UploadController(IImageService imageService)
    {
        _imageService = imageService;
    }

    [HttpPost("image")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<UploadResult>>> UploadImage(
        IFormFile file,
        [FromForm] string category = "general",
        [FromForm] int maxWidth = 1200)
    {
        if (file == null || file.Length == 0)
            return BadRequest(ApiResponse.Fail("请上传文件"));

        if (file.Length > 8 * 1024 * 1024)
            return BadRequest(ApiResponse.Fail("文件大小不能超过8MB"));

        var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp", "image/gif" };
        if (!allowedTypes.Contains(file.ContentType.ToLower()))
            return BadRequest(ApiResponse.Fail("不支持的文件格式"));

        try
        {
            using var stream = file.OpenReadStream();
            var (filePath, fileName) = await _imageService.SaveUploadedImageAsync(
                stream, file.FileName, category, maxWidth);

            var thumbnailPath = await _imageService.GenerateThumbnailAsync(filePath, 400);

            var relativePath = _imageService.GetRelativePath(filePath);
            var relativeThumbnailPath = _imageService.GetRelativePath(thumbnailPath);

            var result = new UploadResult
            {
                Id = Guid.NewGuid(),
                Url = $"/{relativePath}",
                ThumbnailUrl = $"/{relativeThumbnailPath}",
                FileName = fileName,
                Size = file.Length,
                MimeType = "image/webp",
                Category = category,
                UploadedAt = DateTime.UtcNow
            };

            await GenerateAllThumbnailsAsync(filePath, category);

            return Ok(ApiResponse<UploadResult>.Success(result));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse.Fail($"上传失败: {ex.Message}"));
        }
    }

    [HttpPost("chunk/init")]
    [Authorize]
    public ActionResult<ApiResponse<object>> InitChunkUpload(
        [FromForm] string fileName,
        [FromForm] long fileSize,
        [FromForm] int totalChunks,
        [FromForm] string category = "general")
    {
        var uploadId = Guid.NewGuid().ToString();
        var info = new ChunkUploadInfo
        {
            UploadId = uploadId,
            FileName = fileName,
            FileSize = fileSize,
            TotalChunks = totalChunks
        };

        _chunkUploads[uploadId] = info;

        return Ok(ApiResponse<object>.Success(new { uploadId, chunkSize = 1024 * 1024 }));
    }

    [HttpPost("chunk")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> UploadChunk(
        IFormFile file,
        [FromForm] string uploadId,
        [FromForm] int chunkIndex,
        [FromForm] string category = "general")
    {
        if (!_chunkUploads.TryGetValue(uploadId, out var info))
            return BadRequest(ApiResponse.Fail("上传会话不存在或已过期"));

        var chunkDir = Path.Combine(_imageService.GetUploadPath(category), "chunks", uploadId);
        if (!Directory.Exists(chunkDir))
            Directory.CreateDirectory(chunkDir);

        var chunkPath = Path.Combine(chunkDir, $"chunk_{chunkIndex}");
        using (var stream = new FileStream(chunkPath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        info.ReceivedChunks.Add(chunkIndex);
        _chunkUploads[uploadId] = info;

        return Ok(ApiResponse<object>.Success(new { received = info.ReceivedChunks.Count, total = info.TotalChunks }));
    }

    [HttpPost("chunk/complete")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<UploadResult>>> CompleteChunkUpload(
        [FromForm] string uploadId,
        [FromForm] string category = "general")
    {
        if (!_chunkUploads.TryGetValue(uploadId, out var info))
            return BadRequest(ApiResponse.Fail("上传会话不存在或已过期"));

        if (info.ReceivedChunks.Count != info.TotalChunks)
            return BadRequest(ApiResponse.Fail("分片不完整"));

        var chunkDir = Path.Combine(_imageService.GetUploadPath(category), "chunks", uploadId);
        var tempFilePath = Path.Combine(chunkDir, "merged.tmp");

        try
        {
            using (var output = new FileStream(tempFilePath, FileMode.Create))
            {
                for (int i = 0; i < info.TotalChunks; i++)
                {
                    var chunkPath = Path.Combine(chunkDir, $"chunk_{i}");
                    using var chunk = new FileStream(chunkPath, FileMode.Open);
                    await chunk.CopyToAsync(output);
                }
            }

            using var stream = new FileStream(tempFilePath, FileMode.Open);
            var (filePath, fileName) = await _imageService.SaveUploadedImageAsync(
                stream, info.FileName, category);

            var thumbnailPath = await _imageService.GenerateThumbnailAsync(filePath, 400);

            var relativePath = _imageService.GetRelativePath(filePath);
            var relativeThumbnailPath = _imageService.GetRelativePath(thumbnailPath);

            var result = new UploadResult
            {
                Id = Guid.NewGuid(),
                Url = $"/{relativePath}",
                ThumbnailUrl = $"/{relativeThumbnailPath}",
                FileName = fileName,
                Size = info.FileSize,
                MimeType = "image/webp",
                Category = category,
                UploadedAt = DateTime.UtcNow
            };

            if (Directory.Exists(chunkDir))
                Directory.Delete(chunkDir, true);
            _chunkUploads.TryRemove(uploadId, out _);

            await GenerateAllThumbnailsAsync(filePath, category);

            return Ok(ApiResponse<UploadResult>.Success(result));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse.Fail($"合并文件失败: {ex.Message}"));
        }
    }

    [HttpDelete("{*path}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse>> DeleteImage(string path)
    {
        try
        {
            await _imageService.DeleteImageAsync(path);
            return Ok(ApiResponse.Success("删除成功"));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse.Fail($"删除失败: {ex.Message}"));
        }
    }

    private async Task GenerateAllThumbnailsAsync(string originalPath, string category)
    {
        var sizes = new[] { 100, 200, 400, 800 };
        foreach (var size in sizes)
        {
            try
            {
                await _imageService.GenerateThumbnailAsync(originalPath, size);
            }
            catch
            {
            }
        }
    }
}
