using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using AutoMapper;
using AutoMapper.QueryableExtensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using UsedVehicleTransaction.Common;
using UsedVehicleTransaction.Data;
using UsedVehicleTransaction.DTOs;
using UsedVehicleTransaction.Enums;
using UsedVehicleTransaction.Models;

namespace UsedVehicleTransaction.Services;

public class ArchiveService : IArchiveService
{
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly IMemoryCache _cache;
    private readonly AppSettings _appSettings;
    private readonly ILogger<ArchiveService> _logger;

    public ArchiveService(
        ApplicationDbContext context,
        IMapper mapper,
        IMemoryCache cache,
        IOptions<AppSettings> appSettings,
        ILogger<ArchiveService> logger)
    {
        _context = context;
        _mapper = mapper;
        _cache = cache;
        _appSettings = appSettings.Value;
        _logger = logger;
    }

    public async Task<ApiResponse<ArchiveFileDto>> UploadAsync(ArchiveUploadDto dto, long operatorId)
    {
        _logger.LogInformation("Uploading archive file: Type={ArchiveType}, TransactionId={TransactionId}, VehicleId={VehicleId}",
            dto.ArchiveType, dto.TransactionId, dto.VehicleId);

        var validation = ValidateFile(dto.File);
        if (!validation.IsValid)
        {
            return ApiResponse<ArchiveFileDto>.Fail(validation.ErrorCode!.Value, validation.MessageZh!, validation.MessageEn!);
        }

        if (dto.TransactionId.HasValue)
        {
            var tx = await _context.VehicleTransactions.FindAsync(dto.TransactionId.Value);
            if (tx == null)
            {
                return ApiResponse<ArchiveFileDto>.Fail(ErrorCodes.TransactionNotFound.Code, ErrorCodes.TransactionNotFound.MessageZh, ErrorCodes.TransactionNotFound.MessageEn);
            }
        }

        if (dto.VehicleId.HasValue)
        {
            var v = await _context.Vehicles.FindAsync(dto.VehicleId.Value);
            if (v == null)
            {
                return ApiResponse<ArchiveFileDto>.Fail(ErrorCodes.VehicleNotFound.Code, ErrorCodes.VehicleNotFound.MessageZh, ErrorCodes.VehicleNotFound.MessageEn);
            }
        }

        var savedFile = await SaveFileInternalAsync(dto.File, dto.TransactionId, dto.VehicleId, dto.ArchiveType, dto.Description, dto.SortOrder, operatorId);
        var result = _mapper.Map<ArchiveFileDto>(savedFile);

        return ApiResponse<ArchiveFileDto>.Success(result, "档案上传成功", "Archive uploaded successfully");
    }

    public async Task<ApiResponse<List<ArchiveFileDto>>> BatchUploadAsync(ArchiveBatchUploadDto dto, long operatorId)
    {
        _logger.LogInformation("Batch uploading archives: Count={Count}, TransactionId={TransactionId}", dto.Items.Count, dto.TransactionId);

        var results = new List<ArchiveFileDto>();
        foreach (var item in dto.Items)
        {
            var validation = ValidateFile(item.File);
            if (!validation.IsValid)
            {
                return ApiResponse<List<ArchiveFileDto>>.Fail(validation.ErrorCode!.Value, validation.MessageZh!, validation.MessageEn!);
            }
        }

        foreach (var item in dto.Items)
        {
            var savedFile = await SaveFileInternalAsync(item.File, dto.TransactionId, dto.VehicleId, item.ArchiveType, item.Description, item.SortOrder, operatorId);
            results.Add(_mapper.Map<ArchiveFileDto>(savedFile));
        }

        return ApiResponse<List<ArchiveFileDto>>.Success(results, $"批量上传成功，共{results.Count}个文件", $"Batch upload succeeded, {results.Count} files total");
    }

