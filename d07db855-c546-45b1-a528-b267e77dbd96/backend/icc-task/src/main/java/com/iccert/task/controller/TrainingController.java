package com.iccert.task.controller;

import com.iccert.common.result.R;
import com.iccert.task.entity.TechnicianTraining;
import com.iccert.task.service.TrainingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 技术员培训记录管理。
 * 网关路由：/api/task/training/** → 本控制器（StripPrefix=2）
 */
@Tag(name = "培训记录", description = "技术员培训记录管理")
@RestController
@RequestMapping("/training")
@RequiredArgsConstructor
public class TrainingController {

    private final TrainingService trainingService;

    @Operation(summary = "获取所有培训记录")
    @GetMapping("/list")
    public R<List<TechnicianTraining>> list() {
        return R.ok(trainingService.listAll());
    }

    @Operation(summary = "按技术员查询培训记录")
    @GetMapping("/technician/{technicianId}")
    public R<List<TechnicianTraining>> listByTechnician(@PathVariable Long technicianId) {
        return R.ok(trainingService.listByTechnician(technicianId));
    }

    @Operation(summary = "获取培训记录详情")
    @GetMapping("/{id}")
    public R<TechnicianTraining> getById(@PathVariable Long id) {
        return R.ok(trainingService.getById(id));
    }

    @Operation(summary = "新增培训记录")
    @PostMapping
    public R<TechnicianTraining> create(@RequestBody TechnicianTraining training) {
        return R.ok(trainingService.create(training));
    }

    @Operation(summary = "更新培训记录")
    @PutMapping
    public R<TechnicianTraining> update(@RequestBody TechnicianTraining training) {
        return R.ok(trainingService.update(training));
    }

    @Operation(summary = "删除培训记录")
    @DeleteMapping("/{id}")
    public R<Boolean> delete(@PathVariable Long id) {
        return R.ok(trainingService.delete(id));
    }
}
