using Microsoft.EntityFrameworkCore;
using UsedVehicleTransaction.Models;

namespace UsedVehicleTransaction.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<Vehicle> Vehicles { get; set; }
    public DbSet<ComplianceCheckRecord> ComplianceCheckRecords { get; set; }
    public DbSet<ComplianceCheckItem> ComplianceCheckItems { get; set; }
    public DbSet<InspectionItemLibrary> InspectionItemLibrary { get; set; }
    public DbSet<InspectionOrder> InspectionOrders { get; set; }
    public DbSet<InspectionItemResult> InspectionItemResults { get; set; }
    public DbSet<InspectionPhoto> InspectionPhotos { get; set; }
    public DbSet<VehicleTransaction> VehicleTransactions { get; set; }
    public DbSet<WorkflowInstance> WorkflowInstances { get; set; }
    public DbSet<WorkflowNodeExecution> WorkflowNodeExecutions { get; set; }
    public DbSet<ArchiveFile> ArchiveFiles { get; set; }
    public DbSet<ExceptionCase> ExceptionCases { get; set; }
    public DbSet<ExceptionCaseLog> ExceptionCaseLogs { get; set; }
    public DbSet<SystemUser> SystemUsers { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        ConfigureSoftDeleteFilter(modelBuilder);

        ConfigureVehicleModel(modelBuilder);
        ConfigureComplianceModels(modelBuilder);
        ConfigureInspectionModels(modelBuilder);
        ConfigureTransactionModels(modelBuilder);
        ConfigureWorkflowModels(modelBuilder);
        ConfigureArchiveModels(modelBuilder);
        ConfigureExceptionModels(modelBuilder);
        ConfigureUserModel(modelBuilder);

        SeedInitialData(modelBuilder);
    }

    private static void ConfigureSoftDeleteFilter(ModelBuilder modelBuilder)
    {
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (typeof(BaseEntity).IsAssignableFrom(entityType.ClrType))
            {
                entityType.AddProperty("IsDeleted", typeof(bool));
                modelBuilder.Entity(entityType.ClrType)
                    .HasQueryFilter(CreateSoftDeleteFilter(entityType.ClrType));
            }
        }
    }

    private static System.Linq.Expressions.LambdaExpression CreateSoftDeleteFilter(Type entityType)
    {
        var param = System.Linq.Expressions.Expression.Parameter(entityType, "e");
        var prop = System.Linq.Expressions.Expression.Property(param, "IsDeleted");
        var not = System.Linq.Expressions.Expression.Not(prop);
        var lambda = System.Linq.Expressions.Expression.Lambda(not, param);
        return lambda;
    }

    private static void ConfigureVehicleModel(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Vehicle>(entity =>
        {
            entity.HasQueryFilter(v => !v.IsDeleted);

            entity.Property(e => e.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(e => e.UpdatedAt)
                .HasColumnType("datetime");

            entity.Property(e => e.Displacement)
                .HasColumnType("decimal(10,2)")
                .HasPrecision(10, 2);

            entity.Property(e => e.EstimatedPrice)
                .HasColumnType("decimal(12,2)")
                .HasPrecision(12, 2);

            entity.HasMany(v => v.ComplianceCheckRecords)
                .WithOne(c => c.Vehicle)
                .HasForeignKey(c => c.VehicleId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasMany(v => v.InspectionOrders)
                .WithOne(i => i.Vehicle)
                .HasForeignKey(i => i.VehicleId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasMany(v => v.Transactions)
                .WithOne(t => t.Vehicle)
                .HasForeignKey(t => t.VehicleId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasMany(v => v.Archives)
                .WithOne(a => a.Vehicle)
                .HasForeignKey(a => a.VehicleId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasMany(v => v.ExceptionCases)
                .WithOne(e => e.Vehicle)
                .HasForeignKey(e => e.VehicleId)
                .OnDelete(DeleteBehavior.SetNull);
        });
    }

    private static void ConfigureComplianceModels(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ComplianceCheckRecord>(entity =>
        {
            entity.HasQueryFilter(e => !e.IsDeleted);

            entity.Property(e => e.CheckTime)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(e => e.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(e => e.FailureReasons)
                .HasColumnType("varchar(2000)");

            entity.Property(e => e.ReviewRemark)
                .HasColumnType("varchar(500)");

            entity.Property(e => e.ApprovalRemark)
                .HasColumnType("varchar(500)");

            entity.HasMany(c => c.CheckItems)
                .WithOne(i => i.CheckRecord)
                .HasForeignKey(i => i.CheckRecordId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ComplianceCheckItem>(entity =>
        {
            entity.HasQueryFilter(e => !e.IsDeleted);

            entity.Property(e => e.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(e => e.ItemName)
                .HasColumnType("varchar(100)");

            entity.Property(e => e.Detail)
                .HasColumnType("varchar(500)");

            entity.Property(e => e.RawData)
                .HasColumnType("varchar(1000)");

            entity.Property(e => e.FailureReason)
                .HasColumnType("varchar(200)");

            entity.Property(e => e.FailureReasonEn)
                .HasColumnType("varchar(200)");
        });
    }

    private static void ConfigureInspectionModels(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<InspectionItemLibrary>(entity =>
        {
            entity.HasQueryFilter(e => !e.IsDeleted);

            entity.Property(e => e.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(e => e.Weight)
                .HasColumnType("decimal(5,4)")
                .HasPrecision(5, 4);

            entity.Property(e => e.ItemCode)
                .HasColumnType("varchar(20)");

            entity.Property(e => e.ItemName)
                .HasColumnType("varchar(100)");

            entity.Property(e => e.Description)
                .HasColumnType("varchar(500)");

            entity.Property(e => e.ScoreCriteria)
                .HasColumnType("varchar(500)");

            entity.HasMany(i => i.ItemResults)
                .WithOne(r => r.InspectionItem)
                .HasForeignKey(r => r.InspectionItemId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<InspectionOrder>(entity =>
        {
            entity.HasQueryFilter(e => !e.IsDeleted);

            entity.Property(e => e.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(e => e.StartTime)
                .HasColumnType("datetime");

            entity.Property(e => e.EndTime)
                .HasColumnType("datetime");

            entity.Property(e => e.ReviewedAt)
                .HasColumnType("datetime");

            entity.Property(e => e.EngineScore)
                .HasColumnType("decimal(6,2)")
                .HasPrecision(6, 2);

            entity.Property(e => e.ChassisScore)
                .HasColumnType("decimal(6,2)")
                .HasPrecision(6, 2);

            entity.Property(e => e.BodyScore)
                .HasColumnType("decimal(6,2)")
                .HasPrecision(6, 2);

            entity.Property(e => e.ElectricalScore)
                .HasColumnType("decimal(6,2)")
                .HasPrecision(6, 2);

            entity.Property(e => e.RoadTestScore)
                .HasColumnType("decimal(6,2)")
                .HasPrecision(6, 2);

            entity.Property(e => e.TotalScore)
                .HasColumnType("decimal(6,2)")
                .HasPrecision(6, 2);

            entity.Property(e => e.GeneralComment)
                .HasColumnType("varchar(2000)");

            entity.Property(e => e.MajorIssues)
                .HasColumnType("varchar(500)");

            entity.Property(e => e.SafetyConcerns)
                .HasColumnType("varchar(500)");

            entity.Property(e => e.ReviewComment)
                .HasColumnType("varchar(500)");

            entity.HasMany(i => i.ItemResults)
                .WithOne(r => r.InspectionOrder)
                .HasForeignKey(r => r.InspectionOrderId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(i => i.Photos)
                .WithOne(p => p.InspectionOrder)
                .HasForeignKey(p => p.InspectionOrderId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<InspectionItemResult>(entity =>
        {
            entity.HasQueryFilter(e => !e.IsDeleted);

            entity.Property(e => e.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(e => e.Description)
                .HasColumnType("varchar(1000)");

            entity.Property(e => e.Finding)
                .HasColumnType("varchar(2000)");

            entity.Property(e => e.DefectLevel)
                .HasColumnType("varchar(100)");
        });

        modelBuilder.Entity<InspectionPhoto>(entity =>
        {
            entity.HasQueryFilter(e => !e.IsDeleted);

            entity.Property(e => e.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(e => e.FilePath)
                .HasColumnType("varchar(255)");

            entity.Property(e => e.OriginalFileName)
                .HasColumnType("varchar(255)");

            entity.Property(e => e.ContentType)
                .HasColumnType("varchar(100)");

            entity.Property(e => e.Description)
                .HasColumnType("varchar(500)");
        });
    }

    private static void ConfigureTransactionModels(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<VehicleTransaction>(entity =>
        {
            entity.HasQueryFilter(e => !e.IsDeleted);

            entity.Property(e => e.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(e => e.TransactionDate)
                .HasColumnType("datetime");

            entity.Property(e => e.RegistrationDate)
                .HasColumnType("datetime");

            entity.Property(e => e.TransactionPrice)
                .HasColumnType("decimal(12,2)")
                .HasPrecision(12, 2);

            entity.Property(e => e.TaxAmount)
                .HasColumnType("decimal(12,2)")
                .HasPrecision(12, 2);

            entity.Property(e => e.ServiceFee)
                .HasColumnType("decimal(12,2)")
                .HasPrecision(12, 2);

            entity.Property(e => e.SellerName)
                .HasColumnType("varchar(50)");

            entity.Property(e => e.BuyerName)
                .HasColumnType("varchar(50)");

            entity.Property(e => e.SellerIdNumber)
                .HasColumnType("varchar(18)");

            entity.Property(e => e.BuyerIdNumber)
                .HasColumnType("varchar(18)");

            entity.Property(e => e.Remark)
                .HasColumnType("varchar(500)");

            entity.HasOne(t => t.InspectionOrder)
                .WithMany()
                .HasForeignKey(t => t.InspectionOrderId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasMany(t => t.WorkflowInstances)
                .WithOne(w => w.Transaction)
                .HasForeignKey(w => w.TransactionId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(t => t.Archives)
                .WithOne(a => a.Transaction)
                .HasForeignKey(a => a.TransactionId)
                .OnDelete(DeleteBehavior.SetNull);
        });
    }

    private static void ConfigureWorkflowModels(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<WorkflowInstance>(entity =>
        {
            entity.HasQueryFilter(e => !e.IsDeleted);

            entity.Property(e => e.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(e => e.StartTime)
                .HasColumnType("datetime");

            entity.Property(e => e.EndTime)
                .HasColumnType("datetime");

            entity.Property(e => e.Remark)
                .HasColumnType("varchar(500)");

            entity.HasMany(w => w.NodeExecutions)
                .WithOne(n => n.Instance)
                .HasForeignKey(n => n.InstanceId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<WorkflowNodeExecution>(entity =>
        {
            entity.HasQueryFilter(e => !e.IsDeleted);

            entity.Property(e => e.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(e => e.ScheduledStartTime)
                .HasColumnType("datetime");

            entity.Property(e => e.ScheduledEndTime)
                .HasColumnType("datetime");

            entity.Property(e => e.StartTime)
                .HasColumnType("datetime");

            entity.Property(e => e.EndTime)
                .HasColumnType("datetime");

            entity.Property(e => e.LastReminderTime)
                .HasColumnType("datetime");

            entity.Property(e => e.NodeName)
                .HasColumnType("varchar(100)");

            entity.Property(e => e.Prerequisites)
                .HasColumnType("varchar(500)");

            entity.Property(e => e.ResultData)
                .HasColumnType("varchar(1000)");

            entity.Property(e => e.Remark)
                .HasColumnType("varchar(500)");

            entity.Property(e => e.AssigneeName)
                .HasColumnType("varchar(50)");

            entity.Property(e => e.CompleterName)
                .HasColumnType("varchar(50)");
        });
    }

    private static void ConfigureArchiveModels(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ArchiveFile>(entity =>
        {
            entity.HasQueryFilter(e => !e.IsDeleted);

            entity.Property(e => e.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(e => e.ArchiveTypeName)
                .HasColumnType("varchar(100)");

            entity.Property(e => e.FileName)
                .HasColumnType("varchar(255)");

            entity.Property(e => e.OriginalFileName)
                .HasColumnType("varchar(255)");

            entity.Property(e => e.FilePath)
                .HasColumnType("varchar(255)");

            entity.Property(e => e.ContentType)
                .HasColumnType("varchar(100)");

            entity.Property(e => e.FileExtension)
                .HasColumnType("varchar(50)");

            entity.Property(e => e.FileHash)
                .HasColumnType("varchar(64)");

            entity.Property(e => e.Keywords)
                .HasColumnType("varchar(500)");

            entity.Property(e => e.Description)
                .HasColumnType("varchar(500)");

            entity.Property(e => e.OcrText)
                .HasColumnType("text");
        });
    }

    private static void ConfigureExceptionModels(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ExceptionCase>(entity =>
        {
            entity.HasQueryFilter(e => !e.IsDeleted);

            entity.Property(e => e.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(e => e.CaseTypeName)
                .HasColumnType("varchar(100)");

            entity.Property(e => e.Title)
                .HasColumnType("varchar(200)");

            entity.Property(e => e.SourceModule)
                .HasColumnType("varchar(50)");

            entity.Property(e => e.AssigneeName)
                .HasColumnType("varchar(50)");

            entity.Property(e => e.DueDate)
                .HasColumnType("datetime");

            entity.Property(e => e.Resolution)
                .HasColumnType("varchar(500)");

            entity.Property(e => e.ResolvedAt)
                .HasColumnType("datetime");

            entity.Property(e => e.ResolverName)
                .HasColumnType("varchar(50)");

            entity.Property(e => e.Description)
                .HasColumnType("text");

            entity.HasMany(e => e.ProcessingLogs)
                .WithOne(l => l.Case)
                .HasForeignKey(l => l.CaseId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ExceptionCaseLog>(entity =>
        {
            entity.HasQueryFilter(e => !e.IsDeleted);

            entity.Property(e => e.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(e => e.Action)
                .HasColumnType("varchar(1000)");

            entity.Property(e => e.OperatorName)
                .HasColumnType("varchar(50)");

            entity.Property(e => e.Remark)
                .HasColumnType("text");
        });
    }

    private static void ConfigureUserModel(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<SystemUser>(entity =>
        {
            entity.HasQueryFilter(e => !e.IsDeleted);

            entity.Property(e => e.CreatedAt)
                .HasColumnType("datetime")
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(e => e.Username)
                .HasColumnType("varchar(50)");

            entity.Property(e => e.EmployeeNo)
                .HasColumnType("varchar(50)");

            entity.Property(e => e.RealName)
                .HasColumnType("varchar(50)");

            entity.Property(e => e.Phone)
                .HasColumnType("varchar(20)");

            entity.Property(e => e.Email)
                .HasColumnType("varchar(100)");

            entity.Property(e => e.Department)
                .HasColumnType("varchar(200)");
        });
    }

    private static void SeedInitialData(ModelBuilder modelBuilder)
    {
        SeedUsers(modelBuilder);
        SeedInspectionItemLibrary(modelBuilder);
    }

    private static void SeedUsers(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<SystemUser>().HasData(
            new SystemUser
            {
                Id = 1,
                Username = "admin",
                EmployeeNo = "ADM001",
                RealName = "系统管理员",
                Role = Enums.UserRole.Admin,
                Phone = "13800000000",
                Email = "admin@example.com",
                Department = "信息部",
                IsActive = true,
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                CreatedBy = 1
            },
            new SystemUser
            {
                Id = 2,
                Username = "auditor01",
                EmployeeNo = "AUD001",
                RealName = "张审核",
                Role = Enums.UserRole.ComplianceAuditor,
                Phone = "13800000001",
                Email = "zhang@example.com",
                Department = "审核科",
                IsActive = true,
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                CreatedBy = 1
            },
            new SystemUser
            {
                Id = 3,
                Username = "inspector01",
                EmployeeNo = "INS001",
                RealName = "李鉴定",
                Role = Enums.UserRole.VehicleInspector,
                Phone = "13800000002",
                Email = "li@example.com",
                Department = "鉴定科",
                IsActive = true,
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                CreatedBy = 1
            },
            new SystemUser
            {
                Id = 4,
                Username = "clerk01",
                EmployeeNo = "CLK001",
                RealName = "王登记",
                Role = Enums.UserRole.RegistrationClerk,
                Phone = "13800000003",
                Email = "wang@example.com",
                Department = "登记科",
                IsActive = true,
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                CreatedBy = 1
            }
        );
    }

    private static void SeedInspectionItemLibrary(ModelBuilder modelBuilder)
    {
        var items = new List<InspectionItemLibrary>();
        int id = 1;
        int sortOrder = 1;

        for (int i = 1; i <= 32; i++)
        {
            items.Add(new InspectionItemLibrary
            {
                Id = id++,
                ItemCode = $"ENG-{i:D3}",
                Category = Enums.InspectionCategory.Engine,
                ItemName = $"发动机检测项目{i}",
                ItemNameEn = $"Engine Inspection Item {i}",
                Description = $"发动机系统第{i}项检测指标",
                SortOrder = sortOrder++,
                MaxScore = 10,
                Weight = (decimal)(0.30 / 32),
                ScoreCriteria = "满分10分，根据检测情况酌情扣分",
                Required = true,
                AllowPhoto = true,
                MinPhotos = 0,
                MaxPhotos = 3,
                IsActive = true,
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                CreatedBy = 1
            });
        }

        sortOrder = 1;
        for (int i = 1; i <= 28; i++)
        {
            items.Add(new InspectionItemLibrary
            {
                Id = id++,
                ItemCode = $"CHS-{i:D3}",
                Category = Enums.InspectionCategory.Chassis,
                ItemName = $"底盘检测项目{i}",
                ItemNameEn = $"Chassis Inspection Item {i}",
                Description = $"底盘系统第{i}项检测指标",
                SortOrder = sortOrder++,
                MaxScore = 10,
                Weight = (decimal)(0.20 / 28),
                ScoreCriteria = "满分10分，根据检测情况酌情扣分",
                Required = true,
                AllowPhoto = true,
                MinPhotos = 0,
                MaxPhotos = 2,
                IsActive = true,
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                CreatedBy = 1
            });
        }

        sortOrder = 1;
        for (int i = 1; i <= 45; i++)
        {
            items.Add(new InspectionItemLibrary
            {
                Id = id++,
                ItemCode = $"BDY-{i:D3}",
                Category = Enums.InspectionCategory.Body,
                ItemName = $"车身检测项目{i}",
                ItemNameEn = $"Body Inspection Item {i}",
                Description = $"车身外观内饰第{i}项检测指标",
                SortOrder = sortOrder++,
                MaxScore = 10,
                Weight = (decimal)(0.25 / 45),
                ScoreCriteria = "满分10分，根据检测情况酌情扣分",
                Required = true,
                AllowPhoto = true,
                MinPhotos = 1,
                MaxPhotos = 3,
                IsActive = true,
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                CreatedBy = 1
            });
        }

        sortOrder = 1;
        for (int i = 1; i <= 18; i++)
        {
            items.Add(new InspectionItemLibrary
            {
                Id = id++,
                ItemCode = $"ELE-{i:D3}",
                Category = Enums.InspectionCategory.Electrical,
                ItemName = $"电气检测项目{i}",
                ItemNameEn = $"Electrical Inspection Item {i}",
                Description = $"电气系统第{i}项检测指标",
                SortOrder = sortOrder++,
                MaxScore = 10,
                Weight = (decimal)(0.10 / 18),
                ScoreCriteria = "满分10分，根据检测情况酌情扣分",
                Required = true,
                AllowPhoto = true,
                MinPhotos = 0,
                MaxPhotos = 2,
                IsActive = true,
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                CreatedBy = 1
            });
        }

        sortOrder = 1;
        for (int i = 1; i <= 25; i++)
        {
            items.Add(new InspectionItemLibrary
            {
                Id = id++,
                ItemCode = $"RDT-{i:D3}",
                Category = Enums.InspectionCategory.RoadTest,
                ItemName = $"路试检测项目{i}",
                ItemNameEn = $"Road Test Inspection Item {i}",
                Description = $"道路试验第{i}项检测指标",
                SortOrder = sortOrder++,
                MaxScore = 10,
                Weight = (decimal)(0.15 / 25),
                ScoreCriteria = "满分10分，根据检测情况酌情扣分",
                Required = true,
                AllowPhoto = false,
                MinPhotos = 0,
                MaxPhotos = 0,
                IsActive = true,
                CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                CreatedBy = 1
            });
        }

        modelBuilder.Entity<InspectionItemLibrary>().HasData(items);
    }

    public override int SaveChanges()
    {
        UpdateTimestamps();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        UpdateTimestamps();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void UpdateTimestamps()
    {
        var entries = ChangeTracker.Entries<BaseEntity>();
        foreach (var entry in entries)
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedAt = DateTime.UtcNow;
                    break;
                case EntityState.Modified:
                    entry.Entity.UpdatedAt = DateTime.UtcNow;
                    break;
                case EntityState.Deleted:
                    entry.State = EntityState.Modified;
                    entry.Entity.IsDeleted = true;
                    entry.Entity.DeletedAt = DateTime.UtcNow;
                    break;
            }
        }
    }
}
