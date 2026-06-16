package com.carbon.service.impl;

import cn.hutool.core.bean.BeanUtil;
import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.carbon.common.constant.BizCode;
import com.carbon.common.exception.BizException;
import com.carbon.common.response.PageResult;
import com.carbon.dto.trade.*;
import com.carbon.entity.EmissionWarning;
import com.carbon.entity.Enterprise;
import com.carbon.entity.Quota;
import com.carbon.entity.TradeOrder;
import com.carbon.enums.QuotaStatus;
import com.carbon.enums.TradeMode;
import com.carbon.enums.TradeStatus;
import com.carbon.enums.WarningLevel;
import com.carbon.mapper.EmissionWarningMapper;
import com.carbon.mapper.EnterpriseMapper;
import com.carbon.mapper.QuotaMapper;
import com.carbon.mapper.TradeOrderMapper;
import com.carbon.service.AuditService;
import com.carbon.service.TradeService;
import com.carbon.vo.trade.TradeOrderVO;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.Year;

@Slf4j
@Service
@RequiredArgsConstructor
public class TradeServiceImpl implements TradeService {

    private final TradeOrderMapper tradeOrderMapper;
    private final QuotaMapper quotaMapper;
    private final EnterpriseMapper enterpriseMapper;
    private final EmissionWarningMapper emissionWarningMapper;
    private final AuditService auditService;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TradeOrderVO createListing(TradeListingDTO dto) {
        Enterprise seller = enterpriseMapper.selectById(dto.getSellerId());
        if (seller == null) {
            throw new BizException(BizCode.ENTERPRISE_NOT_FOUND);
        }

        checkSellRestriction(dto.getSellerId());

        Quota quota = getActiveQuota(dto.getSellerId());
        if (quota.getAvailableAmount().compareTo(dto.getAmount()) < 0) {
            throw new BizException(BizCode.QUOTA_INSUFFICIENT);
        }

        freezeQuota(quota, dto.getAmount());

        TradeOrder order = new TradeOrder();
        order.setOrderNo(generateOrderNo());
        order.setSellerId(dto.getSellerId());
        order.setSellerCode(seller.getEnterpriseCode());
        order.setTradeMode(TradeMode.LISTING.getCode());
        order.setAmount(dto.getAmount());
        order.setUnitPrice(dto.getUnitPrice());
        order.setTotalPrice(dto.getAmount().multiply(dto.getUnitPrice()));
        order.setStatus(TradeStatus.FROZEN.getCode());
        order.setListedTime(LocalDateTime.now());
        order.setVersion(0);
        tradeOrderMapper.insert(order);

        auditLog("TRADE_LISTING", order.getId(), dto.getSellerId(), seller.getEnterpriseCode(), null, order);
        return toVO(order);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TradeOrderVO createAgreement(TradeAgreementDTO dto) {
        if (dto.getSellerId().equals(dto.getBuyerId())) {
            throw new BizException(BizCode.TRADE_BUYER_SELF);
        }

        Enterprise seller = enterpriseMapper.selectById(dto.getSellerId());
        Enterprise buyer = enterpriseMapper.selectById(dto.getBuyerId());
        if (seller == null || buyer == null) {
            throw new BizException(BizCode.ENTERPRISE_NOT_FOUND);
        }

        checkSellRestriction(dto.getSellerId());

        Quota sellerQuota = getActiveQuota(dto.getSellerId());
        if (sellerQuota.getAvailableAmount().compareTo(dto.getAmount()) < 0) {
            throw new BizException(BizCode.QUOTA_INSUFFICIENT);
        }

        freezeQuota(sellerQuota, dto.getAmount());

        TradeOrder order = new TradeOrder();
        order.setOrderNo(generateOrderNo());
        order.setSellerId(dto.getSellerId());
        order.setSellerCode(seller.getEnterpriseCode());
        order.setBuyerId(dto.getBuyerId());
        order.setBuyerCode(buyer.getEnterpriseCode());
        order.setTradeMode(TradeMode.AGREEMENT.getCode());
        order.setAmount(dto.getAmount());
        order.setUnitPrice(dto.getUnitPrice());
        order.setTotalPrice(dto.getAmount().multiply(dto.getUnitPrice()));
        order.setStatus(TradeStatus.FROZEN.getCode());
        order.setListedTime(LocalDateTime.now());
        order.setVersion(0);
        tradeOrderMapper.insert(order);

        settleTrade(order);

        auditLog("TRADE_AGREEMENT", order.getId(), dto.getSellerId(), seller.getEnterpriseCode(), null, order);
        return toVO(order);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TradeOrderVO matchOrder(TradeMatchDTO dto) {
        Enterprise buyer = enterpriseMapper.selectById(dto.getBuyerId());
        if (buyer == null) {
            throw new BizException(BizCode.ENTERPRISE_NOT_FOUND);
        }

        TradeOrder listingOrder = tradeOrderMapper.selectById(dto.getListingOrderId());
        if (listingOrder == null) {
            throw new BizException(BizCode.TRADE_NOT_FOUND);
        }
        if (!TradeStatus.FROZEN.getCode().equals(listingOrder.getStatus())) {
            throw new BizException(BizCode.TRADE_QUOTA_LOCKED);
        }
        if (listingOrder.getSellerId().equals(dto.getBuyerId())) {
            throw new BizException(BizCode.TRADE_BUYER_SELF);
        }

        TradeOrder before = BeanUtil.copyProperties(listingOrder, TradeOrder.class);

        listingOrder.setBuyerId(dto.getBuyerId());
        listingOrder.setBuyerCode(buyer.getEnterpriseCode());
        listingOrder.setStatus(TradeStatus.MATCHED.getCode());
        listingOrder.setMatchedTime(LocalDateTime.now());
        tradeOrderMapper.updateById(listingOrder);

        settleTrade(listingOrder);

        auditLog("TRADE_LISTING", listingOrder.getId(), listingOrder.getSellerId(), listingOrder.getSellerCode(), before, listingOrder);
        return toVO(listingOrder);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TradeOrderVO cancelOrder(Long orderId) {
        TradeOrder order = tradeOrderMapper.selectById(orderId);
        if (order == null) {
            throw new BizException(BizCode.TRADE_NOT_FOUND);
        }
        if (!TradeStatus.FROZEN.getCode().equals(order.getStatus())) {
            throw new BizException(BizCode.QUOTA_STATUS_INVALID);
        }

        TradeOrder before = BeanUtil.copyProperties(order, TradeOrder.class);

        order.setStatus(TradeStatus.CANCELLED.getCode());
        order.setCancelReason("主动撤单");
        tradeOrderMapper.updateById(order);

        Quota sellerQuota = getActiveQuota(order.getSellerId());
        sellerQuota.setFrozenAmount(sellerQuota.getFrozenAmount().subtract(order.getAmount()));
        sellerQuota.setAvailableAmount(sellerQuota.getAvailableAmount().add(order.getAmount()));
        quotaMapper.updateById(sellerQuota);

        auditLog("TRADE_LISTING", order.getId(), order.getSellerId(), order.getSellerCode(), before, order);
        return toVO(order);
    }

    @Override
    public TradeOrderVO getById(Long id) {
        TradeOrder order = tradeOrderMapper.selectById(id);
        if (order == null) {
            throw new BizException(BizCode.TRADE_NOT_FOUND);
        }
        return toVO(order);
    }

    @Override
    public PageResult<TradeOrderVO> page(TradeQueryDTO dto) {
        LambdaQueryWrapper<TradeOrder> wrapper = new LambdaQueryWrapper<TradeOrder>()
                .eq(dto.getSellerId() != null, TradeOrder::getSellerId, dto.getSellerId())
                .eq(dto.getBuyerId() != null, TradeOrder::getBuyerId, dto.getBuyerId())
                .eq(dto.getTradeMode() != null, TradeOrder::getTradeMode, dto.getTradeMode())
                .eq(dto.getStatus() != null, TradeOrder::getStatus, dto.getStatus())
                .orderByDesc(TradeOrder::getCreatedTime);

        Page<TradeOrder> page = tradeOrderMapper.selectPage(new Page<>(dto.getPage(), dto.getSize()), wrapper);
        return new PageResult<>(page.getTotal(), (int) page.getCurrent(), (int) page.getSize(),
                page.getRecords().stream().map(this::toVO).toList());
    }

    private void settleTrade(TradeOrder order) {
        Quota sellerQuota = getActiveQuota(order.getSellerId());
        Quota buyerQuota = getOrCreateBuyerQuota(order.getBuyerId());

        sellerQuota.setFrozenAmount(sellerQuota.getFrozenAmount().subtract(order.getAmount()));
        sellerQuota.setUsedAmount(sellerQuota.getUsedAmount().add(order.getAmount()));
        quotaMapper.updateById(sellerQuota);

        buyerQuota.setTotalAmount(buyerQuota.getTotalAmount().add(order.getAmount()));
        buyerQuota.setAvailableAmount(buyerQuota.getAvailableAmount().add(order.getAmount()));
        quotaMapper.updateById(buyerQuota);

        order.setStatus(TradeStatus.SETTLED.getCode());
        order.setSettledTime(LocalDateTime.now());
        tradeOrderMapper.updateById(order);

        auditLog("TRADE_SETTLE", order.getId(), order.getSellerId(), order.getSellerCode(), null, order);
    }

    private void freezeQuota(Quota quota, BigDecimal amount) {
        quota.setAvailableAmount(quota.getAvailableAmount().subtract(amount));
        quota.setFrozenAmount(quota.getFrozenAmount().add(amount));
        quotaMapper.updateById(quota);
    }

    private void checkSellRestriction(Long sellerId) {
        int currentYear = Year.now().getValue();
        EmissionWarning warning = emissionWarningMapper.selectOne(new LambdaQueryWrapper<EmissionWarning>()
                .eq(EmissionWarning::getEnterpriseId, sellerId)
                .eq(EmissionWarning::getWarningYear, currentYear));

        if (warning != null && WarningLevel.ALERT.getCode().equals(warning.getWarningLevel())
                && Boolean.TRUE.equals(warning.getSellRestricted())) {
            throw new BizException(BizCode.TRADE_OVER_LIMIT_WARNING);
        }
    }

    private Quota getActiveQuota(Long enterpriseId) {
        int currentYear = Year.now().getValue();
        Quota quota = quotaMapper.selectOne(new LambdaQueryWrapper<Quota>()
                .eq(Quota::getEnterpriseId, enterpriseId)
                .eq(Quota::getQuotaYear, currentYear)
                .ne(Quota::getStatus, QuotaStatus.PRE_ALLOCATED.getCode()));
        if (quota == null) {
            throw new BizException(BizCode.QUOTA_NOT_FOUND);
        }
        return quota;
    }

    private Quota getOrCreateBuyerQuota(Long buyerId) {
        int currentYear = Year.now().getValue();
        Quota quota = quotaMapper.selectOne(new LambdaQueryWrapper<Quota>()
                .eq(Quota::getEnterpriseId, buyerId)
                .eq(Quota::getQuotaYear, currentYear));
        if (quota == null) {
            Enterprise buyer = enterpriseMapper.selectById(buyerId);
            quota = new Quota();
            quota.setEnterpriseId(buyerId);
            quota.setEnterpriseCode(buyer.getEnterpriseCode());
            quota.setQuotaYear(currentYear);
            quota.setTotalAmount(BigDecimal.ZERO);
            quota.setUsedAmount(BigDecimal.ZERO);
            quota.setFrozenAmount(BigDecimal.ZERO);
            quota.setAvailableAmount(BigDecimal.ZERO);
            quota.setStatus(QuotaStatus.ISSUED.getCode());
            quota.setVersion(0);
            quotaMapper.insert(quota);
        }
        return quota;
    }

    private String generateOrderNo() {
        return "TR" + IdUtil.getSnowflakeNextIdStr();
    }

    private void auditLog(String operation, Long bizId, Long enterpriseId, String enterpriseCode, Object before, Object after) {
        try {
            com.carbon.entity.AuditLog auditLog = new com.carbon.entity.AuditLog();
            auditLog.setBizType(operation);
            auditLog.setBizId(bizId);
            auditLog.setEnterpriseId(enterpriseId);
            auditLog.setEnterpriseCode(enterpriseCode);
            auditLog.setOperation(operation);
            auditLog.setOperator("SYSTEM");
            auditLog.setBeforeSnapshot(before != null ? objectMapper.writeValueAsString(before) : null);
            auditLog.setAfterSnapshot(after != null ? objectMapper.writeValueAsString(after) : null);
            auditService.log(auditLog);
        } catch (Exception e) {
            log.error("审计日志写入失败", e);
        }
    }

    private TradeOrderVO toVO(TradeOrder order) {
        return BeanUtil.copyProperties(order, TradeOrderVO.class);
    }
}
