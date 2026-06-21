using System.Collections.Concurrent;
using System.Text.Json;
using AutoMapper;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using UsedVehicleTransaction.Common;
using UsedVehicleTransaction.Data;
using UsedVehicleTransaction.DTOs;
using UsedVehicleTransaction.Enums;
using UsedVehicleTransaction.Models;

namespace UsedVehicleTransaction.Services;

public class ComplianceService : IComplianceService
{
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly IMemoryCache _cache;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly AppSettings _appSettings;
    private readonly ExternalApiSettings _externalApiSettings;
    private readonly ILogger<ComplianceService> _logger;

    public ComplianceService(
        ApplicationDbContext context,
        IMapper mapper,
        IMemoryCache cache,
        IHttpClientFactory httpClientFactory,
        IOptions<AppSettings> appSettings,
        IOptions<ExternalApiSettings> externalApiSettings,
        ILogger<ComplianceService> logger)
    {
        _context = context;
        _mapper = mapper;
        _cache = cache;
        _httpClientFactory = httpClientFactory;
        _appSettings = appSettings.Value;
        _externalApiSettings = externalApiSettings.Value;
        _logger = logger;
    }

    public async Task<ApiResponse<ComplianceCheckResultDto>> CheckComplianceAsync(ComplianceCheckRequestDto dto, long operatorId)
    {
        _logger.LogInformation("Starting compliance check for VIN: {Vin}, VehicleId: {VehicleId}", dto.Vin, dto.VehicleId);

        Vehicle? vehicle;
        if (dto.VehicleId.HasValue)
        {
            vehicle = await _context.Vehicles.FindAsync(dto.VehicleId.Value);
            if (vehicle == null)
            {
                return ApiResponse<ComplianceCheckResultDto>.Fail(ErrorCodes.VehicleNotFound.Code, ErrorCodes.VehicleNotFound.MessageZh, ErrorCodes.VehicleNotFound.MessageEn);
            }
            if (!string.IsNullOrEmpty(dto.Vin) && vehicle.Vin != dto.Vin)
            {
                vehicle.Vin = dto.Vin;
            }
        }
        else
        {
            vehicle = await _context.Vehicles.FirstOrDefaultAsync(v => v.Vin == dto.Vin);
            if (vehicle == null)
            {
                vehicle = new Vehicle
                {
                    Vin = dto.Vin,
                    PlateNumber = "待录入",
                    Brand = "待录入",
                    Model = "待录入",
                    Status = VehicleStatus.PendingCompliance,
                    CreatedBy = operatorId
                };
                _context.Vehicles.Add(vehicle);
                await _context.SaveChangesAsync();
            }
        }

        var batchNo = $"CC{DateTime.Now:yyyyMMddHHmmss}{Random.Shared.Next(1000, 9999)}";

        var checkRecord = new ComplianceCheckRecord
        {
            VehicleId = vehicle.Id,
            CheckBatchNo = batchNo,
            OverallStatus = ComplianceCheckStatus.Running,
            CheckTime = DateTime.UtcNow,
            TotalItems = 12,
            PassedItems = 0,
            FailedItems = 0,
            ExceptionItems = 0,
            CreatedBy = operatorId
        };

        _context.ComplianceCheckRecords.Add(checkRecord);
        await _context.SaveChangesAsync();

        using var cts = new CancellationTokenSource(_appSettings.ComplianceCheckTimeoutMs);
        var startTime = DateTime.UtcNow;

        var checkItems = new ConcurrentBag<ComplianceCheckItem>();
        var checkTasks = GetComplianceCheckTasks(vehicle, checkRecord, checkItems, cts.Token);

        try
        {
            await Task.WhenAll(checkTasks);
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("Compliance check timed out for VehicleId: {VehicleId}", vehicle.Id);
            checkRecord.OverallStatus = ComplianceCheckStatus.Timeout;
            await _context.SaveChangesAsync();
            return ApiResponse<ComplianceCheckResultDto>.Fail(ErrorCodes.ComplianceCheckTimeout.Code, ErrorCodes.ComplianceCheckTimeout.MessageZh, ErrorCodes.ComplianceCheckTimeout.MessageEn);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during compliance check for VehicleId: {VehicleId}", vehicle.Id);
            checkRecord.OverallStatus = ComplianceCheckStatus.Exception;
            await _context.SaveChangesAsync();
            return ApiResponse<ComplianceCheckResultDto>.Fail(ErrorCodes.ComplianceCheckFailed.Code, ErrorCodes.ComplianceCheckFailed.MessageZh, ErrorCodes.ComplianceCheckFailed.MessageEn);
        }

        var itemsList = checkItems.ToList();
        checkRecord.PassedItems = itemsList.Count(i => i.Passed);
        checkRecord.FailedItems = itemsList.Count(i => !i.Passed && i.Status == ComplianceCheckStatus.Failed);
        checkRecord.ExceptionItems = itemsList.Count(i => i.Status == ComplianceCheckStatus.Exception || i.Status == ComplianceCheckStatus.Timeout);

        var failureReasons = itemsList
            .Where(i => !i.Passed && !string.IsNullOrEmpty(i.FailureReason))
            .Select(i => i.FailureReason!)
            .ToList();

        checkRecord.FailureReasons = string.Join(';', failureReasons);
        checkRecord.OverallStatus = checkRecord.FailedItems == 0 && checkRecord.ExceptionItems == 0
            ? ComplianceCheckStatus.Passed
            : ComplianceCheckStatus.Failed;

        vehicle.Status = checkRecord.OverallStatus == ComplianceCheckStatus.Passed
            ? VehicleStatus.CompliancePassed
            : VehicleStatus.ComplianceFailed;
        vehicle.UpdatedBy = operatorId;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Compliance check completed for VehicleId: {VehicleId}, Status: {Status}, Passed: {Passed}, Failed: {Failed}, Duration: {Duration}ms",
            vehicle.Id, checkRecord.OverallStatus, checkRecord.PassedItems, checkRecord.FailedItems,
            (int)(DateTime.UtcNow - startTime).TotalMilliseconds);

