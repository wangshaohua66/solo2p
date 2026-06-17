using BloodCenter.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BloodCenter.Infrastructure.Data.Configurations;

public class DonorMedicalHistoryConfiguration : IEntityTypeConfiguration<DonorMedicalHistory>
{
    public void Configure(EntityTypeBuilder<DonorMedicalHistory> builder)
    {
        builder.ToTable("DonorMedicalHistories");
        builder.HasKey(mh => mh.Id);
        builder.HasIndex(mh => mh.DonorId);
        builder.HasIndex(mh => mh.QuestionnaireDate);
        builder.HasIndex(mh => mh.EligibilityResult);
        builder.HasIndex(mh => mh.IsDeleted);

        builder.Property(mh => mh.VaccinationType).HasMaxLength(100);
        builder.Property(mh => mh.MedicationDetails).HasMaxLength(500);
        builder.Property(mh => mh.AdditionalNotes).HasMaxLength(1000);
        builder.Property(mh => mh.DeferralReason).HasMaxLength(500);

        builder.HasOne(mh => mh.Donor)
            .WithMany(d => d.MedicalHistory)
            .HasForeignKey(mh => mh.DonorId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasQueryFilter(mh => !mh.IsDeleted);
    }
}
