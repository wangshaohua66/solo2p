using ElderlyCareSystem.Models;
using MongoDB.Driver;

namespace ElderlyCareSystem.Data;

public class MongoDbContext
{
    private readonly IMongoDatabase _database;

    public MongoDbContext(IMongoClient mongoClient, string databaseName)
    {
        _database = mongoClient.GetDatabase(databaseName);
    }

    public IMongoCollection<ElderlyProfile> ElderlyProfiles =>
        _database.GetCollection<ElderlyProfile>("ElderlyProfiles");

    public IMongoCollection<Bed> Beds =>
        _database.GetCollection<Bed>("Beds");

    public IMongoCollection<ShiftSchedule> ShiftSchedules =>
        _database.GetCollection<ShiftSchedule>("ShiftSchedules");

    public IMongoCollection<Staff> Staffs =>
        _database.GetCollection<Staff>("Staffs");

    public IMongoCollection<ShiftTemplate> ShiftTemplates =>
        _database.GetCollection<ShiftTemplate>("ShiftTemplates");

    public IMongoCollection<MedicationRecord> MedicationRecords =>
        _database.GetCollection<MedicationRecord>("MedicationRecords");

    public IMongoCollection<MedicationPrescription> MedicationPrescriptions =>
        _database.GetCollection<MedicationPrescription>("MedicationPrescriptions");

    public IMongoCollection<Bill> Bills =>
        _database.GetCollection<Bill>("Bills");

    public IMongoCollection<HomeServiceOrder> HomeServiceOrders =>
        _database.GetCollection<HomeServiceOrder>("HomeServiceOrders");

    public IMongoCollection<HomeServiceStaff> HomeServiceStaffs =>
        _database.GetCollection<HomeServiceStaff>("HomeServiceStaffs");

    public IMongoCollection<DailyActivityRecord> DailyActivityRecords =>
        _database.GetCollection<DailyActivityRecord>("DailyActivityRecords");

    public IMongoCollection<VisitAppointment> VisitAppointments =>
        _database.GetCollection<VisitAppointment>("VisitAppointments");
}
