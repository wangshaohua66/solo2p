using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace ElderlyCareSystem.Models;

public class Bill
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    public string BillNumber { get; set; } = string.Empty;

    public string ElderlyId { get; set; } = string.Empty;

    public string ElderlyName { get; set; } = string.Empty;

    public string FacilityId { get; set; } = string.Empty;

    public string BillingPeriod { get; set; } = string.Empty;

    public DateTime PeriodStartDate { get; set; }

    public DateTime PeriodEndDate { get; set; }

    public DateTime IssueDate { get; set; }

    public DateTime DueDate { get; set; }

    public List<BillItem> Items { get; set; } = new();

    public decimal Subtotal { get; set; }

    public decimal InsuranceAmount { get; set; }

    public decimal DiscountAmount { get; set; }

    public decimal DepositApplied { get; set; }

    public decimal TotalAmount { get; set; }

    public decimal PaidAmount { get; set; }

    public decimal Balance { get; set; }

    public string PaymentStatus { get; set; } = "Unpaid";

    public string BillingType { get; set; } = string.Empty;

    public InsuranceInfo? Insurance { get; set; }

    public List<PaymentRecord> Payments { get; set; } = new();

    public List<ReimbursementDocument> ReimbursementDocs { get; set; } = new();

    public string? Notes { get; set; }

    public string CreatedBy { get; set; } = string.Empty;

    public DateTime? PaidDate { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class BillItem
{
    public string ItemId { get; set; } = ObjectId.GenerateNewId().ToString();

    public string Category { get; set; } = string.Empty;

    public string ItemName { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public decimal UnitPrice { get; set; }

    public int Quantity { get; set; }

    public decimal Amount { get; set; }

    public bool IsInsuranceCovered { get; set; }

    public decimal InsuranceCoveredAmount { get; set; }

    public decimal SelfPayAmount { get; set; }

    public string? ReferenceId { get; set; }

    public DateTime? ServiceDate { get; set; }
}

public class InsuranceInfo
{
    public string InsuranceType { get; set; } = string.Empty;

    public string PolicyNumber { get; set; } = string.Empty;

    public string InsuranceProvider { get; set; } = string.Empty;

    public decimal CoverageRate { get; set; }

    public decimal Deductible { get; set; }

    public decimal AnnualLimit { get; set; }

    public decimal UsedAmountThisYear { get; set; }
}

public class PaymentRecord
{
    public string PaymentId { get; set; } = ObjectId.GenerateNewId().ToString();

    public string BillId { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public string PaymentMethod { get; set; } = string.Empty;

    public DateTime PaymentDate { get; set; }

    public string? TransactionNumber { get; set; }

    public string PaidBy { get; set; } = string.Empty;

    public string? Notes { get; set; }
}

public class ReimbursementDocument
{
    public string DocId { get; set; } = ObjectId.GenerateNewId().ToString();

    public string DocType { get; set; } = string.Empty;

    public string FileName { get; set; } = string.Empty;

    public string FileUrl { get; set; } = string.Empty;

    public DateTime UploadDate { get; set; } = DateTime.UtcNow;

    public string UploadedBy { get; set; } = string.Empty;

    public string Status { get; set; } = "Pending";

    public string? VerificationNotes { get; set; }
}

public class BillingSummary
{
    public string Period { get; set; } = string.Empty;

    public int TotalBills { get; set; }

    public int PaidBills { get; set; }

    public int UnpaidBills { get; set; }

    public int OverdueBills { get; set; }

    public decimal TotalBilled { get; set; }

    public decimal TotalPaid { get; set; }

    public decimal TotalOutstanding { get; set; }

    public decimal CollectionRate { get; set; }

    public decimal InsuranceTotal { get; set; }

    public decimal SelfPayTotal { get; set; }
}