    private async Task<ArchiveFile> SaveFileInternalAsync(
        IFormFile file,
        long? transactionId,
        long? vehicleId,
        ArchiveType archiveType,
        string? description,
        int sortOrder,
        long operatorId)
    {
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var archiveTypeName = GetArchiveTypeName(archiveType);
        var fileHash = await ComputeFileHashAsync(file);

        var dateStr = DateTime.Now.ToString("yyyyMM");
        var storageDir = Path.Combine(_appSettings.FileStoragePath, dateStr);
        Directory.CreateDirectory(storageDir);

        var uniqueFileName = $"{DateTime.Now:yyyyMMddHHmmss}_{Guid.NewGuid():N}{extension}";
        var fullPath = Path.Combine(storageDir, uniqueFileName);

        using (var stream = new FileStream(fullPath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var archiveFile = new ArchiveFile
        {
            TransactionId = transactionId,
            VehicleId = vehicleId,
            ArchiveType = archiveType,
            ArchiveTypeName = archiveTypeName,
            FileName = uniqueFileName,
            OriginalFileName = file.FileName,
            FilePath = fullPath,
            FileSize = file.Length,
            ContentType = file.ContentType,
            FileExtension = extension,
            FileHash = fileHash,
            SortOrder = sortOrder,
            Description = description,
            CreatedBy = operatorId
        };

        _context.ArchiveFiles.Add(archiveFile);
        await _context.SaveChangesAsync();

        return archiveFile;
    }

    private static async Task<string> ComputeFileHashAsync(IFormFile file)
    {
        using var sha256 = SHA256.Create();
        using var stream = file.OpenReadStream();
        var hashBytes = await sha256.ComputeHashAsync(stream);
        return Convert.ToBase64String(hashBytes);
    }

    private (bool IsValid, int? ErrorCode, string? MessageZh, string? MessageEn) ValidateFile(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return (false, ErrorCodes.FileUploadFailed.Code, "文件不能为空", "File cannot be empty");
        }

        var maxSizeBytes = _appSettings.MaxFileSizeMB * 1024 * 1024;
        if (file.Length > maxSizeBytes)
        {
            return (false, ErrorCodes.FileTooLarge.Code,
                $"文件大小超过限制（最大{_appSettings.MaxFileSizeMB}MB）",
                $"File size exceeds limit (max {_appSettings.MaxFileSizeMB}MB)");
        }

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!_appSettings.AllowedFileExtensions.Contains(extension))
        {
            return (false, ErrorCodes.InvalidFileType.Code,
                $"不支持的文件类型，支持类型：{string.Join(",", _appSettings.AllowedFileExtensions)}",
                $"Unsupported file type. Allowed: {string.Join(",", _appSettings.AllowedFileExtensions)}");
        }

        return (true, null, null, null);
    }

    private static string GetArchiveTypeName(ArchiveType type) => type switch
    {
        ArchiveType.VehicleCertificate => "车辆登记证书",
        ArchiveType.DrivingLicense => "行驶证",
        ArchiveType.IdentificationCard => "身份证件",
        ArchiveType.InspectionReport => "鉴定报告",
        ArchiveType.TransactionContract => "交易合同",
        ArchiveType.TaxReceipt => "税费凭证",
        ArchiveType.InsuranceDocument => "保险单据",
        _ => "其他材料"
    };

