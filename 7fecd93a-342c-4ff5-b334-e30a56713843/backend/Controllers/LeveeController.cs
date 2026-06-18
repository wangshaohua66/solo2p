using WaterManagement.API.Data;
using WaterManagement.API.DTOs;
using WaterManagement.API.Models;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;
using MongoDB.Driver;

namespace WaterManagement.API.Controllers;

[ApiController]
[Route("api/levee")]
[Produces("application/json")]
[SwaggerTag("堤防管理")]
public class LeveeController : ControllerBase
{
    private readonly IMongoDbContext _db;

    public LeveeController(IMongoDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    [SwaggerOperation(Summary = "获取堤防列表", Description = "支持按状态、关键词筛选，分页")]
    [ProducesResponseType(typeof(ApiResponse<List<LeveeDto>>), StatusCodes.Status200OK)]
    public async Task<ActionResult<ApiResponse<List<LeveeDto>>>> GetList(
        [FromQuery] string? status = null,
        [FromQuery] string? keyword = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var filter = Builders<Levee>.Filter.Empty;

        if (!string.IsNullOrEmpty(status))
            filter &= Builders<Levee>.Filter.Eq(l => l.Status, status);

        if (!string.IsNullOrEmpty(keyword))
            filter &= Builders<Levee>.Filter.Or(
                Builders<Levee>.Filter.Regex(l => l.Code, new MongoDB.Bson.BsonRegularExpression(keyword, "i")),
                Builders<Levee>.Filter.Regex(l => l.Name, new MongoDB.Bson.BsonRegularExpression(keyword, "i")),
                Builders<Levee>.Filter.Regex(l => l.RiverName, new MongoDB.Bson.BsonRegularExpression(keyword, "i"))
            );

        var total = await _db.Levees.CountDocumentsAsync(filter);
        var levees = await _db.Levees
            .Find(filter)
            .SortByDescending(l => l.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync();

        var dtos = levees.Select(MapToDto).ToList();
        return Ok(ApiResponse<List<LeveeDto>>.Ok(dtos, total));
    }

    [HttpGet("{id}")]
    [SwaggerOperation(Summary = "获取堤防详情", Description = "根据ID获取堤防详细信息")]
    [ProducesResponseType(typeof(ApiResponse<LeveeDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<LeveeDto>>> GetById(string id)
    {
        var levee = await _db.Levees.Find(l => l.Id == id).FirstOrDefaultAsync();
        if (levee == null)
            return NotFound(ApiResponse.Fail("NOT_FOUND", "堤防不存在"));

        return Ok(ApiResponse<LeveeDto>.Ok(MapToDto(levee)));
    }

    [HttpPost]
    [SwaggerOperation(Summary = "新建堤防", Description = "创建新的堤防记录")]
    [ProducesResponseType(typeof(ApiResponse<LeveeDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<LeveeDto>>> Create([FromBody] LeveeCreateDto dto)
    {
        var errors = new Dictionary<string, string>();

        if (string.IsNullOrEmpty(dto.Code))
            errors["code"] = "堤防编号不能为空";
        if (string.IsNullOrEmpty(dto.Name))
            errors["name"] = "堤防名称不能为空";
        if (string.IsNullOrEmpty(dto.RiverName))
            errors["riverName"] = "所属河流不能为空";
        if (string.IsNullOrEmpty(dto.StartPoint))
            errors["startPoint"] = "起点不能为空";
        if (string.IsNullOrEmpty(dto.EndPoint))
            errors["endPoint"] = "终点不能为空";
        if (dto.LengthKm <= 0)
            errors["lengthKm"] = "长度必须大于0";
        if (string.IsNullOrEmpty(dto.DesignLevel))
            errors["designLevel"] = "设计等级不能为空";
        if (string.IsNullOrEmpty(dto.Material))
            errors["material"] = "结构材料不能为空";
        if (string.IsNullOrEmpty(dto.Status))
            errors["status"] = "状态不能为空";
        if (string.IsNullOrEmpty(dto.ResponsibleUnit))
            errors["responsibleUnit"] = "责任单位不能为空";
        if (string.IsNullOrEmpty(dto.ResponsiblePerson))
            errors["responsiblePerson"] = "责任人不能为空";
        if (string.IsNullOrEmpty(dto.ContactPhone))
            errors["contactPhone"] = "联系电话不能为空";

        if (errors.Count > 0)
            return BadRequest(ApiResponse.Fail("VALIDATION_ERROR", "参数验证失败", errors));

        var existing = await _db.Levees.Find(l => l.Code == dto.Code).FirstOrDefaultAsync();
        if (existing != null)
            return BadRequest(ApiResponse.Fail("DUPLICATE_CODE", "堤防编号已存在"));

        var now = DateTime.UtcNow;
        var levee = new Levee
        {
            Code = dto.Code,
            Name = dto.Name,
            RiverName = dto.RiverName,
            StartPoint = dto.StartPoint,
            EndPoint = dto.EndPoint,
            LengthKm = dto.LengthKm,
            DesignLevel = dto.DesignLevel,
            DesignWaterLevel = dto.DesignWaterLevel,
            GuaranteeWaterLevel = dto.GuaranteeWaterLevel,
            WarningWaterLevel = dto.WarningWaterLevel,
            Material = dto.Material,
            Status = dto.Status,
            ResponsibleUnit = dto.ResponsibleUnit,
            ResponsiblePerson = dto.ResponsiblePerson,
            ContactPhone = dto.ContactPhone,
            Description = dto.Description,
            CreatedAt = now,
            UpdatedAt = now
        };

        await _db.Levees.InsertOneAsync(levee);
        return Ok(ApiResponse<LeveeDto>.Ok(MapToDto(levee)));
    }

    [HttpPut("{id}")]
    [SwaggerOperation(Summary = "编辑堤防", Description = "更新堤防信息")]
    [ProducesResponseType(typeof(ApiResponse<LeveeDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<LeveeDto>>> Update(string id, [FromBody] LeveeUpdateDto dto)
    {
        var levee = await _db.Levees.Find(l => l.Id == id).FirstOrDefaultAsync();
        if (levee == null)
            return NotFound(ApiResponse.Fail("NOT_FOUND", "堤防不存在"));

        var errors = new Dictionary<string, string>();

        if (!string.IsNullOrEmpty(dto.Code) && dto.Code != levee.Code)
        {
            var existing = await _db.Levees.Find(l => l.Code == dto.Code && l.Id != id).FirstOrDefaultAsync();
            if (existing != null)
                errors["code"] = "堤防编号已存在";
        }

        if (dto.LengthKm.HasValue && dto.LengthKm.Value <= 0)
            errors["lengthKm"] = "长度必须大于0";

        if (errors.Count > 0)
            return BadRequest(ApiResponse.Fail("VALIDATION_ERROR", "参数验证失败", errors));

        var now = DateTime.UtcNow;

        if (!string.IsNullOrEmpty(dto.Code))
            levee.Code = dto.Code;
        if (!string.IsNullOrEmpty(dto.Name))
            levee.Name = dto.Name;
        if (!string.IsNullOrEmpty(dto.RiverName))
            levee.RiverName = dto.RiverName;
        if (!string.IsNullOrEmpty(dto.StartPoint))
            levee.StartPoint = dto.StartPoint;
        if (!string.IsNullOrEmpty(dto.EndPoint))
            levee.EndPoint = dto.EndPoint;
        if (dto.LengthKm.HasValue)
            levee.LengthKm = dto.LengthKm.Value;
        if (!string.IsNullOrEmpty(dto.DesignLevel))
            levee.DesignLevel = dto.DesignLevel;
        if (dto.DesignWaterLevel.HasValue)
            levee.DesignWaterLevel = dto.DesignWaterLevel.Value;
        if (dto.GuaranteeWaterLevel.HasValue)
            levee.GuaranteeWaterLevel = dto.GuaranteeWaterLevel.Value;
        if (dto.WarningWaterLevel.HasValue)
            levee.WarningWaterLevel = dto.WarningWaterLevel.Value;
        if (!string.IsNullOrEmpty(dto.Material))
            levee.Material = dto.Material;
        if (!string.IsNullOrEmpty(dto.Status))
            levee.Status = dto.Status;
        if (!string.IsNullOrEmpty(dto.ResponsibleUnit))
            levee.ResponsibleUnit = dto.ResponsibleUnit;
        if (!string.IsNullOrEmpty(dto.ResponsiblePerson))
            levee.ResponsiblePerson = dto.ResponsiblePerson;
        if (!string.IsNullOrEmpty(dto.ContactPhone))
            levee.ContactPhone = dto.ContactPhone;
        if (dto.Description != null)
            levee.Description = dto.Description;

        levee.UpdatedAt = now;

        await _db.Levees.ReplaceOneAsync(l => l.Id == id, levee);
        return Ok(ApiResponse<LeveeDto>.Ok(MapToDto(levee)));
    }

    [HttpDelete("{id}")]
    [SwaggerOperation(Summary = "删除堤防", Description = "删除指定堤防记录")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse>> Delete(string id)
    {
        var result = await _db.Levees.DeleteOneAsync(l => l.Id == id);
        if (result.DeletedCount == 0)
            return NotFound(ApiResponse.Fail("NOT_FOUND", "堤防不存在"));

        return Ok(ApiResponse.Ok());
    }

    private static LeveeDto MapToDto(Levee l)
    {
        return new LeveeDto
        {
            Id = l.Id,
            Code = l.Code,
            Name = l.Name,
            RiverName = l.RiverName,
            StartPoint = l.StartPoint,
            EndPoint = l.EndPoint,
            LengthKm = l.LengthKm,
            DesignLevel = l.DesignLevel,
            DesignWaterLevel = l.DesignWaterLevel,
            GuaranteeWaterLevel = l.GuaranteeWaterLevel,
            WarningWaterLevel = l.WarningWaterLevel,
            Material = l.Material,
            Status = l.Status,
            ResponsibleUnit = l.ResponsibleUnit,
            ResponsiblePerson = l.ResponsiblePerson,
            ContactPhone = l.ContactPhone,
            Description = l.Description,
            CreatedAt = l.CreatedAt,
            UpdatedAt = l.UpdatedAt
        };
    }
}
