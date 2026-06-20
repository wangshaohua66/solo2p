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
import java.time.LocalDateTime;
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
    private final QuotaExceedRecordMapper quotaExceedRecordMapper;

    private LocalDateTime parseStartTime(String timeDimension, String startTime) {
        if (startTime != null && !startTime.isEmpty()) {
            return LocalDateTime.parse(startTime + "T00:00:00");
        }
        LocalDate now = LocalDate.now();
        return switch (timeDimension != null ? timeDimension : "month") {
            case "week" -> LocalDateTime.of(now.minusDays(7), java.time.LocalTime.MIN);
            case "quarter" -> LocalDateTime.of(now.minusMonths(3), java.time.LocalTime.MIN);
            case "year" -> LocalDateTime.of(now.minusYears(1), java.time.LocalTime.MIN);
            default -> LocalDateTime.of(now.withDayOfMonth(1), java.time.LocalTime.MIN);
        };
    }

    private LocalDateTime parseEndTime(String timeDimension, String endTime) {
        if (endTime != null && !endTime.isEmpty()) {
            return LocalDateTime.parse(endTime + "T23:59:59");
        }
        return LocalDateTime.now();
    }

    public LicenseStatistics getLicenseStatistics(String timeDimension, String startTime, String endTime, Long countyId) {
        LocalDateTime start = parseStartTime(timeDimension, startTime);
        LocalDateTime end = parseEndTime(timeDimension, endTime);

        List<License> allLicenses = licenseMapper.selectList(new LambdaQueryWrapper<License>()
                .eq(countyId != null, License::getCountyId, countyId));

        List<License> timeFiltered = allLicenses.stream()
                .filter(l -> l.getCreateTime() == null
                        || (!l.getCreateTime().isBefore(start) && !l.getCreateTime().isAfter(end)))
                .collect(Collectors.toList());

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

        long newThisPeriod = timeFiltered.size();

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

        Map<String, Long> byCounty = allLicenses.stream()
                .filter(l -> l.getCounty() != null)
                .collect(Collectors.groupingBy(License::getCounty, Collectors.counting()));

        Map<Integer, Long> byTier = allLicenses.stream()
                .filter(l -> l.getTier() != null)
                .collect(Collectors.groupingBy(License::getTier, Collectors.counting()));

        return LicenseStatistics.builder()
                .totalCount(totalCount)
                .activeCount(activeCount)
                .suspendedCount(suspendedCount)
                .cancelledCount(cancelledCount)
                .pendingCount(pendingCount)
                .newThisMonth(newThisPeriod)
                .expiringSoon(expiringSoon)
                .byBusinessType(byBusinessType)
                .byCounty(byCounty)
                .byTier(byTier)
                .build();
    }

    public OrderStatistics getOrderStatistics(String timeDimension, String startTime, String endTime, Long countyId) {
        LocalDateTime start = parseStartTime(timeDimension, startTime);
        LocalDateTime end = parseEndTime(timeDimension, endTime);

        List<Order> allOrders = orderMapper.selectList(new LambdaQueryWrapper<Order>()
                .eq(countyId != null, Order::getCountyId, countyId));

        List<Order> timeFiltered = allOrders.stream()
                .filter(o -> o.getCreateTime() != null
                        && !o.getCreateTime().isBefore(start)
                        && !o.getCreateTime().isAfter(end))
                .collect(Collectors.toList());

        long totalOrders = timeFiltered.size();
        long totalQuantity = timeFiltered.stream()
                .mapToLong(o -> o.getTotalQuantity() != null ? o.getTotalQuantity() : 0)
                .sum();
        BigDecimal totalAmount = timeFiltered.stream()
                .map(o -> o.getTotalAmount() != null ? o.getTotalAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long activeRetailerCount = retailerMapper.selectCount(new LambdaQueryWrapper<Retailer>()
                        .eq(Retailer::getStatus, 1)
                        .eq(countyId != null, Retailer::getCountyId, countyId))
                .intValue();
        BigDecimal avgQuantityPerRetailer = activeRetailerCount > 0
                ? BigDecimal.valueOf(totalQuantity).divide(BigDecimal.valueOf(activeRetailerCount), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        long completedOrders = timeFiltered.stream()
                .filter(o -> o.getStatus() != null && o.getStatus() == 4)
                .count();
        BigDecimal fulfillmentRate = totalOrders > 0
                ? BigDecimal.valueOf(completedOrders).divide(BigDecimal.valueOf(totalOrders), 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                : BigDecimal.ZERO;

        long quotaExceededCount = quotaExceedRecordMapper.selectCount(new LambdaQueryWrapper<QuotaExceedRecord>()
                        .eq(countyId != null, QuotaExceedRecord::getCountyId, countyId))
                .intValue();

        DateTimeFormatter monthFormatter = DateTimeFormatter.ofPattern("yyyy-MM");
        Map<String, Long> trendByMonth = timeFiltered.stream()
                .filter(o -> o.getCreateTime() != null)
                .collect(Collectors.groupingBy(
                        o -> o.getCreateTime().format(monthFormatter),
                        Collectors.counting()
                ));

        Map<String, Long> byCounty = timeFiltered.stream()
                .filter(o -> o.getRetailerId() != null)
                .map(o -> {
                    Retailer r = retailerMapper.selectById(o.getRetailerId());
                    return r != null ? r.getCounty() : null;
                })
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(c -> c, Collectors.counting()));

        List<OrderItem> orderItems = new ArrayList<>();
        for (Order order : timeFiltered) {
            orderItems.addAll(orderItemMapper.selectByOrderId(order.getId()));
        }
        Map<String, Long> byBrand = orderItems.stream()
                .filter(i -> i.getBrand() != null)
                .collect(Collectors.groupingBy(OrderItem::getBrand,
                        Collectors.summingLong(i -> i.getQuantity() != null ? i.getQuantity() : 0L)));

        Map<Integer, Long> byTier = timeFiltered.stream()
                .filter(o -> o.getRetailerId() != null)
                .map(o -> {
                    Retailer r = retailerMapper.selectById(o.getRetailerId());
                    return r != null ? r.getTier() : null;
                })
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(t -> t, Collectors.counting()));

        return OrderStatistics.builder()
                .totalOrders(totalOrders)
                .totalQuantity(totalQuantity)
                .totalAmount(totalAmount)
                .avgQuantityPerRetailer(avgQuantityPerRetailer)
                .fulfillmentRate(fulfillmentRate)
                .quotaExceededCount(quotaExceededCount)
                .trendByPeriod(trendByMonth)
                .byCounty(byCounty)
                .byBrand(byBrand)
                .byTier(byTier)
                .build();
    }

    public InspectionStatistics getInspectionStatistics(String timeDimension, String startTime, String endTime, Long countyId) {
        LocalDateTime start = parseStartTime(timeDimension, startTime);
        LocalDateTime end = parseEndTime(timeDimension, endTime);

        List<InspectionTask> allTasks = inspectionTaskMapper.selectList(
                new LambdaQueryWrapper<InspectionTask>()
                        .eq(countyId != null, InspectionTask::getCountyId, countyId));

        List<InspectionTask> timeFilteredTasks = allTasks.stream()
                .filter(t -> t.getCreateTime() != null
                        && !t.getCreateTime().isBefore(start)
                        && !t.getCreateTime().isAfter(end))
                .collect(Collectors.toList());

        List<ViolationRecord> allViolations = violationRecordMapper.selectList(
                new LambdaQueryWrapper<ViolationRecord>()
                        .eq(countyId != null, ViolationRecord::getCountyId, countyId));

        List<ViolationRecord> timeFilteredViolations = allViolations.stream()
                .filter(v -> v.getCreateTime() != null
                        && !v.getCreateTime().isBefore(start)
                        && !v.getCreateTime().isAfter(end))
                .collect(Collectors.toList());

        long totalTasks = timeFilteredTasks.size();
        long completedTasks = timeFilteredTasks.stream()
                .filter(t -> t.getStatus() != null && t.getStatus() == 3)
                .count();
        long totalViolations = timeFilteredViolations.size();

        BigDecimal violationRate = totalTasks > 0
                ? BigDecimal.valueOf(totalViolations).divide(BigDecimal.valueOf(totalTasks), 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                : BigDecimal.ZERO;

        Map<String, Long> byViolationType = timeFilteredViolations.stream()
                .filter(v -> v.getViolationTypeName() != null)
                .collect(Collectors.groupingBy(ViolationRecord::getViolationTypeName, Collectors.counting()));

        Map<String, Long> bySeverity = timeFilteredViolations.stream()
                .filter(v -> v.getSeverity() != null)
                .collect(Collectors.groupingBy(ViolationRecord::getSeverity, Collectors.counting()));

        Map<String, Long> byCounty = timeFilteredViolations.stream()
                .filter(v -> v.getRetailerId() != null)
                .map(v -> {
                    Retailer r = retailerMapper.selectById(v.getRetailerId());
                    return r != null ? r.getCounty() : null;
                })
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(c -> c, Collectors.counting()));

        Map<String, Long> byInspector = timeFilteredTasks.stream()
                .filter(t -> t.getInspectorName() != null)
                .collect(Collectors.groupingBy(InspectionTask::getInspectorName, Collectors.counting()));

        DateTimeFormatter monthFormatter = DateTimeFormatter.ofPattern("yyyy-MM");
        Map<String, Long> trendByMonth = timeFilteredViolations.stream()
                .filter(v -> v.getCreateTime() != null)
                .collect(Collectors.groupingBy(
                        v -> v.getCreateTime().format(monthFormatter),
                        Collectors.counting()
                ));

        return InspectionStatistics.builder()
                .totalTasks(totalTasks)
                .completedTasks(completedTasks)
                .totalViolations(totalViolations)
                .violationRate(violationRate)
                .byViolationType(byViolationType)
                .bySeverity(bySeverity)
                .byCounty(byCounty)
                .byInspector(byInspector)
                .trendByMonth(trendByMonth)
                .build();
    }

    public DeliveryStatistics getDeliveryStatistics(String timeDimension, String startTime, String endTime, Long countyId) {
        LocalDateTime start = parseStartTime(timeDimension, startTime);
        LocalDateTime end = parseEndTime(timeDimension, endTime);

        List<DeliveryPlan> allPlans = deliveryPlanMapper.selectList(
                new LambdaQueryWrapper<DeliveryPlan>()
                        .eq(countyId != null, DeliveryPlan::getCountyId, countyId));

        List<DeliveryPlan> timeFilteredPlans = allPlans.stream()
                .filter(p -> p.getCreateTime() != null
                        && !p.getCreateTime().isBefore(start)
                        && !p.getCreateTime().isAfter(end))
                .collect(Collectors.toList());

        List<DeliveryRoute> routes = deliveryRouteMapper.selectList(null);

        long totalPlans = timeFilteredPlans.size();
        long totalOrders = timeFilteredPlans.stream()
                .mapToLong(p -> p.getTotalOrders() != null ? p.getTotalOrders() : 0)
                .sum();
        long totalQuantity = timeFilteredPlans.stream()
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

        Map<Integer, Long> byFleet = routes.stream()
                .filter(r -> r.getFleetId() != null)
                .collect(Collectors.groupingBy(r -> r.getFleetId().intValue(),
                        Collectors.summingLong(r -> r.getTotalLoad() != null ? r.getTotalLoad() : 0)));

        Map<String, Long> byCounty = new HashMap<>();
        for (DeliveryRoute route : routes) {
            if (route.getPlanId() != null) {
                DeliveryPlan plan = deliveryPlanMapper.selectById(route.getPlanId());
                if (plan != null && plan.getCountyId() != null) {
                    Retailer retailerSample = null;
                    List<Retailer> retailers = retailerMapper.selectList(
                            new LambdaQueryWrapper<Retailer>().eq(Retailer::getCountyId, plan.getCountyId()));
                    if (!retailers.isEmpty()) {
                        retailerSample = retailers.get(0);
                    }
                    if (retailerSample != null && retailerSample.getCounty() != null) {
                        byCounty.merge(retailerSample.getCounty(),
                                (long) (route.getTotalLoad() != null ? route.getTotalLoad() : 0),
                                Long::sum);
                    }
                }
            }
        }

        DateTimeFormatter periodFormatter = DateTimeFormatter.ofPattern("yyyy-MM");
        Map<String, Long> trendByPeriod = timeFilteredPlans.stream()
                .filter(p -> p.getCreateTime() != null)
                .collect(Collectors.groupingBy(
                        p -> p.getCreateTime().format(periodFormatter),
                        Collectors.summingLong(p -> p.getTotalQuantity() != null ? p.getTotalQuantity() : 0L)
                ));

        BigDecimal avgCalcTime = timeFilteredPlans.isEmpty() ? BigDecimal.ZERO :
                timeFilteredPlans.stream()
                        .map(p -> p.getCalcTime() != null ? p.getCalcTime() : BigDecimal.ZERO)
                        .reduce(BigDecimal.ZERO, BigDecimal::add)
                        .divide(BigDecimal.valueOf(timeFilteredPlans.size()), 3, RoundingMode.HALF_UP);

        return DeliveryStatistics.builder()
                .totalPlans(totalPlans)
                .totalOrders(totalOrders)
                .totalQuantity(totalQuantity)
                .avgLoadRate(avgLoadRate)
                .emptyLoadRate(emptyLoadRate)
                .avgDistance(avgDistance)
                .byFleet(byFleet)
                .byCounty(byCounty)
                .trendByPeriod(trendByPeriod)
                .avgCalcTime(avgCalcTime)
                .build();
    }

    public CreditStatistics getCreditStatistics(String timeDimension, String startTime, String endTime, Long countyId) {
        LocalDateTime start = parseStartTime(timeDimension, startTime);
        LocalDateTime end = parseEndTime(timeDimension, endTime);

        List<Retailer> retailers = retailerMapper.selectList(
                new LambdaQueryWrapper<Retailer>()
                        .eq(countyId != null, Retailer::getCountyId, countyId));

        List<CreditRecord> allRecords = creditRecordMapper.selectList(
                new LambdaQueryWrapper<CreditRecord>()
                        .eq(countyId != null, CreditRecord::getCountyId, countyId));

        List<CreditRecord> timeFilteredRecords = allRecords.stream()
                .filter(r -> r.getCreateTime() != null
                        && !r.getCreateTime().isBefore(start)
                        && !r.getCreateTime().isAfter(end))
                .collect(Collectors.toList());

        long totalRetailers = retailers.size();

        BigDecimal avgScore = retailers.isEmpty() ? BigDecimal.ZERO :
                BigDecimal.valueOf(retailers.stream()
                        .mapToInt(r -> r.getCreditScore() != null ? r.getCreditScore() : 0)
                        .average()
                        .orElse(0.0)).setScale(2, RoundingMode.HALF_UP);

        Map<String, Long> byLevel = retailers.stream()
                .filter(r -> r.getCreditLevel() != null)
                .collect(Collectors.groupingBy(Retailer::getCreditLevel, Collectors.counting()));

        Map<String, BigDecimal> avgScoreByCounty = retailers.stream()
                .filter(r -> r.getCounty() != null && r.getCreditScore() != null)
                .collect(Collectors.groupingBy(
                        Retailer::getCounty,
                        Collectors.collectingAndThen(
                                Collectors.averagingInt(Retailer::getCreditScore),
                                avg -> BigDecimal.valueOf(avg).setScale(2, RoundingMode.HALF_UP)
                        )
                ));

        long totalChanges = timeFilteredRecords.size();
        long deductCount = timeFilteredRecords.stream()
                .filter(r -> "DEDUCT".equals(r.getChangeType()))
                .count();
        long bonusCount = timeFilteredRecords.stream()
                .filter(r -> "BONUS".equals(r.getChangeType()))
                .count();
        long repairCount = timeFilteredRecords.stream()
                .filter(r -> "REPAIR".equals(r.getChangeType()))
                .count();

        long downgradeCount = timeFilteredRecords.stream()
                .filter(r -> r.getBeforeLevel() != null && r.getAfterLevel() != null)
                .filter(r -> {
                    CreditLevel before = CreditLevel.getByCode(r.getBeforeLevel());
                    CreditLevel after = CreditLevel.getByCode(r.getAfterLevel());
                    return before != null && after != null && before.getRank() > after.getRank();
                })
                .count();

        long upgradeCount = timeFilteredRecords.stream()
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
                .avgScoreByCounty(avgScoreByCounty)
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
