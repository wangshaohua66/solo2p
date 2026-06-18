package com.iccert.analytics.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

/**
 * 统计分析跨表查询 Mapper。
 * 直接查询各业务表（sample_info / inspection_task / inspection_report / certificate_info / sys_audit_log），
 * 所有数据均来自数据库真实聚合，禁止硬编码。
 */
@Mapper
public interface AnalyticsStatsMapper {

    @Select("SELECT COUNT(*) FROM sample_info WHERE is_deleted = 0")
    long countTotalSamples();

    @Select("SELECT COUNT(*) FROM inspection_task WHERE task_status IN ('PENDING','IN_PROGRESS') AND is_deleted = 0")
    long countPendingTasks();

    @Select("SELECT COUNT(*) FROM inspection_report WHERE overall_result = 'PASS' AND is_deleted = 0")
    long countPassReports();

    @Select("SELECT COUNT(*) FROM certificate_info WHERE cert_status = 'VALID' AND is_deleted = 0")
    long countValidCertificates();

    @Select("SELECT COUNT(*) FROM certificate_info WHERE cert_status = 'VALID' " +
            "AND expire_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY) AND is_deleted = 0")
    long countExpiringCerts();

    @Select("SELECT COUNT(*) FROM inspection_task WHERE task_status = 'IN_PROGRESS' " +
            "AND deadline < CURDATE() AND is_deleted = 0")
    long countOverdueTasks();

    @Select("SELECT ROUND(COUNT(CASE WHEN overall_result = 'PASS' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 1) " +
            "FROM inspection_report WHERE is_deleted = 0")
    Double calcPassRate();

    @Select("SELECT ROUND(AVG(TIMESTAMPDIFF(DAY, create_time, issue_time)), 1) " +
            "FROM inspection_report WHERE issue_time IS NOT NULL AND is_deleted = 0")
    Double calcAvgTurnaroundDays();

    @Select("SELECT DATE_FORMAT(create_time, '%Y-%m') AS month, COUNT(*) AS count " +
            "FROM sample_info WHERE create_time >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) AND is_deleted = 0 " +
            "GROUP BY month ORDER BY month")
    List<Map<String, Object>> monthlySampleTrend();

    @Select("SELECT IFNULL(product_category_name, '未分类') AS name, COUNT(*) AS value " +
            "FROM sample_info WHERE is_deleted = 0 " +
            "GROUP BY product_category_name ORDER BY value DESC")
    List<Map<String, Object>> sampleByCategory();

    @Select("SELECT log_no AS id, user_name AS user, operation AS action, " +
            "CONCAT(IFNULL(target_type,''), IF(target_id IS NOT NULL, CONCAT(':', target_id), '')) AS target, " +
            "operation_ip AS ip, operation_time AS time, operation_detail AS detail " +
            "FROM sys_audit_log ORDER BY operation_time DESC LIMIT 50")
    List<Map<String, Object>> selectAuditLogs();

    /* ============ 收入分析（基于 payment_record 表真实聚合） ============ */

    @Select("SELECT IFNULL(SUM(payment_amount), 0) FROM payment_record WHERE payment_status = 'SUCCESS'")
    Double sumTotalRevenue();

    @Select("SELECT IFNULL(SUM(payment_amount), 0) FROM payment_record " +
            "WHERE payment_status = 'SUCCESS' AND payment_time >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)")
    Double sumRevenueLast30Days();

    @Select("SELECT IFNULL(SUM(payment_amount), 0) FROM payment_record " +
            "WHERE payment_status = 'SUCCESS' AND YEAR(payment_time) = YEAR(CURDATE())")
    Double sumRevenueThisYear();

    @Select("SELECT DATE_FORMAT(payment_time, '%Y-%m') AS month, IFNULL(SUM(payment_amount), 0) AS revenue, COUNT(*) AS count " +
            "FROM payment_record WHERE payment_status = 'SUCCESS' " +
            "AND payment_time >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) " +
            "GROUP BY month ORDER BY month")
    List<Map<String, Object>> monthlyRevenueTrend();

    @Select("SELECT payment_method AS method, IFNULL(SUM(payment_amount), 0) AS revenue, COUNT(*) AS count " +
            "FROM payment_record WHERE payment_status = 'SUCCESS' " +
            "GROUP BY payment_method ORDER BY revenue DESC")
    List<Map<String, Object>> revenueByPaymentMethod();

    /* ============ 企业客户检测频次分析（跨 inspection_task / sample_info 真实聚合） ============ */

    @Select("SELECT IFNULL(s.company_id, 0) AS companyId, IFNULL(s.company_name, '未知企业') AS companyName, " +
            "COUNT(DISTINCT t.id) AS taskCount, COUNT(DISTINCT t.id) AS detectionCount " +
            "FROM inspection_task t LEFT JOIN sample_info s ON t.sample_id = s.id " +
            "WHERE t.is_deleted = 0 " +
            "GROUP BY s.company_id, s.company_name ORDER BY taskCount DESC LIMIT 20")
    List<Map<String, Object>> enterpriseDetectionFrequency();

    @Select("SELECT IFNULL(s.company_id, 0) AS companyId, IFNULL(s.company_name, '未知企业') AS companyName, " +
            "COUNT(*) AS sampleCount, " +
            "SUM(CASE WHEN s.sample_status IN ('TESTING','TESTED') THEN 1 ELSE 0 END) AS testedCount, " +
            "SUM(CASE WHEN s.sample_status = 'DESTROYED' THEN 1 ELSE 0 END) AS destroyedCount " +
            "FROM sample_info s WHERE s.is_deleted = 0 " +
            "GROUP BY s.company_id, s.company_name ORDER BY sampleCount DESC LIMIT 20")
    List<Map<String, Object>> enterpriseSampleFrequency();
}
