package com.insurance.claim.controller;

import com.insurance.claim.common.ApiResponse;
import com.insurance.claim.common.PageResult;
import com.insurance.claim.dto.request.*;
import com.insurance.claim.dto.response.ClaimResponse;
import com.insurance.claim.dto.response.CompensationDetailResponse;
import com.insurance.claim.entity.*;
import com.insurance.claim.service.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/claim")
@RequiredArgsConstructor
public class ClaimController {

    private final ClaimService claimService;
    private final PaymentService paymentService;
    private final PolicyService policyService;
    private final FraudDetectionService fraudDetectionService;

    @PostMapping("/report")
    @Tag(name = "2-理赔报案")
    @Operation(summary = "提交理赔报案", description = "在线提交理赔报案信息，系统自动校验保单并生成唯一案件编号")
    public ApiResponse<ClaimResponse> reportClaim(
            @Valid @RequestBody ClaimReportRequest request) {
        ClaimResponse response = claimService.reportClaim(request);
        return ApiResponse.success("报案成功", response);
    }

    @GetMapping("/{id}")
    @Tag(name = "2-理赔报案")
    @Operation(summary = "查询案件详情", description = "根据案件ID查询理赔案件详细信息")
    public ApiResponse<ClaimResponse> getClaimById(
            @Parameter(description = "案件ID") @PathVariable Long id) {
        Claim claim = claimService.getClaimById(id);
        ClaimResponse response = convertToResponse(claim);
        return ApiResponse.success(response);
    }

    @GetMapping("/no/{claimNo}")
    @Tag(name = "2-理赔报案")
    @Operation(summary = "根据案件号查询", description = "根据案件编号查询理赔案件信息")
    public ApiResponse<ClaimResponse> getClaimByNo(
            @Parameter(description = "案件编号") @PathVariable String claimNo) {
        Claim claim = claimService.getClaimByNo(claimNo);
        ClaimResponse response = convertToResponse(claim);
        return ApiResponse.success(response);
    }

    @PostMapping("/list")
    @Tag(name = "2-理赔报案")
    @Operation(summary = "案件列表查询", description = "分页查询理赔案件列表，支持多条件筛选")
    public ApiResponse<PageResult<ClaimResponse>> queryClaims(
            @RequestBody ClaimQueryRequest query) {
        PageResult<ClaimResponse> result = claimService.queryClaims(query);
        return ApiResponse.success(result);
    }

    @PostMapping("/survey/assign")
    @Tag(name = "3-查勘调度")
    @Operation(summary = "查勘派工", description = "为理赔案件分配查勘员，生成查勘任务工单")
    public ApiResponse<Survey> assignSurveyor(
            @Valid @RequestBody SurveyAssignRequest request) {
        Survey survey = claimService.assignSurveyor(request);
        return ApiResponse.success("派工成功", survey);
    }

    @PostMapping("/survey/submit")
    @Tag(name = "3-查勘调度")
    @Operation(summary = "提交查勘结果", description = "查勘员提交现场查勘结果，包括事故详情、损失清单、责任比例等")
    public ApiResponse<Survey> submitSurvey(
            @Valid @RequestBody SurveySubmitRequest request) {
        Survey survey = claimService.submitSurvey(request);
        return ApiResponse.success("查勘提交成功", survey);
    }

    @GetMapping("/survey/claim/{claimId}")
    @Tag(name = "3-查勘调度")
    @Operation(summary = "查询案件查勘记录", description = "根据案件ID查询查勘记录")
    public ApiResponse<Survey> getSurveyByClaimId(
            @Parameter(description = "案件ID") @PathVariable Long claimId) {
        Survey survey = claimService.getSurveyByClaimId(claimId);
        return ApiResponse.success(survey);
    }

    @PostMapping("/assessment/submit")
    @Tag(name = "4-定损评估")
    @Operation(summary = "提交定损结果", description = "提交损失评估结果，系统自动匹配配件指导价，计算总损失")
    public ApiResponse<LossAssessment> submitAssessment(
            @Valid @RequestBody LossAssessmentRequest request) {
        LossAssessment assessment = claimService.submitAssessment(request);
        return ApiResponse.success("定损提交成功", assessment);
    }

    @GetMapping("/assessment/claim/{claimId}")
    @Tag(name = "4-定损评估")
    @Operation(summary = "查询案件定损记录", description = "根据案件ID查询定损记录")
    public ApiResponse<LossAssessment> getAssessmentByClaimId(
            @Parameter(description = "案件ID") @PathVariable Long claimId) {
        LossAssessment assessment = claimService.getAssessmentByClaimId(claimId);
        return ApiResponse.success(assessment);
    }

    @GetMapping("/assessment/{assessmentId}/items")
    @Tag(name = "4-定损评估")
    @Operation(summary = "查询定损项目明细", description = "根据定损记录ID查询损失项目明细")
    public ApiResponse<List<LossItem>> getLossItems(
            @Parameter(description = "定损记录ID") @PathVariable Long assessmentId) {
        List<LossItem> items = claimService.getLossItemsByAssessmentId(assessmentId);
        return ApiResponse.success(items);
    }

