using Microsoft.EntityFrameworkCore;
using ColdChainLogistics.Data;
using ColdChainLogistics.Models.Entities;
using ColdChainLogistics.Repositories.Interfaces;

namespace ColdChainLogistics.Repositories.Implementations;

public class ShipmentRepository : PagedRepository<Shipment>, IShipmentRepository
{
    public ShipmentRepository(AppDbContext context) : base(context)
    {
    }

    public async Task<Shipment?> GetByShipmentNumberAsync(string shipmentNumber)
    {
        return await _dbSet.FirstOrDefaultAsync(s => s.ShipmentNumber == shipmentNumber);
    }

    public async Task<List<Shipment>> GetByCustomerIdAsync(long customerId, int pageIndex, int pageSize)
    {
        return await _dbSet
            .Where(s => s.CustomerId == customerId)
            .OrderByDescending(s => s.CreatedAt)
            .Skip((pageIndex - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
    }

    public async Task<List<Shipment>> GetActiveShipmentsByVehicleIdAsync(long vehicleId)
    {
        return await _dbSet
            .Where(s => s.VehicleId == vehicleId
                && s.Status != ShipmentStatus.Signed
                && s.Status != ShipmentStatus.Cancelled)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();
    }

    public async Task<Shipment?> GetCurrentShipmentByVehicleIdAsync(long vehicleId)
    {
        return await _dbSet
            .OrderByDescending(s => s.CreatedAt)
            .FirstOrDefaultAsync(s => s.VehicleId == vehicleId
                && s.Status != ShipmentStatus.Signed
                && s.Status != ShipmentStatus.Cancelled);
    }

    public async Task<Shipment?> GetWithDetailsAsync(long id)
    {
        return await _dbSet
            .Include(s => s.Batches)
            .Include(s => s.Vehicle)
            .Include(s => s.Customer)
            .Include(s => s.OriginWarehouse)
            .FirstOrDefaultAsync(s => s.Id == id);
    }
}

public class ShipmentBatchRepository : PagedRepository<ShipmentBatch>, IShipmentBatchRepository
{
    public ShipmentBatchRepository(AppDbContext context) : base(context)
    {
    }

    public async Task<ShipmentBatch?> GetByBatchNumberAsync(string batchNumber)
    {
        return await _dbSet.FirstOrDefaultAsync(b => b.BatchNumber == batchNumber);
    }

    public async Task<List<ShipmentBatch>> GetByShipmentIdAsync(long shipmentId)
    {
        return await _dbSet.Where(b => b.ShipmentId == shipmentId).ToListAsync();
    }
}
