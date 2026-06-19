using System.Text;
using MiningGovApi.Models.DTOs;

namespace MiningGovApi.Background;

public interface IExportService
{
    byte[] ExportProductionTrendToCsv(List<ProductionTrendDto> data);
    byte[] ExportFeeCollectionToCsv(List<FeeCollectionDto> data);
    byte[] ExportSafetyDisposalToCsv(List<SafetyDisposalDto> data);
    byte[] ExportMiningRightExpiryToCsv(List<MiningRightExpiryDto> data);
    byte[] ExportMineStatsToCsv(List<MineStatDto> data);

    byte[] ExportProductionTrendToExcel(List<ProductionTrendDto> data);
    byte[] ExportFeeCollectionToExcel(List<FeeCollectionDto> data);
    byte[] ExportSafetyDisposalToExcel(List<SafetyDisposalDto> data);
    byte[] ExportMiningRightExpiryToExcel(List<MiningRightExpiryDto> data);
    byte[] ExportMineStatsToExcel(List<MineStatDto> data);
}

public class ExportService : IExportService
{
    private static readonly Encoding _utf8NoBom = new UTF8Encoding(false);

    public byte[] ExportProductionTrendToCsv(List<ProductionTrendDto> data)
    {
        var sb = new StringBuilder();
        sb.AppendLine("时期,矿山ID,矿山名称,矿种类型,产量,销量,品位(%)");
        foreach (var r in data)
        {
            sb.AppendLine($"{EscapeCsv(r.Period)},{r.MineId},{EscapeCsv(r.MineName)},{r.MineType}," +
                          $"{r.Output},{r.Sales},{r.Grade:F2}");
        }
        return WithBom(sb.ToString());
    }

    public byte[] ExportFeeCollectionToCsv(List<FeeCollectionDto> data)
    {
        var sb = new StringBuilder();
        sb.AppendLine("时期,应缴金额,已缴金额,逾期金额,入库率(%)");
        foreach (var r in data)
        {
            sb.AppendLine($"{EscapeCsv(r.Period)},{r.TotalBilled:F2},{r.TotalPaid:F2}," +
                          $"{r.TotalOverdue:F2},{r.CollectionRate:F2}");
        }
        return WithBom(sb.ToString());
    }

    public byte[] ExportSafetyDisposalToCsv(List<SafetyDisposalDto> data)
    {
        var sb = new StringBuilder();
        sb.AppendLine("矿山ID,矿山名称,预警总数,已关闭,待处置,已升级,平均响应时长(h),平均关闭时长(h)");
        foreach (var r in data)
        {
            sb.AppendLine($"{r.MineId},{EscapeCsv(r.MineName)},{r.TotalAlerts},{r.ClosedAlerts}," +
                          $"{r.PendingAlerts},{r.EscalatedAlerts},{r.AvgResponseHours:F2},{r.AvgCloseHours:F2}");
        }
        return WithBom(sb.ToString());
    }

    public byte[] ExportMiningRightExpiryToCsv(List<MiningRightExpiryDto> data)
    {
        var sb = new StringBuilder();
        sb.AppendLine("ID,许可证号,矿山ID,矿山名称,持有人,有效期至,距到期天数");
        foreach (var r in data)
        {
            sb.AppendLine($"{r.Id},{EscapeCsv(r.LicenseNo)},{r.MineId},{EscapeCsv(r.MineName)}," +
                          $"{EscapeCsv(r.Holder ?? "")},{r.ValidTo:yyyy-MM-dd},{r.DaysToExpiry}");
        }
        return WithBom(sb.ToString());
    }

    public byte[] ExportMineStatsToCsv(List<MineStatDto> data)
    {
        var sb = new StringBuilder();
        sb.AppendLine("ID,矿山名称,矿种,产量报告数,异常报告数,预警总数,未关闭预警,应缴费用,已缴费用");
        foreach (var r in data)
        {
            sb.AppendLine($"{r.Id},{EscapeCsv(r.Name)},{r.MineType},{r.TotalProductionReports}," +
                          $"{r.AbnormalReports},{r.TotalAlerts},{r.OpenAlerts}," +
                          $"{r.TotalFeesBilled:F2},{r.TotalFeesPaid:F2}");
        }
        return WithBom(sb.ToString());
    }

    public byte[] ExportProductionTrendToExcel(List<ProductionTrendDto> data)
        => BuildExcel(new ExcelSheet
        {
            Name = "产量趋势",
            Headers = ["时期", "矿山ID", "矿山名称", "矿种类型", "产量", "销量", "品位(%)"],
            Rows = data.Select(r => new List<string>
            {
                r.Period, r.MineId.ToString(), r.MineName, r.MineType.ToString(),
                r.Output.ToString(), r.Sales.ToString(), r.Grade.ToString("F2")
            }).ToList()
        });

