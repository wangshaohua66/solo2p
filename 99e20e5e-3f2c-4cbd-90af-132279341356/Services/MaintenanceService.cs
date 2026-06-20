using FireIoTPlatform.Models.DTOs.Common;
using FireIoTPlatform.Models.DTOs.Maintenance;
using FireIoTPlatform.Models.Entities;
using FireIoTPlatform.Models.Enums;
using FireIoTPlatform.Repositories;

namespace FireIoTPlatform.Services;

public class MaintenanceService : IMaintenanceService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<MaintenanceService> _logger;

    public MaintenanceService(IUnitOfWork unitOfWork, ILogger<MaintenanceService> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<ApiResponse<MaintenanceCompanyDto>> GetCompanyByIdAsync(long id)
    {
        var c = await _unitOfWork.MaintenanceCompanies.GetByIdAsync(id);
        if (c == null || c.IsDeleted) return ApiResponse<MaintenanceCompanyDto>.Error(404, "维保公司不存在");
        return ApiResponse<MaintenanceCompanyDto>.Success(MapCompanyToDto(c));
    }

    public async Task<ApiResponse<PagedResult<MaintenanceCompanyDto>>> GetCompaniesPagedAsync(PagedQuery query)
    {
        var predicate = PredicateBuilder.True<MaintenanceCompany>().And(c => !c.IsDeleted);
        if (!string.IsNullOrEmpty(query.Keyword))
            predicate = predicate.And(c => c.CompanyName.Contains(query.Keyword) || c.CompanyCode.Contains(query.Keyword));

        var result = await _unitOfWork.MaintenanceCompanies.GetPagedAsync(predicate, query.PageIndex, query.PageSize, c => c.CreatedAt, query.IsDescending);
        var dtos = result.Items.Select(MapCompanyToDto).ToList();
        return ApiResponse<PagedResult<MaintenanceCompanyDto>>.Success(new PagedResult<MaintenanceCompanyDto>
        { Items = dtos, TotalCount = result.TotalCount, PageIndex = query.PageIndex, PageSize = query.PageSize });
    }

    public async Task<ApiResponse<MaintenanceCompanyDto>> CreateCompanyAsync(MaintenanceCompanyCreateDto dto)
    {
        var company = new MaintenanceCompany
        {
            CompanyCode = dto.CompanyCode,
            CompanyName = dto.CompanyName,
            UnifiedSocialCreditCode = dto.UnifiedSocialCreditCode,
            Address = dto.Address,
            LegalPerson = dto.LegalPerson,
            ContactPerson = dto.ContactPerson,
            ContactPhone = dto.ContactPhone,
            ContactEmail = dto.ContactEmail,
            QualificationCert = dto.QualificationCert,
            QualificationExpiryDate = dto.QualificationExpiryDate,
            Rating = 3,
            IsActive = true,
            Description = dto.Description
        };
        await _unitOfWork.MaintenanceCompanies.AddAsync(company);
        await _unitOfWork.SaveChangesAsync();
        return ApiResponse<MaintenanceCompanyDto>.Success("创建成功", MapCompanyToDto(company));
    }

    public async Task<ApiResponse<bool>> UpdateCompanyAsync(long id, MaintenanceCompanyCreateDto dto)
    {
        var c = await _unitOfWork.MaintenanceCompanies.GetByIdAsync(id);
        if (c == null || c.IsDeleted) return ApiResponse<bool>.Error(404, "维保公司不存在");
        c.CompanyName = dto.CompanyName;
        c.UnifiedSocialCreditCode = dto.UnifiedSocialCreditCode;
        c.Address = dto.Address;
        c.LegalPerson = dto.LegalPerson;
        c.ContactPerson = dto.ContactPerson;
        c.ContactPhone = dto.ContactPhone;
        c.ContactEmail = dto.ContactEmail;
        c.QualificationCert = dto.QualificationCert;
        c.QualificationExpiryDate = dto.QualificationExpiryDate;
        c.Description = dto.Description;
        _unitOfWork.MaintenanceCompanies.Update(c);
        await _unitOfWork.SaveChangesAsync();
        return ApiResponse<bool>.Success("更新成功", true);
    }

    public async Task<ApiResponse<bool>> DeleteCompanyAsync(long id)
    {
        var c = await _unitOfWork.MaintenanceCompanies.GetByIdAsync(id);
        if (c == null || c.IsDeleted) return ApiResponse<bool>.Error(404, "维保公司不存在");
        c.IsDeleted = true;
        _unitOfWork.MaintenanceCompanies.Update(c);
        await _unitOfWork.SaveChangesAsync();
        return ApiResponse<bool>.Success("删除成功", true);
    }

    public async Task<ApiResponse<MaintenanceContractDto>> GetContractByIdAsync(long id)
    {
        var c = await _unitOfWork.MaintenanceContracts.GetByIdAsync(id);
        if (c == null || c.IsDeleted) return ApiResponse<MaintenanceContractDto>.Error(404, "维保合同不存在");
        return ApiResponse<MaintenanceContractDto>.Success(await MapContractToDtoAsync(c));
    }

    public async Task<ApiResponse<PagedResult<MaintenanceContractDto>>> GetContractsPagedAsync(MaintenanceContractQueryDto query)
    {
        var predicate = PredicateBuilder.True<MaintenanceContract>().And(c => !c.IsDeleted);
        if (query.Status.HasValue) predicate = predicate.And(c => c.Status == query.Status.Value);
        if (query.FireUnitId.HasValue) predicate = predicate.And(c => c.FireUnitId == query.FireUnitId.Value);
        if (query.MaintenanceCompanyId.HasValue) predicate = predicate.And(c => c.MaintenanceCompanyId == query.MaintenanceCompanyId.Value);
        if (query.ExpiringSoon.HasValue && query.ExpiringSoon.Value)
        {
            var soon = DateTime.Now.AddDays(30);
            predicate = predicate.And(c => c.EndDate <= soon && c.Status == MaintenanceStatus.Active);
        }
        if (!string.IsNullOrEmpty(query.Keyword))
            predicate = predicate.And(c => c.ContractNo.Contains(query.Keyword) || (c.ContractName != null && c.ContractName.Contains(query.Keyword)));

        if (!string.IsNullOrEmpty(query.DistrictCode))
        {
            var unitIds = (await _unitOfWork.FireUnits.FindAsync(u => !u.IsDeleted && u.DistrictCode == query.DistrictCode)).Select(u => u.Id).ToList();
            if (unitIds.Any()) predicate = predicate.And(c => unitIds.Contains(c.FireUnitId));
        }

        var result = await _unitOfWork.MaintenanceContracts.GetPagedAsync(predicate, query.PageIndex, query.PageSize, c => c.CreatedAt, query.IsDescending);
        var dtos = new List<MaintenanceContractDto>();
        foreach (var c in result.Items) dtos.Add(await MapContractToDtoAsync(c));

        return ApiResponse<PagedResult<MaintenanceContractDto>>.Success(new PagedResult<MaintenanceContractDto>
        { Items = dtos, TotalCount = result.TotalCount, PageIndex = query.PageIndex, PageSize = query.PageSize });
    }

    public async Task<ApiResponse<MaintenanceContractDto>> CreateContractAsync(MaintenanceContractCreateDto dto)
    {
        var unit = await _unitOfWork.FireUnits.GetByIdAsync(dto.FireUnitId);
        var company = await _unitOfWork.MaintenanceCompanies.GetByIdAsync(dto.MaintenanceCompanyId);
        if (unit == null) return ApiResponse<MaintenanceContractDto>.Error(404, "单位不存在");
        if (company == null) return ApiResponse<MaintenanceContractDto>.Error(404, "维保公司不存在");

        var contract = new MaintenanceContract
        {
            ContractNo = dto.ContractNo,
            FireUnitId = dto.FireUnitId,
            MaintenanceCompanyId = dto.MaintenanceCompanyId,
            Status = MaintenanceStatus.Active,
            ContractName = dto.ContractName,
            StartDate = dto.StartDate,
            EndDate = dto.EndDate,
            Scope = dto.Scope,
            ServiceItems = dto.ServiceItems,
            ContractAmount = dto.ContractAmount,
            ContactPerson = dto.ContactPerson,
            ContactPhone = dto.ContactPhone,
            ReminderDaysBeforeExpiry = dto.ReminderDaysBeforeExpiry,
            Description = dto.Description,
            AttachmentUrl = dto.AttachmentUrl
        };

        await _unitOfWork.MaintenanceContracts.AddAsync(contract);
        await _unitOfWork.SaveChangesAsync();
        return ApiResponse<MaintenanceContractDto>.Success("创建成功", await MapContractToDtoAsync(contract));
    }

    public async Task<ApiResponse<bool>> UpdateContractAsync(long id, MaintenanceContractCreateDto dto)
    {
        var c = await _unitOfWork.MaintenanceContracts.GetByIdAsync(id);
        if (c == null || c.IsDeleted) return ApiResponse<bool>.Error(404, "维保合同不存在");
        c.ContractName = dto.ContractName;
        c.StartDate = dto.StartDate;
        c.EndDate = dto.EndDate;
        c.Scope = dto.Scope;
        c.ServiceItems = dto.ServiceItems;
        c.ContractAmount = dto.ContractAmount;
        c.ContactPerson = dto.ContactPerson;
        c.ContactPhone = dto.ContactPhone;
        c.ReminderDaysBeforeExpiry = dto.ReminderDaysBeforeExpiry;
        c.Description = dto.Description;
        c.AttachmentUrl = dto.AttachmentUrl;
        _unitOfWork.MaintenanceContracts.Update(c);
        await _unitOfWork.SaveChangesAsync();
        return ApiResponse<bool>.Success("更新成功", true);
    }

    public async Task<ApiResponse<bool>> DeleteContractAsync(long id)
    {
        var c = await _unitOfWork.MaintenanceContracts.GetByIdAsync(id);
        if (c == null || c.IsDeleted) return ApiResponse<bool>.Error(404, "维保合同不存在");
        c.IsDeleted = true;
        _unitOfWork.MaintenanceContracts.Update(c);
        await _unitOfWork.SaveChangesAsync();
        return ApiResponse<bool>.Success("删除成功", true);
    }

    public async Task<ApiResponse<bool>> SendExpiryRemindersAsync()
    {
        var now = DateTime.Now;
        var contracts = await _unitOfWork.MaintenanceContracts.FindAsync(c =>
            !c.IsDeleted && c.Status == MaintenanceStatus.Active && !c.ReminderSent);

        foreach (var c in contracts)
        {
            var daysLeft = (c.EndDate - now).TotalDays;
            if (daysLeft <= c.ReminderDaysBeforeExpiry)
            {
                if (daysLeft <= 0) c.Status = MaintenanceStatus.Expired;
                else if (daysLeft <= 30) c.Status = MaintenanceStatus.Expiring;
                c.ReminderSent = true;
                _unitOfWork.MaintenanceContracts.Update(c);
                _logger.LogInformation($"维保合同即将到期提醒: ContractNo={c.ContractNo}, EndDate={c.EndDate:yyyy-MM-dd}");
            }
        }
        await _unitOfWork.SaveChangesAsync();
        return ApiResponse<bool>.Success(true);
    }

    public async Task<ApiResponse<MaintenanceRecordDto>> GetRecordByIdAsync(long id)
    {
        var r = await _unitOfWork.MaintenanceRecords.GetByIdAsync(id);
        if (r == null || r.IsDeleted) return ApiResponse<MaintenanceRecordDto>.Error(404, "维保记录不存在");
        return ApiResponse<MaintenanceRecordDto>.Success(await MapRecordToDtoAsync(r));
    }

    public async Task<ApiResponse<PagedResult<MaintenanceRecordDto>>> GetRecordsPagedAsync(PagedQuery query)
    {
        var predicate = PredicateBuilder.True<MaintenanceRecord>().And(r => !r.IsDeleted);
        if (!string.IsNullOrEmpty(query.Keyword))
            predicate = predicate.And(r => r.MaintenanceType.Contains(query.Keyword));

        var result = await _unitOfWork.MaintenanceRecords.GetPagedAsync(predicate, query.PageIndex, query.PageSize, r => r.CreatedAt, query.IsDescending);
        var dtos = new List<MaintenanceRecordDto>();
        foreach (var r in result.Items) dtos.Add(await MapRecordToDtoAsync(r));

        return ApiResponse<PagedResult<MaintenanceRecordDto>>.Success(new PagedResult<MaintenanceRecordDto>
        { Items = dtos, TotalCount = result.TotalCount, PageIndex = query.PageIndex, PageSize = query.PageSize });
    }

    public async Task<ApiResponse<MaintenanceRecordDto>> CreateRecordAsync(MaintenanceRecordCreateDto dto)
    {
        var contract = await _unitOfWork.MaintenanceContracts.GetByIdAsync(dto.ContractId);
        if (contract == null || contract.IsDeleted) return ApiResponse<MaintenanceRecordDto>.Error(404, "维保合同不存在");

        var unit = await _unitOfWork.FireUnits.GetByIdAsync(dto.FireUnitId);
        var device = dto.DeviceId.HasValue ? await _unitOfWork.Devices.GetByIdAsync(dto.DeviceId.Value) : null;

        var record = new MaintenanceRecord
        {
            ContractId = dto.ContractId,
            FireUnitId = dto.FireUnitId,
            DeviceId = dto.DeviceId,
            MaintenanceType = dto.MaintenanceType,
            PlanDate = dto.PlanDate,
            ActualDate = dto.ActualDate,
            Content = dto.Content,
            Result = dto.Result,
            IsQualified = dto.IsQualified,
            ProblemFound = dto.ProblemFound,
            Solution = dto.Solution,
            Operator = dto.Operator,
            OperatorPhone = dto.OperatorPhone,
            Photos = dto.Photos,
            Remark = dto.Remark
        };

        await _unitOfWork.MaintenanceRecords.AddAsync(record);
        await _unitOfWork.SaveChangesAsync();
        return ApiResponse<MaintenanceRecordDto>.Success("创建成功", await MapRecordToDtoAsync(record));
    }

    public async Task<ApiResponse<bool>> EvaluateRecordAsync(MaintenanceEvaluateDto dto)
    {
        var r = await _unitOfWork.MaintenanceRecords.GetByIdAsync(dto.RecordId);
        if (r == null || r.IsDeleted) return ApiResponse<bool>.Error(404, "维保记录不存在");

        var evaluator = await _unitOfWork.Users.GetByIdAsync(dto.EvaluatorId);
        r.QualityScore = dto.QualityScore;
        r.QualityComment = dto.QualityComment;
        r.EvaluatedBy = dto.EvaluatorId;
        r.EvaluatedAt = DateTime.Now;

        _unitOfWork.MaintenanceRecords.Update(r);
        await _unitOfWork.SaveChangesAsync();
        return ApiResponse<bool>.Success("评价成功", true);
    }

    private static MaintenanceCompanyDto MapCompanyToDto(MaintenanceCompany c) => new()
    {
        Id = c.Id,
        CompanyCode = c.CompanyCode,
        CompanyName = c.CompanyName,
        UnifiedSocialCreditCode = c.UnifiedSocialCreditCode,
        Address = c.Address,
        LegalPerson = c.LegalPerson,
        ContactPerson = c.ContactPerson,
        ContactPhone = c.ContactPhone,
        ContactEmail = c.ContactEmail,
        QualificationCert = c.QualificationCert,
        QualificationExpiryDate = c.QualificationExpiryDate,
        Rating = c.Rating,
        IsActive = c.IsActive,
        Description = c.Description,
        CreatedAt = c.CreatedAt
    };

    private async Task<MaintenanceContractDto> MapContractToDtoAsync(MaintenanceContract c)
    {
        var unit = await _unitOfWork.FireUnits.GetByIdAsync(c.FireUnitId);
        var company = await _unitOfWork.MaintenanceCompanies.GetByIdAsync(c.MaintenanceCompanyId);
        return new MaintenanceContractDto
        {
            Id = c.Id,
            ContractNo = c.ContractNo,
            FireUnitId = c.FireUnitId,
            FireUnitName = unit?.Name,
            MaintenanceCompanyId = c.MaintenanceCompanyId,
            MaintenanceCompanyName = company?.CompanyName,
            Status = c.Status,
            StatusName = GetContractStatusName(c.Status),
            ContractName = c.ContractName,
            StartDate = c.StartDate,
            EndDate = c.EndDate,
            Scope = c.Scope,
            ServiceItems = c.ServiceItems,
            ContractAmount = c.ContractAmount,
            ContactPerson = c.ContactPerson,
            ContactPhone = c.ContactPhone,
            ReminderDaysBeforeExpiry = c.ReminderDaysBeforeExpiry,
            ReminderSent = c.ReminderSent,
            Description = c.Description,
            AttachmentUrl = c.AttachmentUrl,
            CreatedAt = c.CreatedAt
        };
    }

    private async Task<MaintenanceRecordDto> MapRecordToDtoAsync(MaintenanceRecord r)
    {
        var unit = await _unitOfWork.FireUnits.GetByIdAsync(r.FireUnitId);
        var device = r.DeviceId.HasValue ? await _unitOfWork.Devices.GetByIdAsync(r.DeviceId.Value) : null;
        return new MaintenanceRecordDto
        {
            Id = r.Id,
            ContractId = r.ContractId,
            FireUnitId = r.FireUnitId,
            FireUnitName = unit?.Name,
            DeviceId = r.DeviceId,
            DeviceCode = device?.DeviceCode,
            MaintenanceType = r.MaintenanceType,
            PlanDate = r.PlanDate,
            ActualDate = r.ActualDate,
            Content = r.Content,
            Result = r.Result,
            IsQualified = r.IsQualified,
            ProblemFound = r.ProblemFound,
            Solution = r.Solution,
            Operator = r.Operator,
            OperatorPhone = r.OperatorPhone,
            Photos = r.Photos,
            Remark = r.Remark,
            QualityScore = r.QualityScore,
            QualityComment = r.QualityComment,
            EvaluatedAt = r.EvaluatedAt,
            CreatedAt = r.CreatedAt
        };
    }

    private static string GetContractStatusName(MaintenanceStatus s) => s switch
    {
        MaintenanceStatus.Active => "有效",
        MaintenanceStatus.Expiring => "即将到期",
        MaintenanceStatus.Expired => "已过期",
        MaintenanceStatus.Terminated => "已终止",
        _ => "未知"
    };
}
