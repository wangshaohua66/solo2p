package com.freshcommunity.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.freshcommunity.entity.*;
import com.freshcommunity.mapper.OrderItemMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class DashboardService {

    @Autowired
    private OrderService orderService;

    @Autowired
    private OrderItemMapper orderItemMapper;

    @Autowired
    private ProductService productService;

    @Autowired
    private CommunityService communityService;

    @Autowired
    private SupplierService supplierService;

    @Autowired
    private ResidentUserService residentUserService;

    @Autowired
    private GroupLeaderService groupLeaderService;

    public Map<String, Object> getOverviewStatistics() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalProducts", productService.count());
        stats.put("totalCommunities", communityService.count());
        stats.put("totalSuppliers", supplierService.count());
        stats.put("totalUsers", residentUserService.count());
        stats.put("totalLeaders", groupLeaderService.count());

        List<Order> allOrders = orderService.list();
        BigDecimal totalRevenue = allOrders.stream()
                .filter(o -> o.getStatus() >= 1 && o.getStatus() <= 4)
                .map(o -> o.getPayAmount() == null ? BigDecimal.ZERO : o.getPayAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        stats.put("totalRevenue", totalRevenue);
        stats.put("totalOrders", allOrders.size());

        LocalDate today = LocalDate.now();
        List<Order> todayOrders = allOrders.stream()
                .filter(o -> o.getCreateTime() != null && o.getCreateTime().toLocalDate().equals(today))
                .collect(Collectors.toList());
        BigDecimal todayRevenue = todayOrders.stream()
                .filter(o -> o.getStatus() >= 1 && o.getStatus() <= 4)
                .map(o -> o.getPayAmount() == null ? BigDecimal.ZERO : o.getPayAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        stats.put("todayOrders", todayOrders.size());
        stats.put("todayRevenue", todayRevenue);

        stats.put("pendingPaymentOrders", allOrders.stream().filter(o -> o.getStatus() == 0).count());
        stats.put("pendingDeliveryOrders", allOrders.stream().filter(o -> o.getStatus() == 1).count());
        stats.put("deliveringOrders", allOrders.stream().filter(o -> o.getStatus() == 2).count());
        stats.put("completedOrders", allOrders.stream().filter(o -> o.getStatus() == 4).count());
        stats.put("cancelledOrders", allOrders.stream().filter(o -> o.getStatus() == 5).count());

        return stats;
    }

    public Map<String, Object> getSalesTrend(String dimension, String startDate, String endDate) {
        LocalDate start = StringUtils.hasText(startDate) ? LocalDate.parse(startDate) : LocalDate.now().minusDays(30);
        LocalDate end = StringUtils.hasText(endDate) ? LocalDate.parse(endDate) : LocalDate.now();

        List<Order> orders = orderService.list(new LambdaQueryWrapper<Order>()
                .ge(Order::getCreateTime, start.atStartOfDay())
                .le(Order::getCreateTime, end.atTime(23, 59, 59))
                .in(Order::getStatus, 1, 2, 3, 4));

        Map<String, BigDecimal> dailySales = new TreeMap<>();
        DateTimeFormatter formatter;
        if ("week".equals(dimension)) {
            formatter = DateTimeFormatter.ofPattern("yyyy-ww");
        } else if ("month".equals(dimension)) {
            formatter = DateTimeFormatter.ofPattern("yyyy-MM");
        } else if ("year".equals(dimension)) {
            formatter = DateTimeFormatter.ofPattern("yyyy");
        } else {
            formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        }

        for (Order order : orders) {
            String key = order.getCreateTime().toLocalDate().format(formatter);
            BigDecimal amount = order.getPayAmount() == null ? BigDecimal.ZERO : order.getPayAmount();
            dailySales.merge(key, amount, BigDecimal::add);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("categories", new ArrayList<>(dailySales.keySet()));
        result.put("values", new ArrayList<>(dailySales.values()));
        return result;
    }

    public Map<String, Object> getTopSellingProducts(int limit) {
        List<Product> products = productService.list();
        List<Map<String, Object>> topProducts = products.stream()
                .sorted((a, b) -> (b.getSoldCount() == null ? 0 : b.getSoldCount())
                        - (a.getSoldCount() == null ? 0 : a.getSoldCount()))
                .limit(limit)
                .map(p -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("productId", p.getId());
                    item.put("productName", p.getName());
                    item.put("soldCount", p.getSoldCount());
                    item.put("totalStock", p.getTotalStock());
                    item.put("sellingPrice", p.getSellingPrice());
                    return item;
                })
                .collect(Collectors.toList());
        Map<String, Object> result = new HashMap<>();
        result.put("topProducts", topProducts);
        return result;
    }

    public Map<String, Object> getCommunitySalesComparison() {
        List<Community> communities = communityService.list();
        List<Order> orders = orderService.list(new LambdaQueryWrapper<Order>()
                .in(Order::getStatus, 1, 2, 3, 4));

        Map<Long, BigDecimal> communitySales = new HashMap<>();
        for (Order order : orders) {
            BigDecimal amount = order.getPayAmount() == null ? BigDecimal.ZERO : order.getPayAmount();
            communitySales.merge(order.getCommunityId(), amount, BigDecimal::add);
        }

        List<Map<String, Object>> comparison = communities.stream()
                .map(c -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("communityId", c.getId());
                    item.put("communityName", c.getName());
                    item.put("sales", communitySales.getOrDefault(c.getId(), BigDecimal.ZERO));
                    item.put("residentCount", c.getResidentCount());
                    return item;
                })
                .sorted((a, b) -> ((BigDecimal) b.get("sales")).compareTo((BigDecimal) a.get("sales")))
                .collect(Collectors.toList());

        Map<String, Object> result = new HashMap<>();
        result.put("communities", comparison);
        return result;
    }

    public Map<String, Object> getInventoryWarning() {
        List<Product> products = productService.list();
        List<Map<String, Object>> warnings = products.stream()
                .filter(p -> p.getTotalStock() != null && p.getSoldCount() != null)
                .filter(p -> {
                    int remaining = p.getTotalStock() - p.getSoldCount();
                    double ratio = p.getTotalStock() > 0 ? (double) remaining / p.getTotalStock() : 0;
                    return ratio < 0.2;
                })
                .map(p -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("productId", p.getId());
                    item.put("productName", p.getName());
                    item.put("totalStock", p.getTotalStock());
                    item.put("soldCount", p.getSoldCount());
                    item.put("remaining", p.getTotalStock() - p.getSoldCount());
                    return item;
                })
                .collect(Collectors.toList());
        Map<String, Object> result = new HashMap<>();
        result.put("warnings", warnings);
        return result;
    }

    public Map<String, Object> getCategoryDistribution() {
        List<Product> products = productService.list();
        Map<Long, Long> categoryCount = products.stream()
                .collect(Collectors.groupingBy(
                        p -> p.getCategoryId() == null ? 0L : p.getCategoryId(),
                        Collectors.counting()));
        Map<String, Object> result = new HashMap<>();
        result.put("categories", new ArrayList<>(categoryCount.keySet()));
        result.put("counts", new ArrayList<>(categoryCount.values()));
        return result;
    }
}
