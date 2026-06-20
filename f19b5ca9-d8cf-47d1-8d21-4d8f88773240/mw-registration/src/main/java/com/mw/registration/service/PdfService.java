package com.mw.registration.service;

import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.Image;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.mw.common.enums.WasteCategory;
import com.mw.registration.document.ElectronicManifest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.format.DateTimeFormatter;
import java.util.Map;

/**
 * 电子联单PDF生成：符合国家标准的联单版式，含产废单位、废物类别、重量、
 * 收运单位、处置单位、联单编号、二维码。使用 OpenPDF + ZXing。
 */
@Slf4j
@Service
public class PdfService {

    private static final Font TITLE_FONT = new Font(Font.HELVETICA, 16, Font.BOLD);
    private static final Font NORMAL_FONT = new Font(Font.HELVETICA, 11, Font.NORMAL);
    private static final Font BOLD_FONT = new Font(Font.HELVETICA, 11, Font.BOLD);
    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public byte[] generate(ElectronicManifest manifest) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document document = new Document();
            PdfWriter.getInstance(document, out);
            document.open();

            Paragraph title = new Paragraph("医疗废物危险废物转移联单（电子）", TITLE_FONT);
            title.setAlignment(Element.ALIGN_CENTER);
            document.add(title);
            document.add(new Paragraph("联单编号: " + manifest.getManifestNo(), NORMAL_FONT));
            document.add(new Paragraph("生成时间: " + (manifest.getCreateTime() == null ? "" : manifest.getCreateTime().format(FMT)), NORMAL_FONT));
            document.add(new Paragraph(" "));

            PdfPTable table = new PdfPTable(2);
            table.setWidthPercentage(100);
            addRow(table, "产废单位", manifest.getOrgName() + "（" + manifest.getOrgId() + "）");
            addRow(table, "废物类别/重量", formatCategoryWeights(manifest.getCategoryWeights()));
            addRow(table, "合计重量(kg)", String.valueOf(manifest.getTotalWeightKg()));
            addRow(table, "收运单位", safe(manifest.getTransporterOrgName()));
            addRow(table, "处置单位", safe(manifest.getDisposerOrgName()));
            addRow(table, "追溯编码数", String.valueOf(manifest.getTraceCodes() == null ? 0 : manifest.getTraceCodes().size()));
            addRow(table, "二维码内容", manifest.getPackageQrCode());
            document.add(table);

            document.add(new Paragraph(" "));
            try {
                byte[] qr = generateQr(manifest.getPackageQrCode(), 160);
                Image img = Image.getInstance(qr);
                img.setAlignment(Element.ALIGN_CENTER);
                document.add(img);
                document.add(new Paragraph("扫描二维码可溯源全流程", NORMAL_FONT));
            } catch (Exception e) {
                log.warn("二维码生成失败: {}", e.getMessage());
            }

            document.add(new Paragraph(" "));
            document.add(new Paragraph("声明：本联单依据《医疗废物管理条例》《危险废物转移管理办法》生成，数据不可篡改。", NORMAL_FONT));
            document.close();
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("生成联单PDF失败", e);
        }
    }

    private void addRow(PdfPTable table, String label, String value) {
        PdfPCell labelCell = new PdfPCell(new Phrase(label, BOLD_FONT));
        labelCell.setBackgroundColor(new Color(230, 230, 230));
        table.addCell(labelCell);
        table.addCell(new Phrase(value == null ? "" : value, NORMAL_FONT));
    }

    private String formatCategoryWeights(Map<WasteCategory, Double> weights) {
        if (weights == null || weights.isEmpty()) {
            return "-";
        }
        StringBuilder sb = new StringBuilder();
        weights.forEach((c, w) -> sb.append(c.getName()).append(":").append(String.format("%.2f", w)).append("kg; "));
        return sb.toString();
    }

    private String safe(String s) {
        return s == null ? "-" : s;
    }

    private byte[] generateQr(String content, int size) throws Exception {
        BitMatrix matrix = new MultiFormatWriter()
                .encode(content, BarcodeFormat.QR_CODE, size, size);
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        MatrixToImageWriter.writeToStream(matrix, "PNG", bos);
        return bos.toByteArray();
    }
}
