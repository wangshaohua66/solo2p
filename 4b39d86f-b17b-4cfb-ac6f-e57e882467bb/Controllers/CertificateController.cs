using HazChemSupervision.DTOs;
using HazChemSupervision.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace HazChemSupervision.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "EnterpriseUser")]
[SwaggerTag("证书管理 - 资质证书管理、校验")]
public class CertificateController : ControllerBase
{
    private readonly ICertificateService _certService;

    public CertificateController(ICertificateService certService)
    {
        _certService = certService;
    }

    [HttpGet]
    [SwaggerOperation(Summary = "获取证书列表", Description = "分页查询证书信息，支持按类型、状态、企业等筛选")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<PagedResult<CertificateDto>>))]
    public async Task<ActionResult<ApiResponse<PagedResult<CertificateDto>>>> GetCertificates([FromQuery] CertificateQueryDto dto)
    {
        var result = await _certService.GetCertificatesAsync(dto);
        return Ok(new ApiResponse<PagedResult<CertificateDto>> { Data = result });
    }

    [HttpGet("{id}")]
    [SwaggerOperation(Summary = "获取证书详情", Description = "根据ID获取证书详细信息")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<CertificateDto>))]
    [SwaggerResponse(404, "证书不存在")]
    public async Task<ActionResult<ApiResponse<CertificateDto>>> GetCertificate(int id)
    {
        var cert = await _certService.GetCertificateByIdAsync(id);
        if (cert == null)
            return NotFound(new ApiResponse<CertificateDto> { Code = 404, Message = "证书不存在" });

        return Ok(new ApiResponse<CertificateDto> { Data = cert });
    }

    [HttpPost]
    [Authorize(Policy = "Supervisor")]
    [SwaggerOperation(Summary = "新增证书", Description = "录入新的资质证书信息")]
    [SwaggerResponse(200, "创建成功", typeof(ApiResponse<CertificateDto>))]
    public async Task<ActionResult<ApiResponse<CertificateDto>>> CreateCertificate([FromBody] CertificateCreateDto dto)
    {
        try
        {
            var result = await _certService.CreateCertificateAsync(dto);
            return Ok(new ApiResponse<CertificateDto> { Data = result });
        }
        catch (Exception ex)
        {
            return BadRequest(new ApiResponse<CertificateDto> { Code = 400, Message = ex.Message });
        }
    }

    [HttpPost("verify")]
    [SwaggerOperation(Summary = "校验证书", Description = "对接应急管理部证书查询接口，实时校验证书有效性")]
    [SwaggerResponse(200, "校验完成", typeof(ApiResponse<CertificateVerificationResultDto>))]
    public async Task<ActionResult<ApiResponse<CertificateVerificationResultDto>>> VerifyCertificate([FromBody] CertificateVerifyDto dto)
    {
        var result = await _certService.VerifyCertificateAsync(dto);
        return Ok(new ApiResponse<CertificateVerificationResultDto> { Data = result });
    }

    [HttpPost("{id}/update-status")]
    [SwaggerOperation(Summary = "更新证书状态", Description = "根据有效期自动更新证书状态（有效/即将过期/已过期）")]
    [SwaggerResponse(200, "更新成功", typeof(ApiResponse<bool>))]
    [SwaggerResponse(404, "证书不存在")]
    public async Task<ActionResult<ApiResponse<bool>>> UpdateCertificateStatus(int id)
    {
        var result = await _certService.UpdateCertificateStatusAsync(id);
        if (!result)
            return NotFound(new ApiResponse<bool> { Code = 404, Message = "证书不存在", Data = false });

        return Ok(new ApiResponse<bool> { Data = result });
    }

    [HttpGet("expiring")]
    [SwaggerOperation(Summary = "获取即将到期证书", Description = "获取指定天数内即将到期的证书")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<List<CertificateDto>>))]
    public async Task<ActionResult<ApiResponse<List<CertificateDto>>>> GetExpiringCertificates(
        [FromQuery] int days = 30)
    {
        var result = await _certService.GetExpiringCertificatesAsync(days);
        return Ok(new ApiResponse<List<CertificateDto>> { Data = result });
    }

    [HttpGet("expired")]
    [SwaggerOperation(Summary = "获取已过期证书", Description = "获取所有已过期的证书")]
    [SwaggerResponse(200, "获取成功", typeof(ApiResponse<List<CertificateDto>>))]
    public async Task<ActionResult<ApiResponse<List<CertificateDto>>>> GetExpiredCertificates()
    {
        var result = await _certService.GetExpiredCertificatesAsync();
        return Ok(new ApiResponse<List<CertificateDto>> { Data = result });
    }
}
