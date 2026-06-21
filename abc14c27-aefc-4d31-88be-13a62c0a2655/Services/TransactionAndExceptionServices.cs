using System.Text;
using AutoMapper;
using AutoMapper.QueryableExtensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using UsedVehicleTransaction.Common;
using UsedVehicleTransaction.Data;
using UsedVehicleTransaction.DTOs;
using UsedVehicleTransaction.Enums;
using UsedVehicleTransaction.Models;

namespace UsedVehicleTransaction.Services;

public class TransactionService : ITransactionService
{
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly IMemoryCache _cache;
    private readonly ILogger<TransactionService> _logger;

    public TransactionService(
        ApplicationDbContext context,
        IMapper mapper,
        IMemoryCache cache,
        ILogger<TransactionService> logger)
    {
        _context = context;
        _mapper = mapper;
        _cache = cache;
        _logger = logger;
    }

    public async Task<ApiResponse<TransactionDto>> CreateAsync(TransactionCreateDto dto, long operatorId)
    {
        _logger.LogInformation("Creating transaction for VehicleId: {VehicleId}, Buyer={BuyerName}", dto.VehicleId, dto.BuyerName);

        var vehicle = await _context.Vehicles.FindAsync(dto.VehicleId);
        if (vehicle == null)
        {
            return ApiResponse<TransactionDto>.Fail(ErrorCodes.VehicleNotFound.Code, ErrorCodes.VehicleNotFound.MessageZh, ErrorCodes.VehicleNotFound.MessageEn);
        }

        if (vehicle.Status != VehicleStatus.InspectionCompleted &&
            vehicle.Status != VehicleStatus.AvailableForTransaction)
        {
            return ApiResponse<TransactionDto>.Fail(ErrorCodes.BadRequest.Code,
                $"车辆状态为{vehicle.Status}，暂不支持交易登记（需先完成鉴定并通过审核）",
                $"Vehicle status is {vehicle.Status}, not eligible for transaction registration");
        }

        var activeTxn = await _context.VehicleTransactions
            .AsNoTracking()
            .AnyAsync(t => t.VehicleId == dto.VehicleId &&
                (t.Status == TransactionStatus.Created ||
                 t.Status == TransactionStatus.PendingWorkflow ||
                 t.Status == TransactionStatus.InProgress));

        if (activeTxn)
        {
            return ApiResponse<TransactionDto>.Fail(ErrorCodes.BadRequest.Code,
                "该车辆已存在进行中的交易记录",
                "An active transaction already exists for this vehicle");
        }

        var transactionNo = $"TX{DateTime.Now:yyyyMMddHHmmss}{Random.Shared.Next(1000, 9999)}";
        var transaction = _mapper.Map<VehicleTransaction>(dto);
        transaction.TransactionNo = transactionNo;
        transaction.Status = TransactionStatus.Created;
        transaction.OldPlateNumber = vehicle.PlateNumber;
        transaction.CreatedBy = operatorId;

        transaction.TaxAmount = Math.Round(transaction.TransactionPrice * 0.015m, 2);
        transaction.ServiceFee = CalculateServiceFee(transaction.TransactionPrice);

        _context.VehicleTransactions.Add(transaction);

        vehicle.Status = VehicleStatus.InTransaction;
        vehicle.UpdatedBy = operatorId;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Transaction created: TransactionNo={TxnNo}, Id={Id}", transactionNo, transaction.Id);
        var result = _mapper.Map<TransactionDto>(transaction);
        return ApiResponse<TransactionDto>.Success(result, "交易登记成功", "Transaction registered successfully");
    }

    private static decimal CalculateServiceFee(decimal price)
    {
        return price switch
        {
            <= 50000 => 300,
            <= 100000 => 500,
            <= 200000 => 800,
            <= 500000 => 1200,
            _ => 1800
        };
    }

