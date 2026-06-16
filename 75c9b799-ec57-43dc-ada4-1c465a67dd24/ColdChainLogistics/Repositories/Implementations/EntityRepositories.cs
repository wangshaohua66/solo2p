using Microsoft.EntityFrameworkCore;
using ColdChainLogistics.Data;
using ColdChainLogistics.Models.Entities;
using ColdChainLogistics.Repositories.Interfaces;

namespace ColdChainLogistics.Repositories.Implementations;

public class SensorRepository : PagedRepository<Sensor>, ISensorRepository
{
    public SensorRepository(AppDbContext context) : base(context)
    {
    }

    public async Task<Sensor?> GetByDeviceIdAsync(string deviceId)
    {
        return await _dbSet.FirstOrDefaultAsync(s => s.DeviceId == deviceId);
    }

    public async Task<Sensor?> GetBySensorCodeAsync(string sensorCode)
    {
        return await _dbSet.FirstOrDefaultAsync(s => s.SensorCode == sensorCode);
    }

    public async Task<List<Sensor>> GetByVehicleIdAsync(long vehicleId)
    {
        return await _dbSet.Where(s => s.VehicleId == vehicleId).ToListAsync();
    }

    public async Task<List<Sensor>> GetByWarehouseIdAsync(long warehouseId)
    {
        return await _dbSet.Where(s => s.WarehouseId == warehouseId).ToListAsync();
    }

    public async Task<List<Sensor>> GetActiveSensorsAsync()
    {
        return await _dbSet.Where(s => s.Status == SensorStatus.Active).ToListAsync();
    }

    public async Task UpdateLastReportTimeAsync(long sensorId, DateTime reportTime, double? temperature, double? humidity)
    {
        var sensor = await _dbSet.FindAsync(sensorId);
        if (sensor != null)
        {
            sensor.LastReportTime = reportTime;
            sensor.LastTemperature = temperature;
            sensor.LastHumidity = humidity;
            if (sensor.Status == SensorStatus.Offline)
            {
                sensor.Status = SensorStatus.Active;
            }
        }
    }
}

public class VehicleRepository : PagedRepository<Vehicle>, IVehicleRepository
{
    public VehicleRepository(AppDbContext context) : base(context)
    {
    }

    public async Task<Vehicle?> GetByVehicleNumberAsync(string vehicleNumber)
    {
        return await _dbSet.FirstOrDefaultAsync(v => v.VehicleNumber == vehicleNumber);
    }

    public async Task<Vehicle?> GetByPlateNumberAsync(string plateNumber)
    {
        return await _dbSet.FirstOrDefaultAsync(v => v.PlateNumber == plateNumber);
    }

    public async Task<List<Vehicle>> GetActiveVehiclesAsync()
    {
        return await _dbSet.Where(v => v.IsActive).ToListAsync();
    }
}

public class WarehouseRepository : PagedRepository<Warehouse>, IWarehouseRepository
{
    public WarehouseRepository(AppDbContext context) : base(context)
    {
    }

    public async Task<Warehouse?> GetByWarehouseCodeAsync(string warehouseCode)
    {
        return await _dbSet.FirstOrDefaultAsync(w => w.WarehouseCode == warehouseCode);
    }

    public async Task<List<Warehouse>> GetActiveWarehousesAsync()
    {
        return await _dbSet.Where(w => w.IsActive).ToListAsync();
    }
}

public class CustomerRepository : PagedRepository<Customer>, ICustomerRepository
{
    public CustomerRepository(AppDbContext context) : base(context)
    {
    }

    public async Task<Customer?> GetByCustomerCodeAsync(string customerCode)
    {
        return await _dbSet.FirstOrDefaultAsync(c => c.CustomerCode == customerCode);
    }

    public async Task<List<Customer>> GetActiveCustomersAsync()
    {
        return await _dbSet.Where(c => c.IsActive).ToListAsync();
    }
}
