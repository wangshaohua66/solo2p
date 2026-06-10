using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PotteryStudio.Models;
using PotteryStudio.Services;
using System.Security.Claims;

namespace PotteryStudio.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GlazeRecipesController : ControllerBase
{
    private readonly IGlazeRecipeService _recipeService;

    public GlazeRecipesController(IGlazeRecipeService recipeService)
    {
        _recipeService = recipeService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<GlazeRecipe>>>> GetRecipes(
        [FromQuery] int pageIndex = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? keyword = null,
        [FromQuery] FiringType? firingType = null,
        [FromQuery] bool? isArchived = null)
    {
        var query = new PagedQuery { PageIndex = pageIndex, PageSize = pageSize, Keyword = keyword };
        var result = await _recipeService.GetRecipesAsync(query, firingType, isArchived);
        return Ok(ApiResponse<PagedResult<GlazeRecipe>>.Success(result));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<GlazeRecipe>>> GetRecipe(Guid id)
    {
        var recipe = await _recipeService.GetRecipeByIdAsync(id);
        if (recipe == null)
            return NotFound(ApiResponse.Fail("配方不存在", 404));

        return Ok(ApiResponse<GlazeRecipe>.Success(recipe));
    }

    [HttpGet("tree")]
    public async Task<ActionResult<ApiResponse<List<GlazeRecipe>>>> GetRecipeTree([FromQuery] Guid? rootId = null)
    {
        var tree = await _recipeService.GetRecipeTreeAsync(rootId);
        return Ok(ApiResponse<List<GlazeRecipe>>.Success(tree));
    }

    [HttpGet("{id}/versions")]
    public async Task<ActionResult<ApiResponse<List<GlazeRecipe>>>> GetVersions(Guid id)
    {
        var versions = await _recipeService.GetRecipeVersionsAsync(id);
        return Ok(ApiResponse<List<GlazeRecipe>>.Success(versions));
    }

    [HttpGet("{id}/lineage")]
    public async Task<ActionResult<ApiResponse<List<GlazeRecipe>>>> GetLineage(Guid id)
    {
        var lineage = await _recipeService.GetRecipeLineageAsync(id);
        return Ok(ApiResponse<List<GlazeRecipe>>.Success(lineage));
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Instructor")]
    public async Task<ActionResult<ApiResponse<GlazeRecipe>>> CreateRecipe([FromBody] GlazeRecipe recipe)
    {
        try
        {
            var userId = GetCurrentUserId();
            var userName = User.FindFirst(ClaimTypes.Name)?.Value ?? "unknown";
            
            var result = await _recipeService.CreateRecipeAsync(recipe, userId, userName);
            return CreatedAtAction(nameof(GetRecipe), new { id = result.Id }, ApiResponse<GlazeRecipe>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Instructor")]
    public async Task<ActionResult<ApiResponse<GlazeRecipe>>> UpdateRecipe(Guid id, [FromBody] GlazeRecipe recipe)
    {
        try
        {
            var result = await _recipeService.UpdateRecipeAsync(id, recipe);
            return Ok(ApiResponse<GlazeRecipe>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse.Fail(ex.Message, 404));
        }
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse>> DeleteRecipe(Guid id)
    {
        try
        {
            await _recipeService.DeleteRecipeAsync(id);
            return Ok(ApiResponse.Success("删除成功"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpPost("{id}/clone")]
    [Authorize(Roles = "Admin,Instructor")]
    public async Task<ActionResult<ApiResponse<GlazeRecipe>>> CloneRecipe(Guid id, [FromBody] CloneRecipeRequest request)
    {
        try
        {
            var userId = GetCurrentUserId() ?? Guid.Empty;
            var userName = User.FindFirst(ClaimTypes.Name)?.Value ?? "unknown";
            
            var result = await _recipeService.CloneRecipeAsync(id, request.NewName, userId, userName);
            return CreatedAtAction(nameof(GetRecipe), new { id = result.Id }, ApiResponse<GlazeRecipe>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpPost("{parentId}/versions")]
    [Authorize(Roles = "Admin,Instructor")]
    public async Task<ActionResult<ApiResponse<GlazeRecipe>>> CreateVersion(
        Guid parentId,
        [FromBody] GlazeRecipe recipe)
    {
        try
        {
            var userId = GetCurrentUserId() ?? Guid.Empty;
            var userName = User.FindFirst(ClaimTypes.Name)?.Value ?? "unknown";
            
            var result = await _recipeService.CreateVersionAsync(parentId, recipe, userId, userName);
            return CreatedAtAction(nameof(GetRecipe), new { id = result.Id }, ApiResponse<GlazeRecipe>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpPost("{id}/archive")]
    [Authorize(Roles = "Admin,Instructor")]
    public async Task<ActionResult<ApiResponse<GlazeRecipe>>> ArchiveRecipe(Guid id)
    {
        try
        {
            var result = await _recipeService.ArchiveRecipeAsync(id);
            return Ok(ApiResponse<GlazeRecipe>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse.Fail(ex.Message, 404));
        }
    }

    [HttpPost("{id}/unarchive")]
    [Authorize(Roles = "Admin,Instructor")]
    public async Task<ActionResult<ApiResponse<GlazeRecipe>>> UnarchiveRecipe(Guid id)
    {
        try
        {
            var result = await _recipeService.UnarchiveRecipeAsync(id);
            return Ok(ApiResponse<GlazeRecipe>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse.Fail(ex.Message, 404));
        }
    }

    [HttpPost("{id}/effect-image")]
    [Authorize(Roles = "Admin,Instructor")]
    public async Task<ActionResult<ApiResponse<GlazeRecipe>>> UploadEffectImage(
        Guid id,
        [FromForm] string imageUrl,
        [FromForm] string thumbnailUrl)
    {
        try
        {
            var result = await _recipeService.UploadEffectImageAsync(id, imageUrl, thumbnailUrl);
            return Ok(ApiResponse<GlazeRecipe>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse.Fail(ex.Message, 404));
        }
    }

    private Guid? GetCurrentUserId()
    {
        var idClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (idClaim == null || !Guid.TryParse(idClaim.Value, out var userId))
            return null;
        return userId;
    }
}

public class CloneRecipeRequest
{
    public string NewName { get; set; } = string.Empty;
}
