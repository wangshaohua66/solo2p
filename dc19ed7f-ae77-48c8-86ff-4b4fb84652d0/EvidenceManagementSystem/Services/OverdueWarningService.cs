using EvidenceManagementSystem.Common;
using EvidenceManagementSystem.Models.DTOs;
using EvidenceManagementSystem.Models.Entities;
using EvidenceManagementSystem.Models.Enums;
using EvidenceManagementSystem.Repositories;
using Microsoft.Extensions.Configuration;

namespace EvidenceManagementSystem.Services;

public class OverdueWarningService : IOverdueWarningService
{
    private readonly IOverdueWarningRepository _warningRepository;
    private readonly IEvidenceRepository _evidenceRepository;
    private readonly int _warningDays;

    public OverdueWarningService(
        IOverdueWarningRepository warningRepository,
        IEvidenceRepository evidenceRepository,
        IConfiguration configuration)
    {
        _warningRepository = warningRepository;
        _evidenceRepository = evidenceRepository;
        _warningDays = configuration.GetValue<int>("EvidenceSettings:WarningDaysBeforeExpiry", 7);
    }

    public async Task GenerateWarningsAsync()
    {
        var warningEvidences = await _evidenceRepository.GetWarningEvidencesAsync(_warningDays);
        var unresolvedWarnings = await _warningRepository.GetUnresolvedWarningsAsync();
        var existingEvidenceIds = unresolvedWarnings.Select(w => w.EvidenceId).ToHashSet();

        foreach (var evidence in warningEvidences)
        {
            if (existingEvidenceIds.Contains(evidence.Id))
                continue;

            if (!evidence.ExpectedExpiryDate.HasValue)
                continue;

            var daysRemaining = (int)(evidence.ExpectedExpiryDate.Value - DateTime.UtcNow).TotalDays;

            var warning = new OverdueWarning
            {
                Id = Guid.NewGuid(),
                EvidenceId = evidence.Id,
                Barcode = evidence.Barcode,
                EvidenceName = evidence.Name,
                Category = evidence.Category,
                ExpectedExpiryDate = evidence.ExpectedExpiryDate.Value,
                DaysRemaining = daysRemaining,
                IsWarning = true,
                IsOverdue = false,
                GeneratedAt = DateTime.UtcNow,
                Notified = false,
                Resolved = false
            };

            await _warningRepository.AddAsync(warning);
        }

        var overdueEvidences = await _evidenceRepository.GetOverdueEvidencesAsync();
        foreach (var evidence in overdueEvidences)
        {
            if (!evidence.ExpectedExpiryDate.HasValue)
                continue;

            var existingWarning = unresolvedWarnings.FirstOrDefault(w => w.EvidenceId == evidence.Id);
            var daysOverdue = (int)(DateTime.UtcNow - evidence.ExpectedExpiryDate.Value).TotalDays;

            if (existingWarning != null)
            {
                if (!existingWarning.IsOverdue)
                {
                    existingWarning.IsOverdue = true;
                    existingWarning.DaysRemaining = -daysOverdue;
                    existingWarning.GeneratedAt = DateTime.UtcNow;
                    existingWarning.Notified = false;
                    await _warningRepository.UpdateAsync(existingWarning);
                }
            }
            else
            {
                var warning = new OverdueWarning
                {
                    Id = Guid.NewGuid(),
                    EvidenceId = evidence.Id,
                    Barcode = evidence.Barcode,
                    EvidenceName = evidence.Name,
                    Category = evidence.Category,
                    ExpectedExpiryDate = evidence.ExpectedExpiryDate.Value,
                    DaysRemaining = -daysOverdue,
                    IsWarning = true,
                    IsOverdue = true,
                    GeneratedAt = DateTime.UtcNow,
                    Notified = false,
                    Resolved = false
                };

                await _warningRepository.AddAsync(warning);
            }

            if (!evidence.IsOverdue)
            {
                evidence.IsOverdue = true;
                evidence.Status = EvidenceStatus.Overdue;
                evidence.UpdatedAt = DateTime.UtcNow;
                await _evidenceRepository.UpdateAsync(evidence);
            }
        }
    }

    public async Task<PagedResult<OverdueWarningDto>> SearchAsync(OverdueWarningQuery query)
    {
        var result = await _warningRepository.SearchAsync(query);
        return new PagedResult<OverdueWarningDto>
        {
            Items = result.Items.Select(MapToDto).ToList(),
            TotalCount = result.TotalCount,
            PageNumber = result.PageNumber,
            PageSize = result.PageSize
        };
    }

    public async Task<List<OverdueWarningDto>> GetUnresolvedWarningsAsync()
    {
        var warnings = await _warningRepository.GetUnresolvedWarningsAsync();
        return warnings.Select(MapToDto).ToList();
    }

    public async Task MarkAsNotifiedAsync(Guid id)
    {
        await _warningRepository.MarkAsNotifiedAsync(id);
    }

    public async Task ResolveWarningAsync(Guid id, string remark)
    {
        await _warningRepository.ResolveWarningAsync(id, remark);

        var warning = await _warningRepository.GetByIdAsync(id);
        if (warning != null && warning.IsOverdue)
        {
            var evidence = await _evidenceRepository.GetByIdAsync(warning.EvidenceId);
            if (evidence != null)
            {
                evidence.IsOverdue = false;
                evidence.UpdatedAt = DateTime.UtcNow;
                await _evidenceRepository.UpdateAsync(evidence);
            }
        }
    }

    public async Task<int> GetWarningCountAsync()
    {
        var warnings = await _warningRepository.GetUnresolvedWarningsAsync();
        return warnings.Count(w => w.IsWarning && !w.IsOverdue);
    }

    public async Task<int> GetOverdueCountAsync()
    {
        var warnings = await _warningRepository.GetUnresolvedWarningsAsync();
        return warnings.Count(w => w.IsOverdue);
    }

    private static OverdueWarningDto MapToDto(OverdueWarning warning)
    {
        return new OverdueWarningDto
        {
            Id = warning.Id,
            EvidenceId = warning.EvidenceId,
            Barcode = warning.Barcode,
            EvidenceName = warning.EvidenceName,
            Category = warning.Category,
            ExpectedExpiryDate = warning.ExpectedExpiryDate,
            DaysRemaining = warning.DaysRemaining,
            IsWarning = warning.IsWarning,
            IsOverdue = warning.IsOverdue,
            GeneratedAt = warning.GeneratedAt,
            Notified = warning.Notified,
            NotifiedAt = warning.NotifiedAt,
            Resolved = warning.Resolved,
            ResolvedAt = warning.ResolvedAt,
            ResolveRemark = warning.ResolveRemark
        };
    }
}
