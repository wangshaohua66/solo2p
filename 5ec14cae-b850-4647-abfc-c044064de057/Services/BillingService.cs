using ElderlyCareSystem.Models;
using ElderlyCareSystem.Repositories;

namespace ElderlyCareSystem.Services;

public interface IBillingService
{
    Task<List<Bill>> GetAllAsync(string? facilityId = null);
    Task<Bill?> GetByIdAsync(string id);
    Task<Bill> CreateAsync(Bill bill);
    Task UpdateAsync(string id, Bill bill);
    Task DeleteAsync(string id);
    Task<List<Bill>> GetByElderlyIdAsync(string elderlyId);
    Task<List<Bill>> GetByPeriodAsync(string period, string? facilityId = null);
    Task<List<Bill>> GetByPaymentStatusAsync(string status, string? facilityId = null);
    Task<bool> AddPaymentAsync(string billId, PaymentRecord payment);
    Task<bool> AddReimbursementDocAsync(string billId, ReimbursementDocument doc);
    Task<BillingSummary> GetBillingSummaryAsync(string period, string? facilityId = null);
    Task<List<Bill>> GenerateMonthlyBillsAsync(int year, int month, string? facilityId = null);
    Task<List<BillItem>> AutoGenerateBillItemsAsync(string elderlyId, int year, int month);
    Task<byte[]> ExportReimbursementPackageAsync(string billId);
    Task<List<BillingSummary>> GetYearlySummaryAsync(int year, string? facilityId = null);
    Task<List<Bill>> GetOverdueBillsAsync(string? facilityId = null);
    Task<bool> SendPaymentReminderAsync(string billId);
}

public class BillingService : IBillingService
{
    private readonly IBillingRepository _repository;
    private readonly IBedRepository _bedRepository;
    private readonly IElderlyRepository _elderlyRepository;

    public BillingService(
        IBillingRepository repository,
        IBedRepository bedRepository,
        IElderlyRepository elderlyRepository)
    {
        _repository = repository;
        _bedRepository = bedRepository;
        _elderlyRepository = elderlyRepository;
    }

    public async Task<List<Bill>> GetAllAsync(string? facilityId = null)
    {
        return await _repository.GetAllAsync(facilityId);
    }

    public async Task<Bill?> GetByIdAsync(string id)
    {
        return await _repository.GetByIdAsync(id);
    }

    public async Task<Bill> CreateAsync(Bill bill)
    {
        bill.BillNumber = $"BL{DateTime.Now:yyyyMMdd}{new Random().Next(1000, 9999)}";
        bill.IssueDate = DateTime.UtcNow;
        bill.Subtotal = bill.Items.Sum(i => i.Amount);
        bill.TotalAmount = bill.Subtotal - bill.DiscountAmount - bill.DepositApplied;
        bill.Balance = bill.TotalAmount - bill.PaidAmount;
        return await _repository.CreateAsync(bill);
    }

