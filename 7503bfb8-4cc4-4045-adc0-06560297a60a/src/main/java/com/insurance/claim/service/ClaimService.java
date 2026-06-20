package com.insurance.claim.service;

import com.insurance.claim.common.BusinessException;
import com.insurance.claim.common.PageResult;
import com.insurance.claim.common.ResultCode;
import com.insurance.claim.dto.request.*;
import com.insurance.claim.dto.response.ClaimResponse;
import com.insurance.claim.dto.response.CompensationDetailResponse;
import com.insurance.claim.engine.ClaimLevelClassifier;
import com.insurance.claim.entity.*;
import com.insurance.claim.enums.ClaimStatus;
import com.insurance.claim.enums.InsuranceType;
import com.insurance.claim.mapper.*;
import com.insurance.claim.queue.SurveyTaskQueue;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

@Slf4j
@Service
@RequiredArgsConstructor
public class ClaimService implements SurveyTaskQueue.SurveyTaskDispatcher {

    private final ClaimRepository claimRepository;
    private final ClaimPartyMapper claimPartyMapper;
    private final ClaimDocumentMapper claimDocumentMapper;
    private final SurveyMapper surveyMapper;
    private final LossAssessmentMapper lossAssessmentMapper;
    private final ClaimReviewMapper claimReviewMapper;
    private final PolicyMapper policyMapper;
    private final UserMapper userMapper;

    private final PolicyService policyService;
    private final FraudDetectionService fraudDetectionService;
    private final RiskAssessmentEngine riskAssessmentEngine;
    private final CompensationCalculationEngine compensationCalculationEngine;
    private final SurveyTaskQueue surveyTaskQueue;
    private final ClaimLevelClassifier claimLevelClassifier;
    private final PartPriceMatchingService partPriceMatchingService;

    private final AtomicLong claimNoGenerator = new AtomicLong(System.currentTimeMillis() % 1000000);

    @PostConstruct
    public void init() {
        surveyTaskQueue.setDispatcher(this);
        log.info("ClaimService初始化完成，已注册为查勘任务调度器");
    }

