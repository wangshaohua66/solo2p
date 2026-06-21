using AutoMapper;
using AutoMapper.QueryableExtensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using UsedVehicleTransaction.Common;
using UsedVehicleTransaction.Data;
using UsedVehicleTransaction.DTOs;
using UsedVehicleTransaction.Enums;
using UsedVehicleTransaction.Models;

namespace UsedVehicleTransaction.Services;

public class VehicleService : IVehicleService
{
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly IMemoryCache _cache;
    private readonly ILogger<VehicleService> _logger;

    public VehicleService(
        ApplicationDbContext context,
        IMapper mapper,
        IMemoryCache cache,
        ILogger<VehicleService> logger)
    {
        _context = context;
        _mapper = mapper;
        _cache = cache;
        _logger = logger;
    }

    public async Task<ApiResponse<VehicleDto>> CreateAsync(VehicleCreateDto dto, long operatorId)
    {
        _logger.LogInformation("Creating vehicle with VIN: {Vin}", dto.Vin);

        var existing = await _context.Vehicles
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.Vin == dto.Vin);

        if (existing != null)
        {
            _logger.LogWarning("VIN already exists: {Vin}", dto.Vin);
            return ApiResponse<VehicleDto>.Fail(ErrorCodes.VinAlreadyExists.Code, ErrorCodes.VinAlreadyExists.MessageZh, ErrorCodes.VinAlreadyExists.MessageEn);
        }

        var vehicle = _mapper.Map<Vehicle>(dto);
        vehicle.CreatedBy = operatorId;
        vehicle.Status = VehicleStatus.PendingCompliance;