    public byte[] ExportFeeCollectionToExcel(List<FeeCollectionDto> data)
        => BuildExcel(new ExcelSheet
        {
            Name = "费款入库",
            Headers = ["时期", "应缴金额", "已缴金额", "逾期金额", "入库率(%)"],
            Rows = data.Select(r => new List<string>
            {
                r.Period, r.TotalBilled.ToString("F2"), r.TotalPaid.ToString("F2"),
                r.TotalOverdue.ToString("F2"), r.CollectionRate.ToString("F2")
            }).ToList()
        });

    public byte[] ExportSafetyDisposalToExcel(List<SafetyDisposalDto> data)
        => BuildExcel(new ExcelSheet
        {
            Name = "预警处置",
            Headers = ["矿山ID", "矿山名称", "预警总数", "已关闭", "待处置", "已升级", "平均响应时长(h)", "平均关闭时长(h)"],
            Rows = data.Select(r => new List<string>
            {
                r.MineId.ToString(), r.MineName, r.TotalAlerts.ToString(), r.ClosedAlerts.ToString(),
                r.PendingAlerts.ToString(), r.EscalatedAlerts.ToString(),
                r.AvgResponseHours.ToString("F2"), r.AvgCloseHours.ToString("F2")
            }).ToList()
        });

    public byte[] ExportMiningRightExpiryToExcel(List<MiningRightExpiryDto> data)
        => BuildExcel(new ExcelSheet
        {
            Name = "到期预警",
            Headers = ["ID", "许可证号", "矿山ID", "矿山名称", "持有人", "有效期至", "距到期天数"],
            Rows = data.Select(r => new List<string>
            {
                r.Id.ToString(), r.LicenseNo, r.MineId.ToString(), r.MineName,
                r.Holder ?? "", r.ValidTo.ToString("yyyy-MM-dd"), r.DaysToExpiry.ToString()
            }).ToList()
        });

    public byte[] ExportMineStatsToExcel(List<MineStatDto> data)
        => BuildExcel(new ExcelSheet
        {
            Name = "矿山概览",
            Headers = ["ID", "矿山名称", "矿种", "产量报告数", "异常报告数", "预警总数", "未关闭预警", "应缴费用", "已缴费用"],
            Rows = data.Select(r => new List<string>
            {
                r.Id.ToString(), r.Name, r.MineType.ToString(), r.TotalProductionReports.ToString(),
                r.AbnormalReports.ToString(), r.TotalAlerts.ToString(), r.OpenAlerts.ToString(),
                r.TotalFeesBilled.ToString("F2"), r.TotalFeesPaid.ToString("F2")
            }).ToList()
        });

    private static byte[] WithBom(string content)
    {
        var preamble = Encoding.UTF8.GetPreamble();
        var body = _utf8NoBom.GetBytes(content);
        var result = new byte[preamble.Length + body.Length];
        Buffer.BlockCopy(preamble, 0, result, 0, preamble.Length);
        Buffer.BlockCopy(body, 0, result, preamble.Length, body.Length);
        return result;
    }

    private static string EscapeCsv(string s)
    {
        if (string.IsNullOrEmpty(s)) return "";
        if (s.Contains(',') || s.Contains('\"') || s.Contains('\n') || s.Contains('\r'))
        {
            return "\"" + s.Replace("\"", "\"\"") + "\"";
        }
        return s;
    }

    private class ExcelSheet
    {
        public string Name { get; set; } = "Sheet1";
        public List<string> Headers { get; set; } = [];
        public List<List<string>> Rows { get; set; } = [];
    }

    private static byte[] BuildExcel(ExcelSheet sheet)
    {
        var xlsxContent = BuildSimpleXlsx(sheet);
        return xlsxContent;
    }

