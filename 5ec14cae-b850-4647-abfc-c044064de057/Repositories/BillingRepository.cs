using ElderlyCareSystem.Data;
using ElderlyCareSystem.Models;
using MongoDB.Driver;
using MongoDB.Bson;

namespace ElderlyCareSystem.Repositories;

public interface IBillingRepository
{
    Task<List<Bill>> GetAllAsync(string? facilityId = null);
    Task<Bill?> GetByIdAsync(string id);
    Task<Bill> CreateAsync(Bill bill);
    Task UpdateAsync(string id, Bill bill);
    Task DeleteAsync(string id);
    Task<List<Bill>> GetByElderlyIdAsync(string elderlyId);
    Task<List<Bill>> GetByPeriodAsync(string period, string? facilityId = null);
    Task<List<Bill>> GetByPaymentStatusAsync(string status, string? facilityId = null);
    Task AddPaymentAsync(string billId, PaymentRecord payment);
    Task AddReimbursementDocAsync(string billId, ReimbursementDocument doc);
    Task<BillingSummary> GetBillingSummaryAsync(string period, string? facilityId = null);
    Task<List<Bill>> GenerateMonthlyBillsAsync(int year, int month, string? facilityId = null);
    Task<Bill?> GetByBillNumberAsync(string billNumber);
}

public class BillingRepository : IBillingRepository
{
    private readonly MongoDbContext _context;

    public BillingRepository(MongoDbContext context)
    {
        _context = context;
    }

    public async Task<List<Bill>> GetAllAsync(string? facilityId = null)
    {
        var filter = Builders<Bill>.Filter.Empty;
        if (!string.IsNullOrEmpty(facilityId))
        {
            filter = Builders<Bill>.Filter.Eq(x => x.FacilityId, facilityId);
        }
        return await _context.Bills.Find(filter).SortByDescending(x => x.IssueDate).ToListAsync();
    }

