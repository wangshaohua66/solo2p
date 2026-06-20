package com.freshcommunity.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.freshcommunity.entity.*;
import com.freshcommunity.mapper.DeliveryDetailMapper;
import com.freshcommunity.mapper.DeliveryTaskMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

@Slf4j
@Service
public class DeliveryService extends ServiceImpl<DeliveryTaskMapper, DeliveryTask> {

    @Autowired
    private DeliveryDetailMapper deliveryDetailMapper;

    @Autowired
    private OrderService orderService;

    @Autowired
    private CommunityService communityService;

    @Transactional(rollbackFor = Exception.class)
    public DeliveryTask generateDeliveryTask(List<Long> orderIds, String vehicleNo, String driverName, String driverPhone) {
        DeliveryTask task = new DeliveryTask();
        task.setTaskNo(generateTaskNo());
        task.setDeliveryDate(LocalDate.now());
        task.setVehicleNo(vehicleNo);
        task.setDriverName(driverName);
        task.setDriverPhone(driverPhone);
        task.setStatus(0);

        List<Order> orders = new ArrayList<>();
        BigDecimal totalAmount = BigDecimal.ZERO;
        for (Long orderId : orderIds) {
            Order order = orderService.getById(orderId);
            if (order != null && order.getStatus() == 1 && order.getDeliveryStatus() == 0) {
                orders.add(order);
                totalAmount = totalAmount.add(order.getPayAmount());
            }
        }
        task.setTotalOrders(orders.size());
        task.setTotalAmount(totalAmount);
        save(task);

        int sortOrder = 1;
        for (Order order : orders) {
            DeliveryDetail detail = new DeliveryDetail();
            detail.setTaskId(task.getId());
            detail.setOrderId(order.getId());
            detail.setOrderNo(order.getOrderNo());
            detail.setCommunityId(order.getCommunityId());
            Community community = communityService.getById(order.getCommunityId());
            detail.setCommunityName(community != null ? community.getName() : "");
            detail.setSortOrder(sortOrder++);
            detail.setStatus(0);
            deliveryDetailMapper.insert(detail);

            order.setDeliveryTaskId(task.getId());
            order.setDeliveryStatus(1);
            order.setStatus(2);
            orderService.updateById(order);
        }

        return task;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean startDelivery(Long taskId) {
        DeliveryTask task = getById(taskId);
        if (task == null || task.getStatus() != 0) {
            return false;
        }
        task.setStatus(1);
        task.setStartTime(LocalDateTime.now());
        return updateById(task);
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean arriveCommunity(Long detailId) {
        DeliveryDetail detail = deliveryDetailMapper.selectById(detailId);
        if (detail == null || detail.getStatus() != 0) {
            return false;
        }
        detail.setStatus(1);
        detail.setArriveTime(LocalDateTime.now());
        deliveryDetailMapper.updateById(detail);

        orderService.updateDeliveryStatus(detail.getOrderId(), 2);
        return true;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean confirmReceipt(Long detailId) {
        DeliveryDetail detail = deliveryDetailMapper.selectById(detailId);
        if (detail == null || detail.getStatus() != 1) {
            return false;
        }
        detail.setStatus(2);
        detail.setConfirmTime(LocalDateTime.now());
        deliveryDetailMapper.updateById(detail);

        orderService.updateDeliveryStatus(detail.getOrderId(), 2);
        return true;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean completeDelivery(Long taskId) {
        DeliveryTask task = getById(taskId);
        if (task == null || task.getStatus() != 1) {
            return false;
        }
        task.setStatus(2);
        task.setEndTime(LocalDateTime.now());
        return updateById(task);
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean reportException(Long taskId, String remark) {
        DeliveryTask task = getById(taskId);
        if (task == null) {
            return false;
        }
        task.setStatus(3);
        task.setRemark(remark);
        return updateById(task);
    }

    public List<DeliveryDetail> getDeliveryDetails(Long taskId) {
        return deliveryDetailMapper.selectList(new LambdaQueryWrapper<DeliveryDetail>()
                .eq(DeliveryDetail::getTaskId, taskId)
                .orderByAsc(DeliveryDetail::getSortOrder));
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean updateDeliveryOrder(List<Long> detailIds) {
        for (int i = 0; i < detailIds.size(); i++) {
            DeliveryDetail detail = deliveryDetailMapper.selectById(detailIds.get(i));
            if (detail != null) {
                detail.setSortOrder(i + 1);
                deliveryDetailMapper.updateById(detail);
            }
        }
        return true;
    }

    public Page<DeliveryTask> getTaskPage(int pageNum, int pageSize, String taskNo, LocalDate deliveryDate, Integer status) {
        Page<DeliveryTask> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<DeliveryTask> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(taskNo)) {
            wrapper.like(DeliveryTask::getTaskNo, taskNo);
        }
        if (deliveryDate != null) {
            wrapper.eq(DeliveryTask::getDeliveryDate, deliveryDate);
        }
        if (status != null) {
            wrapper.eq(DeliveryTask::getStatus, status);
        }
        wrapper.orderByDesc(DeliveryTask::getCreateTime);
        return page(page, wrapper);
    }

    public Map<String, Object> getRouteMap(Long taskId) {
        DeliveryTask task = getById(taskId);
        List<DeliveryDetail> details = getDeliveryDetails(taskId);
        List<Map<String, Object>> points = new ArrayList<>();
        points.add(Map.of("name", "配送中心", "sortOrder", 0, "lng", 116.404, "lat", 39.915));
        for (DeliveryDetail detail : details) {
            Map<String, Object> point = new HashMap<>();
            point.put("name", detail.getCommunityName());
            point.put("sortOrder", detail.getSortOrder());
            point.put("lng", 116.404 + ThreadLocalRandom.current().nextDouble(-0.3, 0.3));
            point.put("lat", 39.915 + ThreadLocalRandom.current().nextDouble(-0.3, 0.3));
            point.put("status", detail.getStatus());
            points.add(point);
        }
        Map<String, Object> result = new HashMap<>();
        result.put("task", task);
        result.put("points", points);
        return result;
    }

    public List<DeliveryTask> getTodayTasks() {
        return list(new LambdaQueryWrapper<DeliveryTask>()
                .eq(DeliveryTask::getDeliveryDate, LocalDate.now())
                .orderByDesc(DeliveryTask::getCreateTime));
    }

    public Map<String, Object> getDeliveryStatistics() {
        List<DeliveryTask> allTasks = list();
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalTasks", allTasks.size());
        stats.put("completedTasks", allTasks.stream().filter(t -> t.getStatus() == 2).count());
        stats.put("inProgressTasks", allTasks.stream().filter(t -> t.getStatus() == 1).count());
        stats.put("pendingTasks", allTasks.stream().filter(t -> t.getStatus() == 0).count());
        stats.put("exceptionTasks", allTasks.stream().filter(t -> t.getStatus() == 3).count());

        long totalOrders = allTasks.stream().mapToInt(t -> t.getTotalOrders() == null ? 0 : t.getTotalOrders()).sum();
        long completedOrders = allTasks.stream()
                .filter(t -> t.getStatus() == 2)
                .mapToInt(t -> t.getTotalOrders() == null ? 0 : t.getTotalOrders())
                .sum();
        double onTimeRate = totalOrders > 0 ? (double) completedOrders / totalOrders * 100 : 0;
        stats.put("onTimeRate", Math.round(onTimeRate * 100.0) / 100.0);
        return stats;
    }

    private String generateTaskNo() {
        return "DLV" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
                + String.format("%04d", ThreadLocalRandom.current().nextInt(10000));
    }
}