    private static byte[] BuildSimpleXlsx(ExcelSheet sheet)
    {
        var allStrings = new List<string>();
        var stringIndex = new Dictionary<string, int>();
        int GetOrAdd(string s)
        {
            if (stringIndex.TryGetValue(s, out var idx)) return idx;
            idx = allStrings.Count;
            allStrings.Add(s);
            stringIndex[s] = idx;
            return idx;
        }

        var headerIndices = sheet.Headers.Select(GetOrAdd).ToList();
        var rowIndices = sheet.Rows.Select(r => r.Select(GetOrAdd).ToList()).ToList();
        int totalCols = sheet.Headers.Count;
        int totalRows = 1 + sheet.Rows.Count;

        string colLetter(int n)
        {
            var s = "";
            while (n > 0) { s = (char)('A' + (n - 1) % 26) + s; n = (n - 1) / 26; }
            return s;
        }

        var sheetData = new StringBuilder();
        sheetData.Append("<sheetData>");
        sheetData.Append("<row r=\"1\">");
        for (int c = 0; c < headerIndices.Count; c++)
        {
            sheetData.Append($"<c r=\"{colLetter(c + 1)}1\" t=\"s\"><v>{headerIndices[c]}</v></c>");
        }
        sheetData.Append("</row>");
        for (int r = 0; r < rowIndices.Count; r++)
        {
            sheetData.Append($"<row r=\"{r + 2}\">");
            var row = rowIndices[r];
            for (int c = 0; c < row.Count; c++)
            {
                sheetData.Append($"<c r=\"{colLetter(c + 1)}{r + 2}\" t=\"s\"><v>{row[c]}</v></c>");
            }
            sheetData.Append("</row>");
        }
        sheetData.Append("</sheetData>");
        string endRef = $"{colLetter(totalCols)}{totalRows}";
        string dimension = $"<dimension ref=\"A1:{endRef}\"/>";

        var sheetXml =
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
            "<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" " +
            "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">" +
            dimension +
            "<sheetViews><sheetView workbookViewId=\"0\"/></sheetViews>" +
            "<sheetFormatPr defaultRowHeight=\"15\"/>" +
            sheetData.ToString() +
            "<pageMargins left=\"0.7\" right=\"0.7\" top=\"0.75\" bottom=\"0.75\" header=\"0.3\" footer=\"0.3\"/>" +
            "</worksheet>";

        var sharedStringsSb = new StringBuilder();
        sharedStringsSb.Append(
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
            $"<sst xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" count=\"{allStrings.Count}\" uniqueCount=\"{allStrings.Count}\">");
        foreach (var s in allStrings)
        {
            sharedStringsSb.Append("<si><t>");
            sharedStringsSb.Append(EscapeXml(s));
            sharedStringsSb.Append("</t></si>");
        }
        sharedStringsSb.Append("</sst>");

        var workbookXml =
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
            "<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" " +
            "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">" +
            "<sheets>" +
            $"<sheet name=\"{EscapeXml(sheet.Name)}\" sheetId=\"1\" r:id=\"rId1\"/>" +
            "</sheets></workbook>";

        var relsXml =
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
            "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
            "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/>" +
            "<Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties\" Target=\"docProps/core.xml\"/>" +
            "<Relationship Id=\"rId3\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties\" Target=\"docProps/app.xml\"/>" +
            "</Relationships>";

        var wbRelsXml =
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
            "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
            "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/>" +
            "<Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings\" Target=\"sharedStrings.xml\"/>" +
            "</Relationships>";

        var coreXml =
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
            "<cp:coreProperties xmlns:cp=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\" " +
            "xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:dcterms=\"http://purl.org/dc/terms/\" " +
            "xmlns:dcmitype=\"http://purl.org/dc/dcmitype/\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">" +
            "<dc:creator>MiningGovApi</dc:creator><cp:lastModifiedBy>MiningGovApi</cp:lastModifiedBy>" +
            $"<dcterms:created xsi:type=\"dcterms:W3CDTF\">{DateTime.UtcNow:yyyy-MM-ddTHH:mm:ssZ}</dcterms:created>" +
            $"<dcterms:modified xsi:type=\"dcterms:W3CDTF\">{DateTime.UtcNow:yyyy-MM-ddTHH:mm:ssZ}</dcterms:modified>" +
            "</cp:coreProperties>";

        var appXml =
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
            "<Properties xmlns=\"http://schemas.openxmlformats.org/officeDocument/2006/extended-properties\" " +
            "xmlns:vt=\"http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes\">" +
            "<Application>MiningGovApi</Application></Properties>";

        var contentTypesXml =
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
            "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">" +
            "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>" +
            "<Default Extension=\"xml\" ContentType=\"application/xml\"/>" +
            "<Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>" +
            "<Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>" +
            "<Override PartName=\"/xl/sharedStrings.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml\"/>" +
            "<Override PartName=\"/docProps/core.xml\" ContentType=\"application/vnd.openxmlformats-package.core-properties+xml\"/>" +
            "<Override PartName=\"/docProps/app.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.extended-properties+xml\"/>" +
            "</Types>";

        return BuildZipArchive(new Dictionary<string, byte[]>
        {
            ["[Content_Types].xml"] = Encoding.UTF8.GetBytes(contentTypesXml),
            ["_rels/.rels"] = Encoding.UTF8.GetBytes(relsXml),
            ["docProps/core.xml"] = Encoding.UTF8.GetBytes(coreXml),
            ["docProps/app.xml"] = Encoding.UTF8.GetBytes(appXml),
            ["xl/workbook.xml"] = Encoding.UTF8.GetBytes(workbookXml),
            ["xl/_rels/workbook.xml.rels"] = Encoding.UTF8.GetBytes(wbRelsXml),
            ["xl/worksheets/sheet1.xml"] = Encoding.UTF8.GetBytes(sheetXml),
            ["xl/sharedStrings.xml"] = Encoding.UTF8.GetBytes(sharedStringsSb.ToString())
        });
    }

