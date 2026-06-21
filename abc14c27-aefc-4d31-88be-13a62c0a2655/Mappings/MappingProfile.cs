using AutoMapper;
using UsedVehicleTransaction.DTOs;
using UsedVehicleTransaction.Enums;
using UsedVehicleTransaction.Models;

namespace UsedVehicleTransaction.Mappings;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        CreateVehicleMaps();
        CreateComplianceMaps();
        CreateInspectionMaps();
        CreateTransactionMaps();
        CreateWorkflowMaps();
        CreateArchiveMaps();
        CreateExceptionCaseMaps();
    }

    private void CreateVehicleMaps()
    {
        CreateMap<VehicleCreateDto, Vehicle>()
            .ForMember(dest => dest.Status, opt => opt.Ignore())
            .ForMember(dest => dest.Id, opt => opt.Ignore());

        CreateMap<VehicleUpdateDto, Vehicle>()
            .ForAllMembers(opts => opts.Condition((src, dest, srcMember) => srcMember != null));

        CreateMap<Vehicle, VehicleDto>();
        CreateMap<Vehicle, VehicleDetailDto>()
            .ForMember(dest => dest.ComplianceRecords, opt => opt.MapFrom(src => src.ComplianceCheckRecords))
            .ForMember(dest => dest.InspectionOrders, opt => opt.MapFrom(src => src.InspectionOrders));
    }

    private void CreateComplianceMaps()
    {
        CreateMap<ComplianceCheckItem, ComplianceCheckItemResultDto>();

        CreateMap<ComplianceCheckRecord, ComplianceCheckRecordDto>()
            .ForMember(dest => dest.Items, opt => opt.MapFrom(src => src.CheckItems));

        CreateMap<ComplianceCheckRecord, ComplianceCheckResultDto>()
            .ForMember(dest => dest.RecordId, opt => opt.MapFrom(src => src.Id))
            .ForMember(dest => dest.Items, opt => opt.MapFrom(src => src.CheckItems))
            .ForMember(dest => dest.FailureReasons, opt => opt.MapFrom(src =>
                string.IsNullOrEmpty(src.FailureReasons)
                    ? new List<string>()
                    : src.FailureReasons.Split(';', StringSplitOptions.RemoveEmptyEntries).ToList()));
    }

    private void CreateInspectionMaps()
    {
        CreateMap<InspectionOrderCreateDto, InspectionOrder>()
            .ForMember(dest => dest.Status, opt => opt.MapFrom(src => InspectionStatus.Created));

        CreateMap<InspectionOrder, InspectionOrderDto>();
        CreateMap<InspectionOrder, InspectionOrderDetailDto>()
            .ForMember(dest => dest.Vehicle, opt => opt.MapFrom(src => src.Vehicle))
            .ForMember(dest => dest.ItemResults, opt => opt.MapFrom(src => src.ItemResults))
            .ForMember(dest => dest.Photos, opt => opt.MapFrom(src => src.Photos));

        CreateMap<InspectionItemResult, InspectionItemResultDto>()
            .ForMember(dest => dest.ItemCode, opt => opt.MapFrom(src => src.InspectionItem != null ? src.InspectionItem.ItemCode : null))
            .ForMember(dest => dest.ItemName, opt => opt.MapFrom(src => src.InspectionItem != null ? src.InspectionItem.ItemName : null))
            .ForMember(dest => dest.ItemNameEn, opt => opt.MapFrom(src => src.InspectionItem != null ? src.InspectionItem.ItemNameEn : null))
            .ForMember(dest => dest.MaxScore, opt => opt.MapFrom(src => src.InspectionItem != null ? src.InspectionItem.MaxScore : 10))
            .ForMember(dest => dest.Weight, opt => opt.MapFrom(src => src.InspectionItem != null ? src.InspectionItem.Weight : 0));

        CreateMap<InspectionPhoto, InspectionPhotoDto>();
        CreateMap<InspectionItemLibrary, InspectionItemLibraryDto>();
    }

    private void CreateTransactionMaps()
    {
        CreateMap<TransactionCreateDto, VehicleTransaction>()
            .ForMember(dest => dest.Status, opt => opt.MapFrom(src => TransactionStatus.Created));

        CreateMap<TransactionUpdateDto, VehicleTransaction>()
            .ForAllMembers(opts => opts.Condition((src, dest, srcMember) => srcMember != null));

        CreateMap<VehicleTransaction, TransactionDto>()
            .ForMember(dest => dest.Vin, opt => opt.MapFrom(src => src.Vehicle != null ? src.Vehicle.Vin : null))
            .ForMember(dest => dest.PlateNumber, opt => opt.MapFrom(src => src.Vehicle != null ? src.Vehicle.PlateNumber : null))
            .ForMember(dest => dest.Brand, opt => opt.MapFrom(src => src.Vehicle != null ? src.Vehicle.Brand : null))
            .ForMember(dest => dest.Model, opt => opt.MapFrom(src => src.Vehicle != null ? src.Vehicle.Model : null));

        CreateMap<VehicleTransaction, TransactionDetailDto>()
            .ForMember(dest => dest.Vin, opt => opt.MapFrom(src => src.Vehicle != null ? src.Vehicle.Vin : null))
            .ForMember(dest => dest.PlateNumber, opt => opt.MapFrom(src => src.Vehicle != null ? src.Vehicle.PlateNumber : null))
            .ForMember(dest => dest.Brand, opt => opt.MapFrom(src => src.Vehicle != null ? src.Vehicle.Brand : null))
            .ForMember(dest => dest.Model, opt => opt.MapFrom(src => src.Vehicle != null ? src.Vehicle.Model : null))
            .ForMember(dest => dest.Vehicle, opt => opt.MapFrom(src => src.Vehicle))
            .ForMember(dest => dest.InspectionOrder, opt => opt.MapFrom(src => src.InspectionOrder))
            .ForMember(dest => dest.WorkflowInstances, opt => opt.MapFrom(src => src.WorkflowInstances))
            .ForMember(dest => dest.Archives, opt => opt.MapFrom(src => src.Archives));
    }

    private void CreateWorkflowMaps()
    {
        CreateMap<WorkflowInstance, WorkflowInstanceDto>()
            .ForMember(dest => dest.NodeExecutions, opt => opt.MapFrom(src => src.NodeExecutions));
        CreateMap<WorkflowNodeExecution, WorkflowNodeExecutionDto>();
    }

    private void CreateArchiveMaps()
    {
        CreateMap<ArchiveFile, ArchiveFileDto>()
            .ForMember(dest => dest.TransactionNo, opt => opt.MapFrom(src => src.Transaction != null ? src.Transaction.TransactionNo : null))
            .ForMember(dest => dest.Vin, opt => opt.MapFrom(src => src.Vehicle != null ? src.Vehicle.Vin : null));
    }

    private void CreateExceptionCaseMaps()
    {
        CreateMap<ExceptionCaseCreateDto, ExceptionCase>()
            .ForMember(dest => dest.Status, opt => opt.MapFrom(src => ExceptionCaseStatus.Created))
            .ForMember(dest => dest.CaseTypeName, opt => opt.MapFrom(src => GetCaseTypeName(src.CaseType)));

        CreateMap<ExceptionCase, ExceptionCaseDto>()
            .ForMember(dest => dest.Vin, opt => opt.MapFrom(src => src.Vehicle != null ? src.Vehicle.Vin : null))
            .ForMember(dest => dest.TransactionNo, opt => opt.MapFrom(src => src.Transaction != null ? src.Transaction.TransactionNo : null));

        CreateMap<ExceptionCase, ExceptionCaseDetailDto>()
            .ForMember(dest => dest.Vin, opt => opt.MapFrom(src => src.Vehicle != null ? src.Vehicle.Vin : null))
            .ForMember(dest => dest.TransactionNo, opt => opt.MapFrom(src => src.Transaction != null ? src.Transaction.TransactionNo : null))
            .ForMember(dest => dest.ProcessingLogs, opt => opt.MapFrom(src => src.ProcessingLogs));

        CreateMap<ExceptionCaseLog, ExceptionCaseLogDto>();
    }

    private static string GetCaseTypeName(ExceptionCaseType caseType)
    {
        return caseType switch
        {
            ExceptionCaseType.MortgageRelease => "抵押解除异常",
            ExceptionCaseType.SeizurePending => "查封待解",
            ExceptionCaseType.EnvironmentalExceed => "环保超标待整改",
            ExceptionCaseType.EngineMismatch => "发动机号不匹配",
            ExceptionCaseType.FrameMismatch => "车架号不匹配",
            ExceptionCaseType.AccidentUnresolved => "事故未处理",
            ExceptionCaseType.MissingDocument => "材料缺失",
            ExceptionCaseType.IdentityVerification => "身份核验异常",
            ExceptionCaseType.TaxArrears => "税费欠缴",
            _ => "其他异常"
        };
    }
}
