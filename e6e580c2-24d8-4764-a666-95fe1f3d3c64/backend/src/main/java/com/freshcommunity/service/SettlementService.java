package com.freshcommunity.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.freshcommunity.entity.*;
import com.freshcommunity.mapper.SettlementItemMapper;
import com.freshcommunity.mapper.SettlementMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

@Slf4j
@Service
public class SettlementService extends ServiceImpl<SettlementMapper, Settlement> {

    @Autowired
    private SettlementItemMapper settlementItemMapper;

    @Autowired
    private OrderService orderService;

    @Autowired
    private ProductService productService;

    @Autowired
    private SupplierService supplierService;

    @Autowired
    private GroupLeaderService groupLeaderService;

    @Transactional(rollbackFor = Exception.class)
    public Settlement generateSupplierSettlement(Long supplierId, LocalDate startDate, LocalDate endDate) {
        Supplier supplier = supplierService.getById(supplierId);
        if (supplier == null) {
            throw new RuntimeException("供应商不存在");
        }
        List<Product> products = productService.getProductsBySupplier(supplierId);
        Set<Long> productIds = products.stream().map(Product::getId).collect(Collectors.toSet());

        Settlement settlement = new Settlement();
        settlement.setSettlementNo(generateSettlementNo());
        settlement.setType(1);
        settlement.setTargetId(supplierId);
        settlement.setTargetName(supplier.getName());
        settlement.setStartDate(startDate);
        settlement.setEndDate(endDate);
        settlement.setStatus(0);

        BigDecimal totalAmount = BigDecimal.ZERO;
        int orderCount = 0;

        List<Order> completedOrders = orderService.list(new LambdaQueryWrapper<Order>()
                .eq(Order::getStatus, 4)
                .ge(Order::getCreateTime, startDate.atStartOfDay())
                .le(Order::getCreateTime, endDate.atTime(23, 59, 59)));

        List<SettlementItem> items = new ArrayList<>();
        for (Order order : completedOrders) {
            List<OrderItem> orderItems = orderService.getOrderItems(order.getId());
            for (OrderItem item : orderItems) {
                if (productIds.contains(item.getProductId())) {
                    Product product = productService.getById(item.getProductId());
                    BigDecimal supplierAmount = product.getPurchasePrice().multiply(BigDecimal.valueOf(item.getQuantity()));
                    BigDecimal platformProfit = item.getTotalPrice().subtract(supplierAmount);

                    SettlementItem settleItem = new SettlementItem();
                    settleItem.setOrderId(order.getId());
                    settleItem.setOrderNo(order.getOrderNo());
                    settleItem.setProductId(item.getProductId());
                    settleItem.setProductName(item.getProductName());
                    settleItem.setAmount(supplierAmount);
                    settleItem.setProfit(platformProfit);
                    items.add(settleItem);

                    totalAmount = totalAmount.add(supplierAmount);
                    orderCount++;
                }
            }
        }

        settlement.setTotalAmount(totalAmount);
        settlement.setOrderCount(orderCount);
        settlement.setPlatformProfit(calculatePlatformProfit(items));
        settlement.setSettleAmount(totalAmount);
        save(settlement);

        for (SettlementItem item : items) {
            item.setSettlementId(settlement.getId());
            settlementItemMapper.insert(item);
        }

        return settlement;
    }

    @Transactional(rollbackFor = Exception.class)
    public Settlement generateLeaderSettlement(Long leaderId, LocalDate startDate, LocalDate endDate) {
        GroupLeader leader = groupLeaderService.getById(leaderId);
        if (leader == null) {
            throw new RuntimeException("团长不存在");
        }

        Settlement settlement = new Settlement();
        settlement.setSettlementNo(generateSettlementNo());
        settlement.setType(2);
        settlement.setTargetId(leaderId);
        settlement.setTargetName(leader.getName());
        settlement.setStartDate(startDate);
        settlement.setEndDate(endDate);
        settlement.setStatus(0);

        BigDecimal totalAmount = BigDecimal.ZERO;
        BigDecimal commissionAmount = BigDecimal.ZERO;
        int orderCount = 0;

        List<Order> completedOrders = orderService.list(new LambdaQueryWrapper<Order>()
                .eq(Order::getLeaderId, leaderId)
                .eq(Order::getStatus, 4)
                .ge(Order::getCreateTime, startDate.atStartOfDay())
                .le(Order::getCreateTime, endDate.atTime(23, 59, 59)));

        List<SettlementItem> items = new ArrayList<>();
        BigDecimal commissionRate = leader.getCommissionRate() != null
                ? leader.getCommissionRate().divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP)
                : new BigDecimal("0.05");

        for (Order order : completedOrders) {
            List<OrderItem> orderItems = orderService.getOrderItems(order.getId());
            for (OrderItem item : orderItems) {
                BigDecimal commission = item.getTotalPrice().multiply(commissionRate)
                        .setScale(2, RoundingMode.HALF_UP);

                SettlementItem settleItem = new SettlementItem();
                settleItem.setOrderId(order.getId());
                settleItem.setOrderNo(order.getOrderNo());
                settleItem.setProductId(item.getProductId());
                settleItem.setProductName(item.getProductName());
                settleItem.setAmount(item.getTotalPrice());
                settleItem.setCommission(commission);
                items.add(settleItem);

                totalAmount = totalAmount.add(item.getTotalPrice());
                commissionAmount = commissionAmount.add(commission);
            }
            orderCount++;
        }

