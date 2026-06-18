package com.iccert.task.controller;

import com.iccert.common.result.R;
import com.iccert.task.entity.InspectionTask;
import com.iccert.task.entity.LabEquipment;
import com.iccert.task.entity.LabTechnician;
import com.iccert.task.mapper.LabEquipmentMapper;
import com.iccert.task.mapper.LabTechnicianMapper;
import com.iccert.task.service.TaskDispatchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Tag(name = "检测任务", description = "任务调度、设备预约、技术员分配、冲突预警")
@RestController
@RequestMapping
@RequiredArgsConstructor
public class TaskController {

    private final TaskDispatchService dispatchService;
    private final LabEquipmentMapper equipmentMapper;
    private final LabTechnicianMapper technicianMapper;

    @Operation(summary = "获取所有任务列表")
    @GetMapping("/list")
    public R<List<InspectionTask>> list() {
        return R.ok(dispatchService.listAll());
    }

    @Operation(summary = "创建检测任务")
    @PostMapping
    public R<InspectionTask> create(@RequestBody InspectionTask task) {
        return R.ok(dispatchService.createTask(task));
    }

    @Operation(summary = "系统自动批量调度所有待分配任务")
    @PostMapping("/dispatch/auto")
    public R<Map<String, Object>> autoDispatchAll() {
        return R.ok(dispatchService.autoDispatchAllPending());
    }

    @Operation(summary = "手动分配单个任务")
    @PostMapping("/dispatch/{taskId}")
    public R<InspectionTask> dispatchSingle(@PathVariable Long taskId) {
        InspectionTask task = dispatchService.listAll().stream()
                .filter(t -> t.getId().equals(taskId)).findFirst().orElse(null);
        if (task == null) return R.fail("任务不存在");
        return R.ok(dispatchService.dispatchSingleTask(task));
    }

    @Operation(summary = "设备预约冲突检测")
    @GetMapping("/equipment/conflict-check")
    public R<Boolean> checkConflict(@RequestParam Long equipmentId,
                                    @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
                                    @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime) {
        return R.ok(dispatchService.checkEquipmentBookingConflict(equipmentId, startTime, endTime));
    }

    @Operation(summary = "获取所有检测设备")
    @GetMapping("/equipment/list")
    public R<List<LabEquipment>> listEquipments() {
        return R.ok(equipmentMapper.selectList(null));
    }

    @Operation(summary = "获取所有技术人员")
    @GetMapping("/technician/list")
    public R<List<LabTechnician>> listTechnicians() {
        return R.ok(technicianMapper.selectList(null));
    }
}
