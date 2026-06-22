using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using UsedVehicleTransaction.Common;
using UsedVehicleTransaction.DTOs;

namespace UsedVehicleTransaction.Services;

public class QuestPdfService : IPdfService
{
    private readonly AppSettings _appSettings;
    private readonly ILogger<QuestPdfService> _logger;

    public QuestPdfService(Microsoft.Extensions.Options.IOptions<AppSettings> appSettings, ILogger<QuestPdfService> logger)
    {
        _appSettings = appSettings.Value;
        _logger = logger;
    }

    public async Task<byte[]> GeneratePdfFromHtmlAsync(string html, string title, CancellationToken cancellationToken)
    {
        return await Task.Run(() =>
        {
            var document = CreateDocumentFromHtml(title, html);
            var bytes = document.GeneratePdf();
            if (_appSettings.Pdf.EnableCompression)
            {
                bytes = CompressPdf(bytes);
            }
            return bytes;
        }, cancellationToken);
    }

    public async Task<byte[]> GenerateInspectionReportPdfAsync(InspectionOrderDetailDto order, string htmlContent, CancellationToken cancellationToken)
    {
        return await Task.Run(() =>
        {
            _logger.LogInformation("Generating PDF report for inspection order: {OrderId}", order.Id);

            var report = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(2, Unit.Centimetre);
                    page.PageColor(Colors.White);
                    page.DefaultTextStyle(x => x.FontSize(10).FontFamily("Microsoft YaHei", "SimSun", Fonts.Calibri));

                    page.Header().Element(ComposeHeader);

                    page.Content().Element(c => ComposeReportContent(c, order));

                    page.Footer().AlignCenter().Text(x =>
                    {
                        x.Span("第 ");
                        x.CurrentPageNumber();
                        x.Span(" / ");
                        x.TotalPages();
                        x.Span(" 页");
                    });
                });
            });

            var pdfBytes = report.GeneratePdf();

            if (_appSettings.Pdf.EnableCompression)
            {
                pdfBytes = CompressPdf(pdfBytes);
            }

            _logger.LogInformation("PDF report generated successfully, size: {Size} bytes", pdfBytes.Length);
            return pdfBytes;
        }, cancellationToken);
    }

    private void ComposeHeader(IContainer container)
    {
        container.Row(row =>
        {
            row.RelativeItem().Column(column =>
            {
                column.Item().Text("二手车技术状况鉴定报告")
                    .FontSize(18).Bold().FontColor(Colors.Blue.Darken2);
                column.Item().Text("Used Vehicle Technical Inspection Report")
                    .FontSize(9).FontColor(Colors.Grey.Darken1);
                column.Item().Text($"报告生成时间: {DateTime.Now:yyyy-MM-dd HH:mm:ss}")
                    .FontSize(8).FontColor(Colors.Grey.Darken2);
            });

            row.ConstantItem(80).AlignRight().Column(column =>
            {
                column.Item().Height(40).Width(40).Background(Colors.Blue.Lighten1)
                    .AlignCenter().AlignMiddle().Text("二手车").FontSize(10).White();
            });
        });
    }

    private void ComposeReportContent(IContainer container, InspectionOrderDetailDto order)
    {
        container.PaddingVertical(20).Column(column =>
        {
            column.Spacing(10);

            column.Item().Element(c => ComposeBasicInfo(c, order));
            column.Item().Element(c => ComposeScoreOverview(c, order));
            column.Item().Element(c => ComposeScoreDetails(c, order));
            column.Item().Element(c => ComposeDefectsTable(c, order));
            column.Item().Element(c => ComposeGradeConclusion(c, order));
        });
    }

    private void ComposeBasicInfo(IContainer container, InspectionOrderDetailDto order)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.ConstantColumn(100);
                columns.RelativeColumn();
                columns.ConstantColumn(100);
                columns.RelativeColumn();
            });

            table.Cell().Element(CellStyle).Text("VIN码").Bold();
            table.Cell().Element(CellStyle).Text(order.Vehicle.Vin);
            table.Cell().Element(CellStyle).Text("车牌号").Bold();
            table.Cell().Element(CellStyle).Text(order.Vehicle.PlateNumber);

            table.Cell().Element(CellStyle).Text("品牌型号").Bold();
            table.Cell().Element(CellStyle).Text($"{order.Vehicle.Brand} {order.Vehicle.Model}");
            table.Cell().Element(CellStyle).Text("行驶里程").Bold();
            table.Cell().Element(CellStyle).Text($"{order.Vehicle.Mileage:N0} 公里");

            table.Cell().Element(CellStyle).Text("注册日期").Bold();
            table.Cell().Element(CellStyle).Text(order.Vehicle.RegistrationDate?.ToString("yyyy-MM-dd") ?? "-");
            table.Cell().Element(CellStyle).Text("鉴定日期").Bold();
            table.Cell().Element(CellStyle).Text(order.CompletedAt?.ToString("yyyy-MM-dd") ?? "-");

            table.Cell().Element(CellStyle).Text("鉴定师").Bold();
            table.Cell().Element(CellStyle).Text(order.InspectorName);
            table.Cell().Element(CellStyle).Text("工单编号").Bold();
            table.Cell().Element(CellStyle).Text(order.OrderNo);
        });
    }

    private void ComposeScoreOverview(IContainer container, InspectionOrderDetailDto order)
    {
        container.Row(row =>
        {
            row.RelativeItem().AlignCenter().Column(col =>
            {
                col.Item().Height(100).Width(100)
                    .Background(GetGradeColor(order.InspectionGrade))
                    .Border(5).BorderColor(Colors.White)
                    .AlignCenter().AlignMiddle().Text($"{order.TotalScore:0.0}")
                    .FontSize(36).Bold().White();

                col.Item().PaddingTop(8).Text("综合评分").FontSize(11).Bold();
                col.Item().Text($"等级: {GetGradeText(order.InspectionGrade)}").FontSize(14).Bold()
                    .FontColor(GetGradeColor(order.InspectionGrade));
            });

            row.RelativeItem().PaddingLeft(20).Column(col =>
            {
                col.Item().Text("五大系统评分").FontSize(12).Bold();
                col.Spacing(6);

                col.Item().Element(c => ComposeScoreBar(c, "发动机", order.EngineScore, 0.30, Colors.Red.Medium));
                col.Item().Element(c => ComposeScoreBar(c, "底盘系统", order.ChassisScore, 0.20, Colors.Orange.Medium));
                col.Item().Element(c => ComposeScoreBar(c, "车身外观", order.BodyScore, 0.25, Colors.Blue.Medium));
                col.Item().Element(c => ComposeScoreBar(c, "电气系统", order.ElectricalScore, 0.10, Colors.Purple.Medium));
                col.Item().Element(c => ComposeScoreBar(c, "路试检测", order.RoadTestScore, 0.15, Colors.Green.Medium));
            });
        });
    }

    private void ComposeScoreBar(IContainer container, string name, decimal? score, double weight, string color)
    {
        var scoreValue = score ?? 0;
        container.Row(row =>
        {
            row.ConstantItem(70).Text(name).FontSize(10);
            row.ConstantItem(40).Text($"{scoreValue:0.0}").FontSize(10).Bold();
            row.RelativeItem().PaddingLeft(5).PaddingRight(5).Height(12).Background(Colors.Grey.Lighten3)
                .Stack(stack =>
                {
                    stack.Item().Width($"{scoreValue}%").Height(12).Background(color);
                });
            row.ConstantItem(50).AlignRight().Text($"权重 {weight * 100:0}%").FontSize(9).FontColor(Colors.Grey.Darken1);
        });
    }

    private void ComposeScoreDetails(IContainer container, InspectionOrderDetailDto order)
    {
        container.PaddingTop(15).Column(col =>
        {
            col.Item().Text("检测项目详情").FontSize(12).Bold();
            col.Spacing(5);

            if (order.ItemResults == null || order.ItemResults.Count == 0)
            {
                col.Item().Text("暂无检测结果").FontColor(Colors.Grey.Darken1);
                return;
            }

            var grouped = order.ItemResults.GroupBy(x => x.Category);
            foreach (var group in grouped)
            {
                col.Item().PaddingTop(8).Text($"{GetCategoryText(group.Key)} 检测项目").FontSize(11).Bold()
                    .FontColor(Colors.Blue.Darken1);

                col.Item().Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        columns.ConstantColumn(120);
                        columns.RelativeColumn();
                        columns.ConstantColumn(70);
                        columns.ConstantColumn(70);
                        columns.ConstantColumn(70);
                    });

                    table.Cell().Element(HeaderCellStyle).Text("项目编号");
                    table.Cell().Element(HeaderCellStyle).Text("检测内容");
                    table.Cell().Element(HeaderCellStyle).AlignCenter().Text("满分");
                    table.Cell().Element(HeaderCellStyle).AlignCenter().Text("得分");
                    table.Cell().Element(HeaderCellStyle).AlignCenter().Text("权重");

                    foreach (var item in group.OrderBy(x => x.ItemCode))
                    {
                        table.Cell().Element(CellStyle).Text(item.ItemCode);
                        table.Cell().Element(CellStyle).Text(item.ItemName);
                        table.Cell().Element(CellStyle).AlignCenter().Text(item.MaxScore.ToString());
                        table.Cell().Element(CellStyle).AlignCenter().Text(item.Score.ToString("0.0"))
                            .FontColor(item.Score < item.MaxScore * 0.6m ? Colors.Red.Medium : Colors.Black);
                        table.Cell().Element(CellStyle).AlignCenter().Text($"{item.Weight:0.00}");
                    }
                });
            }
        });
    }

    private void ComposeDefectsTable(IContainer container, InspectionOrderDetailDto order)
    {
        container.PaddingTop(15).Column(col =>
        {
            col.Item().Text("缺陷与问题记录").FontSize(12).Bold();

            var defects = order.ItemResults?.Where(x => !string.IsNullOrEmpty(x.DefectDescription)).ToList();
            if (defects == null || defects.Count == 0)
            {
                col.Item().PaddingTop(5).Text("无缺陷记录").FontColor(Colors.Green.Darken1);
                return;
            }

            col.Item().Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.ConstantColumn(120);
                    columns.ConstantColumn(100);
                    columns.RelativeColumn();
                    columns.ConstantColumn(80);
                });

                table.Cell().Element(HeaderCellStyle).Text("系统分类");
                table.Cell().Element(HeaderCellStyle).Text("检测项目");
                table.Cell().Element(HeaderCellStyle).Text("缺陷描述");
                table.Cell().Element(HeaderCellStyle).AlignCenter().Text("建议处理");

                foreach (var item in defects)
                {
                    table.Cell().Element(CellStyle).Text(GetCategoryText(item.Category));
                    table.Cell().Element(CellStyle).Text(item.ItemName);
                    table.Cell().Element(CellStyle).Text(item.DefectDescription ?? "-");
                    table.Cell().Element(CellStyle).AlignCenter().Text(GetSeverityText(item.DefectSeverity));
                }
            });
        });
    }

    private void ComposeGradeConclusion(IContainer container, InspectionOrderDetailDto order)
    {
        container.PaddingTop(15).Background(Colors.Grey.Lighten4).Padding(15).Column(col =>
        {
            col.Item().Text("鉴定结论").FontSize(13).Bold();
            col.Item().PaddingTop(8).Text(
                order.InspectionGrade switch
                {
                    Enums.InspectionGrade.Excellent => "车辆技术状况优秀，整车性能完好，无明显缺陷，可放心购买。",
                    Enums.InspectionGrade.Good => "车辆技术状况良好，存在少量轻微瑕疵，整体性能正常，不影响使用。",
                    Enums.InspectionGrade.Fair => "车辆技术状况一般，存在部分可见缺陷，建议维修后购买。",
                    Enums.InspectionGrade.Poor => "车辆技术状况较差，存在较多或较严重缺陷，不建议购买。",
                    _ => "待评定"
                }
            ).FontSize(11);

            col.Item().PaddingTop(12).Row(row =>
            {
                row.RelativeItem().Column(c =>
                {
                    c.Item().Text("鉴定师签名：____________").FontSize(10);
                    c.Item().PaddingTop(3).Text($"日期：{DateTime.Now:yyyy-MM-dd}").FontSize(9);
                });
                row.RelativeItem().Column(c =>
                {
                    c.Item().Text("审核员签名：____________").FontSize(10);
                    c.Item().PaddingTop(3).Text($"日期：________________").FontSize(9);
                });
            });
        });
    }

    private static string GetGradeText(Enums.InspectionGrade? grade)
    {
        return grade switch
        {
            Enums.InspectionGrade.Excellent => "优秀",
            Enums.InspectionGrade.Good => "良好",
            Enums.InspectionGrade.Fair => "一般",
            Enums.InspectionGrade.Poor => "较差",
            _ => "未评定"
        };
    }

    private static string GetGradeColor(Enums.InspectionGrade? grade)
    {
        return grade switch
        {
            Enums.InspectionGrade.Excellent => Colors.Green.Darken2,
            Enums.InspectionGrade.Good => Colors.Blue.Darken2,
            Enums.InspectionGrade.Fair => Colors.Orange.Darken2,
            Enums.InspectionGrade.Poor => Colors.Red.Darken2,
            _ => Colors.Grey.Darken2
        };
    }

    private static string GetCategoryText(Enums.InspectionCategory category)
    {
        return category switch
        {
            Enums.InspectionCategory.Engine => "发动机",
            Enums.InspectionCategory.Chassis => "底盘",
            Enums.InspectionCategory.Body => "车身",
            Enums.InspectionCategory.Electrical => "电气",
            Enums.InspectionCategory.RoadTest => "路试",
            _ => "其他"
        };
    }

    private static string GetSeverityText(int? severity)
    {
        return severity switch
        {
            1 => "轻微",
            2 => "一般",
            3 => "严重",
            _ => "无"
        };
    }

    private static IContainer CellStyle(IContainer container)
    {
        return container.BorderBottom(1).BorderColor(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(6);
    }

    private static IContainer HeaderCellStyle(IContainer container)
    {
        return container.Background(Colors.Grey.Lighten2).Bold().PaddingVertical(4).PaddingHorizontal(6);
    }

    private static byte[] CompressPdf(byte[] pdfBytes)
    {
        return pdfBytes;
    }

    private static IDocument CreateDocumentFromHtml(string title, string html)
    {
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(2, Unit.Centimetre);
                page.DefaultTextStyle(x => x.FontSize(10).FontFamily("Microsoft YaHei", Fonts.Calibri));

                page.Header().Text(title).Bold().FontSize(14);

                page.Content().PaddingVertical(10).Column(column =>
                {
                    var textContent = System.Text.RegularExpressions.Regex.Replace(html, "<[^>]+>", " ").Trim();
                    textContent = System.Text.RegularExpressions.Regex.Replace(textContent, "\\s+", " ");
                    column.Item().Text(textContent);
                });

                page.Footer().AlignCenter().Text(x =>
                {
                    x.Span("第 ");
                    x.CurrentPageNumber();
                    x.Span(" / ");
                    x.TotalPages();
                });
            });
        });
    }
}
