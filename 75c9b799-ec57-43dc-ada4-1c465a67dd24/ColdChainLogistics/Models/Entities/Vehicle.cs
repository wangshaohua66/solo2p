namespace ColdChainLogistics.Models.Entities;

public class Vehicle : BaseEntity
{
    public string VehicleNumber { get; set; } = string.Empty;
    public string? PlateNumber { get; set; }
    public string? Model { get; set; }
    public double Capacity { get; set; }
    public string? RouteCode { get; set; }
    public bool IsActive { get; set; } = true;
    public string? CurrentLocation { get; set; }

    public ICollection<Sensor> Sensors { get; set; } = new List<Sensor>();
    public ICollection<Shipment> Shipments { get; set; } = new List<Shipment>();
}
