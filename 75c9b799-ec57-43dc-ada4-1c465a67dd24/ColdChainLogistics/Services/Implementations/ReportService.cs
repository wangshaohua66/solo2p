using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using Serilog;
using ColdChainLogistics.Models.Entities;
using ColdChainLogistics.Models.DTOs;
using ColdChainLogistics.Repositories.Interfaces;
using ColdChainLogistics.Services.Interfaces;

namespace ColdChainLogistics.Services.Implementations;

public class ReportService : IReportService
{
    private readonly IReportRecordRepository _reportRepository;
    private readonly IShipmentRepository _shipmentRepository;
    private readonly ISensorDataRepository _sensorDataRepository;
    private readonly IAlertRepository _alertRepository;
    private readonly ITraceabilityRepository _traceabilityRepository;
    private readonly ICustomerRepository _customerRepository;

    private readonly string _reportStoragePath = Path.Combine(Directory.GetCurrentDirectory(), "Reports");

    public ReportService(
        IReportRecordRepository reportRepository,
        IShipmentRepository shipmentRepository,
        ISensorDataRepository sensorDataRepository,
        IAlertRepository alertRepository,
        ITraceabilityRepository traceabilityRepository,
        ICustomerRepository customerRepository)
    {
        _reportRepository = reportRepository;
        _shipmentRepository = shipmentRepository;
        _sensorDataRepository = sensorDataRepository;
        _alertRepository = alertRepository;
        _traceabilityRepository = traceabilityRepository;
        _customerRepository = customerRepository;

        if (!Directory.Exists(_reportStoragePath))
        {
            Directory.CreateDirectory(_reportStoragePath);
        }
    }

    public async Task<ReportDto> GenerateReportAsync(ReportGenerateRequest request)
    {
        var reportNumber = GenerateReportNumber();
        var fileName = $"{reportNumber}.pdf";
        var filePath = Path.Combine(_reportStoragePath, fileName);

        var reportRecord = new ReportRecord
        {
            ReportNumber = reportNumber,
            CustomerId = request.CustomerId,
            ShipmentId = request.ShipmentId,
            ReportType = request.ReportType,
            ReportPeriodStart = request.ReportPeriodStart,
            ReportPeriodEnd = request.ReportPeriodEnd,
            FileName = fileName,
            FilePath = filePath,
            Status = "Generating",
            GeneratedAt = DateTime.UtcNow
        };

        await _reportRepository.AddAsync(reportRecord);
        await _reportRepository.SaveChangesAsync();

        try
        {
            var pdfBytes = await GeneratePdfReportAsync(request);
            await File.WriteAllBytesAsync(filePath, pdfBytes);

            reportRecord.Status = "Completed";
            reportRecord.FileSize = pdfBytes.Length;
            reportRecord.GeneratedAt = DateTime.UtcNow;
            _reportRepository.Update(reportRecord);
            await _reportRepository.SaveChangesAsync();

            Log.Information("报告生成成功: {ReportNumber}", reportNumber);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "报告生成失败: {ReportNumber}", reportNumber);
            reportRecord.Status = "Failed";
            reportRecord.ErrorMessage = ex.Message;
            _reportRepository.Update(reportRecord);
            await _reportRepository.SaveChangesAsync();
            throw;
        }

