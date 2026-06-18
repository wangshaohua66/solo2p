using HazChemSupervision.DTOs;
using HazChemSupervision.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace HazChemSupervision.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "EnterpriseUser")]
[SwaggerTag("库存管理 - 库存监控、流水记录、仓库管理")]
public class InventoryController : ControllerBase
{
    private readonly IInventoryService _inventoryService;

    public InventoryController(IInventoryService inventoryService)
    {
        _inventoryService = inventoryService;
    }

    [HttpGet]
    [SwaggerOperation(Summary = "获取库存列表", Description = "分页查询库存信息，支持按企业、仓库、危化品类别等筛选")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<PagedResult<InventoryDto>>))]
    public async Task<ActionResult<ApiResponse<PagedResult<InventoryDto>>>> GetInventories([FromQuery] InventoryQueryDto dto)
    {
        var result = await _inventoryService.GetInventoriesAsync(dto);
        return Ok(new ApiResponse<PagedResult<InventoryDto>> { Data = result });
    }

    [HttpGet("{id}")]
    [SwaggerOperation(Summary = "获取库存详情", Description = "根据ID获取库存详细信息")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<InventoryDto>))]
    [SwaggerResponse(404, "库存记录不存在")]
    public async Task<ActionResult<ApiResponse<InventoryDto>>> GetInventory(int id)
    {
        var inventory = await _inventoryService.GetInventoryByIdAsync(id);
        if (inventory == null)
            return NotFound(new ApiResponse<InventoryDto> { Code = 404, Message = "库存记录不存在" });

        return Ok(new ApiResponse<InventoryDto> { Data = inventory });
    }

    [HttpPost]
    [SwaggerOperation(Summary = "新增库存记录", Description = "创建新的库存记录")]
    [SwaggerResponse(200, "创建成功", typeof(ApiResponse<InventoryDto>))]
    public async Task<ActionResult<ApiResponse<InventoryDto>>> CreateInventory([FromBody] InventoryCreateDto dto)
    {
        try
        {
            var result = await _inventoryService.CreateInventoryAsync(dto);
            return Ok(new ApiResponse<InventoryDto> { Data = result });
        }
        catch (Exception ex)
        {
            return BadRequest(new ApiResponse<InventoryDto> { Code = 400, Message = ex.Message });
        }
    }

    [HttpPut("{id}")]
    [SwaggerOperation(Summary = "更新库存", Description = "更新库存数量、预警阈值等信息")]
    [SwaggerResponse(200, "更新成功", typeof(ApiResponse<InventoryDto>))]
    [SwaggerResponse(404, "库存记录不存在")]
    public async Task<ActionResult<ApiResponse<InventoryDto>>> UpdateInventory(int id, [FromBody] InventoryUpdateDto dto)
    {
        try
        {
            var result = await _inventoryService.UpdateInventoryAsync(id, dto);
            return Ok(new ApiResponse<InventoryDto> { Data = result });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new ApiResponse<InventoryDto> { Code = 404, Message = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = "Supervisor")]
    [SwaggerOperation(Summary = "删除库存记录", Description = "删除指定的库存记录")]
    [SwaggerResponse(200, "删除成功", typeof(ApiResponse<bool>))]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteInventory(int id)
    {
        var result = await _inventoryService.DeleteInventoryAsync(id);
        return Ok(new ApiResponse<bool> { Data = result });
    }

    [HttpGet("statistics")]
    [SwaggerOperation(Summary = "库存统计", Description = "按企业、仓库、危化品类别三级维度统计实时库存量")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<List<InventoryStatisticsDto>>))]
    public async Task<ActionResult<ApiResponse<List<InventoryStatisticsDto>>>> GetStatistics(
        [FromQuery] int? enterpriseId = null,
        [FromQuery] int? warehouseId = null,
        [FromQuery] int? category = null)
    {
        var result = await _inventoryService.GetStatisticsAsync(enterpriseId, warehouseId, category);
        return Ok(new ApiResponse<List<InventoryStatisticsDto>> { Data = result });
    }

    [HttpGet("transactions")]
    [SwaggerOperation(Summary = "获取库存流水", Description = "分页查询库存变动流水记录")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<PagedResult<InventoryTransactionDto>>))]
    public async Task<ActionResult<ApiResponse<PagedResult<InventoryTransactionDto>>>> GetTransactions([FromQuery] InventoryTransactionQueryDto dto)
    {
        var result = await _inventoryService.GetTransactionsAsync(dto);
        return Ok(new ApiResponse<PagedResult<InventoryTransactionDto>> { Data = result });
    }

    [HttpPost("transactions")]
    [SwaggerOperation(Summary = "创建库存流水", Description = "记录库存变动（入库、出库、调拨等）")]
    [SwaggerResponse(200, "创建成功", typeof(ApiResponse<InventoryTransactionDto>))]
    public async Task<ActionResult<ApiResponse<InventoryTransactionDto>>> CreateTransaction([FromBody] InventoryTransactionCreateDto dto)
    {
        try
        {
            var result = await _inventoryService.CreateTransactionAsync(dto);
            return Ok(new ApiResponse<InventoryTransactionDto> { Data = result });
        }
        catch (Exception ex)
        {
            return BadRequest(new ApiResponse<InventoryTransactionDto> { Code = 400, Message = ex.Message });
        }
    }

    [HttpGet("warehouses")]
    [SwaggerOperation(Summary = "获取仓库列表", Description = "获取仓库信息列表")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<PagedResult<WarehouseDto>>))]
    public async Task<ActionResult<ApiResponse<PagedResult<WarehouseDto>>>> GetWarehouses(
        [FromQuery] int? enterpriseId = null,
        [FromQuery] int pageIndex = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await _inventoryService.GetWarehousesAsync(enterpriseId, pageIndex, pageSize);
        return Ok(new ApiResponse<PagedResult<WarehouseDto>> { Data = result });
    }

    [HttpGet("warehouses/{id}")]
    [SwaggerOperation(Summary = "获取仓库详情", Description = "根据ID获取仓库详细信息")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<WarehouseDto>))]
    [SwaggerResponse(404, "仓库不存在")]
    public async Task<ActionResult<ApiResponse<WarehouseDto>>> GetWarehouse(int id)
    {
        var warehouse = await _inventoryService.GetWarehouseByIdAsync(id);
        if (warehouse == null)
            return NotFound(new ApiResponse<WarehouseDto> { Code = 404, Message = "仓库不存在" });

        return Ok(new ApiResponse<WarehouseDto> { Data = warehouse });
    }

    [HttpPost("warehouses")]
    [Authorize(Policy = "Supervisor")]
    [SwaggerOperation(Summary = "新增仓库", Description = "创建新的仓库信息")]
    [SwaggerResponse(200, "创建成功", typeof(ApiResponse<WarehouseDto>))]
    public async Task<ActionResult<ApiResponse<WarehouseDto>>> CreateWarehouse([FromBody] WarehouseCreateDto dto)
    {
        try
        {
            var result = await _inventoryService.CreateWarehouseAsync(dto);
            return Ok(new ApiResponse<WarehouseDto> { Data = result });
        }
        catch (Exception ex)
        {
            return BadRequest(new ApiResponse<WarehouseDto> { Code = 400, Message = ex.Message });
        }
    }

    [HttpPut("warehouses/{id}")]
    [Authorize(Policy = "Supervisor")]
    [SwaggerOperation(Summary = "更新仓库", Description = "更新仓库信息")]
    [SwaggerResponse(200, "更新成功", typeof(ApiResponse<WarehouseDto>))]
    [SwaggerResponse(404, "仓库不存在")]
    public async Task<ActionResult<ApiResponse<WarehouseDto>>> UpdateWarehouse(int id, [FromBody] WarehouseUpdateDto dto)
    {
        try
        {
            var result = await _inventoryService.UpdateWarehouseAsync(id, dto);
            return Ok(new ApiResponse<WarehouseDto> { Data = result });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new ApiResponse<WarehouseDto> { Code = 404, Message = ex.Message });
        }
    }
}
