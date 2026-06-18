using ElderlyCareSystem.Models;
using ElderlyCareSystem.Repositories;

namespace ElderlyCareSystem.Services;

public interface IMedicationService
{
    Task<List<MedicationRecord>> GetAllAsync(string? facilityId = null);
    Task<MedicationRecord?> GetByIdAsync(string id);
    Task<MedicationRecord> CreateAsync(MedicationRecord record);
    Task UpdateAsync(string id, MedicationRecord record);
    Task DeleteAsync(string id);
    Task<List<MedicationRecord>> GetByElderlyIdAsync(string elderlyId);
    Task<List<MedicationRecord>> GetActiveByElderlyIdAsync(string elderlyId);
    Task<List<MedicationRecord>> GetByDateAsync(DateTime date, string? facilityId = null);
    Task<bool> AdministerMedicationAsync(string recordId, AdministrationLog log, string administeredBy, string administeredById);
    Task<bool> MarkMissedAsync(string recordId, DateTime date, TimeSpan scheduledTime, string? reason);
    Task<List<MedicationAlert>> GetActiveAlertsAsync(string? facilityId = null);
    Task<bool> AcknowledgeAlertAsync(string recordId, string alertId, string acknowledgedBy);
    Task<List<MedicationPrescription>> GetAllPrescriptionsAsync(string? facilityId = null);
    Task<MedicationPrescription?> GetPrescriptionByIdAsync(string id);
    Task<MedicationPrescription> CreatePrescriptionAsync(MedicationPrescription prescription);
    Task<List<MedicationRecord>> GenerateFromPrescriptionAsync(string prescriptionId);
    Task<List<MedicationRecord>> GetTodayMedicationListAsync(string? facilityId = null);
    Task<List<MedicationRecord>> GetPendingNowAsync(string? facilityId = null);
    Task<MedicationComplianceReport> GetComplianceReportAsync(string elderlyId, DateTime startDate, DateTime endDate);
    Task<(int total, int administered, int missed, int late)> GetDailyStatsAsync(DateTime date, string? facilityId = null);
    Task<bool> CheckMissedDosesAsync(int timeoutMinutes = 30);
}

public class MedicationService : IMedicationService
{
    private readonly IMedicationRepository _repository;

    public MedicationService(IMedicationRepository repository)
    {
        _repository = repository;
    }

    public async Task<List<MedicationRecord>> GetAllAsync(string? facilityId = null)
    {
        return await _repository.GetAllAsync(facilityId);
    }

    public async Task<MedicationRecord?> GetByIdAsync(string id)
    {
        return await _repository.GetByIdAsync(id);
    }

    public async Task<MedicationRecord> CreateAsync(MedicationRecord record)
    {
        if (record.EndDate < record.StartDate)
            throw new ArgumentException("结束日期不能早于开始日期");
        if (record.AdministrationTimes == null || record.AdministrationTimes.Count == 0)
            throw new ArgumentException("至少需要设置一个服药时间");
        return await _repository.CreateAsync(record);
    }

