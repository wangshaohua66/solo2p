using BloodCenter.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BloodCenter.Infrastructure.Data.Configurations;

public class DeferralSettingsConfiguration : IEntityTypeConfiguration<DeferralSettings>
{
    public void Configure(EntityTypeBuilder<DeferralSettings> builder)
    {
        builder.ToTable("DeferralSettings");
        builder.HasKey(s => s.Id);
        builder.HasIndex(s => s.Key).IsUnique();
        builder.HasIndex(s => s.IsDeleted);

        builder.Property(s => s.Key).IsRequired().HasMaxLength(50);
        builder.Property(s => s.MinimumHemoglobin).IsRequired().HasColumnType("decimal(18,2)");
        builder.Property(s => s.MaximumALT).IsRequired().HasColumnType("decimal(18,2)");
        builder.Property(s => s.LowHemoglobinDeferralDays).IsRequired();
        builder.Property(s => s.HighALTDeferralDays).IsRequired();
        builder.Property(s => s.HBsAgPermanentDeferral).IsRequired();
        builder.Property(s => s.DaysAfterSurgery).IsRequired();
        builder.Property(s => s.DaysAfterTransfusion).IsRequired();
        builder.Property(s => s.DaysAfterTattoo).IsRequired();
        builder.Property(s => s.DaysAfterDentalWork).IsRequired();
        builder.Property(s => s.DaysAfterVaccination).IsRequired();
        builder.Property(s => s.DaysAfterMalariaTravel).IsRequired();
        builder.Property(s => s.DaysPostPregnancy).IsRequired();
        builder.Property(s => s.DaysPostBreastfeeding).IsRequired();
        builder.Property(s => s.DaysAfterFever).IsRequired();
        builder.Property(s => s.DaysBetweenDonations).IsRequired();
        builder.Property(s => s.MinimumAge).IsRequired();
        builder.Property(s => s.MaximumAge).IsRequired();
        builder.Property(s => s.InfectiousDiseasePermanentDeferral).IsRequired();
        builder.Property(s => s.DrugUsePermanentDeferral).IsRequired();

        builder.HasQueryFilter(s => !s.IsDeleted);
    }
}
