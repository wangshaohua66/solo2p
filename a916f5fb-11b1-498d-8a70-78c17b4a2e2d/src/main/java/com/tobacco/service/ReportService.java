package com.tobacco.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.tobacco.common.enums.*;
import com.tobacco.dto.response.*;
import com.tobacco.entity.*;
import com.tobacco.mapper.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReportService {

    private final LicenseMapper licenseMapper;
    private final RetailerMapper retailerMapper;
    private final OrderMapper orderMapper;
    private final OrderItemMapper orderItemMapper;
    private final InspectionTaskMapper inspectionTaskMapper;
    private final ViolationRecordMapper violationRecordMapper;
    private final DeliveryPlanMapper deliveryPlanMapper;
    private final DeliveryRouteMapper deliveryRouteMapper;
    private final CreditRecordMapper creditRecordMapper;

    public LicenseStatistics getLicenseStatistics(String timeDimension, String startTime, String endTime, Long countyId) {
        List<License> allLicenses = licenseMapper.selectList(new LambdaQueryWrapper<License>()
                .eq(countyId != null, License::getCountyId, countyId));

        long totalCount = allLicenses.size();
        long activeCount = allLicenses.stream()
                .filter(l -> LicenseStatus.APPROVED.getCode().equals(l.getStatus()))
                .count();
        long suspendedCount = allLicenses.stream()
                .filter(l -> LicenseStatus.SUSPENDED.getCode().equals(l.getStatus()))
                .count();
        long cancelledCount = allLicenses.stream()
                .filter(l -> LicenseStatus.CANCELLED.getCode().equals(l.getStatus()))
                .count();
        long pendingCount = allLicenses.stream()
                .filter(l -> l.getStatus() != null && l.getStatus() < 10)
                .count();

        String monthStart = LocalDate.now().withDayOfMonth(1).toString();
        long newThisMonth = allLicenses.stream()
                .filter(l -> l.getCreateTime() != null
                        && l.getCreateTime().toLocalDate().toString().compareTo(monthStart) >= 0)
                .count();

        LocalDate today = LocalDate.now();
        LocalDate in30Days = today.plusDays(30);
        long expiringSoon = allLicenses.stream()
                .filter(l -> l.getExpireDate() != null
                        && !l.getExpireDate().isBefore(today)
                        && !l.getExpireDate().isAfter(in30Days)
                        && LicenseStatus.APPROVED.getCode().equals(l.getStatus()))
                .count();

        Map<String, Long> byBusinessType = allLicenses.stream()
                .filter(l -> l.getBusinessType() != null)
                .collect(Collectors.groupingBy(License::getBusinessType, Collectors.counting()));

        Map<Integer, Long> byTier = allLicenses.stream()
                .filter(l -> l.getTier() != null)
                .collect(Collectors.groupingBy(License::getTier, Collectors.counting()));

        return LicenseStatistics.builder()
                .totalCount(totalCount)
                .activeCount(activeCount)
                .suspendedCount(suspendedCount)
                .cancelledCount(cancelledCount)
                .pendingCount(pendingCount)
                .newThisMonth(newThisMonth)
                .expiringSoon(expiringSoon)
                .byBusinessType(byBusinessType)
                .byTier(byTier)
                .build();
    }

    public OrderStatistics getOrderStatistics(String timeDimension, String startTime, String endTime, Long countyId) {
        LambdaQueryWrapper<Order> queryWrapper = new LambdaQueryWrapper<Order>()
                .eq(countyId != null, Order::getCountyId, countyId);
        List<Order> orders = orderMapper.selectList(queryWrapper);

        long totalOrders = orders.size();
        long totalQuantity = orders.stream()
                .mapToLong(o -> o.getTotalQuantity() != null ? o.getTotalQuantity() : 0)
                .sum();
        BigDecimal totalAmount = orders.stream()
                .map(o -> o.getTotalAmount() != null ? o.getTotalAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long retailerCount = retailerMapper.selectCount(null);
        BigDecimal avgQuantityPerRetailer = retailerCount > 0
                ? BigDecimal.valueOf(totalQuantity).divide(BigDecimal.valueOf(retailerCount), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        long completedOrders = orders.stream()
                .filter(o -> o.getStatus() != null && o.getStatus() == 4)
                .count();
        BigDecimal fulfillmentRate = totalOrders > 0
                ? BigDecimal.valueOf(completedOrders).divide(BigDecimal.valueOf(totalOrders), 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                : BigDecimal.ZERO;

        Map<String, Long> trendByPeriod = orders.stream()
                .filter(o -> o.getOrderPeriod() != null)
                .collect(Collectors.groupingBy(Order::getOrderPeriod, Collectors.counting()));

        Map<Integer, Long> byTier = new HashMap<>();
        for (int i = 1; i <= 30; i++) {
            byTier.put(i, 0L);
        }

        return OrderStatistics.builder()
                .totalOrders(totalOrders)
                .totalQuantity(totalQuantity)
                .totalAmount(totalAmount)
                .avgQuantityPerRetailer(avgQuantityPerRetailer)
                .fulfillmentRate(fulfillmentRate)
                .quotaExceededCount(0L)
                .trendByPeriod(trendByPeriod)
                .byTier(byTier)
                .build();
    }

    public InspectionStatistics getInspectionStatistics(String timeDimension, String startTime, String endTime, Long countyId) {
        List<InspectionTask> tasks = inspectionTaskMapper.selectList(
                new LambdaQueryWrapper<InspectionTask>()
                        .eq(countyId != null, InspectionTask::getCountyId, countyId));

        List<ViolationRecord> violations = violationRecordMapper.selectList(
                new LambdaQueryWrapper<ViolationRecord>()
                        .eq(countyId != null, ViolationRecord::getCountyId, countyId));

        long totalTasks = tasks.size();
        long completedTasks = tasks.stream()
                .filter(t -> t.getStatus() != null && t.getStatus() == 3)
                .count();
        long totalViolations = violations.size();

        BigDecimal violationRate = totalTasks > 0
                ? BigDecimal.valueOf(totalViolations).divide(BigDecimal.valueOf(totalTasks), 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                : BigDecimal.ZERO;

        Map<String, Long> byViolationType = violations.stream()
                .filter(v -> v.getViolationTypeName() != null)
                .collect(Collectors.groupingBy(ViolationRecord::getViolationTypeName, Collectors.counting()));

        Map<String, Long> bySeverity = violations.stream()
                .filter(v -> v.getSeverity() != null)
                .collect(Collectors.groupingBy(ViolationRecord::getSeverity, Collectors.counting()));

        Map<String, Long> byInspector = tasks.stream()
                .filter(t -> t.getInspectorName() != null)
                .collect(Collectors.groupingBy(InspectionTask::getInspectorName, Collectors.counting()));

        return InspectionStatistics.builder()
                .totalTasks(totalTasks)
                .completedTasks(completedTasks)
                .totalViolations(totalViolations)
                .violationRate(violationRate)
                .byViolationType(byViolationType)
                .bySeverity(bySeverity)
                .byInspector(byInspector)
                .build();
    }

    public DeliveryStatistics getDeliveryStatistics(String timeDimension, String startTime, String endTime, Long countyId) {
        List<DeliveryPlan> plans = deliveryPlanMapper.selectList(
                new LambdaQueryWrapper<DeliveryPlan>()
                        .eq(countyId != null, DeliveryPlan::getCountyId, countyId));

        List<DeliveryRoute> routes = deliveryRouteMapper.selectList(null);

        long totalPlans = plans.size();
        long totalOrders = plans.stream()
                .mapToLong(p -> p.getTotalOrders() != null ? p.getTotalOrders() : 0)
                .sum();
        long totalQuantity = plans.stream()
                .mapToLong(p -> p.getTotalQuantity() != null ? p.getTotalQuantity() : 0)
                .sum();

        BigDecimal avgLoadRate = routes.isEmpty() ? BigDecimal.ZERO :
                routes.stream()
                        .map(r -> r.getLoadRate() != null ? r.getLoadRate() : BigDecimal.ZERO)
                        .reduce(BigDecimal.ZERO, BigDecimal::add)
                        .divide(BigDecimal.valueOf(routes.size()), 2, RoundingMode.HALF_UP);

        BigDecimal emptyLoadRate = BigDecimal.valueOf(100).subtract(avgLoadRate);

        BigDecimal avgDistance = routes.isEmpty() ? BigDecimal.ZERO :
                routes.stream()
                        .map(r -> r.getEstimatedDistance() != null ? r.getEstimatedDistance() : BigDecimal.ZERO)
                        .reduce(BigDecimal.ZERO, BigDecimal::add)
                        .divide(BigDecimal.valueOf(routes.size()), 2, RoundingMode.HALF_UP);

        BigDecimal avgCalcTime = plans.isEmpty() ? BigDecimal.ZERO :
                plans.stream()
                        .map(p -> p.getCalcTime() != null ? p.getCalcTime() : BigDecimal.ZERO)
                        .reduce(BigDecimal.ZERO, BigDecimal::add)
                        .divide(BigDecimal.valueOf(plans.size()), 3, RoundingMode.HALF_UP);

        Map<Integer, Long> byFleet = routes.stream()
                .filter(r -> r.getFleetId() != null)
                .collect(Collectors.groupingBy(r -> r.getFleetId().intValue(),
                        Collectors.summingLong(r -> r.getTotalLoad() != null ? r.getTotalLoad() : 0)));

        return DeliveryStatistics.builder()
                .totalPlans(totalPlans)
                .totalOrders(totalOrders)
                .totalQuantity(totalQuantity)
                .avgLoadRate(avgLoadRate)
                .emptyLoadRate(emptyLoadRate)
                .avgDistance(avgDistance)
                .byFleet(byFleet)
                .avgCalcTime(avgCalcTime)
                .build();
    }

    public CreditStatistics getCreditStatistics(String timeDimension, String startTime, String endTime, Long countyId) {
        List<Retailer> retailers = retailerMapper.selectList(
                new LambdaQueryWrapper<Retailer>()
                        .eq(countyId != null, Retailer::getCountyId, countyId));

        List<CreditRecord> records = creditRecordMapper.selectList(
                new LambdaQueryWrapper<CreditRecord>()
                        .eq(countyId != null, CreditRecord::getCountyId, countyId));

        long totalRetailers = retailers.size();

        BigDecimal avgScore = retailers.isEmpty() ? BigDecimal.ZERO :
                BigDecimal.valueOf(retailers.stream()
                        .mapToInt(r -> r.getCreditScore() != null ? r.getCreditScore() : 0)
                        .average()
                        .orElse(0.0)).setScale(2, RoundingMode.HALF_UP);

        Map<String, Long> byLevel = retailers.stream()
                .filter(r -> r.getCreditLevel() != null)
                .collect(Collectors.groupingBy(Retailer::getCreditLevel, Collectors.counting()));

        long totalChanges = records.size();
        long deductCount = records.stream()
                .filter(r -> "DEDUCT".equals(r.getChangeType()))
                .count();
        long bonusCount = records.stream()
                .filter(r -> "BONUS".equals(r.getChangeType()))
                .count();
        long repairCount = records.stream()
                .filter(r -> "REPAIR".equals(r.getChangeType()))
                .count();

        long downgradeCount = records.stream()
                .filter(r -> r.getBeforeLevel() != null && r.getAfterLevel() != null)
                .filter(r -> {
                    CreditLevel before = CreditLevel.getByCode(r.getBeforeLevel());
                    CreditLevel after = CreditLevel.getByCode(r.getAfterLevel());
                    return before != null && after != null && before.getRank() > after.getRank();
                })
                .count();

        long upgradeCount = records.stream()
                .filter(r -> r.getBeforeLevel() != null && r.getAfterLevel() != null)
                .filter(r -> {
                    CreditLevel before = CreditLevel.getByCode(r.getBeforeLevel());
                    CreditLevel after = CreditLevel.getByCode(r.getAfterLevel());
                    return before != null && after != null && before.getRank() < after.getRank();
                })
                .count();

        return CreditStatistics.builder()
                .totalRetailers(totalRetailers)
                .avgScore(avgScore)
                .byLevel(byLevel)
                .totalChanges(totalChanges)
                .deductCount(deductCount)
                .bonusCount(bonusCount)
                .repairCount(repairCount)
                .downgradeCount(downgradeCount)
                .upgradeCount(upgradeCount)
                .build();
    }

    public Map<String, Object> getOverviewStatistics(Long countyId) {
        Map<String, Object> result = new HashMap<>();

        LicenseStatistics licenseStats = getLicenseStatistics("month", null, null, countyId);
        OrderStatistics orderStats = getOrderStatistics("month", null, null, countyId);
        InspectionStatistics inspectionStats = getInspectionStatistics("month", null, null, countyId);
        DeliveryStatistics deliveryStats = getDeliveryStatistics("month", null, null, countyId);
        CreditStatistics creditStats = getCreditStatistics("month", null, null, countyId);

        result.put("license", licenseStats);
        result.put("order", orderStats);
        result.put("inspection", inspectionStats);
        result.put("delivery", deliveryStats);
        result.put("credit", creditStats);

        return result;
    }
}
