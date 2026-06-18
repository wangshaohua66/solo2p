using AutoMapper;
using HazChemSupervision.DTOs;
using HazChemSupervision.Models;
using HazChemSupervision.Repositories;
using Microsoft.EntityFrameworkCore;

namespace HazChemSupervision.Services;

public class ChemicalBatchService : IChemicalBatchService
{
    private readonly IBaseRepository<ChemicalBatch> _batchRepo;
    private readonly IBaseRepository<ProcessRecord> _processRecordRepo;
    private readonly IBaseRepository<Chemical> _chemicalRepo;
    private readonly IBaseRepository<Enterprise> _enterpriseRepo;
    private readonly IBaseRepository<Warehouse> _warehouseRepo;
    private readonly IBaseRepository<User> _userRepo;
    private readonly IComplianceService _complianceService;
    private readonly IInventoryService _inventoryService;
    private readonly IMapper _mapper;

    public ChemicalBatchService(
        IBaseRepository<ChemicalBatch> batchRepo,
        IBaseRepository<ProcessRecord> processRecordRepo,
        IBaseRepository<Chemical> chemicalRepo,
        IBaseRepository<Enterprise> enterpriseRepo,
        IBaseRepository<Warehouse> warehouseRepo,
        IBaseRepository<User> userRepo,
        IComplianceService complianceService,
        IInventoryService inventoryService,
        IMapper mapper)
    {
        _batchRepo = batchRepo;
        _processRecordRepo = processRecordRepo;
        _chemicalRepo = chemicalRepo;
        _enterpriseRepo = enterpriseRepo;
        _warehouseRepo = warehouseRepo;
        _userRepo = userRepo;
        _complianceService = complianceService;
        _inventoryService = inventoryService;
        _mapper = mapper;
    }

    public async Task<ChemicalBatchDto?> GetBatchByIdAsync(int id)
    {
        var batch = await _batchRepo.GetQueryable()
            .Include(b => b.Chemical)
            .Include(b => b.Enterprise)
            .Include(b => b.Warehouse)
            .Include(b => b.ProcessRecords)
            .FirstOrDefaultAsync(b => b.Id == id);

        return batch != null ? _mapper.Map<ChemicalBatchDto>(batch) : null;
    }

    public async Task<PagedResult<ChemicalBatchDto>> GetBatchesAsync(ChemicalBatchQueryDto dto)
    {
        var predicate = PredicateBuilder.True<ChemicalBatch>();

        if (!string.IsNullOrEmpty(dto.BatchNo))
            predicate = predicate.And(b => b.BatchNo.Contains(dto.BatchNo));

        if (dto.ChemicalId.HasValue)
            predicate = predicate.And(b => b.ChemicalId == dto.ChemicalId.Value);

        if (dto.EnterpriseId.HasValue)
            predicate = predicate.And(b => b.EnterpriseId == dto.EnterpriseId.Value);

        if (dto.WarehouseId.HasValue)
            predicate = predicate.And(b => b.WarehouseId == dto.WarehouseId.Value);

        if (dto.Status.HasValue)
            predicate = predicate.And(b => b.Status == (BatchStatus)dto.Status.Value);

        if (dto.ProductionDateRange?.StartDate.HasValue == true)
            predicate = predicate.And(b => b.ProductionDate >= dto.ProductionDateRange.StartDate.Value);

        if (dto.ProductionDateRange?.EndDate.HasValue == true)
            predicate = predicate.And(b => b.ProductionDate < dto.ProductionDateRange.EndDate.Value.AddDays(1));

        if (dto.ExpiryDateRange?.StartDate.HasValue == true)
            predicate = predicate.And(b => b.ExpiryDate >= dto.ExpiryDateRange.StartDate.Value);

        if (dto.ExpiryDateRange?.EndDate.HasValue == true)
            predicate = predicate.And(b => b.ExpiryDate < dto.ExpiryDateRange.EndDate.Value.AddDays(1));

        var result = await _batchRepo.GetPagedAsync(
            predicate,
            q => q.OrderByDescending(b => b.UpdatedAt),
            dto.PageIndex,
            dto.PageSize);

        var items = await _batchRepo.GetQueryable()
            .Include(b => b.Chemical)
            .Include(b => b.Enterprise)
            .Include(b => b.Warehouse)
            .Where(predicate)
            .OrderByDescending(b => b.UpdatedAt)
            .Skip((dto.PageIndex - 1) * dto.PageSize)
            .Take(dto.PageSize)
            .ToListAsync();

        return new PagedResult<ChemicalBatchDto>
        {
            Items = _mapper.Map<List<ChemicalBatchDto>>(items),
            TotalCount = result.TotalCount,
            PageIndex = dto.PageIndex,
            PageSize = dto.PageSize
        };
    }

