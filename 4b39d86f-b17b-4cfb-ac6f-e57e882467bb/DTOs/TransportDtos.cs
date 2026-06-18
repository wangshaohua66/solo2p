namespace HazChemSupervision.DTOs;

public class TransportRecordDto
{
    public int Id { get; set; }
    public string TransportNo { get; set; } = string.Empty;
    public int EnterpriseId { get; set; }
    public string EnterpriseName { get; set; } = string.Empty;
    public int ChemicalBatchId { get; set; }
    public string BatchNo { get; set; } = string.Empty;
    public string ChemicalName { get; set; } = string.Empty;
    public string VehiclePlateNo { get; set; } = string.Empty;
    public string GpsDeviceId { get; set; } = string.Empty;
    public string DriverName { get; set; } = string.Empty;
    public string DriverLicenseNo { get; set; } = string.Empty;
    public string DriverPhone { get; set; } = string.Empty;
    public string EscortName { get; set; } = string.Empty;
    public string StartLocation { get; set; } = string.Empty;
    public string EndLocation { get; set; } = string.Empty;
    public decimal StartLongitude { get; set; }
    public decimal StartLatitude { get; set; }
    public decimal EndLongitude { get; set; }
    public decimal EndLatitude { get; set; }
    public string? PlannedRoute { get; set; }
    public DateTime PlannedDepartureTime { get; set; }
    public DateTime? ActualDepartureTime { get; set; }
    public DateTime? ActualArrivalTime { get; set; }
    public int Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public decimal CurrentSpeed { get; set; }
    public decimal CurrentTemperature { get; set; }
    public bool IsDeviating { get; set; }
    public bool IsOverspeeding { get; set; }
    public bool IsTemperatureAbnormal { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class TransportRecordCreateDto
{
    public string TransportNo { get; set; } = string.Empty;
    public int EnterpriseId { get; set; }
    public int ChemicalBatchId { get; set; }
    public string VehiclePlateNo { get; set; } = string.Empty;
    public string GpsDeviceId { get; set; } = string.Empty;
    public string DriverName { get; set; } = string.Empty;
    public string DriverLicenseNo { get; set; } = string.Empty;
    public string DriverPhone { get; set; } = string.Empty;
    public string EscortName { get; set; } = string.Empty;
    public string StartLocation { get; set; } = string.Empty;
    public string EndLocation { get; set; } = string.Empty;
    public decimal StartLongitude { get; set; }
    public decimal StartLatitude { get; set; }
    public decimal EndLongitude { get; set; }
    public decimal EndLatitude { get; set; }
    public string? PlannedRoute { get; set; }
    public DateTime PlannedDepartureTime { get; set; }
}

public class TransportRecordUpdateDto
{
    public string VehiclePlateNo { get; set; } = string.Empty;
    public string DriverName { get; set; } = string.Empty;
    public string DriverLicenseNo { get; set; } = string.Empty;
    public string DriverPhone { get; set; } = string.Empty;
    public string EscortName { get; set; } = string.Empty;
    public DateTime? ActualDepartureTime { get; set; }
    public DateTime? ActualArrivalTime { get; set; }
    public int Status { get; set; }
}

public class TransportRecordQueryDto : PagedRequest
{
    public string? TransportNo { get; set; }
    public int? EnterpriseId { get; set; }
    public int? ChemicalBatchId { get; set; }
    public string? VehiclePlateNo { get; set; }
    public int? Status { get; set; }
    public bool? HasAnomaly { get; set; }
    public DateRangeFilter? DepartureDateRange { get; set; }
}

public class TransportTrajectoryDto
{
    public long Id { get; set; }
    public int TransportRecordId { get; set; }
    public string GpsDeviceId { get; set; } = string.Empty;
    public decimal Longitude { get; set; }
    public decimal Latitude { get; set; }
    public decimal Speed { get; set; }
    public decimal Direction { get; set; }
    public decimal Temperature { get; set; }
    public decimal Humidity { get; set; }
    public string? LocationName { get; set; }
    public bool IsDeviation { get; set; }
    public bool IsOverspeeding { get; set; }
    public bool IsTemperatureAbnormal { get; set; }
    public DateTime RecordTime { get; set; }
}

public class TransportTrajectoryCreateDto
{
    public int TransportRecordId { get; set; }
    public string GpsDeviceId { get; set; } = string.Empty;
    public decimal Longitude { get; set; }
    public decimal Latitude { get; set; }
    public decimal Speed { get; set; }
    public decimal Direction { get; set; }
    public decimal Temperature { get; set; }
    public decimal Humidity { get; set; }
    public string? LocationName { get; set; }
    public DateTime RecordTime { get; set; }
}

public class GpsDataUploadDto
{
    public string GpsDeviceId { get; set; } = string.Empty;
    public List<TransportTrajectoryCreateDto> Trajectories { get; set; } = new List<TransportTrajectoryCreateDto>();
}

public class TransportMonitoringDto
{
    public int TransportRecordId { get; set; }
    public string TransportNo { get; set; } = string.Empty;
    public string VehiclePlateNo { get; set; } = string.Empty;
    public string DriverName { get; set; } = string.Empty;
    public string ChemicalName { get; set; } = string.Empty;
    public int Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public decimal CurrentLongitude { get; set; }
    public decimal CurrentLatitude { get; set; }
    public decimal CurrentSpeed { get; set; }
    public decimal CurrentTemperature { get; set; }
    public bool HasDeviation { get; set; }
    public bool HasOverspeeding { get; set; }
    public bool HasTemperatureAbnormal { get; set; }
    public List<TransportTrajectoryDto> RecentTrajectories { get; set; } = new List<TransportTrajectoryDto>();
}

public class TransportRouteDto
{
    public int TransportRecordId { get; set; }
    public List<decimal[]> RoutePoints { get; set; } = new List<decimal[]>();
    public decimal? PlannedRoutePoints { get; set; }
}
