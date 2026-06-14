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
public class AnnotationsController : ControllerBase
{
    private readonly IAnnotationService _annotationService;
    private readonly IWebSocketService _wsService;
    private readonly ILogger<AnnotationsController> _logger;

    public AnnotationsController(
        IAnnotationService annotationService,
        IWebSocketService wsService,
        ILogger<AnnotationsController> logger)
    {
        _annotationService = annotationService;
        _wsService = wsService;
        _logger = logger;
    }

    private string CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
    private string CurrentUserName => User.FindFirstValue(ClaimTypes.Name) ?? string.Empty;

    [HttpGet("~/api/documents/{documentId}/annotations")]
    public async Task<ActionResult<ApiResponse<List<Annotation>>>> List(
        string documentId,
        [FromQuery] string? versionId = null,
        [FromQuery] AnnotationStatus? status = null,
        [FromQuery] int? pageNumber = null)
    {
        try
        {
            var annotations = await _annotationService.GetByDocumentAsync(documentId, versionId, status, pageNumber);
            return Ok(ApiResponse<List<Annotation>>.Success(annotations));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to list annotations for document {documentId}");
            return StatusCode(500, ApiResponse<List<Annotation>>.Error("获取批注列表失败"));
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<Annotation>>> Get(string id)
    {
        try
        {
            var annotation = await _annotationService.GetByIdAsync(id);
            if (annotation == null)
            {
                return NotFound(ApiResponse<Annotation>.Error("批注不存在", 404));
            }
            return Ok(ApiResponse<Annotation>.Success(annotation));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to get annotation {id}");
            return StatusCode(500, ApiResponse<Annotation>.Error("获取批注失败"));
        }
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<Annotation>>> Create([FromBody] CreateAnnotationRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Content))
            {
                return BadRequest(ApiResponse<Annotation>.Error("批注内容不能为空", 400));
            }

            var annotation = await _annotationService.CreateAsync(request, CurrentUserId, CurrentUserName);

            await _wsService.BroadcastToDocumentAsync(
                request.DocumentId,
                "annotation.created",
                annotation,
                CurrentUserId,
                CurrentUserName
            );

            return CreatedAtAction(nameof(Get), new { id = annotation.Id }, ApiResponse<Annotation>.Success(annotation, "批注创建成功"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create annotation");
            return StatusCode(500, ApiResponse<Annotation>.Error("创建批注失败"));
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<Annotation>>> Update(string id, [FromBody] UpdateAnnotationRequest request)
    {
        try
        {
            var annotation = await _annotationService.UpdateAsync(id, request);
            if (annotation == null)
            {
                return NotFound(ApiResponse<Annotation>.Error("批注不存在", 404));
            }

            await _wsService.BroadcastToDocumentAsync(
                annotation.DocumentId,
                "annotation.updated",
                annotation,
                CurrentUserId,
                CurrentUserName
            );

            return Ok(ApiResponse<Annotation>.Success(annotation, "批注更新成功"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to update annotation {id}");
            return StatusCode(500, ApiResponse<Annotation>.Error("更新批注失败"));
        }
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse>> Delete(string id)
    {
        try
        {
            var annotation = await _annotationService.GetByIdAsync(id);
            var result = await _annotationService.DeleteAsync(id);

            if (!result)
            {
                return NotFound(ApiResponse.Error("批注不存在", 404));
            }

            if (annotation != null)
            {
                await _wsService.BroadcastToDocumentAsync(
                    annotation.DocumentId,
                    "annotation.deleted",
                    new { id },
                    CurrentUserId,
                    CurrentUserName
                );
            }

            return Ok(ApiResponse.Success("批注删除成功"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to delete annotation {id}");
            return StatusCode(500, ApiResponse.Error("删除批注失败"));
        }
    }

    [HttpPost("{annotationId}/replies")]
    public async Task<ActionResult<ApiResponse<AnnotationReply>>> AddReply(string annotationId, [FromBody] AddReplyRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Content))
            {
                return BadRequest(ApiResponse<AnnotationReply>.Error("回复内容不能为空", 400));
            }

            var reply = await _annotationService.AddReplyAsync(annotationId, request, CurrentUserId, CurrentUserName);
            var annotation = await _annotationService.GetByIdAsync(annotationId);

            if (annotation != null)
            {
                await _wsService.BroadcastToDocumentAsync(
                    annotation.DocumentId,
                    "annotation.reply",
                    new { annotationId, reply },
                    CurrentUserId,
                    CurrentUserName
                );
            }

            return Ok(ApiResponse<AnnotationReply>.Success(reply, "回复成功"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to add reply to annotation {annotationId}");
            return StatusCode(500, ApiResponse<AnnotationReply>.Error("回复失败"));
        }
    }

    [HttpDelete("{annotationId}/replies/{replyId}")]
    public async Task<ActionResult<ApiResponse>> DeleteReply(string annotationId, string replyId)
    {
        try
        {
            var result = await _annotationService.DeleteReplyAsync(annotationId, replyId);
            if (!result)
            {
                return NotFound(ApiResponse.Error("回复不存在", 404));
            }
            return Ok(ApiResponse.Success("回复删除成功"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to delete reply {replyId}");
            return StatusCode(500, ApiResponse.Error("删除回复失败"));
        }
    }

    [HttpPost("migrate")]
    public async Task<ActionResult<ApiResponse<List<Annotation>>>> Migrate([FromBody] MigrateAnnotationsRequest request)
    {
        try
        {
            if (request.AnnotationIds.Count == 0)
            {
                return BadRequest(ApiResponse<List<Annotation>>.Error("请选择要迁移的批注", 400));
            }

            var migrated = await _annotationService.MigrateAsync(request.AnnotationIds, request.TargetVersionId, CurrentUserId, CurrentUserName);
            return Ok(ApiResponse<List<Annotation>>.Success(migrated, $"已成功迁移 {migrated.Count} 条批注"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to migrate annotations");
            return StatusCode(500, ApiResponse<List<Annotation>>.Error("迁移批注失败"));
        }
    }

    [HttpPost("detect-conflict")]
    public async Task<ActionResult<ApiResponse<List<AnnotationConflict>>>> DetectConflict([FromBody] DetectConflictRequest request)
    {
        try
        {
            var conflicts = await _annotationService.DetectConflictAsync(request, CurrentUserId);

            if (conflicts.Count > 0)
            {
                await _wsService.BroadcastToDocumentAsync(
                    request.DocumentId,
                    "annotation.conflict",
                    new { request.VersionId, conflicts },
                    CurrentUserId,
                    CurrentUserName
                );
            }

            return Ok(ApiResponse<List<AnnotationConflict>>.Success(conflicts));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to detect annotation conflict");
            return StatusCode(500, ApiResponse<List<AnnotationConflict>>.Error("冲突检测失败"));
        }
    }

    [HttpPost("{annotationId}/resolve-conflict")]
    public async Task<ActionResult<ApiResponse>> ResolveConflict(string annotationId, [FromBody] ResolveConflictRequest request)
    {
        try
        {
            await _annotationService.ResolveConflictAsync(annotationId, request.Action);
            return Ok(ApiResponse.Success("冲突已解决"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to resolve conflict for annotation {annotationId}");
            return StatusCode(500, ApiResponse.Error("解决冲突失败"));
        }
    }
}