    public async Task<ChemicalBatchDto> CreateBatchAsync(ChemicalBatchCreateDto dto)
    {
        var exists = await _batchRepo.ExistsAsync(b => b.BatchNo == dto.BatchNo);
        if (exists)
            throw new InvalidOperationException($"批次号已存在: {dto.BatchNo}");

        var chemical = await _chemicalRepo.GetByIdAsync(dto.ChemicalId) ??
            throw new KeyNotFoundException($"危化品不存在: {dto.ChemicalId}");

        var enterprise = await _enterpriseRepo.GetByIdAsync(dto.EnterpriseId) ??
            throw new KeyNotFoundException($"企业不存在: {dto.EnterpriseId}");

        if (dto.WarehouseId.HasValue)
        {
            var warehouse = await _warehouseRepo.GetByIdAsync(dto.WarehouseId.Value) ??
                throw new KeyNotFoundException($"仓库不存在: {dto.WarehouseId.Value}");
            if (warehouse.EnterpriseId != dto.EnterpriseId)
                throw new InvalidOperationException("仓库不属于该企业");
        }

        if (dto.ExpiryDate <= dto.ProductionDate)
            throw new InvalidOperationException("有效期必须晚于生产日期");

        var batch = _mapper.Map<ChemicalBatch>(dto);
        batch.Status = BatchStatus.RawMaterial;
        batch.CreatedAt = DateTime.UtcNow;
        batch.UpdatedAt = DateTime.UtcNow;

        var result = await _batchRepo.AddAsync(batch);

        var processRecord = new ProcessRecord
        {
            ChemicalBatchId = result.Id,
            Stage = ProcessStage.BatchCreated,
            StageName = "批次创建",
            OperatorId = 0,
            OperatorName = "System",
            Status = ProcessStatus.Completed,
            StatusName = "已完成",
            StartTime = DateTime.UtcNow,
            EndTime = DateTime.UtcNow,
            Remark = "系统自动创建批次记录",
            CreatedAt = DateTime.UtcNow
        };
        await _processRecordRepo.AddAsync(processRecord);

        return _mapper.Map<ChemicalBatchDto>(result);
    }

    public async Task<ChemicalBatchDto> RawMaterialInboundAsync(int batchId, RawMaterialInboundDto dto)
    {
        var batch = await _batchRepo.GetByIdAsync(batchId) ??
            throw new KeyNotFoundException($"批次不存在: {batchId}");

        if (!await ValidateBatchStatusTransitionAsync(batchId, BatchStatus.RawMaterial))
            throw new InvalidOperationException("批次状态不允许执行原料入库操作");

        var certValid = await _complianceService.ValidateOperatorCertificateAsync(
            dto.OperatorId, "SpecialOperationCertificate", dto.CertificateNo);
        if (!certValid)
            throw new InvalidOperationException("操作人员资质证书无效或已过期");

        var warehouse = await _warehouseRepo.GetByIdAsync(dto.WarehouseId) ??
            throw new KeyNotFoundException($"仓库不存在: {dto.WarehouseId}");

        var user = await _userRepo.GetByIdAsync(dto.OperatorId);

        batch.RawMaterialInboundTime = DateTime.UtcNow;
        batch.RawMaterialOperatorId = dto.OperatorId;
        batch.RawMaterialRemark = dto.Remark;
        batch.WarehouseId = dto.WarehouseId;
        batch.Status = BatchStatus.InProduction;
        batch.UpdatedAt = DateTime.UtcNow;

        await _batchRepo.UpdateAsync(batch);

        var processRecord = new ProcessRecord
        {
            ChemicalBatchId = batchId,
            Stage = ProcessStage.RawMaterialInbound,
            StageName = "原料入库",
            OperatorId = dto.OperatorId,
            OperatorName = dto.OperatorName,
            CertificateNo = dto.CertificateNo,
            CertificateType = dto.CertificateType,
            CertificateValidated = true,
            ValidationResult = "证书验证通过",
            Status = ProcessStatus.Completed,
            StatusName = "已完成",
            StartTime = DateTime.UtcNow,
            EndTime = DateTime.UtcNow,
            OperationRecord = dto.OperationRecord,
            AttachmentUrl = dto.AttachmentUrl,
            Remark = dto.Remark,
            CreatedAt = DateTime.UtcNow
        };
        await _processRecordRepo.AddAsync(processRecord);

        var inventory = await _inventoryService.GetInventoriesAsync(new InventoryQueryDto
        {
            EnterpriseId = batch.EnterpriseId,
            WarehouseId = dto.WarehouseId,
            ChemicalId = batch.ChemicalId,
            PageIndex = 1,
            PageSize = 1
        });

        if (inventory.Items.Count == 0)
        {
            await _inventoryService.CreateInventoryAsync(new InventoryCreateDto
            {
                EnterpriseId = batch.EnterpriseId,
                WarehouseId = dto.WarehouseId,
                ChemicalId = batch.ChemicalId,
                Quantity = dto.Quantity,
                MaxCapacity = warehouse.MaxCapacity,
                MinSafeQuantity = warehouse.MaxCapacity * 0.1m,
                ReorderLevel = warehouse.MaxCapacity * 0.2m
            });
        }

        return _mapper.Map<ChemicalBatchDto>(batch);
    }