    public async Task<ApiResponse<TransactionDto>> UpdateAsync(long id, TransactionUpdateDto dto, long operatorId)
    {
        var transaction = await _context.VehicleTransactions.FindAsync(id);
        if (transaction == null)
        {
            return ApiResponse<TransactionDto>.Fail(ErrorCodes.TransactionNotFound.Code, ErrorCodes.TransactionNotFound.MessageZh, ErrorCodes.TransactionNotFound.MessageEn);
        }

        if (transaction.Status == TransactionStatus.Completed || transaction.Status == TransactionStatus.InProgress)
        {
            return ApiResponse<TransactionDto>.Fail(ErrorCodes.TransactionInvalidStatus.Code,
                "已启动过户流程或已完成的交易不允许修改基本信息",
                "Cannot modify transaction that is in progress or completed");
        }

        _mapper.Map(dto, transaction);
        transaction.UpdatedBy = operatorId;

        if (dto.TransactionPrice.HasValue)
        {
            transaction.TaxAmount = Math.Round(dto.TransactionPrice.Value * 0.015m, 2);
            transaction.ServiceFee = CalculateServiceFee(dto.TransactionPrice.Value);
        }

        await _context.SaveChangesAsync();
        _cache.Remove($"transaction_{id}");

        var result = _mapper.Map<TransactionDto>(transaction);
        return ApiResponse<TransactionDto>.Success(result, "交易信息更新成功", "Transaction updated successfully");
    }

    public async Task<ApiResponse<TransactionDetailDto>> GetByIdAsync(long id)
    {
        var cacheKey = $"transaction_{id}";
        if (_cache.TryGetValue(cacheKey, out TransactionDetailDto? cached))
        {
            return ApiResponse<TransactionDetailDto>.Success(cached!);
        }

        var transaction = await _context.VehicleTransactions
            .AsNoTracking()
            .Include(t => t.Vehicle)
            .Include(t => t.InspectionOrder)
            .Include(t => t.WorkflowInstances!)
                .ThenInclude(w => w.NodeExecutions)
            .Include(t => t.Archives)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (transaction == null)
        {
            return ApiResponse<TransactionDetailDto>.Fail(ErrorCodes.TransactionNotFound.Code, ErrorCodes.TransactionNotFound.MessageZh, ErrorCodes.TransactionNotFound.MessageEn);
        }

        var result = _mapper.Map<TransactionDetailDto>(transaction);
        _cache.Set(cacheKey, result, TimeSpan.FromMinutes(5));
        return ApiResponse<TransactionDetailDto>.Success(result);
    }

    public async Task<ApiResponse<PagedResult<TransactionDto>>> QueryAsync(TransactionQueryDto dto)
    {
        var query = _context.VehicleTransactions.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(dto.TransactionNo))
            query = query.Where(t => t.TransactionNo.Contains(dto.TransactionNo));

        if (dto.VehicleId.HasValue)
            query = query.Where(t => t.VehicleId == dto.VehicleId.Value);

        if (!string.IsNullOrWhiteSpace(dto.Vin))
            query = query.Where(t => t.Vehicle != null && t.Vehicle.Vin.Contains(dto.Vin));

        if (!string.IsNullOrWhiteSpace(dto.BuyerName))
            query = query.Where(t => t.BuyerName.Contains(dto.BuyerName));

        if (!string.IsNullOrWhiteSpace(dto.SellerName))
            query = query.Where(t => t.SellerName.Contains(dto.SellerName));

        if (dto.Status.HasValue)
            query = query.Where(t => t.Status == dto.Status.Value);

        if (dto.StartDate.HasValue)
            query = query.Where(t => t.TransactionDate >= dto.StartDate.Value);

        if (dto.EndDate.HasValue)
            query = query.Where(t => t.TransactionDate <= dto.EndDate.Value);

        var totalCount = await query.CountAsync();

        var sortField = string.IsNullOrWhiteSpace(dto.SortField) ? "CreatedAt" : dto.SortField;
        query = dto.SortOrder.ToLower() == "asc"
            ? OrderByDynamic(query, sortField, true)
            : OrderByDynamic(query, sortField, false);

        var items = await query
            .Skip((dto.PageIndex - 1) * dto.PageSize)
            .Take(dto.PageSize)
            .ProjectTo<TransactionDto>(_mapper.ConfigurationProvider)
            .ToListAsync();

        var result = new PagedResult<TransactionDto>
        {
            Items = items,
            TotalCount = totalCount,
            PageIndex = dto.PageIndex,
            PageSize = dto.PageSize
        };

