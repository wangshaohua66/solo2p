using AutoMapper;
using BloodCenter.Core.Interfaces;
using BloodCenter.Core.Entities;
using BloodCenter.Core.Entities.ValueObjects;

namespace BloodCenter.API.Profiles;

public class CrossMatchProfile : Profile
{
    public CrossMatchProfile()
    {
        CreateMap<CreateBloodRequestDto, BloodRequest>()
            .ForMember(br => br.Id, opt => opt.Ignore())
            .ForMember(br => br.RequestNumber, opt => opt.Ignore())
            .ForMember(br => br.PatientBloodGroup, opt => opt.MapFrom(s => new BloodGroup { ABO = s.PatientBloodType, Rh = s.PatientRhFactor }))
            .ForMember(br => br.QuantityIssued, opt => opt.Ignore())
            .ForMember(br => br.Status, opt => opt.Ignore())
            .ForMember(br => br.FulfilledAt, opt => opt.Ignore())
            .ForMember(br => br.CreatedAt, opt => opt.Ignore())
            .ForMember(br => br.UpdatedAt, opt => opt.Ignore())
            .ForMember(br => br.IsDeleted, opt => opt.Ignore())
            .ForMember(br => br.Hospital, opt => opt.Ignore())
            .ForMember(br => br.CrossMatches, opt => opt.Ignore());

        CreateMap<BloodRequest, BloodRequestDto>()
            .ForMember(d => d.HospitalName, opt => opt.MapFrom(s => s.Hospital != null ? s.Hospital.Name : string.Empty))
            .ForMember(d => d.PatientBloodGroupDisplay, opt => opt.MapFrom(s => s.PatientBloodGroup.ToString()))
            .ForMember(d => d.CrossMatches, opt => opt.MapFrom(s => s.CrossMatches));

        CreateMap<CrossMatch, CrossMatchResultDto>()
            .ForMember(d => d.ProductCode, opt => opt.MapFrom(s => s.BloodProduct != null ? s.BloodProduct.ProductCode : string.Empty))
            .ForMember(d => d.TechnicianName, opt => opt.MapFrom(s => s.Technician != null ? s.Technician.FullName : string.Empty));

        CreateMap<RecordCrossMatchDto, CrossMatch>()
            .ForMember(cm => cm.Id, opt => opt.Ignore())
            .ForMember(cm => cm.OverallResult, opt => opt.Ignore())
            .ForMember(cm => cm.IsReserved, opt => opt.Ignore())
            .ForMember(cm => cm.ReservedUntil, opt => opt.Ignore())
            .ForMember(cm => cm.CreatedAt, opt => opt.Ignore())
            .ForMember(cm => cm.UpdatedAt, opt => opt.Ignore())
            .ForMember(cm => cm.IsDeleted, opt => opt.Ignore())
            .ForMember(cm => cm.BloodRequest, opt => opt.Ignore())
            .ForMember(cm => cm.BloodProduct, opt => opt.Ignore())
            .ForMember(cm => cm.Technician, opt => opt.Ignore())
            .ForMember(cm => cm.Phases, opt => opt.Ignore())
            .ForMember(cm => cm.AntiHumanGlobulin, opt => opt.Ignore())
            .ForMember(cm => cm.Temperature, opt => opt.Ignore())
            .ForMember(cm => cm.IncubationTime, opt => opt.Ignore());
    }
}
