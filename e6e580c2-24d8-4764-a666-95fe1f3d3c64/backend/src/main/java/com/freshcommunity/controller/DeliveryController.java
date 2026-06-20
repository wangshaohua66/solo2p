package com.freshcommunity.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.freshcommunity.common.PageResult;
import com.freshcommunity.common.Result;
import com.freshcommunity.entity.DeliveryDetail;
import com.freshcommunity.entity.DeliveryTask;
import com.freshcommunity.service.DeliveryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/delivery")
public class DeliveryController {

    @Autowired
    private DeliveryService deliveryService;

    @GetMapping("/page")
    public Result<PageResult<DeliveryTask>> getTaskPage(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) String taskNo,
            @RequestParam(required = false) LocalDate deliveryDate,
            @RequestParam(required = false) Integer status) {
        Page<DeliveryTask> page = deliveryService.getTaskPage(pageNum, pageSize, taskNo, deliveryDate, status);
        return Result.success(PageResult.of(page.getTotal(), page.getRecords(), pageNum, pageSize));
    }

    @GetMapping("/today")
    public Result<List<DeliveryTask>> getTodayTasks() {
        List<DeliveryTask> list = deliveryService.getTodayTasks();
        return Result.success(list);
    }

    @GetMapping("/{id}")
    public Result<DeliveryTask> getTaskDetail(@PathVariable Long id) {
        DeliveryTask task = deliveryService.getById(id);
        return Result.success(task);
    }

    @GetMapping("/{id}/details")
    public Result<List<DeliveryDetail>> getDeliveryDetails(@PathVariable Long id) {
        List<DeliveryDetail> list = deliveryService.getDeliveryDetails(id);
        return Result.success(list);
    }

    @GetMapping("/{id}/route")
    public Result<Map<String, Object>> getRouteMap(@PathVariable Long id) {
        Map<String, Object> route = deliveryService.getRouteMap(id);
        return Result.success(route);
    }

    @GetMapping("/statistics")
    public Result<Map<String, Object>> getDeliveryStatistics() {
        Map<String, Object> stats = deliveryService.getDeliveryStatistics();
        return Result.success(stats);
    }

    @PostMapping("/generate")
    public Result<DeliveryTask> generateTask(@RequestBody Map<String, Object> params) {
        @SuppressWarnings("unchecked")
        List<Integer> orderIdsInt = (List<Integer>) params.get("orderIds");
        List<Long> orderIds = orderIdsInt.stream().map(Integer::longValue).collect(java.util.stream.Collectors.toList());
        String vehicleNo = (String) params.get("vehicleNo");
        String driverName = (String) params.get("driverName");
        String driverPhone = (String) params.get("driverPhone");
        DeliveryTask task = deliveryService.generateDeliveryTask(orderIds, vehicleNo, driverName, driverPhone);
        return Result.success("配送任务生成成功", task);
    }

    @PutMapping("/{id}/start")
    public Result<Void> startDelivery(@PathVariable Long id) {
        boolean success = deliveryService.startDelivery(id);
        return success ? Result.success("开始配送") : Result.error("操作失败");
    }

    @PutMapping("/detail/{detailId}/arrive")
    public Result<Void> arriveCommunity(@PathVariable Long detailId) {
        boolean success = deliveryService.arriveCommunity(detailId);
        return success ? Result.success("已到达小区") : Result.error("操作失败");
    }

    @PutMapping("/detail/{detailId}/confirm")
    public Result<Void> confirmReceipt(@PathVariable Long detailId) {
        boolean success = deliveryService.confirmReceipt(detailId);
        return success ? Result.success("确认收货成功") : Result.error("操作失败");
    }

    @PutMapping("/{id}/complete")
    public Result<Void> completeDelivery(@PathVariable Long id) {
        boolean success = deliveryService.completeDelivery(id);
        return success ? Result.success("配送完成") : Result.error("操作失败");
    }

    @PutMapping("/{id}/exception")
    public Result<Void> reportException(@PathVariable Long id, @RequestParam String remark) {
        boolean success = deliveryService.reportException(id, remark);
        return success ? Result.success("异常已上报") : Result.error("操作失败");
    }

    @PutMapping("/reorder")
    public Result<Void> updateDeliveryOrder(@RequestBody List<Long> detailIds) {
        boolean success = deliveryService.updateDeliveryOrder(detailIds);
        return success ? Result.success("顺序更新成功") : Result.error("更新失败");
    }
}
