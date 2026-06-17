using BloodCenter.Core.Entities;
using BloodCenter.Core.Entities.ValueObjects;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BloodCenter.Infrastructure.Data.Configurations;

public class DonorConfiguration : IEntityTypeConfiguration<Donor>
{
    public void Configure(EntityTypeBuilder<Donor> builder)
    {
        builder.ToTable("Donors");
        builder.HasKey(d => d.Id);
        builder.HasIndex(d => d.DonorNumber).IsUnique();
        builder.HasIndex(d => d.IdCardNumber).IsUnique();
        builder.HasIndex(d => d.PhoneNumber);
        builder.HasIndex(d => d.Status);
        builder.HasIndex(d => d.IsDeleted);

        builder.Property(d => d.DonorNumber).IsRequired().HasMaxLength(50);
        builder.Property(d => d.FirstName).IsRequired().HasMaxLength(100);
        builder.Property(d => d.LastName).IsRequired().HasMaxLength(100);
        builder.Property(d => d.Gender).IsRequired().HasMaxLength(10);
        builder.Property(d => d.IdCardNumber).IsRequired().HasMaxLength(50);
        builder.Property(d => d.PhoneNumber).IsRequired().HasMaxLength(20);
        builder.Property(d => d.Email).HasMaxLength(100);
        builder.Property(d => d.Occupation).HasMaxLength(100);
        builder.Property(d => d.Notes).HasMaxLength(1000);

        builder.OwnsOne(d => d.Address, a =>
        {
            a.Property(x => x.Street).HasMaxLength(200);
            a.Property(x => x.City).HasMaxLength(100);
            a.Property(x => x.Province).HasMaxLength(100);
            a.Property(x => x.PostalCode).HasMaxLength(20);
        });

        builder.OwnsOne(d => d.BloodGroup, bg =>
        {
            bg.Property(x => x.ABO).IsRequired();
            bg.Property(x => x.Rh).IsRequired();
        });

        builder.HasMany(d => d.Donations)
            .WithOne(d => d.Donor)
            .HasForeignKey(d => d.DonorId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(d => d.MedicalHistory)
            .WithOne(mh => mh.Donor)
            .HasForeignKey(mh => mh.DonorId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasQueryFilter(d => !d.IsDeleted);
    }
}
