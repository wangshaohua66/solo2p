using AutoMapper;
using SmartParking.API.Models.Entities;
using SmartParking.API.Models.DTOs;
using SmartParking.API.Common;

namespace SmartParking.API.Mappings;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        CreateMap<User, UserDto>();

        CreateMap<ParkingLot, ParkingLotDto>()
            .ForMember(d => d.AvailableSpots, opt =>
                opt.MapFrom(s => s.Floors.Sum(f => f.Spots.Count(sp => sp.Status == ParkingSpotStatus.Available))));

        CreateMap<ParkingFloor, ParkingFloorDto>()
            .ForMember(d => d.AvailableSpots, opt =>
                opt.MapFrom(s => s.Spots.Count(sp => sp.Status == ParkingSpotStatus.Available)));

        CreateMap<ParkingSpot, ParkingSpotDto>().ReverseMap();
        CreateMap<ParkingRecord, ParkingRecordDto>();

        CreateMap<ChargingStation, ChargingStationDto>().ReverseMap();
        CreateMap<ChargingReservation, ChargingReservationDto>();
        CreateMap<ChargingSession, ChargingSessionDto>();

        CreateMap<BillingRule, BillingRuleDto>().ReverseMap();
        CreateMap<TimeSlotRate, TimeSlotRateDto>().ReverseMap();
        CreateMap<MemberDiscount, MemberDiscountDto>().ReverseMap();
        CreateMap<ChargingTier, ChargingTierDto>().ReverseMap();

        CreateMap<PaymentOrder, PaymentOrderDto>();

        CreateMap<WorkOrder, WorkOrderDto>()
            .ForMember(d => d.Photos, opt =>
                opt.MapFrom(s => string.IsNullOrWhiteSpace(s.PhotosJson)
                    ? new List<string>()
                    : Newtonsoft.Json.JsonConvert.DeserializeObject<List<string>>(s.PhotosJson) ?? new List<string>()));

        CreateMap<CreateWorkOrderRequest, WorkOrder>()
            .ForMember(d => d.PhotosJson, opt =>
                opt.MapFrom(s => Newtonsoft.Json.JsonConvert.SerializeObject(s.Photos)));
    }
}
