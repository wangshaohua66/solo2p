using FireIoTPlatform.Models.DTOs.Common;
using FireIoTPlatform.Models.DTOs.Maintenance;

namespace FireIoTPlatform.Services;

public interface IMaintenanceService
{
    Task<ApiResponse<MaintenanceCompanyDto>> GetCompanyByIdAsync(long id);
    Task<ApiResponse<PagedResult<MaintenanceCompanyDto>>> GetCompaniesPagedAsync(PagedQuery query);
    Task<ApiResponse<MaintenanceCompanyDto>> CreateCompanyAsync(MaintenanceCompanyCreateDto dto);
    Task<ApiResponse<bool>> UpdateCompanyAsync(long id, MaintenanceCompanyCreateDto dto);
    Task<ApiResponse<bool>> DeleteCompanyAsync(long id);

    Task<ApiResponse<MaintenanceContractDto>> GetContractByIdAsync(long id);
    Task<ApiResponse<PagedResult<MaintenanceContractDto>>> GetContractsPagedAsync(MaintenanceContractQueryDto query);
    Task<ApiResponse<MaintenanceContractDto>> CreateContractAsync(MaintenanceContractCreateDto dto);
    Task<ApiResponse<bool>> UpdateContractAsync(long id, MaintenanceContractCreateDto dto);
    Task<ApiResponse<bool>> DeleteContractAsync(long id);
    Task<ApiResponse<bool>> SendExpiryRemindersAsync();

    Task<ApiResponse<MaintenanceRecordDto>> GetRecordByIdAsync(long id);
    Task<ApiResponse<PagedResult<MaintenanceRecordDto>>> GetRecordsPagedAsync(PagedQuery query);
    Task<ApiResponse<MaintenanceRecordDto>> CreateRecordAsync(MaintenanceRecordCreateDto dto);
    Task<ApiResponse<bool>> EvaluateRecordAsync(MaintenanceEvaluateDto dto);
}
