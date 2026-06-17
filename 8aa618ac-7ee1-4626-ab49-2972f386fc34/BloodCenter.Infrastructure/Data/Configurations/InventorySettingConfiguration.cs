using BloodCenter.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BloodCenter.Infrastructure.Data.Configurations;

public class InventorySettingConfiguration : IEntityTypeConfiguration<InventorySetting>
{
    public void Configure(EntityTypeBuilder<InventorySetting> builder)
    {
        builder.ToTable("InventorySettings");
        builder.HasKey(s => s.Id);
        builder.HasIndex(s => new { s.ProductType, s.BloodType, s.RhFactor }).IsUnique();
        builder.HasIndex(s => s.IsDeleted);

        builder.Property(s => s.MinimumLevel).IsRequired();
        builder.Property(s => s.WarningLevel).IsRequired();
        builder.Property(s => s.EmergencyReserve).IsRequired();
        builder.Property(s => s.Notes).HasMaxLength(500);

        builder.HasQueryFilter(s => !s.IsDeleted);
    }
}
