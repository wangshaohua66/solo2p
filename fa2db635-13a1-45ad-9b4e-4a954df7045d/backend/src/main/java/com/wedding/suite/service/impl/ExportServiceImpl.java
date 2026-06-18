package com.wedding.suite.service.impl;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import com.wedding.suite.entity.ContractEntity;
import com.wedding.suite.entity.FinanceEntity;
import com.wedding.suite.entity.WeddingEntity;
import com.wedding.suite.exception.BusinessException;
import com.wedding.suite.exception.ErrorCode;
import com.wedding.suite.repository.ContractRepository;
import com.wedding.suite.repository.FinanceRepository;
import com.wedding.suite.repository.WeddingRepository;
import com.wedding.suite.service.ExportService;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ExportServiceImpl implements ExportService {

    private static final Logger log = LoggerFactory.getLogger(ExportServiceImpl.class);
    private static final String CJK_FONT_PATH = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf";

    private final FinanceRepository financeRepo;
    private final WeddingRepository weddingRepo;
    private final ContractRepository contractRepo;
    private final ReportService reportService;

    public ExportServiceImpl(FinanceRepository financeRepo, WeddingRepository weddingRepo,
                             ContractRepository contractRepo, ReportService reportService) {
        this.financeRepo = financeRepo;
        this.weddingRepo = weddingRepo;
        this.contractRepo = contractRepo;
        this.reportService = reportService;
    }

    @Override
    public byte[] exportFinanceExcel(Long storeId) {
        List<FinanceEntity> list = financeRepo.findAll().stream()
                .filter(f -> storeId == null || weddingRepo.findById(f.getWeddingId())
                        .map(w -> storeId.equals(w.getStoreId())).orElse(false))
                .collect(Collectors.toList());
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("财务汇总");
            RowStyle rs = headerStyle(wb);
            Row header = sheet.createRow(0);
            String[] cols = {"婚礼ID", "新人", "收入", "已收", "成本", "已付", "利润"};
            for (int i = 0; i < cols.length; i++) header.createCell(i).setCellValue(cols[i]);
            header.setRowStyle(rs.style());
            int r = 1;
            for (FinanceEntity f : list) {
                Row row = sheet.createRow(r++);
                row.createCell(0).setCellValue(f.getWeddingId());
                row.createCell(1).setCellValue(safe(f.getCoupleName()));
                row.createCell(2).setCellValue(num(f.getIncome()));
                row.createCell(3).setCellValue(num(f.getReceived()));
                row.createCell(4).setCellValue(num(f.getCost()));
                row.createCell(5).setCellValue(num(f.getPaid()));
                row.createCell(6).setCellValue(num(f.getProfit()));
            }
            autosize(sheet, cols.length);
            wb.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            log.error("导出财务Excel失败", e);
            throw new BusinessException(ErrorCode.EXPORT_FAILED, "导出财务Excel失败: " + e.getMessage());
        }
    }

    @Override
    public byte[] exportWeddingsExcel(Long storeId, String stage) {
        List<WeddingEntity> list = weddingRepo.findAll();
        if (storeId != null) list = list.stream().filter(w -> storeId.equals(w.getStoreId())).collect(Collectors.toList());
        if (stage != null && !stage.isBlank()) list = list.stream().filter(w -> w.getStage().name().equals(stage)).collect(Collectors.toList());
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("婚礼列表");
            Row header = sheet.createRow(0);
            String[] cols = {"ID", "新人", "新郎", "新娘", "电话", "婚期", "桌数", "阶段", "门店", "套餐", "报价", "进度"};
            for (int i = 0; i < cols.length; i++) header.createCell(i).setCellValue(cols[i]);
            int r = 1;
            for (WeddingEntity w : list) {
                Row row = sheet.createRow(r++);
                row.createCell(0).setCellValue(w.getId());
                row.createCell(1).setCellValue(safe(w.getCoupleName()));
                row.createCell(2).setCellValue(safe(w.getGroomName()));
                row.createCell(3).setCellValue(safe(w.getBrideName()));
                row.createCell(4).setCellValue(safe(w.getPhone()));
                row.createCell(5).setCellValue(w.getWeddingDate() == null ? "" : w.getWeddingDate().toString());
                row.createCell(6).setCellValue(w.getGuests() == null ? 0 : w.getGuests());
                row.createCell(7).setCellValue(w.getStage() == null ? "" : w.getStage().name());
                row.createCell(8).setCellValue(w.getStoreId());
                row.createCell(9).setCellValue(w.getPackageId());
                row.createCell(10).setCellValue(num(w.getQuoteTotal()));
                row.createCell(11).setCellValue(w.getProgress() == null ? 0 : w.getProgress());
            }
            autosize(sheet, cols.length);
            wb.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            log.error("导出婚礼Excel失败", e);
            throw new BusinessException(ErrorCode.EXPORT_FAILED, "导出婚礼Excel失败: " + e.getMessage());
        }
    }

    @Override
    public byte[] exportReportExcel(Long storeId) {
        var summary = reportService.summary();
        var funnel = reportService.funnel();
        var revenue = reportService.revenue(storeId);
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("经营报表");
            String[][] rows = {
                    {"指标", "数值"},
                    {"总营收", summary.getRevenue().toPlainString()},
                    {"总成本", summary.getCost().toPlainString()},
                    {"总利润", summary.getProfit().toPlainString()},
                    {"婚礼数", String.valueOf(summary.getWeddings())},
                    {"已签合同", String.valueOf(summary.getSigned())},
                    {"档期冲突预警", String.valueOf(summary.getConflictAlerts())},
                    {"逾期应收", summary.getOverdueReceivable().toPlainString()}
            };
            for (int i = 0; i < rows.length; i++) {
                Row row = sheet.createRow(i);
                row.createCell(0).setCellValue(rows[i][0]);
                row.createCell(1).setCellValue(rows[i][1]);
            }
            int start = rows.length + 2;
            Row fr = sheet.createRow(start);
            fr.createCell(0).setCellValue("漏斗阶段");
            fr.createCell(1).setCellValue("数量");
            for (int i = 0; i < funnel.size(); i++) {
                Row row = sheet.createRow(start + 1 + i);
                row.createCell(0).setCellValue(funnel.get(i).getStage());
                row.createCell(1).setCellValue(funnel.get(i).getCount());
            }
            int rstart = start + funnel.size() + 3;
            Row rr = sheet.createRow(rstart);
            rr.createCell(0).setCellValue("婚期");
            rr.createCell(1).setCellValue("报价");
            for (int i = 0; i < revenue.size(); i++) {
                Row row = sheet.createRow(rstart + 1 + i);
                row.createCell(0).setCellValue(revenue.get(i).getDate());
                row.createCell(1).setCellValue(revenue.get(i).getAmount().toPlainString());
            }
            autosize(sheet, 2);
            wb.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            log.error("导出报表Excel失败", e);
            throw new BusinessException(ErrorCode.EXPORT_FAILED, "导出报表Excel失败: " + e.getMessage());
        }
    }

    @Override
    public byte[] exportContractPdf(Long contractId) {
        ContractEntity c = contractRepo.findById(contractId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "合同不存在"));
        StringBuilder sb = new StringBuilder();
        sb.append("<!DOCTYPE html><html><head><meta charset=\"UTF-8\"/><style>");
        sb.append("body{font-family:'ArialUnicode',sans-serif;font-size:12px;color:#222;margin:32px;}");
        sb.append("h1{text-align:center;color:#b8860b;border-bottom:2px solid #b8860b;padding-bottom:8px;}");
        sb.append(".meta{margin:12px 0;line-height:1.8;} .label{color:#666;width:80px;display:inline-block;}");
        sb.append("ol{padding-left:20px;} li{margin:8px 0;} .title{font-weight:bold;color:#333;}");
        sb.append("</style></head><body>");
        sb.append("<h1>婚礼服务合同</h1>");
        sb.append("<div class=\"meta\"><span class=\"label\">合同编号：</span>#").append(c.getId()).append("</div>");
        sb.append("<div class=\"meta\"><span class=\"label\">新人：</span>").append(esc(c.getCoupleName())).append("</div>");
        sb.append("<div class=\"meta\"><span class=\"label\">套餐：</span>").append(esc(c.getPackageName())).append("</div>");
        sb.append("<div class=\"meta\"><span class=\"label\">合同金额：</span>¥").append(c.getAmount().toPlainString()).append("</div>");
        sb.append("<div class=\"meta\"><span class=\"label\">合同状态：</span>").append(c.getStatus().name()).append("</div>");
        sb.append("<div class=\"meta\"><span class=\"label\">签署时间：</span>").append(c.getSignedAt() == null ? "未签署" : c.getSignedAt().toString()).append("</div>");
        sb.append("<h3>合同条款</h3><ol>");
        if (c.getClauses() != null) {
            c.getClauses().forEach(cl -> sb.append("<li><span class=\"title\">").append(esc(cl.getTitle()))
                    .append("</span><div>").append(esc(cl.getBody())).append("</div></li>"));
        }
        sb.append("</ol>");
        if (c.getSignature() != null || c.getSignUrl() != null) {
            sb.append("<div class=\"meta\"><span class=\"label\">签署：</span>")
                    .append(c.getSignature() != null ? "已手写签署" : "电子签署")
                    .append(c.getSignUrl() != null ? "（" + esc(c.getSignUrl()) + "）" : "")
                    .append("</div>");
        }
        sb.append("</body></html>");
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            File font = new File(CJK_FONT_PATH);
            if (font.exists()) {
                builder.useFont(font, "ArialUnicode");
            }
            builder.withHtmlContent(sb.toString(), null);
            builder.toStream(out);
            builder.run();
            return out.toByteArray();
        } catch (Exception e) {
            log.error("导出合同PDF失败", e);
            throw new BusinessException(ErrorCode.EXPORT_FAILED, "导出合同PDF失败: " + e.getMessage());
        }
    }

    private String safe(String s) {
        return s == null ? "" : s;
    }

    private double num(BigDecimal v) {
        return v == null ? 0d : v.doubleValue();
    }

    private String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private void autosize(Sheet sheet, int cols) {
        for (int i = 0; i < cols; i++) sheet.autoSizeColumn(i);
    }

    private record RowStyle(CellStyle style) {}

    private RowStyle headerStyle(Workbook wb) {
        CellStyle style = wb.createCellStyle();
        Font font = wb.createFont();
        font.setBold(true);
        style.setFont(font);
        return new RowStyle(style);
    }
}