    public async Task<ApiResponse<PagedResult<ArchiveFileDto>>> SearchAsync(ArchiveSearchDto dto)
    {
        using var cts = new CancellationTokenSource(_appSettings.ArchiveSearchTimeoutMs);

        var query = _context.ArchiveFiles.AsNoTracking();

        if (dto.TransactionId.HasValue)
            query = query.Where(a => a.TransactionId == dto.TransactionId.Value);

        if (dto.VehicleId.HasValue)
            query = query.Where(a => a.VehicleId == dto.VehicleId.Value);

        if (!string.IsNullOrWhiteSpace(dto.Vin))
        {
            query = query.Where(a => _context.Vehicles.Any(v => v.Id == a.VehicleId && v.Vin == dto.Vin));
        }

        if (!string.IsNullOrWhiteSpace(dto.BuyerName))
        {
            query = query.Where(a => _context.VehicleTransactions.Any(t => t.Id == a.TransactionId && t.BuyerName.Contains(dto.BuyerName)));
        }

        if (dto.ArchiveType.HasValue)
            query = query.Where(a => a.ArchiveType == dto.ArchiveType.Value);

        if (dto.StartDate.HasValue)
            query = query.Where(a => a.CreatedAt >= dto.StartDate.Value);

        if (dto.EndDate.HasValue)
            query = query.Where(a => a.CreatedAt <= dto.EndDate.Value);

        if (!string.IsNullOrWhiteSpace(dto.Keyword))
        {
            var kw = dto.Keyword.Trim();
            query = query.Where(a =>
                (a.OcrProcessed && a.OcrText != null && a.OcrText.Contains(kw)) ||
                (a.Keywords != null && a.Keywords.Contains(kw)) ||
                a.OriginalFileName.Contains(kw) ||
                a.ArchiveTypeName.Contains(kw) ||
                (a.Description != null && a.Description.Contains(kw)));
        }

        var totalCount = await query.CountAsync(cts.Token);

        var sortField = string.IsNullOrWhiteSpace(dto.SortField) ? "CreatedAt" : dto.SortField;
        query = dto.SortOrder.ToLower() == "asc"
            ? OrderByDynamic(query, sortField, true)
            : OrderByDynamic(query, sortField, false);

        var items = await query
            .Skip((dto.PageIndex - 1) * dto.PageSize)
            .Take(dto.PageSize)
            .ProjectTo<ArchiveFileDto>(_mapper.ConfigurationProvider)
            .ToListAsync(cts.Token);

        var result = new PagedResult<ArchiveFileDto>
        {
            Items = items,
            TotalCount = totalCount,
            PageIndex = dto.PageIndex,
            PageSize = dto.PageSize
        };

        return ApiResponse<PagedResult<ArchiveFileDto>>.Success(result);
    }

    public async Task<ApiResponse<ArchiveFileDto>> GetByIdAsync(long id)
    {
        var file = await _context.ArchiveFiles
            .AsNoTracking()
            .ProjectTo<ArchiveFileDto>(_mapper.ConfigurationProvider)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (file == null)
        {
            return ApiResponse<ArchiveFileDto>.Fail(ErrorCodes.ArchiveNotFound.Code, ErrorCodes.ArchiveNotFound.MessageZh, ErrorCodes.ArchiveNotFound.MessageEn);
        }

        return ApiResponse<ArchiveFileDto>.Success(file);
    }

