using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpecialEquipmentInspection.Common;
using SpecialEquipmentInspection.Dtos;
using SpecialEquipmentInspection.Models;
using SpecialEquipmentInspection.Repositories;

namespace SpecialEquipmentInspection.Controllers;

[ApiController]
[Authorize]
[Route("api/devices")]
public class DeviceController : ControllerBase
{
    private readonly IDeviceRepository _devices;
    private readonly ICurrentUserAccessor _user;

    public DeviceController(IDeviceRepository devices, ICurrentUserAccessor user)
    {
        _devices = devices;
        _user = user;
    }

    [HttpGet]
    public async Task<ApiResponse<PagedResult<Device>>> GetDevices(
        [FromQuery] DeviceType? type, [FromQuery] string? region,
        [FromQuery] DeviceStatus? status, [FromQuery] string? keyword,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var useUnitCode = _user.User.IsUserUnit ? _user.User.UseUnitCode : null;
        var result = await _devices.GetPagedAsync(type, region, useUnitCode, status, keyword, page, pageSize);
        return ApiResponse<PagedResult<Device>>.Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<ApiResponse<Device>> GetDevice(int id)
    {
        var device = await _devices.GetByIdAsync(id) ?? throw new NotFoundException("设备不存在");
        EnsureCanAccessDevice(device);
        return ApiResponse<Device>.Ok(device);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse<Device>> Create([FromBody] CreateDeviceDto dto)
    {
        if (await _devices.ExistsByCodeAsync(dto.DeviceCode))
            throw new BusinessException($"设备编码 {dto.DeviceCode} 已存在");

        var device = MapToEntity(dto);
        var created = await _devices.AddAsync(device);
        return ApiResponse<Device>.Ok(created, "设备档案创建成功");
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse<Device>> Update(int id, [FromBody] UpdateDeviceDto dto)
    {
        var device = await _devices.GetByIdAsync(id, track: true) ?? throw new NotFoundException("设备不存在");
        if (await _devices.ExistsByCodeAsync(dto.DeviceCode, id))
            throw new BusinessException($"设备编码 {dto.DeviceCode} 已存在");

        MapToEntity(dto, device);
        await _devices.UpdateAsync(device);
        return ApiResponse<Device>.Ok(device, "设备档案更新成功");
    }

    [HttpPatch("{id:int}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse> ChangeStatus(int id, [FromBody] DeviceStatusChangeDto dto)
    {
        await _devices.UpdateStatusAsync(id, dto.Status);
        return ApiResponse.Ok(null, "设备状态变更成功");
    }

    [HttpPost("batch")]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse> BatchImport([FromBody] BatchImportDeviceDto dto)
    {
        foreach (var d in dto.Devices)
        {
            if (await _devices.ExistsByCodeAsync(d.DeviceCode))
                throw new BusinessException($"设备编码 {d.DeviceCode} 已存在");
        }

        var devices = dto.Devices.Select(d => MapToEntity(d)).ToList();
        var count = await _devices.BatchAddAsync(devices);
        return ApiResponse.Ok(new { imported = count }, $"成功导入 {count} 条设备档案");
    }

    [HttpGet("regions")]
    public async Task<ApiResponse<List<string>>> GetRegions()
    {
        var regions = await _devices.GetRegionsAsync();
        return ApiResponse<List<string>>.Ok(regions);
    }

    [HttpGet("stats")]
    [Authorize(Roles = "Admin,Inspector")]
    public async Task<ApiResponse<Dictionary<DeviceType, int>>> Stats()
    {
        var stats = await _devices.CountByTypeAsync();
        return ApiResponse<Dictionary<DeviceType, int>>.Ok(stats);
    }

    private void EnsureCanAccessDevice(Device device)
    {
        if (_user.User.IsUserUnit && device.UseUnitCode != _user.User.UseUnitCode)
            throw new ForbiddenException("仅可查看本单位设备信息");
    }

    private static Device MapToEntity(CreateDeviceDto dto, Device? entity = null)
    {
        entity ??= new Device();
        entity.DeviceCode = dto.DeviceCode;
        entity.Name = dto.Name;
        entity.Type = dto.Type;
        entity.Manufacturer = dto.Manufacturer;
        entity.Model = dto.Model;
        entity.ManufacturingDate = dto.ManufacturingDate;
        entity.UseUnitCode = dto.UseUnitCode;
        entity.UseUnitName = dto.UseUnitName;
        entity.UseUnitContact = dto.UseUnitContact;
        entity.UseUnitPhone = dto.UseUnitPhone;
        entity.Region = dto.Region;
        entity.TechnicalParameters = dto.TechnicalParameters;
        entity.NextInspectionDate = dto.NextInspectionDate;
        entity.Status = dto.Status;
        return entity;
    }
}
