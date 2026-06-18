package com.iccert.customer.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.iccert.common.exception.BusinessException;
import com.iccert.common.utils.CodeGenerator;
import com.iccert.customer.entity.InvoiceApplication;
import com.iccert.customer.entity.InspectionApplication;
import com.iccert.customer.entity.PaymentRecord;
import com.iccert.customer.mapper.InvoiceApplicationMapper;
import com.iccert.customer.mapper.InspectionApplicationMapper;
import com.iccert.customer.mapper.PaymentRecordMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomerService {

    private final InspectionApplicationMapper appMapper;
    private final PaymentRecordMapper payMapper;
    private final InvoiceApplicationMapper invoiceMapper;

    @Transactional
    public InspectionApplication submitApplication(Long companyId, String companyName,
                                                    Long applicantId, String applicantName,
                                                    String productName, String productModel,
                                                    Long productCategoryId, String productCategoryName,
                                                    Long certTypeId, String certTypeCode,
                                                    Integer sampleAmount, String standardCode,
                                                    String sendMethod, LocalDate expectedSendDate,
                                                    String expressCompany, String expressNo,
                                                    String receiveAddress, String receiverName,
                                                    String receiverPhone, BigDecimal totalAmount,
                                                    String remark) {
        InspectionApplication app = new InspectionApplication();
        app.setApplicationNo(CodeGenerator.genApplicationNo());
        app.setCompanyId(companyId);
        app.setCompanyName(companyName);
        app.setApplicantId(applicantId);
        app.setApplicantName(applicantName);
        app.setProductName(productName);
        app.setProductModel(productModel);
        app.setProductCategoryId(productCategoryId);
        app.setProductCategoryName(productCategoryName);
        app.setCertTypeId(certTypeId);
        app.setCertTypeCode(certTypeCode);
        app.setSampleAmount(sampleAmount);
        app.setStandardCode(standardCode);
        app.setApplicationStatus("SUBMITTED");
        app.setSampleSendMethod(sendMethod);
        app.setExpectedSendDate(expectedSendDate);
        app.setExpressCompany(expressCompany);
        app.setExpressNo(expressNo);
        app.setReceiveAddress(receiveAddress);
        app.setReceiverName(receiverName);
        app.setReceiverPhone(receiverPhone);
        app.setTotalAmount(totalAmount != null ? totalAmount : new BigDecimal("0"));
        app.setPaidAmount(BigDecimal.ZERO);
        app.setPaymentStatus("UNPAID");
        app.setSubmitTime(LocalDateTime.now());
        app.setRemark(remark);
        appMapper.insert(app);
        log.info("企业在线申请已提交: {}, 产品: {}, 认证: {}", app.getApplicationNo(), productName, certTypeCode);
        return app;
    }

    public InspectionApplication auditApplication(Long appId, String status, String reason,
                                                   Long operatorId) {
        InspectionApplication app = appMapper.selectById(appId);
        if (app == null) throw new BusinessException("申请不存在");
        app.setApplicationStatus(status);
        if ("REJECTED".equals(status)) app.setRejectReason(reason);
        app.setAuditTime(LocalDateTime.now());
        appMapper.updateById(app);
        log.info("申请{}审核结果: {}", appId, status);
        return app;
    }

    public List<Map<String, Object>> getProgress(Long appId) {
        InspectionApplication app = appMapper.selectById(appId);
        if (app == null) throw new BusinessException("申请不存在");
        List<Map<String, Object>> progress = new ArrayList<>();
        progress.add(makeStep("提交申请", app.getSubmitTime(),
                app.getApplicationStatus().compareTo("SUBMITTED") >= 0,
                "企业已在线提交检测申请"));
        progress.add(makeStep("审核受理", app.getAuditTime(),
                app.getApplicationStatus().compareTo("AUDITED") >= 0,
                "实验室审核员已受理申请"));
        progress.add(makeStep("样品接收", null,
                app.getSampleId() != null,
                "样品管理员已签收登记"));
        progress.add(makeStep("检测进行", null,
                app.getTaskId() != null,
                "实验室技术员正在检测"));
        progress.add(makeStep("报告出具", null,
                app.getReportId() != null,
                "报告审核员已签发检测报告"));
        progress.add(makeStep("证书签发", null,
                app.getCertificateId() != null,
                "认证专家已签发认证证书"));
        progress.add(makeStep("完成交付", null,
                "COMPLETED".equals(app.getApplicationStatus()),
                "检测/认证已全部完成"));
        return progress;
    }

    private Map<String, Object> makeStep(String name, LocalDateTime time, boolean done, String desc) {
        Map<String, Object> s = new HashMap<>();
        s.put("name", name);
        s.put("time", time);
        s.put("done", done);
        s.put("description", desc);
        return s;
    }

    @Transactional
    public PaymentRecord payApplication(Long appId, String paymentMethod, BigDecimal amount,
                                        Long operatorId) {
        InspectionApplication app = appMapper.selectById(appId);
        if (app == null) throw new BusinessException("申请不存在");
        PaymentRecord pay = new PaymentRecord();
        pay.setPaymentNo(CodeGenerator.genPaymentNo());
        pay.setApplicationId(appId);
        pay.setCompanyId(app.getCompanyId());
        pay.setPaymentAmount(amount);
        pay.setPaymentMethod(paymentMethod);
        pay.setPaymentStatus("SUCCESS");
        pay.setPaymentTime(LocalDateTime.now());
        pay.setOperatorId(operatorId);
        pay.setThirdPartyNo("SIM_" + System.currentTimeMillis());
        payMapper.insert(pay);
        BigDecimal newPaid = app.getPaidAmount() != null ? app.getPaidAmount().add(amount) : amount;
        app.setPaidAmount(newPaid);
        if (newPaid.compareTo(app.getTotalAmount()) >= 0) app.setPaymentStatus("PAID");
        else app.setPaymentStatus("PARTIAL_PAID");
        appMapper.updateById(app);
        log.info("在线支付成功: {}, 金额: {}, 方式: {}", pay.getPaymentNo(), amount, paymentMethod);
        return pay;
    }

    @Transactional
    public InvoiceApplication applyInvoice(Long appId, Long companyId, String title,
                                           String taxpayerNo, String invoiceType,
                                           String receiverName, String receiverPhone,
                                           String receiverAddress, String receiverEmail,
                                           BigDecimal amount, String content) {
        InvoiceApplication inv = new InvoiceApplication();
        inv.setInvoiceNo(CodeGenerator.genInvoiceNo());
        inv.setApplicationId(appId);
        inv.setCompanyId(companyId);
        inv.setInvoiceTitle(title);
        inv.setTaxpayerNo(taxpayerNo);
        inv.setInvoiceType(invoiceType);
        inv.setInvoiceAmount(amount);
        inv.setInvoiceContent(content != null ? content : "检测认证服务费");
        inv.setReceiverName(receiverName);
        inv.setReceiverPhone(receiverPhone);
        inv.setReceiverAddress(receiverAddress);
        inv.setReceiverEmail(receiverEmail);
        inv.setInvoiceStatus("PENDING");
        invoiceMapper.insert(inv);
        log.info("发票申请已提交: {}, 金额: {}", inv.getInvoiceNo(), amount);
        return inv;
    }

    public List<InspectionApplication> listByCompany(Long companyId) {
        return appMapper.selectList(new LambdaQueryWrapper<InspectionApplication>()
                .eq(InspectionApplication::getCompanyId, companyId)
                .orderByDesc(InspectionApplication::getCreateTime));
    }

    public List<InvoiceApplication> listInvoices(Long companyId) {
        return invoiceMapper.selectList(new LambdaQueryWrapper<InvoiceApplication>()
                .eq(InvoiceApplication::getCompanyId, companyId)
                .orderByDesc(InvoiceApplication::getCreateTime));
    }
}
