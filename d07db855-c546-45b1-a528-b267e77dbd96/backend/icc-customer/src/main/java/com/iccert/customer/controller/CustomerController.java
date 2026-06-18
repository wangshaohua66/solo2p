package com.iccert.customer.controller;

import com.iccert.common.result.R;
import com.iccert.customer.entity.InvoiceApplication;
import com.iccert.customer.entity.InspectionApplication;
import com.iccert.customer.entity.PaymentRecord;
import com.iccert.customer.service.CustomerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Tag(name = "客户自助服务", description = "企业在线申请、寄送预约、进度查询、报告下载、在线支付、发票申请")
@RestController
@RequestMapping
@RequiredArgsConstructor
public class CustomerController {

    private final CustomerService customerService;

    @Operation(summary = "提交在线检测申请")
    @PostMapping("/application/submit")
    public R<InspectionApplication> submitApp(@RequestBody Map<String, Object> params,
                                              HttpServletRequest request) {
        Long userId = Long.valueOf(request.getHeader("X-User-Id"));
        String username = request.getHeader("X-Username");
        return R.ok(customerService.submitApplication(
                Long.valueOf(params.get("companyId").toString()),
                (String) params.get("companyName"), userId, username,
                (String) params.get("productName"),
                (String) params.get("productModel"),
                Long.valueOf(params.get("productCategoryId").toString()),
                (String) params.get("productCategoryName"),
                Long.valueOf(params.get("certTypeId").toString()),
                (String) params.get("certTypeCode"),
                Integer.valueOf(params.get("sampleAmount").toString()),
                (String) params.get("standardCode"),
                (String) params.getOrDefault("sendMethod", "EXPRESS"),
                params.get("expectedSendDate") != null ? LocalDate.parse(params.get("expectedSendDate").toString()) : LocalDate.now(),
                (String) params.get("expressCompany"),
                (String) params.get("expressNo"),
                (String) params.get("receiveAddress"),
                (String) params.get("receiverName"),
                (String) params.get("receiverPhone"),
                params.get("totalAmount") != null ? new BigDecimal(params.get("totalAmount").toString()) : BigDecimal.ZERO,
                (String) params.get("remark")));
    }

    @Operation(summary = "审核受理申请")
    @PostMapping("/application/{id}/audit")
    public R<InspectionApplication> auditApp(@PathVariable Long id,
                                             @RequestParam String status,
                                             @RequestParam(required = false) String reason,
                                             HttpServletRequest request) {
        Long userId = Long.valueOf(request.getHeader("X-User-Id"));
        return R.ok(customerService.auditApplication(id, status, reason, userId));
    }

    @Operation(summary = "实时进度查询(时间轴)")
    @GetMapping("/application/{id}/progress")
    public R<List<Map<String, Object>>> getProgress(@PathVariable Long id) {
        return R.ok(customerService.getProgress(id));
    }

    @Operation(summary = "下载检测报告")
    @GetMapping("/application/{id}/report-download")
    public R<Map<String, Object>> downloadReport(@PathVariable Long id) {
        return R.ok(Map.of("reportUrl", "/api/report/pdf/" + id, "filename", "report_" + id + ".pdf"));
    }

    @Operation(summary = "在线支付")
    @PostMapping("/application/{id}/pay")
    public R<PaymentRecord> pay(@PathVariable Long id,
                                @RequestParam String method,
                                @RequestParam BigDecimal amount,
                                HttpServletRequest request) {
        Long userId = Long.valueOf(request.getHeader("X-User-Id"));
        return R.ok(customerService.payApplication(id, method, amount, userId));
    }

    @Operation(summary = "申请发票")
    @PostMapping("/invoice/apply")
    public R<InvoiceApplication> applyInvoice(@RequestBody Map<String, Object> params) {
        return R.ok(customerService.applyInvoice(
                Long.valueOf(params.get("applicationId").toString()),
                Long.valueOf(params.get("companyId").toString()),
                (String) params.get("invoiceTitle"),
                (String) params.get("taxpayerNo"),
                (String) params.getOrDefault("invoiceType", "ELECTRONIC"),
                (String) params.get("receiverName"),
                (String) params.get("receiverPhone"),
                (String) params.get("receiverAddress"),
                (String) params.get("receiverEmail"),
                new BigDecimal(params.get("invoiceAmount").toString()),
                (String) params.getOrDefault("invoiceContent", "检测认证服务费")));
    }

    @Operation(summary = "查询我的申请列表")
    @GetMapping("/application/mine")
    public R<List<InspectionApplication>> listMyApps(@RequestParam Long companyId) {
        return R.ok(customerService.listByCompany(companyId));
    }

    @Operation(summary = "查询我的发票申请")
    @GetMapping("/invoice/mine")
    public R<List<InvoiceApplication>> listMyInvoices(@RequestParam Long companyId) {
        return R.ok(customerService.listInvoices(companyId));
    }
}
