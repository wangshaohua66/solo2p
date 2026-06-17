using System;
using BloodCenter.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

#nullable disable

namespace BloodCenter.Infrastructure.Data.Migrations
{
    [DbContext(typeof(BloodCenterDbContext))]
    partial class BloodCenterDbContextModelSnapshot : ModelSnapshot
    {
        protected override void BuildModel(ModelBuilder modelBuilder)
        {
#pragma warning disable 612, 618
            modelBuilder
                .HasAnnotation("ProductVersion", "8.0.10")
                .HasAnnotation("Relational:MaxIdentifierLength", 64);

            modelBuilder.CharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci");

            modelBuilder.Entity("BloodCenter.Core.Entities.BloodProduct", b =>
                {
                    b.Property<Guid>("Id")
                        .HasColumnType("char(36)");

                    b.Property<DateTime>("CreatedAt")
                        .HasColumnType("datetime(6)");

                    b.Property<DateTime>("ExpiryDate")
                        .HasColumnType("datetime(6)");

                    b.Property<bool>("IsDeleted")
                        .HasColumnType("tinyint(1)");

                    b.Property<bool>("IsSpecialProduct")
                        .HasColumnType("tinyint(1)");

                    b.Property<string>("Notes")
                        .HasMaxLength(1000)
                        .HasColumnType("varchar(1000)");

                    b.Property<DateTime>("PreparedAt")
                        .HasColumnType("datetime(6)");

                    b.Property<Guid?>("PreparedById")
                        .HasColumnType("char(36)");

                    b.Property<string>("PreparationMethod")
                        .HasMaxLength(500)
                        .HasColumnType("varchar(500)");

                    b.Property<string>("ProductCode")
                        .IsRequired()
                        .HasMaxLength(50)
                        .HasColumnType("varchar(50)");

                    b.Property<int>("ProductType")
                        .HasColumnType("int");

                    b.Property<DateTime>("ProductionDate")
                        .HasColumnType("datetime(6)");

                    b.Property<Guid>("DonationId")
                        .HasColumnType("char(36)");

                    b.Property<string>("SpecialProductReason")
                        .HasMaxLength(500)
                        .HasColumnType("varchar(500)");

                    b.Property<int>("Status")
                        .HasColumnType("int");

                    b.Property<string>("StorageLocation")
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<string>("StorageTemperature")
                        .HasMaxLength(50)
                        .HasColumnType("varchar(50)");

                    b.Property<string>("BatchNumber")
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<string>("Unit")
                        .IsRequired()
                        .HasMaxLength(20)
                        .HasColumnType("varchar(20)");

                    b.Property<DateTime>("UpdatedAt")
                        .HasColumnType("datetime(6)");

                    b.Property<int>("Volume")
                        .HasColumnType("int");

                    b.Property<int>("BloodGroup_ABO")
                        .HasColumnType("int");

                    b.Property<int>("BloodGroup_Rh")
                        .HasColumnType("int");

                    b.HasKey("Id");

                    b.HasIndex("BloodGroup_ABO");

                    b.HasIndex("BloodGroup_Rh");

                    b.HasIndex("DonationId");

                    b.HasIndex("ExpiryDate");

                    b.HasIndex("IsDeleted");

                    b.HasIndex("PreparedById");

                    b.HasIndex("ProductCode")
                        .IsUnique();

                    b.HasIndex("ProductType", "Status", "ExpiryDate");

                    b.HasIndex("Status");

                    b.HasIndex("Status", "ExpiryDate");

                    b.HasIndex("StorageLocation");

                    b.HasIndex("ProductType");

                    b.ToTable("BloodProducts", (string)null);

                    b.HasDiscriminator<string>("Discriminator")
                        .HasColumnName("Discriminator")
                        .HasColumnType("longtext");

                    b.UseTphMappingStrategy();

                    b.HasQueryFilter("IsDeleted == False");

                    b.Navigation("Donation");

                    b.Navigation("PreparedBy");

                    b.Navigation("ScrapRecords");

                    b.Navigation("CrossMatches");
                });

            modelBuilder.Entity("BloodCenter.Core.Entities.BloodRequest", b =>
                {
                    b.Property<Guid>("Id")
                        .HasColumnType("char(36)");

                    b.Property<DateTime>("CreatedAt")
                        .HasColumnType("datetime(6)");

                    b.Property<bool>("IsDeleted")
                        .HasColumnType("tinyint(1)");

                    b.Property<string>("Notes")
                        .HasMaxLength(1000)
                        .HasColumnType("varchar(1000)");

                    b.Property<Guid>("HospitalId")
                        .HasColumnType("char(36)");

                    b.Property<int>("ProductType")
                        .HasColumnType("int");

                    b.Property<int>("QuantityIssued")
                        .HasColumnType("int");

                    b.Property<int>("QuantityRequested")
                        .HasColumnType("int");

                    b.Property<string>("RequestNumber")
                        .IsRequired()
                        .HasMaxLength(50)
                        .HasColumnType("varchar(50)");

                    b.Property<DateTime>("RequiredDate")
                        .HasColumnType("datetime(6)");

                    b.Property<string>("PatientName")
                        .IsRequired()
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<string>("PatientId")
                        .IsRequired()
                        .HasMaxLength(50)
                        .HasColumnType("varchar(50)");

                    b.Property<int?>("PatientAge")
                        .HasColumnType("int");

                    b.Property<string>("PatientGender")
                        .HasMaxLength(10)
                        .HasColumnType("varchar(10)");

                    b.Property<string>("Diagnosis")
                        .HasMaxLength(500)
                        .HasColumnType("varchar(500)");

                    b.Property<int>("PatientBloodGroup_ABO")
                        .HasColumnType("int");

                    b.Property<int>("PatientBloodGroup_Rh")
                        .HasColumnType("int");

                    b.Property<int>("Urgency")
                        .HasColumnType("int");

                    b.Property<string>("Ward")
                        .IsRequired()
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<string>("BedNumber")
                        .HasMaxLength(20)
                        .HasColumnType("varchar(20)");

                    b.Property<string>("RequestedBy")
                        .IsRequired()
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<string>("RequestDoctor")
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<string>("TransfusionHistory")
                        .HasMaxLength(500)
                        .HasColumnType("varchar(500)");

                    b.Property<string>("PregnancyHistory")
                        .HasMaxLength(500)
                        .HasColumnType("varchar(500)");

                    b.Property<int>("Status")
                        .HasColumnType("int");

                    b.Property<DateTime?>("FulfilledAt")
                        .HasColumnType("datetime(6)");

                    b.Property<DateTime>("UpdatedAt")
                        .HasColumnType("datetime(6)");

                    b.HasKey("Id");

                    b.HasIndex("HospitalId");

                    b.HasIndex("HospitalId", "Status", "RequiredDate");

                    b.HasIndex("IsDeleted");

                    b.HasIndex("PatientId");

                    b.HasIndex("ProductType");

                    b.HasIndex("RequestNumber")
                        .IsUnique();

                    b.HasIndex("RequiredDate");

                    b.HasIndex("Status");

                    b.HasIndex("Urgency");

                    b.ToTable("BloodRequests", (string)null);

                    b.HasDiscriminator<string>("Discriminator")
                        .HasColumnName("Discriminator")
                        .HasColumnType("longtext");

                    b.UseTphMappingStrategy();

                    b.HasQueryFilter("IsDeleted == False");

                    b.Navigation("Hospital");

                    b.Navigation("CrossMatches");
                });

            modelBuilder.Entity("BloodCenter.Core.Entities.BloodTest", b =>
                {
                    b.Property<Guid>("Id")
                        .HasColumnType("char(36)");

                    b.Property<DateTime>("CreatedAt")
                        .HasColumnType("datetime(6)");

                    b.Property<bool>("IsDeleted")
                        .HasColumnType("tinyint(1)");

                    b.Property<bool>("IsReReviewed")
                        .HasColumnType("tinyint(1)");

                    b.Property<string>("Notes")
                        .HasMaxLength(1000)
                        .HasColumnType("varchar(1000)");

                    b.Property<decimal?>("QuantitativeResult")
                        .HasColumnType("decimal(65,30)");

                    b.Property<string>("ReferenceRange")
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<string>("ReagentLot")
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<string>("ReviewComment")
                        .HasMaxLength(1000)
                        .HasColumnType("varchar(1000)");

                    b.Property<DateTime?>("ReviewTime")
                        .HasColumnType("datetime(6)");

                    b.Property<Guid?>("SecondReviewerId")
                        .HasColumnType("char(36)");

                    b.Property<int>("Result")
                        .HasColumnType("int");

                    b.Property<Guid>("DonationId")
                        .HasColumnType("char(36)");

                    b.Property<Guid>("TechnicianId")
                        .HasColumnType("char(36)");

                    b.Property<int>("TestItem")
                        .HasColumnType("int");

                    b.Property<string>("TestMethod")
                        .HasMaxLength(200)
                        .HasColumnType("varchar(200)");

                    b.Property<DateTime?>("TestTime")
                        .HasColumnType("datetime(6)");

                    b.Property<int>("TestType")
                        .HasColumnType("int");

                    b.Property<string>("Unit")
                        .HasMaxLength(50)
                        .HasColumnType("varchar(50)");

                    b.Property<DateTime>("UpdatedAt")
                        .HasColumnType("datetime(6)");

                    b.Property<string>("InstrumentUsed")
                        .HasMaxLength(200)
                        .HasColumnType("varchar(200)");

                    b.HasKey("Id");

                    b.HasIndex("DonationId");

                    b.HasIndex("DonationId", "TestType", "TestItem");

                    b.HasIndex("IsDeleted");

                    b.HasIndex("Result");

                    b.HasIndex("Result", "TestTime");

                    b.HasIndex("SecondReviewerId");

                    b.HasIndex("TechnicianId");

                    b.HasIndex("TestItem");

                    b.HasIndex("TestTime");

                    b.HasIndex("TestType");

                    b.ToTable("BloodTests", (string)null);

                    b.HasDiscriminator<string>("Discriminator")
                        .HasColumnName("Discriminator")
                        .HasColumnType("longtext");

                    b.UseTphMappingStrategy();

                    b.HasQueryFilter("IsDeleted == False");

                    b.Navigation("Donation");

                    b.Navigation("Technician");

                    b.Navigation("SecondReviewer");
                });

            modelBuilder.Entity("BloodCenter.Core.Entities.CollectionSite", b =>
                {
                    b.Property<Guid>("Id")
                        .HasColumnType("char(36)");

                    b.Property<string>("Code")
                        .IsRequired()
                        .HasMaxLength(50)
                        .HasColumnType("varchar(50)");

                    b.Property<DateTime>("CreatedAt")
                        .HasColumnType("datetime(6)");

                    b.Property<bool>("IsActive")
                        .HasColumnType("tinyint(1)");

                    b.Property<bool>("IsDeleted")
                        .HasColumnType("tinyint(1)");

                    b.Property<string>("Name")
                        .IsRequired()
                        .HasMaxLength(200)
                        .HasColumnType("varchar(200)");

                    b.Property<string>("OperatingHours")
                        .HasMaxLength(500)
                        .HasColumnType("varchar(500)");

                    b.Property<int>("Type")
                        .HasColumnType("int");

                    b.Property<DateTime>("UpdatedAt")
                        .HasColumnType("datetime(6)");

                    b.Property<string>("ContactPhone")
                        .HasMaxLength(20)
                        .HasColumnType("varchar(20)");

                    b.Property<string>("ContactPerson")
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<string>("Address_Street")
                        .HasMaxLength(200)
                        .HasColumnType("varchar(200)");

                    b.Property<string>("Address_City")
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<string>("Address_Province")
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<string>("Address_PostalCode")
                        .HasMaxLength(20)
                        .HasColumnType("varchar(20)");

                    b.HasKey("Id");

                    b.HasIndex("Code")
                        .IsUnique();

                    b.HasIndex("IsActive");

                    b.HasIndex("IsDeleted");

                    b.HasIndex("Type");

                    b.ToTable("CollectionSites", (string)null);

                    b.HasDiscriminator<string>("Discriminator")
                        .HasColumnName("Discriminator")
                        .HasColumnType("longtext");

                    b.UseTphMappingStrategy();

                    b.HasQueryFilter("IsDeleted == False");

                    b.Navigation("Donations");
                });

            modelBuilder.Entity("BloodCenter.Core.Entities.CrossMatch", b =>
                {
                    b.Property<Guid>("Id")
                        .HasColumnType("char(36)");

                    b.Property<Guid>("BloodProductId")
                        .HasColumnType("char(36)");

                    b.Property<Guid>("BloodRequestId")
                        .HasColumnType("char(36)");

                    b.Property<DateTime>("CreatedAt")
                        .HasColumnType("datetime(6)");

                    b.Property<bool>("IsDeleted")
                        .HasColumnType("tinyint(1)");

                    b.Property<bool>("IsReserved")
                        .HasColumnType("tinyint(1)");

                    b.Property<string>("Notes")
                        .HasMaxLength(1000)
                        .HasColumnType("varchar(1000)");

                    b.Property<int>("MajorSideResult")
                        .HasColumnType("int");

                    b.Property<int>("MinorSideResult")
                        .HasColumnType("int");

                    b.Property<int>("OverallResult")
                        .HasColumnType("int");

                    b.Property<DateTime?>("ReservedUntil")
                        .HasColumnType("datetime(6)");

                    b.Property<Guid>("TechnicianId")
                        .HasColumnType("char(36)");

                    b.Property<string>("TestMethod")
                        .HasMaxLength(200)
                        .HasColumnType("varchar(200)");

                    b.Property<DateTime>("TestTime")
                        .HasColumnType("datetime(6)");

                    b.Property<DateTime>("UpdatedAt")
                        .HasColumnType("datetime(6)");

                    b.Property<string>("ReagentUsed")
                        .HasMaxLength(200)
                        .HasColumnType("varchar(200)");

                    b.Property<string>("IncubationTime")
                        .HasMaxLength(50)
                        .HasColumnType("varchar(50)");

                    b.Property<string>("Temperature")
                        .HasMaxLength(50)
                        .HasColumnType("varchar(50)");

                    b.Property<string>("Phases")
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<string>("AntiHumanGlobulin")
                        .HasMaxLength(50)
                        .HasColumnType("varchar(50)");

                    b.HasKey("Id");

                    b.HasIndex("BloodProductId");

                    b.HasIndex("BloodRequestId");

                    b.HasIndex("BloodRequestId", "OverallResult");

                    b.HasIndex("IsDeleted");

                    b.HasIndex("OverallResult");

                    b.HasIndex("TechnicianId");

                    b.HasIndex("TestTime");

                    b.ToTable("CrossMatches", (string)null);

                    b.HasDiscriminator<string>("Discriminator")
                        .HasColumnName("Discriminator")
                        .HasColumnType("longtext");

                    b.UseTphMappingStrategy();

                    b.HasQueryFilter("IsDeleted == False");

                    b.Navigation("BloodProduct");

                    b.Navigation("BloodRequest");

                    b.Navigation("Technician");
                });

            modelBuilder.Entity("BloodCenter.Core.Entities.Donation", b =>
                {
                    b.Property<Guid>("Id")
                        .HasColumnType("char(36)");

                    b.Property<bool>("AllTestsPassed")
                        .HasColumnType("tinyint(1)");

                    b.Property<string>("Arm")
                        .HasMaxLength(10)
                        .HasColumnType("varchar(10)");

                    b.Property<Guid>("CollectionSiteId")
                        .HasColumnType("char(36)");

                    b.Property<DateTime>("CreatedAt")
                        .HasColumnType("datetime(6)");

                    b.Property<DateTime>("DonationDate")
                        .HasColumnType("datetime(6)");

                    b.Property<string>("DonationNumber")
                        .IsRequired()
                        .HasMaxLength(50)
                        .HasColumnType("varchar(50)");

                    b.Property<Guid>("DonorId")
                        .HasColumnType("char(36)");

                    b.Property<bool>("InitialScreeningPassed")
                        .HasColumnType("tinyint(1)");

                    b.Property<string>("InitialScreeningFailureReason")
                        .HasMaxLength(500)
                        .HasColumnType("varchar(500)");

                    b.Property<bool>("IsDeleted")
                        .HasColumnType("tinyint(1)");

                    b.Property<bool>("IsQuarantined")
                        .HasColumnType("tinyint(1)");

                    b.Property<string>("Notes")
                        .HasMaxLength(1000)
                        .HasColumnType("varchar(1000)");

                    b.Property<Guid>("NurseId")
                        .HasColumnType("char(36)");

                    b.Property<string>("QuarantineReason")
                        .HasMaxLength(500)
                        .HasColumnType("varchar(500)");

                    b.Property<string>("Reaction")
                        .HasMaxLength(500)
                        .HasColumnType("varchar(500)");

                    b.Property<int>("Status")
                        .HasColumnType("int");

                    b.Property<DateTime>("UpdatedAt")
                        .HasColumnType("datetime(6)");

                    b.Property<int>("Volume")
                        .HasColumnType("int");

                    b.Property<int>("BloodGroup_ABO")
                        .HasColumnType("int");

                    b.Property<int>("BloodGroup_Rh")
                        .HasColumnType("int");

                    b.HasKey("Id");

                    b.HasIndex("CollectionSiteId");

                    b.HasIndex("DonationDate");

                    b.HasIndex("DonationNumber")
                        .IsUnique();

                    b.HasIndex("DonorId");

                    b.HasIndex("DonorId", "DonationDate");

                    b.HasIndex("IsDeleted");

                    b.HasIndex("NurseId");

                    b.HasIndex("Status");

                    b.ToTable("Donations", (string)null);

                    b.HasDiscriminator<string>("Discriminator")
                        .HasColumnName("Discriminator")
                        .HasColumnType("longtext");

                    b.UseTphMappingStrategy();

                    b.HasQueryFilter("IsDeleted == False");

                    b.Navigation("Donor");

                    b.Navigation("CollectionSite");

                    b.Navigation("Nurse");

                    b.Navigation("InitialScreenings");

                    b.Navigation("BloodTests");

                    b.Navigation("BloodProducts");
                });

            modelBuilder.Entity("BloodCenter.Core.Entities.Donor", b =>
                {
                    b.Property<Guid>("Id")
                        .HasColumnType("char(36)");

                    b.Property<DateTime>("CreatedAt")
                        .HasColumnType("datetime(6)");

                    b.Property<DateTime>("DateOfBirth")
                        .HasColumnType("date");

                    b.Property<int?>("DeferralReason")
                        .HasColumnType("int");

                    b.Property<DateTime?>("DeferralUntil")
                        .HasColumnType("datetime(6)");

                    b.Property<string>("DonorNumber")
                        .IsRequired()
                        .HasMaxLength(50)
                        .HasColumnType("varchar(50)");

                    b.Property<string>("Email")
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<string>("FirstName")
                        .IsRequired()
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<string>("Gender")
                        .IsRequired()
                        .HasMaxLength(10)
                        .HasColumnType("varchar(10)");

                    b.Property<string>("IdCardNumber")
                        .IsRequired()
                        .HasMaxLength(50)
                        .HasColumnType("varchar(50)");

                    b.Property<bool>("IsDeleted")
                        .HasColumnType("tinyint(1)");

                    b.Property<bool>("IsVolunteer")
                        .HasColumnType("tinyint(1)");

                    b.Property<DateTime?>("LastDonationDate")
                        .HasColumnType("datetime(6)");

                    b.Property<string>("LastName")
                        .IsRequired()
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<DateTime?>("NextEligibleDate")
                        .HasColumnType("datetime(6)");

                    b.Property<string>("Notes")
                        .HasMaxLength(1000)
                        .HasColumnType("varchar(1000)");

                    b.Property<string>("Occupation")
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<string>("PhoneNumber")
                        .IsRequired()
                        .HasMaxLength(20)
                        .HasColumnType("varchar(20)");

                    b.Property<int>("Status")
                        .HasColumnType("int");

                    b.Property<int>("TotalDonations")
                        .HasColumnType("int");

                    b.Property<decimal>("TotalVolumeDonated")
                        .HasColumnType("decimal(65,30)");

                    b.Property<DateTime>("UpdatedAt")
                        .HasColumnType("datetime(6)");

                    b.Property<string>("Address_Street")
                        .HasMaxLength(200)
                        .HasColumnType("varchar(200)");

                    b.Property<string>("Address_City")
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<string>("Address_Province")
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<string>("Address_PostalCode")
                        .HasMaxLength(20)
                        .HasColumnType("varchar(20)");

                    b.Property<int?>("BloodGroup_ABO")
                        .HasColumnType("int");

                    b.Property<int?>("BloodGroup_Rh")
                        .HasColumnType("int");

                    b.HasKey("Id");

                    b.HasIndex("DonorNumber")
                        .IsUnique();

                    b.HasIndex("IdCardNumber")
                        .IsUnique();

                    b.HasIndex("IsDeleted");

                    b.HasIndex("PhoneNumber");

                    b.HasIndex("Status");

                    b.ToTable("Donors", (string)null);

                    b.HasDiscriminator<string>("Discriminator")
                        .HasColumnName("Discriminator")
                        .HasColumnType("longtext");

                    b.UseTphMappingStrategy();

                    b.HasQueryFilter("IsDeleted == False");

                    b.Navigation("Donations");

                    b.Navigation("MedicalHistory");
                });

            modelBuilder.Entity("BloodCenter.Core.Entities.DonorMedicalHistory", b =>
                {
                    b.Property<Guid>("Id")
                        .HasColumnType("char(36)");

                    b.Property<string>("AdditionalNotes")
                        .HasMaxLength(1000)
                        .HasColumnType("varchar(1000)");

                    b.Property<DateTime>("CreatedAt")
                        .HasColumnType("datetime(6)");

                    b.Property<int?>("DeferralDays")
                        .HasColumnType("int");

                    b.Property<string>("DeferralReason")
                        .HasMaxLength(500)
                        .HasColumnType("varchar(500)");

                    b.Property<bool>("EligibilityResult")
                        .HasColumnType("tinyint(1)");

                    b.Property<Guid>("DonorId")
                        .HasColumnType("char(36)");

                    b.Property<bool>("HadAlcohol")
                        .HasColumnType("tinyint(1)");

                    b.Property<bool>("HadBloodTransfusion")
                        .HasColumnType("tinyint(1)");

                    b.Property<bool>("HadDentalWork")
                        .HasColumnType("tinyint(1)");

                    b.Property<bool>("HadDrugs")
                        .HasColumnType("tinyint(1)");

                    b.Property<bool>("HadRecentSurgery")
                        .HasColumnType("tinyint(1)");

                    b.Property<bool>("HadTattoo")
                        .HasColumnType("tinyint(1)");

                    b.Property<bool>("HadTobacco")
                        .HasColumnType("tinyint(1)");

                    b.Property<bool>("HadVaccination")
                        .HasColumnType("tinyint(1)");

                    b.Property<bool>("HasCancer")
                        .HasColumnType("tinyint(1)");

                    b.Property<bool>("HasDiabetes")
                        .HasColumnType("tinyint(1)");

                    b.Property<bool>("HasFever")
                        .HasColumnType("tinyint(1)");

                    b.Property<bool>("HasHeartDisease")
                        .HasColumnType("tinyint(1)");

                    b.Property<bool>("HasHepatitis")
                        .HasColumnType("tinyint(1)");

                    b.Property<bool>("HasHIV")
                        .HasColumnType("tinyint(1)");

                    b.Property<bool>("HasHighBloodPressure")
                        .HasColumnType("tinyint(1)");

                    b.Property<bool>("HasMalaria")
                        .HasColumnType("tinyint(1)");

                    b.Property<bool>("HasSyphilis")
                        .HasColumnType("tinyint(1)");

                    b.Property<bool>("IsBreastfeeding")
                        .HasColumnType("tinyint(1)");

                    b.Property<bool>("IsDeleted")
                        .HasColumnType("tinyint(1)");

                    b.Property<bool>("IsPregnant")
                        .HasColumnType("tinyint(1)");

                    b.Property<DateTime?>("LastMenstrualDate")
                        .HasColumnType("datetime(6)");

                    b.Property<string>("MedicationDetails")
                        .HasMaxLength(500)
                        .HasColumnType("varchar(500)");

                    b.Property<DateTime>("QuestionnaireDate")
                        .HasColumnType("datetime(6)");

                    b.Property<DateTime?>("SurgeryDate")
                        .HasColumnType("datetime(6)");

                    b.Property<bool>("TakingMedication")
                        .HasColumnType("tinyint(1)");

                    b.Property<DateTime?>("TravelDate")
                        .HasColumnType("datetime(6)");

                    b.Property<bool>("TraveledToMalariaArea")
                        .HasColumnType("tinyint(1)");

                    b.Property<DateTime>("UpdatedAt")
                        .HasColumnType("datetime(6)");

                    b.Property<string>("VaccinationType")
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<DateTime?>("DentalWorkDate")
                        .HasColumnType("datetime(6)");

                    b.Property<DateTime?>("TattooDate")
                        .HasColumnType("datetime(6)");

                    b.Property<DateTime?>("TransfusionDate")
                        .HasColumnType("datetime(6)");

                    b.Property<DateTime?>("VaccinationDate")
                        .HasColumnType("datetime(6)");

                    b.HasKey("Id");

                    b.HasIndex("DonorId");

                    b.HasIndex("EligibilityResult");

                    b.HasIndex("IsDeleted");

                    b.HasIndex("QuestionnaireDate");

                    b.ToTable("DonorMedicalHistories", (string)null);

                    b.HasDiscriminator<string>("Discriminator")
                        .HasColumnName("Discriminator")
                        .HasColumnType("longtext");

                    b.UseTphMappingStrategy();

                    b.HasQueryFilter("IsDeleted == False");

                    b.Navigation("Donor");
                });

            modelBuilder.Entity("BloodCenter.Core.Entities.Hospital", b =>
                {
                    b.Property<Guid>("Id")
                        .HasColumnType("char(36)");

                    b.Property<string>("ApiKey")
                        .HasMaxLength(500)
                        .HasColumnType("varchar(500)");

                    b.Property<string>("ContactPerson")
                        .IsRequired()
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<string>("ContactPhone")
                        .IsRequired()
                        .HasMaxLength(20)
                        .HasColumnType("varchar(20)");

                    b.Property<DateTime>("CreatedAt")
                        .HasColumnType("datetime(6)");

                    b.Property<string>("Email")
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<string>("HospitalCode")
                        .IsRequired()
                        .HasMaxLength(50)
                        .HasColumnType("varchar(50)");

                    b.Property<bool>("IsActive")
                        .HasColumnType("tinyint(1)");

                    b.Property<bool>("IsDeleted")
                        .HasColumnType("tinyint(1)");

                    b.Property<int>("Level")
                        .HasColumnType("int");

                    b.Property<string>("Name")
                        .IsRequired()
                        .HasMaxLength(200)
                        .HasColumnType("varchar(200)");

                    b.Property<string>("Notes")
                        .HasMaxLength(1000)
                        .HasColumnType("varchar(1000)");

                    b.Property<DateTime>("UpdatedAt")
                        .HasColumnType("datetime(6)");

                    b.Property<string>("Address_Street")
                        .HasMaxLength(200)
                        .HasColumnType("varchar(200)");

                    b.Property<string>("Address_City")
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<string>("Address_Province")
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<string>("Address_PostalCode")
                        .HasMaxLength(20)
                        .HasColumnType("varchar(20)");

                    b.HasKey("Id");

                    b.HasIndex("HospitalCode")
                        .IsUnique();

                    b.HasIndex("IsActive");

                    b.HasIndex("IsDeleted");

                    b.ToTable("Hospitals", (string)null);

                    b.HasDiscriminator<string>("Discriminator")
                        .HasColumnName("Discriminator")
                        .HasColumnType("longtext");

                    b.UseTphMappingStrategy();

                    b.HasQueryFilter("IsDeleted == False");

                    b.Navigation("BloodRequests");
                });

            modelBuilder.Entity("BloodCenter.Core.Entities.InitialScreening", b =>
                {
                    b.Property<Guid>("Id")
                        .HasColumnType("char(36)");

                    b.Property<decimal>("ALT")
                        .HasColumnType("decimal(10,2)");

                    b.Property<DateTime>("CreatedAt")
                        .HasColumnType("datetime(6)");

                    b.Property<Guid>("DonationId")
                        .HasColumnType("char(36)");

                    b.Property<string>("FailureReason")
                        .HasMaxLength(500)
                        .HasColumnType("varchar(500)");

                    b.Property<int>("HBsAg")
                        .HasColumnType("int");

                    b.Property<decimal>("Hemoglobin")
                        .HasColumnType("decimal(10,2)");

                    b.Property<bool>("IsDeleted")
                        .HasColumnType("tinyint(1)");

                    b.Property<string>("Notes")
                        .HasMaxLength(1000)
                        .HasColumnType("varchar(1000)");

                    b.Property<bool>("Passed")
                        .HasColumnType("tinyint(1)");

                    b.Property<int>("BloodType")
                        .HasColumnType("int");

                    b.Property<int>("RhFactor")
                        .HasColumnType("int");

                    b.Property<DateTime>("ScreeningTime")
                        .HasColumnType("datetime(6)");

                    b.Property<Guid>("TechnicianId")
                        .HasColumnType("char(36)");

                    b.Property<DateTime>("UpdatedAt")
                        .HasColumnType("datetime(6)");

                    b.HasKey("Id");

                    b.HasIndex("DonationId");

                    b.HasIndex("IsDeleted");

                    b.HasIndex("Passed");

                    b.HasIndex("ScreeningTime");

                    b.HasIndex("TechnicianId");

                    b.ToTable("InitialScreenings", (string)null);

                    b.HasDiscriminator<string>("Discriminator")
                        .HasColumnName("Discriminator")
                        .HasColumnType("longtext");

                    b.UseTphMappingStrategy();

                    b.HasQueryFilter("IsDeleted == False");

                    b.Navigation("Donation");

                    b.Navigation("Technician");
                });

            modelBuilder.Entity("BloodCenter.Core.Entities.InventorySetting", b =>
                {
                    b.Property<Guid>("Id")
                        .HasColumnType("char(36)");

                    b.Property<int>("BloodType")
                        .HasColumnType("int");

                    b.Property<DateTime>("CreatedAt")
                        .HasColumnType("datetime(6)");

                    b.Property<int>("EmergencyReserve")
                        .HasColumnType("int");

                    b.Property<bool>("IsDeleted")
                        .HasColumnType("tinyint(1)");

                    b.Property<int>("MinimumLevel")
                        .HasColumnType("int");

                    b.Property<string>("Notes")
                        .HasMaxLength(500)
                        .HasColumnType("varchar(500)");

                    b.Property<int>("ProductType")
                        .HasColumnType("int");

                    b.Property<int>("RhFactor")
                        .HasColumnType("int");

                    b.Property<DateTime>("UpdatedAt")
                        .HasColumnType("datetime(6)");

                    b.Property<int>("WarningLevel")
                        .HasColumnType("int");

                    b.HasKey("Id");

                    b.HasIndex("ProductType", "BloodType", "RhFactor")
                        .IsUnique();

                    b.HasIndex("IsDeleted");

                    b.ToTable("InventorySettings", (string)null);

                    b.HasDiscriminator<string>("Discriminator")
                        .HasColumnName("Discriminator")
                        .HasColumnType("longtext");

                    b.UseTphMappingStrategy();

                    b.HasQueryFilter("IsDeleted == False");
                });

            modelBuilder.Entity("BloodCenter.Core.Entities.ScrapRecord", b =>
                {
                    b.Property<Guid>("Id")
                        .HasColumnType("char(36)");

                    b.Property<DateTime?>("ApprovedAt")
                        .HasColumnType("datetime(6)");

                    b.Property<Guid?>("ApprovedById")
                        .HasColumnType("char(36)");

                    b.Property<Guid>("BloodProductId")
                        .HasColumnType("char(36)");

                    b.Property<DateTime>("CreatedAt")
                        .HasColumnType("datetime(6)");

                    b.Property<string>("DetailedReason")
                        .HasMaxLength(1000)
                        .HasColumnType("varchar(1000)");

                    b.Property<string>("DisposalMethod")
                        .HasMaxLength(200)
                        .HasColumnType("varchar(200)");

                    b.Property<bool>("IsDeleted")
                        .HasColumnType("tinyint(1)");

                    b.Property<string>("Notes")
                        .HasMaxLength(1000)
                        .HasColumnType("varchar(1000)");

                    b.Property<Guid>("OperatorId")
                        .HasColumnType("char(36)");

                    b.Property<int>("Reason")
                        .HasColumnType("int");

                    b.Property<DateTime>("ScrapDate")
                        .HasColumnType("datetime(6)");

                    b.Property<DateTime>("UpdatedAt")
                        .HasColumnType("datetime(6)");

                    b.HasKey("Id");

                    b.HasIndex("ApprovedById");

                    b.HasIndex("BloodProductId");

                    b.HasIndex("IsDeleted");

                    b.HasIndex("OperatorId");

                    b.HasIndex("Reason");

                    b.HasIndex("Reason", "ScrapDate");

                    b.HasIndex("ScrapDate");

                    b.ToTable("ScrapRecords", (string)null);

                    b.HasDiscriminator<string>("Discriminator")
                        .HasColumnName("Discriminator")
                        .HasColumnType("longtext");

                    b.UseTphMappingStrategy();

                    b.HasQueryFilter("IsDeleted == False");

                    b.Navigation("BloodProduct");

                    b.Navigation("Operator");

                    b.Navigation("ApprovedBy");
                });

            modelBuilder.Entity("BloodCenter.Core.Entities.User", b =>
                {
                    b.Property<Guid>("Id")
                        .HasColumnType("char(36)");

                    b.Property<DateTime>("CreatedAt")
                        .HasColumnType("datetime(6)");

                    b.Property<string>("Email")
                        .IsRequired()
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<string>("EmployeeId")
                        .IsRequired()
                        .HasMaxLength(50)
                        .HasColumnType("varchar(50)");

                    b.Property<string>("FullName")
                        .IsRequired()
                        .HasMaxLength(100)
                        .HasColumnType("varchar(100)");

                    b.Property<bool>("IsActive")
                        .HasColumnType("tinyint(1)");

                    b.Property<bool>("IsDeleted")
                        .HasColumnType("tinyint(1)");

                    b.Property<DateTime?>("LastLoginAt")
                        .HasColumnType("datetime(6)");

                    b.Property<string>("PasswordHash")
                        .IsRequired()
                        .HasMaxLength(500)
                        .HasColumnType("varchar(500)");

                    b.Property<string>("RefreshToken")
                        .HasMaxLength(500)
                        .HasColumnType("varchar(500)");

                    b.Property<DateTime?>("RefreshTokenExpiry")
                        .HasColumnType("datetime(6)");

                    b.Property<int>("Role")
                        .HasColumnType("int");

                    b.Property<DateTime>("UpdatedAt")
                        .HasColumnType("datetime(6)");

                    b.Property<string>("UserName")
                        .IsRequired()
                        .HasMaxLength(50)
                        .HasColumnType("varchar(50)");

                    b.HasKey("Id");

                    b.HasIndex("Email")
                        .IsUnique();

                    b.HasIndex("EmployeeId")
                        .IsUnique();

                    b.HasIndex("IsActive");

                    b.HasIndex("IsDeleted");

                    b.HasIndex("Role");

                    b.HasIndex("UserName")
                        .IsUnique();

                    b.ToTable("Users", (string)null);

                    b.HasDiscriminator<string>("Discriminator")
                        .HasColumnName("Discriminator")
                        .HasColumnType("longtext");

                    b.UseTphMappingStrategy();

                    b.HasQueryFilter("IsDeleted == False");
                });

            modelBuilder.Entity("BloodCenter.Core.Entities.BloodProduct", b =>
                {
                    b.HasOne("BloodCenter.Core.Entities.Donation", "Donation")
                        .WithMany("BloodProducts")
                        .HasForeignKey("DonationId")
                        .OnDelete(DeleteBehavior.Restrict)
                        .HasConstraintName("FK_BloodProducts_Donations_DonationId");

                    b.HasOne("BloodCenter.Core.Entities.User", "PreparedBy")
                        .WithMany()
                        .HasForeignKey("PreparedById")
                        .OnDelete(DeleteBehavior.Restrict)
                        .HasConstraintName("FK_BloodProducts_Users_PreparedById");

                    b.Navigation("Donation");

                    b.Navigation("PreparedBy");
                });

            modelBuilder.Entity("BloodCenter.Core.Entities.BloodRequest", b =>
                {
                    b.HasOne("BloodCenter.Core.Entities.Hospital", "Hospital")
                        .WithMany("BloodRequests")
                        .HasForeignKey("HospitalId")
                        .OnDelete(DeleteBehavior.Restrict)
                        .HasConstraintName("FK_BloodRequests_Hospitals_HospitalId");

                    b.Navigation("Hospital");
                });

            modelBuilder.Entity("BloodCenter.Core.Entities.BloodTest", b =>
                {
                    b.HasOne("BloodCenter.Core.Entities.Donation", "Donation")
                        .WithMany("BloodTests")
                        .HasForeignKey("DonationId")
                        .OnDelete(DeleteBehavior.Restrict)
                        .HasConstraintName("FK_BloodTests_Donations_DonationId");

                    b.HasOne("BloodCenter.Core.Entities.User", "Technician")
                        .WithMany()
                        .HasForeignKey("TechnicianId")
                        .OnDelete(DeleteBehavior.Restrict)
                        .HasConstraintName("FK_BloodTests_Users_TechnicianId");

                    b.HasOne("BloodCenter.Core.Entities.User", "SecondReviewer")
                        .WithMany()
                        .HasForeignKey("SecondReviewerId")
                        .OnDelete(DeleteBehavior.Restrict)
                        .HasConstraintName("FK_BloodTests_Users_SecondReviewerId");

                    b.Navigation("Donation");

                    b.Navigation("Technician");

                    b.Navigation("SecondReviewer");
                });

            modelBuilder.Entity("BloodCenter.Core.Entities.CrossMatch", b =>
                {
                    b.HasOne("BloodCenter.Core.Entities.BloodProduct", "BloodProduct")
                        .WithMany("CrossMatches")
                        .HasForeignKey("BloodProductId")
                        .OnDelete(DeleteBehavior.Restrict)
                        .HasConstraintName("FK_CrossMatches_BloodProducts_BloodProductId");

                    b.HasOne("BloodCenter.Core.Entities.BloodRequest", "BloodRequest")
                        .WithMany("CrossMatches")
                        .HasForeignKey("BloodRequestId")
                        .OnDelete(DeleteBehavior.Restrict)
                        .HasConstraintName("FK_CrossMatches_BloodRequests_BloodRequestId");

                    b.HasOne("BloodCenter.Core.Entities.User", "Technician")
                        .WithMany()
                        .HasForeignKey("TechnicianId")
                        .OnDelete(DeleteBehavior.Restrict)
                        .HasConstraintName("FK_CrossMatches_Users_TechnicianId");

                    b.Navigation("BloodProduct");

                    b.Navigation("BloodRequest");

                    b.Navigation("Technician");
                });

            modelBuilder.Entity("BloodCenter.Core.Entities.Donation", b =>
                {
                    b.HasOne("BloodCenter.Core.Entities.Donor", "Donor")
                        .WithMany("Donations")
                        .HasForeignKey("DonorId")
                        .OnDelete(DeleteBehavior.Restrict)
                        .HasConstraintName("FK_Donations_Donors_DonorId");

                    b.HasOne("BloodCenter.Core.Entities.CollectionSite", "CollectionSite")
                        .WithMany("Donations")
                        .HasForeignKey("CollectionSiteId")
                        .OnDelete(DeleteBehavior.Restrict)
                        .HasConstraintName("FK_Donations_CollectionSites_CollectionSiteId");

                    b.HasOne("BloodCenter.Core.Entities.User", "Nurse")
                        .WithMany()
                        .HasForeignKey("NurseId")
                        .OnDelete(DeleteBehavior.Restrict)
                        .HasConstraintName("FK_Donations_Users_NurseId");

                    b.Navigation("Donor");

                    b.Navigation("CollectionSite");

                    b.Navigation("Nurse");
                });

            modelBuilder.Entity("BloodCenter.Core.Entities.DonorMedicalHistory", b =>
                {
                    b.HasOne("BloodCenter.Core.Entities.Donor", "Donor")
                        .WithMany("MedicalHistory")
                        .HasForeignKey("DonorId")
                        .OnDelete(DeleteBehavior.Restrict)
                        .HasConstraintName("FK_DonorMedicalHistories_Donors_DonorId");

                    b.Navigation("Donor");
                });

            modelBuilder.Entity("BloodCenter.Core.Entities.InitialScreening", b =>
                {
                    b.HasOne("BloodCenter.Core.Entities.Donation", "Donation")
                        .WithMany("InitialScreenings")
                        .HasForeignKey("DonationId")
                        .OnDelete(DeleteBehavior.Restrict)
                        .HasConstraintName("FK_InitialScreenings_Donations_DonationId");

                    b.HasOne("BloodCenter.Core.Entities.User", "Technician")
                        .WithMany()
                        .HasForeignKey("TechnicianId")
                        .OnDelete(DeleteBehavior.Restrict)
                        .HasConstraintName("FK_InitialScreenings_Users_TechnicianId");

                    b.Navigation("Donation");

                    b.Navigation("Technician");
                });

            modelBuilder.Entity("BloodCenter.Core.Entities.ScrapRecord", b =>
                {
                    b.HasOne("BloodCenter.Core.Entities.BloodProduct", "BloodProduct")
                        .WithMany("ScrapRecords")
                        .HasForeignKey("BloodProductId")
                        .OnDelete(DeleteBehavior.Restrict)
                        .HasConstraintName("FK_ScrapRecords_BloodProducts_BloodProductId");

                    b.HasOne("BloodCenter.Core.Entities.User", "Operator")
                        .WithMany()
                        .HasForeignKey("OperatorId")
                        .OnDelete(DeleteBehavior.Restrict)
                        .HasConstraintName("FK_ScrapRecords_Users_OperatorId");

                    b.HasOne("BloodCenter.Core.Entities.User", "ApprovedBy")
                        .WithMany()
                        .HasForeignKey("ApprovedById")
                        .OnDelete(DeleteBehavior.Restrict)
                        .HasConstraintName("FK_ScrapRecords_Users_ApprovedById");

                    b.Navigation("BloodProduct");

                    b.Navigation("Operator");

                    b.Navigation("ApprovedBy");
                });
#pragma warning restore 612, 618
        }
    }
}
