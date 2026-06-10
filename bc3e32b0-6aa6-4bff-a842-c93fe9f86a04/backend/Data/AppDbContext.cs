using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using PotteryStudio.Models;
using System.Text.Json;

namespace PotteryStudio.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<Kiln> Kilns { get; set; }
    public DbSet<KilnSchedule> KilnSchedules { get; set; }
    public DbSet<FiringRecord> FiringRecords { get; set; }
    public DbSet<GlazeRecipe> GlazeRecipes { get; set; }
    public DbSet<GlazeIngredient> GlazeIngredients { get; set; }
    public DbSet<PieceArchive> PieceArchives { get; set; }
    public DbSet<PiecePhoto> PiecePhotos { get; set; }
    public DbSet<Course> Courses { get; set; }
    public DbSet<CourseSession> CourseSessions { get; set; }
    public DbSet<CourseRegistration> CourseRegistrations { get; set; }
    public DbSet<AttendanceRecord> AttendanceRecords { get; set; }
    public DbSet<Station> Stations { get; set; }
    public DbSet<StudioBooking> StudioBookings { get; set; }
    public DbSet<SalesItem> SalesItems { get; set; }
    public DbSet<CustomOrder> CustomOrders { get; set; }
    public DbSet<Material> Materials { get; set; }
    public DbSet<MaterialTransaction> MaterialTransactions { get; set; }
    public DbSet<MaterialAlert> MaterialAlerts { get; set; }
    public DbSet<Notification> Notifications { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        var stringListConverter = new ValueConverter<string[], string>(
            v => JsonSerializer.Serialize(v, (JsonSerializerOptions)null!),
            v => JsonSerializer.Deserialize<string[]>(v, (JsonSerializerOptions)null!) ?? Array.Empty<string>()
        );

        var temperatureCurveConverter = new ValueConverter<List<TemperaturePoint>, string>(
            v => JsonSerializer.Serialize(v, (JsonSerializerOptions)null!),
            v => JsonSerializer.Deserialize<List<TemperaturePoint>>(v, (JsonSerializerOptions)null!) ?? new List<TemperaturePoint>()
        );

        var ingredientListConverter = new ValueConverter<List<GlazeIngredient>, string>(
            v => JsonSerializer.Serialize(v, (JsonSerializerOptions)null!),
            v => JsonSerializer.Deserialize<List<GlazeIngredient>>(v, (JsonSerializerOptions)null!) ?? new List<GlazeIngredient>()
        );

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(u => u.Username).IsUnique();
            entity.HasIndex(u => u.Email).IsUnique();
            entity.Property(u => u.Role).HasConversion<string>();
            entity.Property(u => u.MemberTier).HasConversion<string>();
            entity.HasMany(u => u.Pieces)
                  .WithOne(p => p.Member)
                  .HasForeignKey(p => p.MemberId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Kiln>(entity =>
        {
            entity.Property(k => k.Type).HasConversion<string>();
            entity.Property(k => k.Status).HasConversion<string>();
        });

        modelBuilder.Entity<KilnSchedule>(entity =>
        {
            entity.Property(ks => ks.FiringType).HasConversion<string>();
            entity.Property(ks => ks.Status).HasConversion<string>();
            entity.Property(ks => ks.TemperatureCurve)
                  .HasConversion(temperatureCurveConverter);
            entity.HasOne(ks => ks.Kiln)
                  .WithMany(k => k.Schedules)
                  .HasForeignKey(ks => ks.KilnId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<FiringRecord>(entity =>
        {
            entity.Property(fr => fr.TemperatureLog)
                  .HasConversion(temperatureCurveConverter);
            entity.HasOne(fr => fr.KilnSchedule)
                  .WithMany(ks => ks.FiringRecords)
                  .HasForeignKey(fr => fr.KilnScheduleId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<GlazeRecipe>(entity =>
        {
            entity.Property(gr => gr.FiringType).HasConversion<string>();
            entity.Property(gr => gr.Ingredients)
                  .HasConversion(ingredientListConverter);
            entity.HasOne(gr => gr.Parent)
                  .WithMany(gr => gr.Children)
                  .HasForeignKey(gr => gr.ParentId)
                  .OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(gr => gr.Code).IsUnique();
        });

        modelBuilder.Entity<PieceArchive>(entity =>
        {
            entity.Property(pa => pa.Status).HasConversion<string>();
            entity.Property(pa => pa.Tags).HasConversion(stringListConverter);
            entity.HasOne(pa => pa.Member)
                  .WithMany(m => m.Pieces)
                  .HasForeignKey(pa => pa.MemberId)
                  .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(pa => pa.GlazeRecipe)
                  .WithMany(gr => gr.Pieces)
                  .HasForeignKey(pa => pa.GlazeRecipeId)
                  .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(pa => pa.KilnSchedule)
                  .WithMany(ks => ks.Pieces)
                  .HasForeignKey(pa => pa.KilnScheduleId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<PiecePhoto>(entity =>
        {
            entity.Property(pp => pp.Stage).HasConversion<string>();
            entity.HasOne(pp => pp.Piece)
                  .WithMany(pa => pa.Photos)
                  .HasForeignKey(pp => pp.PieceId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Course>(entity =>
        {
            entity.Property(c => c.Type).HasConversion<string>();
            entity.Property(c => c.Level).HasConversion<string>();
            entity.Property(c => c.Status).HasConversion<string>();
        });

        modelBuilder.Entity<CourseSession>(entity =>
        {
            entity.HasOne(cs => cs.Course)
                  .WithMany(c => c.Schedule)
                  .HasForeignKey(cs => cs.CourseId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CourseRegistration>(entity =>
        {
            entity.Property(cr => cr.Status).HasConversion<string>();
            entity.HasOne(cr => cr.Course)
                  .WithMany(c => c.Registrations)
                  .HasForeignKey(cr => cr.CourseId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(cr => cr.Member)
                  .WithMany(m => m.CourseRegistrations)
                  .HasForeignKey(cr => cr.MemberId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<AttendanceRecord>(entity =>
        {
            entity.Property(ar => ar.Status).HasConversion<string>();
            entity.HasOne(ar => ar.CourseSession)
                  .WithMany(cs => cs.AttendanceRecords)
                  .HasForeignKey(ar => ar.CourseSessionId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(ar => ar.Member)
                  .WithMany()
                  .HasForeignKey(ar => ar.MemberId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Station>(entity =>
        {
            entity.Property(s => s.Type).HasConversion<string>();
            entity.Property(s => s.Status).HasConversion<string>();
        });

        modelBuilder.Entity<StudioBooking>(entity =>
        {
            entity.Property(sb => sb.Status).HasConversion<string>();
            entity.HasOne(sb => sb.Station)
                  .WithMany(s => s.Bookings)
                  .HasForeignKey(sb => sb.StationId)
                  .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(sb => sb.Member)
                  .WithMany(m => m.StudioBookings)
                  .HasForeignKey(sb => sb.MemberId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<SalesItem>(entity =>
        {
            entity.Property(si => si.Status).HasConversion<string>();
            entity.HasOne(si => si.Piece)
                  .WithOne()
                  .HasForeignKey<SalesItem>(si => si.PieceId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<CustomOrder>(entity =>
        {
            entity.Property(co => co.Status).HasConversion<string>();
            entity.Property(co => co.ReferenceImages).HasConversion(stringListConverter);
            entity.HasOne(co => co.AssignedUser)
                  .WithMany()
                  .HasForeignKey(co => co.AssignedTo)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Material>(entity =>
        {
            entity.Property(m => m.Category).HasConversion<string>();
        });

        modelBuilder.Entity<MaterialTransaction>(entity =>
        {
            entity.Property(mt => mt.Type).HasConversion<string>();
            entity.HasOne(mt => mt.Material)
                  .WithMany(m => m.Transactions)
                  .HasForeignKey(mt => mt.MaterialId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<MaterialAlert>(entity =>
        {
            entity.HasIndex(ma => ma.IsRead);
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.Property(n => n.Type).HasConversion<string>();
            entity.HasOne(n => n.User)
                  .WithMany(u => u.Notifications)
                  .HasForeignKey(n => n.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(n => new { n.UserId, n.IsRead });
        });
    }
}