    @Override
    public void dispatch(Claim claim) throws Exception {
        log.info("任务队列自动调度派工: 案件{}", claim.getClaimNo());
        SurveyAssignRequest autoAssign = new SurveyAssignRequest();
        autoAssign.setClaimId(claim.getId());
        autoAssign.setAssignMode("auto");
        autoAssign.setLongitude(claim.getAccidentLongitude());
        autoAssign.setLatitude(claim.getAccidentLatitude());
        autoAssign.setSearchRadius(10000);
        autoAssign.setRemark("系统自动派工");
        try {
            assignSurveyor(autoAssign);
            log.info("队列自动派工成功: 案件{}", claim.getClaimNo());
        } catch (Exception e) {
            log.error("队列自动派工失败: 案件{}", claim.getClaimNo(), e);
            throw e;
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public ClaimResponse reportClaim(ClaimReportRequest request) {
        log.info("开始理赔报案: 保单号={}, 报案人={}", request.getPolicyNo(), request.getReporterName());

        InsuranceType insuranceType = InsuranceType.fromCode(request.getInsuranceType());
        policyService.validatePolicy(request.getPolicyNo(), insuranceType);

        Claim claim = new Claim();
        BeanUtils.copyProperties(request, claim);
        claim.setClaimNo(generateClaimNo());
        claim.setStatus(ClaimStatus.REPORTED);
        claim.setInsuranceType(insuranceType);
        claim.setReportedAt(LocalDateTime.now());
        claim.setFraudScore(0);
        claim.setFraudSuspicious(false);
        claim.setVersion(0);

        claimRepository.insert(claim);
        log.info("理赔报案创建成功: 案件编号={}, ID={}", claim.getClaimNo(), claim.getId());

        if (request.getParties() != null && !request.getParties().isEmpty()) {
            saveClaimParties(claim.getId(), claim.getClaimNo(), request.getParties());
        }

        if (request.getDocuments() != null && !request.getDocuments().isEmpty()) {
            saveClaimDocuments(claim.getId(), claim.getClaimNo(), request.getDocuments());
        }

        Policy policy = policyMapper.selectByPolicyNo(request.getPolicyNo());
        claim.setAccidentCount(policy.getClaimCount() != null ? policy.getClaimCount() : 0);

        fraudDetectionService.detectFraudOnReport(claim);

        Claim updatedClaim = claimRepository.selectById(claim.getId());

        surveyTaskQueue.enqueue(updatedClaim);
        log.info("报案信息已推送至查勘任务队列: 案件{}", claim.getClaimNo());

        return convertToResponse(updatedClaim);
    }

    @Transactional(rollbackFor = Exception.class)
    public Survey assignSurveyor(SurveyAssignRequest request) {
        log.info("查勘派工: 案件ID={}, 模式={}, 手动查勘员ID={}",
                request.getClaimId(), request.getAssignMode(), request.getSurveyorId());

        Claim claim = claimRepository.selectById(request.getClaimId());
        if (claim == null) {
            throw new BusinessException(ResultCode.CLAIM_NOT_FOUND);
        }

        if (claim.getStatus() != ClaimStatus.REPORTED) {
            throw new BusinessException(ResultCode.CLAIM_STATUS_ERROR.getCode(),
                    "案件状态不允许派工，当前状态: " + claim.getStatus().getName());
        }

        Survey existingSurvey = surveyMapper.selectByClaimId(request.getClaimId());
        if (existingSurvey != null) {
            log.warn("该案件已有查勘记录，直接返回已有派工: 案件={}", claim.getClaimNo());
            return existingSurvey;
        }

        User surveyor;
        if ("manual".equalsIgnoreCase(request.getAssignMode()) && request.getSurveyorId() != null) {
            surveyor = userMapper.selectById(request.getSurveyorId());
            if (surveyor == null) {
                throw new BusinessException("查勘员不存在");
            }
            log.info("手动指定查勘员: 案件={}, 查勘员={}", claim.getClaimNo(), surveyor.getRealName());
        } else {
            BigDecimal longitude = request.getLongitude() != null ? request.getLongitude() : claim.getAccidentLongitude();
            BigDecimal latitude = request.getLatitude() != null ? request.getLatitude() : claim.getAccidentLatitude();
            Integer radius = request.getSearchRadius() != null ? request.getSearchRadius() : 5000;

            if (longitude == null || latitude == null) {
                throw new BusinessException("智能分配模式需提供事故GPS坐标(经度+纬度)");
            }

            log.info("智能分配查勘员: 案件={}, 经度={}, 纬度={}, 搜索半径={}m",
                    claim.getClaimNo(), longitude, latitude, radius);

            List<User> availableSurveyors = userMapper.selectAvailableSurveyors(
                    longitude.doubleValue(), latitude.doubleValue(), radius);

            if (availableSurveyors == null || availableSurveyors.isEmpty()) {
                log.warn("附近{}m内无可用查勘员，扩大范围搜索", radius);
                availableSurveyors = userMapper.selectAvailableSurveyors(
                        longitude.doubleValue(), latitude.doubleValue(), radius * 3);
            }

            if (availableSurveyors == null || availableSurveyors.isEmpty()) {
                throw new BusinessException("未找到可用查勘员，请切换至手动指定模式");
            }

            surveyor = availableSurveyors.get(0);
            log.info("智能分配成功: 案件={}, 最近查勘员={}, 距离={}km",
                    claim.getClaimNo(), surveyor.getRealName(),
                    surveyor.getDistance() != null ? surveyor.getDistance().setScale(2, RoundingMode.HALF_UP) : "N/A");
        }

        Survey survey = new Survey();
        survey.setClaimId(request.getClaimId());
        survey.setClaimNo(claim.getClaimNo());
        survey.setSurveyorId(surveyor.getId());
        survey.setSurveyorName(surveyor.getRealName());
        survey.setSurveyorPhone(surveyor.getPhone());
        survey.setAssignedAt(LocalDateTime.now());
        survey.setGpsVerified(false);
        survey.setRemark(request.getRemark());
        surveyMapper.insert(survey);

        claim.setSurveyorId(surveyor.getId());
        claim.setSurveyorName(surveyor.getRealName());
        claim.setSurveyAssignedAt(LocalDateTime.now());
        claim.setStatus(ClaimStatus.SURVEY_ASSIGNED);
        claimRepository.updateById(claim);

        log.info("查勘派工完成: 案件={}, 模式={}, 查勘员={}",
                claim.getClaimNo(), request.getAssignMode(), surveyor.getRealName());
        return surveyMapper.selectById(survey.getId());
    }

    @Transactional(rollbackFor = Exception.class)
    public Survey submitSurvey(SurveySubmitRequest request) {
        log.info("提交查勘结果: 查勘记录ID={}", request.getSurveyId());

        Survey survey = surveyMapper.selectById(request.getSurveyId());
        if (survey == null) {
            throw new BusinessException("查勘记录不存在");
        }

        Claim claim = claimRepository.selectById(survey.getClaimId());
        if (claim == null) {
            throw new BusinessException(ResultCode.CLAIM_NOT_FOUND);
        }

        if (claim.getStatus() != ClaimStatus.SURVEY_ASSIGNED && claim.getStatus() != ClaimStatus.SURVEY_IN_PROGRESS) {
            throw new BusinessException(ResultCode.CLAIM_STATUS_ERROR.getCode(),
                    "案件状态不允许提交查勘，当前状态: " + claim.getStatus().getName());
        }

        BeanUtils.copyProperties(request, survey);
        survey.setCompletedAt(LocalDateTime.now());
        surveyMapper.updateById(survey);

        if (Boolean.TRUE.equals(request.getGpsVerified())) {
            survey.setGpsVerified(true);
        } else {
            survey.setGpsVerified(false);
        }

        if (request.getPhotos() != null && !request.getPhotos().isEmpty()) {
            saveDocuments(survey.getClaimId(), survey.getId(), "survey_photo", request.getPhotos());
        }

        if (request.getVideos() != null && !request.getVideos().isEmpty()) {
            saveDocuments(survey.getClaimId(), survey.getId(), "survey_video", request.getVideos());
        }

        claim.setLiabilityRatio(request.getLiabilityRatio());
        claim.setSurveyCompletedAt(LocalDateTime.now());
        claim.setStatus(ClaimStatus.SURVEY_COMPLETED);
        claimRepository.updateById(claim);

        fraudDetectionService.detectFraudOnSurvey(survey);

        log.info("查勘提交完成: 案件={}, 估损金额={}", claim.getClaimNo(), request.getEstimatedLossAmount());
        return surveyMapper.selectById(survey.getId());
    }

    @Transactional(rollbackFor = Exception.class)
    public LossAssessment submitAssessment(LossAssessmentRequest request) {
        log.info("提交定损结果: 案件ID={}", request.getClaimId());

        Claim claim = claimRepository.selectById(request.getClaimId());
        if (claim == null) {
            throw new BusinessException(ResultCode.CLAIM_NOT_FOUND);
        }

        if (claim.getStatus() != ClaimStatus.SURVEY_COMPLETED && claim.getStatus() != ClaimStatus.ASSESSMENT_IN_PROGRESS) {
            throw new BusinessException(ResultCode.CLAIM_STATUS_ERROR.getCode(),
                    "案件状态不允许定损，当前状态: " + claim.getStatus().getName());
        }

        User assessor = userMapper.selectById(request.getAssessorId());
        if (assessor == null) {
            throw new BusinessException("定损员不存在");
        }

        LossAssessment existingAssessment = lossAssessmentMapper.selectByClaimId(request.getClaimId());
        if (existingAssessment != null) {
            throw new BusinessException("该案件已有定损记录，请使用更新接口");
        }

        LossAssessment assessment = new LossAssessment();
        assessment.setClaimId(request.getClaimId());
        assessment.setClaimNo(claim.getClaimNo());
        assessment.setAssessorId(request.getAssessorId());
        assessment.setAssessorName(assessor.getRealName());
        assessment.setStartedAt(LocalDateTime.now());
        assessment.setLiabilityRatio(request.getLiabilityRatio());
        assessment.setSalvageValue(request.getSalvageValue());
        assessment.setAssessmentComments(request.getAssessmentComments());

        Policy policy = policyMapper.selectByPolicyNo(claim.getPolicyNo());

        BigDecimal totalPartsCost = BigDecimal.ZERO;
        BigDecimal totalLaborCost = BigDecimal.ZERO;
        BigDecimal totalMaterialCost = BigDecimal.ZERO;
        BigDecimal totalOtherCost = BigDecimal.ZERO;
        boolean exceedStandard = false;
        int matchedGuideCount = 0;
        int partCount = 0;

        List<LossItem> lossItems = new ArrayList<>();
        if (request.getLossItems() != null && !request.getLossItems().isEmpty()) {
            for (LossItemRequest itemRequest : request.getLossItems()) {
                if (itemRequest.getQuantity() == null) itemRequest.setQuantity(1);
                if (itemRequest.getUnitPrice() == null) itemRequest.setUnitPrice(BigDecimal.ZERO);

                if (itemRequest.getItemType() != null && itemRequest.getItemType() == 1) {
                    partCount++;
                    PartPriceGuide guide = partPriceMatchingService.matchGuidePrice(
                            itemRequest.getItemCode(), itemRequest.getItemName(),
                            policy != null ? policy.getVehicleBrand() : null,
                            policy != null ? policy.getVehicleModel() : null,
                            claim.getAccidentProvince(), claim.getAccidentCity());
                    if (guide != null) {
                        matchedGuideCount++;
                        if (itemRequest.getGuidePrice() == null) {
                            itemRequest.setGuidePrice(guide.getGuidePrice());
                        }
                        if (itemRequest.getUnitPrice().compareTo(BigDecimal.ZERO) == 0) {
                            itemRequest.setUnitPrice(guide.getGuidePrice());
                        }
                        if (partPriceMatchingService.isExceedStandard(itemRequest.getUnitPrice(), guide.getGuidePrice())) {
                            exceedStandard = true;
                        }
                    }
                }

                BigDecimal itemTotal = itemRequest.getUnitPrice()
                        .multiply(BigDecimal.valueOf(itemRequest.getQuantity()));

                switch (itemRequest.getItemType()) {
                    case 1 -> totalPartsCost = totalPartsCost.add(itemTotal);
                    case 2 -> totalLaborCost = totalLaborCost.add(itemTotal);
                    case 3 -> totalMaterialCost = totalMaterialCost.add(itemTotal);
                    default -> totalOtherCost = totalOtherCost.add(itemTotal);
                }

                if (itemRequest.getGuidePrice() != null
                        && itemRequest.getUnitPrice().compareTo(itemRequest.getGuidePrice()) > 0) {
                    BigDecimal exceedRatio = partPriceMatchingService.calculatePriceDeviation(
                            itemRequest.getUnitPrice(), itemRequest.getGuidePrice());
                    if (exceedRatio.compareTo(BigDecimal.valueOf(30)) > 0) {
                        exceedStandard = true;
                    }
                }

                LossItem item = new LossItem();
                BeanUtils.copyProperties(itemRequest, item);
                item.setAssessmentId(0L);
                item.setClaimId(request.getClaimId());
                item.setTotalAmount(itemRequest.getUnitPrice().multiply(BigDecimal.valueOf(itemRequest.getQuantity())));

                if (itemRequest.getGuidePrice() != null
                        && itemRequest.getUnitPrice().compareTo(itemRequest.getGuidePrice()) > 0) {
                    item.setExceedGuidePrice(true);
                    item.setExceedRatio(partPriceMatchingService.calculatePriceDeviation(
                            itemRequest.getUnitPrice(), itemRequest.getGuidePrice()));
                } else {
                    item.setExceedGuidePrice(false);
                }

                lossItems.add(item);
            }
        }

        BigDecimal totalLossAmount = totalPartsCost.add(totalLaborCost).add(totalMaterialCost).add(totalOtherCost);
        BigDecimal salvageValue = request.getSalvageValue() != null ? request.getSalvageValue() : BigDecimal.ZERO;
        BigDecimal netLossAmount = totalLossAmount.subtract(salvageValue);

        assessment.setTotalPartsCost(totalPartsCost);
        assessment.setTotalLaborCost(totalLaborCost);
        assessment.setTotalMaterialCost(totalMaterialCost);
        assessment.setTotalOtherCost(totalOtherCost);
        assessment.setTotalLossAmount(totalLossAmount);
        assessment.setNetLossAmount(netLossAmount);
        assessment.setExceedStandard(exceedStandard);
        assessment.setApprovalRequired(exceedStandard);
        assessment.setApprovalStatus(exceedStandard ? "pending" : "auto_approved");
        assessment.setCompletedAt(LocalDateTime.now());

        lossAssessmentMapper.insertAssessment(assessment);

        for (LossItem item : lossItems) {
            item.setAssessmentId(assessment.getId());
        }
        if (!lossItems.isEmpty()) {
            lossAssessmentMapper.batchInsertLossItems(lossItems);
        }

        ClaimLevelClassifier.ClassificationResult classification =
                claimLevelClassifier.classify(claim, assessment);
        claim.setCaseLevel(classification.getReviewLevel());
        claim.setCaseLevelName(classification.getLevelName());
        claim.setFastTrack(classification.isAutoReviewEligible());

        claim.setAssessorId(request.getAssessorId());
        claim.setAssessorName(assessor.getRealName());
        claim.setTotalLossAmount(totalLossAmount);
        claim.setAssessmentCompletedAt(LocalDateTime.now());
        claim.setStatus(ClaimStatus.ASSESSMENT_COMPLETED);
        claimRepository.updateById(claim);

        fraudDetectionService.detectFraudOnAssessment(request.getClaimId());

        log.info("定损提交完成: 案件={}, 总损失={}, 配件指导价匹配{}/{}, 超标={}, 分级={}",
                claim.getClaimNo(), totalLossAmount, matchedGuideCount, partCount,
                exceedStandard, classification.getLevelName());
        return lossAssessmentMapper.selectById(assessment.getId());
    }

    @Transactional(rollbackFor = Exception.class)
    public ClaimReview reviewClaim(ClaimReviewRequest request) {
        log.info("核赔审核: 案件ID={}, 结果={}", request.getClaimId(), request.getReviewResult());

        Claim claim = claimRepository.selectById(request.getClaimId());
        if (claim == null) {
            throw new BusinessException(ResultCode.CLAIM_NOT_FOUND);
        }

        if (claim.getStatus() != ClaimStatus.ASSESSMENT_COMPLETED
                && claim.getStatus() != ClaimStatus.REVIEW_PENDING
                && claim.getStatus() != ClaimStatus.REVIEW_IN_PROGRESS
                && claim.getStatus() != ClaimStatus.REVIEW_REJECTED) {
            throw new BusinessException(ResultCode.CLAIM_STATUS_ERROR.getCode(),
                    "案件状态不允许核赔，当前状态: " + claim.getStatus().getName());
        }

        User reviewer = userMapper.selectById(request.getReviewerId());
        if (reviewer == null) {
            throw new BusinessException("核赔师不存在");
        }

        ClaimReview review = new ClaimReview();
        BeanUtils.copyProperties(request, review);
        review.setReviewerName(reviewer.getRealName());
        review.setReviewStartTime(LocalDateTime.now());
        review.setReviewEndTime(LocalDateTime.now());
        review.setReviewDuration(0);
        claimReviewMapper.insert(review);

        fraudDetectionService.detectFraudOnReview(request.getClaimId());

        Claim updatedClaim = claimRepository.selectById(request.getClaimId());

        if (Boolean.TRUE.equals(updatedClaim.getFraudSuspicious())) {
            log.info("案件标记为欺诈可疑，转入人工复核: {}", claim.getClaimNo());
            claimRepository.updateStatus(request.getClaimId(), ClaimStatus.FRAUD_SUSPICIOUS.getCode(), updatedClaim.getVersion());
        } else if (request.getReviewResult() == 1) {
            claimRepository.updateStatus(request.getClaimId(), ClaimStatus.REVIEW_APPROVED.getCode(), updatedClaim.getVersion());
            claim.setReviewerId(request.getReviewerId());
            claim.setReviewerName(reviewer.getRealName());
            claim.setReviewComments(request.getReviewComments());
            claim.setReviewCompletedAt(LocalDateTime.now());

            Policy policy = policyMapper.selectByPolicyNo(claim.getPolicyNo());
            LossAssessment assessment = lossAssessmentMapper.selectByClaimId(request.getClaimId());

            BigDecimal payableAmount = compensationCalculationEngine.calculatePayableAmount(updatedClaim, policy, assessment);
            updatedClaim.setPayableAmount(payableAmount);
            updatedClaim.setDeductibleAmount(policyService.calculateDeductible(claim.getPolicyNo(),
                    assessment.getTotalLossAmount()));

            claimRepository.updateById(updatedClaim);

            policyService.incrementClaimCount(policy.getId(), payableAmount);

            claimRepository.updateStatus(request.getClaimId(), ClaimStatus.CALCULATION_COMPLETED.getCode(), updatedClaim.getVersion() + 1);

            log.info("核赔通过: 案件={}, 应赔付={}", claim.getClaimNo(), payableAmount);
        } else if (request.getReviewResult() == 2) {
            claimRepository.updateStatus(request.getClaimId(), ClaimStatus.REVIEW_REJECTED.getCode(), updatedClaim.getVersion());
            claim.setRejectReason(request.getRejectReason());
            log.info("核赔驳回: 案件={}, 原因={}", claim.getClaimNo(), request.getRejectReason());
        } else if (request.getReviewResult() == 3) {
            claimRepository.updateStatus(request.getClaimId(), ClaimStatus.REVIEW_REJECTED.getCode(), updatedClaim.getVersion());
            claim.setRejectReason(request.getSupplementRequirements());
            log.info("需补充材料: 案件={}, 要求={}", claim.getClaimNo(), request.getSupplementRequirements());
        }

        return claimReviewMapper.selectById(review.getId());
    }

    public CompensationDetailResponse calculateCompensation(Long claimId) {
        Claim claim = claimRepository.selectById(claimId);
        if (claim == null) {
            throw new BusinessException(ResultCode.CLAIM_NOT_FOUND);
        }

        if (claim.getStatus() != ClaimStatus.REVIEW_APPROVED && claim.getStatus() != ClaimStatus.CALCULATION_COMPLETED) {
            throw new BusinessException(ResultCode.CLAIM_STATUS_ERROR.getCode(),
                    "案件状态不允许计算赔款，当前状态: " + claim.getStatus().getName());
        }

        Policy policy = policyMapper.selectByPolicyNo(claim.getPolicyNo());
        LossAssessment assessment = lossAssessmentMapper.selectByClaimId(claimId);

        CompensationDetailResponse response = new CompensationDetailResponse();
        response.setClaimId(claimId);
        response.setClaimNo(claim.getClaimNo());
        response.setPolicyNo(claim.getPolicyNo());
        response.setInsuranceTypeName(policy.getInsuranceType().getName());
        response.setTotalLossAmount(assessment.getTotalLossAmount());

        Integer liabilityRatio = claim.getLiabilityRatio() != null ? claim.getLiabilityRatio() : 100;
        response.setLiabilityRatio(liabilityRatio);

        BigDecimal liabilityAmount = assessment.getTotalLossAmount()
                .multiply(BigDecimal.valueOf(liabilityRatio))
                .divide(BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
        response.setLiabilityAmount(liabilityAmount);

        BigDecimal deductibleAmount = policy.getDeductible() != null ? policy.getDeductible() : BigDecimal.ZERO;
        response.setDeductibleAmount(deductibleAmount);

        BigDecimal deductibleRatio = policy.getDeductibleRatio() != null ? policy.getDeductibleRatio() : BigDecimal.ZERO;
        response.setDeductibleRatio(deductibleRatio);

        BigDecimal deductibleRatioAmount = liabilityAmount
                .multiply(deductibleRatio)
                .divide(BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
        response.setDeductibleRatioAmount(deductibleRatioAmount);

        BigDecimal actualDeductible = deductibleAmount.max(deductibleRatioAmount);
        response.setActualDeductible(actualDeductible);

        int accidentCount = claim.getAccidentCount() != null ? claim.getAccidentCount() : 0;
        response.setAccidentCount(accidentCount);

        BigDecimal floatingCoefficient = calculateFloatingCoefficient(accidentCount);
        response.setFloatingCoefficient(floatingCoefficient);

        BigDecimal floatingAdjustmentAmount = liabilityAmount
                .multiply(floatingCoefficient.subtract(BigDecimal.ONE))
                .setScale(2, java.math.RoundingMode.HALF_UP);
        response.setFloatingAdjustmentAmount(floatingAdjustmentAmount);

        BigDecimal salvageValue = assessment.getSalvageValue() != null ? assessment.getSalvageValue() : BigDecimal.ZERO;
        response.setSalvageValue(salvageValue);

        BigDecimal otherAdjustment = BigDecimal.ZERO;
        response.setOtherAdjustment(otherAdjustment);

        BigDecimal coverageAmount = policy.getTotalCoverage() != null ? policy.getTotalCoverage() : new BigDecimal("99999999.99");
        response.setCoverageAmount(coverageAmount);

        BigDecimal calculatedAmount = liabilityAmount
                .subtract(actualDeductible)
                .add(floatingAdjustmentAmount)
                .subtract(salvageValue)
                .add(otherAdjustment);
        if (calculatedAmount.compareTo(BigDecimal.ZERO) < 0) {
            calculatedAmount = BigDecimal.ZERO;
        }
        response.setCalculatedAmount(calculatedAmount);

        BigDecimal maxPaymentLimit = coverageAmount;
        response.setMaxPaymentLimit(maxPaymentLimit);

        BigDecimal finalPayableAmount = calculatedAmount.min(maxPaymentLimit);
        if (finalPayableAmount.compareTo(BigDecimal.ZERO) < 0) {
            finalPayableAmount = BigDecimal.ZERO;
        }
        response.setFinalPayableAmount(finalPayableAmount);

        String formula = String.format(
                "赔款 = (总损失 %.2f × 责任比例 %d%% - 免赔额 %.2f + 浮动调整 %.2f - 残值 %.2f)，最高不超过保额 %.2f",
                assessment.getTotalLossAmount(), liabilityRatio, actualDeductible,
                floatingAdjustmentAmount, salvageValue, coverageAmount
        );
        response.setCalculationFormula(formula);
        response.setCalculationTime(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));

        List<LossItem> lossItems = lossAssessmentMapper.selectLossItemsByAssessmentId(assessment.getId());
        List<CompensationDetailResponse.CalculationItem> calculationItems = new ArrayList<>();

        for (LossItem lossItem : lossItems) {
            CompensationDetailResponse.CalculationItem item = new CompensationDetailResponse.CalculationItem();
            item.setItemName(lossItem.getItemName());
            item.setItemType(getItemTypeName(lossItem.getItemType()));
            item.setLossAmount(lossItem.getTotalAmount());

            BigDecimal liabilityShare = lossItem.getTotalAmount()
                    .multiply(BigDecimal.valueOf(liabilityRatio))
                    .divide(BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
            item.setLiabilityShare(liabilityShare);
            item.setPayableAmount(liabilityShare);
            item.setRemark("按" + liabilityRatio + "%责任比例计算");

            calculationItems.add(item);
        }
        response.setCalculationItems(calculationItems);

        if (claim.getStatus() == ClaimStatus.REVIEW_APPROVED) {
            claim.setPayableAmount(finalPayableAmount);
            claim.setDeductibleAmount(actualDeductible);
            claim.setFloatingCoefficient(floatingCoefficient);
            claim.setCalculationCompletedAt(LocalDateTime.now());
            claim.setStatus(ClaimStatus.CALCULATION_COMPLETED);
            claimRepository.updateById(claim);
        }

        return response;
    }

    private BigDecimal calculateFloatingCoefficient(int accidentCount) {
        return switch (accidentCount) {
            case 0 -> new BigDecimal("0.9");
            case 1 -> BigDecimal.ONE;
            case 2 -> new BigDecimal("1.1");
            case 3 -> new BigDecimal("1.2");
            case 4 -> new BigDecimal("1.3");
            case 5 -> new BigDecimal("1.4");
            default -> new BigDecimal("1.5");
        };
    }

    private String getItemTypeName(Integer itemType) {
        if (itemType == null) return "其他";
        return switch (itemType) {
            case 1 -> "配件";
            case 2 -> "工时";
            case 3 -> "材料";
            default -> "其他";
        };
    }

    public Claim getClaimById(Long id) {
        return claimRepository.selectById(id);
    }

    public Claim getClaimByNo(String claimNo) {
        return claimRepository.selectByClaimNo(claimNo);
    }

    public PageResult<ClaimResponse> queryClaims(ClaimQueryRequest query) {
        if (query.getPageNum() == null || query.getPageNum() < 1) {
            query.setPageNum(1);
        }
        if (query.getPageSize() == null || query.getPageSize() < 1) {
            query.setPageSize(10);
        }

        int offset = (query.getPageNum() - 1) * query.getPageSize();
        query.setPageNum(offset);

        Long total = claimRepository.selectCount(query);
        List<Claim> claims = claimRepository.selectList(query);

        List<ClaimResponse> responses = new ArrayList<>();
        for (Claim claim : claims) {
            responses.add(convertToResponse(claim));
        }

        int pageNum = (offset / query.getPageSize()) + 1;
        return PageResult.of(pageNum, query.getPageSize(), total, responses);
    }

    public int countRecentClaimsByIdCard(String idCard, int days) {
        return claimRepository.countClaimsByIdCardAndDays(idCard, days);
    }

    private String generateClaimNo() {
        String dateStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        long seq = claimNoGenerator.incrementAndGet() % 100000;
        return "CL" + dateStr + String.format("%05d", seq);
    }

    private void saveClaimParties(Long claimId, String claimNo, List<ClaimPartyRequest> parties) {
        List<ClaimParty> partyList = new ArrayList<>();
        for (ClaimPartyRequest request : parties) {
            ClaimParty party = new ClaimParty();
            BeanUtils.copyProperties(request, party);
            party.setClaimId(claimId);
            party.setClaimNo(claimNo);
            partyList.add(party);
        }
        claimPartyMapper.batchInsert(partyList);
    }

    private void saveClaimDocuments(Long claimId, String claimNo, List<DocumentUploadRequest> documents) {
        List<ClaimDocument> docList = new ArrayList<>();
        for (DocumentUploadRequest request : documents) {
            ClaimDocument doc = new ClaimDocument();
            BeanUtils.copyProperties(request, doc);
            doc.setClaimId(claimId);
            doc.setClaimNo(claimNo);
            doc.setUploadStatus(1);
            docList.add(doc);
        }
        claimDocumentMapper.batchInsert(docList);
    }

    private void saveDocuments(Long claimId, Long businessId, String businessType, List<DocumentUploadRequest> documents) {
        List<ClaimDocument> docList = new ArrayList<>();
        for (DocumentUploadRequest request : documents) {
            ClaimDocument doc = new ClaimDocument();
            BeanUtils.copyProperties(request, doc);
            doc.setClaimId(claimId);
            doc.setBusinessId(businessId);
            doc.setBusinessType(businessType);
            doc.setUploadStatus(1);
            docList.add(doc);
        }
        claimDocumentMapper.batchInsert(docList);
    }

    private ClaimResponse convertToResponse(Claim claim) {
        ClaimResponse response = new ClaimResponse();
        BeanUtils.copyProperties(claim, response);
        response.setInsuranceTypeName(claim.getInsuranceType() != null ? claim.getInsuranceType().getName() : null);
        response.setStatusName(claim.getStatus() != null ? claim.getStatus().getName() : null);

        if (claim.getReportedAt() != null && claim.getClosedAt() != null) {
            long days = java.time.Duration.between(claim.getReportedAt(), claim.getClosedAt()).toDays();
            response.setSettlementDays((int) days);
        }

        return response;
    }

    public Survey getSurveyByClaimId(Long claimId) {
        return surveyMapper.selectByClaimId(claimId);
    }

    public LossAssessment getAssessmentByClaimId(Long claimId) {
        return lossAssessmentMapper.selectByClaimId(claimId);
    }

    public List<LossItem> getLossItemsByAssessmentId(Long assessmentId) {
        return lossAssessmentMapper.selectLossItemsByAssessmentId(assessmentId);
    }

    public List<ClaimReview> getReviewsByClaimId(Long claimId) {
        return claimReviewMapper.selectByClaimId(claimId);
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean closeClaim(Long claimId) {
        Claim claim = claimRepository.selectById(claimId);
        if (claim == null) {
            throw new BusinessException(ResultCode.CLAIM_NOT_FOUND);
        }

        if (claim.getStatus() != ClaimStatus.PAYMENT_COMPLETED) {
            throw new BusinessException(ResultCode.CLAIM_STATUS_ERROR.getCode(),
                    "只有支付完成的案件才能结案，当前状态: " + claim.getStatus().getName());
        }

        claimRepository.closeClaim(claimId, LocalDateTime.now());
        log.info("案件已结案: {}", claim.getClaimNo());
        return true;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean cancelClaim(Long claimId, String reason) {
        Claim claim = claimRepository.selectById(claimId);
        if (claim == null) {
            throw new BusinessException(ResultCode.CLAIM_NOT_FOUND);
        }

        if (claim.getStatus() == ClaimStatus.CASE_CLOSED || claim.getStatus() == ClaimStatus.CASE_CANCELLED) {
            throw new BusinessException("案件已结案或已注销，无法注销");
        }

        claimRepository.cancelClaim(claimId, reason);
        log.info("案件已注销: {}, 原因: {}", claim.getClaimNo(), reason);
        return true;
    }
}
