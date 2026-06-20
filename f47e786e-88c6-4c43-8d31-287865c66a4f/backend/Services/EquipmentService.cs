using Microsoft.EntityFrameworkCore;
using FireTraining.Data;
using FireTraining.Models;

namespace FireTraining.Services;

public interface IEquipmentService
{
    Task<List<Equipment>> GetEquipmentAsync(string? category, string? keyword, int page = 1, int pageSize = 20, CancellationToken cancellationToken = default);
    Task<int> GetEquipmentCountAsync(string? category, string? keyword, CancellationToken cancellationToken = default);
    Task<Equipment?> GetEquipmentByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<Equipment> CreateEquipmentAsync(Equipment equipment, CancellationToken cancellationToken = default);
    Task<Equipment?> UpdateEquipmentAsync(Equipment equipment, CancellationToken cancellationToken = default);
    Task<bool> DeleteEquipmentAsync(int id, CancellationToken cancellationToken = default);

    Task<ReservationResult> CreateReservationAsync(EquipmentReservation reservation, CancellationToken cancellationToken = default);
    Task<List<EquipmentReservation>> GetReservationsAsync(int? equipmentId, int? stationId, ReservationStatus? status, DateTime? startDate, DateTime? endDate, int page = 1, int pageSize = 20, CancellationToken cancellationToken = default);
    Task<int> GetReservationCountAsync(int? equipmentId, int? stationId, ReservationStatus? status, DateTime? startDate, DateTime? endDate, CancellationToken cancellationToken = default);
    Task<bool> ApproveReservationAsync(int reservationId, int approvedBy, CancellationToken cancellationToken = default);
    Task<bool> RejectReservationAsync(int reservationId, string reason, int approvedBy, CancellationToken cancellationToken = default);
    Task<bool> PickupEquipmentAsync(int reservationId, CancellationToken cancellationToken = default);
    Task<bool> ReturnEquipmentAsync(int reservationId, CancellationToken cancellationToken = default);
    Task CancelReservationAsync(int reservationId, CancellationToken cancellationToken = default);

    Task<bool> CheckAvailabilityAsync(int equipmentId, DateTime startTime, DateTime endTime, int quantity, int? excludeReservationId = null, CancellationToken cancellationToken = default);
    Task<List<EquipmentReservation>> GetConflictingReservationsAsync(int equipmentId, DateTime startTime, DateTime endTime, int? excludeReservationId = null, CancellationToken cancellationToken = default);
    Task<List<SuggestedTimeSlot>> GetAvailableSlotsAsync(int equipmentId, DateTime date, int quantity, CancellationToken cancellationToken = default);

    Task<List<Equipment>> GetOverdueEquipmentAsync(CancellationToken cancellationToken = default);
    Task SendOverdueRemindersAsync(CancellationToken cancellationToken = default);
    Task<EquipmentStatistics> GetEquipmentStatisticsAsync(StatisticFilter filter, CancellationToken cancellationToken = default);
}

public class EquipmentService : IEquipmentService
{
    private readonly AppDbContext _context;
    private readonly INotificationService _notificationService;

    public EquipmentService(AppDbContext context, INotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
    }

    public async Task<List<Equipment>> GetEquipmentAsync(
        string? category,
        string? keyword,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Equipment
            .Where(e => e.IsActive);

        if (!string.IsNullOrWhiteSpace(category))
        {
            query = query.Where(e => e.Category == category);
        }

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            query = query.Where(e => e.Name.Contains(keyword) || e.Description!.Contains(keyword));
        }

        return await query
            .OrderBy(e => e.Category)
            .ThenBy(e => e.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
    }

    public async Task<int> GetEquipmentCountAsync(string? category, string? keyword, CancellationToken cancellationToken = default)
    {
        var query = _context.Equipment.Where(e => e.IsActive);

        if (!string.IsNullOrWhiteSpace(category))
        {
            query = query.Where(e => e.Category == category);
        }

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            query = query.Where(e => e.Name.Contains(keyword) || e.Description!.Contains(keyword));
        }

