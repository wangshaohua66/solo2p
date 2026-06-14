using System.Security.Claims;
using BlueprintReview.DTOs;
using BlueprintReview.Models;
using BlueprintReview.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlueprintReview.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DocumentsController : ControllerBase
{
    private readonly IDocumentService _documentService;
    private readonly ILogger<DocumentsController> _logger;

    public DocumentsController(IDocumentService documentService, ILogger<DocumentsController> logger)
    {
        _documentService = documentService;
        _logger = logger;
    }

    private string CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
    private string CurrentUserName => User.FindFirstValue(ClaimTypes.Name) ?? string.Empty;

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<Document>>> Get(string id)
    {
        try
        {
            var document = await _documentService.GetByIdAsync(id);
            if (document == null)
            {
                return NotFound(ApiResponse<Document>.Error("图纸不存在", 404));
            }
            return Ok(ApiResponse<Document>.Success(document));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to get document {id}");
            return StatusCode(500, ApiResponse<Document>.Error("获取图纸失败"));
        }
    }

    [HttpPost]
    [Authorize(Roles = "ProjectManager,Designer")]
    public async Task<ActionResult<ApiResponse<Document>>> Upload(
        [FromForm] IFormFile? file,
        [FromForm] string projectId,
        [FromForm] string name,
        [FromForm] string? category = null,
        [FromForm] string? discipline = null)
    {
        try
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(ApiResponse<Document>.Error("请选择要上传的文件", 400));
            }

            var document = await _documentService.UploadDocumentAsync(
                projectId,
                name,
                category,
                discipline,
                file,
                CurrentUserId,
                CurrentUserName
            );

            return CreatedAtAction(nameof(Get), new { id = document.Id }, ApiResponse<Document>.Success(document, "图纸上传成功"));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<Document>.Error(ex.Message, 400));
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized(ApiResponse<Document>.Error("未授权", 401));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upload document");
            return StatusCode(500, ApiResponse<Document>.Error("上传失败"));
        }
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "ProjectManager")]
    public async Task<ActionResult<ApiResponse>> Delete(string id)
    {
        try
        {
            var result = await _documentService.DeleteAsync(id);
            if (!result)
            {
                return NotFound(ApiResponse.Error("图纸不存在", 404));
            }
            return Ok(ApiResponse.Success("图纸删除成功"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to delete document {id}");
            return StatusCode(500, ApiResponse.Error("删除失败"));
        }
    }

    [HttpGet("{documentId}/versions/{versionId}")]
    public async Task<ActionResult<ApiResponse<DocumentVersion>>> GetVersion(string documentId, string versionId)
    {
        try
        {
            var version = await _documentService.GetVersionAsync(documentId, versionId);
            if (version == null)
            {
                return NotFound(ApiResponse<DocumentVersion>.Error("版本不存在", 404));
            }
            return Ok(ApiResponse<DocumentVersion>.Success(version));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to get version {versionId}");
            return StatusCode(500, ApiResponse<DocumentVersion>.Error("获取版本失败"));
        }
    }

    [HttpPost("{documentId}/versions")]
    [Authorize(Roles = "ProjectManager,Designer")]
    public async Task<ActionResult<ApiResponse<DocumentVersion>>> UploadVersion(
        string documentId,
        [FromForm] IFormFile? file,
        [FromForm] string? description = null)
    {
        try
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(ApiResponse<DocumentVersion>.Error("请选择要上传的文件", 400));
            }

            var version = await _documentService.UploadVersionAsync(
                documentId,
                description,
                file,
                CurrentUserId,
                CurrentUserName
            );

            return Ok(ApiResponse<DocumentVersion>.Success(version, "版本上传成功"));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<DocumentVersion>.Error(ex.Message, 404));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<DocumentVersion>.Error(ex.Message, 400));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to upload version for document {documentId}");
            return StatusCode(500, ApiResponse<DocumentVersion>.Error("上传失败"));
        }
    }

    [HttpGet("{documentId}/versions/compare")]
    public async Task<ActionResult<ApiResponse<VersionDiffSummary>>> CompareVersions(
        string documentId,
        [FromQuery] string versionAId,
        [FromQuery] string versionBId)
    {
        try
        {
            var diff = await _documentService.CompareVersionsAsync(documentId, versionAId, versionBId);
            return Ok(ApiResponse<VersionDiffSummary>.Success(diff));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<VersionDiffSummary>.Error(ex.Message, 404));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to compare versions for document {documentId}");
            return StatusCode(500, ApiResponse<VersionDiffSummary>.Error("版本对比失败"));
        }
    }

    [HttpGet("{documentId}/download")]
    public async Task<IActionResult> Download(string documentId, [FromQuery] bool withWatermark = true)
    {
        try
        {
            var document = await _documentService.GetByIdAsync(documentId);
            if (document == null)
            {
                return NotFound();
            }

            if (!document.Permissions.CanDownload)
            {
                return Forbid();
            }

            var fileBytes = await _documentService.DownloadAsync(documentId, CurrentUserId, CurrentUserName, withWatermark);
            var fileName = $"{document.Name}.pdf";
            return File(fileBytes, "application/octet-stream", fileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to download document {documentId}");
            return StatusCode(500);
        }
    }

    [HttpPut("{documentId}/permissions")]
    [Authorize(Roles = "ProjectManager")]
    public async Task<ActionResult<ApiResponse<Document>>> SetPermissions(string documentId, [FromBody] PermissionMatrix permissions)
    {
        try
        {
            var document = await _documentService.SetPermissionsAsync(documentId, permissions);
            return Ok(ApiResponse<Document>.Success(document, "权限设置成功"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to set permissions for document {documentId}");
            return StatusCode(500, ApiResponse<Document>.Error("设置权限失败"));
        }
    }
}
