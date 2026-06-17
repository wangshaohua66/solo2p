using BloodCenter.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BloodCenter.Infrastructure.Data.Configurations;

public class BloodProductConfiguration : IEntityTypeConfiguration<BloodProduct>
{
    public void Configure(EntityTypeBuilder<BloodProduct> builder)
    {
        builder.ToTable("BloodProducts");
        builder.HasKey(bp => bp.Id);
        builder.HasIndex(bp => bp.ProductCode).IsUnique();
        builder.HasIndex(bp => bp.DonationId);
        builder.HasIndex(bp => bp.ProductType);
        builder.HasIndex(bp => bp.Status);
        builder.HasIndex(bp => bp.ExpiryDate);
        builder.HasIndex(bp => bp.StorageLocation);
        builder.HasIndex(bp => bp.IsDeleted);
        builder.HasIndex(bp => new { bp.ProductType, bp.Status, bp.ExpiryDate });
        builder.HasIndex(bp => new { bp.Status, bp.ExpiryDate });

        builder.Property(bp => bp.ProductCode).IsRequired().HasMaxLength(50);
        builder.Property(bp => bp.Volume).IsRequired();
        builder.Property(bp => bp.Unit).IsRequired().HasMaxLength(20);
        builder.Property(bp => bp.StorageLocation).HasMaxLength(100);
        builder.Property(bp => bp.StorageTemperature).HasMaxLength(50);
        builder.Property(bp => bp.SpecialProductReason).HasMaxLength(500);
        builder.Property(bp => bp.PreparationMethod).HasMaxLength(500);
        builder.Property(bp => bp.BatchNumber).HasMaxLength(100);

        builder.OwnsOne(bp => bp.BloodGroup, bg =>
        {
            bg.Property(x => x.ABO).IsRequired();
            bg.Property(x => x.Rh).IsRequired();
            bg.HasIndex(x => x.ABO);
            bg.HasIndex(x => x.Rh);
        });

        builder.HasOne(bp => bp.Donation)
            .WithMany(d => d.BloodProducts)
            .HasForeignKey(bp => bp.DonationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(bp => bp.PreparedBy)
            .WithMany()
            .HasForeignKey(bp => bp.PreparedById)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(bp => bp.ScrapRecords)
            .WithOne(sr => sr.BloodProduct)
            .HasForeignKey(sr => sr.BloodProductId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(bp => bp.CrossMatches)
            .WithOne(cm => cm.BloodProduct)
            .HasForeignKey(cm => cm.BloodProductId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasQueryFilter(bp => !bp.IsDeleted);
    }
}