    public async Task<ChemicalBatchDto> StartProductionAsync(int batchId, ProductionProcessingDto dto)
    {
        var batch = await _batchRepo.GetByIdAsync(batchId) ??
            throw new KeyNotFoundException($"批次不存在: {batchId}");

        if (!await ValidateBatchStatusTransitionAsync(batchId, BatchStatus.InProduction))
            throw new InvalidOperationException("批次状态不允许执行生产加工操作");

        var certValid = await _complianceService.ValidateOperatorCertificateAsync(
            dto.OperatorId, "SpecialOperationCertificate", dto.CertificateNo);
        if (!certValid)
            throw new InvalidOperationException("操作人员资质证书无效或已过期");

        batch.ProductionStartTime = dto.StartTime;
        batch.ProductionEndTime = dto.EndTime;
        batch.ProductionOperatorId = dto.OperatorId;
        batch.ProductionProcessRecord = dto.ProcessRecord;
        batch.Status = BatchStatus.Inspecting;
        batch.UpdatedAt = DateTime.UtcNow;

        await _batchRepo.UpdateAsync(batch);

        var processRecord = new ProcessRecord
        {
            ChemicalBatchId = batchId,
            Stage = ProcessStage.ProductionProcessing,
            StageName = "生产加工",
            OperatorId = dto.OperatorId,
            OperatorName = dto.OperatorName,
            CertificateNo = dto.CertificateNo,
            CertificateType = dto.CertificateType,
            CertificateValidated = true,
            ValidationResult = "证书验证通过",
            Status = ProcessStatus.Completed,
            StatusName = "已完成",
            StartTime = dto.StartTime,
            EndTime = dto.EndTime,
            OperationRecord = dto.ProcessRecord,
            AttachmentUrl = dto.AttachmentUrl,
            Remark = dto.Remark,
            CreatedAt = DateTime.UtcNow
        };
        await _processRecordRepo.AddAsync(processRecord);

        return _mapper.Map<ChemicalBatchDto>(batch);
    }