    public async Task UpdateAsync(string id, MedicationRecord record)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null) throw new KeyNotFoundException($"用药记录 {id} 不存在");
        record.Id = id;
        record.CreatedAt = existing.CreatedAt;
        await _repository.UpdateAsync(id, record);
    }

    public async Task DeleteAsync(string id)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null) throw new KeyNotFoundException($"用药记录 {id} 不存在");
        await _repository.DeleteAsync(id);
    }

    public async Task<List<MedicationRecord>> GetByElderlyIdAsync(string elderlyId)
    {
        return await _repository.GetByElderlyIdAsync(elderlyId);
    }

    public async Task<List<MedicationRecord>> GetActiveByElderlyIdAsync(string elderlyId)
    {
        return await _repository.GetActiveByElderlyIdAsync(elderlyId);
    }

    public async Task<List<MedicationRecord>> GetByDateAsync(DateTime date, string? facilityId = null)
    {
        return await _repository.GetByDateAsync(date, facilityId);
    }

    public async Task<bool> AdministerMedicationAsync(string recordId, AdministrationLog log, string administeredBy, string administeredById)
    {
        var record = await _repository.GetByIdAsync(recordId);
        if (record == null) throw new KeyNotFoundException("用药记录不存在");
        if (record.Status != "Active") throw new InvalidOperationException($"用药状态为 {record.Status}，无法给药");

        log.Status = "Administered";
        log.ActualTime = DateTime.UtcNow;
        log.AdministeredBy = administeredBy;
        log.AdministeredById = administeredById;
        log.IsMissed = false;

        var scheduledDateTime = log.AdministrationDate.Date.Add(log.ScheduledTime);
        var lateMinutes = (int)(DateTime.UtcNow - scheduledDateTime).TotalMinutes;
        if (lateMinutes > 30)
        {
            log.IsLate = true;
            log.LateMinutes = lateMinutes;
        }

        await _repository.AddAdministrationLogAsync(recordId, log);
        return true;
    }

    public async Task<bool> MarkMissedAsync(string recordId, DateTime date, TimeSpan scheduledTime, string? reason)
    {
        var record = await _repository.GetByIdAsync(recordId);
        if (record == null) throw new KeyNotFoundException("用药记录不存在");

        var log = new AdministrationLog
        {
            AdministrationDate = date.Date,
            ScheduledTime = scheduledTime,
            Status = "Missed",
            IsMissed = true,
            Notes = reason ?? "漏服"
        };

        await _repository.AddAdministrationLogAsync(recordId, log);

        var alert = new MedicationAlert
        {
            AlertType = "MissedDose",
            Message = $"{record.ElderlyName} 漏服 {record.DrugName} ({record.Dosage}) - 计划时间 {scheduledTime:hh\\:mm}",
            Severity = "Warning"
        };
        await _repository.AddAlertAsync(recordId, alert);
        return true;
    }

    public async Task<List<MedicationAlert>> GetActiveAlertsAsync(string? facilityId = null)
    {
        var records = await _repository.GetAllAsync(facilityId);
        var alerts = new List<MedicationAlert>();
        foreach (var r in records)
        {
            alerts.AddRange(r.Alerts.Where(a => !a.IsAcknowledged));
        }
        return alerts.OrderByDescending(a => a.AlertTime).ToList();
    }

    public async Task<bool> AcknowledgeAlertAsync(string recordId, string alertId, string acknowledgedBy)
    {
        var record = await _repository.GetByIdAsync(recordId);
        if (record == null) throw new KeyNotFoundException("用药记录不存在");

        var alert = record.Alerts.FirstOrDefault(a => a.AlertId == alertId);
        if (alert == null) throw new KeyNotFoundException("告警不存在");

        alert.IsAcknowledged = true;
        alert.AcknowledgedBy = acknowledgedBy;
        alert.AcknowledgedAt = DateTime.UtcNow;
        record.UpdatedAt = DateTime.UtcNow;
        await _repository.UpdateAsync(recordId, record);
        return true;
    }

    public async Task<List<MedicationPrescription>> GetAllPrescriptionsAsync(string? facilityId = null)
    {
        return await _repository.GetAllPrescriptionsAsync(facilityId);
    }

    public async Task<MedicationPrescription?> GetPrescriptionByIdAsync(string id)
    {
        return await _repository.GetPrescriptionByIdAsync(id);
    }

    public async Task<MedicationPrescription> CreatePrescriptionAsync(MedicationPrescription prescription)
    {
        prescription.PrescriptionNumber = $"RX{DateTime.Now:yyyyMMdd}{new Random().Next(1000, 9999)}";
        return await _repository.CreatePrescriptionAsync(prescription);
    }

    public async Task<List<MedicationRecord>> GenerateFromPrescriptionAsync(string prescriptionId)
    {
        var prescription = await _repository.GetPrescriptionByIdAsync(prescriptionId);
        if (prescription == null) throw new KeyNotFoundException("处方不存在");

        var records = new List<MedicationRecord>();
        foreach (var item in prescription.Medications)
        {
            var record = new MedicationRecord
            {
                ElderlyId = prescription.ElderlyId,
                ElderlyName = prescription.ElderlyName,
                PrescriptionId = prescription.Id,
                DrugName = item.DrugName,
                GenericName = item.GenericName,
                Dosage = item.Dosage,
                Frequency = item.Frequency,
                Route = item.Route,
                AdministrationTimes = item.AdministrationTimes.Select(t => new AdministrationTime
                {
                    ScheduledTime = t,
                    Description = item.Instructions ?? string.Empty
                }).ToList(),
                StartDate = item.StartDate,
                EndDate = item.EndDate,
                PrescribingDoctor = prescription.DoctorName,
                Notes = item.Instructions,
                Status = "Active"
            };
            records.Add(await _repository.CreateAsync(record));
        }
        return records;
    }

    public async Task<List<MedicationRecord>> GetTodayMedicationListAsync(string? facilityId = null)
    {
        return await _repository.GetByDateAsync(DateTime.Today, facilityId);
    }

    public async Task<List<MedicationRecord>> GetPendingNowAsync(string? facilityId = null)
    {
        var todayRecords = await GetTodayMedicationListAsync(facilityId);
        var now = DateTime.UtcNow.TimeOfDay;
        var windowStart = now.Subtract(TimeSpan.FromMinutes(30));
        var windowEnd = now.Add(TimeSpan.FromMinutes(30));

        var pending = new List<MedicationRecord>();
        foreach (var record in todayRecords)
        {
            var todayLogs = record.AdministrationLogs.Where(l => l.AdministrationDate.Date == DateTime.Today).ToList();
            var pendingTimes = record.AdministrationTimes.Where(at =>
            {
                if (at.ScheduledTime >= windowStart && at.ScheduledTime <= windowEnd)
                {
                    var administered = todayLogs.Any(l => l.ScheduledTime == at.ScheduledTime && l.Status == "Administered");
                    return !administered;
                }
                return false;
            }).ToList();

            if (pendingTimes.Any())
            {
                pending.Add(record);
            }
        }
        return pending;
    }

    public async Task<MedicationComplianceReport> GetComplianceReportAsync(string elderlyId, DateTime startDate, DateTime endDate)
    {
        return await _repository.GetComplianceReportAsync(elderlyId, startDate, endDate);
    }

    public async Task<(int total, int administered, int missed, int late)> GetDailyStatsAsync(DateTime date, string? facilityId = null)
    {
        return await _repository.GetDailyStatsAsync(date, facilityId);
    }

    public async Task<bool> CheckMissedDosesAsync(int timeoutMinutes = 30)
    {
        var today = DateTime.Today;
        var now = DateTime.UtcNow.TimeOfDay;
        var records = await GetTodayMedicationListAsync();

        foreach (var record in records)
        {
            var todayLogs = record.AdministrationLogs.Where(l => l.AdministrationDate.Date == today).ToList();
            foreach (var time in record.AdministrationTimes)
            {
                var cutoff = time.ScheduledTime.Add(TimeSpan.FromMinutes(timeoutMinutes));
                if (now > cutoff)
                {
                    var hasLog = todayLogs.Any(l => l.ScheduledTime == time.ScheduledTime);
                    if (!hasLog)
                    {
                        await MarkMissedAsync(record.Id, today, time.ScheduledTime, "超时未确认");
                    }
                }
            }
        }
        return true;
    }
}
