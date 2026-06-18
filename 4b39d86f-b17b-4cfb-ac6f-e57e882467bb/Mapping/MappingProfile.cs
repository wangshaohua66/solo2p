using AutoMapper;
using HazChemSupervision.DTOs;
using HazChemSupervision.Models;

namespace HazChemSupervision.Mapping;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        CreateMap<Enterprise, EnterpriseDto>()
            .ForMember(d => d.TypeName, opt => opt.MapFrom(s => s.Type.ToString()))
            .ForMember(d => d.StatusName, opt => opt.MapFrom(s => s.Status.ToString()));
        CreateMap<EnterpriseCreateDto, Enterprise>();
        CreateMap<EnterpriseUpdateDto, Enterprise>();

        CreateMap<Chemical, ChemicalDto>()
            .ForMember(d => d.CategoryName, opt => opt.MapFrom(s => s.Category.ToString()))
            .ForMember(d => d.HazardClassName, opt => opt.MapFrom(s => s.HazardClass.ToString()));
        CreateMap<ChemicalCreateDto, Chemical>();
        CreateMap<ChemicalUpdateDto, Chemical>();

        CreateMap<Warehouse, WarehouseDto>()
            .ForMember(d => d.TypeName, opt => opt.MapFrom(s => s.Type.ToString()))
            .ForMember(d => d.StatusName, opt => opt.MapFrom(s => s.IsActive ? "正常" : "停用"))
            .ForMember(d => d.UsageRate, opt => opt.MapFrom(s => s.MaxCapacity > 0 ? (double)s.CurrentUsedCapacity / (double)s.MaxCapacity * 100 : 0));
        CreateMap<WarehouseCreateDto, Warehouse>();
        CreateMap<WarehouseUpdateDto, Warehouse>();

        CreateMap<ChemicalBatch, ChemicalBatchDto>()
            .ForMember(d => d.ChemicalName, opt => opt.MapFrom(s => s.Chemical.Name))
            .ForMember(d => d.EnterpriseName, opt => opt.MapFrom(s => s.Enterprise.Name))
            .ForMember(d => d.WarehouseName, opt => opt.MapFrom(s => s.Warehouse != null ? s.Warehouse.Name : null))
            .ForMember(d => d.StatusName, opt => opt.MapFrom(s => s.Status.ToString()))
            .ForMember(d => d.RawMaterialOperatorName, opt => opt.MapFrom<OperatorIdNameResolver<ChemicalBatch>, int?>(s => s.RawMaterialOperatorId))
            .ForMember(d => d.ProductionOperatorName, opt => opt.MapFrom<OperatorIdNameResolver<ChemicalBatch>, int?>(s => s.ProductionOperatorId))
            .ForMember(d => d.InspectorName, opt => opt.MapFrom<OperatorIdNameResolver<ChemicalBatch>, int?>(s => s.InspectorId))
            .ForMember(d => d.OutboundReviewerName, opt => opt.MapFrom<OperatorIdNameResolver<ChemicalBatch>, int?>(s => s.OutboundReviewerId));
        CreateMap<ChemicalBatchCreateDto, ChemicalBatch>();

        CreateMap<ProcessRecord, ProcessRecordDto>();

        CreateMap<Inventory, InventoryDto>()
            .ForMember(d => d.ChemicalName, opt => opt.MapFrom(s => s.Chemical.Name))
            .ForMember(d => d.ChemicalCode, opt => opt.MapFrom(s => s.Chemical.Code))
            .ForMember(d => d.ChemicalCategory, opt => opt.MapFrom(s => (int)s.Chemical.Category))
            .ForMember(d => d.ChemicalCategoryName, opt => opt.MapFrom(s => s.Chemical.Category.ToString()))
            .ForMember(d => d.EnterpriseName, opt => opt.MapFrom(s => s.Enterprise.Name))
            .ForMember(d => d.WarehouseName, opt => opt.MapFrom(s => s.Warehouse.Name))
            .ForMember(d => d.StatusName, opt => opt.MapFrom(s => s.Status.ToString()))
            .ForMember(d => d.UsageRate, opt => opt.MapFrom(s => s.MaxCapacity > 0 ? (double)s.Quantity / (double)s.MaxCapacity * 100 : 0));
        CreateMap<InventoryCreateDto, Inventory>();
        CreateMap<InventoryUpdateDto, Inventory>();

        CreateMap<InventoryTransaction, InventoryTransactionDto>()
            .ForMember(d => d.TransactionTypeName, opt => opt.MapFrom(s => s.TransactionType.ToString()))
            .ForMember(d => d.ChemicalName, opt => opt.MapFrom(s => s.Chemical.Name))
            .ForMember(d => d.EnterpriseName, opt => opt.MapFrom(s => s.Enterprise.Name))
            .ForMember(d => d.WarehouseName, opt => opt.MapFrom(s => s.Warehouse.Name))
            .ForMember(d => d.BatchNo, opt => opt.MapFrom(s => s.ChemicalBatch != null ? s.ChemicalBatch.BatchNo : null));
        CreateMap<InventoryTransactionCreateDto, InventoryTransaction>();

        CreateMap<TransportRecord, TransportRecordDto>()
            .ForMember(d => d.EnterpriseName, opt => opt.MapFrom(s => s.Enterprise.Name))
            .ForMember(d => d.BatchNo, opt => opt.MapFrom(s => s.ChemicalBatch.BatchNo))
            .ForMember(d => d.ChemicalName, opt => opt.MapFrom(s => s.ChemicalBatch.Chemical.Name))
            .ForMember(d => d.StatusName, opt => opt.MapFrom(s => s.Status.ToString()));
        CreateMap<TransportRecordCreateDto, TransportRecord>();
        CreateMap<TransportRecordUpdateDto, TransportRecord>();

        CreateMap<TransportTrajectory, TransportTrajectoryDto>();
        CreateMap<TransportTrajectoryCreateDto, TransportTrajectory>();

        CreateMap<HazardRectification, HazardRectificationDto>()
            .ForMember(d => d.EnterpriseName, opt => opt.MapFrom(s => s.Enterprise.Name))
            .ForMember(d => d.SourceName, opt => opt.MapFrom(s => s.Source.ToString()))
            .ForMember(d => d.LevelName, opt => opt.MapFrom(s => s.Level.ToString()))
            .ForMember(d => d.StatusName, opt => opt.MapFrom(s => s.Status.ToString()));
        CreateMap<HazardRectificationCreateDto, HazardRectification>();

        CreateMap<EmergencyDrill, EmergencyDrillDto>()
            .ForMember(d => d.EnterpriseName, opt => opt.MapFrom(s => s.Enterprise.Name))
            .ForMember(d => d.TypeName, opt => opt.MapFrom(s => s.Type.ToString()))
            .ForMember(d => d.StatusName, opt => opt.MapFrom(s => s.Status.ToString()))
            .ForMember(d => d.EvaluationResultName, opt => opt.MapFrom(s => s.EvaluationResult.HasValue ? s.EvaluationResult.Value.ToString() : null));
        CreateMap<EmergencyDrillCreateDto, EmergencyDrill>();

        CreateMap<Certificate, CertificateDto>()
            .ForMember(d => d.EnterpriseName, opt => opt.MapFrom(s => s.Enterprise != null ? s.Enterprise.Name : null))
            .ForMember(d => d.TypeName, opt => opt.MapFrom(s => s.Type.ToString()))
            .ForMember(d => d.StatusName, opt => opt.MapFrom(s => s.Status.ToString()));
        CreateMap<CertificateCreateDto, Certificate>();

        CreateMap<Alert, AlertDto>()
            .ForMember(d => d.TypeName, opt => opt.MapFrom(s => s.Type.ToString()))
            .ForMember(d => d.LevelName, opt => opt.MapFrom(s => s.Level.ToString()))
            .ForMember(d => d.StatusName, opt => opt.MapFrom(s => s.Status.ToString()))
            .ForMember(d => d.EnterpriseName, opt => opt.MapFrom(s => s.Enterprise != null ? s.Enterprise.Name : null))
            .ForMember(d => d.ChemicalName, opt => opt.MapFrom(s => s.Chemical != null ? s.Chemical.Name : null))
            .ForMember(d => d.WarehouseName, opt => opt.MapFrom(s => s.Warehouse != null ? s.Warehouse.Name : null))
            .ForMember(d => d.BatchNo, opt => opt.MapFrom(s => s.ChemicalBatch != null ? s.ChemicalBatch.BatchNo : null))
            .ForMember(d => d.TransportNo, opt => opt.MapFrom(s => s.TransportRecord != null ? s.TransportRecord.TransportNo : null))
            .ForMember(d => d.WorkOrderNo, opt => opt.MapFrom(s => s.HazardRectification != null ? s.HazardRectification.WorkOrderNo : null));
        CreateMap<AlertCreateDto, Alert>();

        CreateMap<User, UserInfoDto>()
            .ForMember(d => d.RoleName, opt => opt.MapFrom(s => s.Role.ToString()))
            .ForMember(d => d.EnterpriseName, opt => opt.MapFrom(s => s.Enterprise != null ? s.Enterprise.Name : null));
    }
}
