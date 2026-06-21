using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpecialEquipmentInspection.Common;
using SpecialEquipmentInspection.Dtos;
using SpecialEquipmentInspection.Models;
using SpecialEquipmentInspection.Repositories;

namespace SpecialEquipmentInspection.Controllers;

[ApiController]
[Authorize]
[Route("api/inspectors")]
public class InspectorController : ControllerBase
{
    private readonly IInspectorRepository _repo;
    public InspectorController(IInspectorRepository repo) => _repo = repo;

    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse<PagedResult<Inspector>>> Get(
        [FromQuery] InspectorStatus? status, [FromQuery] string? keyword,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var data = await _repo.GetPagedAsync(status, keyword, page, pageSize);
        return ApiResponse<PagedResult<Inspector>>.Ok(data);
    }

    [HttpGet("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse<Inspector>> Get(int id)
    {
        var ins = await _repo.GetByIdAsync(id) ?? throw new NotFoundException("检验员不存在");
        return ApiResponse<Inspector>.Ok(ins);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse<Inspector>> Create([FromBody] CreateInspectorDto dto)
    {
        if (await _repo.ExistsByCertificateNoAsync(dto.CertificateNo))
            throw new BusinessException($"证书编号 {dto.CertificateNo} 已存在");

        var inspector = new Inspector
        {
            Name = dto.Name,
            CertificateNo = dto.CertificateNo,
            CertifiableTypes = dto.CertifiableTypes,
            IssueDate = dto.IssueDate,
            ExpiryDate = dto.ExpiryDate,
            Phone = dto.Phone,
            Status = dto.ExpiryDate < DateTime.Now ? InspectorStatus.Expired : InspectorStatus.Active
        };
        var created = await _repo.AddAsync(inspector);
        return ApiResponse<Inspector>.Ok(created, "检验员资质信息创建成功");
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse<Inspector>> Update(int id, [FromBody] CreateInspectorDto dto)
    {
        var inspector = await _repo.GetByIdAsync(id) ?? throw new NotFoundException("检验员不存在");
        if (await _repo.ExistsByCertificateNoAsync(dto.CertificateNo, id))
            throw new BusinessException($"证书编号 {dto.CertificateNo} 已存在");

        inspector.Name = dto.Name;
        inspector.CertificateNo = dto.CertificateNo;
        inspector.CertifiableTypes = dto.CertifiableTypes;
        inspector.IssueDate = dto.IssueDate;
        inspector.ExpiryDate = dto.ExpiryDate;
        inspector.Phone = dto.Phone;
        await _repo.UpdateAsync(inspector);
        return ApiResponse<Inspector>.Ok(inspector, "检验员资质信息更新成功");
    }

    [HttpGet("expiring")]
    [Authorize(Roles = "Admin")]
    public async Task<ApiResponse<List<Inspector>>> GetExpiring([FromQuery] int withinDays = 30)
    {
        var data = await _repo.GetExpiringAsync(withinDays);
        return ApiResponse<List<Inspector>>.Ok(data);
    }
}
