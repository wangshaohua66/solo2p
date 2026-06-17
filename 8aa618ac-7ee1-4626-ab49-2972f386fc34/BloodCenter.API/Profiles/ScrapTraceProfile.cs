using AutoMapper;
using BloodCenter.Core.Interfaces;
using BloodCenter.Infrastructure.Entities;

namespace BloodCenter.API.Profiles;

public class ScrapTraceProfile : Profile
{
    public ScrapTraceProfile()
    {
        CreateMap<CreateScrapRecordDto, ScrapRecord>()
            .ForMember(sr => sr.Id, opt => opt.Ignore())
            .ForMember(sr => sr.CreatedAt, opt => opt.Ignore())
            .ForMember(sr => sr.UpdatedAt, opt => opt.Ignore())
            .ForMember(sr => sr.IsDeleted, opt => opt.Ignore())
            .ForMember(sr => sr.BloodProduct, opt => opt.Ignore())
            .ForMember(sr => sr.Operator, opt => opt.Ignore())
            .ForMember(sr => sr.ApprovedBy, opt => opt.Ignore())
            .ForMember(sr => sr.ApprovedById, opt => opt.Ignore())
            .ForMember(sr => sr.ApprovedAt, opt => opt.Ignore());

        CreateMap<ScrapRecord, ScrapRecordDto>()
            .ForMember(d => d.ProductCode, opt => opt.MapFrom(s => s.BloodProduct != null ? s.BloodProduct.ProductCode : string.Empty))
            .ForMember(d => d.OperatorName, opt => opt.MapFrom(s => s.Operator != null ? s.Operator.FullName : string.Empty))
            .ForMember(d => d.ApprovedByName, opt => opt.MapFrom(s => s.ApprovedBy != null ? s.ApprovedBy.FullName : null))
            .ForMember(d => d.IsApproved, opt => opt.MapFrom(s => s.ApprovedById != null));
    }
}