    private static string EscapeXml(string s)
    {
        if (string.IsNullOrEmpty(s)) return "";
        return s.Replace("&", "&amp;")
                .Replace("<", "&lt;")
                .Replace(">", "&gt;")
                .Replace("\"", "&quot;")
                .Replace("'", "&apos;");
    }

    private static byte[] BuildZipArchive(Dictionary<string, byte[]> entries)
    {
        using var ms = new MemoryStream();
        using (var writer = new System.IO.BinaryWriter(ms, System.Text.Encoding.UTF8, leaveOpen: true))
        {
            var localFileHeaders = new List<ZipLocalFileHeader>();
            var centralDir = new List<byte[]>();
            long centralDirStart = 0;

            foreach (var kv in entries)
            {
                string name = kv.Key;
                byte[] data = kv.Value;
                var crc32 = Crc32(data);
                ushort nameLen = (ushort)Encoding.UTF8.GetByteCount(name);
                byte[] nameBytes = Encoding.UTF8.GetBytes(name);

                long localHeaderOffset = ms.Position;

                writer.Write((uint)0x04034b50);
                writer.Write((ushort)20);
                writer.Write((ushort)0x0800);
                writer.Write((ushort)0);
                writer.Write((ushort)0);
                writer.Write((ushort)0);
                writer.Write(crc32);
                writer.Write((uint)data.Length);
                writer.Write((uint)data.Length);
                writer.Write(nameLen);
                writer.Write((ushort)0);
                writer.Write(nameBytes);
                writer.Write(data);

                localFileHeaders.Add(new ZipLocalFileHeader
                {
                    Offset = localHeaderOffset,
                    Crc32 = crc32,
                    CompressedSize = (uint)data.Length,
                    UncompressedSize = (uint)data.Length,
                    Name = name,
                    NameBytes = nameBytes
                });
            }

            centralDirStart = ms.Position;
            foreach (var lfh in localFileHeaders)
            {
                using var entryMs = new MemoryStream();
                using var entryWriter = new BinaryWriter(entryMs);
                entryWriter.Write((uint)0x02014b50);
                entryWriter.Write((ushort)20);
                entryWriter.Write((ushort)20);
                entryWriter.Write((ushort)0x0800);
                entryWriter.Write((ushort)0);
                entryWriter.Write((ushort)0);
                entryWriter.Write((ushort)0);
                entryWriter.Write(lfh.Crc32);
                entryWriter.Write(lfh.CompressedSize);
                entryWriter.Write(lfh.UncompressedSize);
                entryWriter.Write((ushort)Encoding.UTF8.GetByteCount(lfh.Name));
                entryWriter.Write((ushort)0);
                entryWriter.Write((ushort)0);
                entryWriter.Write((ushort)0);
                entryWriter.Write((ushort)0);
                entryWriter.Write((uint)0);
                entryWriter.Write((uint)lfh.Offset);
                entryWriter.Write(lfh.NameBytes);
                centralDir.Add(entryMs.ToArray());
            }
            long centralDirSize = 0;
            foreach (var d in centralDir)
            {
                writer.Write(d);
                centralDirSize += d.Length;
            }

            writer.Write((uint)0x06054b50);
            writer.Write((ushort)0);
            writer.Write((ushort)0);
            writer.Write((ushort)localFileHeaders.Count);
            writer.Write((ushort)localFileHeaders.Count);
            writer.Write((uint)centralDirSize);
            writer.Write((uint)centralDirStart);
            writer.Write((ushort)0);
        }
        return ms.ToArray();
    }

    private class ZipLocalFileHeader
    {
        public long Offset;
        public uint Crc32;
        public uint CompressedSize;
        public uint UncompressedSize;
        public string Name = "";
        public byte[] NameBytes = [];
    }

    private static uint Crc32(byte[] data)
    {
        uint poly = 0xedb88320u;
        uint[] table = new uint[256];
        for (uint i = 0; i < 256; i++)
        {
            uint c = i;
            for (int k = 0; k < 8; k++)
                c = (c & 1) != 0 ? poly ^ (c >> 1) : c >> 1;
            table[i] = c;
        }
        uint crc = 0xffffffffu;
        foreach (var b in data)
            crc = table[(crc ^ b) & 0xff] ^ (crc >> 8);
        return ~crc;
    }
}