        return await query.CountAsync(cancellationToken);
    }

    public async Task<Equipment?> GetEquipmentByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        return await _context.Equipment
            .FirstOrDefaultAsync(e => e.Id == id && e.IsActive, cancellationToken);
    }

    public async Task<Equipment> CreateEquipmentAsync(Equipment equipment, CancellationToken cancellationToken = default)
    {
        equipment.CreatedAt = DateTime.UtcNow;
        equipment.IsActive = true;
        equipment.AvailableQuantity = equipment.TotalQuantity;
        _context.Equipment.Add(equipment);
        await _context.SaveChangesAsync(cancellationToken);
        return equipment;
    }

    public async Task<Equipment?> UpdateEquipmentAsync(Equipment equipment, CancellationToken cancellationToken = default)
    {
        var existing = await _context.Equipment.FindAsync(new object[] { equipment.Id }, cancellationToken);
        if (existing == null) return null;

        existing.Name = equipment.Name;
        existing.Category = equipment.Category;
        existing.Unit = equipment.Unit;
        existing.TotalQuantity = equipment.TotalQuantity;
        existing.AvailableQuantity = equipment.AvailableQuantity;
        existing.MaintenanceQuantity = equipment.MaintenanceQuantity;
        existing.Icon = equipment.Icon;
        existing.Description = equipment.Description;
        existing.Model = equipment.Model;
        existing.Manufacturer = equipment.Manufacturer;
        existing.PurchaseDate = equipment.PurchaseDate;
        existing.LastMaintenanceDate = equipment.LastMaintenanceDate;
        existing.NextMaintenanceDate = equipment.NextMaintenanceDate;
        existing.Status = equipment.Status;
        existing.StorageLocation = equipment.StorageLocation;
        existing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        return existing;
    }

    public async Task<bool> DeleteEquipmentAsync(int id, CancellationToken cancellationToken = default)
    {
        var equipment = await _context.Equipment.FindAsync(new object[] { id }, cancellationToken);
        if (equipment == null) return false;

        equipment.IsActive = false;
        equipment.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<ReservationResult> CreateReservationAsync(EquipmentReservation reservation, CancellationToken cancellationToken = default)
    {
        var result = new ReservationResult();

        var equipment = await _context.Equipment.FindAsync(new object[] { reservation.EquipmentId }, cancellationToken);
        if (equipment == null)
        {
            result.Success = false;
            result.ErrorMessage = "器材不存在";
            return result;
        }

        var isAvailable = await CheckAvailabilityAsync(
            reservation.EquipmentId,
            reservation.StartTime,
            reservation.EndTime,
            reservation.Quantity,
            cancellationToken: cancellationToken);

        if (!isAvailable)
        {
            var conflicts = await GetConflictingReservationsAsync(
                reservation.EquipmentId,
                reservation.StartTime,
                reservation.EndTime,
                cancellationToken: cancellationToken);

            var higherPriorityConflicts = conflicts
                .Where(c => c.Priority >= reservation.Priority)
                .ToList();

            if (higherPriorityConflicts.Any())
            {
                result.Success = false;
                result.ErrorMessage = $"库存不足，存在{higherPriorityConflicts.Count}个更高优先级预约冲突";
                result.ConflictingReservations = higherPriorityConflicts;
                return result;
            }

            result.HasConflict = true;
            result.ConflictingReservations = conflicts;
        }

        reservation.Status = ReservationStatus.Pending;
        reservation.CreatedAt = DateTime.UtcNow;
        reservation.IsOverdue = false;

        _context.EquipmentReservations.Add(reservation);
        await _context.SaveChangesAsync(cancellationToken);

        result.Success = true;
        result.ReservationId = reservation.Id;
        return result;
    }

    public async Task<List<EquipmentReservation>> GetReservationsAsync(
        int? equipmentId,
        int? stationId,
        ReservationStatus? status,
        DateTime? startDate,
        DateTime? endDate,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = _context.EquipmentReservations
            .Include(r => r.Equipment)
            .Include(r => r.FireStation)
            .Include(r => r.Firefighter)
            .AsQueryable();

        if (equipmentId.HasValue)
        {
            query = query.Where(r => r.EquipmentId == equipmentId.Value);
        }

        if (stationId.HasValue)
        {
            query = query.Where(r => r.FireStationId == stationId.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(r => r.Status == status.Value);
        }

        if (startDate.HasValue)
        {
            query = query.Where(r => r.StartTime >= startDate.Value);
        }

        if (endDate.HasValue)
        {
            query = query.Where(r => r.EndTime <= endDate.Value);
        }

        return await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
    }

    public async Task<int> GetReservationCountAsync(
        int? equipmentId,
        int? stationId,
        ReservationStatus? status,
        DateTime? startDate,
        DateTime? endDate,
        CancellationToken cancellationToken = default)
    {
        var query = _context.EquipmentReservations.AsQueryable();

        if (equipmentId.HasValue)
        {
            query = query.Where(r => r.EquipmentId == equipmentId.Value);
        }

        if (stationId.HasValue)
        {
            query = query.Where(r => r.FireStationId == stationId.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(r => r.Status == status.Value);
        }

        if (startDate.HasValue)
        {
            query = query.Where(r => r.StartTime >= startDate.Value);
        }

        if (endDate.HasValue)
        {
            query = query.Where(r => r.EndTime <= endDate.Value);
        }

        return await query.CountAsync(cancellationToken);
    }

    public async Task<bool> ApproveReservationAsync(int reservationId, int approvedBy, CancellationToken cancellationToken = default)
    {
        var reservation = await _context.EquipmentReservations.FindAsync(new object[] { reservationId }, cancellationToken);
        if (reservation == null || reservation.Status != ReservationStatus.Pending)
            return false;

        var equipment = await _context.Equipment.FindAsync(new object[] { reservation.EquipmentId }, cancellationToken);
        if (equipment == null) return false;

        var isAvailable = await CheckAvailabilityAsync(
            reservation.EquipmentId,
            reservation.StartTime,
            reservation.EndTime,
            reservation.Quantity,
            reservationId,
            cancellationToken);

        if (!isAvailable)
        {
            return false;
        }

        reservation.Status = ReservationStatus.Approved;
        reservation.ApprovedBy = approvedBy;
        reservation.ApprovedAt = DateTime.UtcNow;
        reservation.UpdatedAt = DateTime.UtcNow;

        equipment.AvailableQuantity -= reservation.Quantity;

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> RejectReservationAsync(int reservationId, string reason, int approvedBy, CancellationToken cancellationToken = default)
    {
        var reservation = await _context.EquipmentReservations.FindAsync(new object[] { reservationId }, cancellationToken);
        if (reservation == null || reservation.Status != ReservationStatus.Pending)
            return false;

        reservation.Status = ReservationStatus.Rejected;
        reservation.RejectReason = reason;
        reservation.ApprovedBy = approvedBy;
        reservation.ApprovedAt = DateTime.UtcNow;
        reservation.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> PickupEquipmentAsync(int reservationId, CancellationToken cancellationToken = default)
    {
        var reservation = await _context.EquipmentReservations.FindAsync(new object[] { reservationId }, cancellationToken);
        if (reservation == null || reservation.Status != ReservationStatus.Approved)
            return false;

        reservation.Status = ReservationStatus.PickedUp;
        reservation.ActualPickupTime = DateTime.UtcNow;
        reservation.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> ReturnEquipmentAsync(int reservationId, CancellationToken cancellationToken = default)
    {
        var reservation = await _context.EquipmentReservations
            .Include(r => r.Equipment)
            .FirstOrDefaultAsync(r => r.Id == reservationId, cancellationToken);

        if (reservation == null || reservation.Status != ReservationStatus.PickedUp)
            return false;

        reservation.Status = ReservationStatus.Returned;
        reservation.ActualReturnTime = DateTime.UtcNow;
        reservation.UpdatedAt = DateTime.UtcNow;
        reservation.IsOverdue = DateTime.UtcNow > reservation.EndTime;

        if (reservation.Equipment != null)
        {
            reservation.Equipment.AvailableQuantity += reservation.Quantity;
        }

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task CancelReservationAsync(int reservationId, CancellationToken cancellationToken = default)
    {
        var reservation = await _context.EquipmentReservations.FindAsync(new object[] { reservationId }, cancellationToken);
        if (reservation == null) return;

        if (reservation.Status == ReservationStatus.Approved)
        {
            var equipment = await _context.Equipment.FindAsync(new object[] { reservation.EquipmentId }, cancellationToken);
            if (equipment != null)
            {
                equipment.AvailableQuantity += reservation.Quantity;
            }
        }

        reservation.Status = ReservationStatus.Cancelled;
        reservation.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<bool> CheckAvailabilityAsync(
        int equipmentId,
        DateTime startTime,
        DateTime endTime,
        int quantity,
        int? excludeReservationId = null,
        CancellationToken cancellationToken = default)
    {
        var equipment = await _context.Equipment.FindAsync(new object[] { equipmentId }, cancellationToken);
        if (equipment == null) return false;

        var conflictingReservations = await GetConflictingReservationsAsync(
            equipmentId, startTime, endTime, excludeReservationId, cancellationToken);

        var reservedQuantity = conflictingReservations
            .Where(r => r.Status == ReservationStatus.Approved || r.Status == ReservationStatus.PickedUp)
            .Sum(r => r.Quantity);

        return equipment.TotalQuantity - equipment.MaintenanceQuantity - reservedQuantity >= quantity;
    }

    public async Task<List<EquipmentReservation>> GetConflictingReservationsAsync(
        int equipmentId,
        DateTime startTime,
        DateTime endTime,
        int? excludeReservationId = null,
        CancellationToken cancellationToken = default)
    {
        var query = _context.EquipmentReservations
            .Where(r => r.EquipmentId == equipmentId
                && r.StartTime < endTime
                && r.EndTime > startTime
                && r.Status != ReservationStatus.Cancelled
                && r.Status != ReservationStatus.Rejected
                && r.Status != ReservationStatus.Returned);

        if (excludeReservationId.HasValue)
        {
            query = query.Where(r => r.Id != excludeReservationId.Value);
        }

        return await query
            .OrderBy(r => r.StartTime)
            .ToListAsync(cancellationToken);
    }

    public async Task<List<SuggestedTimeSlot>> GetAvailableSlotsAsync(
        int equipmentId,
        DateTime date,
        int quantity,
        CancellationToken cancellationToken = default)
    {
        var equipment = await _context.Equipment.FindAsync(new object[] { equipmentId }, cancellationToken);
        if (equipment == null)
            return new List<SuggestedTimeSlot>();

        var reservations = await _context.EquipmentReservations
            .Where(r => r.EquipmentId == equipmentId
                && r.StartTime.Date == date.Date
                && r.Status != ReservationStatus.Cancelled
                && r.Status != ReservationStatus.Rejected
                && r.Status != ReservationStatus.Returned)
            .OrderBy(r => r.StartTime)
            .ToListAsync(cancellationToken);

        var slots = new List<SuggestedTimeSlot>();
        var dayStart = date.Date.AddHours(8);
        var dayEnd = date.Date.AddHours(18);

        var currentTime = dayStart;

        foreach (var reservation in reservations.OrderBy(r => r.StartTime))
        {
            if (reservation.StartTime > currentTime)
            {
                var gapDuration = reservation.StartTime - currentTime;
                if (gapDuration.TotalHours >= 1)
                {
                    slots.Add(new SuggestedTimeSlot
                    {
                        StartTime = currentTime,
                        EndTime = reservation.StartTime,
                        AvailableQuantity = equipment.TotalQuantity - equipment.MaintenanceQuantity,
                        DurationHours = (int)gapDuration.TotalHours
                    });
                }
            }
            currentTime = reservation.EndTime > currentTime ? reservation.EndTime : currentTime;
        }

        if (currentTime < dayEnd)
        {
            slots.Add(new SuggestedTimeSlot
            {
                StartTime = currentTime,
                EndTime = dayEnd,
                AvailableQuantity = equipment.TotalQuantity - equipment.MaintenanceQuantity,
                DurationHours = (int)(dayEnd - currentTime).TotalHours
            });
        }

        return slots;
    }

    public async Task<List<Equipment>> GetOverdueEquipmentAsync(CancellationToken cancellationToken = default)
    {
        var overdueReservations = await _context.EquipmentReservations
            .Include(r => r.Equipment)
            .Where(r => r.EndTime < DateTime.UtcNow
                && (r.Status == ReservationStatus.Approved || r.Status == ReservationStatus.PickedUp)
                && r.Status != ReservationStatus.Returned)
            .ToListAsync(cancellationToken);

        var equipmentIds = overdueReservations.Select(r => r.EquipmentId).Distinct();
        return await _context.Equipment
            .Where(e => equipmentIds.Contains(e.Id) && e.IsActive)
            .ToListAsync(cancellationToken);
    }

    public async Task SendOverdueRemindersAsync(CancellationToken cancellationToken = default)
    {
        var overdueReservations = await _context.EquipmentReservations
            .Include(r => r.Equipment)
            .Include(r => r.Firefighter)
            .Where(r => r.EndTime < DateTime.UtcNow.AddHours(-1)
                && r.Status == ReservationStatus.PickedUp
                && !r.IsOverdue)
            .ToListAsync(cancellationToken);

        foreach (var reservation in overdueReservations)
        {
            reservation.IsOverdue = true;
            reservation.OverdueNotified = true;
            reservation.OverdueNotifiedAt = DateTime.UtcNow;

            try
            {
                await _notificationService.SendOverdueReminderAsync(reservation.Id, cancellationToken);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"发送逾期提醒失败：预约ID={reservation.Id}, 错误={ex.Message}");
            }
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<EquipmentStatistics> GetEquipmentStatisticsAsync(StatisticFilter filter, CancellationToken cancellationToken = default)
    {
        var equipment = await _context.Equipment
            .Where(e => e.IsActive)
            .ToListAsync(cancellationToken);

        var totalEquipment = equipment.Count;
        var totalQuantity = equipment.Sum(e => e.TotalQuantity);
        var availableQuantity = equipment.Sum(e => e.AvailableQuantity);
        var maintenanceQuantity = equipment.Sum(e => e.MaintenanceQuantity);

        var totalReservations = await _context.EquipmentReservations
            .Where(r => r.CreatedAt >= filter.StartDate && r.CreatedAt <= filter.EndDate)
            .CountAsync(cancellationToken);

        var approvedReservations = await _context.EquipmentReservations
            .Where(r => r.Status == ReservationStatus.Approved
                && r.CreatedAt >= filter.StartDate
                && r.CreatedAt <= filter.EndDate)
            .CountAsync(cancellationToken);

        var overdueCount = await _context.EquipmentReservations
            .Where(r => r.IsOverdue || (r.EndTime < DateTime.UtcNow && r.Status == ReservationStatus.PickedUp))
            .CountAsync(cancellationToken);

        var utilizationRate = totalQuantity > 0
            ? Math.Round((decimal)(totalQuantity - availableQuantity - maintenanceQuantity) / totalQuantity * 100, 2)
            : 0;

        var usageRanking = equipment
            .OrderByDescending(e => e.TotalQuantity - e.AvailableQuantity)
            .Take(10)
            .Select(e => new EquipmentUsageRanking
            {
                EquipmentId = e.Id,
                EquipmentName = e.Name,
                Category = e.Category,
                TotalQuantity = e.TotalQuantity,
                UsageCount = e.TotalQuantity - e.AvailableQuantity,
                UsageRate = e.TotalQuantity > 0 ? Math.Round((decimal)(e.TotalQuantity - e.AvailableQuantity) / e.TotalQuantity * 100, 2) : 0
            })
            .ToList();

        return new EquipmentStatistics
        {
            UtilizationRate = utilizationRate,
            TotalEquipment = totalEquipment,
            AvailableEquipment = equipment.Count(e => e.AvailableQuantity > 0),
            MaintenanceEquipment = equipment.Count(e => e.MaintenanceQuantity > 0),
            TotalReservations = totalReservations,
            ApprovedReservations = approvedReservations,
            OverdueCount = overdueCount,
            UsageRanking = usageRanking
        };
    }
}

public class ReservationResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public int ReservationId { get; set; }
    public bool HasConflict { get; set; }
    public List<EquipmentReservation>? ConflictingReservations { get; set; }
}

public class SuggestedTimeSlot
{
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public int AvailableQuantity { get; set; }
    public int DurationHours { get; set; }
}
