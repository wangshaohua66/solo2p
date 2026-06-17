using BloodCenter.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BloodCenter.Infrastructure.Data.Configurations;

public class CrossMatchConfiguration : IEntityTypeConfiguration<CrossMatch>
{
    public void Configure(EntityTypeBuilder<CrossMatch> builder)
    {
        builder.ToTable("CrossMatches");
        builder.HasKey(cm => cm.Id);
        builder.HasIndex(cm => cm.BloodRequestId);
        builder.HasIndex(cm => cm.BloodProductId);
        builder.HasIndex(cm => cm.TechnicianId);
        builder.HasIndex(cm => cm.OverallResult);
        builder.HasIndex(cm => cm.TestTime);
        builder.HasIndex(cm => cm.IsDeleted);
        builder.HasIndex(cm => new { cm.BloodRequestId, cm.OverallResult });

        builder.Property(cm => cm.TestMethod).HasMaxLength(200);
        builder.Property(cm => cm.ReagentUsed).HasMaxLength(200);
        builder.Property(cm => cm.IncubationTime).HasMaxLength(50);
        builder.Property(cm => cm.Temperature).HasMaxLength(50);
        builder.Property(cm => cm.Phases).HasMaxLength(100);
        builder.Property(cm => cm.AntiHumanGlobulin).HasMaxLength(50);
        builder.Property(cm => cm.Notes).HasMaxLength(1000);

        builder.HasOne(cm => cm.BloodRequest)
            .WithMany(br => br.CrossMatches)
            .HasForeignKey(cm => cm.BloodRequestId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(cm => cm.BloodProduct)
            .WithMany(bp => bp.CrossMatches)
            .HasForeignKey(cm => cm.BloodProductId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(cm => cm.Technician)
            .WithMany()
            .HasForeignKey(cm => cm.TechnicianId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasQueryFilter(cm => !cm.IsDeleted);
    }
}
