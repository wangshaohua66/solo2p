using Microsoft.EntityFrameworkCore;
using FireIoTPlatform.Models.DTOs.Common;
using FireIoTPlatform.Models.DTOs.Dispatch;
using FireIoTPlatform.Models.Entities;
using FireIoTPlatform.Models.Enums;
using FireIoTPlatform.Repositories;
using FireIoTPlatform.Hubs;
using Microsoft.AspNetCore.SignalR;
using FireIoTPlatform.Models.DTOs.Unit;

namespace FireIoTPlatform.Services;

public class DispatchService : IDispatchService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IHubContext<FireAlarmHub> _hubContext;
    private readonly ILogger<DispatchService> _logger;

    public DispatchService(IUnitOfWork unitOfWork, IHubContext<FireAlarmHub> hubContext, ILogger<DispatchService> logger)
    {
        _unitOfWork = unitOfWork;
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task<ApiResponse<RescueDispatchDto>> GetByIdAsync(long id)
    {
        var dispatch = await _unitOfWork.RescueDispatches.GetByIdAsync(id);
        if (dispatch == null || dispatch.IsDeleted) return ApiResponse<RescueDispatchDto>.Error(404, "调度记录不存在");
        return ApiResponse<RescueDispatchDto>.Success(await MapDispatchToDtoAsync(dispatch));
    }

    public async Task<ApiResponse<PagedResult<RescueDispatchDto>>> GetPagedAsync(DispatchQueryDto query)
    {
        var predicate = PredicateBuilder.True<RescueDispatch>().And(d => !d.IsDeleted);
        if (query.Status.HasValue) predicate = predicate.And(d => d.Status == query.Status.Value);
        if (query.FireStationId.HasValue) predicate = predicate.And(d => d.FireStationId == query.FireStationId.Value);
        if (query.FireUnitId.HasValue) predicate = predicate.And(d => d.FireUnitId == query.FireUnitId.Value);
        if (query.StartTime.HasValue) predicate = predicate.And(d => d.DispatchTime >= query.StartTime.Value);
        if (query.EndTime.HasValue) predicate = predicate.And(d => d.DispatchTime <= query.EndTime.Value);
        if (!string.IsNullOrEmpty(query.Keyword))
            predicate = predicate.And(d => d.DispatchNo.Contains(query.Keyword) || (d.Location != null && d.Location.Contains(query.Keyword)));

        if (!string.IsNullOrEmpty(query.DistrictCode))
        {
            var unitIds = (await _unitOfWork.FireUnits.FindAsync(u => !u.IsDeleted && u.DistrictCode == query.DistrictCode)).Select(u => u.Id).ToList();
            if (unitIds.Any()) predicate = predicate.And(d => unitIds.Contains(d.FireUnitId));
        }

        var result = await _unitOfWork.RescueDispatches.GetPagedAsync(predicate, query.PageIndex, query.PageSize, d => d.DispatchTime, query.IsDescending);
        var dtos = new List<RescueDispatchDto>();
        foreach (var d in result.Items) dtos.Add(await MapDispatchToDtoAsync(d));

        return ApiResponse<PagedResult<RescueDispatchDto>>.Success(new PagedResult<RescueDispatchDto>
        { Items = dtos, TotalCount = result.TotalCount, PageIndex = query.PageIndex, PageSize = query.PageSize });
    }

    public async Task<ApiResponse<RescueDispatchDto>> CreateDispatchAsync(DispatchCreateDto dto)
    {
        var unit = await _unitOfWork.FireUnits.GetByIdAsync(dto.FireUnitId);
        if (unit == null || unit.IsDeleted) return ApiResponse<RescueDispatchDto>.Error(404, "单位不存在");

        long stationId;
        if (dto.FireStationId.HasValue)
        {
            var station = await _unitOfWork.FireStations.GetByIdAsync(dto.FireStationId.Value);
            if (station == null || !station.IsActive) return ApiResponse<RescueDispatchDto>.Error(404, "消防站不存在或未启用");
            stationId = station.Id;
        }
        else
        {
            var nearby = await FindNearbyStationsAsync(dto.Latitude, dto.Longitude, 1);
            if (nearby.Code != 200 || !nearby.Data!.Any())
                return ApiResponse<RescueDispatchDto>.Error(400, "未找到可用消防站");
            stationId = nearby.Data.First().FireStationId;
        }

        var stationEntity = await _unitOfWork.FireStations.GetByIdAsync(stationId);
        var dispatcher = dto.DispatcherId > 0 ? await _unitOfWork.Users.GetByIdAsync(dto.DispatcherId) : null;
        var etaMinutes = (int)Math.Ceiling(CalculateDistance(dto.Latitude, dto.Longitude, stationEntity!.Latitude, stationEntity.Longitude) / 0.5);

        var dispatch = new RescueDispatch
        {
            DispatchNo = GenerateDispatchNo(),
            AlarmId = dto.AlarmId,
            FireUnitId = dto.FireUnitId,
            FireStationId = stationId,
            Status = DispatchStatus.Created,
            FireType = dto.FireType,
            FireLevel = dto.FireLevel,
            Location = dto.Location,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            DispatchTime = DateTime.Now,
            DispatcherId = dto.DispatcherId,
            DispatcherName = dispatcher?.RealName,
            EstimatedArrivalMinutes = etaMinutes,
            BuildingInfo = unit != null ? $"建筑面积:{unit.BuildingArea}㎡, {unit.FloorCount}层" : null,
            FacilityDistribution = null,
            HazardousMaterials = unit?.HazardousMaterials,
            NearbyWaterSources = null,
            DispatchRemark = dto.DispatchRemark
        };

        await _unitOfWork.BeginTransactionAsync();
        try
        {
            await _unitOfWork.RescueDispatches.AddAsync(dispatch);
            await _unitOfWork.SaveChangesAsync();

            if (dto.FirefighterIds != null && dto.FirefighterIds.Any())
            {
                foreach (var ffId in dto.FirefighterIds)
                {
                    await _unitOfWork.DispatchFirefighters.AddAsync(new DispatchFirefighter
                    {
                        DispatchId = dispatch.Id,
                        FirefighterId = ffId,
                        AssignedAt = dispatch.DispatchTime
                    });
                }
            }
            else
            {
                var firefighters = await _unitOfWork.Firefighters.FindAsync(f => f.FireStationId == stationId && f.IsOnDuty && f.IsActive);
                foreach (var ff in firefighters.Take(5))
                {
                    await _unitOfWork.DispatchFirefighters.AddAsync(new DispatchFirefighter
                    {
                        DispatchId = dispatch.Id,
                        FirefighterId = ff.Id,
                        AssignedAt = dispatch.DispatchTime
                    });
                }
            }

            if (dto.AlarmId.HasValue)
            {
                var alarm = await _unitOfWork.AlarmRecords.GetByIdAsync(dto.AlarmId.Value);
                if (alarm != null)
                {
                    alarm.DispatchId = dispatch.Id;
                    alarm.Status = AlarmStatus.Processing;
                    _unitOfWork.AlarmRecords.Update(alarm);
                }
            }

            await _unitOfWork.SaveChangesAsync();
            await _unitOfWork.CommitTransactionAsync();
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync();
            throw;
        }

        var dispatchDto = await MapDispatchToDtoAsync(dispatch);
        await _hubContext.Clients.Group($"station_{stationId}").SendAsync("NewDispatch", dispatchDto);
        await _hubContext.Clients.All.SendAsync("DispatchUpdated", dispatchDto);
        _logger.LogInformation($"救援调度已创建: DispatchNo={dispatch.DispatchNo}, Station={stationEntity?.StationName}");

        return ApiResponse<RescueDispatchDto>.Success("调度成功", dispatchDto);
    }

    public async Task<ApiResponse<bool>> UpdateStatusAsync(DispatchStatusUpdateDto dto)
    {
        var dispatch = await _unitOfWork.RescueDispatches.GetByIdAsync(dto.DispatchId);
        if (dispatch == null || dispatch.IsDeleted) return ApiResponse<bool>.Error(404, "调度不存在");

        var now = DateTime.Now;
        switch (dto.Status)
        {
            case DispatchStatus.Dispatched:
                dispatch.DepartureTime = now;
                break;
            case DispatchStatus.EnRoute:
                if (!dispatch.DepartureTime.HasValue) dispatch.DepartureTime = now;
                break;
            case DispatchStatus.OnScene:
                dispatch.ArrivalTime = now;
                break;
            case DispatchStatus.Resolved:
                dispatch.ResolveTime = now;
                break;
            case DispatchStatus.Returned:
                dispatch.ReturnTime = now;
                break;
        }
        dispatch.Status = dto.Status;

        _unitOfWork.RescueDispatches.Update(dispatch);

        var ffList = await _unitOfWork.DispatchFirefighters.FindAsync(df => df.DispatchId == dispatch.Id);
        foreach (var df in ffList)
        {
            if (dto.Status == DispatchStatus.OnScene && !df.ArrivedAt.HasValue) df.ArrivedAt = now;
            if (dto.Status == DispatchStatus.Returned && !df.ReturnedAt.HasValue) df.ReturnedAt = now;
            _unitOfWork.DispatchFirefighters.Update(df);
        }

        await _unitOfWork.SaveChangesAsync();

        var dtoDispatch = await MapDispatchToDtoAsync(dispatch);
        await _hubContext.Clients.Group($"station_{dispatch.FireStationId}").SendAsync("DispatchUpdated", dtoDispatch);
        await _hubContext.Clients.All.SendAsync("DispatchUpdated", dtoDispatch);

        return ApiResponse<bool>.Success("状态更新成功", true);
    }

    public async Task<ApiResponse<bool>> SubmitReportAsync(DispatchReportDto dto)
    {
        var dispatch = await _unitOfWork.RescueDispatches.GetByIdAsync(dto.DispatchId);
        if (dispatch == null || dispatch.IsDeleted) return ApiResponse<bool>.Error(404, "调度不存在");

        dispatch.OnSceneReport = dto.OnSceneReport;
        dispatch.RescueSummary = dto.RescueSummary;
        dispatch.Casualties = dto.Casualties;
        dispatch.Injuries = dto.Injuries;
        dispatch.FireArea = dto.FireArea;
        dispatch.EstimatedLoss = dto.EstimatedLoss;
        dispatch.Status = DispatchStatus.Resolved;
        dispatch.ResolveTime = DateTime.Now;

        _unitOfWork.RescueDispatches.Update(dispatch);
        await _unitOfWork.SaveChangesAsync();
        return ApiResponse<bool>.Success("报告提交成功", true);
    }

    public async Task<ApiResponse<List<NearbyStationDto>>> FindNearbyStationsAsync(decimal latitude, decimal longitude, int count = 3)
    {
        var activeStations = await _unitOfWork.FireStations.FindAsync(s => s.IsActive);
        var stationDtos = new List<NearbyStationDto>();

        foreach (var s in activeStations)
        {
            var distance = CalculateDistance(latitude, longitude, s.Latitude, s.Longitude);
            if (distance <= s.CoverageRadiusKm * 2)
            {
                var onDutyCount = (await _unitOfWork.Firefighters.FindAsync(f => f.FireStationId == s.Id && f.IsOnDuty && f.IsActive)).Count();
                stationDtos.Add(new NearbyStationDto
                {
                    FireStationId = s.Id,
                    StationName = s.StationName,
                    Address = s.Address,
                    DistanceKm = Math.Round(distance, 2),
                    EstimatedArrivalMinutes = (int)Math.Ceiling(distance / 0.5),
                    FirefighterOnDutyCount = onDutyCount,
                    AvailableVehicleCount = s.VehicleCount
                });
            }
        }

        var result = stationDtos.OrderBy(s => s.DistanceKm).Take(count).ToList();
        return ApiResponse<List<NearbyStationDto>>.Success(result);
    }

    public async Task<ApiResponse<List<FireStationDto>>> GetAllStationsAsync()
    {
        var stations = await _unitOfWork.FireStations.GetAllAsync();
        var dtos = stations.Where(s => !s.IsDeleted).Select(s => new FireStationDto
        {
            Id = s.Id,
            StationCode = s.StationCode,
            StationName = s.StationName,
            Address = s.Address,
            Latitude = s.Latitude,
            Longitude = s.Longitude,
            StationChief = s.StationChief,
            ContactPhone = s.ContactPhone,
            FirefighterCount = s.FirefighterCount,
            VehicleCount = s.VehicleCount,
            CoverageRadiusKm = s.CoverageRadiusKm,
            IsActive = s.IsActive
        }).ToList();
        return ApiResponse<List<FireStationDto>>.Success(dtos);
    }

    public async Task<ApiResponse<FireStationDto>> GetStationByIdAsync(long id)
    {
        var s = await _unitOfWork.FireStations.GetByIdAsync(id);
        if (s == null || s.IsDeleted) return ApiResponse<FireStationDto>.Error(404, "消防站不存在");
        return ApiResponse<FireStationDto>.Success(new FireStationDto
        {
            Id = s.Id,
            StationCode = s.StationCode,
            StationName = s.StationName,
            Address = s.Address,
            Latitude = s.Latitude,
            Longitude = s.Longitude,
            StationChief = s.StationChief,
            ContactPhone = s.ContactPhone,
            FirefighterCount = s.FirefighterCount,
            VehicleCount = s.VehicleCount,
            CoverageRadiusKm = s.CoverageRadiusKm,
            IsActive = s.IsActive
        });
    }

    public async Task<ApiResponse<List<FirefighterDto>>> GetFirefightersByStationAsync(long stationId)
    {
        var firefighters = await _unitOfWork.Firefighters.FindAsync(f => f.FireStationId == stationId && !f.IsDeleted);
        var station = await _unitOfWork.FireStations.GetByIdAsync(stationId);
        var dtos = firefighters.Select(f => new FirefighterDto
        {
            Id = f.Id,
            EmployeeNo = f.EmployeeNo,
            Name = f.Name,
            Phone = f.Phone,
            Role = f.Role,
            FireStationId = f.FireStationId,
            FireStationName = station?.StationName,
            Rank = f.Rank,
            Specialties = f.Specialties,
            IsOnDuty = f.IsOnDuty
        }).ToList();
        return ApiResponse<List<FirefighterDto>>.Success(dtos);
    }

    public async Task<ApiResponse<FireStationDto>> CreateStationAsync(FireStationDto dto)
    {
        var station = new FireStation
        {
            StationCode = dto.StationCode,
            StationName = dto.StationName,
            Address = dto.Address,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            StationChief = dto.StationChief,
            ContactPhone = dto.ContactPhone,
            FirefighterCount = dto.FirefighterCount,
            VehicleCount = dto.VehicleCount,
            CoverageRadiusKm = dto.CoverageRadiusKm > 0 ? dto.CoverageRadiusKm : 5,
            IsActive = dto.IsActive
        };
        await _unitOfWork.FireStations.AddAsync(station);
        await _unitOfWork.SaveChangesAsync();
        dto.Id = station.Id;
        return ApiResponse<FireStationDto>.Success("创建成功", dto);
    }

    public async Task<ApiResponse<bool>> UpdateStationAsync(long id, FireStationDto dto)
    {
        var s = await _unitOfWork.FireStations.GetByIdAsync(id);
        if (s == null || s.IsDeleted) return ApiResponse<bool>.Error(404, "消防站不存在");
        s.StationName = dto.StationName;
        s.Address = dto.Address;
        s.Latitude = dto.Latitude;
        s.Longitude = dto.Longitude;
        s.StationChief = dto.StationChief;
        s.ContactPhone = dto.ContactPhone;
        s.FirefighterCount = dto.FirefighterCount;
        s.VehicleCount = dto.VehicleCount;
        s.CoverageRadiusKm = dto.CoverageRadiusKm;
        s.IsActive = dto.IsActive;
        _unitOfWork.FireStations.Update(s);
        await _unitOfWork.SaveChangesAsync();
        return ApiResponse<bool>.Success("更新成功", true);
    }

    public async Task<ApiResponse<FirefighterDto>> CreateFirefighterAsync(FirefighterDto dto)
    {
        var station = await _unitOfWork.FireStations.GetByIdAsync(dto.FireStationId);
        if (station == null || !station.IsActive) return ApiResponse<FirefighterDto>.Error(404, "消防站不存在");

        var ff = new Firefighter
        {
            EmployeeNo = dto.EmployeeNo,
            Name = dto.Name,
            Phone = dto.Phone,
            Role = dto.Role,
            FireStationId = dto.FireStationId,
            Rank = dto.Rank,
            Specialties = dto.Specialties,
            IsOnDuty = dto.IsOnDuty,
            IsActive = true
        };
        await _unitOfWork.Firefighters.AddAsync(ff);
        await _unitOfWork.SaveChangesAsync();
        dto.Id = ff.Id;
        dto.FireStationName = station.StationName;
        return ApiResponse<FirefighterDto>.Success("创建成功", dto);
    }

    public async Task AutoDispatchForAlarmAsync(long alarmId)
    {
        var alarm = await _unitOfWork.AlarmRecords.GetByIdAsync(alarmId);
        if (alarm == null || alarm.DispatchId.HasValue) return;

        var unit = await _unitOfWork.FireUnits.GetByIdAsync(alarm.FireUnitId);
        if (unit == null) return;

        var nearby = await FindNearbyStationsAsync(unit.Latitude ?? 0, unit.Longitude ?? 0, 1);
        if (nearby.Code != 200 || !nearby.Data!.Any()) return;

        var dispatch = await CreateDispatchAsync(new DispatchCreateDto
        {
            AlarmId = alarmId,
            FireUnitId = alarm.FireUnitId,
            FireStationId = nearby.Data.First().FireStationId,
            Location = unit.Address,
            Latitude = unit.Latitude ?? 0,
            Longitude = unit.Longitude ?? 0,
            FireType = alarm.AlarmType == AlarmType.SmokeAlarm || alarm.AlarmType == AlarmType.TemperatureAlarm ? "火灾" : "应急",
            FireLevel = alarm.AlarmLevel.ToString()
        });

        if (dispatch.Code == 200)
            _logger.LogInformation($"自动调度成功: AlarmId={alarmId}, DispatchNo={dispatch.Data?.DispatchNo}");
    }

    public async Task<ApiResponse<bool>> UpdateRoadConditionAsync(long dispatchId, string roadCondition)
    {
        var dispatch = await _unitOfWork.RescueDispatches.GetByIdAsync(dispatchId);
        if (dispatch == null || dispatch.IsDeleted)
            return ApiResponse<bool>.Error(404, "调度记录不存在");

        if (dispatch.Status is DispatchStatus.Resolved or DispatchStatus.Returned)
            return ApiResponse<bool>.Error(400, "调度已结束，无法更新路况");

        dispatch.RoadCondition = roadCondition;
        _unitOfWork.RescueDispatches.Update(dispatch);
        await _unitOfWork.SaveChangesAsync();

        var dto = await MapDispatchToDtoAsync(dispatch);
        await _hubContext.Clients.Group($"station_{dispatch.FireStationId}").SendAsync("DispatchUpdated", dto);
        await _hubContext.Clients.Group($"unit_{dispatch.FireUnitId}").SendAsync("DispatchUpdated", dto);

        _logger.LogInformation($"救援路况更新: DispatchId={dispatchId}, RoadCondition={roadCondition}");
        return ApiResponse<bool>.Success("路况更新成功", true);
    }

    public async Task<ApiResponse<bool>> UpdateLiveVideoAsync(long dispatchId, string liveVideoUrl)
    {
        var dispatch = await _unitOfWork.RescueDispatches.GetByIdAsync(dispatchId);
        if (dispatch == null || dispatch.IsDeleted)
            return ApiResponse<bool>.Error(404, "调度记录不存在");

        dispatch.LiveVideoUrl = liveVideoUrl;
        _unitOfWork.RescueDispatches.Update(dispatch);
        await _unitOfWork.SaveChangesAsync();

        var dto = await MapDispatchToDtoAsync(dispatch);
        await _hubContext.Clients.Group($"station_{dispatch.FireStationId}").SendAsync("DispatchUpdated", dto);
        await _hubContext.Clients.Group($"unit_{dispatch.FireUnitId}").SendAsync("DispatchUpdated", dto);

        _logger.LogInformation($"现场视频更新: DispatchId={dispatchId}, LiveVideoUrl={liveVideoUrl}");
        return ApiResponse<bool>.Success("视频地址更新成功", true);
    }

    private async Task<RescueDispatchDto> MapDispatchToDtoAsync(RescueDispatch dispatch)
    {
        var unit = await _unitOfWork.FireUnits.GetByIdAsync(dispatch.FireUnitId);
        var station = await _unitOfWork.FireStations.GetByIdAsync(dispatch.FireStationId);
        var ffList = await _unitOfWork.DispatchFirefighters.FindAsync(df => df.DispatchId == dispatch.Id);

        var ffDtos = new List<DispatchFirefighterDto>();
        foreach (var df in ffList)
        {
            var ff = await _unitOfWork.Firefighters.GetByIdAsync(df.FirefighterId);
            ffDtos.Add(new DispatchFirefighterDto
            {
                FirefighterId = df.FirefighterId,
                FirefighterName = ff?.Name,
                Role = df.Role,
                AssignedAt = df.AssignedAt
            });
        }

        return new RescueDispatchDto
        {
            Id = dispatch.Id,
            DispatchNo = dispatch.DispatchNo,
            AlarmId = dispatch.AlarmId,
            FireUnitId = dispatch.FireUnitId,
            FireUnitName = unit?.Name,
            FireStationId = dispatch.FireStationId,
            FireStationName = station?.StationName,
            Status = dispatch.Status,
            StatusName = GetDispatchStatusName(dispatch.Status),
            FireType = dispatch.FireType,
            FireLevel = dispatch.FireLevel,
            Location = dispatch.Location,
            Latitude = dispatch.Latitude,
            Longitude = dispatch.Longitude,
            DispatchTime = dispatch.DispatchTime,
            DepartureTime = dispatch.DepartureTime,
            ArrivalTime = dispatch.ArrivalTime,
            ResolveTime = dispatch.ResolveTime,
            DispatcherName = dispatch.DispatcherName,
            CommanderName = dispatch.CommanderName,
            EstimatedArrivalMinutes = dispatch.EstimatedArrivalMinutes,
            BuildingInfo = dispatch.BuildingInfo,
            FacilityDistribution = dispatch.FacilityDistribution,
            HazardousMaterials = dispatch.HazardousMaterials,
            NearbyWaterSources = dispatch.NearbyWaterSources,
            RoadCondition = dispatch.RoadCondition,
            LiveVideoUrl = dispatch.LiveVideoUrl,
            RescueSummary = dispatch.RescueSummary,
            Casualties = dispatch.Casualties,
            Injuries = dispatch.Injuries,
            Firefighters = ffDtos,
            CreatedAt = dispatch.CreatedAt
        };
    }

    private static decimal CalculateDistance(decimal lat1, decimal lon1, decimal lat2, decimal lon2)
    {
        var R = 6371m;
        var dLat = ToRadians(lat2 - lat1);
        var dLon = ToRadians(lon2 - lon1);
        var a = (decimal)(Math.Sin((double)(dLat / 2)) * Math.Sin((double)(dLat / 2)) +
            Math.Cos((double)ToRadians(lat1)) * Math.Cos((double)ToRadians(lat2)) *
            Math.Sin((double)(dLon / 2)) * Math.Sin((double)(dLon / 2)));
        var c = 2 * (decimal)Math.Atan2(Math.Sqrt((double)a), Math.Sqrt((double)(1 - a)));
        return R * c;
    }

    private static decimal ToRadians(decimal degrees) => degrees * (decimal)Math.PI / 180m;

    private static string GetDispatchStatusName(DispatchStatus s) => s switch
    {
        DispatchStatus.Created => "已创建",
        DispatchStatus.Dispatched => "已出警",
        DispatchStatus.EnRoute => "途中",
        DispatchStatus.OnScene => "已到场",
        DispatchStatus.Resolved => "已处置",
        DispatchStatus.Returned => "已归队",
        _ => "未知"
    };

    private static string GenerateDispatchNo() => $"DSP{DateTime.Now:yyyyMMddHHmmss}{new Random().Next(1000, 9999)}";
}

