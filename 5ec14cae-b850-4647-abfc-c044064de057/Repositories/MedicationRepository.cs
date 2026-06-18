using ElderlyCareSystem.Data;
using ElderlyCareSystem.Models;
using MongoDB.Driver;
using MongoDB.Bson;

namespace ElderlyCareSystem.Repositories;

public interface IMedicationRepository
{
    Task<List<MedicationRecord>> GetAllAsync(string? facilityId = null);
    Task<MedicationRecord?> GetByIdAsync(string id);
    Task<MedicationRecord> CreateAsync(MedicationRecord record);
    Task UpdateAsync(string id, MedicationRecord record);
    Task DeleteAsync(string id);
    Task<List<MedicationRecord>> GetByElderlyIdAsync(string elderlyId);
    Task<List<MedicationRecord>> GetActiveByElderlyIdAsync(string elderlyId);
    Task<List<MedicationRecord>> GetByDateAsync(DateTime date, string? facilityId = null);
    Task AddAdministrationLogAsync(string recordId, AdministrationLog log);
    Task AddAlertAsync(string recordId, MedicationAlert alert);
    Task<List<MedicationPrescription>> GetAllPrescriptionsAsync(string? facilityId = null);
    Task<MedicationPrescription?> GetPrescriptionByIdAsync(string id);
    Task<MedicationPrescription> CreatePrescriptionAsync(MedicationPrescription prescription);
    Task<List<MedicationRecord>> GenerateDailyMedicationListAsync(DateTime date, string? facilityId = null);
    Task<MedicationComplianceReport> GetComplianceReportAsync(string elderlyId, DateTime startDate, DateTime endDate);
    Task<(int total, int administered, int missed, int late)> GetDailyStatsAsync(DateTime date, string? facilityId = null);
}

public class MedicationRepository : IMedicationRepository
{
    private readonly MongoDbContext _context;

    public MedicationRepository(MongoDbContext context)
    {
        _context = context;
    }

    public async Task<List<MedicationRecord>> GetAllAsync(string? facilityId = null)
    {
        return await _context.MedicationRecords.Find(_ => true).SortByDescending(x => x.CreatedAt).ToListAsync();
    }