    public async Task<Bill?> GetByIdAsync(string id)
    {
        var filter = Builders<Bill>.Filter.Eq(x => x.Id, id);
        return await _context.Bills.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<Bill> CreateAsync(Bill bill)
    {
        bill.Id = ObjectId.GenerateNewId().ToString();
        bill.CreatedAt = DateTime.UtcNow;
        bill.UpdatedAt = DateTime.UtcNow;
        bill.Balance = bill.TotalAmount - bill.PaidAmount;
        await _context.Bills.InsertOneAsync(bill);
        return bill;
    }

    public async Task UpdateAsync(string id, Bill bill)
    {
        bill.UpdatedAt = DateTime.UtcNow;
        bill.Balance = bill.TotalAmount - bill.PaidAmount;
        var filter = Builders<Bill>.Filter.Eq(x => x.Id, id);
        await _context.Bills.ReplaceOneAsync(filter, bill);
    }

    public async Task DeleteAsync(string id)
    {
        var filter = Builders<Bill>.Filter.Eq(x => x.Id, id);
        await _context.Bills.DeleteOneAsync(filter);
    }

    public async Task<List<Bill>> GetByElderlyIdAsync(string elderlyId)
    {
        var filter = Builders<Bill>.Filter.Eq(x => x.ElderlyId, elderlyId);
        return await _context.Bills.Find(filter).SortByDescending(x => x.IssueDate).ToListAsync();
    }

    public async Task<List<Bill>> GetByPeriodAsync(string period, string? facilityId = null)
    {
        var filters = new List<FilterDefinition<Bill>>
        {
            Builders<Bill>.Filter.Eq(x => x.BillingPeriod, period)
        };
        if (!string.IsNullOrEmpty(facilityId))
        {
            filters.Add(Builders<Bill>.Filter.Eq(x => x.FacilityId, facilityId));
        }
        var filter = Builders<Bill>.Filter.And(filters);
        return await _context.Bills.Find(filter).ToListAsync();
    }

    public async Task<List<Bill>> GetByPaymentStatusAsync(string status, string? facilityId = null)
    {
        var filters = new List<FilterDefinition<Bill>>
        {
            Builders<Bill>.Filter.Eq(x => x.PaymentStatus, status)
        };
        if (!string.IsNullOrEmpty(facilityId))
        {
            filters.Add(Builders<Bill>.Filter.Eq(x => x.FacilityId, facilityId));
        }
        var filter = Builders<Bill>.Filter.And(filters);
        return await _context.Bills.Find(filter).SortBy(x => x.DueDate).ToListAsync();
    }

    public async Task AddPaymentAsync(string billId, PaymentRecord payment)
    {
        payment.PaymentId = ObjectId.GenerateNewId().ToString();
        var bill = await GetByIdAsync(billId);
        if (bill != null)
        {
            bill.PaidAmount += payment.Amount;
            bill.Balance = bill.TotalAmount - bill.PaidAmount;
            if (bill.Balance <= 0)
            {
                bill.PaymentStatus = "Paid";
                bill.PaidDate = payment.PaymentDate;
            }
            else if (bill.PaidAmount > 0)
            {
                bill.PaymentStatus = "Partial";
            }
            bill.UpdatedAt = DateTime.UtcNow;

            var filter = Builders<Bill>.Filter.Eq(x => x.Id, billId);
            var update = Builders<Bill>.Update
                .Push(x => x.Payments, payment)
                .Set(x => x.PaidAmount, bill.PaidAmount)
                .Set(x => x.Balance, bill.Balance)
                .Set(x => x.PaymentStatus, bill.PaymentStatus)
                .Set(x => x.PaidDate, bill.PaidDate)
                .Set(x => x.UpdatedAt, bill.UpdatedAt);

            await _context.Bills.UpdateOneAsync(filter, update);
        }
    }

    public async Task AddReimbursementDocAsync(string billId, ReimbursementDocument doc)
    {
        doc.DocId = ObjectId.GenerateNewId().ToString();
        var filter = Builders<Bill>.Filter.Eq(x => x.Id, billId);
        var update = Builders<Bill>.Update.Push(x => x.ReimbursementDocs, doc);
        await _context.Bills.UpdateOneAsync(filter, update);
    }

    public async Task<BillingSummary> GetBillingSummaryAsync(string period, string? facilityId = null)
    {
        var bills = await GetByPeriodAsync(period, facilityId);
        var summary = new BillingSummary
        {
            Period = period,
            TotalBills = bills.Count,
            PaidBills = bills.Count(b => b.PaymentStatus == "Paid"),
            UnpaidBills = bills.Count(b => b.PaymentStatus == "Unpaid" || b.PaymentStatus == "Partial"),
            OverdueBills = bills.Count(b => b.DueDate < DateTime.Now && b.Balance > 0),
            TotalBilled = bills.Sum(b => b.Subtotal),
            TotalPaid = bills.Sum(b => b.PaidAmount),
            TotalOutstanding = bills.Sum(b => b.Balance),
            InsuranceTotal = bills.Sum(b => b.InsuranceAmount),
            SelfPayTotal = bills.Sum(b => b.TotalAmount - b.InsuranceAmount)
        };
        summary.CollectionRate = summary.TotalBilled > 0
            ? Math.Round(summary.TotalPaid / summary.TotalBilled * 100, 2)
            : 0;
        return summary;
    }

    public async Task<List<Bill>> GenerateMonthlyBillsAsync(int year, int month, string? facilityId = null)
    {
        var period = $"{year}-{month:D2}";
        var existingBills = await GetByPeriodAsync(period, facilityId);
        if (existingBills.Any()) return existingBills;

        var generatedBills = new List<Bill>();
        return generatedBills;
    }

    public async Task<Bill?> GetByBillNumberAsync(string billNumber)
    {
        var filter = Builders<Bill>.Filter.Eq(x => x.BillNumber, billNumber);
        return await _context.Bills.Find(filter).FirstOrDefaultAsync();
    }
}