    public async Task<ApiResponse<bool>> DeleteAsync(long id, long operatorId)
    {
        var file = await _context.ArchiveFiles.FindAsync(id);
        if (file == null)
        {
            return ApiResponse<bool>.Fail(ErrorCodes.ArchiveNotFound.Code, ErrorCodes.ArchiveNotFound.MessageZh, ErrorCodes.ArchiveNotFound.MessageEn);
        }

        file.IsDeleted = true;
        file.DeletedAt = DateTime.UtcNow;
        file.DeletedBy = operatorId;
        await _context.SaveChangesAsync();

        try
        {
            if (File.Exists(file.FilePath))
            {
                File.Delete(file.FilePath);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to delete physical file: {Path}", file.FilePath);
        }

        return ApiResponse<bool>.Success(true, "档案删除成功", "Archive deleted successfully");
    }

    public async Task<ApiResponse<List<ArchiveFileDto>>> GetByTransactionIdAsync(long transactionId)
    {
        var files = await _context.ArchiveFiles
            .AsNoTracking()
            .Where(a => a.TransactionId == transactionId)
            .OrderBy(a => a.SortOrder)
            .ThenBy(a => a.CreatedAt)
            .ProjectTo<ArchiveFileDto>(_mapper.ConfigurationProvider)
            .ToListAsync();

        return ApiResponse<List<ArchiveFileDto>>.Success(files);
    }

    public async Task<ApiResponse<List<ArchiveFileDto>>> GetByVehicleIdAsync(long vehicleId)
    {
        var files = await _context.ArchiveFiles
            .AsNoTracking()
            .Where(a => a.VehicleId == vehicleId)
            .OrderBy(a => a.SortOrder)
            .ThenBy(a => a.CreatedAt)
            .ProjectTo<ArchiveFileDto>(_mapper.ConfigurationProvider)
            .ToListAsync();

        return ApiResponse<List<ArchiveFileDto>>.Success(files);
    }

    public async Task<ApiResponse<OcrResultDto>> ProcessOcrAsync(long archiveId, long operatorId)
    {
        _logger.LogInformation("Processing OCR for ArchiveId: {ArchiveId}", archiveId);

        var file = await _context.ArchiveFiles.FindAsync(archiveId);
        if (file == null)
        {
            return ApiResponse<OcrResultDto>.Fail(ErrorCodes.ArchiveNotFound.Code, ErrorCodes.ArchiveNotFound.MessageZh, ErrorCodes.ArchiveNotFound.MessageEn);
        }

        var simulatedOcrText = SimulateOcr(file);
        var keywords = ExtractKeywords(simulatedOcrText);

        file.OcrProcessed = true;
        file.OcrText = simulatedOcrText;
        file.Keywords = string.Join(",", keywords);
        file.UpdatedBy = operatorId;

        await _context.SaveChangesAsync();

        var result = new OcrResultDto
        {
            ArchiveId = archiveId,
            Success = true,
            OcrText = simulatedOcrText,
            Keywords = keywords
        };

        return ApiResponse<OcrResultDto>.Success(result, "OCR识别完成", "OCR processing completed");
    }

    private static string SimulateOcr(ArchiveFile file)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"文件名称：{file.OriginalFileName}");
        sb.AppendLine($"材料类型：{file.ArchiveTypeName}");

        switch (file.ArchiveType)
        {
            case ArchiveType.VehicleCertificate:
                sb.AppendLine("机动车登记证书");
                sb.AppendLine("车辆识别代号/车架号：LSVAU2180N2123456");
                sb.AppendLine("发动机号：1234567");
                sb.AppendLine("车辆品牌：大众汽车牌");
                sb.AppendLine("车辆型号：SVW71810BU");
                sb.AppendLine("车身颜色：黑色");
                sb.AppendLine("排量/功率：1798ml/118kw");
                sb.AppendLine("制造厂名称：上汽大众汽车有限公司");
                sb.AppendLine("发证日期：2022-03-15");
                break;
            case ArchiveType.DrivingLicense:
                sb.AppendLine("机动车行驶证");
                sb.AppendLine("号牌号码：京A12345");
                sb.AppendLine("车辆类型：小型轿车");
                sb.AppendLine("所有人：张三");
                sb.AppendLine("住址：北京市朝阳区XX街道XX号");
                sb.AppendLine("使用性质：非营运");
                sb.AppendLine("品牌型号：大众汽车牌SVW71810BU");
                sb.AppendLine("车辆识别代号：LSVAU2180N2123456");
                sb.AppendLine("发动机号码：1234567");
                sb.AppendLine("注册日期：2022-03-20");
                sb.AppendLine("发证日期：2022-03-20");
                break;
            case ArchiveType.InspectionReport:
                sb.AppendLine("二手车技术状况鉴定报告");
                sb.AppendLine("综合得分：88.50分");
                sb.AppendLine("综合评级：良好");
                sb.AppendLine("发动机得分：9.2");
                sb.AppendLine("底盘得分：8.5");
                sb.AppendLine("车身得分：8.8");
                sb.AppendLine("电气得分：9.0");
                sb.AppendLine("路试得分：8.6");
                break;
            case ArchiveType.TransactionContract:
                sb.AppendLine("二手车交易合同");
                sb.AppendLine("卖方：张三");
                sb.AppendLine("买方：李四");
                sb.AppendLine("车辆VIN：LSVAU2180N2123456");
                sb.AppendLine("车牌号：京A12345");
                sb.AppendLine("交易价格：人民币128000元整");
                sb.AppendLine("签订日期：2024-05-10");
                break;
            default:
                sb.AppendLine($"文档内容：{file.Description ?? "已扫描归档的文档材料"}");
                break;
        }

