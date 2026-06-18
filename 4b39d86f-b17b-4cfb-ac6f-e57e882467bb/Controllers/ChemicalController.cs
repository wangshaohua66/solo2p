using AutoMapper;
using HazChemSupervision.DTOs;
using HazChemSupervision.Models;
using HazChemSupervision.Repositories;
using HazChemSupervision.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Swashbuckle.AspNetCore.Annotations;

namespace HazChemSupervision.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "EnterpriseUser")]
[SwaggerTag("危化品管理 - 危化品信息、批次生命周期管理")]
public class ChemicalController : ControllerBase
{
    private readonly IChemicalBatchService _batchService;
    private readonly IBaseRepository<Chemical> _chemicalRepo;
    private readonly IBaseRepository<Enterprise> _enterpriseRepo;
    private readonly IMapper _mapper;

    public ChemicalController(
        IChemicalBatchService batchService,
        IBaseRepository<Chemical> chemicalRepo,
        IBaseRepository<Enterprise> enterpriseRepo,
        IMapper mapper)
    {
        _batchService = batchService;
        _chemicalRepo = chemicalRepo;
        _enterpriseRepo = enterpriseRepo;
        _mapper = mapper;
    }

    [HttpGet("chemicals")]
    [SwaggerOperation(Summary = "获取危化品列表", Description = "分页查询危化品信息，支持按类别、名称等筛选")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<PagedResult<ChemicalDto>>))]
    public async Task<ActionResult<ApiResponse<PagedResult<ChemicalDto>>>> GetChemicals([FromQuery] ChemicalQueryDto dto)
    {
        var predicate = PredicateBuilder.True<Chemical>();

        if (!string.IsNullOrEmpty(dto.Code))
            predicate = predicate.And(c => c.Code.Contains(dto.Code));
        if (!string.IsNullOrEmpty(dto.Name))
            predicate = predicate.And(c => c.Name.Contains(dto.Name));
        if (dto.Category.HasValue)
            predicate = predicate.And(c => c.Category == (ChemicalCategory)dto.Category.Value);
        if (dto.HazardClass.HasValue)
            predicate = predicate.And(c => c.HazardClass == (HazardClass)dto.HazardClass.Value);
        if (dto.EnterpriseId.HasValue)
            predicate = predicate.And(c => c.EnterpriseId == dto.EnterpriseId.Value);

        var result = await _chemicalRepo.GetPagedAsync(
            predicate,
            q => q.OrderByDescending(c => c.CreatedAt),
            dto.PageIndex,
            dto.PageSize);

        var items = await _chemicalRepo.GetQueryable()
            .Include(c => c.Enterprise)
            .Where(predicate)
            .OrderByDescending(c => c.CreatedAt)
            .Skip((dto.PageIndex - 1) * dto.PageSize)
            .Take(dto.PageSize)
            .ToListAsync();

        return Ok(new ApiResponse<PagedResult<ChemicalDto>>
        {
            Data = new PagedResult<ChemicalDto>
            {
                Items = _mapper.Map<List<ChemicalDto>>(items),
                TotalCount = result.TotalCount,
                PageIndex = dto.PageIndex,
                PageSize = dto.PageSize
            }
        });
    }

    [HttpGet("chemicals/{id}")]
    [SwaggerOperation(Summary = "获取危化品详情", Description = "根据ID获取危化品详细信息")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<ChemicalDto>))]
    [SwaggerResponse(404, "危化品不存在")]
    public async Task<ActionResult<ApiResponse<ChemicalDto>>> GetChemical(int id)
    {
        var chemical = await _chemicalRepo.GetQueryable()
            .Include(c => c.Enterprise)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (chemical == null)
            return NotFound(new ApiResponse<ChemicalDto> { Code = 404, Message = "危化品不存在" });

        return Ok(new ApiResponse<ChemicalDto> { Data = _mapper.Map<ChemicalDto>(chemical) });
    }

    [HttpPost("chemicals")]
    [Authorize(Policy = "Supervisor")]
    [SwaggerOperation(Summary = "新增危化品", Description = "创建新的危化品信息")]
    [SwaggerResponse(200, "创建成功", typeof(ApiResponse<ChemicalDto>))]
    public async Task<ActionResult<ApiResponse<ChemicalDto>>> CreateChemical([FromBody] ChemicalCreateDto dto)
    {
        var exists = await _chemicalRepo.ExistsAsync(c => c.Name == dto.Name && c.EnterpriseId == dto.EnterpriseId);
        if (exists)
            return BadRequest(new ApiResponse<ChemicalDto> { Code = 400, Message = "该企业下已存在此危化品" });

        var chemical = _mapper.Map<Chemical>(dto);
        chemical.CreatedAt = DateTime.UtcNow;
        chemical.UpdatedAt = DateTime.UtcNow;

        var result = await _chemicalRepo.AddAsync(chemical);
        return Ok(new ApiResponse<ChemicalDto> { Data = _mapper.Map<ChemicalDto>(result) });
    }

    [HttpPut("chemicals/{id}")]
    [Authorize(Policy = "Supervisor")]
    [SwaggerOperation(Summary = "更新危化品", Description = "更新危化品信息")]
    [SwaggerResponse(200, "更新成功", typeof(ApiResponse<ChemicalDto>))]
    [SwaggerResponse(404, "危化品不存在")]
    public async Task<ActionResult<ApiResponse<ChemicalDto>>> UpdateChemical(int id, [FromBody] ChemicalUpdateDto dto)
    {
        var chemical = await _chemicalRepo.GetByIdAsync(id);
        if (chemical == null)
            return NotFound(new ApiResponse<ChemicalDto> { Code = 404, Message = "危化品不存在" });

        _mapper.Map(dto, chemical);
        chemical.UpdatedAt = DateTime.UtcNow;

        await _chemicalRepo.UpdateAsync(chemical);
        return Ok(new ApiResponse<ChemicalDto> { Data = _mapper.Map<ChemicalDto>(chemical) });
    }

    [HttpGet("batches")]
    [SwaggerOperation(Summary = "获取批次列表", Description = "分页查询批次信息，支持按状态、企业、危化品等筛选")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<PagedResult<ChemicalBatchDto>>))]
    public async Task<ActionResult<ApiResponse<PagedResult<ChemicalBatchDto>>>> GetBatches([FromQuery] ChemicalBatchQueryDto dto)
    {
        var result = await _batchService.GetBatchesAsync(dto);
        return Ok(new ApiResponse<PagedResult<ChemicalBatchDto>> { Data = result });
    }

    [HttpGet("batches/{id}")]
    [SwaggerOperation(Summary = "获取批次详情", Description = "根据ID获取批次详细信息")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<ChemicalBatchDto>))]
    [SwaggerResponse(404, "批次不存在")]
    public async Task<ActionResult<ApiResponse<ChemicalBatchDto>>> GetBatch(int id)
    {
        var batch = await _batchService.GetBatchByIdAsync(id);
        if (batch == null)
            return NotFound(new ApiResponse<ChemicalBatchDto> { Code = 404, Message = "批次不存在" });

        return Ok(new ApiResponse<ChemicalBatchDto> { Data = batch });
    }

    [HttpPost("batches")]
    [SwaggerOperation(Summary = "创建批次", Description = "创建新的批次记录")]
    [SwaggerResponse(200, "创建成功", typeof(ApiResponse<ChemicalBatchDto>))]
    public async Task<ActionResult<ApiResponse<ChemicalBatchDto>>> CreateBatch([FromBody] ChemicalBatchCreateDto dto)
    {
        try
        {
            var result = await _batchService.CreateBatchAsync(dto);
            return Ok(new ApiResponse<ChemicalBatchDto> { Data = result });
        }
        catch (Exception ex)
        {
            return BadRequest(new ApiResponse<ChemicalBatchDto> { Code = 400, Message = ex.Message });
        }
    }

    [HttpPost("batches/{id}/raw-material-inbound")]
    [SwaggerOperation(Summary = "原料入库", Description = "批次第一阶段：原料入库登记，校验操作人员资质")]
    [SwaggerResponse(200, "操作成功", typeof(ApiResponse<ChemicalBatchDto>))]
    public async Task<ActionResult<ApiResponse<ChemicalBatchDto>>> RawMaterialInbound(int id, [FromBody] RawMaterialInboundDto dto)
    {
        try
        {
            var result = await _batchService.RawMaterialInboundAsync(id, dto);
            return Ok(new ApiResponse<ChemicalBatchDto> { Data = result });
        }
        catch (Exception ex)
        {
            return BadRequest(new ApiResponse<ChemicalBatchDto> { Code = 400, Message = ex.Message });
        }
    }

    [HttpPost("batches/{id}/start-production")]
    [SwaggerOperation(Summary = "生产加工", Description = "批次第二阶段：生产投料记录，校验操作人员资质")]
    [SwaggerResponse(200, "操作成功", typeof(ApiResponse<ChemicalBatchDto>))]
    public async Task<ActionResult<ApiResponse<ChemicalBatchDto>>> StartProduction(int id, [FromBody] ProductionProcessingDto dto)
    {
        try
        {
            var result = await _batchService.StartProductionAsync(id, dto);
            return Ok(new ApiResponse<ChemicalBatchDto> { Data = result });
        }
        catch (Exception ex)
        {
            return BadRequest(new ApiResponse<ChemicalBatchDto> { Code = 400, Message = ex.Message });
        }
    }

    [HttpPost("batches/{id}/submit-inspection")]
    [SwaggerOperation(Summary = "成品检验", Description = "批次第三阶段：成品检验报告上传，校验检验人员资质")]
    [SwaggerResponse(200, "操作成功", typeof(ApiResponse<ChemicalBatchDto>))]
    public async Task<ActionResult<ApiResponse<ChemicalBatchDto>>> SubmitInspection(int id, [FromBody] FinishedInspectionDto dto)
    {
        try
        {
            var result = await _batchService.SubmitInspectionAsync(id, dto);
            return Ok(new ApiResponse<ChemicalBatchDto> { Data = result });
        }
        catch (Exception ex)
        {
            return BadRequest(new ApiResponse<ChemicalBatchDto> { Code = 400, Message = ex.Message });
        }
    }

    [HttpPost("batches/{id}/outbound-review")]
    [SwaggerOperation(Summary = "出库复核", Description = "批次第四阶段：出库复核，校验复核人员资质")]
    [SwaggerResponse(200, "操作成功", typeof(ApiResponse<ChemicalBatchDto>))]
    public async Task<ActionResult<ApiResponse<ChemicalBatchDto>>> OutboundReview(int id, [FromBody] OutboundReviewDto dto)
    {
        try
        {
            var result = await _batchService.OutboundReviewAsync(id, dto);
            return Ok(new ApiResponse<ChemicalBatchDto> { Data = result });
        }
        catch (Exception ex)
        {
            return BadRequest(new ApiResponse<ChemicalBatchDto> { Code = 400, Message = ex.Message });
        }
    }

    [HttpGet("batches/{id}/lifecycle")]
    [SwaggerOperation(Summary = "获取批次生命周期", Description = "查看批次全生命周期流转记录")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<BatchLifeCycleDto>))]
    public async Task<ActionResult<ApiResponse<BatchLifeCycleDto>>> GetBatchLifeCycle(int id)
    {
        try
        {
            var result = await _batchService.GetBatchLifeCycleAsync(id);
            return Ok(new ApiResponse<BatchLifeCycleDto> { Data = result });
        }
        catch (Exception ex)
        {
            return NotFound(new ApiResponse<BatchLifeCycleDto> { Code = 404, Message = ex.Message });
        }
    }

    [HttpGet("batches/{id}/process-records")]
    [SwaggerOperation(Summary = "获取批次过程记录", Description = "查看批次各阶段的过程处理记录")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<List<ProcessRecordDto>>))]
    public async Task<ActionResult<ApiResponse<List<ProcessRecordDto>>>> GetBatchProcessRecords(int id)
    {
        var result = await _batchService.GetBatchProcessRecordsAsync(id);
        return Ok(new ApiResponse<List<ProcessRecordDto>> { Data = result });
    }
}
