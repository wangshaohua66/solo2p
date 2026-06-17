using BloodCenter.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BloodCenter.Infrastructure.Data.Configurations;

public class ScrapRecordConfiguration : IEntityTypeConfiguration<ScrapRecord>
{
    public void Configure(EntityTypeBuilder<ScrapRecord> builder)
    {
        builder.ToTable("ScrapRecords");
        builder.HasKey(sr => sr.Id);
        builder.HasIndex(sr => sr.BloodProductId);
        builder.HasIndex(sr => sr.Reason);
        builder.HasIndex(sr => sr.ScrapDate);
        builder.HasIndex(sr => sr.OperatorId);
        builder.HasIndex(sr => sr.IsDeleted);
        builder.HasIndex(sr => new { sr.Reason, sr.ScrapDate });

        builder.Property(sr => sr.DetailedReason).HasMaxLength(1000);
        builder.Property(sr => sr.DisposalMethod).HasMaxLength(200);
        builder.Property(sr => sr.Notes).HasMaxLength(1000);

        builder.HasOne(sr => sr.BloodProduct)
            .WithMany(bp => bp.ScrapRecords)
            .HasForeignKey(sr => sr.BloodProductId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(sr => sr.Operator)
            .WithMany()
            .HasForeignKey(sr => sr.OperatorId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(sr => sr.ApprovedBy)
            .WithMany()
            .HasForeignKey(sr => sr.ApprovedById)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasQueryFilter(sr => !sr.IsDeleted);
    }
}