        checkRecord.CheckItems = itemsList;
        var result = _mapper.Map<ComplianceCheckResultDto>(checkRecord);
        var message = checkRecord.OverallStatus == ComplianceCheckStatus.Passed
            ? "合规校验通过"
            : $"合规校验未通过，{checkRecord.FailedItems}项不通过，{checkRecord.ExceptionItems}项异常";
        var messageEn = checkRecord.OverallStatus == ComplianceCheckStatus.Passed
            ? "Compliance check passed"
            : $"Compliance check failed. {checkRecord.FailedItems} items failed, {checkRecord.ExceptionItems} items with exceptions.";

        return ApiResponse<ComplianceCheckResultDto>.Success(result, message, messageEn);
    }

    private List<Task> GetComplianceCheckTasks(Vehicle vehicle, ComplianceCheckRecord checkRecord, ConcurrentBag<ComplianceCheckItem> checkItems, CancellationToken token)
    {
        var tasks = new List<Task>
        {
            CheckEnvironmentalStandardAsync(vehicle, checkRecord, checkItems, token),
            CheckAccidentRecordAsync(vehicle, checkRecord, checkItems, token),
            CheckMortgageStatusAsync(vehicle, checkRecord, checkItems, token),
            CheckSeizureStatusAsync(vehicle, checkRecord, checkItems, token),
            CheckAnnualInspectionAsync(vehicle, checkRecord, checkItems, token),
            CheckInsuranceValidityAsync(vehicle, checkRecord, checkItems, token),
            CheckModificationRecordAsync(vehicle, checkRecord, checkItems, token),
            CheckTheftRecordAsync(vehicle, checkRecord, checkItems, token),
            CheckTaxArrearsAsync(vehicle, checkRecord, checkItems, token),
            CheckScrapRecordAsync(vehicle, checkRecord, checkItems, token),
            CheckEngineNumberMatchAsync(vehicle, checkRecord, checkItems, token),
            CheckFrameNumberMatchAsync(vehicle, checkRecord, checkItems, token)
        };

        return tasks;
    }

    private async Task CheckEnvironmentalStandardAsync(Vehicle vehicle, ComplianceCheckRecord checkRecord, ConcurrentBag<ComplianceCheckItem> checkItems, CancellationToken token)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            await SimulateExternalApiCallAsync(_externalApiSettings.EnvProtectionApi, token);
            var passed = Random.Shared.Next(100) > 5;
            var item = new ComplianceCheckItem
            {
                CheckRecordId = checkRecord.Id,
                ItemType = ComplianceItemType.EnvironmentalStandard,
                ItemName = "环保达标校验",
                ItemNameEn = "Environmental Standard Check",
                Status = passed ? ComplianceCheckStatus.Passed : ComplianceCheckStatus.Failed,
                Passed = passed,
                Detail = passed ? "符合当前排放标准要求" : "排放标准不符合要求，建议：国三及以下排放标准需整改",
                DurationMs = (int)sw.ElapsedMilliseconds,
                FailureReason = passed ? null : "车辆排放标准未达到当前准入要求（国IV及以上）",
                FailureReasonEn = passed ? null : "Vehicle emission standard does not meet current access requirements (National IV and above)",
                SourceSystem = "EnvProtectionApi",
                CreatedBy = 0
            };
            checkItems.Add(item);
            _context.ComplianceCheckItems.Add(item);
        }
        catch (OperationCanceledException)
        {
            CreateTimeoutItem(checkRecord, checkItems, ComplianceItemType.EnvironmentalStandard, "环保达标校验", "Environmental Standard Check", (int)sw.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            CreateExceptionItem(checkRecord, checkItems, ComplianceItemType.EnvironmentalStandard, "环保达标校验", "Environmental Standard Check", (int)sw.ElapsedMilliseconds, ex.Message);
        }
    }

    private async Task CheckAccidentRecordAsync(Vehicle vehicle, ComplianceCheckRecord checkRecord, ConcurrentBag<ComplianceCheckItem> checkItems, CancellationToken token)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            await SimulateExternalApiCallAsync(_externalApiSettings.AccidentRecordApi, token);
            var hasMajorAccident = Random.Shared.Next(100) > 92;
            var passed = !hasMajorAccident;
            var item = new ComplianceCheckItem
            {
                CheckRecordId = checkRecord.Id,
                ItemType = ComplianceItemType.AccidentRecord,
                ItemName = "事故记录查询",
                ItemNameEn = "Accident Record Check",
                Status = passed ? ComplianceCheckStatus.Passed : ComplianceCheckStatus.Failed,
                Passed = passed,
                Detail = passed ? "未查询到重大事故记录" : "查询到重大事故记录，2022年10月，涉事金额18万元",
                DurationMs = (int)sw.ElapsedMilliseconds,
                FailureReason = passed ? null : "车辆存在重大事故记录未处理完毕",
                FailureReasonEn = passed ? null : "Vehicle has unresolved major accident records",
                SourceSystem = "AccidentRecordApi",
                CreatedBy = 0
            };
            checkItems.Add(item);
            _context.ComplianceCheckItems.Add(item);
        }
        catch (OperationCanceledException)
        {
            CreateTimeoutItem(checkRecord, checkItems, ComplianceItemType.AccidentRecord, "事故记录查询", "Accident Record Check", (int)sw.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            CreateExceptionItem(checkRecord, checkItems, ComplianceItemType.AccidentRecord, "事故记录查询", "Accident Record Check", (int)sw.ElapsedMilliseconds, ex.Message);
        }
    }

    private async Task CheckMortgageStatusAsync(Vehicle vehicle, ComplianceCheckRecord checkRecord, ConcurrentBag<ComplianceCheckItem> checkItems, CancellationToken token)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            await SimulateExternalApiCallAsync(_externalApiSettings.MortgageApi, token);
            var hasMortgage = Random.Shared.Next(100) > 85;
            var passed = !hasMortgage;
            var item = new ComplianceCheckItem
            {
                CheckRecordId = checkRecord.Id,
                ItemType = ComplianceItemType.MortgageStatus,
                ItemName = "抵押状态查询",
                ItemNameEn = "Mortgage Status Check",
                Status = passed ? ComplianceCheckStatus.Passed : ComplianceCheckStatus.Failed,
                Passed = passed,
                Detail = passed ? "车辆未处于抵押状态" : "车辆处于抵押状态，抵押权人：XX银行，登记日期2023-06",
                DurationMs = (int)sw.ElapsedMilliseconds,
                FailureReason = passed ? null : "车辆存在未解除的抵押登记",
                FailureReasonEn = passed ? null : "Vehicle has unreleased mortgage registration",
                SourceSystem = "MortgageApi",
                CreatedBy = 0
            };
            checkItems.Add(item);
            _context.ComplianceCheckItems.Add(item);
        }
        catch (OperationCanceledException)
        {
            CreateTimeoutItem(checkRecord, checkItems, ComplianceItemType.MortgageStatus, "抵押状态查询", "Mortgage Status Check", (int)sw.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            CreateExceptionItem(checkRecord, checkItems, ComplianceItemType.MortgageStatus, "抵押状态查询", "Mortgage Status Check", (int)sw.ElapsedMilliseconds, ex.Message);
        }
    }

    private async Task CheckSeizureStatusAsync(Vehicle vehicle, ComplianceCheckRecord checkRecord, ConcurrentBag<ComplianceCheckItem> checkItems, CancellationToken token)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            await SimulateExternalApiCallAsync(_externalApiSettings.SeizureApi, token);
            var hasSeizure = Random.Shared.Next(100) > 95;
            var passed = !hasSeizure;
            var item = new ComplianceCheckItem
            {
                CheckRecordId = checkRecord.Id,
                ItemType = ComplianceItemType.SeizureStatus,
                ItemName = "查封状态查询",
                ItemNameEn = "Seizure Status Check",
                Status = passed ? ComplianceCheckStatus.Passed : ComplianceCheckStatus.Failed,
                Passed = passed,
                Detail = passed ? "车辆未处于查封状态" : "车辆处于查封状态，查封机关：XX人民法院，日期2024-01",
                DurationMs = (int)sw.ElapsedMilliseconds,
                FailureReason = passed ? null : "车辆存在未解除的查封登记",
                FailureReasonEn = passed ? null : "Vehicle has unreleased seizure registration",
                SourceSystem = "SeizureApi",
                CreatedBy = 0
            };
            checkItems.Add(item);
            _context.ComplianceCheckItems.Add(item);
        }
        catch (OperationCanceledException)
        {
            CreateTimeoutItem(checkRecord, checkItems, ComplianceItemType.SeizureStatus, "查封状态查询", "Seizure Status Check", (int)sw.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            CreateExceptionItem(checkRecord, checkItems, ComplianceItemType.SeizureStatus, "查封状态查询", "Seizure Status Check", (int)sw.ElapsedMilliseconds, ex.Message);
        }
    }

    private async Task CheckAnnualInspectionAsync(Vehicle vehicle, ComplianceCheckRecord checkRecord, ConcurrentBag<ComplianceCheckItem> checkItems, CancellationToken token)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            await Task.Delay(Random.Shared.Next(100, 500), token);
            var passed = Random.Shared.Next(100) > 3;
            var item = new ComplianceCheckItem
            {
                CheckRecordId = checkRecord.Id,
                ItemType = ComplianceItemType.AnnualInspection,
                ItemName = "年检有效期校验",
                ItemNameEn = "Annual Inspection Validity Check",
                Status = passed ? ComplianceCheckStatus.Passed : ComplianceCheckStatus.Failed,
                Passed = passed,
                Detail = passed ? "年检有效期至2025年12月31日" : "年检已过期，有效期至2024年3月",
                DurationMs = (int)sw.ElapsedMilliseconds,
                FailureReason = passed ? null : "车辆年检已过期，请先完成年检",
                FailureReasonEn = passed ? null : "Annual inspection has expired, please complete inspection first",
                SourceSystem = "VehicleInfoApi",
                CreatedBy = 0
            };
            checkItems.Add(item);
            _context.ComplianceCheckItems.Add(item);
        }
        catch (OperationCanceledException)
        {
            CreateTimeoutItem(checkRecord, checkItems, ComplianceItemType.AnnualInspection, "年检有效期校验", "Annual Inspection Validity Check", (int)sw.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            CreateExceptionItem(checkRecord, checkItems, ComplianceItemType.AnnualInspection, "年检有效期校验", "Annual Inspection Validity Check", (int)sw.ElapsedMilliseconds, ex.Message);
        }
    }

    private async Task CheckInsuranceValidityAsync(Vehicle vehicle, ComplianceCheckRecord checkRecord, ConcurrentBag<ComplianceCheckItem> checkItems, CancellationToken token)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            await Task.Delay(Random.Shared.Next(100, 400), token);
            var passed = Random.Shared.Next(100) > 5;
            var item = new ComplianceCheckItem
            {
                CheckRecordId = checkRecord.Id,
                ItemType = ComplianceItemType.InsuranceValidity,
                ItemName = "保险有效期校验",
                ItemNameEn = "Insurance Validity Check",
                Status = passed ? ComplianceCheckStatus.Passed : ComplianceCheckStatus.Failed,
                Passed = passed,
                Detail = passed ? "交强险有效期至2025年8月15日，商业险有效期至2025年8月15日" : "交强险已过期",
                DurationMs = (int)sw.ElapsedMilliseconds,
                FailureReason = passed ? null : "车辆交强险已过期，请先投保",
                FailureReasonEn = passed ? null : "Compulsory insurance has expired, please insure first",
                SourceSystem = "InsuranceSystem",
                CreatedBy = 0
            };
            checkItems.Add(item);
            _context.ComplianceCheckItems.Add(item);
        }
        catch (OperationCanceledException)
        {
            CreateTimeoutItem(checkRecord, checkItems, ComplianceItemType.InsuranceValidity, "保险有效期校验", "Insurance Validity Check", (int)sw.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            CreateExceptionItem(checkRecord, checkItems, ComplianceItemType.InsuranceValidity, "保险有效期校验", "Insurance Validity Check", (int)sw.ElapsedMilliseconds, ex.Message);
        }
    }

    private async Task CheckModificationRecordAsync(Vehicle vehicle, ComplianceCheckRecord checkRecord, ConcurrentBag<ComplianceCheckItem> checkItems, CancellationToken token)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            await Task.Delay(Random.Shared.Next(80, 300), token);
            var hasIllegalMod = Random.Shared.Next(100) > 94;
            var passed = !hasIllegalMod;
            var item = new ComplianceCheckItem
            {
                CheckRecordId = checkRecord.Id,
                ItemType = ComplianceItemType.ModificationRecord,
                ItemName = "改装记录查询",
                ItemNameEn = "Modification Record Check",
                Status = passed ? ComplianceCheckStatus.Passed : ComplianceCheckStatus.Failed,
                Passed = passed,
                Detail = passed ? "未查询到违规改装记录" : "存在发动机非法改装记录，2023年9月查处",
                DurationMs = (int)sw.ElapsedMilliseconds,
                FailureReason = passed ? null : "存在非法改装记录，请先恢复原状并接受处理",
                FailureReasonEn = passed ? null : "Illegal modification records exist, please restore and handle",
                SourceSystem = "TrafficManagementSystem",
                CreatedBy = 0
            };
            checkItems.Add(item);
            _context.ComplianceCheckItems.Add(item);
        }
        catch (OperationCanceledException)
        {
            CreateTimeoutItem(checkRecord, checkItems, ComplianceItemType.ModificationRecord, "改装记录查询", "Modification Record Check", (int)sw.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            CreateExceptionItem(checkRecord, checkItems, ComplianceItemType.ModificationRecord, "改装记录查询", "Modification Record Check", (int)sw.ElapsedMilliseconds, ex.Message);
        }
    }

    private async Task CheckTheftRecordAsync(Vehicle vehicle, ComplianceCheckRecord checkRecord, ConcurrentBag<ComplianceCheckItem> checkItems, CancellationToken token)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            await SimulateExternalApiCallAsync(_externalApiSettings.VehicleInfoApi, token);
            var stolen = Random.Shared.Next(100) > 99;
            var passed = !stolen;
            var item = new ComplianceCheckItem
            {
                CheckRecordId = checkRecord.Id,
                ItemType = ComplianceItemType.TheftRecord,
                ItemName = "盗抢记录查询",
                ItemNameEn = "Theft Record Check",
                Status = passed ? ComplianceCheckStatus.Passed : ComplianceCheckStatus.Failed,
                Passed = passed,
                Detail = passed ? "未查询到盗抢记录" : "车辆处于被盗状态，立案日期2024年2月",
                DurationMs = (int)sw.ElapsedMilliseconds,
                FailureReason = passed ? null : "车辆被盗抢，禁止交易",
                FailureReasonEn = passed ? null : "Vehicle is reported stolen, transaction prohibited",
                SourceSystem = "PoliceVehicleInfoSystem",
                CreatedBy = 0
            };
            checkItems.Add(item);
            _context.ComplianceCheckItems.Add(item);
        }
        catch (OperationCanceledException)
        {
            CreateTimeoutItem(checkRecord, checkItems, ComplianceItemType.TheftRecord, "盗抢记录查询", "Theft Record Check", (int)sw.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            CreateExceptionItem(checkRecord, checkItems, ComplianceItemType.TheftRecord, "盗抢记录查询", "Theft Record Check", (int)sw.ElapsedMilliseconds, ex.Message);
        }
    }

    private async Task CheckTaxArrearsAsync(Vehicle vehicle, ComplianceCheckRecord checkRecord, ConcurrentBag<ComplianceCheckItem> checkItems, CancellationToken token)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            await SimulateExternalApiCallAsync(_externalApiSettings.TaxApi, token);
            var hasArrears = Random.Shared.Next(100) > 90;
            var passed = !hasArrears;
            var item = new ComplianceCheckItem
            {
                CheckRecordId = checkRecord.Id,
                ItemType = ComplianceItemType.TaxArrears,
                ItemName = "税费欠缴查询",
                ItemNameEn = "Tax Arrears Check",
                Status = passed ? ComplianceCheckStatus.Passed : ComplianceCheckStatus.Failed,
                Passed = passed,
                Detail = passed ? "未查询到税费欠缴记录" : "存在车船税欠缴，金额1800元，滞纳期120天",
                DurationMs = (int)sw.ElapsedMilliseconds,
                FailureReason = passed ? null : "存在车船税欠缴，请先补缴",
                FailureReasonEn = passed ? null : "Vehicle tax arrears exist, please pay first",
                SourceSystem = "TaxApi",
                CreatedBy = 0
            };
            checkItems.Add(item);
            _context.ComplianceCheckItems.Add(item);
        }
        catch (OperationCanceledException)
        {
            CreateTimeoutItem(checkRecord, checkItems, ComplianceItemType.TaxArrears, "税费欠缴查询", "Tax Arrears Check", (int)sw.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            CreateExceptionItem(checkRecord, checkItems, ComplianceItemType.TaxArrears, "税费欠缴查询", "Tax Arrears Check", (int)sw.ElapsedMilliseconds, ex.Message);
        }
    }

    private async Task CheckScrapRecordAsync(Vehicle vehicle, ComplianceCheckRecord checkRecord, ConcurrentBag<ComplianceCheckItem> checkItems, CancellationToken token)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            await Task.Delay(Random.Shared.Next(50, 200), token);
            var toBeScrapped = Random.Shared.Next(100) > 97;
            var passed = !toBeScrapped;
            var item = new ComplianceCheckItem
            {
                CheckRecordId = checkRecord.Id,
                ItemType = ComplianceItemType.ScrapRecord,
                ItemName = "报废状态查询",
                ItemNameEn = "Scrap Status Check",
                Status = passed ? ComplianceCheckStatus.Passed : ComplianceCheckStatus.Failed,
                Passed = passed,
                Detail = passed ? "车辆未达到强制报废标准" : "车辆已达到强制报废年限",
                DurationMs = (int)sw.ElapsedMilliseconds,
                FailureReason = passed ? null : "车辆已达到强制报废标准",
                FailureReasonEn = passed ? null : "Vehicle has reached mandatory scrap standard",
                SourceSystem = "TrafficManagementSystem",
                CreatedBy = 0
            };
            checkItems.Add(item);
            _context.ComplianceCheckItems.Add(item);
        }
        catch (OperationCanceledException)
        {
            CreateTimeoutItem(checkRecord, checkItems, ComplianceItemType.ScrapRecord, "报废状态查询", "Scrap Status Check", (int)sw.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            CreateExceptionItem(checkRecord, checkItems, ComplianceItemType.ScrapRecord, "报废状态查询", "Scrap Status Check", (int)sw.ElapsedMilliseconds, ex.Message);
        }
    }

    private async Task CheckEngineNumberMatchAsync(Vehicle vehicle, ComplianceCheckRecord checkRecord, ConcurrentBag<ComplianceCheckItem> checkItems, CancellationToken token)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            await Task.Delay(Random.Shared.Next(30, 150), token);
            var passed = Random.Shared.Next(100) > 2;
            var item = new ComplianceCheckItem
            {
                CheckRecordId = checkRecord.Id,
                ItemType = ComplianceItemType.EngineNumberMatch,
                ItemName = "发动机号码匹配",
                ItemNameEn = "Engine Number Match Check",
                Status = passed ? ComplianceCheckStatus.Passed : ComplianceCheckStatus.Failed,
                Passed = passed,
                Detail = passed ? "发动机号与登记信息一致" : "发动机号与登记信息不一致",
                DurationMs = (int)sw.ElapsedMilliseconds,
                FailureReason = passed ? null : "发动机号码与车辆登记信息不匹配",
                FailureReasonEn = passed ? null : "Engine number does not match registration information",
                SourceSystem = "LocalVerification",
                CreatedBy = 0
            };
            checkItems.Add(item);
            _context.ComplianceCheckItems.Add(item);
        }
        catch (OperationCanceledException)
        {
            CreateTimeoutItem(checkRecord, checkItems, ComplianceItemType.EngineNumberMatch, "发动机号码匹配", "Engine Number Match Check", (int)sw.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            CreateExceptionItem(checkRecord, checkItems, ComplianceItemType.EngineNumberMatch, "发动机号码匹配", "Engine Number Match Check", (int)sw.ElapsedMilliseconds, ex.Message);
        }
    }

    private async Task CheckFrameNumberMatchAsync(Vehicle vehicle, ComplianceCheckRecord checkRecord, ConcurrentBag<ComplianceCheckItem> checkItems, CancellationToken token)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            await Task.Delay(Random.Shared.Next(30, 150), token);
            var passed = Random.Shared.Next(100) > 2;
            var item = new ComplianceCheckItem
            {
                CheckRecordId = checkRecord.Id,
                ItemType = ComplianceItemType.FrameNumberMatch,
                ItemName = "车架号码匹配",
                ItemNameEn = "Frame Number Match Check",
                Status = passed ? ComplianceCheckStatus.Passed : ComplianceCheckStatus.Failed,
                Passed = passed,
                Detail = passed ? "车架号与登记信息一致" : "车架号与登记信息不一致",
                DurationMs = (int)sw.ElapsedMilliseconds,
                FailureReason = passed ? null : "车架号码与车辆登记信息不匹配",
                FailureReasonEn = passed ? null : "Frame number does not match registration information",
                SourceSystem = "LocalVerification",
                CreatedBy = 0
            };
            checkItems.Add(item);
            _context.ComplianceCheckItems.Add(item);
        }
        catch (OperationCanceledException)
        {
            CreateTimeoutItem(checkRecord, checkItems, ComplianceItemType.FrameNumberMatch, "车架号码匹配", "Frame Number Match Check", (int)sw.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            CreateExceptionItem(checkRecord, checkItems, ComplianceItemType.FrameNumberMatch, "车架号码匹配", "Frame Number Match Check", (int)sw.ElapsedMilliseconds, ex.Message);
        }
    }

    private void CreateTimeoutItem(ComplianceCheckRecord checkRecord, ConcurrentBag<ComplianceCheckItem> checkItems, ComplianceItemType itemType, string itemName, string itemNameEn, int durationMs)
    {
        var item = new ComplianceCheckItem
        {
            CheckRecordId = checkRecord.Id,
            ItemType = itemType,
            ItemName = itemName,
            ItemNameEn = itemNameEn,
            Status = ComplianceCheckStatus.Timeout,
            Passed = false,
            DurationMs = durationMs,
            FailureReason = "校验超时",
            FailureReasonEn = "Check timed out",
            CreatedBy = 0
        };
        checkItems.Add(item);
        _context.ComplianceCheckItems.Add(item);
    }

    private void CreateExceptionItem(ComplianceCheckRecord checkRecord, ConcurrentBag<ComplianceCheckItem> checkItems, ComplianceItemType itemType, string itemName, string itemNameEn, int durationMs, string errorMsg)
    {
        var item = new ComplianceCheckItem
        {
            CheckRecordId = checkRecord.Id,
            ItemType = itemType,
            ItemName = itemName,
            ItemNameEn = itemNameEn,
            Status = ComplianceCheckStatus.Exception,
            Passed = false,
            DurationMs = durationMs,
            FailureReason = $"校验异常：{errorMsg}",
            FailureReasonEn = $"Check exception: {errorMsg}",
            CreatedBy = 0
        };
        checkItems.Add(item);
        _context.ComplianceCheckItems.Add(item);
    }

    private static async Task SimulateExternalApiCallAsync(ExternalApiConfig config, CancellationToken token)
    {
        var delay = Random.Shared.Next(Math.Max(50, config.TimeoutMs / 6), Math.Min(config.TimeoutMs, 700));
        await Task.Delay(delay, token);
    }

    public async Task<ApiResponse<ComplianceCheckRecordDto>> GetRecordByIdAsync(long recordId)
    {
        var record = await _context.ComplianceCheckRecords
            .AsNoTracking()
            .Include(c => c.CheckItems)
            .FirstOrDefaultAsync(c => c.Id == recordId);

        if (record == null)
        {
            return ApiResponse<ComplianceCheckRecordDto>.Fail(ErrorCodes.NotFound.Code, "合规校验记录不存在", "Compliance check record not found");
        }

        var result = _mapper.Map<ComplianceCheckRecordDto>(record);
        return ApiResponse<ComplianceCheckRecordDto>.Success(result);
    }

    public async Task<ApiResponse<PagedResult<ComplianceCheckRecordDto>>> GetRecordsByVehicleIdAsync(long vehicleId, int pageIndex = 1, int pageSize = 20)
    {
        var query = _context.ComplianceCheckRecords
            .AsNoTracking()
            .Where(c => c.VehicleId == vehicleId);

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(c => c.CheckTime)
            .Skip((pageIndex - 1) * pageSize)
            .Take(pageSize)
            .ProjectTo<ComplianceCheckRecordDto>(_mapper.ConfigurationProvider)
            .ToListAsync();

        var result = new PagedResult<ComplianceCheckRecordDto>
        {
            Items = items,
            TotalCount = totalCount,
            PageIndex = pageIndex,
            PageSize = pageSize
        };
        return ApiResponse<PagedResult<ComplianceCheckRecordDto>>.Success(result);
    }

    public async Task<ApiResponse<ComplianceCheckResultDto>> ManualReviewAsync(ComplianceReviewDto dto, long operatorId)
    {
        var record = await _context.ComplianceCheckRecords.FindAsync(dto.RecordId);
        if (record == null)
        {
            return ApiResponse<ComplianceCheckResultDto>.Fail(ErrorCodes.NotFound.Code, "合规校验记录不存在", "Compliance check record not found");
        }

        if (record.IsManualReviewed)
        {
            return ApiResponse<ComplianceCheckResultDto>.Fail(ErrorCodes.BadRequest.Code, "该记录已完成人工复核", "Record already reviewed");
        }

        record.IsManualReviewed = true;
        record.ReviewResult = dto.Result;
        record.ReviewedBy = operatorId;
        record.ReviewedAt = DateTime.UtcNow;
        record.ReviewRemark = dto.Remark;
        record.UpdatedBy = operatorId;

        var vehicle = await _context.Vehicles.FindAsync(record.VehicleId);
        if (vehicle != null)
        {
            vehicle.Status = dto.Result == Enums.ReviewResult.Approved
                ? VehicleStatus.CompliancePassed
                : VehicleStatus.Rejected;
            vehicle.UpdatedBy = operatorId;

            if (dto.Result == Enums.ReviewResult.Rejected)
            {
                await _context.ExceptionCases.AddAsync(new ExceptionCase
                {
                    CaseNo = $"EX{DateTime.Now:yyyyMMddHHmmss}{Random.Shared.Next(100, 999)}",
                    CaseType = ExceptionCaseType.Other,
                    CaseTypeName = "合规审核驳回",
                    VehicleId = vehicle.Id,
                    Title = $"车辆VIN:{vehicle.Vin}合规复核未通过",
                    Description = dto.Remark ?? "合规复核被驳回",
                    Status = ExceptionCaseStatus.UnderInvestigation,
                    SourceModule = "ComplianceReview",
                    Priority = 2,
                    CreatedBy = operatorId
                });
            }
        }

        await _context.SaveChangesAsync();

        record.CheckItems = await _context.ComplianceCheckItems
            .AsNoTracking()
            .Where(i => i.CheckRecordId == record.Id)
            .ToListAsync();

        var result = _mapper.Map<ComplianceCheckResultDto>(record);
        var msg = dto.Result == Enums.ReviewResult.Approved ? "人工复核通过" : "人工复核驳回";
        var msgEn = dto.Result == Enums.ReviewResult.Approved ? "Manual review approved" : "Manual review rejected";
        return ApiResponse<ComplianceCheckResultDto>.Success(result, msg, msgEn);
    }

    public async Task<ApiResponse<ComplianceCheckResultDto>> ExceptionApprovalAsync(ComplianceExceptionApprovalDto dto, long operatorId)
    {
        var record = await _context.ComplianceCheckRecords.FindAsync(dto.RecordId);
        if (record == null)
        {
            return ApiResponse<ComplianceCheckResultDto>.Fail(ErrorCodes.NotFound.Code, "合规校验记录不存在", "Compliance check record not found");
        }

        record.HasExceptionApproval = true;
        record.ApprovedBy = operatorId;
        record.ApprovedAt = DateTime.UtcNow;
        record.ApprovalRemark = dto.ApprovalRemark;
        record.UpdatedBy = operatorId;
        record.OverallStatus = ComplianceCheckStatus.Passed;

        var vehicle = await _context.Vehicles.FindAsync(record.VehicleId);
        if (vehicle != null)
        {
            vehicle.Status = VehicleStatus.CompliancePassed;
            vehicle.UpdatedBy = operatorId;
        }

        await _context.SaveChangesAsync();

        record.CheckItems = await _context.ComplianceCheckItems
            .AsNoTracking()
            .Where(i => i.CheckRecordId == record.Id)
            .ToListAsync();

        var result = _mapper.Map<ComplianceCheckResultDto>(record);
        return ApiResponse<ComplianceCheckResultDto>.Success(result, "例外审批通过，准予准入", "Exception approved, access granted");
    }
}
