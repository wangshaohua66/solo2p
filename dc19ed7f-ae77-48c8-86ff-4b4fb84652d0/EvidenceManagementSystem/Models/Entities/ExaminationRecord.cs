namespace EvidenceManagementSystem.Models.Entities;

public class ExaminationRecord
{
    public Guid Id { get; set; }
    public Guid ExaminationTaskId { get; set; }
    public int RoundNumber { get; set; }
    public string RecordContent { get; set; } = string.Empty;
    public string? InstrumentUsed { get; set; }
    public string? AnalysisData { get; set; }
    public string? ImageHash { get; set; }
    public DateTime RecordedAt { get; set; } = DateTime.UtcNow;
    public Guid RecordedById { get; set; }

    public ExaminationTask ExaminationTask { get; set; } = null!;
}