        return sb.ToString().Trim();
    }

    private static List<string> ExtractKeywords(string text)
    {
        var keywords = new HashSet<string>();
        var vinMatch = Regex.Match(text, @"[A-HJ-NPR-Z0-9]{17}");
        if (vinMatch.Success) keywords.Add(vinMatch.Value);

        var plateMatch = Regex.Match(text, @"[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领][A-Z][A-HJ-NP-Z0-9]{5,6}");
        if (plateMatch.Success) keywords.Add(plateMatch.Value);

        var idMatch = Regex.Matches(text, @"[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]");
        foreach (Match m in idMatch.Take(2)) if (m.Success) keywords.Add(m.Value);

        var nameMatches = new[] { "张三", "李四", "王五", "赵六" };
        foreach (var name in nameMatches)
        {
            if (text.Contains(name)) keywords.Add(name);
        }

        var dateMatches = Regex.Matches(text, @"\d{4}[-/年]\d{1,2}[-/月]\d{1,2}");
        foreach (Match m in dateMatches.Take(2)) if (m.Success) keywords.Add(m.Value.Replace("年", "-").Replace("月", "-"));

        var priceMatch = Regex.Match(text, @"(\d{4,6}(?:\.\d{1,2})?)元");
        if (priceMatch.Success) keywords.Add(priceMatch.Groups[1].Value);

        return keywords.Take(20).ToList();
    }

    public async Task<ApiResponse<(string FilePath, string FileName)>> DownloadAsync(long archiveId)
    {
        var file = await _context.ArchiveFiles.FindAsync(archiveId);
        if (file == null)
        {
            return ApiResponse<(string, string)>.Fail(ErrorCodes.ArchiveNotFound.Code, ErrorCodes.ArchiveNotFound.MessageZh, ErrorCodes.ArchiveNotFound.MessageEn);
        }

        if (!File.Exists(file.FilePath))
        {
            return ApiResponse<(string, string)>.Fail(ErrorCodes.ArchiveNotFound.Code, "文件不存在或已被删除", "File not found or deleted");
        }

        return ApiResponse<(string, string)>.Success((file.FilePath, file.OriginalFileName));
    }

    private static IQueryable<ArchiveFile> OrderByDynamic(IQueryable<ArchiveFile> source, string propertyName, bool ascending)
    {
        var param = System.Linq.Expressions.Expression.Parameter(typeof(ArchiveFile), "a");
        var property = typeof(ArchiveFile).GetProperty(propertyName);
        if (property == null) return ascending ? source.OrderBy(a => a.CreatedAt) : source.OrderByDescending(a => a.CreatedAt);

        var propertyAccess = System.Linq.Expressions.Expression.MakeMemberAccess(param, property);
        var orderByExpression = System.Linq.Expressions.Expression.Lambda(propertyAccess, param);
        var methodName = ascending ? "OrderBy" : "OrderByDescending";
        var resultExpression = System.Linq.Expressions.Expression.Call(
            typeof(Queryable),
            methodName,
            new[] { typeof(ArchiveFile), property.PropertyType },
            source.Expression,
            System.Linq.Expressions.Expression.Quote(orderByExpression));
        return source.Provider.CreateQuery<ArchiveFile>(resultExpression);
    }
}
