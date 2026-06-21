using System.Globalization;
using System.Security.Cryptography;
using System.Text;
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

public class InspectionService : IInspectionService
{
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly IMemoryCache _cache;
    private readonly AppSettings _appSettings;
    private readonly ILogger<InspectionService> _logger;

    public InspectionService(
        ApplicationDbContext context,
        IMapper mapper,
        IMemoryCache cache,
        IOptions<AppSettings> appSettings,
        ILogger<InspectionService> logger)
    {
        _context = context;
        _mapper = mapper;
        _cache = cache;
        _appSettings = appSettings.Value;
        _logger = logger;
    }

    public async Task<ApiResponse<InspectionOrderDto>> CreateOrderAsync(InspectionOrderCreateDto dto, long operatorId)
    {
        _logger.LogInformation("Creating inspection order for VehicleId: {VehicleId}", dto.VehicleId);

        var vehicle = await _context.Vehicles.FindAsync(dto.VehicleId);
        if (vehicle == null)
        {
            return ApiResponse<InspectionOrderDto>.Fail(ErrorCodes.VehicleNotFound.Code, ErrorCodes.VehicleNotFound.MessageZh, ErrorCodes.VehicleNotFound.MessageEn);
        }

        if (vehicle.Status != VehicleStatus.CompliancePassed)
        {
            return ApiResponse<InspectionOrderDto>.Fail(ErrorCodes.BadRequest.Code,
                $"车辆状态为{vehicle.Status}，不满足创建鉴定工单的条件（需先通过合规校验）",
                $"Vehicle status is {vehicle.Status}, not eligible for inspection (must pass compliance check first)");
        }

        var existingActive = await _context.InspectionOrders
            .AsNoTracking()
            .AnyAsync(o => o.VehicleId == dto.VehicleId &&
                (o.Status == InspectionStatus.Created ||
                 o.Status == InspectionStatus.Assigned ||
                 o.Status == InspectionStatus.InProgress));

        if (existingActive)
        {
            return ApiResponse<InspectionOrderDto>.Fail(ErrorCodes.BadRequest.Code,
                "该车辆已存在进行中的鉴定工单",
                "An active inspection order already exists for this vehicle");
        }

        var orderNo = $"IO{DateTime.Now:yyyyMMddHHmmss}{Random.Shared.Next(1000, 9999)}";

        var order = _mapper.Map<InspectionOrder>(dto);
        order.OrderNo = orderNo;
        order.Status = InspectionStatus.Assigned;
        order.CreatedBy = operatorId;

        _context.InspectionOrders.Add(order);

        vehicle.Status = VehicleStatus.UnderInspection;
        vehicle.UpdatedBy = operatorId;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Inspection order created: {OrderNo}, Id: {Id}", orderNo, order.Id);
        var result = _mapper.Map<InspectionOrderDto>(order);
        return ApiResponse<InspectionOrderDto>.Success(result, "鉴定工单创建成功", "Inspection order created successfully");
    }

    public async Task<ApiResponse<InspectionOrderDto>> StartInspectionAsync(long orderId, long inspectorId)
    {
        var order = await _context.InspectionOrders.FindAsync(orderId);
        if (order == null)
        {
            return ApiResponse<InspectionOrderDto>.Fail(ErrorCodes.InspectionNotFound.Code, ErrorCodes.InspectionNotFound.MessageZh, ErrorCodes.InspectionNotFound.MessageEn);
        }

        if (order.Status != InspectionStatus.Assigned)
        {
            return ApiResponse<InspectionOrderDto>.Fail(ErrorCodes.InspectionInvalidStatus.Code, ErrorCodes.InspectionInvalidStatus.MessageZh, ErrorCodes.InspectionInvalidStatus.MessageEn);
        }

        if (order.InspectorId != inspectorId)
        {
            return ApiResponse<InspectionOrderDto>.Fail(ErrorCodes.Forbidden.Code, "无权操作此鉴定工单", "No permission to operate this inspection order");
        }

        order.Status = InspectionStatus.InProgress;
        order.StartTime = DateTime.UtcNow;
        order.UpdatedBy = inspectorId;

        await _context.SaveChangesAsync();

        var result = _mapper.Map<InspectionOrderDto>(order);
        return ApiResponse<InspectionOrderDto>.Success(result, "鉴定工作已开始", "Inspection started");
    }