        return await MapToDto(reportRecord);
    }

    private async Task<byte[]> GeneratePdfReportAsync(ReportGenerateRequest request)
    {
        var customer = request.CustomerId.HasValue
            ? await _customerRepository.GetByIdAsync(request.CustomerId.Value)
            : null;

        var shipments = new List<Shipment>();
        if (request.ShipmentId.HasValue)
        {
            var shipment = await _shipmentRepository.GetByIdAsync(request.ShipmentId.Value);
            if (shipment != null) shipments.Add(shipment);
        }
        else if (request.CustomerId.HasValue)
        {
            shipments = await _shipmentRepository.GetByCustomerIdAsync(request.CustomerId.Value, 1, 1000);
        }

        var alerts = new List<Alert>();
        var sensorData = new List<SensorData>();

        if (shipments.Count > 0)
        {
            var firstShipment = shipments.First();
            var startTime = request.ReportPeriodStart;
            var endTime = request.ReportPeriodEnd;

            foreach (var shipment in shipments)
            {
                var shipmentAlerts = (await _alertRepository.GetPagedAsync(1, 1000,
                    a => a.ShipmentId == shipment.Id,
                    a => a.CreatedAt)).Items;
                alerts.AddRange(shipmentAlerts);

                var shipmentData = await _sensorDataRepository.GetByShipmentIdAsync(shipment.Id, startTime, endTime);
                sensorData.AddRange(shipmentData);
            }
        }

        var document = CreateReportDocument(customer, request, shipments, alerts, sensorData);
        return document.GeneratePdf();
    }

    private IDocument CreateReportDocument(Customer? customer, ReportGenerateRequest request,
        List<Shipment> shipments, List<Alert> alerts, List<SensorData> sensorData)
    {
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(2, Unit.Centimetre);
                page.DefaultTextStyle(x => x.FontSize(10).FontFamily(Fonts.Calibri));

                page.Header().Element(ComposeHeader);
                page.Content().Element(ComposeContent);
                page.Footer().AlignCenter().Text(x =>
                {
                    x.Span("第 ");
                    x.CurrentPageNumber();
                    x.Span(" 页 / 共 ");
                    x.TotalPages();
                    x.Span(" 页");
                });
            });
        });

        void ComposeHeader(IContainer container)
        {
            container.Row(row =>
            {
                row.RelativeItem().Column(column =>
                {
                    column.Item().Text("药品冷链物流温控合规报告").FontSize(16).Bold();
                    column.Item().Text($"客户: {customer?.Name ?? "全部客户"}").FontSize(10);
                    column.Item().Text($"报告周期: {request.ReportPeriodStart:yyyy-MM-dd HH:mm} 至 {request.ReportPeriodEnd:yyyy-MM-dd HH:mm}").FontSize(9).Fluent();
                });
                row.ConstantItem(100).AlignRight().Column(column =>
                {
                    column.Item().Text($"生成时间: {DateTime.Now:yyyy-MM-dd HH:mm}").FontSize(9);
                    column.Item().Text("GSP合规").FontSize(9).Bold();
                });
            });
        }

        void ComposeContent(IContainer container)
        {
            container.PaddingVertical(10).Column(column =>
            {
                column.Spacing(10);

                column.Item().Element(ComposeSummary);

                column.Item().Element(ComposeShipmentList);

                column.Item().Element(ComposeAlertSummary);

                column.Item().Element(ComposeTemperatureStats);

                column.Item().Element(ComposeComplianceStatement);
            });
        }

        void ComposeSummary(IContainer container)
        {
            container.Background(Colors.Grey.Lighten3).Padding(10).Column(col =>
            {
                col.Item().Text("一、报告概述").Bold().FontSize(12);
                col.Spacing(5);
                col.Item().Text($"本报告统计了 {request.ReportPeriodStart:yyyy-MM-dd HH:mm} 至 {request.ReportPeriodEnd:yyyy-MM-dd HH:mm} 期间的冷链运输温控数据。");
                col.Item().Text($"运输批次总数: {shipments.Count}");
                col.Item().Text($"传感器数据点数: {sensorData.Count}");
                col.Item().Text($"告警事件总数: {alerts.Count}");
                col.Item().Text($"合规率: {(sensorData.Count > 0 ? ((sensorData.Count - alerts.Count) * 100.0 / sensorData.Count).ToString("F2") : "100.00")}%");
            });
        }

        void ComposeShipmentList(IContainer container)
        {
            container.Column(col =>
            {
                col.Item().Text("二、运输批次列表").Bold().FontSize(12);
                col.Spacing(5);

                if (shipments.Count == 0)
                {
                    col.Item().Text("暂无运输数据");
                    return;
                }

                col.Item().Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        columns.RelativeColumn(2);
                        columns.RelativeColumn(2);
                        columns.RelativeColumn(1.5f);
                        columns.RelativeColumn(1);
                        columns.RelativeColumn(1.5f);
                    });

                    table.Header(header =>
                    {
                        header.Cell().BorderBottom(1).Padding(2).Text("运输单号").Bold();
                        header.Cell().BorderBottom(1).Padding(2).Text("目的地").Bold();
                        header.Cell().BorderBottom(1).Padding(2).Text("发车时间").Bold();
                        header.Cell().BorderBottom(1).Padding(2).Text("状态").Bold();
                        header.Cell().BorderBottom(1).Padding(2).Text("告警数").Bold();
                    });

                    foreach (var shipment in shipments.Take(20))
                    {
                        var shipmentAlerts = alerts.Count(a => a.ShipmentId == shipment.Id);
                        table.Cell().BorderBottom(1).Padding(2).Text(shipment.ShipmentNumber);
                        table.Cell().BorderBottom(1).Padding(2).Text(shipment.Destination ?? "-");
                        table.Cell().BorderBottom(1).Padding(2).Text(shipment.DepartureTime?.ToString("yyyy-MM-dd HH:mm") ?? "-");
                        table.Cell().BorderBottom(1).Padding(2).Text(shipment.Status.ToString());
                        table.Cell().BorderBottom(1).Padding(2).Text(shipmentAlerts.ToString());
                    }
                });
            });
        }

        void ComposeAlertSummary(IContainer container)
        {
            container.Column(col =>
            {
                col.Item().Text("三、超限告警汇总").Bold().FontSize(12);
                col.Spacing(5);

                if (alerts.Count == 0)
                {
                    col.Item().Text("无告警事件，全部运输批次温控达标");
                    return;
                }

                var criticalCount = alerts.Count(a => a.Severity == AlertSeverity.Critical);
                var warningCount = alerts.Count(a => a.Severity == AlertSeverity.Warning);
                var infoCount = alerts.Count(a => a.Severity == AlertSeverity.Info);

                col.Item().Text($"严重告警: {criticalCount} 条");
                col.Item().Text($"警告告警: {warningCount} 条");
                col.Item().Text($"提示告警: {infoCount} 条");

                col.Spacing(5);
                col.Item().Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        columns.RelativeColumn(2);
                        columns.RelativeColumn(2);
                        columns.RelativeColumn(1);
                        columns.RelativeColumn(2);
                        columns.RelativeColumn(2);
                    });

                    table.Header(header =>
                    {
                        header.Cell().BorderBottom(1).Padding(2).Text("告警编号").Bold();
                        header.Cell().BorderBottom(1).Padding(2).Text("告警标题").Bold();
                        header.Cell().BorderBottom(1).Padding(2).Text("等级").Bold();
                        header.Cell().BorderBottom(1).Padding(2).Text("触发时间").Bold();
                        header.Cell().BorderBottom(1).Padding(2).Text("状态").Bold();
                    });

                    foreach (var alert in alerts.Take(30))
                    {
                        table.Cell().BorderBottom(1).Padding(2).Text(alert.AlertCode);
                        table.Cell().BorderBottom(1).Padding(2).Text(alert.Title);
                        table.Cell().BorderBottom(1).Padding(2).Text(alert.Severity.ToString());
                        table.Cell().BorderBottom(1).Padding(2).Text(alert.FirstTriggeredAt.ToString("yyyy-MM-dd HH:mm"));
                        table.Cell().BorderBottom(1).Padding(2).Text(alert.Status.ToString());
                    }
                });
            });
        }

        void ComposeTemperatureStats(IContainer container)
        {
            container.Column(col =>
            {
                col.Item().Text("四、温度统计数据").Bold().FontSize(12);
                col.Spacing(5);

                if (sensorData.Count == 0)
                {
                    col.Item().Text("暂无传感器数据");
                    return;
                }

                var temperatures = sensorData.Select(d => d.Temperature).ToList();
                var humidities = sensorData.Select(d => d.Humidity).ToList();

                col.Item().Text($"温度范围: {temperatures.Min():F2}°C ~ {temperatures.Max():F2}°C");
                col.Item().Text($"平均温度: {temperatures.Average():F2}°C");
                col.Item().Text($"湿度范围: {humidities.Min():F1}% ~ {humidities.Max():F1}%");
                col.Item().Text($"平均湿度: {humidities.Average():F1}%");
                col.Item().Text($"数据采集点数: {sensorData.Count}");
            });
        }

        void ComposeComplianceStatement(IContainer container)
        {
            container.Background(Colors.Blue.Lighten4).Border(1).BorderColor(Colors.Blue.Medium).Padding(10).Column(col =>
            {
                col.Item().Text("五、合规声明").Bold().FontSize(12);
                col.Spacing(5);
                col.Item().Text("本报告数据来源于冷链运输过程中实时采集的温湿度数据，数据真实、完整、不可篡改，符合《药品经营质量管理规范》（GSP）要求。");
                col.Item().Text("报告生成系统: 药品冷链物流监管平台");
                col.Item().Text($"报告生成时间: {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
            });
        }
    }

    public async Task<PagedResult<ReportDto>> GetPagedAsync(ReportQueryRequest request)
    {
        var (items, totalCount) = await _reportRepository.GetPagedAsync(
            request.PageIndex,
            request.PageSize,
            r => (!request.CustomerId.HasValue || r.CustomerId == request.CustomerId.Value)
              && (!request.ShipmentId.HasValue || r.ShipmentId == request.ShipmentId.Value)
              && (string.IsNullOrWhiteSpace(request.ReportType) || r.ReportType == request.ReportType)
              && (string.IsNullOrWhiteSpace(request.ReportNumber) || r.ReportNumber.Contains(request.ReportNumber))
              && (!request.StartTime.HasValue || r.CreatedAt >= request.StartTime.Value)
              && (!request.EndTime.HasValue || r.CreatedAt <= request.EndTime.Value),
            r => r.CreatedAt,
            true);

        var dtoList = new List<ReportDto>();
        foreach (var item in items)
        {
            dtoList.Add(await MapToDto(item));
        }

        return new PagedResult<ReportDto>
        {
            PageIndex = request.PageIndex,
            PageSize = request.PageSize,
            TotalCount = totalCount,
            TotalPages = (int)Math.Ceiling((double)totalCount / request.PageSize),
            Items = dtoList
        };
    }

    public async Task<ReportDto?> GetByIdAsync(long id)
    {
        var report = await _reportRepository.GetByIdAsync(id);
        return report != null ? await MapToDto(report) : null;
    }

    public async Task GenerateMonthlyReportsAsync()
    {
        var customers = await _customerRepository.GetActiveCustomersAsync();
        var lastMonth = DateTime.UtcNow.AddMonths(-1);
        var startOfMonth = new DateTime(lastMonth.Year, lastMonth.Month, 1);
        var endOfMonth = startOfMonth.AddMonths(1).AddSeconds(-1);

        Log.Information("开始生成月度报告，共 {Count} 个客户", customers.Count);

        foreach (var customer in customers)
        {
            try
            {
                var request = new ReportGenerateRequest
                {
                    CustomerId = customer.Id,
                    ReportType = "Monthly",
                    ReportPeriodStart = startOfMonth,
                    ReportPeriodEnd = endOfMonth,
                    IncludeRawData = true
                };
                await GenerateReportAsync(request);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "生成客户 {CustomerId} 的月度报告失败", customer.Id);
            }
        }

        Log.Information("月度报告生成完成");
    }

    public async Task<byte[]> DownloadReportAsync(long reportId)
    {
        var report = await _reportRepository.GetByIdAsync(reportId);
        if (report == null)
        {
            throw new KeyNotFoundException("报告不存在");
        }

        if (report.Status != "Completed" || string.IsNullOrWhiteSpace(report.FilePath))
        {
            throw new InvalidOperationException("报告尚未生成或生成失败");
        }

        if (!File.Exists(report.FilePath))
        {
            throw new FileNotFoundException("报告文件不存在");
        }

        return await File.ReadAllBytesAsync(report.FilePath);
    }

    private async Task<ReportDto> MapToDto(ReportRecord report)
    {
        var customer = report.CustomerId.HasValue
            ? await _customerRepository.GetByIdAsync(report.CustomerId.Value)
            : null;

        var shipment = report.ShipmentId.HasValue
            ? await _shipmentRepository.GetByIdAsync(report.ShipmentId.Value)
            : null;

        return new ReportDto
        {
            Id = report.Id,
            ReportNumber = report.ReportNumber,
            CustomerId = report.CustomerId,
            CustomerName = customer?.Name,
            ShipmentId = report.ShipmentId,
            ShipmentNumber = shipment?.ShipmentNumber,
            ReportType = report.ReportType,
            ReportPeriodStart = report.ReportPeriodStart,
            ReportPeriodEnd = report.ReportPeriodEnd,
            FileName = report.FileName,
            FileSize = report.FileSize,
            Status = report.Status,
            GeneratedAt = report.GeneratedAt,
            GeneratedBy = report.GeneratedBy
        };
    }

    private string GenerateReportNumber()
    {
        return $"RPT{DateTime.UtcNow:yyyyMMddHHmmssfff}{new Random().Next(1000, 9999)}";
    }
}