        settlement.setTotalAmount(totalAmount);
        settlement.setOrderCount(orderCount);
        settlement.setCommissionAmount(commissionAmount);
        settlement.setSettleAmount(commissionAmount);
        save(settlement);

        for (SettlementItem item : items) {
            item.setSettlementId(settlement.getId());
            settlementItemMapper.insert(item);
        }

        return settlement;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean executeSettlement(Long settlementId) {
        Settlement settlement = getById(settlementId);
        if (settlement == null || settlement.getStatus() != 0) {
            return false;
        }
        settlement.setStatus(1);
        settlement.setSettleTime(LocalDateTime.now());
        boolean success = updateById(settlement);

        if (success && settlement.getType() == 2) {
            GroupLeader leader = groupLeaderService.getById(settlement.getTargetId());
            if (leader != null) {
                BigDecimal totalCommission = leader.getTotalCommission() == null ? BigDecimal.ZERO : leader.getTotalCommission();
                BigDecimal available = leader.getAvailableCommission() == null ? BigDecimal.ZERO : leader.getAvailableCommission();
                leader.setTotalCommission(totalCommission.add(settlement.getCommissionAmount()));
                leader.setAvailableCommission(available.add(settlement.getCommissionAmount()));
                groupLeaderService.updateById(leader);
            }
        }

        if (success && settlement.getType() == 1) {
            Supplier supplier = supplierService.getById(settlement.getTargetId());
            if (supplier != null) {
                BigDecimal total = supplier.getTotalSettlement() == null ? BigDecimal.ZERO : supplier.getTotalSettlement();
                supplier.setTotalSettlement(total.add(settlement.getSettleAmount()));
                supplierService.updateById(supplier);
            }
        }
        return success;
    }

    public boolean adjustSettlementAmount(Long settlementId, BigDecimal newAmount, String remark) {
        Settlement settlement = getById(settlementId);
        if (settlement == null) {
            return false;
        }
        settlement.setSettleAmount(newAmount);
        settlement.setRemark(remark);
        return updateById(settlement);
    }

    public List<SettlementItem> getSettlementItems(Long settlementId) {
        return settlementItemMapper.selectList(new LambdaQueryWrapper<SettlementItem>()
                .eq(SettlementItem::getSettlementId, settlementId));
    }

    public Page<Settlement> getSettlementPage(int pageNum, int pageSize, String settlementNo,
                                              Integer type, Long targetId, Integer status,
                                              String startDate, String endDate) {
        Page<Settlement> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Settlement> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(settlementNo)) {
            wrapper.like(Settlement::getSettlementNo, settlementNo);
        }
        if (type != null) {
            wrapper.eq(Settlement::getType, type);
        }
        if (targetId != null) {
            wrapper.eq(Settlement::getTargetId, targetId);
        }
        if (status != null) {
            wrapper.eq(Settlement::getStatus, status);
        }
        if (StringUtils.hasText(startDate)) {
            wrapper.ge(Settlement::getCreateTime, LocalDate.parse(startDate).atStartOfDay());
        }
        if (StringUtils.hasText(endDate)) {
            wrapper.le(Settlement::getCreateTime, LocalDate.parse(endDate).atTime(23, 59, 59));
        }
        wrapper.orderByDesc(Settlement::getCreateTime);
        return page(page, wrapper);
    }

    public Map<String, Object> getSettlementStatistics() {
        List<Settlement> all = list();
        Map<String, Object> stats = new HashMap<>();
        BigDecimal supplierTotal = BigDecimal.ZERO;
        BigDecimal leaderCommissionTotal = BigDecimal.ZERO;
        BigDecimal platformProfitTotal = BigDecimal.ZERO;
        int pendingCount = 0;
        int completedCount = 0;

        for (Settlement s : all) {
            if (s.getType() == 1) {
                supplierTotal = supplierTotal.add(s.getSettleAmount() == null ? BigDecimal.ZERO : s.getSettleAmount());
                platformProfitTotal = platformProfitTotal.add(s.getPlatformProfit() == null ? BigDecimal.ZERO : s.getPlatformProfit());
            } else if (s.getType() == 2) {
                leaderCommissionTotal = leaderCommissionTotal.add(s.getCommissionAmount() == null ? BigDecimal.ZERO : s.getCommissionAmount());
            }
            if (s.getStatus() == 0) {
                pendingCount++;
            } else {
                completedCount++;
            }
        }

        stats.put("supplierTotalSettlement", supplierTotal);
        stats.put("leaderCommissionTotal", leaderCommissionTotal);
        stats.put("platformProfitTotal", platformProfitTotal);
        stats.put("totalRevenue", supplierTotal.add(leaderCommissionTotal).add(platformProfitTotal));
        stats.put("pendingCount", pendingCount);
        stats.put("completedCount", completedCount);
        return stats;
    }

    private BigDecimal calculatePlatformProfit(List<SettlementItem> items) {
        return items.stream()
                .map(i -> i.getProfit() == null ? BigDecimal.ZERO : i.getProfit())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private String generateSettlementNo() {
        return "STL" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
                + String.format("%04d", ThreadLocalRandom.current().nextInt(10000));
    }
}