    public async Task<ApiResponse<InspectionOrderDetailDto>> SubmitInspectionAsync(InspectionSubmitDto dto, long operatorId)
    {
        _logger.LogInformation("Submitting inspection for OrderId: {OrderId}", dto.OrderId);

        var order = await _context.InspectionOrders
            .Include(o => o.ItemResults)
            .FirstOrDefaultAsync(o => o.Id == dto.OrderId);

        if (order == null)
        {
            return ApiResponse<InspectionOrderDetailDto>.Fail(ErrorCodes.InspectionNotFound.Code, ErrorCodes.InspectionNotFound.MessageZh, ErrorCodes.InspectionNotFound.MessageEn);
        }

        if (order.Status != InspectionStatus.InProgress)
        {
            return ApiResponse<InspectionOrderDetailDto>.Fail(ErrorCodes.InspectionInvalidStatus.Code, ErrorCodes.InspectionInvalidStatus.MessageZh, ErrorCodes.InspectionInvalidStatus.MessageEn);
        }

        using var cts = new CancellationTokenSource(_appSettings.InspectionReportTimeoutMs);

        var itemLibrary = await _context.InspectionItemLibrary
            .AsNoTracking()
            .Where(i => i.IsActive)
            .ToDictionaryAsync(i => i.Id, i => i, cts.Token);

        if (dto.ItemScores.Count < 148)
        {
            return ApiResponse<InspectionOrderDetailDto>.Fail(ErrorCodes.BadRequest.Code,
                $"检测项目不完整，需要148项，当前仅提交{dto.ItemScores.Count}项",
                $"Inspection items incomplete. Required: 148, Submitted: {dto.ItemScores.Count}");
        }

        if (order.ItemResults != null && order.ItemResults.Any())
        {
            _context.InspectionItemResults.RemoveRange(order.ItemResults);
        }

        var itemResults = new List<InspectionItemResult>();
        decimal engineScore = 0, chassisScore = 0, bodyScore = 0, electricalScore = 0, roadTestScore = 0;
        decimal engineWeight = 0, chassisWeight = 0, bodyWeight = 0, electricalWeight = 0, roadTestWeight = 0;

        foreach (var itemScore in dto.ItemScores)
        {
            if (!itemLibrary.TryGetValue(itemScore.InspectionItemId, out var library))
            {
                return ApiResponse<InspectionOrderDetailDto>.Fail(ErrorCodes.InspectionItemNotFound.Code, ErrorCodes.InspectionItemNotFound.MessageZh, ErrorCodes.InspectionItemNotFound.MessageEn);
            }

            var result = new InspectionItemResult
            {
                InspectionOrderId = order.Id,
                InspectionItemId = itemScore.InspectionItemId,
                Category = itemScore.Category,
                Score = itemScore.Score,
                Description = itemScore.Description,
                Finding = itemScore.Finding,
                HasDefect = itemScore.HasDefect,
                DefectLevel = itemScore.DefectLevel,
                PhotoCount = itemScore.PhotoCount,
                CreatedBy = operatorId
            };
            itemResults.Add(result);

            var weightedScore = itemScore.Score * library.Weight;
            switch (itemScore.Category)
            {
                case InspectionCategory.Engine:
                    engineScore += weightedScore;
                    engineWeight += library.Weight;
                    break;
                case InspectionCategory.Chassis:
                    chassisScore += weightedScore;
                    chassisWeight += library.Weight;
                    break;
                case InspectionCategory.Body:
                    bodyScore += weightedScore;
                    bodyWeight += library.Weight;
                    break;
                case InspectionCategory.Electrical:
                    electricalScore += weightedScore;
                    electricalWeight += library.Weight;
                    break;
                case InspectionCategory.RoadTest:
                    roadTestScore += weightedScore;
                    roadTestWeight += library.Weight;
                    break;
            }
        }

        _context.InspectionItemResults.AddRange(itemResults);

        order.EngineScore = engineWeight > 0 ? Math.Round(engineScore / engineWeight * 10, 2) : 0;
        order.ChassisScore = chassisWeight > 0 ? Math.Round(chassisScore / chassisWeight * 10, 2) : 0;
        order.BodyScore = bodyWeight > 0 ? Math.Round(bodyScore / bodyWeight * 10, 2) : 0;
        order.ElectricalScore = electricalWeight > 0 ? Math.Round(electricalScore / electricalWeight * 10, 2) : 0;
        order.RoadTestScore = roadTestWeight > 0 ? Math.Round(roadTestScore / roadTestWeight * 10, 2) : 0;

        var totalWeight = 0.30m + 0.20m + 0.25m + 0.10m + 0.15m;
        order.TotalScore = Math.Round((order.EngineScore * 0.30m +
                                       order.ChassisScore * 0.20m +
                                       order.BodyScore * 0.25m +
                                       order.ElectricalScore * 0.10m +
                                       order.RoadTestScore * 0.15m) / totalWeight * 10, 2);

        order.Grade = DetermineGrade(order.TotalScore);
        order.GeneralComment = dto.GeneralComment;
        order.MajorIssues = dto.MajorIssues;
        order.SafetyConcerns = dto.SafetyConcerns;
        order.Status = InspectionStatus.Completed;
        order.EndTime = DateTime.UtcNow;
        order.DurationMinutes = order.StartTime.HasValue
            ? (int)(order.EndTime.Value - order.StartTime.Value).TotalMinutes
            : null;
        order.UpdatedBy = operatorId;

        var vehicle = await _context.Vehicles.FindAsync(order.VehicleId);
        if (vehicle != null)
        {
            vehicle.Status = VehicleStatus.InspectionCompleted;
            vehicle.UpdatedBy = operatorId;
        }

        await _context.SaveChangesAsync(cts.Token);

        _logger.LogInformation("Inspection submitted: OrderId={OrderId}, TotalScore={TotalScore}, Grade={Grade}",
            order.Id, order.TotalScore, order.Grade);

        var detail = await GetOrderDetailInternalAsync(order.Id);
        return ApiResponse<InspectionOrderDetailDto>.Success(detail, "鉴定提交成功", "Inspection submitted successfully");
    }