    @PostMapping("/review")
    @Tag(name = "5-核赔审核")
    @Operation(summary = "核赔审核", description = "核赔师审核定损材料，支持通过、驳回、补充材料三种结果")
    public ApiResponse<ClaimReview> reviewClaim(
            @Valid @RequestBody ClaimReviewRequest request) {
        ClaimReview review = claimService.reviewClaim(request);
        return ApiResponse.success("审核完成", review);
    }

    @GetMapping("/review/claim/{claimId}")
    @Tag(name = "5-核赔审核")
    @Operation(summary = "查询案件审核记录", description = "根据案件ID查询所有核赔审核记录")
    public ApiResponse<List<ClaimReview>> getReviewsByClaimId(
            @Parameter(description = "案件ID") @PathVariable Long claimId) {
        List<ClaimReview> reviews = claimService.getReviewsByClaimId(claimId);
        return ApiResponse.success(reviews);
    }

    @PostMapping("/calculate/{claimId}")
    @Tag(name = "6-赔款计算")
    @Operation(summary = "计算赔款金额", description = "根据险种条款、责任比例、免赔额、事故次数自动计算赔付金额")
    public ApiResponse<CompensationDetailResponse> calculateCompensation(
            @Parameter(description = "案件ID") @PathVariable Long claimId) {
        CompensationDetailResponse detail = claimService.calculateCompensation(claimId);
        return ApiResponse.success("计算完成", detail);
    }

    @PostMapping("/payment")
    @Tag(name = "7-支付结算")
    @Operation(summary = "发起赔款支付", description = "创建支付记录，对接银行支付接口")
    public ApiResponse<Payment> createPayment(
            @Valid @RequestBody PaymentRequest request) {
        Payment payment = paymentService.createPayment(request);
        return ApiResponse.success("支付已发起", payment);
    }

    @GetMapping("/payment/{id}")
    @Tag(name = "7-支付结算")
    @Operation(summary = "查询支付记录", description = "根据支付记录ID查询支付详情")
    public ApiResponse<Payment> getPaymentById(
            @Parameter(description = "支付记录ID") @PathVariable Long id) {
        Payment payment = paymentService.getPaymentById(id);
        return ApiResponse.success(payment);
    }

    @GetMapping("/payment/claim/{claimId}")
    @Tag(name = "7-支付结算")
    @Operation(summary = "查询案件支付记录", description = "根据案件ID查询所有支付记录")
    public ApiResponse<List<Payment>> getPaymentsByClaimId(
            @Parameter(description = "案件ID") @PathVariable Long claimId) {
        List<Payment> payments = paymentService.getPaymentsByClaimId(claimId);
        return ApiResponse.success(payments);
    }

    @PostMapping("/payment/{id}/retry")
    @Tag(name = "7-支付结算")
    @Operation(summary = "支付重试", description = "对失败的支付进行重试")
    public ApiResponse<Boolean> retryPayment(
            @Parameter(description = "支付记录ID") @PathVariable Long id) {
        boolean result = paymentService.retryPayment(id);
        return ApiResponse.success("支付重试已启动", result);
    }

    @GetMapping("/fraud/score/{claimId}")
    @Tag(name = "8-欺诈检测")
    @Operation(summary = "查询欺诈风险评分", description = "获取案件的欺诈风险评分和风险标记")
    public ApiResponse<Integer> getFraudScore(
            @Parameter(description = "案件ID") @PathVariable Long claimId) {
        int score = fraudDetectionService.getFraudScore(claimId);
        return ApiResponse.success(score);
    }

    @GetMapping("/fraud/suspicious/{claimId}")
    @Tag(name = "8-欺诈检测")
    @Operation(summary = "判断是否欺诈可疑", description = "判断案件是否被标记为欺诈可疑")
    public ApiResponse<Boolean> isFraudSuspicious(
            @Parameter(description = "案件ID") @PathVariable Long claimId) {
        boolean suspicious = fraudDetectionService.isClaimSuspicious(claimId);
        return ApiResponse.success(suspicious);
    }

    @PostMapping("/{id}/close")
    @Tag(name = "2-理赔报案")
    @Operation(summary = "结案", description = "支付完成的案件进行结案处理")
    public ApiResponse<Boolean> closeClaim(
            @Parameter(description = "案件ID") @PathVariable Long id) {
        boolean result = claimService.closeClaim(id);
        return ApiResponse.success("结案成功", result);
    }

    @PostMapping("/{id}/cancel")
    @Tag(name = "2-理赔报案")
    @Operation(summary = "注销案件", description = "注销理赔案件")
    public ApiResponse<Boolean> cancelClaim(
            @Parameter(description = "案件ID") @PathVariable Long id,
            @Parameter(description = "注销原因") @RequestParam String reason) {
        boolean result = claimService.cancelClaim(id, reason);
        return ApiResponse.success("注销成功", result);
    }

    private ClaimResponse convertToResponse(Claim claim) {
        ClaimResponse response = new ClaimResponse();
        org.springframework.beans.BeanUtils.copyProperties(claim, response);
        if (claim.getInsuranceType() != null) {
            response.setInsuranceTypeName(claim.getInsuranceType().getName());
        }
        if (claim.getStatus() != null) {
            response.setStatusName(claim.getStatus().getName());
        }
        return response;
    }
}
