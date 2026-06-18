using ElderlyCareSystem.Models;
using ElderlyCareSystem.Repositories;

namespace ElderlyCareSystem.Services;

public interface IBedService
{
    Task<List<Bed>> GetAllAsync(string? facilityId = null);
    Task<Bed?> GetByIdAsync(string id);
    Task<Bed> CreateAsync(Bed bed);
    Task UpdateAsync(string id, Bed bed);
    Task DeleteAsync(string id);
    Task<List<Bed>> GetByStatusAsync(string status, string? facilityId = null);
    Task<List<Bed>> GetByCareZoneAsync(string careZone, string? facilityId = null);
    Task<List<Bed>> GetByFloorAsync(string floor, string building, string? facilityId = null);
    Task<(long total, long occupied, long available, long maintenance)> GetStatsAsync(string? facilityId = null);
    Task<bool> BookBedAsync(string bedId, string elderlyId, DateTime expiryDate, string operatorName);
    Task<bool> CancelBookingAsync(string bedId, string operatorName);
    Task<bool> TransferBedAsync(string oldBedId, string newBedId, string elderlyId, string operatorName);
    Task<bool> SetMaintenanceAsync(string bedId, DateTime startDate, DateTime? endDate, string notes, string operatorName);
    Task<bool> ReleaseMaintenanceAsync(string bedId, string operatorName);
    Task<decimal> CalculateBedFeeAsync(string bedId, DateTime startDate, DateTime endDate);
    Task<List<BedHistory>> GetBedHistoryAsync(string bedId);
}

public class BedService : IBedService
{
    private readonly IBedRepository _bedRepository;
    private readonly IElderlyRepository _elderlyRepository;

    public BedService(IBedRepository bedRepository, IElderlyRepository elderlyRepository)
    {
        _bedRepository = bedRepository;
        _elderlyRepository = elderlyRepository;
    }

    public async Task<List<Bed>> GetAllAsync(string? facilityId = null)
    {
        return await _bedRepository.GetAllAsync(facilityId);
    }

    public async Task<Bed?> GetByIdAsync(string id)
    {
        return await _bedRepository.GetByIdAsync(id);
    }

    public async Task<Bed> CreateAsync(Bed bed)
    {
        return await _bedRepository.CreateAsync(bed);
    }

    public async Task UpdateAsync(string id, Bed bed)
    {
        var existing = await _bedRepository.GetByIdAsync(id);
        if (existing == null) throw new KeyNotFoundException($"床位 {id} 不存在");
        bed.Id = id;
        bed.CreatedAt = existing.CreatedAt;
        await _bedRepository.UpdateAsync(id, bed);
    }

    public async Task DeleteAsync(string id)
    {
        var bed = await _bedRepository.GetByIdAsync(id);
        if (bed == null) throw new KeyNotFoundException($"床位 {id} 不存在");
        if (bed.Status == "Occupied") throw new InvalidOperationException("当前床位有人入住，无法删除");
        await _bedRepository.DeleteAsync(id);
    }

    public async Task<List<Bed>> GetByStatusAsync(string status, string? facilityId = null)
    {
        return await _bedRepository.GetByStatusAsync(status, facilityId);
    }

    public async Task<List<Bed>> GetByCareZoneAsync(string careZone, string? facilityId = null)
    {
        return await _bedRepository.GetByCareZoneAsync(careZone, facilityId);
    }

    public async Task<List<Bed>> GetByFloorAsync(string floor, string building, string? facilityId = null)
    {
        return await _bedRepository.GetByFloorAsync(floor, building, facilityId);
    }

    public async Task<(long total, long occupied, long available, long maintenance)> GetStatsAsync(string? facilityId = null)
    {
        return await _bedRepository.GetStatsAsync(facilityId);
    }

    public async Task<bool> BookBedAsync(string bedId, string elderlyId, DateTime expiryDate, string operatorName)
    {
        var bed = await _bedRepository.GetByIdAsync(bedId);
        if (bed == null) throw new KeyNotFoundException("床位不存在");
        if (bed.Status != "Available") throw new InvalidOperationException($"床位当前状态为 {bed.Status}，无法预约");

        var elderly = await _elderlyRepository.GetByIdAsync(elderlyId);
        if (elderly == null) throw new KeyNotFoundException("老人不存在");

        bed.IsBooked = true;
        bed.BookedByElderlyId = elderlyId;
        bed.BookingExpiryDate = expiryDate;
        var history = new BedHistory
        {
            Action = "Booked",
            ElderlyId = elderlyId,
            ElderlyName = elderly.Name,
            ActionDate = DateTime.UtcNow,
            OperatorName = operatorName,
            Notes = $"预约至 {expiryDate:yyyy-MM-dd}"
        };
        bed.History.Add(history);
        bed.UpdatedAt = DateTime.UtcNow;
        await _bedRepository.UpdateAsync(bedId, bed);
        return true;
    }

    public async Task<bool> CancelBookingAsync(string bedId, string operatorName)
    {
        var bed = await _bedRepository.GetByIdAsync(bedId);
        if (bed == null) throw new KeyNotFoundException("床位不存在");
        if (!bed.IsBooked) throw new InvalidOperationException("床位未被预约");

        string? elderlyName = null;
        if (!string.IsNullOrEmpty(bed.BookedByElderlyId))
        {
            var elderly = await _elderlyRepository.GetByIdAsync(bed.BookedByElderlyId);
            elderlyName = elderly?.Name;
        }

        bed.IsBooked = false;
        bed.BookedByElderlyId = null;
        bed.BookingExpiryDate = null;
        var history = new BedHistory
        {
            Action = "BookingCancelled",
            ElderlyId = bed.BookedByElderlyId,
            ElderlyName = elderlyName,
            ActionDate = DateTime.UtcNow,
            OperatorName = operatorName,
            Notes = "取消预约"
        };
        bed.History.Add(history);
        bed.UpdatedAt = DateTime.UtcNow;
        await _bedRepository.UpdateAsync(bedId, bed);
        return true;
    }

