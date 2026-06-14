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
public class WorkflowsController : ControllerBase
{
    private readonly IReviewWorkflowService _workflowService;
    private readonly ILogger<WorkflowsController> _logger;

    public WorkflowsController(IReviewWorkflowService workflowService, ILogger<WorkflowsController> logger)
    {
        _workflowService = workflowService;
        _logger = logger;
    }

    private string CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
    private string CurrentUserName => User.FindFirstValue(ClaimTypes.Name) ?? string.Empty;

    [HttpGet("~/api/review-templates")]
    public async Task<ActionResult<ApiResponse<List<ReviewWorkflowTemplate>>>> ListTemplates()
    {
        try
        {
            var templates = await _workflowService.GetTemplatesAsync();
            return Ok(ApiResponse<List<ReviewWorkflowTemplate>>.Success(templates));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to list review templates");
            return StatusCode(500, ApiResponse<List<ReviewWorkflowTemplate>>.Error("获取模板列表失败"));
        }
    }

    [HttpPost("~/api/review-templates")]
    [Authorize(Roles = "ProjectManager")]
    public async Task<ActionResult<ApiResponse<ReviewWorkflowTemplate>>> CreateTemplate(
        [FromBody] CreateWorkflowTemplateRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(ApiResponse<ReviewWorkflowTemplate>.Error("模板名称不能为空", 400));
            }

            if (request.Stages.Count == 0)
            {
                return BadRequest(ApiResponse<ReviewWorkflowTemplate>.Error("至少需要一个审批阶段", 400));
            }

            var template = await _workflowService.CreateTemplateAsync(request, CurrentUserId);
            return Ok(ApiResponse<ReviewWorkflowTemplate>.Success(template, "模板创建成功"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create review template");
            return StatusCode(500, ApiResponse<ReviewWorkflowTemplate>.Error("创建模板失败"));
        }
    }

    [HttpDelete("~/api/review-templates/{id}")]
    [Authorize(Roles = "ProjectManager")]
    public async Task<ActionResult<ApiResponse>> DeleteTemplate(string id)
    {
        try
        {
            var result = await _workflowService.DeleteTemplateAsync(id);
            if (!result)
            {
                return NotFound(ApiResponse.Error("模板不存在", 404));
            }
            return Ok(ApiResponse.Success("模板删除成功"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to delete review template {id}");
            return StatusCode(500, ApiResponse.Error("删除模板失败"));
        }
    }

    [HttpGet("~/api/documents/{documentId}/workflows")]
    public async Task<ActionResult<ApiResponse<List<ReviewWorkflow>>>> ListByDocument(string documentId)
    {
        try
        {
            var workflows = await _workflowService.GetByDocumentAsync(documentId);
            return Ok(ApiResponse<List<ReviewWorkflow>>.Success(workflows));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to list workflows for document {documentId}");
            return StatusCode(500, ApiResponse<List<ReviewWorkflow>>.Error("获取审批流列表失败"));
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<ReviewWorkflow>>> Get(string id)
    {
        try
        {
            var workflow = await _workflowService.GetByIdAsync(id);
            if (workflow == null)
            {
                return NotFound(ApiResponse<ReviewWorkflow>.Error("审批流不存在", 404));
            }
            return Ok(ApiResponse<ReviewWorkflow>.Success(workflow));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to get workflow {id}");
            return StatusCode(500, ApiResponse<ReviewWorkflow>.Error("获取审批流失败"));
        }
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<ReviewWorkflow>>> Start([FromBody] CreateWorkflowRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.DocumentId))
            {
                return BadRequest(ApiResponse<ReviewWorkflow>.Error("图纸ID不能为空", 400));
            }

            if (string.IsNullOrWhiteSpace(request.TemplateId))
            {
                return BadRequest(ApiResponse<ReviewWorkflow>.Error("审批模板不能为空", 400));
            }

            var workflow = await _workflowService.StartWorkflowAsync(request, CurrentUserId, CurrentUserName);
            return CreatedAtAction(nameof(Get), new { id = workflow.Id }, ApiResponse<ReviewWorkflow>.Success(workflow, "审批流已启动"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<ReviewWorkflow>.Error(ex.Message, 400));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start workflow");
            return StatusCode(500, ApiResponse<ReviewWorkflow>.Error("启动审批流失败"));
        }
    }

    [HttpPost("{workflowId}/action")]
    public async Task<ActionResult<ApiResponse<ReviewWorkflow>>> TakeAction(string workflowId, [FromBody] ReviewerActionRequest request)
    {
        try
        {
            var workflow = await _workflowService.TakeActionAsync(workflowId, request, CurrentUserId, CurrentUserName);
            if (workflow == null)
            {
                return NotFound(ApiResponse<ReviewWorkflow>.Error("审批流不存在", 404));
            }
            return Ok(ApiResponse<ReviewWorkflow>.Success(workflow, "操作成功"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<ReviewWorkflow>.Error(ex.Message, 400));
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized(ApiResponse<ReviewWorkflow>.Error("您没有权限执行此操作", 401));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to take action on workflow {workflowId}");
            return StatusCode(500, ApiResponse<ReviewWorkflow>.Error("操作失败"));
        }
    }

    [HttpPost("{workflowId}/escalate")]
    public async Task<ActionResult<ApiResponse<ReviewWorkflow>>> Escalate(string workflowId, [FromBody] EscalateRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.ToUserId))
            {
                return BadRequest(ApiResponse<ReviewWorkflow>.Error("请选择要转交的用户", 400));
            }

            if (string.IsNullOrWhiteSpace(request.Reason))
            {
                return BadRequest(ApiResponse<ReviewWorkflow>.Error("请填写转交原因", 400));
            }

            var workflow = await _workflowService.EscalateAsync(workflowId, request, CurrentUserId, CurrentUserName);
            if (workflow == null)
            {
                return NotFound(ApiResponse<ReviewWorkflow>.Error("审批流不存在", 404));
            }
            return Ok(ApiResponse<ReviewWorkflow>.Success(workflow, "已转交审批"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<ReviewWorkflow>.Error(ex.Message, 400));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to escalate workflow {workflowId}");
            return StatusCode(500, ApiResponse<ReviewWorkflow>.Error("转交失败"));
        }
    }

    [HttpPost("{id}/cancel")]
    [Authorize(Roles = "ProjectManager")]
    public async Task<ActionResult<ApiResponse>> Cancel(string id)
    {
        try
        {
            var result = await _workflowService.CancelWorkflowAsync(id);
            if (!result)
            {
                return NotFound(ApiResponse.Error("审批流不存在", 404));
            }
            return Ok(ApiResponse.Success("审批流已取消"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to cancel workflow {id}");
            return StatusCode(500, ApiResponse.Error("取消失败"));
        }
    }
}
