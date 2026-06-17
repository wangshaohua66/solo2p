using BloodCenter.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BloodCenter.Infrastructure.Data.Configurations;

public class BloodRequestConfiguration : IEntityTypeConfiguration<BloodRequest>
{
    public void Configure(EntityTypeBuilder<BloodRequest> builder)
    {
        builder.ToTable("BloodRequests");
        builder.HasKey(br => br.Id);
        builder.HasIndex(br => br.RequestNumber).IsUnique();
        builder.HasIndex(br => br.HospitalId);
        builder.HasIndex(br => br.PatientId);
        builder.HasIndex(br => br.ProductType);
        builder.HasIndex(br => br.Urgency);
        builder.HasIndex(br => br.Status);
        builder.HasIndex(br => br.RequiredDate);
        builder.HasIndex(br => br.IsDeleted);
        builder.HasIndex(br => new { br.HospitalId, br.Status, br.RequiredDate });

        builder.Property(br => br.RequestNumber).IsRequired().HasMaxLength(50);
        builder.Property(br => br.PatientName).IsRequired().HasMaxLength(100);
        builder.Property(br => br.PatientId).IsRequired().HasMaxLength(50);
        builder.Property(br => br.PatientGender).HasMaxLength(10);
        builder.Property(br => br.Diagnosis).HasMaxLength(500);
        builder.Property(br => br.QuantityRequested).IsRequired();
        builder.Property(br => br.QuantityIssued).IsRequired();
        builder.Property(br => br.Ward).IsRequired().HasMaxLength(100);
        builder.Property(br => br.BedNumber).HasMaxLength(20);
        builder.Property(br => br.RequestedBy).IsRequired().HasMaxLength(100);
        builder.Property(br => br.RequestDoctor).HasMaxLength(100);
        builder.Property(br => br.TransfusionHistory).HasMaxLength(500);
        builder.Property(br => br.PregnancyHistory).HasMaxLength(500);
        builder.Property(br => br.Status).IsRequired().HasMaxLength(50);
        builder.Property(br => br.Notes).HasMaxLength(1000);

        builder.OwnsOne(br => br.PatientBloodGroup, bg =>
        {
            bg.Property(x => x.ABO).IsRequired();
            bg.Property(x => x.Rh).IsRequired();
        });

        builder.HasOne(br => br.Hospital)
            .WithMany(h => h.BloodRequests)
            .HasForeignKey(br => br.HospitalId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(br => br.CrossMatches)
            .WithOne(cm => cm.BloodRequest)
            .HasForeignKey(cm => cm.BloodRequestId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasQueryFilter(br => !br.IsDeleted);
    }
}