    public async Task<bool> TransferBedAsync(string oldBedId, string newBedId, string elderlyId, string operatorName)
    {
        var oldBed = await _bedRepository.GetByIdAsync(oldBedId);
        if (oldBed == null) throw new KeyNotFoundException("原床位不存在");
        if (oldBed.ElderlyId != elderlyId) throw new InvalidOperationException("老人不在原床位");

        var newBed = await _bedRepository.GetByIdAsync(newBedId);
        if (newBed == null) throw new KeyNotFoundException("新床位不存在");
        if (newBed.Status != "Available") throw new InvalidOperationException($"新床位状态为 {newBed.Status}，无法换入");

        var elderly = await _elderlyRepository.GetByIdAsync(elderlyId);
        if (elderly == null) throw new KeyNotFoundException("老人不存在");

        var oldHistory = new BedHistory
        {
            Action = "TransferredOut",
            ElderlyId = elderlyId,
            ElderlyName = elderly.Name,
            ActionDate = DateTime.UtcNow,
            OperatorName = operatorName,
            Notes = $"转到 {newBed.Building}-{newBed.Floor}-{newBed.RoomNumber}-{newBed.BedNumber}"
        };
        oldBed.Status = "Available";
        oldBed.ElderlyId = null;
        oldBed.ElderlyName = null;
        oldBed.OccupiedDate = null;
        oldBed.History.Add(oldHistory);
        oldBed.UpdatedAt = DateTime.UtcNow;
        await _bedRepository.UpdateAsync(oldBedId, oldBed);

        var newHistory = new BedHistory
        {
            Action = "TransferredIn",
            ElderlyId = elderlyId,
            ElderlyName = elderly.Name,
            ActionDate = DateTime.UtcNow,
            OperatorName = operatorName,
            Notes = $"从 {oldBed.Building}-{oldBed.Floor}-{oldBed.RoomNumber}-{oldBed.BedNumber} 转入"
        };
        newBed.Status = "Occupied";
        newBed.ElderlyId = elderlyId;
        newBed.ElderlyName = elderly.Name;
        newBed.OccupiedDate = DateTime.UtcNow;
        newBed.History.Add(newHistory);
        newBed.UpdatedAt = DateTime.UtcNow;
        await _bedRepository.UpdateAsync(newBedId, newBed);

        elderly.BedId = newBedId;
        elderly.UpdatedAt = DateTime.UtcNow;
        await _elderlyRepository.UpdateAsync(elderlyId, elderly);

        return true;
    }

    public async Task<bool> SetMaintenanceAsync(string bedId, DateTime startDate, DateTime? endDate, string notes, string operatorName)
    {
        var bed = await _bedRepository.GetByIdAsync(bedId);
        if (bed == null) throw new KeyNotFoundException("床位不存在");
        if (bed.Status == "Occupied") throw new InvalidOperationException("当前床位有人入住，无法设置维修");

        var previousStatus = bed.Status;
        bed.Status = "Maintenance";
        bed.MaintenanceStartDate = startDate;
        bed.MaintenanceEndDate = endDate;
        bed.MaintenanceNotes = notes;
        var history = new BedHistory
        {
            Action = "SetMaintenance",
            ActionDate = DateTime.UtcNow,
            OperatorName = operatorName,
            Notes = $"设置维修: {notes} | 原状态: {previousStatus} | 预计结束: {(endDate.HasValue ? endDate.Value.ToString(\"yyyy-MM-dd\") : \"未定\")}"
        };
        bed.History.Add(history);
        bed.UpdatedAt = DateTime.UtcNow;
        await _bedRepository.UpdateAsync(bedId, bed);
        return true;
    }

    public async Task<bool> ReleaseMaintenanceAsync(string bedId, string operatorName)
    {
        var bed = await _bedRepository.GetByIdAsync(bedId);
        if (bed == null) throw new KeyNotFoundException("床位不存在");
        if (bed.Status != "Maintenance") throw new InvalidOperationException("床位不处于维修状态");

        bed.Status = "Available";
        var history = new BedHistory
        {
            Action = "ReleasedMaintenance",
            ActionDate = DateTime.UtcNow,
            OperatorName = operatorName,
            Notes = "维修完成，已释放"
        };
        bed.History.Add(history);
        bed.MaintenanceStartDate = null;
        bed.MaintenanceEndDate = null;
        bed.MaintenanceNotes = null;
        bed.UpdatedAt = DateTime.UtcNow;
        await _bedRepository.UpdateAsync(bedId, bed);
        return true;
    }

    public async Task<decimal> CalculateBedFeeAsync(string bedId, DateTime startDate, DateTime endDate)
    {
        var bed = await _bedRepository.GetByIdAsync(bedId);
        if (bed == null) throw new KeyNotFoundException("床位不存在");
        var days = (int)(endDate.Date - startDate.Date).TotalDays + 1;
        return bed.DailyRate * Math.Max(1, days);
    }

    public async Task<List<BedHistory>> GetBedHistoryAsync(string bedId)
    {
        var bed = await _bedRepository.GetByIdAsync(bedId);
        if (bed == null) throw new KeyNotFoundException("床位不存在");
        return bed.History.OrderByDescending(h => h.ActionDate).ToList();
    }
}