        _context.Vehicles.Add(vehicle);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Vehicle created successfully: {Id}, VIN: {Vin}", vehicle.Id, vehicle.Vin);
        var result = _mapper.Map<VehicleDto>(vehicle);
        return ApiResponse<VehicleDto>.Success(result, "车辆信息录入成功", "Vehicle information entered successfully");
    }

    public async Task<ApiResponse<VehicleDto>> UpdateAsync(long id, VehicleUpdateDto dto, long operatorId)
    {
        _logger.LogInformation("Updating vehicle: {Id}", id);

        var vehicle = await _context.Vehicles.FindAsync(id);
        if (vehicle == null)
        {
            _logger.LogWarning("Vehicle not found: {Id}", id);
            return ApiResponse<VehicleDto>.Fail(ErrorCodes.VehicleNotFound.Code, ErrorCodes.VehicleNotFound.MessageZh, ErrorCodes.VehicleNotFound.MessageEn);
        }

        _mapper.Map(dto, vehicle);
        vehicle.UpdatedBy = operatorId;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Vehicle updated successfully: {Id}", id);
        var result = _mapper.Map<VehicleDto>(vehicle);
        return ApiResponse<VehicleDto>.Success(result, "车辆信息更新成功", "Vehicle information updated successfully");
    }

    public async Task<ApiResponse<bool>> DeleteAsync(long id, long operatorId)
    {
        _logger.LogInformation("Deleting vehicle: {Id}", id);

        var vehicle = await _context.Vehicles.FindAsync(id);
        if (vehicle == null)
        {
            _logger.LogWarning("Vehicle not found: {Id}", id);
            return ApiResponse<bool>.Fail(ErrorCodes.VehicleNotFound.Code, ErrorCodes.VehicleNotFound.MessageZh, ErrorCodes.VehicleNotFound.MessageEn);
        }

        vehicle.IsDeleted = true;
        vehicle.DeletedAt = DateTime.UtcNow;
        vehicle.DeletedBy = operatorId;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Vehicle deleted successfully: {Id}", id);
        return ApiResponse<bool>.Success(true, "车辆删除成功", "Vehicle deleted successfully");
    }

    public async Task<ApiResponse<VehicleDetailDto>> GetByIdAsync(long id)
    {
        var cacheKey = $"vehicle_detail_{id}";
        if (_cache.TryGetValue(cacheKey, out VehicleDetailDto? cached))
        {
            return ApiResponse<VehicleDetailDto>.Success(cached!);
        }

        var vehicle = await _context.Vehicles
            .AsNoTracking()
            .Include(v => v.ComplianceCheckRecords!.OrderByDescending(c => c.CheckTime).Take(3))
                .ThenInclude(c => c.CheckItems)
            .Include(v => v.InspectionOrders!.OrderByDescending(i => i.CreatedAt).Take(3))
            .FirstOrDefaultAsync(v => v.Id == id);

        if (vehicle == null)
        {
            return ApiResponse<VehicleDetailDto>.Fail(ErrorCodes.VehicleNotFound.Code, ErrorCodes.VehicleNotFound.MessageZh, ErrorCodes.VehicleNotFound.MessageEn);
        }

        var result = _mapper.Map<VehicleDetailDto>(vehicle);
        _cache.Set(cacheKey, result, TimeSpan.FromMinutes(10));

        return ApiResponse<VehicleDetailDto>.Success(result);
    }

    public async Task<ApiResponse<PagedResult<VehicleDto>>> QueryAsync(VehicleQueryDto dto)
    {
        var query = _context.Vehicles.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(dto.Vin))
        {
            query = query.Where(v => v.Vin.Contains(dto.Vin));
        }

        if (!string.IsNullOrWhiteSpace(dto.PlateNumber))
        {
            query = query.Where(v => v.PlateNumber.Contains(dto.PlateNumber));
        }

        if (!string.IsNullOrWhiteSpace(dto.Brand))
        {
            query = query.Where(v => v.Brand.Contains(dto.Brand));
        }

        if (!string.IsNullOrWhiteSpace(dto.Model))
        {
            query = query.Where(v => v.Model.Contains(dto.Model));
        }

        if (dto.Status.HasValue)
        {
            query = query.Where(v => v.Status == dto.Status.Value);
        }

        if (dto.StartDate.HasValue)
        {
            query = query.Where(v => v.CreatedAt >= dto.StartDate.Value);
        }

        if (dto.EndDate.HasValue)
        {
            query = query.Where(v => v.CreatedAt <= dto.EndDate.Value);
        }

        var totalCount = await query.CountAsync();

        var sortField = string.IsNullOrWhiteSpace(dto.SortField) ? "CreatedAt" : dto.SortField;
        query = dto.SortOrder.ToLower() == "asc"
            ? OrderByDynamic(query, sortField, true)
            : OrderByDynamic(query, sortField, false);

        var items = await query
            .Skip((dto.PageIndex - 1) * dto.PageSize)
            .Take(dto.PageSize)
            .ProjectTo<VehicleDto>(_mapper.ConfigurationProvider)
            .ToListAsync();

        var result = new PagedResult<VehicleDto>
        {
            Items = items,
            TotalCount = totalCount,
            PageIndex = dto.PageIndex,
            PageSize = dto.PageSize
        };

        return ApiResponse<PagedResult<VehicleDto>>.Success(result);
    }

    private static IQueryable<Vehicle> OrderByDynamic(IQueryable<Vehicle> source, string propertyName, bool ascending)
    {
        var param = System.Linq.Expressions.Expression.Parameter(typeof(Vehicle), "v");
        var property = typeof(Vehicle).GetProperty(propertyName);
        if (property == null) return ascending ? source.OrderBy(v => v.CreatedAt) : source.OrderByDescending(v => v.CreatedAt);

        var propertyAccess = System.Linq.Expressions.Expression.MakeMemberAccess(param, property);
        var orderByExpression = System.Linq.Expressions.Expression.Lambda(propertyAccess, param);
        var methodName = ascending ? "OrderBy" : "OrderByDescending";
        var resultExpression = System.Linq.Expressions.Expression.Call(
            typeof(Queryable),
            methodName,
            new[] { typeof(Vehicle), property.PropertyType },
            source.Expression,
            System.Linq.Expressions.Expression.Quote(orderByExpression));
        return source.Provider.CreateQuery<Vehicle>(resultExpression);
    }
}
