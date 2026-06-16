using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EvidenceManagementSystem.Controllers;

[ApiController]
[Route("api/inventory")]
[Produces("application/json")]
[Authorize]
public class InventoryController : BaseController
{
    private readonly IInventoryService _inventoryService;
    private readonly ILogger<InventoryController> _logger;

    public InventoryController(IInventoryService inventoryService, ILogger<InventoryController> logger)
    {
        _inventoryService = inventoryService;
        _logger = logger;
    }

    [HttpPost]
    [Authorize(Roles = "1")]
    public async Task<IActionResult> CreateTask([FromBody] CreateInventoryTaskRequest request)
    {
        var result = await _inventoryService.CreateTaskAsync(request, CurrentUserId, CurrentUsername);
        return Created(result, "盘点任务创建成功");
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _inventoryService.GetByIdAsync(id);
        if (result == null)
            return NotFound("盘点任务不存在");
        return Success(result);
    }

    [HttpGet("task-number/{taskNumber}")]
    public async Task<IActionResult> GetByTaskNumber(string taskNumber)
    {
        var result = await _inventoryService.GetByTaskNumberAsync(taskNumber);
        if (result == null)
            return NotFound("盘点任务不存在");
        return Success(result);
    }

    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] InventoryQuery query)
    {
        var result = await _inventoryService.SearchAsync(query);
        return Success(result);
    }

    [HttpPost("{taskId}/scan")]
    [Authorize(Roles = "1")]
    public async Task<IActionResult> ScanItem(Guid taskId, [FromBody] ScanInventoryItemRequest request)
    {
        var result = await _inventoryService.ScanItemAsync(taskId, request);
        return Success(result, "扫描成功");
    }

    [HttpGet("{taskId}/items")]
    public async Task<IActionResult> GetItems(Guid taskId)
    {
        var result = await _inventoryService.GetItemsByTaskIdAsync(taskId);
        return Success(result);
    }

    [HttpPost("{taskId}/complete")]
    [Authorize(Roles = "1")]
    public async Task<IActionResult> CompleteTask(Guid taskId, [FromBody] CompleteInventoryRequest request)
    {
        var result = await _inventoryService.CompleteTaskAsync(taskId, request);
        return Success(result, "盘点完成");
    }
}