    public async Task<MedicationRecord?> GetByIdAsync(string id)
    {
        var filter = Builders<MedicationRecord>.Filter.Eq(x => x.Id, id);
        return await _context.MedicationRecords.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<MedicationRecord> CreateAsync(MedicationRecord record)
    {
        record.Id = ObjectId.GenerateNewId().ToString();
        record.CreatedAt = DateTime.UtcNow;
        record.UpdatedAt = DateTime.UtcNow;
        await _context.MedicationRecords.InsertOneAsync(record);
        return record;
    }

    public async Task UpdateAsync(string id, MedicationRecord record)
    {
        record.UpdatedAt = DateTime.UtcNow;
        var filter = Builders<MedicationRecord>.Filter.Eq(x => x.Id, id);
        await _context.MedicationRecords.ReplaceOneAsync(filter, record);
    }

    public async Task DeleteAsync(string id)
    {
        var filter = Builders<MedicationRecord>.Filter.Eq(x => x.Id, id);
        await _context.MedicationRecords.DeleteOneAsync(filter);
    }

    public async Task<List<MedicationRecord>> GetByElderlyIdAsync(string elderlyId)
    {
        var filter = Builders<MedicationRecord>.Filter.Eq(x => x.ElderlyId, elderlyId);
        return await _context.MedicationRecords.Find(filter).SortByDescending(x => x.CreatedAt).ToListAsync();
    }

    public async Task<List<MedicationRecord>> GetActiveByElderlyIdAsync(string elderlyId)
    {
        var now = DateTime.UtcNow;
        var filter = Builders<MedicationRecord>.Filter.And(
            Builders<MedicationRecord>.Filter.Eq(x => x.ElderlyId, elderlyId),
            Builders<MedicationRecord>.Filter.Eq(x => x.Status, "Active"),
            Builders<MedicationRecord>.Filter.Lte(x => x.StartDate, now),
            Builders<MedicationRecord>.Filter.Gte(x => x.EndDate, now)
        );
        return await _context.MedicationRecords.Find(filter).ToListAsync();
    }

    public async Task<List<MedicationRecord>> GetByDateAsync(DateTime date, string? facilityId = null)
    {
        var filter = Builders<MedicationRecord>.Filter.And(
            Builders<MedicationRecord>.Filter.Lte(x => x.StartDate, date.Date.AddDays(1).AddTicks(-1)),
            Builders<MedicationRecord>.Filter.Gte(x => x.EndDate, date.Date),
            Builders<MedicationRecord>.Filter.Eq(x => x.Status, "Active")
        );
        return await _context.MedicationRecords.Find(filter).ToListAsync();
    }

    public async Task AddAdministrationLogAsync(string recordId, AdministrationLog log)
    {
        log.LogId = ObjectId.GenerateNewId().ToString();
        var filter = Builders<MedicationRecord>.Filter.Eq(x => x.Id, recordId);
        var update = Builders<MedicationRecord>.Update
            .Push(x => x.AdministrationLogs, log)
            .Set(x => x.UpdatedAt, DateTime.UtcNow);
        await _context.MedicationRecords.UpdateOneAsync(filter, update);
    }

    public async Task AddAlertAsync(string recordId, MedicationAlert alert)
    {
        alert.AlertId = ObjectId.GenerateNewId().ToString();
        var filter = Builders<MedicationRecord>.Filter.Eq(x => x.Id, recordId);
        var update = Builders<MedicationRecord>.Update
            .Push(x => x.Alerts, alert)
            .Set(x => x.UpdatedAt, DateTime.UtcNow);
        await _context.MedicationRecords.UpdateOneAsync(filter, update);
    }

    public async Task<List<MedicationPrescription>> GetAllPrescriptionsAsync(string? facilityId = null)
    {
        return await _context.MedicationPrescriptions.Find(_ => true).SortByDescending(x => x.CreatedAt).ToListAsync();
    }

    public async Task<MedicationPrescription?> GetPrescriptionByIdAsync(string id)
    {
        var filter = Builders<MedicationPrescription>.Filter.Eq(x => x.Id, id);
        return await _context.MedicationPrescriptions.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<MedicationPrescription> CreatePrescriptionAsync(MedicationPrescription prescription)
    {
        prescription.Id = ObjectId.GenerateNewId().ToString();
        prescription.CreatedAt = DateTime.UtcNow;
        await _context.MedicationPrescriptions.InsertOneAsync(prescription);
        return prescription;
    }

    public async Task<List<MedicationRecord>> GenerateDailyMedicationListAsync(DateTime date, string? facilityId = null)
    {
        return await GetByDateAsync(date, facilityId);
    }

    public async Task<MedicationComplianceReport> GetComplianceReportAsync(string elderlyId, DateTime startDate, DateTime endDate)
    {
        var records = await _context.MedicationRecords.Find(
            Builders<MedicationRecord>.Filter.And(
                Builders<MedicationRecord>.Filter.Eq(x => x.ElderlyId, elderlyId),
                Builders<MedicationRecord>.Filter.Lte(x => x.StartDate, endDate),
                Builders<MedicationRecord>.Filter.Gte(x => x.EndDate, startDate)
            )
        ).ToListAsync();

        var report = new MedicationComplianceReport
        {
            ElderlyId = elderlyId,
            ReportStartDate = startDate,
            ReportEndDate = endDate,
            DailyBreakdown = new List<DailyCompliance>()
        };

        var dailyData = new Dictionary<DateTime, DailyCompliance>();

        foreach (var record in records)
        {
            foreach (var log in record.AdministrationLogs.Where(l =>
                l.AdministrationDate >= startDate && l.AdministrationDate <= endDate))
            {
                var dateKey = log.AdministrationDate.Date;
                if (!dailyData.ContainsKey(dateKey))
                {
                    dailyData[dateKey] = new DailyCompliance
                    {
                        Date = dateKey,
                        TotalDoses = 0,
                        AdministeredDoses = 0,
                        MissedDoses = 0
                    };
                }

                dailyData[dateKey].TotalDoses++;
                report.TotalDoses++;

                if (log.Status == "Administered")
                {
                    dailyData[dateKey].AdministeredDoses++;
                    report.AdministeredDoses++;
                }
                else if (log.IsMissed || log.Status == "Missed")
                {
                    dailyData[dateKey].MissedDoses++;
                    report.MissedDoses++;
                }
                if (log.IsLate) report.LateDoses++;
                if (log.Status == "Refused") report.RefusedDoses++;
            }
        }

        report.DailyBreakdown = dailyData.Values.OrderBy(d => d.Date).ToList();
        report.ComplianceRate = report.TotalDoses > 0
            ? (double)report.AdministeredDoses / report.TotalDoses * 100
            : 100;

        foreach (var day in report.DailyBreakdown)
        {
            day.Rate = day.TotalDoses > 0 ? (double)day.AdministeredDoses / day.TotalDoses * 100 : 100;
        }

        return report;
    }

    public async Task<(int total, int administered, int missed, int late)> GetDailyStatsAsync(DateTime date, string? facilityId = null)
    {
        var records = await GetByDateAsync(date, facilityId);
        int total = 0, administered = 0, missed = 0, late = 0;

        foreach (var record in records)
        {
            var todayLogs = record.AdministrationLogs.Where(l => l.AdministrationDate.Date == date.Date);
            foreach (var log in todayLogs)
            {
                total++;
                if (log.Status == "Administered") administered++;
                if (log.IsMissed || log.Status == "Missed") missed++;
                if (log.IsLate) late++;
            }
        }

        return (total, administered, missed, late);
    }
}