    private static InspectionGrade DetermineGrade(decimal totalScore)
    {
        if (totalScore >= 90) return InspectionGrade.Excellent;
        if (totalScore >= 75) return InspectionGrade.Good;
        if (totalScore >= 60) return InspectionGrade.Fair;
        return InspectionGrade.Poor;
    }

    public async Task<ApiResponse<InspectionOrderDetailDto>> ReviewInspectionAsync(InspectionReviewDto dto, long operatorId)
    {
        var order = await _context.InspectionOrders.FindAsync(dto.OrderId);
        if (order == null)
        {
            return ApiResponse<InspectionOrderDetailDto>.Fail(ErrorCodes.InspectionNotFound.Code, ErrorCodes.InspectionNotFound.MessageZh, ErrorCodes.InspectionNotFound.MessageEn);
        }

        if (order.Status != InspectionStatus.Completed)
        {
            return ApiResponse<InspectionOrderDetailDto>.Fail(ErrorCodes.InspectionInvalidStatus.Code, ErrorCodes.InspectionInvalidStatus.MessageZh, ErrorCodes.InspectionInvalidStatus.MessageEn);
        }

        order.ReviewedBy = operatorId;
        order.ReviewedAt = DateTime.UtcNow;
        order.ReviewComment = dto.ReviewComment;
        order.Status = dto.Approved ? InspectionStatus.Reviewed : InspectionStatus.Rejected;
        order.UpdatedBy = operatorId;

        if (dto.Approved)
        {
            var vehicle = await _context.Vehicles.FindAsync(order.VehicleId);
            if (vehicle != null)
            {
                vehicle.Status = VehicleStatus.AvailableForTransaction;
                vehicle.UpdatedBy = operatorId;
            }
        }
        else
        {
            await _context.ExceptionCases.AddAsync(new ExceptionCase
            {
                CaseNo = $"EX{DateTime.Now:yyyyMMddHHmmss}{Random.Shared.Next(100, 999)}",
                CaseType = ExceptionCaseType.Other,
                CaseTypeName = "鉴定报告审核驳回",
                VehicleId = order.VehicleId,
                Title = $"鉴定工单{order.OrderNo}审核未通过",
                Description = dto.ReviewComment ?? "鉴定报告存在问题，需要重新鉴定",
                Status = ExceptionCaseStatus.UnderInvestigation,
                SourceModule = "InspectionReview",
                AssignedTo = order.InspectorId,
                AssigneeName = order.InspectorName,
                Priority = 2,
                CreatedBy = operatorId
            });
        }

        await _context.SaveChangesAsync();

        var detail = await GetOrderDetailInternalAsync(order.Id);
        var msg = dto.Approved ? "鉴定报告审核通过" : "鉴定报告审核驳回";
        var msgEn = dto.Approved ? "Inspection report approved" : "Inspection report rejected";
        return ApiResponse<InspectionOrderDetailDto>.Success(detail, msg, msgEn);
    }

