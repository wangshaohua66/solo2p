package com.heritage.controller;

import com.heritage.common.ApiResponse;
import com.heritage.entity.TrainingPlan;
import com.heritage.entity.TrainingRecord;
import com.heritage.service.TrainingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/training")
@Tag(name = "传承培养管理", description = "传承培养计划与培训记录管理API")
public class TrainingController {

    @Autowired
    private TrainingService trainingService;

    @GetMapping("/plans")
    @Operation(summary = "查询所有培养计划")
    public ApiResponse<Page<TrainingPlan>> getAllPlans(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return ApiResponse.success(trainingService.getAllPlans(pageable));
    }

    @GetMapping("/plans/inheritor/{inheritorId}")
    @Operation(summary = "查询传承人培养计划")
    public ApiResponse<Page<TrainingPlan>> getPlansByInheritor(
            @PathVariable String inheritorId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return ApiResponse.success(trainingService.getPlansByInheritor(inheritorId, pageable));
    }

    @GetMapping("/plans/year/{year}")
    @Operation(summary = "查询指定年份的培养计划")
    public ApiResponse<List<TrainingPlan>> getPlansByYear(@PathVariable String year) {
        return ApiResponse.success(trainingService.getPlansByYear(year));
    }

    @GetMapping("/plans/{id}")
    @Operation(summary = "获取培养计划详情")
    public ApiResponse<TrainingPlan> getPlanById(@PathVariable String id) {
        TrainingPlan plan = trainingService.getPlanById(id);
        if (plan == null) {
            return ApiResponse.error(404, "培养计划不存在");
        }
        return ApiResponse.success(plan);
    }

    @GetMapping("/plans/{id}/report")
    @Operation(summary = "生成培养进度报告")
    public ApiResponse<String> generateProgressReport(@PathVariable String id) {
        try {
            String report = trainingService.generateProgressReport(id);
            return ApiResponse.success(report);
        } catch (RuntimeException e) {
                return ApiResponse.error(400, e.getMessage());
        }
    }

    @PostMapping("/plans")
    @Operation(summary = "创建培养计划")
    public ApiResponse<TrainingPlan> createPlan(@RequestBody TrainingPlan plan) {
        TrainingPlan created = trainingService.createPlan(plan);
        return ApiResponse.success("创建成功", created);
    }

    @PutMapping("/plans/{id}")
    @Operation(summary = "更新培养计划")
    public ApiResponse<TrainingPlan> updatePlan(
            @PathVariable String id,
            @RequestBody TrainingPlan plan) {
        TrainingPlan updated = trainingService.updatePlan(id, plan);
        return ApiResponse.success("更新成功", updated);
    }

    @DeleteMapping("/plans/{id}")
    @Operation(summary = "删除培养计划")
    public ApiResponse<Void> deletePlan(@PathVariable String id) {
        trainingService.deletePlan(id);
        return ApiResponse.success("删除成功", null);
    }

    @PostMapping("/plans/{id}/records")
    @Operation(summary = "添加培训记录")
    public ApiResponse<TrainingPlan> addTrainingRecord(
            @PathVariable String id,
            @RequestBody TrainingRecord record) {
        TrainingPlan updated = trainingService.addTrainingRecord(id, record);
        return ApiResponse.success("添加成功", updated);
    }
}
