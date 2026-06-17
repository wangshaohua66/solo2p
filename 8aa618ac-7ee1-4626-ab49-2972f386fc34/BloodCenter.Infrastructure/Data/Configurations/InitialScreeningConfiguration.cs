using BloodCenter.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BloodCenter.Infrastructure.Data.Configurations;

public class InitialScreeningConfiguration : IEntityTypeConfiguration<InitialScreening>
{
    public void Configure(EntityTypeBuilder<InitialScreening> builder)
    {
        builder.ToTable("InitialScreenings");
        builder.HasKey(s => s.Id);
        builder.HasIndex(s => s.DonationId);
        builder.HasIndex(s => s.TechnicianId);
        builder.HasIndex(s => s.ScreeningTime);
        builder.HasIndex(s => s.Passed);
        builder.HasIndex(s => s.IsDeleted);

        builder.Property(s => s.Hemoglobin).HasColumnType("decimal(10,2)");
        builder.Property(s => s.ALT).HasColumnType("decimal(10,2)");
        builder.Property(s => s.FailureReason).HasMaxLength(500);
        builder.Property(s => s.Notes).HasMaxLength(1000);

        builder.HasOne(s => s.Donation)
            .WithMany(d => d.InitialScreenings)
            .HasForeignKey(s => s.DonationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.Technician)
            .WithMany()
            .HasForeignKey(s => s.TechnicianId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasQueryFilter(s => !s.IsDeleted);
    }
}
