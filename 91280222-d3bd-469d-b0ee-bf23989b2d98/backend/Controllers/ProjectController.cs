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
public class ProjectsController : ControllerBase
{
    private readonly IProjectService _projectService;
    private readonly IDocumentService _documentService;
    private readonly IAuthService _authService;
    private readonly ILogger<ProjectsController> _logger;

    public ProjectsController(
        IProjectService projectService,
        IDocumentService documentService,
        IAuthService authService,
        ILogger<ProjectsController> logger)
    {
        _projectService = projectService;
        _documentService = documentService;
        _authService = authService;
        _logger = logger;
    }

    private string CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
    private string CurrentUserName => User.FindFirstValue(ClaimTypes.Name) ?? string.Empty;
    private string CurrentUserRole => User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<Project>>>> List(
        [FromQuery] string? status = null,
        [FromQuery] string? keyword = null)
    {
        try
        {
            var projects = await _projectService.ListAsync(status, keyword);
            return Ok(ApiResponse<List<Project>>.Success(projects));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to list projects");
            return StatusCode(500, ApiResponse<List<Project>>.Error("获取项目列表失败"));
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<Project>>> Get(string id)
    {
        try
        {
            var project = await _projectService.GetByIdAsync(id);
            if (project == null)
            {
                return NotFound(ApiResponse<Project>.Error("项目不存在", 404));
            }
            return Ok(ApiResponse<Project>.Success(project));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to get project {id}");
            return StatusCode(500, ApiResponse<Project>.Error("获取项目详情失败"));
        }
    }

    [HttpPost]
    [Authorize(Roles = "ProjectManager")]
    public async Task<ActionResult<ApiResponse<Project>>> Create([FromBody] CreateProjectRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(ApiResponse<Project>.Error("项目名称不能为空", 400));
            }

            var project = await _projectService.CreateAsync(request, CurrentUserId);
            return CreatedAtAction(nameof(Get), new { id = project.Id }, ApiResponse<Project>.Success(project, "项目创建成功"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create project");
            return StatusCode(500, ApiResponse<Project>.Error("创建项目失败"));
        }
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "ProjectManager")]
    public async Task<ActionResult<ApiResponse<Project>>> Update(string id, [FromBody] UpdateProjectRequest request)
    {
        try
        {
            var project = await _projectService.UpdateAsync(id, request);
            if (project == null)
            {
                return NotFound(ApiResponse<Project>.Error("项目不存在", 404));
            }
            return Ok(ApiResponse<Project>.Success(project, "项目更新成功"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to update project {id}");
            return StatusCode(500, ApiResponse<Project>.Error("更新项目失败"));
        }
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "ProjectManager")]
    public async Task<ActionResult<ApiResponse>> Delete(string id)
    {
        try
        {
            var result = await _projectService.DeleteAsync(id);
            if (!result)
            {
                return NotFound(ApiResponse.Error("项目不存在", 404));
            }
            return Ok(ApiResponse.Success("项目删除成功"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to delete project {id}");
            return StatusCode(500, ApiResponse.Error("删除项目失败"));
        }
    }

    [HttpPost("{projectId}/members")]
    [Authorize(Roles = "ProjectManager")]
    public async Task<ActionResult<ApiResponse>> AddMember(string projectId, [FromBody] AddMemberRequest request)
    {
        try
        {
            if (!Enum.TryParse<UserRole>(request.Role, true, out var role))
            {
                return BadRequest(ApiResponse.Error("无效的角色类型", 400));
            }

            var result = await _projectService.AddMemberAsync(projectId, request.UserId, role);
            if (!result)
            {
                return NotFound(ApiResponse.Error("项目或用户不存在", 404));
            }
            return Ok(ApiResponse.Success("成员添加成功"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to add member to project {projectId}");
            return StatusCode(500, ApiResponse.Error("添加成员失败"));
        }
    }

    [HttpDelete("{projectId}/members/{userId}")]
    [Authorize(Roles = "ProjectManager")]
    public async Task<ActionResult<ApiResponse>> RemoveMember(string projectId, string userId)
    {
        try
        {
            var result = await _projectService.RemoveMemberAsync(projectId, userId);
            if (!result)
            {
                return NotFound(ApiResponse.Error("项目不存在", 404));
            }
            return Ok(ApiResponse.Success("成员移除成功"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to remove member from project {projectId}");
            return StatusCode(500, ApiResponse.Error("移除成员失败"));
        }
    }

    [HttpGet("{projectId}/stats")]
    public async Task<ActionResult<ApiResponse<object>>> GetStats(string projectId)
    {
        try
        {
            var stats = await _projectService.GetStatsAsync(projectId);
            return Ok(ApiResponse<object>.Success(stats));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to get stats for project {projectId}");
            return StatusCode(500, ApiResponse<object>.Error("获取统计信息失败"));
        }
    }

    [HttpGet("{projectId}/report")]
    public async Task<IActionResult> ExportReport(
        string projectId,
        [FromQuery] string? discipline = null,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        try
        {
            var reportBytes = await _projectService.ExportReportAsync(projectId, discipline, startDate, endDate);
            return File(reportBytes, "text/csv", $"审阅报告_{DateTime.Now:yyyyMMdd}.csv");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to export report for project {projectId}");
            return StatusCode(500);
        }
    }

    [HttpGet("{projectId}/documents")]
    public async Task<ActionResult<ApiResponse<List<Document>>>> ListDocuments(
        string projectId,
        [FromQuery] string? category = null,
        [FromQuery] string? discipline = null)
    {
        try
        {
            var documents = await _documentService.ListByProjectAsync(projectId, category, discipline);
            return Ok(ApiResponse<List<Document>>.Success(documents));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to list documents for project {projectId}");
            return StatusCode(500, ApiResponse<List<Document>>.Error("获取图纸列表失败"));
        }
    }
}