    public async Task<ChemicalBatchDto> SubmitInspectionAsync(int batchId, FinishedInspectionDto dto)
    {
        var batch = await _batchRepo.GetByIdAsync(batchId) ??
            throw new KeyNotFoundException($"批次不存在: {batchId}");

        if (!await ValidateBatchStatusTransitionAsync(batchId, BatchStatus.Inspecting))
            throw new InvalidOperationException("批次状态不允许执行成品检验操作");

        var certValid = await _complianceService.ValidateOperatorCertificateAsync(
            dto.OperatorId, "ChemicalEngineerCertificate", dto.CertificateNo);
        if (!certValid)
            throw new InvalidOperationException("检验人员资质证书无效或已过期");

        batch.InspectionTime = DateTime.UtcNow;
        batch.InspectorId = dto.OperatorId;
        batch.InspectionResult = dto.InspectionResult;
        batch.InspectionPassed = dto.InspectionPassed;
        batch.InspectionReportUrl = dto.InspectionReportUrl;
        batch.Status = dto.InspectionPassed ? BatchStatus.Qualified : BatchStatus.Unqualified;
        batch.UpdatedAt = DateTime.UtcNow;

        await _batchRepo.UpdateAsync(batch);

        var processRecord = new ProcessRecord
        {
            ChemicalBatchId = batchId,
            Stage = ProcessStage.FinishedInspection,
            StageName = "成品检验",
            OperatorId = dto.OperatorId,
            OperatorName = dto.OperatorName,
            CertificateNo = dto.CertificateNo,
            CertificateType = dto.CertificateType,
            CertificateValidated = true,
            ValidationResult = "证书验证通过",
            Status = dto.InspectionPassed ? ProcessStatus.Completed : ProcessStatus.Failed,
            StatusName = dto.InspectionPassed ? "检验合格" : "检验不合格",
            StartTime = DateTime.UtcNow,
            EndTime = DateTime.UtcNow,
            OperationRecord = dto.InspectionResult,
            AttachmentUrl = dto.InspectionReportUrl,
            Remark = dto.Remark,
            CreatedAt = DateTime.UtcNow
        };
        await _processRecordRepo.AddAsync(processRecord);

        if (dto.InspectionPassed && batch.WarehouseId.HasValue)
        {
            batch.Status = BatchStatus.InStorage;
            await _batchRepo.UpdateAsync(batch);

            await _inventoryService.CreateTransactionAsync(new InventoryTransactionCreateDto
            {
                InventoryId = 0,
                EnterpriseId = batch.EnterpriseId,
                WarehouseId = batch.WarehouseId.Value,
                ChemicalId = batch.ChemicalId,
                ChemicalBatchId = batchId,
                TransactionType = (int)InventoryTransactionType.FinishedGoodsInbound,
                Quantity = batch.Quantity,
                Unit = batch.Unit,
                OperatorId = dto.OperatorId,
                OperatorName = dto.OperatorName,
                Remark = "成品检验合格入库"
            });
        }

        return _mapper.Map<ChemicalBatchDto>(batch);
    }

    public async Task<ChemicalBatchDto> OutboundReviewAsync(int batchId, OutboundReviewDto dto)
    {
        var batch = await _batchRepo.GetByIdAsync(batchId) ??
            throw new KeyNotFoundException($"批次不存在: {batchId}");

        if (batch.Status != BatchStatus.InStorage && batch.Status != BatchStatus.Qualified)
            throw new InvalidOperationException("批次状态不允许执行出库复核操作");

        var certValid = await _complianceService.ValidateOperatorCertificateAsync(
            dto.OperatorId, "SafetyManagerCertificate", dto.CertificateNo);
        if (!certValid)
            throw new InvalidOperationException("复核人员资质证书无效或已过期");

        batch.OutboundReviewTime = DateTime.UtcNow;
        batch.OutboundReviewerId = dto.OperatorId;
        batch.OutboundRemark = dto.Remark;
        batch.Status = BatchStatus.OutForDelivery;
        batch.UpdatedAt = DateTime.UtcNow;

        await _batchRepo.UpdateAsync(batch);

        var processRecord = new ProcessRecord
        {
            ChemicalBatchId = batchId,
            Stage = ProcessStage.OutboundReview,
            StageName = "出库复核",
            OperatorId = dto.OperatorId,
            OperatorName = dto.OperatorName,
            CertificateNo = dto.CertificateNo,
            CertificateType = dto.CertificateType,
            CertificateValidated = true,
            ValidationResult = "证书验证通过",
            Status = ProcessStatus.Completed,
            StatusName = "已完成",
            StartTime = DateTime.UtcNow,
            EndTime = DateTime.UtcNow,
            OperationRecord = $"出库目的地: {dto.TransportDestination}",
            AttachmentUrl = dto.AttachmentUrl,
            Remark = dto.Remark,
            CreatedAt = DateTime.UtcNow
        };
        await _processRecordRepo.AddAsync(processRecord);

        if (batch.WarehouseId.HasValue)
        {
            await _inventoryService.CreateTransactionAsync(new InventoryTransactionCreateDto
            {
                InventoryId = 0,
                EnterpriseId = batch.EnterpriseId,
                WarehouseId = batch.WarehouseId.Value,
                ChemicalId = batch.ChemicalId,
                ChemicalBatchId = batchId,
                TransactionType = (int)InventoryTransactionType.SalesOutbound,
                Quantity = dto.Quantity,
                Unit = batch.Unit,
                OperatorId = dto.OperatorId,
                OperatorName = dto.OperatorName,
                Remark = $"出库复核完成，发往: {dto.TransportDestination}"
            });
        }

        return _mapper.Map<ChemicalBatchDto>(batch);
    }

