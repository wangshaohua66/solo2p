using BloodCenter.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BloodCenter.Infrastructure.Data.Configurations;

public class CollectionSiteConfiguration : IEntityTypeConfiguration<CollectionSite>
{
    public void Configure(EntityTypeBuilder<CollectionSite> builder)
    {
        builder.ToTable("CollectionSites");
        builder.HasKey(cs => cs.Id);
        builder.HasIndex(cs => cs.Code).IsUnique();
        builder.HasIndex(cs => cs.Type);
        builder.HasIndex(cs => cs.IsActive);
        builder.HasIndex(cs => cs.IsDeleted);

        builder.Property(cs => cs.Code).IsRequired().HasMaxLength(50);
        builder.Property(cs => cs.Name).IsRequired().HasMaxLength(200);
        builder.Property(cs => cs.ContactPhone).HasMaxLength(20);
        builder.Property(cs => cs.ContactPerson).HasMaxLength(100);
        builder.Property(cs => cs.OperatingHours).HasMaxLength(500);

        builder.OwnsOne(cs => cs.Address, a =>
        {
            a.Property(x => x.Street).HasMaxLength(200);
            a.Property(x => x.City).HasMaxLength(100);
            a.Property(x => x.Province).HasMaxLength(100);
            a.Property(x => x.PostalCode).HasMaxLength(20);
        });

        builder.HasMany(cs => cs.Donations)
            .WithOne(d => d.CollectionSite)
            .HasForeignKey(d => d.CollectionSiteId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasQueryFilter(cs => !cs.IsDeleted);
    }
}
