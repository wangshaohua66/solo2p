package com.tobacco.service;

import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.tobacco.common.enums.CreditLevel;
import com.tobacco.common.enums.LicenseStatus;
import com.tobacco.common.exception.BusinessException;
import com.tobacco.common.result.PageResult;
import com.tobacco.common.result.ResultCode;
import com.tobacco.dto.request.OrderCreateRequest;
import com.tobacco.dto.request.OrderQuery;
import com.tobacco.dto.response.QuotaResult;
import com.tobacco.entity.*;
import com.tobacco.mapper.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderMapper orderMapper;
    private final OrderItemMapper orderItemMapper;
    private final RetailerMapper retailerMapper;
    private final CigaretteMapper cigaretteMapper;
    private final LicenseMapper licenseMapper;

    @Value("${quota.base-quota-per-tier}")
    private Integer baseQuotaPerTier;

    public QuotaResult calculateQuota(Long retailerId) {
        Retailer retailer = retailerMapper.selectById(retailerId);
        if (retailer == null) {
            throw new BusinessException("零售户不存在");
        }

        License license = licenseMapper.selectLatestByRetailerId(retailerId);
        if (license == null || !LicenseStatus.APPROVED.getCode().equals(license.getStatus())) {
            throw new BusinessException("零售户无有效许可证，无法订货");
        }

        int tier = retailer.getTier() != null ? retailer.getTier() : 1;
        CreditLevel creditLevel = CreditLevel.getByCode(retailer.getCreditLevel());
        if (creditLevel == null) {
            creditLevel = CreditLevel.BBB;
        }

        BigDecimal baseQuota = BigDecimal.valueOf(tier).multiply(BigDecimal.valueOf(baseQuotaPerTier));
        BigDecimal creditCoefficient = creditLevel.getCoefficient();
        BigDecimal salesFactor = calculateSalesFactor(retailerId);

        BigDecimal quotaLimit = baseQuota
                .multiply(creditCoefficient)
                .multiply(salesFactor)
                .setScale(0, RoundingMode.DOWN);

        String orderPeriod = getCurrentOrderPeriod();
        Integer quotaUsed = orderMapper.sumQuantityByRetailerAndPeriod(retailerId, orderPeriod);
        if (quotaUsed == null) quotaUsed = 0;

        int remaining = quotaLimit.intValue() - quotaUsed;
        if (remaining < 0) remaining = 0;

        return QuotaResult.builder()
                .retailerId(retailerId)
                .retailerName(retailer.getRetailerName())
                .tier(tier)
                .creditLevel(creditLevel.getCode())
                .baseQuota(baseQuota.intValue())
                .creditCoefficient(creditCoefficient)
                .salesFactor(salesFactor)
                .quotaLimit(quotaLimit.intValue())
                .quotaUsed(quotaUsed)
                .quotaRemaining(remaining)
                .orderPeriod(orderPeriod)
                .build();
    }

    private BigDecimal calculateSalesFactor(Long retailerId) {
        List<Integer> lastThreeMonths = new ArrayList<>();
        LocalDate now = LocalDate.now();

        for (int i = 1; i <= 3; i++) {
            LocalDate monthDate = now.minusMonths(i);
            String month = monthDate.format(DateTimeFormatter.ofPattern("yyyy-MM"));
            Integer quantity = getMonthlyOrderQuantity(retailerId, month);
            if (quantity != null && quantity > 0) {
                lastThreeMonths.add(quantity);
            }
        }

        if (lastThreeMonths.isEmpty()) {
            return BigDecimal.ONE;
        }

        double average = lastThreeMonths.stream().mapToInt(Integer::intValue).average().orElse(1.0);
        BigDecimal factor = BigDecimal.valueOf(average / (baseQuotaPerTier * 10));

        if (factor.compareTo(BigDecimal.valueOf(0.5)) < 0) {
            factor = BigDecimal.valueOf(0.5);
        }
        if (factor.compareTo(BigDecimal.valueOf(1.5)) > 0) {
            factor = BigDecimal.valueOf(1.5);
        }

        return factor.setScale(2, RoundingMode.HALF_UP);
    }

    private Integer getMonthlyOrderQuantity(Long retailerId, String month) {
        LambdaQueryWrapper<Order> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Order::getRetailerId, retailerId)
                .likeRight(Order::getOrderPeriod, month)
                .ne(Order::getStatus, 5);
        List<Order> orders = orderMapper.selectList(wrapper);
        return orders.stream().mapToInt(o -> o.getTotalQuantity() != null ? o.getTotalQuantity() : 0).sum();
    }

    private String getCurrentOrderPeriod() {
        LocalDate now = LocalDate.now();
        WeekFields weekFields = WeekFields.of(Locale.getDefault());
        int weekNumber = now.get(weekFields.weekOfWeekBasedYear());
        int year = now.get(weekFields.weekBasedYear());
        return year + "-W" + String.format("%02d", weekNumber);
    }

    @Transactional(rollbackFor = Exception.class)
    public Order createOrder(OrderCreateRequest request) {
        Retailer retailer = retailerMapper.selectById(request.getRetailerId());
        if (retailer == null) {
            throw new BusinessException("零售户不存在");
        }

        License license = licenseMapper.selectLatestByRetailerId(request.getRetailerId());
        if (license == null || !LicenseStatus.APPROVED.getCode().equals(license.getStatus())) {
            throw new BusinessException("零售户无有效许可证，无法订货");
        }

        QuotaResult quota = calculateQuota(request.getRetailerId());
        int totalQuantity = request.getItems().stream()
                .mapToInt(OrderCreateRequest.OrderItemRequest::getQuantity)
                .sum();

        if (totalQuantity > quota.getQuotaRemaining()) {
            throw new BusinessException(ResultCode.ORDER_QUOTA_EXCEEDED);
        }

        String orderNo = generateOrderNo();
        String orderPeriod = request.getOrderPeriod() != null ? request.getOrderPeriod() : getCurrentOrderPeriod();

        Order order = new Order();
        order.setOrderNo(orderNo);
        order.setRetailerId(retailer.getId());
        order.setRetailerName(retailer.getRetailerName());
        order.setLicenseNo(retailer.getLicenseNo());
        order.setOrderPeriod(orderPeriod);
        order.setTotalQuantity(totalQuantity);
        order.setQuotaLimit(quota.getQuotaLimit());
        order.setQuotaUsed(quota.getQuotaUsed() + totalQuantity);
        order.setStatus(1);
        order.setDeliveryStatus(0);
        order.setCountyId(retailer.getCountyId());
        order.setStationId(retailer.getStationId());
        orderMapper.insert(order);

        BigDecimal totalAmount = BigDecimal.ZERO;
        List<OrderItem> items = new ArrayList<>();
        for (OrderCreateRequest.OrderItemRequest itemReq : request.getItems()) {
            Cigarette cigarette = cigaretteMapper.selectByCode(itemReq.getCigaretteCode());
            if (cigarette == null) {
                throw new BusinessException("卷烟编码不存在: " + itemReq.getCigaretteCode());
            }

            OrderItem item = new OrderItem();
            item.setOrderId(order.getId());
            item.setOrderNo(orderNo);
            item.setCigaretteCode(cigarette.getCigaretteCode());
            item.setCigaretteName(cigarette.getCigaretteName());
            item.setBrand(cigarette.getBrand());
            item.setSpecification(cigarette.getSpecification());
            item.setUnitPrice(cigarette.getUnitPrice());
            item.setQuantity(itemReq.getQuantity());
            item.setSubtotal(cigarette.getUnitPrice().multiply(BigDecimal.valueOf(itemReq.getQuantity())));
            orderItemMapper.insert(item);
            items.add(item);

            totalAmount = totalAmount.add(item.getSubtotal());
        }

        order.setTotalAmount(totalAmount);
        orderMapper.updateById(order);

        log.info("订单创建成功，订单号：{}，订货总量：{}条，总金额：{}元",
                orderNo, totalQuantity, totalAmount);
        return order;
    }

    public Order getOrderById(Long id) {
        Order order = orderMapper.selectById(id);
        if (order == null) {
            throw new BusinessException(ResultCode.ORDER_NOT_FOUND);
        }
        return order;
    }

    public Order getOrderByNo(String orderNo) {
        Order order = orderMapper.selectByOrderNo(orderNo);
        if (order == null) {
            throw new BusinessException(ResultCode.ORDER_NOT_FOUND);
        }
        return order;
    }

    public List<OrderItem> getOrderItems(Long orderId) {
        return orderItemMapper.selectByOrderId(orderId);
    }

    public PageResult<Order> getOrderPage(OrderQuery query) {
        Page<Order> page = new Page<>(query.getPageNum(), query.getPageSize());
        IPage<Order> result = orderMapper.selectPageByCondition(
                page,
                query.getStatus(),
                query.getRetailerId(),
                query.getCountyId(),
                query.getStationId(),
                query.getOrderPeriod(),
                query.getKeyword()
        );
        return PageResult.of(result.getTotal(), result.getPages(), result.getRecords());
    }

    public List<Order> getOrdersByRetailer(Long retailerId) {
        LambdaQueryWrapper<Order> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Order::getRetailerId, retailerId)
                .orderByDesc(Order::getCreateTime);
        return orderMapper.selectList(wrapper);
    }

    private String generateOrderNo() {
        return "OD" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")) +
                IdUtil.getSnowflakeNextIdStr().substring(0, 4);
    }
}
