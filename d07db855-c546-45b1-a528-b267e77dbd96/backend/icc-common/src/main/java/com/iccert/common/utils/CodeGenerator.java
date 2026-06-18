package com.iccert.common.utils;

import cn.hutool.core.date.DateUtil;
import cn.hutool.core.util.StrUtil;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class CodeGenerator {

    public static String genSampleCode() {
        return "SP" + DateUtil.format(new java.util.Date(), "yyyyMMdd") +
                String.format("%04d", (int)(Math.random() * 10000));
    }

    public static String genTaskCode() {
        return "TK" + DateUtil.format(new java.util.Date(), "yyyyMMdd") +
                String.format("%04d", (int)(Math.random() * 10000));
    }

    public static String genReportCode() {
        return "RP" + DateUtil.format(new java.util.Date(), "yyyyMMdd") +
                String.format("%04d", (int)(Math.random() * 10000));
    }

    public static String genCertNo(String certTypeCode) {
        return certTypeCode + DateUtil.format(new java.util.Date(), "yyyyMMdd") +
                String.format("%05d", (int)(Math.random() * 100000));
    }

    public static String genApplicationNo() {
        return "AP" + DateUtil.format(new java.util.Date(), "yyyyMMdd") +
                String.format("%04d", (int)(Math.random() * 10000));
    }

    public static String genPaymentNo() {
        return "PAY" + DateUtil.format(new java.util.Date(), "yyyyMMddHHmmss") +
                String.format("%03d", (int)(Math.random() * 1000));
    }

    public static String genInvoiceNo() {
        return "INV" + DateUtil.format(new java.util.Date(), "yyyyMMdd") +
                String.format("%04d", (int)(Math.random() * 10000));
    }

    public static String genRecordCode() {
        return "REC" + DateUtil.format(new java.util.Date(), "yyyyMMddHHmmss") +
                String.format("%03d", (int)(Math.random() * 1000));
    }

    public static String genAuditLogNo() {
        return "LOG" + DateUtil.format(new java.util.Date(), "yyyyMMddHHmmss") +
                String.format("%04d", (int)(Math.random() * 10000));
    }

    public static LocalDate calcRetentionExpireDate(int retentionDays) {
        return LocalDate.now().plusDays(retentionDays);
    }

    public static LocalDate calcCertExpireDate(int validYears) {
        return LocalDate.now().plusYears(validYears);
    }

    public static LocalDate calcReminderDate(LocalDate expireDate, int reminderDays) {
        return expireDate.minusDays(reminderDays);
    }
}
