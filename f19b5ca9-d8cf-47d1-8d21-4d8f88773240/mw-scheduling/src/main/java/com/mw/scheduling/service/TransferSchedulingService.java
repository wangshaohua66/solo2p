package com.mw.scheduling.service;

import com.mw.common.audit.AuditAction;
import com.mw.common.audit.Auditable;
import com.mw.common.enums.VehicleStatus;
import com.mw.common.exception.BusinessException;
import com.mw.common.response.ResultCode;
import com.mw.scheduling.client.TrackingVehicleClient;
import com.mw.scheduling.document.DispatchOrder;
import com.mw.scheduling.document.StopNode;
import com.mw.scheduling.document.Vehicle;
import com.mw.scheduling.dto.PlanRequest;
import com.mw.scheduling.dto.PlanResultDTO;
import com.mw.scheduling.dto.PendingNodeDTO;
import com.mw.scheduling.dto.UrgentInsertRequest;
import com.mw.scheduling.dto.VehiclePositionDTO;
import com.mw.scheduling.repository.DispatchOrderRepository;
import com.mw.scheduling.repository.VehicleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

@Slf4j
@Service
@RequiredArgsConstructor
public class TransferSchedulingService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final double AVG_SPEED_KMH = 30.0;
    private static final double EARTH_RADIUS_KM = 6371.0;

    private final VehicleRepository vehicleRepository;
    private final DispatchOrderRepository dispatchOrderRepository;
    private final StringRedisTemplate redisTemplate;
    private final TrackingVehicleClient trackingVehicleClient;

    @Auditable(action = AuditAction.DISPATCH, module = "scheduling", description = "贪心算法生成日收运路线")
    public PlanResultDTO planDailyRoute(PlanRequest request) {
        List<Vehicle> vehicles = resolveVehicles(request.getVehicleIds());
        if (vehicles.isEmpty()) {
            throw new BusinessException(ResultCode.VEHICLE_NOT_AVAILABLE, "无可用运力");
        }
        refreshPositions(vehicles);

        List<PendingNodeDTO> pending = new ArrayList<>(request.getNodes());
        pending.sort(Comparator.comparingDouble(PendingNodeDTO::getWeightKg).reversed());

        Set<PendingNodeDTO> assigned = new LinkedHashSet<>();
        List<DispatchOrder> orders = new ArrayList<>();
        double totalDistance = 0;
        double trafficFactor = request.getTrafficFactor() == null ? 1.0 : request.getTrafficFactor();
        int avgStop = request.getAvgStopDurationMin() == null ? 15 : request.getAvgStopDurationMin();

        for (Vehicle vehicle : vehicles) {
            if (pending.isEmpty()) {
                break;
            }
            double capacity = vehicle.getCapacityKg() == null ? 1000 : vehicle.getCapacityKg();
            double load = 0;
            List<StopNode> route = new ArrayList<>();
            double curLat = vehicle.getLat() == null ? request.getDepotLat() : vehicle.getLat();
            double curLng = vehicle.getLng() == null ? request.getDepotLng() : vehicle.getLng();
            double routeDistance = 0;
            int seq = 1;

            while (!pending.isEmpty()) {
                PendingNodeDTO nearest = null;
                double nearestDist = Double.MAX_VALUE;
                for (PendingNodeDTO node : pending) {
                    if (load + node.getWeightKg() > capacity) {
                        continue;
                    }
                    double d = haversine(curLat, curLng, node.getLat(), node.getLng());
                    if (d < nearestDist) {
                        nearestDist = d;
                        nearest = node;
                    }
                }
                if (nearest == null) {
                    break;
                }
                routeDistance += nearestDist;
                load += nearest.getWeightKg();
                StopNode stop = new StopNode(nearest.getOrgId(), nearest.getOrgName(),
                        nearest.getWeightKg(), seq++, nearest.getLat(), nearest.getLng(), nearest.getAddress());
                route.add(stop);
                curLat = nearest.getLat();
                curLng = nearest.getLng();
                pending.remove(nearest);
                assigned.add(nearest);
            }

            if (route.isEmpty()) {
                continue;
            }
            double returnDist = request.getDepotLat() == null ? 0
                    : haversine(curLat, curLng, request.getDepotLat(), request.getDepotLng());
            routeDistance += returnDist;
            totalDistance += routeDistance;
            int durationMin = (int) Math.round((routeDistance / AVG_SPEED_KMH) * 60 * trafficFactor
                    + (long) route.size() * avgStop);

            DispatchOrder order = new DispatchOrder();
            order.setOrderNo(generateOrderNo());
            order.setManifestNo(route.get(0).getOrgId() + "+" + route.size());
            order.setVehicleId(vehicle.getId());
            order.setDriverName(vehicle.getDriverName());
            order.setPlannedRoute(route);
            order.setPlannedWeightKg(load);
            order.setStatus("PENDING");
            order.setPriority("NORMAL");
            order.setEstimatedDurationMin(durationMin);
            order.setTrafficFactor(trafficFactor);
            order.setDispatchTime(LocalDateTime.now());
            dispatchOrderRepository.save(order);

            vehicle.setStatus(VehicleStatus.ASSIGNED);
            vehicle.setCurrentLoadKg(load);
            vehicleRepository.save(vehicle);

            orders.add(order);
        }

        log.info("日收运路线规划完成: 车辆数={}, 已分配={}, 未分配={}", orders.size(), assigned.size(), pending.size());
        return PlanResultDTO.builder()
                .orders(orders)
                .assignedNodes(assigned.size())
                .unassignedNodes(pending.size())
                .totalDistanceKm(Math.round(totalDistance * 100) / 100.0)
                .build();
    }

    @Auditable(action = AuditAction.DISPATCH, module = "scheduling", description = "紧急插单")
    public DispatchOrder urgentInsert(UrgentInsertRequest request) {
        List<Vehicle> idleVehicles = vehicleRepository.findByStatus(VehicleStatus.IDLE);
        if (idleVehicles.isEmpty()) {
            idleVehicles = vehicleRepository.findAll();
        }
        if (idleVehicles.isEmpty()) {
            throw new BusinessException(ResultCode.VEHICLE_NOT_AVAILABLE, "无可用运力执行紧急调度");
        }
        Vehicle vehicle = idleVehicles.stream()
                .min(Comparator.comparingDouble(v -> haversine(
                        v.getLat() == null ? 0 : v.getLat(),
                        v.getLng() == null ? 0 : v.getLng(),
                        request.getLat() == null ? 0 : request.getLat(),
                        request.getLng() == null ? 0 : request.getLng())))
                .orElseThrow();

        StopNode stop = new StopNode(request.getOrgId(), request.getOrgName(),
                request.getWeightKg(), 1, request.getLat(), request.getLng(), request.getAddress());
        DispatchOrder order = new DispatchOrder();
        order.setOrderNo(generateOrderNo());
        order.setManifestNo(request.getManifestNo());
        order.setVehicleId(vehicle.getId());
        order.setDriverName(vehicle.getDriverName());
        order.setPlannedRoute(List.of(stop));
        order.setPlannedWeightKg(request.getWeightKg());
        order.setStatus("PENDING");
        order.setPriority("URGENT");
        order.setEstimatedDurationMin(30);
        order.setTrafficFactor(1.0);
        order.setDispatchTime(LocalDateTime.now());
        dispatchOrderRepository.save(order);

        vehicle.setStatus(VehicleStatus.ASSIGNED);
        vehicleRepository.save(vehicle);
        return order;
    }

    @Auditable(action = AuditAction.UPDATE, module = "scheduling", description = "人工调整路线")
    public DispatchOrder manualAdjust(String orderNo, List<StopNode> newRoute) {
        DispatchOrder order = dispatchOrderRepository.findByOrderNo(orderNo)
                .orElseThrow(() -> new BusinessException(ResultCode.NOT_FOUND, "派单不存在: " + orderNo));
        order.setPlannedRoute(newRoute);
        order.setPlannedWeightKg(newRoute.stream().map(StopNode::getPlannedWeightKg)
                .reduce(0.0, Double::sum));
        return dispatchOrderRepository.save(order);
    }

    @Auditable(action = AuditAction.CONFIRM, module = "scheduling", description = "司机确认收运")
    public DispatchOrder acceptOrder(String orderNo) {
        DispatchOrder order = dispatchOrderRepository.findByOrderNo(orderNo)
                .orElseThrow(() -> new BusinessException(ResultCode.NOT_FOUND, "派单不存在: " + orderNo));
        order.setStatus("IN_PROGRESS");
        order.setAcceptTime(LocalDateTime.now());
        return dispatchOrderRepository.save(order);
    }

    public List<DispatchOrder> listOrders(String vehicleId, String status, int page, int size) {
        return dispatchOrderRepository.findAll().stream()
                .filter(o -> vehicleId == null || vehicleId.isBlank() || vehicleId.equals(o.getVehicleId()))
                .filter(o -> status == null || status.isBlank() || status.equals(o.getStatus()))
                .skip((long) (page - 1) * size)
                .limit(size)
                .toList();
    }

    private List<Vehicle> resolveVehicles(List<String> vehicleIds) {
        if (vehicleIds != null && !vehicleIds.isEmpty()) {
            return vehicleRepository.findAllById(vehicleIds);
        }
        List<Vehicle> idle = vehicleRepository.findByStatus(VehicleStatus.IDLE);
        return idle.isEmpty() ? vehicleRepository.findAll() : idle;
    }

    private void refreshPositions(List<Vehicle> vehicles) {
        for (Vehicle vehicle : vehicles) {
            try {
                var resp = trackingVehicleClient.getPosition(vehicle.getId());
                if (resp != null && resp.isSuccess() && resp.getData() != null) {
                    VehiclePositionDTO pos = resp.getData();
                    vehicle.setLat(pos.getLat());
                    vehicle.setLng(pos.getLng());
                }
            } catch (Exception e) {
                log.debug("刷新车辆位置失败(忽略): vehicleId={}, msg={}", vehicle.getId(), e.getMessage());
            }
        }
    }

    private String generateOrderNo() {
        String date = LocalDate.now().format(DATE_FMT);
        String key = "order:seq:" + date;
        long seq;
        try {
            Long v = redisTemplate.opsForValue().increment(key);
            seq = v == null ? ThreadLocalRandom.current().nextInt(1, 999999) : v;
        } catch (Exception e) {
            seq = ThreadLocalRandom.current().nextInt(1, 999999);
        }
        return "DO-" + date + "-" + String.format("%06d", seq);
    }

    static double haversine(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