    public async Task<ApiResponse<InspectionOrderDetailDto>> GetOrderByIdAsync(long orderId)
    {
        var detail = await GetOrderDetailInternalAsync(orderId);
        if (detail == null)
        {
            return ApiResponse<InspectionOrderDetailDto>.Fail(ErrorCodes.InspectionNotFound.Code, ErrorCodes.InspectionNotFound.MessageZh, ErrorCodes.InspectionNotFound.MessageEn);
        }
        return ApiResponse<InspectionOrderDetailDto>.Success(detail);
    }

    private async Task<InspectionOrderDetailDto?> GetOrderDetailInternalAsync(long orderId)
    {
        var cacheKey = $"inspection_order_{orderId}";
        if (_cache.TryGetValue(cacheKey, out InspectionOrderDetailDto? cached))
        {
            return cached;
        }

        var order = await _context.InspectionOrders
            .AsNoTracking()
            .Include(o => o.Vehicle)
            .Include(o => o.ItemResults)
                .ThenInclude(r => r.InspectionItem)
            .Include(o => o.Photos)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order == null) return null;

        var result = _mapper.Map<InspectionOrderDetailDto>(order);
        _cache.Set(cacheKey, result, TimeSpan.FromMinutes(5));
        return result;
    }

    public async Task<ApiResponse<PagedResult<InspectionOrderDto>>> QueryOrdersAsync(InspectionQueryDto dto)
    {
        var query = _context.InspectionOrders.AsNoTracking();

        if (dto.VehicleId.HasValue)
            query = query.Where(o => o.VehicleId == dto.VehicleId.Value);

        if (dto.InspectorId.HasValue)
            query = query.Where(o => o.InspectorId == dto.InspectorId.Value);

        if (dto.Status.HasValue)
            query = query.Where(o => o.Status == dto.Status.Value);

        if (dto.Grade.HasValue)
            query = query.Where(o => o.Grade == dto.Grade.Value);

        if (dto.StartDate.HasValue)
            query = query.Where(o => o.CreatedAt >= dto.StartDate.Value);

        if (dto.EndDate.HasValue)
            query = query.Where(o => o.CreatedAt <= dto.EndDate.Value);

        var totalCount = await query.CountAsync();

        var sortField = string.IsNullOrWhiteSpace(dto.SortField) ? "CreatedAt" : dto.SortField;
        query = dto.SortOrder.ToLower() == "asc"
            ? OrderByDynamic(query, sortField, true)
            : OrderByDynamic(query, sortField, false);

        var items = await query
            .Skip((dto.PageIndex - 1) * dto.PageSize)
            .Take(dto.PageSize)
            .ProjectTo<InspectionOrderDto>(_mapper.ConfigurationProvider)
            .ToListAsync();

        var result = new PagedResult<InspectionOrderDto>
        {
            Items = items,
            TotalCount = totalCount,
            PageIndex = dto.PageIndex,
            PageSize = dto.PageSize
        };

        return ApiResponse<PagedResult<InspectionOrderDto>>.Success(result);
    }

    public async Task<ApiResponse<List<InspectionItemLibraryDto>>> GetItemLibraryByCategoryAsync(InspectionCategory? category = null)
    {
        var cacheKey = $"inspection_library_{category ?? 0}";
        if (_cache.TryGetValue(cacheKey, out List<InspectionItemLibraryDto>? cached))
        {
            return ApiResponse<List<InspectionItemLibraryDto>>.Success(cached!);
        }

        var query = _context.InspectionItemLibrary.AsNoTracking().Where(i => i.IsActive);
        if (category.HasValue)
        {
            query = query.Where(i => i.Category == category.Value);
        }

        var items = await query
            .OrderBy(i => i.Category)
            .ThenBy(i => i.SortOrder)
            .ProjectTo<InspectionItemLibraryDto>(_mapper.ConfigurationProvider)
            .ToListAsync();

        _cache.Set(cacheKey, items, TimeSpan.FromHours(1));
        return ApiResponse<List<InspectionItemLibraryDto>>.Success(items);
    }

    public async Task<ApiResponse<byte[]>> GenerateReportAsync(long orderId)
    {
        _logger.LogInformation("Generating inspection report for OrderId: {OrderId}", orderId);

        var order = await GetOrderDetailInternalAsync(orderId);
        if (order == null)
        {
            return ApiResponse<byte[]>.Fail(ErrorCodes.InspectionNotFound.Code, ErrorCodes.InspectionNotFound.MessageZh, ErrorCodes.InspectionNotFound.MessageEn);
        }

        var reportContent = GenerateReportHtml(order);
        var pdfBytes = Encoding.UTF8.GetBytes(reportContent);

        var reportDir = Path.Combine(_appSettings.FileStoragePath, "reports");
        Directory.CreateDirectory(reportDir);
        var reportFileName = $"InspectionReport_{order.OrderNo}_{DateTime.Now:yyyyMMddHHmmss}.html";
        var reportFilePath = Path.Combine(reportDir, reportFileName);
        await File.WriteAllTextAsync(reportFilePath, reportContent);

        var orderEntity = await _context.InspectionOrders.FindAsync(orderId);
        if (orderEntity != null)
        {
            orderEntity.ReportFilePath = reportFilePath;
            await _context.SaveChangesAsync();
        }

        return ApiResponse<byte[]>.Success(pdfBytes, "鉴定报告生成成功", "Report generated successfully");
    }

    private static string GenerateReportHtml(InspectionOrderDetailDto order)
    {
        var gradeText = order.Grade switch
        {
            InspectionGrade.Excellent => "优秀",
            InspectionGrade.Good => "良好",
            InspectionGrade.Fair => "一般",
            InspectionGrade.Poor => "较差",
            _ => "未评级"
        };

        var sb = new StringBuilder();
        sb.Append("<!DOCTYPE html><html lang=\"zh-CN\"><head><meta charset=\"UTF-8\">");
        sb.Append("<title>二手车技术状况鉴定报告</title>");
        sb.Append("<style>body{font-family:'Microsoft YaHei',sans-serif;padding:40px;max-width:800px;margin:0 auto;}");
        sb.Append("h1{text-align:center;color:#333;border-bottom:3px solid #2c3e50;padding-bottom:20px;}");
        sb.Append(".section{margin:25px 0;padding:15px;background:#f8f9fa;border-left:4px solid #3498db;}");
        sb.Append(".info-row{display:flex;padding:8px 0;border-bottom:1px dashed #ddd;}");
        sb.Append(".info-label{width:150px;font-weight:bold;color:#555;}");
        sb.Append(".info-value{flex:1;color:#333;}");
        sb.Append(".score-box{display:flex;justify-content:space-around;margin:20px 0;}");
        sb.Append(".score-item{text-align:center;padding:20px;background:white;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.1);}");
        sb.Append(".score-value{font-size:28px;font-weight:bold;color:#2980b9;}");
        sb.Append(".score-label{font-size:14px;color:#666;margin-top:5px;}");
        sb.Append(".grade-box{text-align:center;padding:30px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border-radius:15px;margin:25px 0;}");
        sb.Append(".grade-value{font-size:48px;font-weight:bold;}");
        sb.Append(".grade-label{font-size:18px;opacity:0.9;}");
        sb.Append("table{width:100%;border-collapse:collapse;margin-top:15px;}");
        sb.Append("th,td{padding:10px;text-align:left;border:1px solid #ddd;}");
        sb.Append("th{background:#34495e;color:white;}");
        sb.Append(".defect{color:#e74c3c;}");
        sb.Append(".footer{text-align:center;margin-top:40px;padding-top:20px;border-top:1px solid #ddd;color:#888;font-size:12px;}");
        sb.Append("</style></head><body>");

        sb.Append("<h1>二手车技术状况鉴定报告</h1>");

        sb.Append("<div class=\"section\"><h2>一、基本信息</h2>");
        sb.Append("<div class=\"info-row\"><span class=\"info-label\">工单编号</span><span class=\"info-value\">").Append(order.OrderNo).Append("</span></div>");
        if (order.Vehicle != null)
        {
            sb.Append("<div class=\"info-row\"><span class=\"info-label\">VIN码</span><span class=\"info-value\">").Append(order.Vehicle.Vin).Append("</span></div>");
            sb.Append("<div class=\"info-row\"><span class=\"info-label\">车牌号</span><span class=\"info-value\">").Append(order.Vehicle.PlateNumber).Append("</span></div>");
            sb.Append("<div class=\"info-row\"><span class=\"info-label\">品牌型号</span><span class=\"info-value\">").Append(order.Vehicle.Brand).Append(" ").Append(order.Vehicle.Model).Append("</span></div>");
        }
        sb.Append("<div class=\"info-row\"><span class=\"info-label\">鉴定师</span><span class=\"info-value\">").Append(order.InspectorName).Append("</span></div>");
        sb.Append("<div class=\"info-row\"><span class=\"info-label\">鉴定时间</span><span class=\"info-value\">").Append(order.StartTime?.ToString("yyyy-MM-dd HH:mm")).Append(" 至 ").Append(order.EndTime?.ToString("yyyy-MM-dd HH:mm")).Append("</span></div>");
        sb.Append("<div class=\"info-row\"><span class=\"info-label\">耗时</span><span class=\"info-value\">").Append(order.DurationMinutes).Append(" 分钟</span></div>");
        sb.Append("</div>");

        sb.Append("<div class=\"grade-box\">");
        sb.Append("<div class=\"grade-label\">综合评级</div>");
        sb.Append("<div class=\"grade-value\">").Append(gradeText).Append("</div>");
        sb.Append("<div style=\"font-size:16px;margin-top:10px;\">综合得分：<b>").Append(order.TotalScore.ToString("F2")).Append(" 分</b></div>");
        sb.Append("</div>");

        sb.Append("<div class=\"section\"><h2>二、分项评分</h2>");
        sb.Append("<div class=\"score-box\">");
        sb.Append("<div class=\"score-item\"><div class=\"score-value\">").Append(order.EngineScore.ToString("F1")).Append("</div><div class=\"score-label\">发动机 30%</div></div>");
        sb.Append("<div class=\"score-item\"><div class=\"score-value\">").Append(order.ChassisScore.ToString("F1")).Append("</div><div class=\"score-label\">底盘 20%</div></div>");
        sb.Append("<div class=\"score-item\"><div class=\"score-value\">").Append(order.BodyScore.ToString("F1")).Append("</div><div class=\"score-label\">车身 25%</div></div>");
        sb.Append("<div class=\"score-item\"><div class=\"score-value\">").Append(order.ElectricalScore.ToString("F1")).Append("</div><div class=\"score-label\">电气 10%</div></div>");
        sb.Append("<div class=\"score-item\"><div class=\"score-value\">").Append(order.RoadTestScore.ToString("F1")).Append("</div><div class=\"score-label\">路试 15%</div></div>");
        sb.Append("</div></div>");

        sb.Append("<div class=\"section\"><h2>三、主要问题</h2>");
        if (!string.IsNullOrEmpty(order.MajorIssues))
        {
            sb.Append("<p>").Append(order.MajorIssues).Append("</p>");
        }
        else
        {
            sb.Append("<p>未发现重大问题</p>");
        }
        sb.Append("</div>");

        sb.Append("<div class=\"section\"><h2>四、安全隐患</h2>");
        if (!string.IsNullOrEmpty(order.SafetyConcerns))
        {
            sb.Append("<p class=\"defect\">").Append(order.SafetyConcerns).Append("</p>");
        }
        else
        {
            sb.Append("<p>未发现安全隐患</p>");
        }
        sb.Append("</div>");

        if (!string.IsNullOrEmpty(order.GeneralComment))
        {
            sb.Append("<div class=\"section\"><h2>五、综合评价</h2><p>").Append(order.GeneralComment).Append("</p></div>");
        }

        if (order.ItemResults != null && order.ItemResults.Any(r => r.HasDefect))
        {
            sb.Append("<div class=\"section\"><h2>六、缺陷项目明细</h2><table>");
            sb.Append("<thead><tr><th>项目分类</th><th>项目名称</th><th>得分</th><th>问题描述</th><th>缺陷等级</th></tr></thead><tbody>");
            foreach (var item in order.ItemResults.Where(r => r.HasDefect))
            {
                sb.Append("<tr><td>").Append(item.Category).Append("</td>")
                  .Append("<td>").Append(item.ItemName).Append("</td>")
                  .Append("<td>").Append(item.Score).Append("/").Append(item.MaxScore).Append("</td>")
                  .Append("<td class=\"defect\">").Append(item.Finding).Append("</td>")
                  .Append("<td>").Append(item.DefectLevel).Append("</td></tr>");
            }
            sb.Append("</tbody></table></div>");
        }

        sb.Append("<div class=\"footer\">");
        sb.Append("<p>报告编号：").Append(order.OrderNo).Append(" | 生成时间：").Append(DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")).Append("</p>");
        sb.Append("<p>本报告仅供参考，最终解释权归本服务中心所有</p>");
        sb.Append("</div>");
        sb.Append("</body></html>");

        return sb.ToString();
    }

    public async Task<ApiResponse<bool>> CancelOrderAsync(long orderId, long operatorId)
    {
        var order = await _context.InspectionOrders.FindAsync(orderId);
        if (order == null)
        {
            return ApiResponse<bool>.Fail(ErrorCodes.InspectionNotFound.Code, ErrorCodes.InspectionNotFound.MessageZh, ErrorCodes.InspectionNotFound.MessageEn);
        }

        if (order.Status == InspectionStatus.Completed || order.Status == InspectionStatus.Reviewed)
        {
            return ApiResponse<bool>.Fail(ErrorCodes.InspectionInvalidStatus.Code, "已完成/已审核的工单不能取消", "Completed/reviewed order cannot be cancelled");
        }

        order.Status = InspectionStatus.Cancelled;
        order.UpdatedBy = operatorId;

        var vehicle = await _context.Vehicles.FindAsync(order.VehicleId);
        if (vehicle != null && vehicle.Status == VehicleStatus.UnderInspection)
        {
            vehicle.Status = VehicleStatus.CompliancePassed;
            vehicle.UpdatedBy = operatorId;
        }

        await _context.SaveChangesAsync();

        return ApiResponse<bool>.Success(true, "鉴定工单已取消", "Inspection order cancelled");
    }

    private static IQueryable<InspectionOrder> OrderByDynamic(IQueryable<InspectionOrder> source, string propertyName, bool ascending)
    {
        var param = System.Linq.Expressions.Expression.Parameter(typeof(InspectionOrder), "o");
        var property = typeof(InspectionOrder).GetProperty(propertyName);
        if (property == null) return ascending ? source.OrderBy(o => o.CreatedAt) : source.OrderByDescending(o => o.CreatedAt);

        var propertyAccess = System.Linq.Expressions.Expression.MakeMemberAccess(param, property);
        var orderByExpression = System.Linq.Expressions.Expression.Lambda(propertyAccess, param);
        var methodName = ascending ? "OrderBy" : "OrderByDescending";
        var resultExpression = System.Linq.Expressions.Expression.Call(
            typeof(Queryable),
            methodName,
            new[] { typeof(InspectionOrder), property.PropertyType },
            source.Expression,
            System.Linq.Expressions.Expression.Quote(orderByExpression));
        return source.Provider.CreateQuery<InspectionOrder>(resultExpression);
    }
}