        return ApiResponse<PagedResult<TransactionDto>>.Success(result);
    }

    public async Task<ApiResponse<TransactionDto>> UpdateStatusAsync(long id, TransactionStatus status, long operatorId)
    {
        var transaction = await _context.VehicleTransactions.FindAsync(id);
        if (transaction == null)
        {
            return ApiResponse<TransactionDto>.Fail(ErrorCodes.TransactionNotFound.Code, ErrorCodes.TransactionNotFound.MessageZh, ErrorCodes.TransactionNotFound.MessageEn);
        }

        transaction.Status = status;
        transaction.UpdatedBy = operatorId;

        await _context.SaveChangesAsync();
        _cache.Remove($"transaction_{id}");

        var result = _mapper.Map<TransactionDto>(transaction);
        return ApiResponse<TransactionDto>.Success(result, "交易状态更新成功", "Transaction status updated successfully");
    }

    public async Task<ApiResponse<bool>> CancelAsync(long id, long operatorId, string reason)
    {
        _logger.LogInformation("Cancelling transaction: {Id}, Reason: {Reason}", id, reason);

        var transaction = await _context.VehicleTransactions.FindAsync(id);
        if (transaction == null)
        {
            return ApiResponse<bool>.Fail(ErrorCodes.TransactionNotFound.Code, ErrorCodes.TransactionNotFound.MessageZh, ErrorCodes.TransactionNotFound.MessageEn);
        }

        if (transaction.Status == TransactionStatus.Completed)
        {
            return ApiResponse<bool>.Fail(ErrorCodes.TransactionInvalidStatus.Code,
                "已完成的交易不能取消",
                "Completed transaction cannot be cancelled");
        }

        transaction.Status = TransactionStatus.Cancelled;
        transaction.Remark = string.IsNullOrEmpty(transaction.Remark)
            ? $"[取消原因] {reason}"
            : $"{transaction.Remark}；[取消原因] {reason}";
        transaction.UpdatedBy = operatorId;

        var vehicle = await _context.Vehicles.FindAsync(transaction.VehicleId);
        if (vehicle != null && vehicle.Status == VehicleStatus.InTransaction)
        {
            vehicle.Status = VehicleStatus.AvailableForTransaction;
            vehicle.UpdatedBy = operatorId;
        }

        await _context.SaveChangesAsync();
        _cache.Remove($"transaction_{id}");

        return ApiResponse<bool>.Success(true, "交易已取消", "Transaction cancelled");
    }

    private static IQueryable<VehicleTransaction> OrderByDynamic(IQueryable<VehicleTransaction> source, string propertyName, bool ascending)
    {
        var param = System.Linq.Expressions.Expression.Parameter(typeof(VehicleTransaction), "t");
        var property = typeof(VehicleTransaction).GetProperty(propertyName);
        if (property == null) return ascending ? source.OrderBy(t => t.CreatedAt) : source.OrderByDescending(t => t.CreatedAt);

        var propertyAccess = System.Linq.Expressions.Expression.MakeMemberAccess(param, property);
        var orderByExpression = System.Linq.Expressions.Expression.Lambda(propertyAccess, param);
        var methodName = ascending ? "OrderBy" : "OrderByDescending";
        var resultExpression = System.Linq.Expressions.Expression.Call(
            typeof(Queryable),
            methodName,
            new[] { typeof(VehicleTransaction), property.PropertyType },
            source.Expression,
            System.Linq.Expressions.Expression.Quote(orderByExpression));
        return source.Provider.CreateQuery<VehicleTransaction>(resultExpression);
    }
}

public class ExceptionCaseService : IExceptionCaseService
{
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly ILogger<ExceptionCaseService> _logger;

    public ExceptionCaseService(
        ApplicationDbContext context,
        IMapper mapper,
        ILogger<ExceptionCaseService> logger)
    {
        _context = context;
        _mapper = mapper;
        _logger = logger;
    }

