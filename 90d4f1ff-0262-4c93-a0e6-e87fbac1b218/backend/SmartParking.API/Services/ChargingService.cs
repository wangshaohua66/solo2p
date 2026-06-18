using AutoMapper;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using SmartParking.API.Common;
using SmartParking.API.Data;
using SmartParking.API.Hubs;
using SmartParking.API.Models.DTOs;
using SmartParking.API.Models.Entities;
using SmartParking.API.Services.Interfaces;

namespace SmartParking.API.Services;

public class ChargingService : IChargingService
{
    private readonly AppDbContext _db;
    private readonly IMapper _mapper;
    private readonly IHubContext<NotificationHub> _hub;
    private readonly ILogger<ChargingService> _logger;
    private readonly IRedisCacheService _redis;
    private readonly IBillingService _billingService;

    public ChargingService(
        AppDbContext db,
        IMapper mapper,
        IHubContext<NotificationHub> hub,
        ILogger<ChargingService> logger,
        IRedisCacheService redis,
        IBillingService billingService)
    {
        _db = db;
        _mapper = mapper;
        _hub = hub;
        _logger = logger;
        _redis = redis;
        _billingService = billingService;
    }

    public async Task<ApiResponse<List<ChargingStationDto>>> GetStationsAsync(string? parkingLotId, string? status)
    {
        var q = _db.ChargingStations.AsNoTracking().AsQueryable();

        if (!string.IsNullOrEmpty(parkingLotId))
            q = q.Where(s => s.ParkingLotId == parkingLotId);
        if (!string.IsNullOrEmpty(status) && Enum.TryParse<ChargingStationStatus>(status, out var s))
            q = q.Where(s => s.Status == s);

        var stations = await q.OrderBy(s => s.Code).ToListAsync();
        return ApiResponse<List<ChargingStationDto>>.Success(_mapper.Map<List<ChargingStationDto>>(stations));
    }

    public async Task<ApiResponse<ChargingStationDto>> GetStationByIdAsync(string stationId)
    {
        var station = await _redis.GetChargingStationAsync(stationId);
        if (station != null) return ApiResponse<ChargingStationDto>.Success(station);

        var entity = await _db.ChargingStations.FindAsync(stationId);
        if (entity == null) return ApiResponse<ChargingStationDto>.Error("充电桩不存在", 404);

        var dto = _mapper.Map<ChargingStationDto>(entity);
        await _redis.RefreshChargingStationAsync(stationId, dto);
        return ApiResponse<ChargingStationDto>.Success(dto);
    }

