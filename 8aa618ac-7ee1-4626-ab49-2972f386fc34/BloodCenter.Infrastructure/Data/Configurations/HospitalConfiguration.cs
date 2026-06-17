using BloodCenter.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BloodCenter.Infrastructure.Data.Configurations;

public class HospitalConfiguration : IEntityTypeConfiguration<Hospital>
{
    public void Configure(EntityTypeBuilder<Hospital> builder)
    {
        builder.ToTable("Hospitals");
        builder.HasKey(h => h.Id);
        builder.HasIndex(h => h.HospitalCode).IsUnique();
        builder.HasIndex(h => h.IsActive);
        builder.HasIndex(h => h.IsDeleted);

        builder.Property(h => h.HospitalCode).IsRequired().HasMaxLength(50);
        builder.Property(h => h.Name).IsRequired().HasMaxLength(200);
        builder.Property(h => h.ContactPerson).IsRequired().HasMaxLength(100);
        builder.Property(h => h.ContactPhone).IsRequired().HasMaxLength(20);
        builder.Property(h => h.Email).HasMaxLength(100);
        builder.Property(h => h.ApiKey).HasMaxLength(500);
        builder.Property(h => h.Notes).HasMaxLength(1000);

        builder.OwnsOne(h => h.Address, a =>
        {
            a.Property(x => x.Street).HasMaxLength(200);
            a.Property(x => x.City).HasMaxLength(100);
            a.Property(x => x.Province).HasMaxLength(100);
            a.Property(x => x.PostalCode).HasMaxLength(20);
        });

        builder.HasMany(h => h.BloodRequests)
            .WithOne(br => br.Hospital)
            .HasForeignKey(br => br.HospitalId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasQueryFilter(h => !h.IsDeleted);
    }
}