    public async Task<ApiResponse<ExceptionCaseDto>> CreateAsync(ExceptionCaseCreateDto dto, long operatorId)
    {
        _logger.LogInformation("Creating exception case: Type={CaseType}, Title={Title}", dto.CaseType, dto.Title);

        var caseNo = $"EX{DateTime.Now:yyyyMMddHHmmss}{Random.Shared.Next(100, 999)}";
        var exceptionCase = _mapper.Map<ExceptionCase>(dto);
        exceptionCase.CaseNo = caseNo;
        exceptionCase.Status = ExceptionCaseStatus.Created;
        exceptionCase.CaseTypeName = GetCaseTypeName(dto.CaseType);
        exceptionCase.CreatedBy = operatorId;

        _context.ExceptionCases.Add(exceptionCase);

        var log = new ExceptionCaseLog
        {
            CaseId = exceptionCase.Id,
            OldStatus = 0,
            NewStatus = ExceptionCaseStatus.Created,
            Action = "创建案件",
            Remark = dto.Description,
            OperatorId = operatorId,
            OperatorName = "System",
            CreatedBy = operatorId
        };
        _context.ExceptionCaseLogs.Add(log);

        await _context.SaveChangesAsync();

        _logger.LogInformation("Exception case created: CaseNo={CaseNo}, Id={Id}", caseNo, exceptionCase.Id);
        var result = _mapper.Map<ExceptionCaseDto>(exceptionCase);
        return ApiResponse<ExceptionCaseDto>.Success(result, "异常案件创建成功", "Exception case created successfully");
    }

    public async Task<ApiResponse<ExceptionCaseDetailDto>> ProcessAsync(ExceptionCaseProcessDto dto, long operatorId)
    {
        _logger.LogInformation("Processing exception case: CaseId={CaseId}, NewStatus={NewStatus}", dto.CaseId, dto.NewStatus);

        var exceptionCase = await _context.ExceptionCases
            .Include(c => c.ProcessingLogs)
            .FirstOrDefaultAsync(c => c.Id == dto.CaseId);

        if (exceptionCase == null)
        {
            return ApiResponse<ExceptionCaseDetailDto>.Fail(ErrorCodes.ExceptionCaseNotFound.Code, ErrorCodes.ExceptionCaseNotFound.MessageZh, ErrorCodes.ExceptionCaseNotFound.MessageEn);
        }

        var oldStatus = exceptionCase.Status;
        exceptionCase.Status = dto.NewStatus;
        exceptionCase.ProcessingCount++;
        exceptionCase.UpdatedBy = operatorId;

        if (dto.NewStatus == ExceptionCaseStatus.Resolved || dto.NewStatus == ExceptionCaseStatus.Closed)
        {
            exceptionCase.Resolution = dto.Resolution;
            exceptionCase.ResolvedAt = DateTime.UtcNow;
            exceptionCase.ResolvedBy = operatorId;
        }

        var log = new ExceptionCaseLog
        {
            CaseId = exceptionCase.Id,
            OldStatus = oldStatus,
            NewStatus = dto.NewStatus,
            Action = dto.Action,
            Remark = dto.Remark,
            OperatorId = operatorId,
            OperatorName = "System",
            CreatedBy = operatorId
        };
        _context.ExceptionCaseLogs.Add(log);

        if ((dto.NewStatus == ExceptionCaseStatus.Resolved || dto.NewStatus == ExceptionCaseStatus.Closed)
            && exceptionCase.VehicleId.HasValue)
        {
            var vehicle = await _context.Vehicles.FindAsync(exceptionCase.VehicleId.Value);
            if (vehicle != null && vehicle.Status == VehicleStatus.ExceptionHandling)
            {
                vehicle.Status = DeterminePostExceptionStatus(exceptionCase);
                vehicle.UpdatedBy = operatorId;
            }
        }

        await _context.SaveChangesAsync();

        var result = _mapper.Map<ExceptionCaseDetailDto>(exceptionCase);
        return ApiResponse<ExceptionCaseDetailDto>.Success(result, "案件处理完成", "Case processed successfully");
    }

    private static VehicleStatus DeterminePostExceptionStatus(ExceptionCase exceptionCase)
    {
        return exceptionCase.CaseType switch
        {
            ExceptionCaseType.MortgageRelease or
            ExceptionCaseType.SeizurePending or
            ExceptionCaseType.EnvironmentalExceed or
            ExceptionCaseType.EngineMismatch or
            ExceptionCaseType.FrameMismatch or
            ExceptionCaseType.AccidentUnresolved => VehicleStatus.CompliancePassed,
            ExceptionCaseType.MissingDocument or
            ExceptionCaseType.IdentityVerification or
            ExceptionCaseType.TaxArrears => VehicleStatus.InTransaction,
            _ => VehicleStatus.AvailableForTransaction
        };
    }

