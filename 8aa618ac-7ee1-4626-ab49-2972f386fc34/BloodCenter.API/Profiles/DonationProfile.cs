using AutoMapper;
using BloodCenter.Core.Interfaces;
using BloodCenter.Infrastructure.Entities;
using BloodCenter.Infrastructure.Entities.ValueObjects;

namespace BloodCenter.API.Profiles;

public class DonationProfile : Profile
{
    public DonationProfile()
    {
        CreateMap<CreateDonationDto, Donation>()
            .ForMember(d => d.Id, opt => opt.Ignore())
            .ForMember(d => d.DonationNumber, opt => opt.Ignore())
            .ForMember(d => d.Status, opt => opt.Ignore())
            .ForMember(d => d.BloodGroup, opt => opt.MapFrom(s => new BloodGroup { ABO = s.BloodType, Rh = s.RhFactor }))
            .ForMember(d => d.CreatedAt, opt => opt.Ignore())
            .ForMember(d => d.UpdatedAt, opt => opt.Ignore())
            .ForMember(d => d.IsDeleted, opt => opt.Ignore())
            .ForMember(d => d.Donor, opt => opt.Ignore())
            .ForMember(d => d.CollectionSite, opt => opt.Ignore())
            .ForMember(d => d.Nurse, opt => opt.Ignore())
            .ForMember(d => d.InitialScreenings, opt => opt.Ignore())
            .ForMember(d => d.BloodTests, opt => opt.Ignore())
            .ForMember(d => d.BloodProducts, opt => opt.Ignore())
            .ForMember(d => d.InitialScreeningPassed, opt => opt.Ignore())
            .ForMember(d => d.InitialScreeningFailureReason, opt => opt.Ignore())
            .ForMember(d => d.AllTestsPassed, opt => opt.Ignore())
            .ForMember(d => d.IsQuarantined, opt => opt.Ignore())
            .ForMember(d => d.QuarantineReason, opt => opt.Ignore());

        CreateMap<Donation, DonationDto>()
            .ForMember(d => d.DonorName, opt => opt.MapFrom(s => s.Donor != null ? $"{s.Donor.FirstName} {s.Donor.LastName}" : string.Empty))
            .ForMember(d => d.DonorNumber, opt => opt.MapFrom(s => s.Donor != null ? s.Donor.DonorNumber : string.Empty))
            .ForMember(d => d.CollectionSiteName, opt => opt.MapFrom(s => s.CollectionSite != null ? s.CollectionSite.Name : string.Empty))
            .ForMember(d => d.NurseName, opt => opt.MapFrom(s => s.Nurse != null ? s.Nurse.FullName : string.Empty))
            .ForMember(d => d.BloodGroupDisplay, opt => opt.MapFrom(s => s.BloodGroup.ToString()));

        CreateMap<CreateInitialScreeningDto, InitialScreening>()
            .ForMember(s => s.Id, opt => opt.Ignore())
            .ForMember(s => s.DonationId, opt => opt.Ignore())
            .ForMember(s => s.Passed, opt => opt.Ignore())
            .ForMember(s => s.FailureReason, opt => opt.Ignore())
            .ForMember(s => s.CreatedAt, opt => opt.Ignore())
            .ForMember(s => s.UpdatedAt, opt => opt.Ignore())
            .ForMember(s => s.IsDeleted, opt => opt.Ignore())
            .ForMember(s => s.Donation, opt => opt.Ignore())
            .ForMember(s => s.Technician, opt => opt.Ignore());

        CreateMap<InitialScreening, InitialScreeningDto>()
            .ForMember(d => d.DonationNumber, opt => opt.MapFrom(s => s.Donation != null ? s.Donation.DonationNumber : string.Empty))
            .ForMember(d => d.TechnicianName, opt => opt.MapFrom(s => s.Technician != null ? s.Technician.FullName : string.Empty));
    }
}
