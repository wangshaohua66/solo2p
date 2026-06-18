using AutoMapper;
using HazChemSupervision.DTOs;
using HazChemSupervision.Models;
using HazChemSupervision.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace HazChemSupervision.Services;

public class CertificateService : ICertificateService
{
    private readonly IBaseRepository<Certificate> _certRepo;
    private readonly IBaseRepository<Enterprise> _enterpriseRepo;
    private readonly IBaseRepository<User> _userRepo;
    private readonly IAlertService _alertService;
    private readonly IMapper _mapper;
    private readonly IConfiguration _configuration;

    public CertificateService(
        IBaseRepository<Certificate> certRepo,
        IBaseRepository<Enterprise> enterpriseRepo,
        IBaseRepository<User> userRepo,
        IAlertService alertService,
        IMapper mapper,
        IConfiguration configuration)
    {
        _certRepo = certRepo;
        _enterpriseRepo = enterpriseRepo;
        _userRepo = userRepo;
        _alertService = alertService;
        _mapper = mapper;
        _configuration = configuration;
    }

    public async Task<CertificateDto?> GetCertificateByIdAsync(int id)
    {
        var cert = await _certRepo.GetQueryable()
            .Include(c => c.Enterprise)
            .FirstOrDefaultAsync(c => c.Id == id);

        return cert != null ? _mapper.Map<CertificateDto>(cert) : null;
    }

    public async Task<PagedResult<CertificateDto>> GetCertificatesAsync(CertificateQueryDto dto)
    {
        var predicate = PredicateBuilder.True<Certificate>();

        if (!string.IsNullOrEmpty(dto.CertificateNo))
            predicate = predicate.And(c => c.CertificateNo.Contains(dto.CertificateNo));

        if (dto.Type.HasValue)
            predicate = predicate.And(c => c.Type == (CertificateType)dto.Type.Value);

        if (!string.IsNullOrEmpty(dto.HolderName))
            predicate = predicate.And(c => c.HolderName.Contains(dto.HolderName));

        if (dto.EnterpriseId.HasValue)
            predicate = predicate.And(c => c.EnterpriseId == dto.EnterpriseId.Value);

        if (dto.UserId.HasValue)
            predicate = predicate.And(c => c.UserId == dto.UserId.Value);

        if (dto.Status.HasValue)
            predicate = predicate.And(c => c.Status == (CertificateStatus)dto.Status.Value);

        if (dto.Verified.HasValue)
            predicate = predicate.And(c => c.Verified == dto.Verified.Value);

        if (dto.IsExpiring.HasValue)
        {
            var now = DateTime.UtcNow;
            var expiringDays = int.Parse(_configuration["Alert:CertificateExpiringDays"] ?? "30");
            if (dto.IsExpiring.Value)
                predicate = predicate.And(c => c.ExpiryDate >= now && c.ExpiryDate <= now.AddDays(expiringDays) && c.Status == CertificateStatus.Valid);
            else
                predicate = predicate.And(c => c.ExpiryDate > now.AddDays(expiringDays) || c.Status != CertificateStatus.Valid);
        }

        if (dto.ExpiryDateRange?.StartDate.HasValue == true)
            predicate = predicate.And(c => c.ExpiryDate >= dto.ExpiryDateRange.StartDate.Value);

        if (dto.ExpiryDateRange?.EndDate.HasValue == true)
            predicate = predicate.And(c => c.ExpiryDate < dto.ExpiryDateRange.EndDate.Value.AddDays(1));

        var result = await _certRepo.GetPagedAsync(
            predicate,
            q => q.OrderByDescending(c => c.UpdatedAt),
            dto.PageIndex,
            dto.PageSize);

        var items = await _certRepo.GetQueryable()
            .Include(c => c.Enterprise)
            .Where(predicate)
            .OrderByDescending(c => c.UpdatedAt)
            .Skip((dto.PageIndex - 1) * dto.PageSize)
            .Take(dto.PageSize)
            .ToListAsync();

        return new PagedResult<CertificateDto>
        {
            Items = _mapper.Map<List<CertificateDto>>(items),
            TotalCount = result.TotalCount,
            PageIndex = dto.PageIndex,
            PageSize = dto.PageSize
        };
    }

