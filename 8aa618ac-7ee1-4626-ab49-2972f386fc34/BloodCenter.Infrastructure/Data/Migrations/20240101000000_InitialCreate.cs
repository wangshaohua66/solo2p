using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BloodCenter.Infrastructure.Data.Migrations
{
    public partial class InitialCreate : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "CollectionSites",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false),
                    Code = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
                    Type = table.Column<int>(type: "int", nullable: false),
                    Address_Street = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: true),
                    Address_City = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    Address_Province = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    Address_PostalCode = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true),
                    ContactPhone = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true),
                    ContactPerson = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    IsActive = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    OperatingHours = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    IsDeleted = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CollectionSites", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "Donors",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false),
                    DonorNumber = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    FirstName = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    LastName = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    DateOfBirth = table.Column<DateTime>(type: "date", nullable: false),
                    Gender = table.Column<string>(type: "varchar(10)", maxLength: 10, nullable: false),
                    IdCardNumber = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    PhoneNumber = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                    Email = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    Address_Street = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: true),
                    Address_City = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    Address_Province = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    Address_PostalCode = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true),
                    BloodGroup_ABO = table.Column<int>(type: "int", nullable: true),
                    BloodGroup_Rh = table.Column<int>(type: "int", nullable: true),
                    Status = table.Column<int>(type: "int", nullable: false),
                    DeferralReason = table.Column<int>(type: "int", nullable: true),
                    DeferralUntil = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    LastDonationDate = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    NextEligibleDate = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    TotalDonations = table.Column<int>(type: "int", nullable: false),
                    TotalVolumeDonated = table.Column<decimal>(type: "decimal(65,30)", nullable: false),
                    IsVolunteer = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    Occupation = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    Notes = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    IsDeleted = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Donors", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "Hospitals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false),
                    HospitalCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
                    Address_Street = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: true),
                    Address_City = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    Address_Province = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    Address_PostalCode = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true),
                    ContactPerson = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    ContactPhone = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                    Email = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    IsActive = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    Level = table.Column<int>(type: "int", nullable: false),
                    ApiKey = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    Notes = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    IsDeleted = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Hospitals", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "InventorySettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false),
                    ProductType = table.Column<int>(type: "int", nullable: false),
                    BloodType = table.Column<int>(type: "int", nullable: false),
                    RhFactor = table.Column<int>(type: "int", nullable: false),
                    MinimumLevel = table.Column<int>(type: "int", nullable: false),
                    WarningLevel = table.Column<int>(type: "int", nullable: false),
                    EmergencyReserve = table.Column<int>(type: "int", nullable: false),
                    Notes = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    IsDeleted = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InventorySettings", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false),
                    UserName = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    Email = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    PasswordHash = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: false),
                    FullName = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    EmployeeId = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    Role = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    RefreshToken = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    RefreshTokenExpiry = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    LastLoginAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    IsDeleted = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "DonorMedicalHistories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false),
                    DonorId = table.Column<Guid>(type: "char(36)", nullable: false),
                    QuestionnaireDate = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    HadRecentSurgery = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    SurgeryDate = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    HadBloodTransfusion = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    TransfusionDate = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    HasHepatitis = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    HasHIV = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    HasSyphilis = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    HasMalaria = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    HasHeartDisease = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    HasHighBloodPressure = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    HasDiabetes = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    HasCancer = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    HadVaccination = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    VaccinationDate = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    VaccinationType = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    HadTattoo = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    TattooDate = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    HadDentalWork = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    DentalWorkDate = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    TraveledToMalariaArea = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    TravelDate = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    IsPregnant = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    IsBreastfeeding = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    LastMenstrualDate = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    HasFever = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    TakingMedication = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    MedicationDetails = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    HadAlcohol = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    HadTobacco = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    HadDrugs = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    AdditionalNotes = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true),
                    EligibilityResult = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    DeferralReason = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    DeferralDays = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    IsDeleted = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DonorMedicalHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DonorMedicalHistories_Donors_DonorId",
                        column: x => x.DonorId,
                        principalTable: "Donors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "BloodRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false),
                    RequestNumber = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    HospitalId = table.Column<Guid>(type: "char(36)", nullable: false),
                    PatientName = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    PatientId = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    PatientAge = table.Column<int>(type: "int", nullable: true),
                    PatientGender = table.Column<string>(type: "varchar(10)", maxLength: 10, nullable: true),
                    Diagnosis = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    PatientBloodGroup_ABO = table.Column<int>(type: "int", nullable: false),
                    PatientBloodGroup_Rh = table.Column<int>(type: "int", nullable: false),
                    ProductType = table.Column<int>(type: "int", nullable: false),
                    QuantityRequested = table.Column<int>(type: "int", nullable: false),
                    QuantityIssued = table.Column<int>(type: "int", nullable: false),
                    Urgency = table.Column<int>(type: "int", nullable: false),
                    RequiredDate = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    Ward = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    BedNumber = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true),
                    RequestedBy = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    RequestDoctor = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    TransfusionHistory = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    PregnancyHistory = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    Status = table.Column<int>(type: "int", nullable: false),
                    FulfilledAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    Notes = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    IsDeleted = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BloodRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BloodRequests_Hospitals_HospitalId",
                        column: x => x.HospitalId,
                        principalTable: "Hospitals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "Donations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false),
                    DonationNumber = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    DonorId = table.Column<Guid>(type: "char(36)", nullable: false),
                    CollectionSiteId = table.Column<Guid>(type: "char(36)", nullable: false),
                    NurseId = table.Column<Guid>(type: "char(36)", nullable: false),
                    DonationDate = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    Volume = table.Column<int>(type: "int", nullable: false),
                    BloodGroup_ABO = table.Column<int>(type: "int", nullable: false),
                    BloodGroup_Rh = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    Arm = table.Column<string>(type: "varchar(10)", maxLength: 10, nullable: true),
                    Reaction = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    Notes = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true),
                    InitialScreeningPassed = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    InitialScreeningFailureReason = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    AllTestsPassed = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    IsQuarantined = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    QuarantineReason = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    IsDeleted = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Donations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Donations_CollectionSites_CollectionSiteId",
                        column: x => x.CollectionSiteId,
                        principalTable: "CollectionSites",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Donations_Donors_DonorId",
                        column: x => x.DonorId,
                        principalTable: "Donors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Donations_Users_NurseId",
                        column: x => x.NurseId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "BloodProducts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false),
                    ProductCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    DonationId = table.Column<Guid>(type: "char(36)", nullable: false),
                    ProductType = table.Column<int>(type: "int", nullable: false),
                    BloodGroup_ABO = table.Column<int>(type: "int", nullable: false),
                    BloodGroup_Rh = table.Column<int>(type: "int", nullable: false),
                    Volume = table.Column<int>(type: "int", nullable: false),
                    Unit = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                    ProductionDate = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    ExpiryDate = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    StorageLocation = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    StorageTemperature = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true),
                    Status = table.Column<int>(type: "int", nullable: false),
                    IsSpecialProduct = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    SpecialProductReason = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    PreparationMethod = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    PreparedById = table.Column<Guid>(type: "char(36)", nullable: true),
                    PreparedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    BatchNumber = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    IsDeleted = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BloodProducts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BloodProducts_Donations_DonationId",
                        column: x => x.DonationId,
                        principalTable: "Donations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BloodProducts_Users_PreparedById",
                        column: x => x.PreparedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "BloodTests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false),
                    DonationId = table.Column<Guid>(type: "char(36)", nullable: false),
                    TechnicianId = table.Column<Guid>(type: "char(36)", nullable: false),
                    SecondReviewerId = table.Column<Guid>(type: "char(36)", nullable: true),
                    TestType = table.Column<int>(type: "int", nullable: false),
                    TestItem = table.Column<int>(type: "int", nullable: false),
                    Result = table.Column<int>(type: "int", nullable: false),
                    TestTime = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    ReviewTime = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    TestMethod = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: true),
                    InstrumentUsed = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: true),
                    ReagentLot = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    QuantitativeResult = table.Column<decimal>(type: "decimal(65,30)", nullable: true),
                    Unit = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true),
                    ReferenceRange = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    Notes = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true),
                    IsReReviewed = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    ReviewComment = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    IsDeleted = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BloodTests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BloodTests_Donations_DonationId",
                        column: x => x.DonationId,
                        principalTable: "Donations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BloodTests_Users_SecondReviewerId",
                        column: x => x.SecondReviewerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BloodTests_Users_TechnicianId",
                        column: x => x.TechnicianId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "InitialScreenings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false),
                    DonationId = table.Column<Guid>(type: "char(36)", nullable: false),
                    TechnicianId = table.Column<Guid>(type: "char(36)", nullable: false),
                    ScreeningTime = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    BloodType = table.Column<int>(type: "int", nullable: false),
                    RhFactor = table.Column<int>(type: "int", nullable: false),
                    Hemoglobin = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    ALT = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    HBsAg = table.Column<int>(type: "int", nullable: false),
                    Passed = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    FailureReason = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    Notes = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    IsDeleted = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InitialScreenings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InitialScreenings_Donations_DonationId",
                        column: x => x.DonationId,
                        principalTable: "Donations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InitialScreenings_Users_TechnicianId",
                        column: x => x.TechnicianId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "CrossMatches",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false),
                    BloodRequestId = table.Column<Guid>(type: "char(36)", nullable: false),
                    BloodProductId = table.Column<Guid>(type: "char(36)", nullable: false),
                    TechnicianId = table.Column<Guid>(type: "char(36)", nullable: false),
                    TestTime = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    MajorSideResult = table.Column<int>(type: "int", nullable: false),
                    MinorSideResult = table.Column<int>(type: "int", nullable: false),
                    OverallResult = table.Column<int>(type: "int", nullable: false),
                    TestMethod = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: true),
                    ReagentUsed = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: true),
                    IncubationTime = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true),
                    Temperature = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true),
                    Phases = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    AntiHumanGlobulin = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true),
                    Notes = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true),
                    IsReserved = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    ReservedUntil = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    IsDeleted = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CrossMatches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CrossMatches_BloodProducts_BloodProductId",
                        column: x => x.BloodProductId,
                        principalTable: "BloodProducts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CrossMatches_BloodRequests_BloodRequestId",
                        column: x => x.BloodRequestId,
                        principalTable: "BloodRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CrossMatches_Users_TechnicianId",
                        column: x => x.TechnicianId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "ScrapRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false),
                    BloodProductId = table.Column<Guid>(type: "char(36)", nullable: false),
                    Reason = table.Column<int>(type: "int", nullable: false),
                    DetailedReason = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true),
                    ScrapDate = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    OperatorId = table.Column<Guid>(type: "char(36)", nullable: false),
                    ApprovedById = table.Column<Guid>(type: "char(36)", nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DisposalMethod = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: true),
                    Notes = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    IsDeleted = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScrapRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScrapRecords_BloodProducts_BloodProductId",
                        column: x => x.BloodProductId,
                        principalTable: "BloodProducts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScrapRecords_Users_ApprovedById",
                        column: x => x.ApprovedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScrapRecords_Users_OperatorId",
                        column: x => x.OperatorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_BloodProducts_BloodGroup_ABO",
                table: "BloodProducts",
                column: "BloodGroup_ABO");

            migrationBuilder.CreateIndex(
                name: "IX_BloodProducts_BloodGroup_Rh",
                table: "BloodProducts",
                column: "BloodGroup_Rh");

            migrationBuilder.CreateIndex(
                name: "IX_BloodProducts_DonationId",
                table: "BloodProducts",
                column: "DonationId");

            migrationBuilder.CreateIndex(
                name: "IX_BloodProducts_ExpiryDate",
                table: "BloodProducts",
                column: "ExpiryDate");

            migrationBuilder.CreateIndex(
                name: "IX_BloodProducts_IsDeleted",
                table: "BloodProducts",
                column: "IsDeleted");

            migrationBuilder.CreateIndex(
                name: "IX_BloodProducts_PreparedById",
                table: "BloodProducts",
                column: "PreparedById");

            migrationBuilder.CreateIndex(
                name: "IX_BloodProducts_ProductCode",
                table: "BloodProducts",
                column: "ProductCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BloodProducts_ProductType_Status_ExpiryDate",
                table: "BloodProducts",
                columns: new[] { "ProductType", "Status", "ExpiryDate" });

            migrationBuilder.CreateIndex(
                name: "IX_BloodProducts_Status",
                table: "BloodProducts",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_BloodProducts_Status_ExpiryDate",
                table: "BloodProducts",
                columns: new[] { "Status", "ExpiryDate" });

            migrationBuilder.CreateIndex(
                name: "IX_BloodProducts_StorageLocation",
                table: "BloodProducts",
                column: "StorageLocation");

            migrationBuilder.CreateIndex(
                name: "IX_BloodProducts_ProductType",
                table: "BloodProducts",
                column: "ProductType");

            migrationBuilder.CreateIndex(
                name: "IX_BloodRequests_HospitalId",
                table: "BloodRequests",
                column: "HospitalId");

            migrationBuilder.CreateIndex(
                name: "IX_BloodRequests_HospitalId_Status_RequiredDate",
                table: "BloodRequests",
                columns: new[] { "HospitalId", "Status", "RequiredDate" });

            migrationBuilder.CreateIndex(
                name: "IX_BloodRequests_IsDeleted",
                table: "BloodRequests",
                column: "IsDeleted");

            migrationBuilder.CreateIndex(
                name: "IX_BloodRequests_PatientId",
                table: "BloodRequests",
                column: "PatientId");

            migrationBuilder.CreateIndex(
                name: "IX_BloodRequests_ProductType",
                table: "BloodRequests",
                column: "ProductType");

            migrationBuilder.CreateIndex(
                name: "IX_BloodRequests_RequestNumber",
                table: "BloodRequests",
                column: "RequestNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BloodRequests_RequiredDate",
                table: "BloodRequests",
                column: "RequiredDate");

            migrationBuilder.CreateIndex(
                name: "IX_BloodRequests_Status",
                table: "BloodRequests",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_BloodRequests_Urgency",
                table: "BloodRequests",
                column: "Urgency");

            migrationBuilder.CreateIndex(
                name: "IX_BloodTests_DonationId",
                table: "BloodTests",
                column: "DonationId");

            migrationBuilder.CreateIndex(
                name: "IX_BloodTests_DonationId_TestType_TestItem",
                table: "BloodTests",
                columns: new[] { "DonationId", "TestType", "TestItem" });

            migrationBuilder.CreateIndex(
                name: "IX_BloodTests_IsDeleted",
                table: "BloodTests",
                column: "IsDeleted");

            migrationBuilder.CreateIndex(
                name: "IX_BloodTests_Result",
                table: "BloodTests",
                column: "Result");

            migrationBuilder.CreateIndex(
                name: "IX_BloodTests_Result_TestTime",
                table: "BloodTests",
                columns: new[] { "Result", "TestTime" });

            migrationBuilder.CreateIndex(
                name: "IX_BloodTests_SecondReviewerId",
                table: "BloodTests",
                column: "SecondReviewerId");

            migrationBuilder.CreateIndex(
                name: "IX_BloodTests_TechnicianId",
                table: "BloodTests",
                column: "TechnicianId");

            migrationBuilder.CreateIndex(
                name: "IX_BloodTests_TestItem",
                table: "BloodTests",
                column: "TestItem");

            migrationBuilder.CreateIndex(
                name: "IX_BloodTests_TestTime",
                table: "BloodTests",
                column: "TestTime");

            migrationBuilder.CreateIndex(
                name: "IX_BloodTests_TestType",
                table: "BloodTests",
                column: "TestType");

            migrationBuilder.CreateIndex(
                name: "IX_CollectionSites_Code",
                table: "CollectionSites",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CollectionSites_IsActive",
                table: "CollectionSites",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_CollectionSites_IsDeleted",
                table: "CollectionSites",
                column: "IsDeleted");

            migrationBuilder.CreateIndex(
                name: "IX_CollectionSites_Type",
                table: "CollectionSites",
                column: "Type");

            migrationBuilder.CreateIndex(
                name: "IX_CrossMatches_BloodProductId",
                table: "CrossMatches",
                column: "BloodProductId");

            migrationBuilder.CreateIndex(
                name: "IX_CrossMatches_BloodRequestId",
                table: "CrossMatches",
                column: "BloodRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_CrossMatches_BloodRequestId_OverallResult",
                table: "CrossMatches",
                columns: new[] { "BloodRequestId", "OverallResult" });

            migrationBuilder.CreateIndex(
                name: "IX_CrossMatches_IsDeleted",
                table: "CrossMatches",
                column: "IsDeleted");

            migrationBuilder.CreateIndex(
                name: "IX_CrossMatches_OverallResult",
                table: "CrossMatches",
                column: "OverallResult");

            migrationBuilder.CreateIndex(
                name: "IX_CrossMatches_TechnicianId",
                table: "CrossMatches",
                column: "TechnicianId");

            migrationBuilder.CreateIndex(
                name: "IX_CrossMatches_TestTime",
                table: "CrossMatches",
                column: "TestTime");

            migrationBuilder.CreateIndex(
                name: "IX_Donations_CollectionSiteId",
                table: "Donations",
                column: "CollectionSiteId");

            migrationBuilder.CreateIndex(
                name: "IX_Donations_DonationDate",
                table: "Donations",
                column: "DonationDate");

            migrationBuilder.CreateIndex(
                name: "IX_Donations_DonationNumber",
                table: "Donations",
                column: "DonationNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Donations_DonorId",
                table: "Donations",
                column: "DonorId");

            migrationBuilder.CreateIndex(
                name: "IX_Donations_DonorId_DonationDate",
                table: "Donations",
                columns: new[] { "DonorId", "DonationDate" });

            migrationBuilder.CreateIndex(
                name: "IX_Donations_IsDeleted",
                table: "Donations",
                column: "IsDeleted");

            migrationBuilder.CreateIndex(
                name: "IX_Donations_NurseId",
                table: "Donations",
                column: "NurseId");

            migrationBuilder.CreateIndex(
                name: "IX_Donations_Status",
                table: "Donations",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_DonorMedicalHistories_DonorId",
                table: "DonorMedicalHistories",
                column: "DonorId");

            migrationBuilder.CreateIndex(
                name: "IX_DonorMedicalHistories_EligibilityResult",
                table: "DonorMedicalHistories",
                column: "EligibilityResult");

            migrationBuilder.CreateIndex(
                name: "IX_DonorMedicalHistories_IsDeleted",
                table: "DonorMedicalHistories",
                column: "IsDeleted");

            migrationBuilder.CreateIndex(
                name: "IX_DonorMedicalHistories_QuestionnaireDate",
                table: "DonorMedicalHistories",
                column: "QuestionnaireDate");

            migrationBuilder.CreateIndex(
                name: "IX_Donors_DonorNumber",
                table: "Donors",
                column: "DonorNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Donors_IdCardNumber",
                table: "Donors",
                column: "IdCardNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Donors_IsDeleted",
                table: "Donors",
                column: "IsDeleted");

            migrationBuilder.CreateIndex(
                name: "IX_Donors_PhoneNumber",
                table: "Donors",
                column: "PhoneNumber");

            migrationBuilder.CreateIndex(
                name: "IX_Donors_Status",
                table: "Donors",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Hospitals_HospitalCode",
                table: "Hospitals",
                column: "HospitalCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Hospitals_IsActive",
                table: "Hospitals",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_Hospitals_IsDeleted",
                table: "Hospitals",
                column: "IsDeleted");

            migrationBuilder.CreateIndex(
                name: "IX_InitialScreenings_DonationId",
                table: "InitialScreenings",
                column: "DonationId");

            migrationBuilder.CreateIndex(
                name: "IX_InitialScreenings_IsDeleted",
                table: "InitialScreenings",
                column: "IsDeleted");

            migrationBuilder.CreateIndex(
                name: "IX_InitialScreenings_Passed",
                table: "InitialScreenings",
                column: "Passed");

            migrationBuilder.CreateIndex(
                name: "IX_InitialScreenings_ScreeningTime",
                table: "InitialScreenings",
                column: "ScreeningTime");

            migrationBuilder.CreateIndex(
                name: "IX_InitialScreenings_TechnicianId",
                table: "InitialScreenings",
                column: "TechnicianId");

            migrationBuilder.CreateIndex(
                name: "IX_InventorySettings_IsDeleted",
                table: "InventorySettings",
                column: "IsDeleted");

            migrationBuilder.CreateIndex(
                name: "IX_InventorySettings_ProductType_BloodType_RhFactor",
                table: "InventorySettings",
                columns: new[] { "ProductType", "BloodType", "RhFactor" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScrapRecords_BloodProductId",
                table: "ScrapRecords",
                column: "BloodProductId");

            migrationBuilder.CreateIndex(
                name: "IX_ScrapRecords_IsDeleted",
                table: "ScrapRecords",
                column: "IsDeleted");

            migrationBuilder.CreateIndex(
                name: "IX_ScrapRecords_OperatorId",
                table: "ScrapRecords",
                column: "OperatorId");

            migrationBuilder.CreateIndex(
                name: "IX_ScrapRecords_Reason",
                table: "ScrapRecords",
                column: "Reason");

            migrationBuilder.CreateIndex(
                name: "IX_ScrapRecords_Reason_ScrapDate",
                table: "ScrapRecords",
                columns: new[] { "Reason", "ScrapDate" });

            migrationBuilder.CreateIndex(
                name: "IX_ScrapRecords_ApprovedById",
                table: "ScrapRecords",
                column: "ApprovedById");

            migrationBuilder.CreateIndex(
                name: "IX_ScrapRecords_ScrapDate",
                table: "ScrapRecords",
                column: "ScrapDate");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_EmployeeId",
                table: "Users",
                column: "EmployeeId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_IsActive",
                table: "Users",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_Users_IsDeleted",
                table: "Users",
                column: "IsDeleted");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Role",
                table: "Users",
                column: "Role");

            migrationBuilder.CreateIndex(
                name: "IX_Users_UserName",
                table: "Users",
                column: "UserName",
                unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BloodTests");

            migrationBuilder.DropTable(
                name: "CrossMatches");

            migrationBuilder.DropTable(
                name: "DonorMedicalHistories");

            migrationBuilder.DropTable(
                name: "InitialScreenings");

            migrationBuilder.DropTable(
                name: "InventorySettings");

            migrationBuilder.DropTable(
                name: "ScrapRecords");

            migrationBuilder.DropTable(
                name: "BloodProducts");

            migrationBuilder.DropTable(
                name: "BloodRequests");

            migrationBuilder.DropTable(
                name: "Donations");

            migrationBuilder.DropTable(
                name: "Hospitals");

            migrationBuilder.DropTable(
                name: "CollectionSites");

            migrationBuilder.DropTable(
                name: "Donors");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
