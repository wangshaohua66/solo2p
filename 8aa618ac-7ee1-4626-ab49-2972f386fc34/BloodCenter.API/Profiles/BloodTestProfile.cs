using AutoMapper;
using BloodCenter.Core.Interfaces;
using BloodCenter.Core.Entities;

namespace BloodCenter.API.Profiles;

public class BloodTestProfile : Profile
{
    public BloodTestProfile()
    {
        CreateMap<CreateBloodTestDto, BloodTest>()
            .ForMember(bt => bt.Id, opt => opt.Ignore())
            .ForMember(bt => bt.CreatedAt, opt => opt.Ignore())
            .ForMember(bt => bt.UpdatedAt, opt => opt.Ignore())
            .ForMember(bt => bt.IsDeleted, opt => opt.Ignore())
            .ForMember(bt => bt.Donation, opt => opt.Ignore())
            .ForMember(bt => bt.Technician, opt => opt.Ignore())
            .ForMember(bt => bt.SecondReviewer, opt => opt.Ignore())
            .ForMember(bt => bt.SecondReviewerId, opt => opt.Ignore())
            .ForMember(bt => bt.ReviewTime, opt => opt.Ignore())
            .ForMember(bt => bt.IsReReviewed, opt => opt.Ignore())
            .ForMember(bt => bt.ReviewComment, opt => opt.Ignore());

        CreateMap<BloodTest, BloodTestDto>()
            .ForMember(d => d.DonationNumber, opt => opt.MapFrom(s => s.Donation != null ? s.Donation.DonationNumber : string.Empty))
            .ForMember(d => d.TechnicianName, opt => opt.MapFrom(s => s.Technician != null ? s.Technician.FullName : string.Empty))
            .ForMember(d => d.SecondReviewerName, opt => opt.MapFrom(s => s.SecondReviewer != null ? s.SecondReviewer.FullName : null));
    }
}
