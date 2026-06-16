using AutoMapper;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.AspNetCore.SignalR;
using SmartParking.API.Common;
using SmartParking.API.Data;
using SmartParking.API.Hubs;
using SmartParking.API.Models.DTOs;
using SmartParking.API.Models.Entities;
using SmartParking.API.Services.Interfaces;

namespace SmartParking.API.Services;

public class ParkingService : IParkingService
{
    private readonly AppDbContext _db;
    private readonly IMapper _mapper;
    private readonly IDistributedCache _cache;
    private readonly IHubContext<NotificationHub> _hub;
    private readonly ILogger<ParkingService> _logger;
    private readonly IBillingService _billingService;
    private readonly IRedisCacheService _redis;

    public ParkingService(
        AppDbContext db,
        IMapper mapper,
        IDistributedCache cache,
        IHubContext<NotificationHub> hub,
        ILogger<ParkingService> logger,
        IBillingService billingService,
        IRedisCacheService redis)
    {
        _db = db;
        _mapper = mapper;
        _cache = cache;
        _hub = hub;
        _logger = logger;
        _billingService = billingService;
        _redis = redis;
    }

    public async Task<ApiResponse<List<ParkingLotDto>>> GetAllLotsAsync()
    {
        var lots = await _db.ParkingLots
            .AsNoTracking()
            .Include(l => l.Floors)
                .ThenInclude(f => f.Spots)
            .Where(l => !l.IsDeleted)
            .ToListAsync();

        return ApiResponse<List<ParkingLotDto>>.Success(_mapper.Map<List<ParkingLotDto>>(lots));
    }

    public async Task<ApiResponse<ParkingLotDto>> GetLotByIdAsync(string lotId)
    {
        var lot = await _db.ParkingLots
            .AsNoTracking()
            .Include(l => l.Floors)
                .ThenInclude(f => f.Spots)
            .FirstOrDefaultAsync(l => l.Id == lotId && !l.IsDeleted);

        if (lot == null) return ApiResponse<ParkingLotDto>.Error("停车场不存在", 404);
        return ApiResponse<ParkingLotDto>.Success(_mapper.Map<ParkingLotDto>(lot));
    }

    public async Task<ApiResponse<ParkingRecordDto>> EntryParkingAsync(ParkingEntryRequest request, string? userId)
    {
        using var transaction = await _db.Database.BeginTransactionAsync();
        try
        {
            var spot = await _db.ParkingSpots.FindAsync(request.SpotId);
            if (spot == null)
                return ApiResponse<ParkingRecordDto>.Error("车位不存在", 404);

            if (spot.Status != ParkingSpotStatus.Available)
                return ApiResponse<ParkingRecordDto>.Error($"车位当前状态为{spot.Status}，无法入场");

            spot.Status = ParkingSpotStatus.Occupied;
            spot.PlateNumber = request.PlateNumber;
            spot.EntryTime = DateTime.UtcNow;
            spot.UpdatedAt = DateTime.UtcNow;

            var record = new ParkingRecord
            {
                SpotId = spot.Id,
                SpotCode = spot.Code,
                PlateNumber = request.PlateNumber,
                UserId = userId,
                EntryTime = spot.EntryTime.Value,
                Status = "InProgress"
            };

            _db.ParkingRecords.Add(record);
            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            var spotDto = _mapper.Map<ParkingSpotDto>(spot);
            await _redis.RefreshParkingSpotAsync(spot.Id, spotDto);
            await _hub.PushParkingSpotUpdated(spotDto);

            _logger.LogInformation("车辆 {Plate} 入场，车位 {SpotCode}", request.PlateNumber, spot.Code);

            return ApiResponse<ParkingRecordDto>.Success(_mapper.Map<ParkingRecordDto>(record));
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "车辆入场失败");
            return ApiResponse<ParkingRecordDto>.Error("入场失败");
        }
    }

    public async Task<ApiResponse<(ParkingRecordDto Record, decimal Fee)>> ExitParkingAsync(ParkingExitRequest request)
    {
        using var transaction = await _db.Database.BeginTransactionAsync();
        try
        {
            var record = await _db.ParkingRecords.FindAsync(request.RecordId);
            if (record == null)
                return ApiResponse<(ParkingRecordDto, decimal)>.Error("停车记录不存在", 404);

            if (record.Status != "InProgress")
                return ApiResponse<(ParkingRecordDto, decimal)>.Error("该记录已出场");

            if (!string.IsNullOrEmpty(request.PlateNumber) &&
                !string.Equals(record.PlateNumber, request.PlateNumber, StringComparison.OrdinalIgnoreCase))
                return ApiResponse<(ParkingRecordDto, decimal)>.Error("车牌号不匹配");

            var exitTime = DateTime.UtcNow;
            record.ExitTime = exitTime;
            record.DurationMinutes = (int)Math.Round((exitTime - record.EntryTime).TotalMinutes);
            record.Status = "Completed";

            var billingReq = new BillingCalculationRequest
            {
                RecordId = record.Id,
                EntryTime = record.EntryTime,
                ExitTime = exitTime,
                PlateNumber = record.PlateNumber
            };
            var billing = await _billingService.CalculateParkingAsync(billingReq);
            record.ParkingFee = billing.Data?.TotalAmount ?? 0;

            var spot = await _db.ParkingSpots.FindAsync(record.SpotId);
            if (spot != null)
            {
                spot.Status = ParkingSpotStatus.Available;
                spot.PlateNumber = null;
                spot.EntryTime = null;
                spot.UpdatedAt = DateTime.UtcNow;

                var spotDto = _mapper.Map<ParkingSpotDto>(spot);
                await _redis.RefreshParkingSpotAsync(spot.Id, spotDto);
                await _hub.PushParkingSpotUpdated(spotDto);
            }

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            _logger.LogInformation("车辆 {Plate} 出场，费用 {Fee}", record.PlateNumber, record.ParkingFee);

            return ApiResponse<(ParkingRecordDto, decimal)>.Success(
                (_mapper.Map<ParkingRecordDto>(record), record.ParkingFee.Value));
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "车辆出场失败");
            return ApiResponse<(ParkingRecordDto, decimal)>.Error("出场失败");
        }
    }

    public async Task<ApiResponse<PagedResult<ParkingRecordDto>>> GetRecordsAsync(PagedQuery query, string? status)
    {
        var q = _db.ParkingRecords.AsNoTracking().AsQueryable();

        if (!string.IsNullOrEmpty(status))
            q = q.Where(r => r.Status == status);
        if (!string.IsNullOrEmpty(query.Keyword))
            q = q.Where(r => r.PlateNumber.Contains(query.Keyword) || r.SpotCode.Contains(query.Keyword));

        q = query.SortDirection == SortDirection.Ascending
            ? q.OrderBy(r => r.EntryTime)
            : q.OrderByDescending(r => r.EntryTime);

        var total = await q.CountAsync();
        var items = await q
            .Skip((query.PageIndex - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return ApiResponse<PagedResult<ParkingRecordDto>>.Success(
            PagedResult<ParkingRecordDto>.Create(_mapper.Map<List<ParkingRecordDto>>(items), total, query.PageIndex, query.PageSize));
    }
}
