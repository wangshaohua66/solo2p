using BloodCenter.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BloodCenter.Infrastructure.Data.Configurations;

public class BloodTestConfiguration : IEntityTypeConfiguration<BloodTest>
{
    public void Configure(EntityTypeBuilder<BloodTest> builder)
    {
        builder.ToTable("BloodTests");
        builder.HasKey(bt => bt.Id);
        builder.HasIndex(bt => bt.DonationId);
        builder.HasIndex(bt => bt.TechnicianId);
        builder.HasIndex(bt => bt.TestType);
        builder.HasIndex(bt => bt.TestItem);
        builder.HasIndex(bt => bt.Result);
        builder.HasIndex(bt => bt.TestTime);
        builder.HasIndex(bt => bt.IsDeleted);
        builder.HasIndex(bt => new { bt.DonationId, bt.TestType, bt.TestItem });
        builder.HasIndex(bt => new { bt.Result, bt.TestTime });

        builder.Property(bt => bt.TestMethod).HasMaxLength(200);
        builder.Property(bt => bt.InstrumentUsed).HasMaxLength(200);
        builder.Property(bt => bt.ReagentLot).HasMaxLength(100);
        builder.Property(bt => bt.Unit).HasMaxLength(50);
        builder.Property(bt => bt.ReferenceRange).HasMaxLength(100);
        builder.Property(bt => bt.Notes).HasMaxLength(1000);
        builder.Property(bt => bt.ReviewComment).HasMaxLength(1000);

        builder.HasOne(bt => bt.Donation)
            .WithMany(d => d.BloodTests)
            .HasForeignKey(bt => bt.DonationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(bt => bt.Technician)
            .WithMany()
            .HasForeignKey(bt => bt.TechnicianId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(bt => bt.SecondReviewer)
            .WithMany()
            .HasForeignKey(bt => bt.SecondReviewerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasQueryFilter(bt => !bt.IsDeleted);
    }
}