    public async Task<ApiResponse<ChargingReservationDto>> CreateReservationAsync(CreateReservationRequest request, string userId)
    {
        using var transaction = await _db.Database.BeginTransactionAsync();
        try
        {
            var station = await _db.ChargingStations.FindAsync(request.StationId);
            if (station == null)
                return ApiResponse<ChargingReservationDto>.Error("充电桩不存在", 404);

            if (station.Status == ChargingStationStatus.Offline)
                return ApiResponse<ChargingReservationDto>.Error("充电桩已离线，无法预约");

            if (station.Status == ChargingStationStatus.Faulty)
                return ApiResponse<ChargingReservationDto>.Error("充电桩故障，无法预约");

            if (request.StartTime >= request.EndTime)
                return ApiResponse<ChargingReservationDto>.Error("预约时间不正确");

            if (request.StartTime < DateTime.UtcNow.AddMinutes(-5))
                return ApiResponse<ChargingReservationDto>.Error("不能预约过去的时间");

            var conflict = await _db.ChargingReservations
                .AnyAsync(r => r.StationId == request.StationId
                    && r.Status == "Active"
                    && r.StartTime < request.EndTime
                    && r.EndTime > request.StartTime);

            if (conflict)
                return ApiResponse<ChargingReservationDto>.Error("该时段已被预约，请选择其他时段");

            var reservation = new ChargingReservation
            {
                StationId = request.StationId,
                StationCode = station.Code,
                UserId = userId,
                StartTime = request.StartTime,
                EndTime = request.EndTime,
                Status = "Active"
            };

            _db.ChargingReservations.Add(reservation);
            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            _logger.LogInformation("用户 {UserId} 预约充电桩 {StationCode}，时段 {Start}-{End}",
                userId, station.Code, request.StartTime, request.EndTime);

            return ApiResponse<ChargingReservationDto>.Success(_mapper.Map<ChargingReservationDto>(reservation));
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "创建预约失败");
            return ApiResponse<ChargingReservationDto>.Error("预约失败");
        }
    }

    public async Task<ApiResponse> CancelReservationAsync(string reservationId, string userId)
    {
        var reservation = await _db.ChargingReservations.FindAsync(reservationId);
        if (reservation == null || reservation.UserId != userId)
            return ApiResponse.Error("预约记录不存在", 404);
        if (reservation.Status != "Active")
            return ApiResponse.Error("该预约无法取消");

        reservation.Status = "Cancelled";
        reservation.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return ApiResponse.Ok("已取消");
    }

    public async Task<ApiResponse<PagedResult<ChargingReservationDto>>> GetReservationsAsync(PagedQuery query, string? status, string? userId)
    {
        var q = _db.ChargingReservations.AsNoTracking().AsQueryable();
        if (!string.IsNullOrEmpty(userId)) q = q.Where(r => r.UserId == userId);
        if (!string.IsNullOrEmpty(status)) q = q.Where(r => r.Status == status);
        if (!string.IsNullOrEmpty(query.Keyword))
            q = q.Where(r => r.StationCode.Contains(query.Keyword));

        q = q.OrderByDescending(r => r.CreatedAt);

        var total = await q.CountAsync();
        var items = await q
            .Skip((query.PageIndex - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return ApiResponse<PagedResult<ChargingReservationDto>>.Success(
            PagedResult<ChargingReservationDto>.Create(_mapper.Map<List<ChargingReservationDto>>(items), total, query.PageIndex, query.PageSize));
    }

    public async Task<ApiResponse<ChargingSessionDto>> StartChargingAsync(string stationId, string userId)
    {
        using var transaction = await _db.Database.BeginTransactionAsync();
        try
        {
            var station = await _db.ChargingStations.FindAsync(stationId);
            if (station == null) return ApiResponse<ChargingSessionDto>.Error("充电桩不存在", 404);
            if (station.Status != ChargingStationStatus.Idle && station.Status != ChargingStationStatus.Reserved)
                return ApiResponse<ChargingSessionDto>.Error($"充电桩状态{station.Status}，无法充电");

            station.Status = ChargingStationStatus.Charging;
            station.CurrentPower = station.Power * 0.75m;
            station.ChargedKwh = 0;
            station.UpdatedAt = DateTime.UtcNow;

            var session = new ChargingSession
            {
                StationId = stationId,
                UserId = userId,
                StartTime = DateTime.UtcNow,
                StartKwh = 0,
                Status = "Charging"
            };

            _db.ChargingSessions.Add(session);
            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            var dto = _mapper.Map<ChargingStationDto>(station);
            await _redis.RefreshChargingStationAsync(stationId, dto);
            await _hub.PushChargingStationUpdated(dto);

            _logger.LogInformation("用户 {UserId} 开始使用充电桩 {StationCode}", userId, station.Code);
            return ApiResponse<ChargingSessionDto>.Success(_mapper.Map<ChargingSessionDto>(session));
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "开始充电失败");
            return ApiResponse<ChargingSessionDto>.Error("开始充电失败");
        }
    }

    public async Task<ApiResponse<ChargingSessionDto>> StopChargingAsync(string sessionId, string userId)
    {
        using var transaction = await _db.Database.BeginTransactionAsync();
        try
        {
            var session = await _db.ChargingSessions.FindAsync(sessionId);
            if (session == null || session.UserId != userId)
                return ApiResponse<ChargingSessionDto>.Error("充电会话不存在", 404);
            if (session.Status != "Charging")
                return ApiResponse<ChargingSessionDto>.Error("该会话已结束");

            var endTime = DateTime.UtcNow;
            session.EndTime = endTime;
            var durationHours = (decimal)(endTime - session.StartTime).TotalHours;
            var station = await _db.ChargingStations.FindAsync(session.StationId);
            var totalKwh = Math.Round((station?.Power ?? 60) * durationHours * 0.75m, 2);
            session.EndKwh = totalKwh;
            session.TotalKwh = totalKwh;
            session.Status = "Completed";

            var billing = await _billingService.CalculateChargingAsync(new ChargingBillingRequest
            {
                Kwh = totalKwh,
                StartTime = session.StartTime,
                EndTime = endTime
            });
            session.Cost = billing.Data?.TotalAmount ?? 0;

            if (station != null)
            {
                station.Status = ChargingStationStatus.Idle;
                station.CurrentPower = 0;
                station.ChargedKwh = 0;
                station.UpdatedAt = DateTime.UtcNow;

                var sDto = _mapper.Map<ChargingStationDto>(station);
                await _redis.RefreshChargingStationAsync(station.Id, sDto);
                await _hub.PushChargingStationUpdated(sDto);
            }

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            _logger.LogInformation("充电会话 {SessionId} 结束，电量 {Kwh} kWh，费用 {Cost}",
                sessionId, totalKwh, session.Cost);

            return ApiResponse<ChargingSessionDto>.Success(_mapper.Map<ChargingSessionDto>(session));
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "结束充电失败");
            return ApiResponse<ChargingSessionDto>.Error("结束充电失败");
        }
    }

    public async Task<ApiResponse<PagedResult<ChargingSessionDto>>> GetSessionsAsync(PagedQuery query, string? status, string? userId)
    {
        var q = _db.ChargingSessions.AsNoTracking().AsQueryable();
        if (!string.IsNullOrEmpty(userId)) q = q.Where(s => s.UserId == userId);
        if (!string.IsNullOrEmpty(status)) q = q.Where(s => s.Status == status);

        q = q.OrderByDescending(s => s.CreatedAt);

        var total = await q.CountAsync();
        var items = await q
            .Skip((query.PageIndex - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return ApiResponse<PagedResult<ChargingSessionDto>>.Success(
            PagedResult<ChargingSessionDto>.Create(_mapper.Map<List<ChargingSessionDto>>(items), total, query.PageIndex, query.PageSize));
    }

    public async Task<ApiResponse<List<AvailableSlotDto>>> GetAvailableSlotsAsync(string stationId, string date)
    {
        if (!DateTime.TryParse(date, out var targetDate))
            return ApiResponse<List<AvailableSlotDto>>.Error("日期格式不正确");

        var reservations = await _db.ChargingReservations
            .Where(r => r.StationId == stationId
                && r.Status == "Active"
                && r.StartTime.Date == targetDate.Date)
            .ToListAsync();

        var slots = new List<AvailableSlotDto>();
        for (int h = 0; h < 24; h++)
        {
            var start = targetDate.Date.AddHours(h);
            var end = start.AddHours(1);
            var occupied = reservations.Any(r => r.StartTime < end && r.EndTime > start);
            slots.Add(new AvailableSlotDto
            {
                StartTime = $"{h:D2}:00:00",
                EndTime = $"{h + 1:D2}:00:00",
                Available = !occupied
            });
        }

        return ApiResponse<List<AvailableSlotDto>>.Success(slots);
    }
}
