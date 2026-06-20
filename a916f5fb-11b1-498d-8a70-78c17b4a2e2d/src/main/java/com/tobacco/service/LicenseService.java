package com.tobacco.service;

import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.tobacco.common.enums.LicenseStatus;
import com.tobacco.common.exception.BusinessException;
import com.tobacco.common.result.ResultCode;
import com.tobacco.dto.request.LicenseApplyRequest;
import com.tobacco.dto.request.LicenseQuery;
import com.tobacco.dto.request.LicenseReviewRequest;
import com.tobacco.dto.request.PageQuery;
import com.tobacco.common.result.PageResult;
import com.tobacco.entity.License;
import com.tobacco.entity.Retailer;
import com.tobacco.mapper.LicenseMapper;
import com.tobacco.mapper.RetailerMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class LicenseService {

    private final LicenseMapper licenseMapper;
    private final RetailerMapper retailerMapper;

    private static final double MIN_DISTANCE_METERS = 50.0;
    private static final int LICENSE_VALID_YEARS = 5;
    private static final int EXPIRE_REMIND_DAYS = 30;

    @Transactional(rollbackFor = Exception.class)
    public License applyLicense(LicenseApplyRequest request) {
        validateDistance(request.getBusinessType(), request.getLongitude(), request.getLatitude(), request.getCounty());

        String licenseNo = generateLicenseNo();

        License license = new License();
        license.setLicenseNo(licenseNo);
        license.setRetailerName(request.getRetailerName());
        license.setBusinessType(request.getBusinessType());
        license.setBusinessScope(request.getBusinessScope());
        license.setLegalPerson(request.getLegalPerson());
        license.setIdCardNo(request.getIdCardNo());
        license.setPhone(request.getPhone());
        license.setProvince(request.getProvince());
        license.setCity(request.getCity());
        license.setCounty(request.getCounty());
        license.setAddress(request.getAddress());
        license.setLongitude(request.getLongitude());
        license.setLatitude(request.getLatitude());
        license.setApplicationType(request.getApplicationType());
        license.setCountyId(request.getCountyId());
        license.setStationId(request.getStationId());
        license.setOriginalLicenseId(request.getOriginalLicenseId());
        license.setRemark(request.getRemark());

        switch (request.getApplicationType()) {
            case "NEW", "CHANGE" -> license.setStatus(LicenseStatus.PENDING_FIRST_REVIEW.getCode());
            case "RENEWAL" -> {
                license.setStatus(LicenseStatus.RENEWING.getCode());
                license.setOriginalLicenseId(request.getOriginalLicenseId());
            }
            case "SUSPEND", "RESUME", "CANCEL" -> license.setStatus(LicenseStatus.PENDING_FIRST_REVIEW.getCode());
            default -> throw new BusinessException("不支持的申请类型");
        }

        license.setTier(1);
        licenseMapper.insert(license);

        if ("NEW".equals(request.getApplicationType()) && request.getRetailerId() == null) {
            Retailer retailer = createRetailerFromLicense(license);
            license.setRetailerId(retailer.getId());
            licenseMapper.updateById(license);
        } else if (request.getRetailerId() != null) {
            license.setRetailerId(request.getRetailerId());
            licenseMapper.updateById(license);
        }

        log.info("许可证申请提交成功，许可证号：{}，申请类型：{}", licenseNo, request.getApplicationType());
        return license;
    }

    @Transactional(rollbackFor = Exception.class)
    public License reviewLicense(LicenseReviewRequest request, Long reviewerId, String reviewerName) {
        License license = licenseMapper.selectById(request.getLicenseId());
        if (license == null) {
            throw new BusinessException(ResultCode.LICENSE_NOT_FOUND);
        }

        Integer currentStatus = license.getStatus();
        Integer reviewLevel = determineReviewLevel(currentStatus);
        if (!reviewLevel.equals(request.getReviewLevel())) {
            throw new BusinessException("当前许可证状态不支持该级别的审批");
        }

        boolean approved = request.getReviewResult() == 1;

        switch (reviewLevel) {
            case 1 -> {
                license.setFirstReviewerId(reviewerId);
                license.setFirstReviewTime(LocalDateTime.now());
                license.setFirstReviewOpinion(request.getReviewOpinion());
                if (approved) {
                    license.setStatus(LicenseStatus.PENDING_SECOND_REVIEW.getCode());
                } else {
                    license.setStatus(LicenseStatus.REJECTED.getCode());
                }
            }
            case 2 -> {
                license.setSecondReviewerId(reviewerId);
                license.setSecondReviewTime(LocalDateTime.now());
                license.setSecondReviewOpinion(request.getReviewOpinion());
                if (approved) {
                    license.setStatus(LicenseStatus.PENDING_FINAL_REVIEW.getCode());
                } else {
                    license.setStatus(LicenseStatus.REJECTED.getCode());
                }
            }
            case 3 -> {
                license.setFinalReviewerId(reviewerId);
                license.setFinalReviewTime(LocalDateTime.now());
                license.setFinalReviewOpinion(request.getReviewOpinion());
                if (approved) {
                    handleFinalApproval(license);
                } else {
                    license.setStatus(LicenseStatus.REJECTED.getCode());
                }
            }
            default -> throw new BusinessException("不支持的审批级别");
        }

        licenseMapper.updateById(license);
        log.info("许可证审批完成，许可证号：{}，审批级别：{}，结果：{}",
                license.getLicenseNo(), reviewLevel, approved ? "通过" : "驳回");

        return license;
    }

    private void handleFinalApproval(License license) {
        String appType = license.getApplicationType();

        switch (appType) {
            case "NEW", "CHANGE" -> {
                license.setStatus(LicenseStatus.APPROVED.getCode());
                license.setIssueDate(LocalDate.now());
                license.setExpireDate(LocalDate.now().plusYears(LICENSE_VALID_YEARS));
                int tier = calculateTier(license);
                license.setTier(tier);
                updateRetailerAfterApproval(license);
            }
            case "RENEWAL" -> {
                license.setStatus(LicenseStatus.APPROVED.getCode());
                LocalDate currentExpire = license.getExpireDate() != null ? license.getExpireDate() : LocalDate.now();
                license.setExpireDate(currentExpire.plusYears(LICENSE_VALID_YEARS));
                updateRetailerAfterApproval(license);
            }
            case "SUSPEND" -> {
                license.setStatus(LicenseStatus.SUSPENDED.getCode());
                updateRetailerStatus(license.getRetailerId(), 0);
            }
            case "RESUME" -> {
                license.setStatus(LicenseStatus.APPROVED.getCode());
                updateRetailerStatus(license.getRetailerId(), 1);
            }
            case "CANCEL" -> {
                license.setStatus(LicenseStatus.CANCELLED.getCode());
                updateRetailerStatus(license.getRetailerId(), 0);
            }
            default -> license.setStatus(LicenseStatus.APPROVED.getCode());
        }
    }

    private int calculateTier(License license) {
        int baseTier = 1;
        if (license.getOriginalLicenseId() != null) {
            License original = licenseMapper.selectById(license.getOriginalLicenseId());
            if (original != null && original.getTier() != null) {
                baseTier = original.getTier();
            }
        }
        return Math.min(baseTier, 30);
    }

    private void validateDistance(String businessType, BigDecimal longitude, BigDecimal latitude, String county) {
        int count = licenseMapper.countNearbyLicenses(
                businessType,
                LicenseStatus.APPROVED.getCode(),
                longitude,
                latitude,
                MIN_DISTANCE_METERS,
                county
        );
        if (count > 0) {
            throw new BusinessException(ResultCode.LICENSE_DISTANCE_VIOLATION);
        }
    }

    private Integer determineReviewLevel(Integer status) {
        LicenseStatus licenseStatus = LicenseStatus.getByCode(status);
        if (licenseStatus == null) {
            throw new BusinessException(ResultCode.LICENSE_STATUS_ERROR);
        }

        return switch (licenseStatus) {
            case PENDING_FIRST_REVIEW, SUSPENDED, RENEWING, CHANGING -> 1;
            case PENDING_SECOND_REVIEW -> 2;
            case PENDING_FINAL_REVIEW -> 3;
            default -> throw new BusinessException("当前状态无需审批");
        };
    }

    private Retailer createRetailerFromLicense(License license) {
        Retailer retailer = new Retailer();
        retailer.setRetailerName(license.getRetailerName());
        retailer.setLicenseNo(license.getLicenseNo());
        retailer.setLegalPerson(license.getLegalPerson());
        retailer.setIdCardNo(license.getIdCardNo());
        retailer.setPhone(license.getPhone());
        retailer.setProvince(license.getProvince());
        retailer.setCity(license.getCity());
        retailer.setCounty(license.getCounty());
        retailer.setAddress(license.getAddress());
        retailer.setLongitude(license.getLongitude());
        retailer.setLatitude(license.getLatitude());
        retailer.setBusinessType(license.getBusinessType());
        retailer.setTier(1);
        retailer.setCreditLevel("BBB");
        retailer.setCreditScore(75);
        retailer.setConsecutiveNoViolationPeriods(0);
        retailer.setRegisterDate(LocalDate.now());
        retailer.setCountyId(license.getCountyId());
        retailer.setStationId(license.getStationId());
        retailer.setStatus(1);
        retailerMapper.insert(retailer);
        return retailer;
    }

    private void updateRetailerAfterApproval(License license) {
        if (license.getRetailerId() == null) return;
        Retailer retailer = retailerMapper.selectById(license.getRetailerId());
        if (retailer != null) {
            retailer.setLicenseNo(license.getLicenseNo());
            retailer.setTier(license.getTier());
            retailer.setBusinessType(license.getBusinessType());
            retailer.setAddress(license.getAddress());
            retailer.setLongitude(license.getLongitude());
            retailer.setLatitude(license.getLatitude());
            retailer.setStatus(1);
            retailerMapper.updateById(retailer);
        }
    }

    private void updateRetailerStatus(Long retailerId, Integer status) {
        if (retailerId == null) return;
        Retailer retailer = retailerMapper.selectById(retailerId);
        if (retailer != null) {
            retailer.setStatus(status);
            retailerMapper.updateById(retailer);
        }
    }

    public License getLicenseById(Long id) {
        License license = licenseMapper.selectById(id);
        if (license == null) {
            throw new BusinessException(ResultCode.LICENSE_NOT_FOUND);
        }
        return license;
    }

    public License getLicenseByNo(String licenseNo) {
        License license = licenseMapper.selectByLicenseNo(licenseNo);
        if (license == null) {
            throw new BusinessException(ResultCode.LICENSE_NOT_FOUND);
        }
        return license;
    }

    public PageResult<License> getLicensePage(LicenseQuery query) {
        Page<License> page = new Page<>(query.getPageNum(), query.getPageSize());
        IPage<License> result = licenseMapper.selectPageByCondition(
                page,
                query.getStatus(),
                query.getCountyId(),
                query.getStationId(),
                query.getBusinessType(),
                query.getKeyword()
        );
        return PageResult.of(result.getTotal(), result.getPages(), result.getRecords());
    }

    public List<License> getExpiringLicenses() {
        LocalDate startDate = LocalDate.now();
        LocalDate endDate = LocalDate.now().plusDays(EXPIRE_REMIND_DAYS);
        return licenseMapper.selectExpiringLicenses(startDate, endDate, LicenseStatus.APPROVED.getCode());
    }

    public List<License> getLicenseListByRetailer(Long retailerId) {
        LambdaQueryWrapper<License> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(License::getRetailerId, retailerId)
                .orderByDesc(License::getCreateTime);
        return licenseMapper.selectList(wrapper);
    }

    private String generateLicenseNo() {
        return "TC" + LocalDate.now().toString().replace("-", "") + IdUtil.getSnowflakeNextIdStr().substring(0, 8);
    }
}
