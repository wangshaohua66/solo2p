using AutoMapper;
using BloodCenter.Core.Interfaces;
using BloodCenter.Core.Entities;

namespace BloodCenter.API.Profiles;

public class BloodProductProfile : Profile
{
    public BloodProductProfile()
    {
        CreateMap<BloodProduct, BloodProductDto>()
            .ForMember(d => d.DonationNumber, opt => opt.MapFrom(s => s.Donation != null ? s.Donation.DonationNumber : string.Empty))
            .ForMember(d => d.BloodGroupDisplay, opt => opt.MapFrom(s => s.BloodGroup.ToString()))
            .ForMember(d => d.BloodType, opt => opt.MapFrom(s => s.BloodGroup.ABO))
            .ForMember(d => d.RhFactor, opt => opt.MapFrom(s => s.BloodGroup.Rh))
            .ForMember(d => d.PreparedByName, opt => opt.MapFrom(s => s.PreparedBy != null ? s.PreparedBy.FullName : null))
            .ForMember(d => d.DaysUntilExpiry, opt => opt.MapFrom(s => (int)(s.ExpiryDate - DateTime.UtcNow).TotalDays))
            .ForMember(d => d.IsExpiringSoon, opt => opt.MapFrom(s => s.ExpiryDate <= DateTime.UtcNow.AddHours(24) && s.ExpiryDate > DateTime.UtcNow));
    }
}
