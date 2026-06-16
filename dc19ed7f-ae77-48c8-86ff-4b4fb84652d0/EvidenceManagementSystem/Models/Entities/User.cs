using EvidenceManagementSystem.Models.Enums;

namespace EvidenceManagementSystem.Models.Entities;

public class User
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string RealName { get; set; } = string.Empty;
    public string EmployeeId { get; set; } = string.Empty;
    public string? Department { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public UserRole Role { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiry { get; set; }

    public ICollection<ChainRecord> ChainRecords { get; set; } = new List<ChainRecord>();
    public ICollection<ExaminationTask> ExaminationTasksAsExaminer { get; set; } = new List<ExaminationTask>();
    public ICollection<ExaminationTask> ExaminationTasksAsReviewer { get; set; } = new List<ExaminationTask>();
}
