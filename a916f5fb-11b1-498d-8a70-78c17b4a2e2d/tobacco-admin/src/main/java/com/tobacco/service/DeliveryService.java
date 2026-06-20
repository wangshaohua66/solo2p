package com.tobacco.service;

import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.tobacco.common.exception.BusinessException;
import com.tobacco.common.result.PageResult;
import com.tobacco.common.result.ResultCode;
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
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DeliveryService {

    private final DeliveryPlanMapper deliveryPlanMapper;
    private final DeliveryRouteMapper deliveryRouteMapper;
    private final DeliveryDetailMapper deliveryDetailMapper;
    private final OrderMapper orderMapper;
    private final RetailerMapper retailerMapper;

    @Value("${delivery.vehicle.max-load}")
    private Integer maxLoad;

    @Value("${delivery.vehicle.fleet-count}")
    private Integer fleetCount;

    @Value("${delivery.vehicle.count}")
    private Integer totalVehicleCount;

    @Value("${delivery.time-window.start}")
    private String timeWindowStart;

    @Value("${delivery.time-window.end}")
    private String timeWindowEnd;

    private static final BigDecimal DISTRIBUTION_CENTER_LNG = new BigDecimal("117.000000");
    private static final BigDecimal DISTRIBUTION_CENTER_LAT = new BigDecimal("36.600000");
    private static final double AVG_SPEED_KMH = 40.0;
    private static final double DELIVERY_TIME_PER_STOP_MIN = 15.0;

    private LocalTime parseTime(String timeStr) {
        return LocalTime.parse(timeStr, DateTimeFormatter.ofPattern("HH:mm"));
    }

    private double getTimeWindowHours() {
        LocalTime start = parseTime(timeWindowStart);
        LocalTime end = parseTime(timeWindowEnd);
        return java.time.Duration.between(start, end).toMinutes() / 60.0;
    }

    @Transactional(rollbackFor = Exception.class)
    public DeliveryPlan generateDeliveryPlan(String orderPeriod) {
        long startTime = System.currentTimeMillis();

        List<Order> orders = orderMapper.selectForDelivery(orderPeriod, 1, 0);
        if (orders.isEmpty()) {
            throw new BusinessException("当前周期无待配送订单");
        }

        List<DeliveryPoint> deliveryPoints = buildDeliveryPoints(orders);

        String planNo = generatePlanNo();
        DeliveryPlan plan = new DeliveryPlan();
        plan.setPlanNo(planNo);
        plan.setDeliveryDate(LocalDateTime.of(LocalDate.now().plusDays(1), LocalTime.of(8, 0)));
        plan.setOrderPeriod(orderPeriod);
        plan.setTotalOrders(orders.size());
        plan.setTotalQuantity(deliveryPoints.stream().mapToInt(DeliveryPoint::getQuantity).sum());
        plan.setStatus(1);
        plan.setFleetCount(fleetCount);
        deliveryPlanMapper.insert(plan);

        List<List<DeliveryPoint>> fleetClusters = clusterByFleet(deliveryPoints, fleetCount);

        int vehicleIndex = 0;
        int totalVehiclesUsed = 0;
        double timeWindowHours = getTimeWindowHours();

        for (int fleetId = 0; fleetId < fleetClusters.size(); fleetId++) {
            List<DeliveryPoint> fleetPoints = fleetClusters.get(fleetId);
            if (fleetPoints.isEmpty()) continue;

            List<List<DeliveryPoint>> vehicleRoutes = assignToVehicles(fleetPoints);

            for (List<DeliveryPoint> routePoints : vehicleRoutes) {
                if (routePoints.isEmpty()) continue;

                List<List<DeliveryPoint>> splitRoutes = splitRouteByTimeWindow(routePoints, timeWindowHours);

                for (List<DeliveryPoint> splitPoints : splitRoutes) {
                    if (splitPoints.isEmpty()) continue;

                    vehicleIndex++;
                    totalVehiclesUsed++;
                    String routeNo = generateRouteNo();

                    GreedyResult greedyResult = greedyOptimizeRoute(splitPoints);

                    DeliveryRoute route = new DeliveryRoute();
                    route.setPlanId(plan.getId());
                    route.setRouteNo(routeNo);
                    route.setFleetId((long) (fleetId + 1));
                    route.setVehicleNo("V" + String.format("%03d", vehicleIndex));
                    route.setDriverName("司机" + vehicleIndex);
                    route.setDeliveryCount(greedyResult.points.size());
                    route.setTotalLoad(greedyResult.totalLoad);
                    route.setLoadRate(BigDecimal.valueOf(greedyResult.totalLoad)
                            .divide(BigDecimal.valueOf(maxLoad), 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100)));
                    route.setEstimatedDistance(BigDecimal.valueOf(greedyResult.totalDistance).setScale(2, RoundingMode.HALF_UP));
                    route.setEstimatedDuration(BigDecimal.valueOf(greedyResult.totalDuration).setScale(2, RoundingMode.HALF_UP));
                    route.setStartPoint("配送中心");
                    route.setEndPoint("配送中心");
                    route.setDeliverySequence(buildSequenceJson(greedyResult.points));
                    route.setStatus(0);
                    deliveryRouteMapper.insert(route);

                    int seq = 1;
                    LocalDateTime currentTime = LocalDateTime.of(LocalDate.now().plusDays(1), parseTime(timeWindowStart));
                    for (DeliveryPoint point : greedyResult.points) {
                        DeliveryDetail detail = new DeliveryDetail();
                        detail.setRouteId(route.getId());
                        detail.setPlanId(plan.getId());
                        detail.setOrderId(point.getOrderId());
                        detail.setOrderNo(point.getOrderNo());
                        detail.setRetailerId(point.getRetailerId());
                        detail.setRetailerName(point.getRetailerName());
                        detail.setAddress(point.getAddress());
                        detail.setLongitude(point.getLongitude());
                        detail.setLatitude(point.getLatitude());
                        detail.setQuantity(point.getQuantity());
                        detail.setSequenceNumber(seq++);
                        detail.setEstimatedArrivalTime(currentTime);
                        detail.setStatus(0);
                        deliveryDetailMapper.insert(detail);

                        currentTime = currentTime.plusMinutes((long) DELIVERY_TIME_PER_STOP_MIN);
                    }
                }
            }
        }

        long endTime = System.currentTimeMillis();
        double calcTimeSeconds = (endTime - startTime) / 1000.0;

        plan.setVehicleCount(totalVehiclesUsed);
        plan.setCalcTime(BigDecimal.valueOf(calcTimeSeconds).setScale(3, RoundingMode.HALF_UP));
        plan.setStatus(1);
        deliveryPlanMapper.updateById(plan);

        for (Order order : orders) {
            order.setDeliveryStatus(1);
            orderMapper.updateById(order);
        }

        log.info("配送计划生成完成，计划号：{}，订单数：{}，总件数：{}，车辆数：{}，计算耗时：{}秒",
                planNo, orders.size(), plan.getTotalQuantity(), totalVehiclesUsed, calcTimeSeconds);

        return plan;
    }

    private List<List<DeliveryPoint>> splitRouteByTimeWindow(List<DeliveryPoint> points, double timeWindowHours) {
        List<List<DeliveryPoint>> result = new ArrayList<>();
        if (points.isEmpty()) {
            return result;
        }

        List<DeliveryPoint> remaining = new ArrayList<>(points);
        while (!remaining.isEmpty()) {
            List<DeliveryPoint> currentRoute = new ArrayList<>();
            double currentDuration = 0.0;
            BigDecimal currentLng = DISTRIBUTION_CENTER_LNG;
            BigDecimal currentLat = DISTRIBUTION_CENTER_LAT;
            int currentLoad = 0;

            Iterator<DeliveryPoint> it = remaining.iterator();
            while (it.hasNext()) {
                DeliveryPoint point = it.next();

                double distanceToNext = calculateDistance(currentLng, currentLat,
                        point.getLongitude(), point.getLatitude());
                double travelTimeHours = distanceToNext / AVG_SPEED_KMH;
                double stopTimeHours = DELIVERY_TIME_PER_STOP_MIN / 60.0;
                double addedHours = travelTimeHours + stopTimeHours;

                double returnDistance = calculateDistance(point.getLongitude(), point.getLatitude(),
                        DISTRIBUTION_CENTER_LNG, DISTRIBUTION_CENTER_LAT);
                double returnTimeHours = returnDistance / AVG_SPEED_KMH;
                double totalIfAdded = currentDuration + addedHours + returnTimeHours;

                if (totalIfAdded <= timeWindowHours && currentLoad + point.getQuantity() <= maxLoad) {
                    currentRoute.add(point);
                    currentDuration += addedHours;
                    currentLoad += point.getQuantity();
                    currentLng = point.getLongitude();
                    currentLat = point.getLatitude();
                    it.remove();
                } else if (currentRoute.isEmpty()) {
                    currentRoute.add(point);
                    it.remove();
                    break;
                } else {
                    break;
                }
            }

            if (!currentRoute.isEmpty()) {
                result.add(currentRoute);
            } else {
                break;
            }
        }

        if (!remaining.isEmpty()) {
            log.warn("部分配送点超出时间窗，已拆分为额外路线，剩余点数：{}", remaining.size());
            result.add(remaining);
        }

        return result;
    }

    private List<DeliveryPoint> buildDeliveryPoints(List<Order> orders) {
        List<DeliveryPoint> points = new ArrayList<>();
        for (Order order : orders) {
            Retailer retailer = retailerMapper.selectById(order.getRetailerId());
            if (retailer != null) {
                DeliveryPoint point = new DeliveryPoint();
                point.setOrderId(order.getId());
                point.setOrderNo(order.getOrderNo());
                point.setRetailerId(order.getRetailerId());
                point.setRetailerName(order.getRetailerName());
                point.setAddress(retailer.getAddress());
                point.setLongitude(retailer.getLongitude() != null ? retailer.getLongitude() : BigDecimal.ZERO);
                point.setLatitude(retailer.getLatitude() != null ? retailer.getLatitude() : BigDecimal.ZERO);
                point.setQuantity(order.getTotalQuantity() != null ? order.getTotalQuantity() : 0);
                point.setCountyId(retailer.getCountyId());
                points.add(point);
            }
        }
        return points;
    }

    private List<List<DeliveryPoint>> clusterByFleet(List<DeliveryPoint> points, int numFleets) {
        List<List<DeliveryPoint>> clusters = new ArrayList<>();
        for (int i = 0; i < numFleets; i++) {
            clusters.add(new ArrayList<>());
        }

        List<DeliveryPoint> sortedPoints = points.stream()
                .sorted(Comparator.comparing(p -> p.getLongitude().add(p.getLatitude())))
                .collect(Collectors.toList());

        int batchSize = (int) Math.ceil((double) sortedPoints.size() / numFleets);
        for (int i = 0; i < sortedPoints.size(); i++) {
            int fleetIndex = Math.min(i / batchSize, numFleets - 1);
            clusters.get(fleetIndex).add(sortedPoints.get(i));
        }

        return clusters;
    }

    private List<List<DeliveryPoint>> assignToVehicles(List<DeliveryPoint> points) {
        List<List<DeliveryPoint>> routes = new ArrayList<>();
        List<DeliveryPoint> remaining = new ArrayList<>(points);

        remaining.sort((a, b) -> Integer.compare(b.getQuantity(), a.getQuantity()));

        while (!remaining.isEmpty()) {
            List<DeliveryPoint> currentRoute = new ArrayList<>();
            int currentLoad = 0;
            Iterator<DeliveryPoint> it = remaining.iterator();

            while (it.hasNext()) {
                DeliveryPoint point = it.next();
                if (currentLoad + point.getQuantity() <= maxLoad) {
                    currentRoute.add(point);
                    currentLoad += point.getQuantity();
                    it.remove();
                }
            }

            if (currentRoute.isEmpty() && !remaining.isEmpty()) {
                DeliveryPoint largest = remaining.remove(0);
                currentRoute.add(largest);
            }

            routes.add(currentRoute);
        }

        return routes;
    }

    private GreedyResult greedyOptimizeRoute(List<DeliveryPoint> points) {
        if (points.isEmpty()) {
            return new GreedyResult(new ArrayList<>(), 0, 0.0, 0.0);
        }

        List<DeliveryPoint> result = new ArrayList<>();
        Set<Long> visited = new HashSet<>();
        double totalDistance = 0.0;
        int totalLoad = 0;

        BigDecimal currentLng = DISTRIBUTION_CENTER_LNG;
        BigDecimal currentLat = DISTRIBUTION_CENTER_LAT;

        while (visited.size() < points.size()) {
            DeliveryPoint nearest = null;
            double minDistance = Double.MAX_VALUE;

            for (DeliveryPoint point : points) {
                if (visited.contains(point.getOrderId())) continue;

                double distance = calculateDistance(currentLng, currentLat,
                        point.getLongitude(), point.getLatitude());
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = point;
                }
            }

            if (nearest == null) break;

            result.add(nearest);
            visited.add(nearest.getOrderId());
            totalDistance += minDistance;
            totalLoad += nearest.getQuantity();
            currentLng = nearest.getLongitude();
            currentLat = nearest.getLatitude();
        }

        double returnDistance = calculateDistance(currentLng, currentLat,
                DISTRIBUTION_CENTER_LNG, DISTRIBUTION_CENTER_LAT);
        totalDistance += returnDistance;

        double totalDurationHours = totalDistance / AVG_SPEED_KMH +
                (result.size() * DELIVERY_TIME_PER_STOP_MIN) / 60.0;

        return new GreedyResult(result, totalLoad, totalDistance, totalDurationHours);
    }

    private double calculateDistance(BigDecimal lng1, BigDecimal lat1, BigDecimal lng2, BigDecimal lat2) {
        double earthRadius = 6371.0;

        double dLat = Math.toRadians(lat2.subtract(lat1).doubleValue());
        double dLng = Math.toRadians(lng2.subtract(lng1).doubleValue());

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1.doubleValue())) *
                        Math.cos(Math.toRadians(lat2.doubleValue())) *
                        Math.sin(dLng / 2) * Math.sin(dLng / 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return earthRadius * c;
    }

    private String buildSequenceJson(List<DeliveryPoint> points) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < points.size(); i++) {
            if (i > 0) sb.append(",");
            DeliveryPoint p = points.get(i);
            sb.append(String.format("{\"seq\":%d,\"name\":\"%s\",\"lng\":%s,\"lat\":%s}",
                    i + 1, p.getRetailerName(), p.getLongitude(), p.getLatitude()));
        }
        sb.append("]");
        return sb.toString();
    }

    public DeliveryPlan getPlanById(Long id) {
        DeliveryPlan plan = deliveryPlanMapper.selectById(id);
        if (plan == null) {
            throw new BusinessException(ResultCode.DELIVERY_PLAN_NOT_FOUND);
        }
        return plan;
    }

    public DeliveryPlan getPlanByNo(String planNo) {
        DeliveryPlan plan = deliveryPlanMapper.selectByPlanNo(planNo);
        if (plan == null) {
            throw new BusinessException(ResultCode.DELIVERY_PLAN_NOT_FOUND);
        }
        return plan;
    }

    public List<DeliveryRoute> getRoutesByPlanId(Long planId) {
        return deliveryRouteMapper.selectByPlanId(planId);
    }

    public List<DeliveryDetail> getDetailsByRouteId(Long routeId) {
        return deliveryDetailMapper.selectByRouteId(routeId);
    }

    public List<DeliveryDetail> getDetailsByPlanId(Long planId) {
        return deliveryDetailMapper.selectByPlanId(planId);
    }

    public PageResult<DeliveryPlan> getPlanPage(Integer pageNum, Integer pageSize, Integer status,
                                                 String orderPeriod, Long countyId) {
        Page<DeliveryPlan> page = new Page<>(pageNum, pageSize);
        IPage<DeliveryPlan> result = deliveryPlanMapper.selectPageByCondition(
                page, status, orderPeriod, countyId);
        return PageResult.of(result.getTotal(), result.getPages(), result.getRecords());
    }

    private String generatePlanNo() {
        return "DP" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")) +
                IdUtil.getSnowflakeNextIdStr().substring(0, 6);
    }

    private String generateRouteNo() {
        return "DR" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")) +
                IdUtil.getSnowflakeNextIdStr().substring(0, 6);
    }

    private static class DeliveryPoint {
        private Long orderId;
        private String orderNo;
        private Long retailerId;
        private String retailerName;
        private String address;
        private BigDecimal longitude;
        private BigDecimal latitude;
        private Integer quantity;
        private Long countyId;

        public Long getOrderId() { return orderId; }
        public void setOrderId(Long orderId) { this.orderId = orderId; }
        public String getOrderNo() { return orderNo; }
        public void setOrderNo(String orderNo) { this.orderNo = orderNo; }
        public Long getRetailerId() { return retailerId; }
        public void setRetailerId(Long retailerId) { this.retailerId = retailerId; }
        public String getRetailerName() { return retailerName; }
        public void setRetailerName(String retailerName) { this.retailerName = retailerName; }
        public String getAddress() { return address; }
        public void setAddress(String address) { this.address = address; }
        public BigDecimal getLongitude() { return longitude; }
        public void setLongitude(BigDecimal longitude) { this.longitude = longitude; }
        public BigDecimal getLatitude() { return latitude; }
        public void setLatitude(BigDecimal latitude) { this.latitude = latitude; }
        public Integer getQuantity() { return quantity; }
        public void setQuantity(Integer quantity) { this.quantity = quantity; }
        public Long getCountyId() { return countyId; }
        public void setCountyId(Long countyId) { this.countyId = countyId; }
    }

    private static class GreedyResult {
        List<DeliveryPoint> points;
        int totalLoad;
        double totalDistance;
        double totalDuration;

        GreedyResult(List<DeliveryPoint> points, int totalLoad, double totalDistance, double totalDuration) {
            this.points = points;
            this.totalLoad = totalLoad;
            this.totalDistance = totalDistance;
            this.totalDuration = totalDuration;
        }
    }
}
