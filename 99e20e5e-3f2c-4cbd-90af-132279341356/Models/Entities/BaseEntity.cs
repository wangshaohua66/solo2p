namespace FireIoTPlatform.Models.Entities;

public abstract class BaseEntity
{
    public long Id { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime? UpdatedAt { get; set; }
    public bool IsDeleted { get; set; } = false;
}
