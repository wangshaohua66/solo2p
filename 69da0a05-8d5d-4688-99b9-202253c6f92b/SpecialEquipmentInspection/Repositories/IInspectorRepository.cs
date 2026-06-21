using Microsoft.EntityFrameworkCore;
using SpecialEquipmentInspection.Common;
using SpecialEquipmentInspection.Data;
using SpecialEquipmentInspection.Models;

namespace SpecialEquipmentInspection.Repositories;

public interface IInspectorRepository
{
    Task<Inspector?> GetByIdAsync(int id);
    Task<Inspector?> GetByCertificateNoAsync(string certNo);
    Task<bool> ExistsByCertificateNoAsync(string certNo, int? excludeId = null);
    Task<PagedResult<Inspector>> GetPagedAsync(InspectorStatus? status, string? keyword, int page, int pageSize);
    Task<Inspector> AddAsync(Inspector inspector);
    Task UpdateAsync(Inspector inspector);
    Task<List<Inspector>> GetExpiringAsync(int withinDays);
    Task<bool> CanInspectTypeAsync(int inspectorId, DeviceType type);
}