    public async Task<CertificateDto> CreateCertificateAsync(CertificateCreateDto dto)
    {
        var exists = await _certRepo.ExistsAsync(c => c.CertificateNo == dto.CertificateNo && c.Type == (CertificateType)dto.Type);
        if (exists)
            throw new InvalidOperationException($"该类型证书编号已存在: {dto.CertificateNo}");

        if (dto.EnterpriseId.HasValue)
        {
            var enterprise = await _enterpriseRepo.GetByIdAsync(dto.EnterpriseId.Value);
            if (enterprise == null)
                throw new KeyNotFoundException($"企业不存在: {dto.EnterpriseId.Value}");
        }

        if (dto.UserId.HasValue)
        {
            var user = await _userRepo.GetByIdAsync(dto.UserId.Value);
            if (user == null)
                throw new KeyNotFoundException($"用户不存在: {dto.UserId.Value}");
        }

        if (dto.ExpiryDate <= dto.IssueDate)
            throw new InvalidOperationException("有效期必须晚于签发日期");

        var cert = _mapper.Map<Certificate>(dto);
        cert.Status = CalculateCertificateStatus(cert.ExpiryDate);
        cert.CreatedAt = DateTime.UtcNow;
        cert.UpdatedAt = DateTime.UtcNow;

        var result = await _certRepo.AddAsync(cert);
        await _alertService.CheckAndGenerateCertificateAlertsAsync();

        return _mapper.Map<CertificateDto>(result);
    }

    public async Task<CertificateVerificationResultDto> VerifyCertificateAsync(CertificateVerifyDto dto)
    {
        var cert = await _certRepo.GetQueryable()
            .FirstOrDefaultAsync(c =>
                c.CertificateNo == dto.CertificateNo &&
                c.Type == (CertificateType)dto.Type &&
                c.HolderName == dto.HolderName);

        if (cert == null)
        {
            return new CertificateVerificationResultDto
            {
                IsValid = false,
                Message = "证书不存在或信息不匹配",
                CertificateNo = dto.CertificateNo,
                HolderName = dto.HolderName,
                VerifiedAt = DateTime.UtcNow
            };
        }

        var status = CalculateCertificateStatus(cert.ExpiryDate);

        cert.Verified = true;
        cert.LastVerifiedTime = DateTime.UtcNow;
        cert.VerificationResult = status == CertificateStatus.Valid ? "验证通过" : $"证书{status}";
        cert.Status = status;
        cert.UpdatedAt = DateTime.UtcNow;

        await _certRepo.UpdateAsync(cert);

        return new CertificateVerificationResultDto
        {
            IsValid = status == CertificateStatus.Valid,
            Message = status == CertificateStatus.Valid ? "证书有效" : $"证书{status}",
            CertificateNo = cert.CertificateNo,
            HolderName = cert.HolderName,
            ExpiryDate = cert.ExpiryDate,
            Status = status.ToString(),
            VerifiedAt = DateTime.UtcNow
        };
    }

    public async Task<bool> UpdateCertificateStatusAsync(int id)
    {
        var cert = await _certRepo.GetByIdAsync(id);
        if (cert == null) return false;

        cert.Status = CalculateCertificateStatus(cert.ExpiryDate);
        cert.UpdatedAt = DateTime.UtcNow;

        await _certRepo.UpdateAsync(cert);
        return true;
    }

    public async Task<List<CertificateDto>> GetExpiringCertificatesAsync(int days = 30)
    {
        var now = DateTime.UtcNow;
        var expiringDate = now.AddDays(days);

        var certs = await _certRepo.GetQueryable()
            .Include(c => c.Enterprise)
            .Where(c =>
                c.Status == CertificateStatus.Valid &&
                c.ExpiryDate >= now &&
                c.ExpiryDate <= expiringDate)
            .OrderBy(c => c.ExpiryDate)
            .ToListAsync();

        return _mapper.Map<List<CertificateDto>>(certs);
    }

    public async Task<List<CertificateDto>> GetExpiredCertificatesAsync()
    {
        var now = DateTime.UtcNow;

        var certs = await _certRepo.GetQueryable()
            .Include(c => c.Enterprise)
            .Where(c =>
                c.Status != CertificateStatus.Revoked &&
                c.Status != CertificateStatus.Suspended &&
                c.ExpiryDate < now)
            .OrderBy(c => c.ExpiryDate)
            .ToListAsync();

        return _mapper.Map<List<CertificateDto>>(certs);
    }

    private CertificateStatus CalculateCertificateStatus(DateTime expiryDate)
    {
        var now = DateTime.UtcNow;
        var expiringDays = int.Parse(_configuration["Alert:CertificateExpiringDays"] ?? "30");

        if (expiryDate < now)
            return CertificateStatus.Expired;
        if (expiryDate <= now.AddDays(expiringDays))
            return CertificateStatus.Expiring;
        return CertificateStatus.Valid;
    }
}
