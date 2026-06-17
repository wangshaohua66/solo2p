using AutoMapper;
using BloodCenter.Core.Interfaces;
using BloodCenter.Core.Entities;
using BloodCenter.Core.Entities.ValueObjects;

namespace BloodCenter.API.Profiles;

public class DonorProfile : Profile
{
    public DonorProfile()
    {
        CreateMap<CreateDonorDto, Donor>()
            .ForMember(d => d.Address, opt => opt.MapFrom(s => s.Address != null ? new Address
            {
                Street = s.Address.Street,
                City = s.Address.City,
                Province = s.Address.Province,
                PostalCode = s.Address.PostalCode
            } : null))
            .ForMember(d => d.Id, opt => opt.Ignore())
            .ForMember(d => d.DonorNumber, opt => opt.Ignore())
            .ForMember(d => d.Status, opt => opt.Ignore())
            .ForMember(d => d.CreatedAt, opt => opt.Ignore())
            .ForMember(d => d.UpdatedAt, opt => opt.Ignore())
            .ForMember(d => d.IsDeleted, opt => opt.Ignore())
            .ForMember(d => d.Donations, opt => opt.Ignore())
            .ForMember(d => d.MedicalHistory, opt => opt.Ignore())
            .ForMember(d => d.BloodGroup, opt => opt.Ignore())
            .ForMember(d => d.DeferralReason, opt => opt.Ignore())
            .ForMember(d => d.DeferralUntil, opt => opt.Ignore())
            .ForMember(d => d.LastDonationDate, opt => opt.Ignore())
            .ForMember(d => d.NextEligibleDate, opt => opt.Ignore())
            .ForMember(d => d.TotalDonations, opt => opt.Ignore())
            .ForMember(d => d.TotalVolumeDonated, opt => opt.Ignore());

        CreateMap<UpdateDonorDto, Donor>()
            .ForMember(d => d.Address, opt => opt.MapFrom(s => s.Address != null ? new Address
            {
                Street = s.Address.Street,
                City = s.Address.City,
                Province = s.Address.Province,
                PostalCode = s.Address.PostalCode
            } : null))
            .ForAllMembers(opt => opt.Condition((s, d, sm) => sm != null));

        CreateMap<Donor, DonorDto>()
            .ForMember(d => d.BloodGroupDisplay, opt => opt.MapFrom(s => s.BloodGroup != null ? s.BloodGroup.ToString() : "Unknown"))
            .ForMember(d => d.BloodType, opt => opt.MapFrom(s => s.BloodGroup != null ? (Infrastructure.Entities.Enums.BloodType?)s.BloodGroup.ABO : null))
            .ForMember(d => d.RhFactor, opt => opt.MapFrom(s => s.BloodGroup != null ? (Infrastructure.Entities.Enums.RhFactor?)s.BloodGroup.Rh : null))
            .ForMember(d => d.Address, opt => opt.MapFrom(s => s.Address != null ? new AddressDto(s.Address.Street, s.Address.City, s.Address.Province, s.Address.PostalCode) : null));

        CreateMap<AddressDto, Address>()
            .ConstructUsing(s => new Address { Street = s.Street, City = s.City, Province = s.Province, PostalCode = s.PostalCode });

        CreateMap<MedicalHistoryDto, DonorMedicalHistory>()
            .ForMember(mh => mh.Id, opt => opt.Ignore())
            .ForMember(mh => mh.DonorId, opt => opt.Ignore())
            .ForMember(mh => mh.CreatedAt, opt => opt.Ignore())
            .ForMember(mh => mh.UpdatedAt, opt => opt.Ignore())
            .ForMember(mh => mh.IsDeleted, opt => opt.Ignore())
            .ForMember(mh => mh.Donor, opt => opt.Ignore())
            .ForMember(mh => mh.EligibilityResult, opt => opt.Ignore())
            .ForMember(mh => mh.DeferralReason, opt => opt.Ignore())
            .ForMember(mh => mh.DeferralDays, opt => opt.Ignore());

        CreateMap<Donation, DonationRecordDto>()
            .ForMember(d => d.BloodGroupDisplay, opt => opt.MapFrom(s => s.BloodGroup.ToString()))
            .ForMember(d => d.CollectionSiteName, opt => opt.MapFrom(s => s.CollectionSite != null ? s.CollectionSite.Name : string.Empty))
            .ForMember(d => d.NurseName, opt => opt.MapFrom(s => s.Nurse != null ? s.Nurse.FullName : string.Empty));
    }
}
