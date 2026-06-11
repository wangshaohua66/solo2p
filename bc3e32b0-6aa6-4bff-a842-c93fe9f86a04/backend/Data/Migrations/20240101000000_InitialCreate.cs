using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PotteryStudio.Data.Migrations
{
    public partial class InitialCreate : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "GlazeRecipes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Code = table.Column<string>(type: "TEXT", nullable: false),
                    ParentId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Version = table.Column<int>(type: "INTEGER", nullable: false),
                    IsCurrentVersion = table.Column<bool>(type: "INTEGER", nullable: false),
                    SourceVersion = table.Column<string>(type: "TEXT", nullable: true),
                    IsArchived = table.Column<bool>(type: "INTEGER", nullable: false),
                    Notes = table.Column<string>(type: "TEXT", nullable: true),
                    Ingredients = table.Column<string>(type: "TEXT", nullable: false),
                    FiringType = table.Column<string>(type: "TEXT", nullable: false),
                    TemperatureMin = table.Column<decimal>(type: "TEXT", nullable: false),
                    TemperatureMax = table.Column<decimal>(type: "TEXT", nullable: false),
                    Atmosphere = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    EffectImage = table.Column<string>(type: "TEXT", nullable: true),
                    EffectThumbnail = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedById = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedByName = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "BLOB", rowVersion: true, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GlazeRecipes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GlazeRecipes_GlazeRecipes_ParentId",
                        column: x => x.ParentId,
                        principalTable: "GlazeRecipes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Kilns",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Type = table.Column<string>(type: "TEXT", nullable: false),
                    Capacity = table.Column<decimal>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    MaxTemperature = table.Column<decimal>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Kilns", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Materials",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Category = table.Column<string>(type: "TEXT", nullable: false),
                    Unit = table.Column<string>(type: "TEXT", nullable: false),
                    TotalQuantity = table.Column<decimal>(type: "TEXT", nullable: false),
                    ReservedQuantity = table.Column<decimal>(type: "TEXT", nullable: false),
                    AvailableQuantity = table.Column<decimal>(type: "TEXT", nullable: false),
                    MinThreshold = table.Column<decimal>(type: "TEXT", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "TEXT", nullable: false),
                    LastRestocked = table.Column<DateTime>(type: "TEXT", nullable: true),
                    LastUsed = table.Column<DateTime>(type: "TEXT", nullable: true),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Materials", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Stations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Type = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    Position = table.Column<int>(type: "INTEGER", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Stations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Username = table.Column<string>(type: "TEXT", nullable: false),
                    Email = table.Column<string>(type: "TEXT", nullable: false),
                    PasswordHash = table.Column<string>(type: "TEXT", nullable: false),
                    Phone = table.Column<string>(type: "TEXT", nullable: true),
                    Avatar = table.Column<string>(type: "TEXT", nullable: true),
                    Role = table.Column<string>(type: "TEXT", nullable: false),
                    MemberTier = table.Column<string>(type: "TEXT", nullable: false),
                    MemberExpireDate = table.Column<DateTime>(type: "TEXT", nullable: true),
                    TotalSpent = table.Column<decimal>(type: "TEXT", nullable: false),
                    Points = table.Column<int>(type: "INTEGER", nullable: false),
                    RefreshToken = table.Column<string>(type: "TEXT", nullable: true),
                    RefreshTokenExpiry = table.Column<DateTime>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GlazeIngredients",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Percentage = table.Column<decimal>(type: "TEXT", nullable: false),
                    Note = table.Column<string>(type: "TEXT", nullable: true),
                    GlazeRecipeId = table.Column<Guid>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GlazeIngredients", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GlazeIngredients_GlazeRecipes_GlazeRecipeId",
                        column: x => x.GlazeRecipeId,
                        principalTable: "GlazeRecipes",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "KilnSchedules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    KilnId = table.Column<Guid>(type: "TEXT", nullable: false),
                    KilnName = table.Column<string>(type: "TEXT", nullable: false),
                    Title = table.Column<string>(type: "TEXT", nullable: false),
                    FiringType = table.Column<string>(type: "TEXT", nullable: false),
                    StartTime = table.Column<DateTime>(type: "TEXT", nullable: false),
                    EndTime = table.Column<DateTime>(type: "TEXT", nullable: false),
                    TemperatureCurve = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedById = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedByName = table.Column<string>(type: "TEXT", nullable: true),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    Notes = table.Column<string>(type: "TEXT", nullable: true),
                    IsForced = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "BLOB", rowVersion: true, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KilnSchedules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_KilnSchedules_Kilns_KilnId",
                        column: x => x.KilnId,
                        principalTable: "Kilns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MaterialAlerts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    MaterialId = table.Column<Guid>(type: "TEXT", nullable: false),
                    MaterialName = table.Column<string>(type: "TEXT", nullable: false),
                    CurrentQuantity = table.Column<decimal>(type: "TEXT", nullable: false),
                    Threshold = table.Column<decimal>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    IsRead = table.Column<bool>(type: "INTEGER", nullable: false),
                    SuggestedPurchaseAmount = table.Column<decimal>(type: "TEXT", nullable: true),
                    EstimatedCost = table.Column<decimal>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MaterialAlerts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MaterialTransactions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    MaterialId = table.Column<Guid>(type: "TEXT", nullable: false),
                    MaterialName = table.Column<string>(type: "TEXT", nullable: true),
                    Type = table.Column<string>(type: "TEXT", nullable: false),
                    Quantity = table.Column<decimal>(type: "TEXT", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "TEXT", nullable: false),
                    TotalAmount = table.Column<decimal>(type: "TEXT", nullable: false),
                    ReferenceType = table.Column<string>(type: "TEXT", nullable: true),
                    ReferenceId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Notes = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedById = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedByName = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MaterialTransactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MaterialTransactions_Materials_MaterialId",
                        column: x => x.MaterialId,
                        principalTable: "Materials",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Courses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Title = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    Type = table.Column<string>(type: "TEXT", nullable: false),
                    InstructorId = table.Column<Guid>(type: "TEXT", nullable: false),
                    InstructorName = table.Column<string>(type: "TEXT", nullable: true),
                    CoverImage = table.Column<string>(type: "TEXT", nullable: true),
                    Price = table.Column<decimal>(type: "TEXT", nullable: false),
                    Duration = table.Column<int>(type: "INTEGER", nullable: false),
                    MaxStudents = table.Column<int>(type: "INTEGER", nullable: false),
                    CurrentStudents = table.Column<int>(type: "INTEGER", nullable: false),
                    Level = table.Column<string>(type: "TEXT", nullable: false),
                    StartDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    EndDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Courses", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CustomOrders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Title = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: false),
                    ReferenceImages = table.Column<string>(type: "TEXT", nullable: true),
                    ClientName = table.Column<string>(type: "TEXT", nullable: false),
                    ClientContact = table.Column<string>(type: "TEXT", nullable: false),
                    Budget = table.Column<decimal>(type: "TEXT", nullable: true),
                    AssignedTo = table.Column<Guid>(type: "TEXT", nullable: true),
                    AssignedToName = table.Column<string>(type: "TEXT", nullable: true),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    QuoteAmount = table.Column<decimal>(type: "TEXT", nullable: true),
                    QuoteDate = table.Column<DateTime>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Deadline = table.Column<DateTime>(type: "TEXT", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    Notes = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomOrders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CustomOrders_Users_AssignedTo",
                        column: x => x.AssignedTo,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "Notifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Title = table.Column<string>(type: "TEXT", nullable: false),
                    Content = table.Column<string>(type: "TEXT", nullable: false),
                    Type = table.Column<string>(type: "TEXT", nullable: false),
                    IsRead = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Link = table.Column<string>(type: "TEXT", nullable: true),
                    Data = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Notifications_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "StudioBookings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    MemberId = table.Column<Guid>(type: "TEXT", nullable: false),
                    MemberName = table.Column<string>(type: "TEXT", nullable: true),
                    StationId = table.Column<Guid>(type: "TEXT", nullable: false),
                    StationName = table.Column<string>(type: "TEXT", nullable: true),
                    StartTime = table.Column<DateTime>(type: "TEXT", nullable: false),
                    EndTime = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    ActualStartTime = table.Column<DateTime>(type: "TEXT", nullable: true),
                    ActualEndTime = table.Column<DateTime>(type: "TEXT", nullable: true),
                    SensorEntryTimestamp = table.Column<DateTime>(type: "TEXT", nullable: true),
                    SensorExitTimestamp = table.Column<DateTime>(type: "TEXT", nullable: true),
                    DurationHours = table.Column<decimal>(type: "TEXT", nullable: false),
                    ActualHours = table.Column<decimal>(type: "TEXT", nullable: true),
                    PointsEarned = table.Column<int>(type: "INTEGER", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Notes = table.Column<string>(type: "TEXT", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "BLOB", rowVersion: true, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudioBookings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StudioBookings_Stations_StationId",
                        column: x => x.StationId,
                        principalTable: "Stations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StudioBookings_Users_MemberId",
                        column: x => x.MemberId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FiringRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    KilnScheduleId = table.Column<Guid>(type: "TEXT", nullable: false),
                    StartTime = table.Column<DateTime>(type: "TEXT", nullable: false),
                    EndTime = table.Column<DateTime>(type: "TEXT", nullable: true),
                    StartTemperature = table.Column<decimal>(type: "TEXT", nullable: false),
                    PeakTemperature = table.Column<decimal>(type: "TEXT", nullable: false),
                    Operator = table.Column<string>(type: "TEXT", nullable: true),
                    Notes = table.Column<string>(type: "TEXT", nullable: true),
                    TemperatureLog = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FiringRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FiringRecords_KilnSchedules_KilnScheduleId",
                        column: x => x.KilnScheduleId,
                        principalTable: "KilnSchedules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PieceArchives",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Title = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    MemberId = table.Column<Guid>(type: "TEXT", nullable: false),
                    MemberName = table.Column<string>(type: "TEXT", nullable: true),
                    GlazeRecipeId = table.Column<Guid>(type: "TEXT", nullable: true),
                    GlazeRecipeName = table.Column<string>(type: "TEXT", nullable: true),
                    KilnScheduleId = table.Column<Guid>(type: "TEXT", nullable: true),
                    KilnScheduleName = table.Column<string>(type: "TEXT", nullable: true),
                    MemberTier = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    Weight = table.Column<decimal>(type: "TEXT", nullable: true),
                    Height = table.Column<decimal>(type: "TEXT", nullable: true),
                    Width = table.Column<decimal>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    IsForSale = table.Column<bool>(type: "INTEGER", nullable: false),
                    Price = table.Column<decimal>(type: "TEXT", nullable: true),
                    Tags = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PieceArchives", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PieceArchives_GlazeRecipes_GlazeRecipeId",
                        column: x => x.GlazeRecipeId,
                        principalTable: "GlazeRecipes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_PieceArchives_KilnSchedules_KilnScheduleId",
                        column: x => x.KilnScheduleId,
                        principalTable: "KilnSchedules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_PieceArchives_Users_MemberId",
                        column: x => x.MemberId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CourseRegistrations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    CourseId = table.Column<Guid>(type: "TEXT", nullable: false),
                    MemberId = table.Column<Guid>(type: "TEXT", nullable: false),
                    MemberName = table.Column<string>(type: "TEXT", nullable: true),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    PaidAmount = table.Column<decimal>(type: "TEXT", nullable: false),
                    IsWaitlist = table.Column<bool>(type: "INTEGER", nullable: false),
                    WaitlistPosition = table.Column<int>(type: "INTEGER", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CourseRegistrations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CourseRegistrations_Courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CourseRegistrations_Users_MemberId",
                        column: x => x.MemberId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CourseSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    CourseId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Date = table.Column<DateTime>(type: "TEXT", nullable: false),
                    StartTime = table.Column<TimeSpan>(type: "TEXT", nullable: false),
                    EndTime = table.Column<TimeSpan>(type: "TEXT", nullable: false),
                    Topic = table.Column<string>(type: "TEXT", nullable: true),
                    QrCode = table.Column<string>(type: "TEXT", nullable: true),
                    QrCodeExpiry = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CourseSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CourseSessions_Courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PiecePhotos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    PieceId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Stage = table.Column<string>(type: "TEXT", nullable: false),
                    Url = table.Column<string>(type: "TEXT", nullable: false),
                    ThumbnailUrl = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    UploadedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PiecePhotos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PiecePhotos_PieceArchives_PieceId",
                        column: x => x.PieceId,
                        principalTable: "PieceArchives",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalesItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    PieceId = table.Column<Guid>(type: "TEXT", nullable: false),
                    PieceTitle = table.Column<string>(type: "TEXT", nullable: true),
                    PieceImage = table.Column<string>(type: "TEXT", nullable: true),
                    Price = table.Column<decimal>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    ListedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    SoldAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    BuyerName = table.Column<string>(type: "TEXT", nullable: true),
                    BuyerContact = table.Column<string>(type: "TEXT", nullable: true),
                    AuthorShare = table.Column<decimal>(type: "TEXT", nullable: true),
                    StudioShare = table.Column<decimal>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalesItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SalesItems_PieceArchives_PieceId",
                        column: x => x.PieceId,
                        principalTable: "PieceArchives",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AttendanceRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    CourseSessionId = table.Column<Guid>(type: "TEXT", nullable: false),
                    MemberId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CheckInTime = table.Column<DateTime>(type: "TEXT", nullable: true),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    QrCode = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CourseRegistrationId = table.Column<Guid>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AttendanceRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AttendanceRecords_CourseRegistrations_CourseRegistrationId",
                        column: x => x.CourseRegistrationId,
                        principalTable: "CourseRegistrations",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_AttendanceRecords_CourseSessions_CourseSessionId",
                        column: x => x.CourseSessionId,
                        principalTable: "CourseSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AttendanceRecords_Users_MemberId",
                        column: x => x.MemberId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AttendanceRecords_CourseRegistrationId",
                table: "AttendanceRecords",
                column: "CourseRegistrationId");

            migrationBuilder.CreateIndex(
                name: "IX_AttendanceRecords_CourseSessionId",
                table: "AttendanceRecords",
                column: "CourseSessionId");

            migrationBuilder.CreateIndex(
                name: "IX_AttendanceRecords_MemberId",
                table: "AttendanceRecords",
                column: "MemberId");

            migrationBuilder.CreateIndex(
                name: "IX_CourseRegistrations_CourseId",
                table: "CourseRegistrations",
                column: "CourseId");

            migrationBuilder.CreateIndex(
                name: "IX_CourseRegistrations_MemberId",
                table: "CourseRegistrations",
                column: "MemberId");

            migrationBuilder.CreateIndex(
                name: "IX_Courses_InstructorId",
                table: "Courses",
                column: "InstructorId");

            migrationBuilder.CreateIndex(
                name: "IX_CourseSessions_CourseId",
                table: "CourseSessions",
                column: "CourseId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomOrders_AssignedTo",
                table: "CustomOrders",
                column: "AssignedTo");

            migrationBuilder.CreateIndex(
                name: "IX_FiringRecords_KilnScheduleId",
                table: "FiringRecords",
                column: "KilnScheduleId");

            migrationBuilder.CreateIndex(
                name: "IX_GlazeIngredients_GlazeRecipeId",
                table: "GlazeIngredients",
                column: "GlazeRecipeId");

            migrationBuilder.CreateIndex(
                name: "IX_GlazeRecipes_Code",
                table: "GlazeRecipes",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GlazeRecipes_ParentId",
                table: "GlazeRecipes",
                column: "ParentId");

            migrationBuilder.CreateIndex(
                name: "IX_KilnSchedules_KilnId",
                table: "KilnSchedules",
                column: "KilnId");

            migrationBuilder.CreateIndex(
                name: "IX_KilnSchedules_Status",
                table: "KilnSchedules",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_MaterialAlerts_IsRead",
                table: "MaterialAlerts",
                column: "IsRead");

            migrationBuilder.CreateIndex(
                name: "IX_MaterialAlerts_MaterialId",
                table: "MaterialAlerts",
                column: "MaterialId");

            migrationBuilder.CreateIndex(
                name: "IX_MaterialTransactions_MaterialId",
                table: "MaterialTransactions",
                column: "MaterialId");

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserId_IsRead",
                table: "Notifications",
                columns: new[] { "UserId", "IsRead" });

            migrationBuilder.CreateIndex(
                name: "IX_PieceArchives_GlazeRecipeId",
                table: "PieceArchives",
                column: "GlazeRecipeId");

            migrationBuilder.CreateIndex(
                name: "IX_PieceArchives_KilnScheduleId",
                table: "PieceArchives",
                column: "KilnScheduleId");

            migrationBuilder.CreateIndex(
                name: "IX_PieceArchives_MemberId",
                table: "PieceArchives",
                column: "MemberId");

            migrationBuilder.CreateIndex(
                name: "IX_PieceArchives_Status",
                table: "PieceArchives",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_PiecePhotos_PieceId",
                table: "PiecePhotos",
                column: "PieceId");

            migrationBuilder.CreateIndex(
                name: "IX_SalesItems_PieceId",
                table: "SalesItems",
                column: "PieceId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StudioBookings_MemberId",
                table: "StudioBookings",
                column: "MemberId");

            migrationBuilder.CreateIndex(
                name: "IX_StudioBookings_StationId",
                table: "StudioBookings",
                column: "StationId");

            migrationBuilder.CreateIndex(
                name: "IX_StudioBookings_Status",
                table: "StudioBookings",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_Username",
                table: "Users",
                column: "Username",
                unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AttendanceRecords");

            migrationBuilder.DropTable(
                name: "CustomOrders");

            migrationBuilder.DropTable(
                name: "FiringRecords");

            migrationBuilder.DropTable(
                name: "GlazeIngredients");

            migrationBuilder.DropTable(
                name: "MaterialAlerts");

            migrationBuilder.DropTable(
                name: "MaterialTransactions");

            migrationBuilder.DropTable(
                name: "Notifications");

            migrationBuilder.DropTable(
                name: "PiecePhotos");

            migrationBuilder.DropTable(
                name: "SalesItems");

            migrationBuilder.DropTable(
                name: "StudioBookings");

            migrationBuilder.DropTable(
                name: "CourseRegistrations");

            migrationBuilder.DropTable(
                name: "CourseSessions");

            migrationBuilder.DropTable(
                name: "Materials");

            migrationBuilder.DropTable(
                name: "PieceArchives");

            migrationBuilder.DropTable(
                name: "Stations");

            migrationBuilder.DropTable(
                name: "Courses");

            migrationBuilder.DropTable(
                name: "GlazeRecipes");

            migrationBuilder.DropTable(
                name: "KilnSchedules");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "Kilns");
        }
    }
}
