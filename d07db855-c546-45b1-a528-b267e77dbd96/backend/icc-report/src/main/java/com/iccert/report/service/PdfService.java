package com.iccert.report.service;

import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import com.iccert.report.entity.CertificateInfo;
import com.iccert.report.entity.InspectionReport;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * PDF 生成与电子签章叠加服务（基于 OpenPDF / iText5）。
 * 使用 STSong-Light CJK 字体支持中文渲染；
 * 电子签章支持加载外部图片，若无图片则绘制圆形电子印章，确保签章真正叠加到 PDF 而非仅存配置。
 */
@Slf4j
@Service
public class PdfService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy年MM月dd日");

    /**
     * 生成检测报告 PDF（结构化布局：标题/编号/信息表/检测结论/签发信息）。
     */
    public byte[] generateReportPdf(InspectionReport report) {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            Document document = new Document(PageSize.A4, 50, 50, 50, 50);
            PdfWriter.getInstance(document, baos);
            document.open();

            BaseFont bf = createChineseFont();

            Paragraph orgName = new Paragraph("省级检验检测认证中心", font(bf, 10, Font.NORMAL));
            orgName.setAlignment(Element.ALIGN_CENTER);
            document.add(orgName);

            Paragraph title = new Paragraph("检 测 报 告", font(bf, 22, Font.BOLD));
            title.setAlignment(Element.ALIGN_CENTER);
            title.setSpacingBefore(10);
            title.setSpacingAfter(8);
            document.add(title);

            Paragraph subtitle = new Paragraph("TESTING REPORT", font(bf, 10, Font.NORMAL));
            subtitle.setAlignment(Element.ALIGN_CENTER);
            subtitle.setSpacingAfter(24);
            document.add(subtitle);

            Paragraph code = new Paragraph("报告编号：" + safe(report.getReportCode()), font(bf, 12, Font.BOLD));
            code.setAlignment(Element.ALIGN_CENTER);
            code.setSpacingAfter(24);
            document.add(code);

            PdfPTable infoTable = new PdfPTable(new float[]{30f, 70f});
            infoTable.setWidthPercentage(100);
            addInfoRow(infoTable, bf, "报告标题", report.getReportTitle());
            addInfoRow(infoTable, bf, "委托企业", report.getCompanyName());
            addInfoRow(infoTable, bf, "认证类型", report.getCertTypeCode());
            addInfoRow(infoTable, bf, "报告版本", report.getReportVersion());
            addInfoRow(infoTable, bf, "编制人", report.getAuthorName());
            if (report.getReviewerName() != null) {
                addInfoRow(infoTable, bf, "审核人", report.getReviewerName());
            }
            if (report.getApproverName() != null) {
                addInfoRow(infoTable, bf, "批准人", report.getApproverName());
            }
            if (report.getIssueTime() != null) {
                addInfoRow(infoTable, bf, "签发日期", report.getIssueTime().format(DATE_FMT));
            }
            document.add(infoTable);

            document.add(Chunk.NEWLINE);

            Paragraph conclusionTitle = new Paragraph("一、检测结论", font(bf, 14, Font.BOLD));
            conclusionTitle.setSpacingBefore(16);
            conclusionTitle.setSpacingAfter(10);
            document.add(conclusionTitle);

            String resultText = "PASS".equals(report.getOverallResult()) ? "合格 (PASS)"
                    : "FAIL".equals(report.getOverallResult()) ? "不合格 (FAIL)"
                    : "待定 (PENDING)";
            Paragraph conclusion = new Paragraph(
                    "依据相关标准及委托方提供的技术要求，对送检样品进行了全项检测，综合判定结果为：" + resultText + "。",
                    font(bf, 12, Font.NORMAL));
            conclusion.setLeading(22);
            document.add(conclusion);

            document.add(Chunk.NEWLINE);
            Paragraph note = new Paragraph("（详细检测项目数据见系统在线报告预览，原始记录已防篡改存档）",
                    font(bf, 10, Font.ITALIC));
            note.setAlignment(Element.ALIGN_RIGHT);
            document.add(note);

            document.close();
            return baos.toByteArray();
        } catch (Exception e) {
            log.error("生成报告PDF失败, reportCode={}", report.getReportCode(), e);
            throw new RuntimeException("生成报告PDF失败: " + e.getMessage(), e);
        }
    }

    /**
     * 生成证书 PDF 并叠加电子签章。
     * 若 signatureImageUrl 可访问，则加载签章图片叠加至右下角；
     * 否则用 OpenPDF 绘制圆形电子印章（含认证中心名称 + 签发日期），确保签章真实叠加到 PDF。
     */
    public byte[] generateCertificatePdfWithSignature(CertificateInfo cert, String signatureImageUrl) {
        byte[] certPdf = generateCertificatePdf(cert);
        return stampSignature(certPdf, signatureImageUrl, cert);
    }

    private byte[] generateCertificatePdf(CertificateInfo cert) {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            Document document = new Document(PageSize.A4, 60, 60, 60, 60);
            PdfWriter.getInstance(document, baos);
            document.open();

            BaseFont bf = createChineseFont();

            Paragraph title = new Paragraph("认 证 证 书", font(bf, 26, Font.BOLD));
            title.setAlignment(Element.ALIGN_CENTER);
            title.setSpacingAfter(6);
            document.add(title);

            Paragraph enTitle = new Paragraph("CERTIFICATE", font(bf, 12, Font.NORMAL));
            enTitle.setAlignment(Element.ALIGN_CENTER);
            enTitle.setSpacingAfter(24);
            document.add(enTitle);

            Paragraph certNo = new Paragraph("证书编号：" + safe(cert.getCertNo()), font(bf, 12, Font.BOLD));
            certNo.setAlignment(Element.ALIGN_CENTER);
            certNo.setSpacingAfter(28);
            document.add(certNo);

            PdfPTable infoTable = new PdfPTable(new float[]{30f, 70f});
            infoTable.setWidthPercentage(100);
            addInfoRow(infoTable, bf, "获证企业", cert.getCompanyName());
            addInfoRow(infoTable, bf, "产品名称", cert.getProductName());
            if (cert.getProductModel() != null) {
                addInfoRow(infoTable, bf, "产品型号", cert.getProductModel());
            }
            addInfoRow(infoTable, bf, "认证类型", cert.getCertTypeCode() + " 认证");
            addInfoRow(infoTable, bf, "认证依据", cert.getStandardCode());
            if (cert.getIssueDate() != null) {
                addInfoRow(infoTable, bf, "发证日期", cert.getIssueDate().format(DATE_FMT));
            }
            if (cert.getExpireDate() != null) {
                addInfoRow(infoTable, bf, "有效期至", cert.getExpireDate().format(DATE_FMT));
            }
            addInfoRow(infoTable, bf, "签发人", cert.getIssuerName());
            document.add(infoTable);

            document.add(Chunk.NEWLINE);
            Paragraph validity = new Paragraph(
                    "本证书有效期 " + (cert.getValidYears() != null ? cert.getValidYears() : 3) + " 年，在有效期内上述产品符合相关认证要求。",
                    font(bf, 11, Font.NORMAL));
            validity.setLeading(20);
            document.add(validity);

            document.close();
            return baos.toByteArray();
        } catch (Exception e) {
            log.error("生成证书PDF失败, certNo={}", cert.getCertNo(), e);
            throw new RuntimeException("生成证书PDF失败: " + e.getMessage(), e);
        }
    }

    /**
     * 将电子签章叠加到 PDF 右下角。
     * 优先加载外部签章图片；若加载失败或未提供，则绘制圆形电子印章。
     */
    private byte[] stampSignature(byte[] pdfBytes, String signatureImageUrl, CertificateInfo cert) {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            PdfReader reader = new PdfReader(pdfBytes);
            PdfStamper stamper = new PdfStamper(reader, baos);
            PdfContentByte over = stamper.getOverContent(1);

            boolean imageStamped = false;
            if (signatureImageUrl != null && !signatureImageUrl.isEmpty()) {
                try {
                    Image image = Image.getInstance(signatureImageUrl);
                    image.setAbsolutePosition(380, 80);
                    image.scaleAbsolute(110, 110);
                    over.addImage(image);
                    imageStamped = true;
                    log.info("已叠加外部签章图片: {}", signatureImageUrl);
                } catch (Exception imgEx) {
                    log.warn("加载签章图片失败, 将绘制电子印章: {}", imgEx.getMessage());
                }
            }

            if (!imageStamped) {
                drawSealStamp(over, cert);
                log.info("已绘制圆形电子签章到证书: {}", cert.getCertNo());
            }

            stamper.close();
            reader.close();
            return baos.toByteArray();
        } catch (Exception e) {
            log.error("叠加签章失败, 返回原始PDF", e);
            return pdfBytes;
        }
    }

    /**
     * 用 OpenPDF 绘制圆形电子印章（红色边框 + 五角星 + 认证中心名称 + 签发日期）。
     */
    private void drawSealStamp(PdfContentByte cb, CertificateInfo cert) {
        float centerX = 435;
        float centerY = 135;
        float radius = 55;

        cb.saveState();
        cb.setRGBColorStroke(200, 30, 30);
        cb.setRGBColorFill(200, 30, 30);
        cb.setLineWidth(2.5f);

        cb.circle(centerX, centerY, radius);
        cb.stroke();

        cb.setLineWidth(1.2f);
        cb.circle(centerX, centerY, radius - 6);
        cb.stroke();

        drawStar(cb, centerX, centerY + 18, 10);

        try {
            BaseFont bf = createChineseFont();
            cb.beginText();
            cb.setFontAndSize(bf, 10);
            cb.showTextAligned(PdfContentByte.ALIGN_CENTER, "检验检测认证中心",
                    centerX, centerY - 8, 0);
            cb.setFontAndSize(bf, 8);
            String dateStr = cert.getIssueDate() != null ? cert.getIssueDate().format(DATE_FMT) : LocalDate.now().format(DATE_FMT);
            cb.showTextAligned(PdfContentByte.ALIGN_CENTER, dateStr,
                    centerX, centerY - 24, 0);
            cb.endText();
        } catch (Exception e) {
            log.warn("绘制印章文字失败", e);
        }

        cb.restoreState();
    }

    private void drawStar(PdfContentByte cb, float cx, float cy, float r) {
        double[] angles = new double[10];
        for (int i = 0; i < 10; i++) {
            angles[i] = Math.PI / 2 + i * Math.PI / 5;
        }
        cb.setRGBColorFill(200, 30, 30);
        cb.moveTo(cx + (float) (r * Math.cos(angles[0])), cy + (float) (r * Math.sin(angles[0])));
        for (int i = 1; i < 10; i++) {
            float rr = i % 2 == 0 ? r : r * 0.4f;
            cb.lineTo(cx + (float) (rr * Math.cos(angles[i])), cy + (float) (rr * Math.sin(angles[i])));
        }
        cb.closePath();
        cb.fill();
    }

    private BaseFont createChineseFont() {
        try {
            return BaseFont.createFont("STSong-Light", "UniGB-UCS2-H", BaseFont.NOT_EMBEDDED);
        } catch (Exception e) {
            log.warn("创建中文字体失败, 使用Helvetica", e);
            try {
                return BaseFont.createFont(BaseFont.HELVETICA, BaseFont.WINANSI, BaseFont.NOT_EMBEDDED);
            } catch (Exception ex) {
                return null;
            }
        }
    }

    private Font font(BaseFont bf, float size, int style) {
        if (bf == null) {
            return new Font(Font.UNDEFINED, size, style);
        }
        return new Font(bf, size, style);
    }

    private void addInfoRow(PdfPTable table, BaseFont bf, String label, String value) {
        PdfPCell labelCell = new PdfPCell(new Phrase(safe(label), font(bf, 11, Font.BOLD)));
        labelCell.setBackgroundColor(new Color(245, 247, 250));
        labelCell.setPadding(8);
        labelCell.setBorderColor(new Color(220, 223, 230));
        table.addCell(labelCell);

        PdfPCell valueCell = new PdfPCell(new Phrase(safe(value), font(bf, 11, Font.NORMAL)));
        valueCell.setPadding(8);
        valueCell.setBorderColor(new Color(220, 223, 230));
        table.addCell(valueCell);
    }

    private String safe(String s) {
        return s != null ? s : "-";
    }
}