public class FireUnitService : IFireUnitService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<FireUnitService> _logger;

    public FireUnitService(IUnitOfWork unitOfWork, ILogger<FireUnitService> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<ApiResponse<FireUnitDto>> GetByIdAsync(long id)
    {
        var unit = await _unitOfWork.FireUnits.GetByIdAsync(id);
        if (unit == null || unit.IsDeleted) return ApiResponse<FireUnitDto>.Error(404, "单位不存在");
        var devices = await _unitOfWork.Devices.FindAsync(d => d.FireUnitId == id && !d.IsDeleted);
        var dto = MapToDto(unit);
        dto.DeviceCount = devices.Count();
        return ApiResponse<FireUnitDto>.Success(dto);
    }

    public async Task<ApiResponse<PagedResult<FireUnitDto>>> GetPagedAsync(FireUnitQueryDto query)
    {
        var predicate = PredicateBuilder.True<FireUnit>().And(u => !u.IsDeleted);
        if (query.UnitType.HasValue) predicate = predicate.And(u => u.UnitType == query.UnitType.Value);
        if (!string.IsNullOrEmpty(query.DistrictCode)) predicate = predicate.And(u => u.DistrictCode == query.DistrictCode);
        if (query.IsKeyUnit.HasValue) predicate = predicate.And(u => u.IsKeyUnit == query.IsKeyUnit.Value);
        if (query.Level.HasValue) predicate = predicate.And(u => u.Level == query.Level.Value);
        if (!string.IsNullOrEmpty(query.Keyword))
            predicate = predicate.And(u => u.Name.Contains(query.Keyword) || (u.Address != null && u.Address.Contains(query.Keyword)));

        var result = await _unitOfWork.FireUnits.GetPagedAsync(predicate, query.PageIndex, query.PageSize, u => u.CreatedAt, query.IsDescending);
        var dtos = new List<FireUnitDto>();
        foreach (var u in result.Items)
        {
            var dto = MapToDto(u);
            var deviceCount = await _unitOfWork.Devices.CountAsync(d => d.FireUnitId == u.Id && !d.IsDeleted);
            dto.DeviceCount = deviceCount;
            dtos.Add(dto);
        }

        return ApiResponse<PagedResult<FireUnitDto>>.Success(new PagedResult<FireUnitDto>
        { Items = dtos, TotalCount = result.TotalCount, PageIndex = query.PageIndex, PageSize = query.PageSize });
    }

    public async Task<ApiResponse<FireUnitDto>> CreateAsync(FireUnitCreateDto dto)
    {
        if (await _unitOfWork.FireUnits.ExistsAsync(u => u.Name == dto.Name && !u.IsDeleted))
            return ApiResponse<FireUnitDto>.Error(400, "单位名称已存在");

        var unit = new FireUnit
        {
            Name = dto.Name,
            UnifiedSocialCreditCode = dto.UnifiedSocialCreditCode,
            UnitType = dto.UnitType,
            Address = dto.Address,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            LegalPerson = dto.LegalPerson,
            ContactPerson = dto.ContactPerson,
            ContactPhone = dto.ContactPhone,
            ContactEmail = dto.ContactEmail,
            BuildingArea = dto.BuildingArea,
            FloorCount = dto.FloorCount,
            BasementCount = dto.BasementCount,
            BuildingStructure = dto.BuildingStructure,
            FireSafetyManager = dto.FireSafetyManager,
            FireSafetyManagerPhone = dto.FireSafetyManagerPhone,
            FloorPlanUrl = dto.FloorPlanUrl,
            HazardousMaterials = dto.HazardousMaterials,
            Description = dto.Description,
            DistrictCode = dto.DistrictCode,
            DistrictName = dto.DistrictName,
            IsKeyUnit = dto.IsKeyUnit,
            Level = dto.Level
        };

        await _unitOfWork.FireUnits.AddAsync(unit);
        await _unitOfWork.SaveChangesAsync();

        var result = MapToDto(unit);
        return ApiResponse<FireUnitDto>.Success("创建成功", result);
    }

    public async Task<ApiResponse<bool>> UpdateAsync(long id, FireUnitCreateDto dto)
    {
        var unit = await _unitOfWork.FireUnits.GetByIdAsync(id);
        if (unit == null || unit.IsDeleted) return ApiResponse<bool>.Error(404, "单位不存在");

        unit.Name = dto.Name;
        unit.UnifiedSocialCreditCode = dto.UnifiedSocialCreditCode;
        unit.UnitType = dto.UnitType;
        unit.Address = dto.Address;
        unit.Latitude = dto.Latitude;
        unit.Longitude = dto.Longitude;
        unit.LegalPerson = dto.LegalPerson;
        unit.ContactPerson = dto.ContactPerson;
        unit.ContactPhone = dto.ContactPhone;
        unit.ContactEmail = dto.ContactEmail;
        unit.BuildingArea = dto.BuildingArea;
        unit.FloorCount = dto.FloorCount;
        unit.BasementCount = dto.BasementCount;
        unit.BuildingStructure = dto.BuildingStructure;
        unit.FireSafetyManager = dto.FireSafetyManager;
        unit.FireSafetyManagerPhone = dto.FireSafetyManagerPhone;
        unit.FloorPlanUrl = dto.FloorPlanUrl;
        unit.HazardousMaterials = dto.HazardousMaterials;
        unit.Description = dto.Description;
        unit.DistrictCode = dto.DistrictCode;
        unit.DistrictName = dto.DistrictName;
        unit.IsKeyUnit = dto.IsKeyUnit;
        unit.Level = dto.Level;

        _unitOfWork.FireUnits.Update(unit);
        await _unitOfWork.SaveChangesAsync();
        return ApiResponse<bool>.Success("更新成功", true);
    }

    public async Task<ApiResponse<bool>> DeleteAsync(long id)
    {
        var unit = await _unitOfWork.FireUnits.GetByIdAsync(id);
        if (unit == null || unit.IsDeleted) return ApiResponse<bool>.Error(404, "单位不存在");
        unit.IsDeleted = true;
        _unitOfWork.FireUnits.Update(unit);
        await _unitOfWork.SaveChangesAsync();
        return ApiResponse<bool>.Success("删除成功", true);
    }

    public async Task<ApiResponse<WaterSystemStatusDto>> GetWaterSystemStatusAsync(long fireUnitId)
    {
        var unit = await _unitOfWork.FireUnits.GetByIdAsync(fireUnitId);
        if (unit == null) return ApiResponse<WaterSystemStatusDto>.Error(404, "单位不存在");

        var waterTypes = new[] { DeviceType.WaterPressureMonitor, DeviceType.WaterLevelMonitor, DeviceType.HydrantStatusMonitor };
        var devices = await _unitOfWork.Devices.FindAsync(d => d.FireUnitId == fireUnitId && waterTypes.Contains(d.DeviceType) && !d.IsDeleted);

        var deviceDtos = new List<WaterSystemDeviceDto>();
        foreach (var d in devices)
        {
            var latestData = (await _unitOfWork.DeviceDatas
                .FindAsync(dd => dd.DeviceId == d.Id))
                .OrderByDescending(dd => dd.Timestamp).FirstOrDefault();

            deviceDtos.Add(new WaterSystemDeviceDto
            {
                DeviceId = d.Id,
                DeviceCode = d.DeviceCode,
                DeviceName = d.DeviceName,
                DeviceType = d.DeviceType,
                CurrentValue = latestData?.Value,
                WarningThresholdLow = d.WarningThresholdLow,
                WarningThresholdHigh = d.WarningThresholdHigh,
                CriticalThresholdLow = d.CriticalThresholdLow,
                CriticalThresholdHigh = d.CriticalThresholdHigh,
                Status = d.Status,
                Location = d.Location,
                LastUpdateAt = latestData?.Timestamp ?? d.LastHeartbeatAt
            });
        }

        var abnormalStatuses = new[] { DeviceStatus.Alarm, DeviceStatus.Fault, DeviceStatus.Offline };
        var result = new WaterSystemStatusDto
        {
            FireUnitId = fireUnitId,
            FireUnitName = unit.Name,
            PoolLevelMonitorCount = devices.Count(d => d.DeviceType == DeviceType.WaterLevelMonitor),
            PressureMonitorCount = devices.Count(d => d.DeviceType == DeviceType.WaterPressureMonitor),
            HydrantMonitorCount = devices.Count(d => d.DeviceType == DeviceType.HydrantStatusMonitor),
            AbnormalCount = devices.Count(d => abnormalStatuses.Contains(d.Status)),
            Devices = deviceDtos
        };

        return ApiResponse<WaterSystemStatusDto>.Success(result);
    }

    public async Task<ApiResponse<List<WaterSystemStatusDto>>> GetWaterSystemStatusListAsync(string? districtCode = null)
    {
        var predicate = PredicateBuilder.True<FireUnit>().And(u => !u.IsDeleted);
        if (!string.IsNullOrEmpty(districtCode)) predicate = predicate.And(u => u.DistrictCode == districtCode);
        var units = await _unitOfWork.FireUnits.FindAsync(predicate);

        var result = new List<WaterSystemStatusDto>();
        foreach (var u in units)
        {
            var status = await GetWaterSystemStatusAsync(u.Id);
            if (status.Code == 200 && status.Data != null)
                result.Add(status.Data);
        }
        return ApiResponse<List<WaterSystemStatusDto>>.Success(result);
    }

    private static FireUnitDto MapToDto(FireUnit unit) => new()
    {
        Id = unit.Id,
        Name = unit.Name,
        UnifiedSocialCreditCode = unit.UnifiedSocialCreditCode,
        UnitType = unit.UnitType,
        UnitTypeName = GetUnitTypeName(unit.UnitType),
        Address = unit.Address,
        Latitude = unit.Latitude,
        Longitude = unit.Longitude,
        LegalPerson = unit.LegalPerson,
        ContactPerson = unit.ContactPerson,
        ContactPhone = unit.ContactPhone,
        ContactEmail = unit.ContactEmail,
        BuildingArea = unit.BuildingArea,
        FloorCount = unit.FloorCount,
        BasementCount = unit.BasementCount,
        FireSafetyManager = unit.FireSafetyManager,
        FireSafetyManagerPhone = unit.FireSafetyManagerPhone,
        FloorPlanUrl = unit.FloorPlanUrl,
        HazardousMaterials = unit.HazardousMaterials,
        Description = unit.Description,
        DistrictCode = unit.DistrictCode,
        DistrictName = unit.DistrictName,
        IsKeyUnit = unit.IsKeyUnit,
        Level = unit.Level,
        CreatedAt = unit.CreatedAt
    };

    private static string GetUnitTypeName(UnitType t) => t switch
    {
        UnitType.Commercial => "商业场所",
        UnitType.Residential => "居民住宅",
        UnitType.Industrial => "工业企业",
        UnitType.Government => "政府机关",
        UnitType.Educational => "教育机构",
        UnitType.Medical => "医疗机构",
        UnitType.Other => "其他",
        _ => "未知"
    };
}