    public async Task<ApiResponse<ExceptionCaseDetailDto>> GetByIdAsync(long id)
    {
        var exceptionCase = await _context.ExceptionCases
            .AsNoTracking()
            .Include(c => c.ProcessingLogs!.OrderBy(l => l.CreatedAt))
            .FirstOrDefaultAsync(c => c.Id == id);

        if (exceptionCase == null)
        {
            return ApiResponse<ExceptionCaseDetailDto>.Fail(ErrorCodes.ExceptionCaseNotFound.Code, ErrorCodes.ExceptionCaseNotFound.MessageZh, ErrorCodes.ExceptionCaseNotFound.MessageEn);
        }

        var result = _mapper.Map<ExceptionCaseDetailDto>(exceptionCase);
        return ApiResponse<ExceptionCaseDetailDto>.Success(result);
    }

    public async Task<ApiResponse<PagedResult<ExceptionCaseDto>>> QueryAsync(ExceptionCaseQueryDto dto)
    {
        var query = _context.ExceptionCases.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(dto.CaseNo))
            query = query.Where(c => c.CaseNo.Contains(dto.CaseNo));

        if (dto.CaseType.HasValue)
            query = query.Where(c => c.CaseType == dto.CaseType.Value);

        if (dto.Status.HasValue)
            query = query.Where(c => c.Status == dto.Status.Value);

        if (dto.VehicleId.HasValue)
            query = query.Where(c => c.VehicleId == dto.VehicleId.Value);

        if (dto.TransactionId.HasValue)
            query = query.Where(c => c.TransactionId == dto.TransactionId.Value);

        if (dto.AssignedTo.HasValue)
            query = query.Where(c => c.AssignedTo == dto.AssignedTo.Value);

        if (dto.Priority.HasValue)
            query = query.Where(c => c.Priority == dto.Priority.Value);

        if (dto.StartDate.HasValue)
            query = query.Where(c => c.CreatedAt >= dto.StartDate.Value);

        if (dto.EndDate.HasValue)
            query = query.Where(c => c.CreatedAt <= dto.EndDate.Value);

        var totalCount = await query.CountAsync();

        var sortField = string.IsNullOrWhiteSpace(dto.SortField) ? "CreatedAt" : dto.SortField;
        query = dto.SortOrder.ToLower() == "asc"
            ? OrderByDynamic(query, sortField, true)
            : OrderByDynamic(query, sortField, false);

        var items = await query
            .Skip((dto.PageIndex - 1) * dto.PageSize)
            .Take(dto.PageSize)
            .ProjectTo<ExceptionCaseDto>(_mapper.ConfigurationProvider)
            .ToListAsync();

        var result = new PagedResult<ExceptionCaseDto>
        {
            Items = items,
            TotalCount = totalCount,
            PageIndex = dto.PageIndex,
            PageSize = dto.PageSize
        };