    public async Task UpdateAsync(string id, Bill bill)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null) throw new KeyNotFoundException($"账单 {id} 不存在");

        bill.Id = id;
        bill.CreatedAt = existing.CreatedAt;
        bill.Subtotal = bill.Items.Sum(i => i.Amount);
        bill.TotalAmount = bill.Subtotal - bill.DiscountAmount - bill.DepositApplied;
        bill.Balance = bill.TotalAmount - bill.PaidAmount;
        bill.BillNumber = existing.BillNumber;
        await _repository.UpdateAsync(id, bill);
    }

    public async Task DeleteAsync(string id)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null) throw new KeyNotFoundException($"账单 {id} 不存在");
        if (existing.PaidAmount > 0)
            throw new InvalidOperationException("账单已有支付记录，无法删除");
        await _repository.DeleteAsync(id);
    }

    public async Task<List<Bill>> GetByElderlyIdAsync(string elderlyId)
    {
        return await _repository.GetByElderlyIdAsync(elderlyId);
    }

    public async Task<List<Bill>> GetByPeriodAsync(string period, string? facilityId = null)
    {
        return await _repository.GetByPeriodAsync(period, facilityId);
    }

    public async Task<List<Bill>> GetByPaymentStatusAsync(string status, string? facilityId = null)
    {
        return await _repository.GetByPaymentStatusAsync(status, facilityId);
    }

    public async Task<bool> AddPaymentAsync(string billId, PaymentRecord payment)
    {
        if (payment.Amount <= 0) throw new ArgumentException("支付金额必须大于0");
        payment.PaymentDate = DateTime.UtcNow;
        await _repository.AddPaymentAsync(billId, payment);
        return true;
    }

    public async Task<bool> AddReimbursementDocAsync(string billId, ReimbursementDocument doc)
    {
        doc.UploadDate = DateTime.UtcNow;
        await _repository.AddReimbursementDocAsync(billId, doc);
        return true;
    }

    public async Task<BillingSummary> GetBillingSummaryAsync(string period, string? facilityId = null)
    {
        return await _repository.GetBillingSummaryAsync(period, facilityId);
    }

    public async Task<List<Bill>> GenerateMonthlyBillsAsync(int year, int month, string? facilityId = null)
    {
        var existingBills = await _repository.GenerateMonthlyBillsAsync(year, month, facilityId);
        if (existingBills.Any()) return existingBills;

        var elderlyList = await _elderlyRepository.GetAllAsync(facilityId);
        var activeElderly = elderlyList.Where(e => e.Status == "Active").ToList();
        var generatedBills = new List<Bill>();

        foreach (var elderly in activeElderly)
        {
            var items = await AutoGenerateBillItemsAsync(elderly.Id, year, month);
            if (!items.Any()) continue;

            var subtotal = items.Sum(i => i.Amount);
            var insuranceAmount = items.Sum(i => i.InsuranceCoveredAmount);
            var bill = new Bill
            {
                ElderlyId = elderly.Id,
                ElderlyName = elderly.Name,
                FacilityId = facilityId ?? elderly.FacilityId,
                BillingPeriod = $"{year}-{month:D2}",
                PeriodStartDate = new DateTime(year, month, 1),
                PeriodEndDate = new DateTime(year, month, DateTime.DaysInMonth(year, month)),
                DueDate = new DateTime(year, month, DateTime.DaysInMonth(year, month)).AddDays(10),
                Items = items,
                Subtotal = subtotal,
                InsuranceAmount = insuranceAmount,
                TotalAmount = subtotal,
                Balance = subtotal,
                BillingType = "Monthly"
            };
            generatedBills.Add(await _repository.CreateAsync(bill));
        }
        return generatedBills;
    }

    public async Task<List<BillItem>> AutoGenerateBillItemsAsync(string elderlyId, int year, int month)
    {
        var items = new List<BillItem>();
        var elderly = await _elderlyRepository.GetByIdAsync(elderlyId);
        if (elderly == null || string.IsNullOrEmpty(elderly.BedId)) return items;

        var bed = await _bedRepository.GetByIdAsync(elderly.BedId);
        if (bed == null) return items;

        var daysInMonth = DateTime.DaysInMonth(year, month);
        var occupiedDays = Math.Min(daysInMonth,
            (int)(new DateTime(year, month, daysInMonth) - (elderly.CheckInDate > new DateTime(year, month, 1)
                ? elderly.CheckInDate.Date
                : new DateTime(year, month, 1))).TotalDays + 1);

        var bedFee = bed.DailyRate * occupiedDays;
        items.Add(new BillItem
        {
            Category = "床位费",
            ItemName = $"{bed.CareZone} 床位费",
            Description = $"{bed.Building}-{bed.Floor}-{bed.RoomNumber}-{bed.BedNumber} × {occupiedDays}天",
            UnitPrice = bed.DailyRate,
            Quantity = occupiedDays,
            Amount = bedFee,
            IsInsuranceCovered = true,
            InsuranceCoveredAmount = Math.Round(bedFee * 0.7m, 2),
            SelfPayAmount = Math.Round(bedFee * 0.3m, 2),
            ServiceDate = new DateTime(year, month, 1)
        });

        var careFeeRate = elderly.CareLevel switch
        {
            "特级护理" => 300m,
            "一级护理" => 200m,
            "二级护理" => 150m,
            "三级护理" => 100m,
            _ => 80m
        };
        var careFee = careFeeRate * occupiedDays;
        items.Add(new BillItem
        {
            Category = "护理费",
            ItemName = $"{elderly.CareLevel} 护理费",
            Description = $"照护等级: {elderly.CareLevel}",
            UnitPrice = careFeeRate,
            Quantity = occupiedDays,
            Amount = careFee,
            IsInsuranceCovered = true,
            InsuranceCoveredAmount = Math.Round(careFee * 0.6m, 2),
            SelfPayAmount = Math.Round(careFee * 0.4m, 2),
            ServiceDate = new DateTime(year, month, 1)
        });

        var mealFee = 50m * occupiedDays;
        items.Add(new BillItem
        {
            Category = "餐费",
            ItemName = "每日三餐",
            Description = "早中晚三餐 + 加餐",
            UnitPrice = 50m,
            Quantity = occupiedDays,
            Amount = mealFee,
            IsInsuranceCovered = false,
            InsuranceCoveredAmount = 0,
            SelfPayAmount = mealFee,
            ServiceDate = new DateTime(year, month, 1)
        });

        foreach (var item in items)
        {
            item.InsuranceCoveredAmount = Math.Round(item.Amount * (item.IsInsuranceCovered ? 0.65m : 0), 2);
            item.SelfPayAmount = item.Amount - item.InsuranceCoveredAmount;
        }

        return items;
    }

    public async Task<byte[]> ExportReimbursementPackageAsync(string billId)
    {
        var bill = await _repository.GetByIdAsync(billId);
        if (bill == null) throw new KeyNotFoundException("账单不存在");
        return new byte[0];
    }

    public async Task<List<BillingSummary>> GetYearlySummaryAsync(int year, string? facilityId = null)
    {
        var summaries = new List<BillingSummary>();
        for (int month = 1; month <= 12; month++)
        {
            summaries.Add(await _repository.GetBillingSummaryAsync($"{year}-{month:D2}", facilityId));
        }
        return summaries;
    }

    public async Task<List<Bill>> GetOverdueBillsAsync(string? facilityId = null)
    {
        var bills = await _repository.GetAllAsync(facilityId);
        return bills.Where(b => b.DueDate < DateTime.UtcNow && b.Balance > 0)
            .OrderBy(b => b.DueDate).ToList();
    }

    public async Task<bool> SendPaymentReminderAsync(string billId)
    {
        var bill = await _repository.GetByIdAsync(billId);
        if (bill == null) throw new KeyNotFoundException("账单不存在");
        return true;
    }
}
