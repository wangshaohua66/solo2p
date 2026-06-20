using Microsoft.AspNetCore.Mvc;
using FireIoTPlatform.Models.DTOs.Common;
using FireIoTPlatform.Models.DTOs.Maintenance;
using FireIoTPlatform.Services;

namespace FireIoTPlatform.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class MaintenanceController : ControllerBase
{
    private readonly IMaintenanceService _maintenanceService;

    public MaintenanceController(IMaintenanceService maintenanceService)
    {
        _maintenanceService = maintenanceService;
    }

    [HttpGet("companies/{id}")]
    public async Task<ApiResponse<MaintenanceCompanyDto>> GetCompanyById(long id)
    {
        return await _maintenanceService.GetCompanyByIdAsync(id);
    }

    [HttpGet("companies")]
    public async Task<ApiResponse<PagedResult<MaintenanceCompanyDto>>> GetCompanies([FromQuery] PagedQuery query)
    {
        return await _maintenanceService.GetCompaniesPagedAsync(query);
    }

    [HttpPost("companies")]
    public async Task<ApiResponse<MaintenanceCompanyDto>> CreateCompany([FromBody] MaintenanceCompanyCreateDto dto)
    {
        return await _maintenanceService.CreateCompanyAsync(dto);
    }

    [HttpPut("companies/{id}")]
    public async Task<ApiResponse<bool>> UpdateCompany(long id, [FromBody] MaintenanceCompanyCreateDto dto)
    {
        return await _maintenanceService.UpdateCompanyAsync(id, dto);
    }

    [HttpDelete("companies/{id}")]
    public async Task<ApiResponse<bool>> DeleteCompany(long id)
    {
        return await _maintenanceService.DeleteCompanyAsync(id);
    }

    [HttpGet("contracts/{id}")]
    public async Task<ApiResponse<MaintenanceContractDto>> GetContractById(long id)
    {
        return await _maintenanceService.GetContractByIdAsync(id);
    }

    [HttpGet("contracts")]
    public async Task<ApiResponse<PagedResult<MaintenanceContractDto>>> GetContracts([FromQuery] MaintenanceContractQueryDto query)
    {
        return await _maintenanceService.GetContractsPagedAsync(query);
    }

    [HttpPost("contracts")]
    public async Task<ApiResponse<MaintenanceContractDto>> CreateContract([FromBody] MaintenanceContractCreateDto dto)
    {
        return await _maintenanceService.CreateContractAsync(dto);
    }

    [HttpPut("contracts/{id}")]
    public async Task<ApiResponse<bool>> UpdateContract(long id, [FromBody] MaintenanceContractCreateDto dto)
    {
        return await _maintenanceService.UpdateContractAsync(id, dto);
    }

    [HttpDelete("contracts/{id}")]
    public async Task<ApiResponse<bool>> DeleteContract(long id)
    {
        return await _maintenanceService.DeleteContractAsync(id);
    }

    [HttpPost("contracts/reminders")]
    public async Task<ApiResponse<bool>> SendExpiryReminders()
    {
        return await _maintenanceService.SendExpiryRemindersAsync();
    }

    [HttpGet("records/{id}")]
    public async Task<ApiResponse<MaintenanceRecordDto>> GetRecordById(long id)
    {
        return await _maintenanceService.GetRecordByIdAsync(id);
    }

    [HttpGet("records")]
    public async Task<ApiResponse<PagedResult<MaintenanceRecordDto>>> GetRecords([FromQuery] PagedQuery query)
    {
        return await _maintenanceService.GetRecordsPagedAsync(query);
    }

    [HttpPost("records")]
    public async Task<ApiResponse<MaintenanceRecordDto>> CreateRecord([FromBody] MaintenanceRecordCreateDto dto)
    {
        return await _maintenanceService.CreateRecordAsync(dto);
    }

    [HttpPost("records/evaluate")]
    public async Task<ApiResponse<bool>> EvaluateRecord([FromBody] MaintenanceEvaluateDto dto)
    {
        return await _maintenanceService.EvaluateRecordAsync(dto);
    }
}