        return ApiResponse<PagedResult<ExceptionCaseDto>>.Success(result);
    }

    public async Task<ApiResponse<bool>> AssignAsync(long caseId, long assigneeId, string? assigneeName, long operatorId)
    {
        var exceptionCase = await _context.ExceptionCases.FindAsync(caseId);
        if (exceptionCase == null)
        {
            return ApiResponse<bool>.Fail(ErrorCodes.ExceptionCaseNotFound.Code, ErrorCodes.ExceptionCaseNotFound.MessageZh, ErrorCodes.ExceptionCaseNotFound.MessageEn);
        }

        exceptionCase.AssignedTo = assigneeId;
        exceptionCase.AssigneeName = assigneeName;
        exceptionCase.Status = ExceptionCaseStatus.UnderInvestigation;
        exceptionCase.UpdatedBy = operatorId;

        var log = new ExceptionCaseLog
        {
            CaseId = exceptionCase.Id,
            OldStatus = exceptionCase.Status,
            NewStatus = ExceptionCaseStatus.UnderInvestigation,
            Action = $"分派案件给：{assigneeName ?? assigneeId.ToString()}",
            OperatorId = operatorId,
            OperatorName = "System",
            CreatedBy = operatorId
        };
        _context.ExceptionCaseLogs.Add(log);

        await _context.SaveChangesAsync();

        return ApiResponse<bool>.Success(true, "案件分派成功", "Case assigned successfully");
    }

    public async Task<ApiResponse<List<ExceptionCaseLogDto>>> GetProcessingLogsAsync(long caseId)
    {
        var logs = await _context.ExceptionCaseLogs
            .AsNoTracking()
            .Where(l => l.CaseId == caseId)
            .OrderBy(l => l.CreatedAt)
            .ProjectTo<ExceptionCaseLogDto>(_mapper.ConfigurationProvider)
            .ToListAsync();

        return ApiResponse<List<ExceptionCaseLogDto>>.Success(logs);
    }

    public async Task<ApiResponse<byte[]>> ExportAsync(ExceptionCaseQueryDto dto)
    {
        _logger.LogInformation("Exporting exception cases...");

        var query = _context.ExceptionCases.AsNoTracking();

        if (dto.CaseType.HasValue)
            query = query.Where(c => c.CaseType == dto.CaseType.Value);
        if (dto.Status.HasValue)
            query = query.Where(c => c.Status == dto.Status.Value);
        if (dto.StartDate.HasValue)
            query = query.Where(c => c.CreatedAt >= dto.StartDate.Value);
        if (dto.EndDate.HasValue)
            query = query.Where(c => c.CreatedAt <= dto.EndDate.Value);

        var cases = await query
            .OrderByDescending(c => c.CreatedAt)
            .Take(10000)
            .ToListAsync();

        var csv = new StringBuilder();
        csv.AppendLine("案件编号,案件类型,标题,关联VIN,关联交易号,状态,优先级,指派人,创建时间,处理次数,解决时间,解决方案");

        foreach (var c in cases)
        {
            csv.AppendLine($"{c.CaseNo},{c.CaseTypeName},\"{EscapeCsv(c.Title)}\",{c.VehicleId},{c.TransactionId}," +
                           $"{c.Status},{c.Priority},{c.AssigneeName ?? string.Empty}," +
                           $"{c.CreatedAt:yyyy-MM-dd HH:mm:ss},{c.ProcessingCount}," +
                           $"{(c.ResolvedAt.HasValue ? c.ResolvedAt.Value.ToString("yyyy-MM-dd HH:mm:ss") : string.Empty)}," +
                           $"\"{EscapeCsv(c.Resolution)}\"");
        }

        var bytes = Encoding.UTF8.GetBytes(csv.ToString());
        _logger.LogInformation("Exported {Count} exception cases", cases.Count);
        return ApiResponse<byte[]>.Success(bytes, $"导出成功，共{cases.Count}条记录", $"Export succeeded, {cases.Count} records total");
    }

    private static string EscapeCsv(string? value)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;
        return value.Replace("\"", "\"\"");
    }

    private static string GetCaseTypeName(ExceptionCaseType caseType) => caseType switch
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

    private static IQueryable<ExceptionCase> OrderByDynamic(IQueryable<ExceptionCase> source, string propertyName, bool ascending)
    {
        var param = System.Linq.Expressions.Expression.Parameter(typeof(ExceptionCase), "c");
        var property = typeof(ExceptionCase).GetProperty(propertyName);
        if (property == null) return ascending ? source.OrderBy(c => c.CreatedAt) : source.OrderByDescending(c => c.CreatedAt);

        var propertyAccess = System.Linq.Expressions.Expression.MakeMemberAccess(param, property);
        var orderByExpression = System.Linq.Expressions.Expression.Lambda(propertyAccess, param);
        var methodName = ascending ? "OrderBy" : "OrderByDescending";
        var resultExpression = System.Linq.Expressions.Expression.Call(
            typeof(Queryable),
            methodName,
            new[] { typeof(ExceptionCase), property.PropertyType },
            source.Expression,
            System.Linq.Expressions.Expression.Quote(orderByExpression));
        return source.Provider.CreateQuery<ExceptionCase>(resultExpression);
    }
}
