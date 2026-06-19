package com.talentmarket.enterprise.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.talentmarket.common.exception.BusinessException;
import com.talentmarket.common.result.ResultCode;
import com.talentmarket.common.utils.RedisUtils;
import com.talentmarket.enterprise.entity.Enterprise;
import com.talentmarket.enterprise.mapper.EnterpriseMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class EnterpriseService {

    private final EnterpriseMapper enterpriseMapper;
    private final EnterpriseVerificationService verificationService;
    private final SensitiveWordService sensitiveWordService;
    private final RedisUtils redisUtils;
    private final RedisTemplate<String, Object> redisTemplate;

    private static final String ENTERPRISE_CACHE_KEY = "enterprise:";
    private static final long CACHE_EXPIRE = 3600;

    public Enterprise getById(Long id) {
        String cacheKey = ENTERPRISE_CACHE_KEY + id;
        Enterprise enterprise = (Enterprise) redisUtils.get(cacheKey);
        if (enterprise != null) {
            return enterprise;
        }

        enterprise = enterpriseMapper.selectById(id);
        if (enterprise != null) {
            redisUtils.set(cacheKey, enterprise, CACHE_EXPIRE, TimeUnit.SECONDS);
        }
        return enterprise;
    }

    public IPage<Enterprise> list(int page, int pageSize, String keyword, Integer authStatus, Integer status) {
        LambdaQueryWrapper<Enterprise> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.like(Enterprise::getEnterpriseName, keyword);
        }
        if (authStatus != null) {
            wrapper.eq(Enterprise::getAuthStatus, authStatus);
        }
        if (status != null) {
            wrapper.eq(Enterprise::getStatus, status);
        }
        wrapper.orderByDesc(Enterprise::getCreateTime);
        return enterpriseMapper.selectPage(new Page<>(page, pageSize), wrapper);
    }

    @Transactional(rollbackFor = Exception.class)
    public Enterprise register(Enterprise enterprise) {
        LambdaQueryWrapper<Enterprise> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Enterprise::getUnifiedSocialCreditCode, enterprise.getUnifiedSocialCreditCode());
        if (enterpriseMapper.selectCount(wrapper) > 0) {
            throw new BusinessException(ResultCode.ENTERPRISE_ALREADY_EXISTS);
        }

        sensitiveWordService.checkAndThrow(enterprise.getCompanyDescription(), "企业简介");

        enterprise.setAuthStatus(0);
        enterprise.setStatus(1);
        enterprise.setVerified(0);

        enterpriseMapper.insert(enterprise);
        log.info("企业注册成功，企业ID: {}, 企业名称: {}", enterprise.getId(), enterprise.getEnterpriseName());

        asyncVerifyEnterprise(enterprise.getId());

        return enterprise;
    }

    public void asyncVerifyEnterprise(Long enterpriseId) {
        new Thread(() -> {
            try {
                Thread.sleep(3000);
                autoVerify(enterpriseId);
            } catch (Exception e) {
                log.error("企业资质自动审核异常", e);
            }
        }).start();
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean autoVerify(Long enterpriseId) {
        Enterprise enterprise = enterpriseMapper.selectById(enterpriseId);
        if (enterprise == null) {
            throw new BusinessException("企业不存在");
        }

        if (enterprise.getAuthStatus() != 0) {
            log.info("企业已审核，跳过自动审核，企业ID: {}", enterpriseId);
            return false;
        }

        EnterpriseVerificationService.VerificationResult verifyResult = verificationService.verifyEnterprise(
                enterprise.getEnterpriseName(),
                enterprise.getUnifiedSocialCreditCode(),
                enterprise.getLegalPerson(),
                enterprise.getBusinessLicenseUrl()
        );

        Enterprise update = new Enterprise();
        update.setId(enterpriseId);
        update.setAuthStatus(verifyResult.isPassed() ? 1 : 2);
        update.setAuthRemark(verifyResult.getMessage());
        update.setAuthTime(LocalDateTime.now());
        update.setVerified(verifyResult.isPassed() ? 1 : 0);
        if (verifyResult.isPassed()) {
            update.setVerifiedTime(LocalDateTime.now());
        }

        enterpriseMapper.updateById(update);
        evictCache(enterpriseId);

        log.info("企业自动审核完成，企业: {}, 结果: {}, 原因: {}",
                enterprise.getEnterpriseName(), verifyResult.isPassed() ? "通过" : "不通过", verifyResult.getMessage());

        return verifyResult.isPassed();
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean manualVerify(Long enterpriseId, boolean passed, String remark, Long adminId) {
        Enterprise enterprise = enterpriseMapper.selectById(enterpriseId);
        if (enterprise == null) {
            throw new BusinessException("企业不存在");
        }

        Enterprise update = new Enterprise();
        update.setId(enterpriseId);
        update.setAuthStatus(passed ? 1 : 2);
        update.setAuthRemark(remark);
        update.setAuthTime(LocalDateTime.now());
        update.setAuthBy(adminId);
        update.setVerified(passed ? 1 : 0);
        if (passed) {
            update.setVerifiedTime(LocalDateTime.now());
        }

        enterpriseMapper.updateById(update);
        evictCache(enterpriseId);

        log.info("企业人工审核完成，企业: {}, 结果: {}, 操作人: {}",
                enterprise.getEnterpriseName(), passed ? "通过" : "不通过", adminId);

        return true;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean update(Enterprise enterprise) {
        if (enterprise.getCompanyDescription() != null) {
            sensitiveWordService.checkAndThrow(enterprise.getCompanyDescription(), "企业简介");
        }

        int result = enterpriseMapper.updateById(enterprise);
        if (result > 0) {
            evictCache(enterprise.getId());
        }
        return result > 0;
    }

    public boolean checkEnterpriseVerified(Long enterpriseId) {
        Enterprise enterprise = getById(enterpriseId);
        if (enterprise == null) {
            return false;
        }
        return enterprise.getVerified() != null && enterprise.getVerified() == 1
                && enterprise.getAuthStatus() != null && enterprise.getAuthStatus() == 1;
    }

    private void evictCache(Long enterpriseId) {
        redisUtils.delete(ENTERPRISE_CACHE_KEY + enterpriseId);
    }
}