    public async Task<BatchLifeCycleDto> GetBatchLifeCycleAsync(int batchId)
    {
        var batch = await _batchRepo.GetQueryable()
            .Include(b => b.Chemical)
            .Include(b => b.ProcessRecords)
            .Include(b => b.TransportRecord)
            .FirstOrDefaultAsync(b => b.Id == batchId) ??
            throw new KeyNotFoundException($"批次不存在: {batchId}");

        var processRecords = await _processRecordRepo.GetListAsync(
            p => p.ChemicalBatchId == batchId,
            q => q.OrderBy(p => p.Stage));

        var currentStage = DetermineCurrentStage(batch);
        var currentStageName = ProcessStageNames.GetStageName(currentStage);

        return new BatchLifeCycleDto
        {
            BatchId = batchId,
            BatchNo = batch.BatchNo,
            ChemicalName = batch.Chemical.Name,
            Quantity = batch.Quantity,
            ProcessRecords = _mapper.Map<List<ProcessRecordDto>>(processRecords),
            CurrentStage = (int)currentStage,
            CurrentStageName = currentStageName,
            IsCompleted = batch.Status == BatchStatus.Delivered || batch.Status == BatchStatus.Cancelled
        };
    }

    private static ProcessStage DetermineCurrentStage(ChemicalBatch batch)
    {
        if (batch.Status == BatchStatus.Cancelled)
        {
            var maxRecordStage = batch.ProcessRecords?.Any() == true
                ? batch.ProcessRecords.Max(p => p.Stage)
                : ProcessStage.BatchCreated;
            return maxRecordStage;
        }

        if (batch.Status == BatchStatus.OutForDelivery && batch.TransportRecord != null)
        {
            var transportStatus = batch.TransportRecord.Status;
            if (transportStatus == TransportStatus.InTransit ||
                transportStatus == TransportStatus.Deviating ||
                transportStatus == TransportStatus.Delivered ||
                transportStatus == TransportStatus.Completed)
            {
                return ProcessStage.InTransit;
            }
        }

        if (batch.Status == BatchStatus.Delivered)
        {
            return ProcessStage.Delivered;
        }

        return ProcessStageNames.GetStageFromBatchStatus(batch.Status);
    }

    public async Task<List<ProcessRecordDto>> GetBatchProcessRecordsAsync(int batchId)
    {
        var records = await _processRecordRepo.GetListAsync(
            p => p.ChemicalBatchId == batchId,
            q => q.OrderBy(p => p.Stage));

        return _mapper.Map<List<ProcessRecordDto>>(records);
    }

    public async Task<bool> ValidateBatchStatusTransitionAsync(int batchId, BatchStatus targetStatus)
    {
        var batch = await _batchRepo.GetByIdAsync(batchId);
        if (batch == null) return false;

        var validTransitions = new Dictionary<BatchStatus, List<BatchStatus>>
        {
            { BatchStatus.RawMaterial, new List<BatchStatus> { BatchStatus.InProduction } },
            { BatchStatus.InProduction, new List<BatchStatus> { BatchStatus.Inspecting } },
            { BatchStatus.Inspecting, new List<BatchStatus> { BatchStatus.Qualified, BatchStatus.Unqualified } },
            { BatchStatus.Qualified, new List<BatchStatus> { BatchStatus.InStorage, BatchStatus.OutForDelivery } },
            { BatchStatus.InStorage, new List<BatchStatus> { BatchStatus.OutForDelivery } },
            { BatchStatus.OutForDelivery, new List<BatchStatus> { BatchStatus.Delivered } }
        };

        return validTransitions.TryGetValue(batch.Status, out var allowedTargets) &&
               allowedTargets.Contains(targetStatus);
    }
}
