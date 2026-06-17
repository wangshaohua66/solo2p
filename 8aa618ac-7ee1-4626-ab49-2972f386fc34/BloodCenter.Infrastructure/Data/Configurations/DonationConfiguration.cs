using BloodCenter.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BloodCenter.Infrastructure.Data.Configurations;

public class DonationConfiguration : IEntityTypeConfiguration<Donation>
{
    public void Configure(EntityTypeBuilder<Donation> builder)
    {
        builder.ToTable("Donations");
        builder.HasKey(d => d.Id);
        builder.HasIndex(d => d.DonationNumber).IsUnique();
        builder.HasIndex(d => d.DonorId);
        builder.HasIndex(d => d.DonationDate);
        builder.HasIndex(d => d.Status);
        builder.HasIndex(d => d.CollectionSiteId);
        builder.HasIndex(d => d.NurseId);
        builder.HasIndex(d => d.IsDeleted);
        builder.HasIndex(d => new { d.DonorId, d.DonationDate });

        builder.Property(d => d.DonationNumber).IsRequired().HasMaxLength(50);
        builder.Property(d => d.Volume).IsRequired();
        builder.Property(d => d.Arm).HasMaxLength(10);
        builder.Property(d => d.Reaction).HasMaxLength(500);
        builder.Property(d => d.Notes).HasMaxLength(1000);
        builder.Property(d => d.InitialScreeningFailureReason).HasMaxLength(500);
        builder.Property(d => d.QuarantineReason).HasMaxLength(500);

        builder.OwnsOne(d => d.BloodGroup, bg =>
        {
            bg.Property(x => x.ABO).IsRequired();
            bg.Property(x => x.Rh).IsRequired();
        });

        builder.HasOne(d => d.Donor)
            .WithMany(d => d.Donations)
            .HasForeignKey(d => d.DonorId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(d => d.CollectionSite)
            .WithMany(cs => cs.Donations)
            .HasForeignKey(d => d.CollectionSiteId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(d => d.Nurse)
            .WithMany()
            .HasForeignKey(d => d.NurseId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(d => d.InitialScreenings)
            .WithOne(s => s.Donation)
            .HasForeignKey(s => s.DonationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(d => d.BloodTests)
            .WithOne(bt => bt.Donation)
            .HasForeignKey(bt => bt.DonationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(d => d.BloodProducts)
            .WithOne(bp => bp.Donation)
            .HasForeignKey(bp => bp.DonationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasQueryFilter(d => !d.IsDeleted);
    }
}
