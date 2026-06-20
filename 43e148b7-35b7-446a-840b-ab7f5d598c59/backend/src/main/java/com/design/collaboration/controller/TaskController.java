package com.design.collaboration.controller;

import com.design.collaboration.common.ApiResponse;
import com.design.collaboration.dto.TaskCreateRequest;
import com.design.collaboration.entity.DesignTask;
import com.design.collaboration.enums.ProfessionType;
import com.design.collaboration.enums.TaskStatus;
import com.design.collaboration.service.TaskService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/task")
@Tag(name = "任务管理", description = "任务增删改查、领取、进度更新")
public class TaskController {

    @Autowired
    private TaskService taskService;

    @GetMapping("/{id}")
    @Operation(summary = "根据ID获取任务")
    public ApiResponse<DesignTask> getById(@Parameter(description = "任务ID") @PathVariable Long id) {
        DesignTask task = taskService.findById(id);
        if (task == null) {
            return ApiResponse.error("任务不存在");
        }
        return ApiResponse.success(task);
    }

    @GetMapping("/list")
    @Operation(summary = "任务列表查询")
    public ApiResponse<List<DesignTask>> list(
            @Parameter(description = "项目ID") @RequestParam(required = false) Long projectId,
            @Parameter(description = "专业") @RequestParam(required = false) ProfessionType profession,
            @Parameter(description = "状态") @RequestParam(required = false) TaskStatus status,
            @Parameter(description = "负责人ID") @RequestParam(required = false) Long assigneeId) {
        return ApiResponse.success(taskService.findByConditions(projectId, profession, status, assigneeId));
    }

    @PostMapping
    @Operation(summary = "创建任务")
    public ApiResponse<DesignTask> create(@Valid @RequestBody TaskCreateRequest request, HttpServletRequest req) {
        Long userId = (Long) req.getAttribute("userId");
        return ApiResponse.success("创建成功", taskService.create(request, userId));
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新任务")
    public ApiResponse<DesignTask> update(@Parameter(description = "任务ID") @PathVariable Long id,
                                          @RequestBody TaskCreateRequest request) {
        return ApiResponse.success("更新成功", taskService.update(id, request));
    }

    @PostMapping("/{id}/claim")
    @Operation(summary = "领取任务")
    public ApiResponse<DesignTask> claim(@Parameter(description = "任务ID") @PathVariable Long id, HttpServletRequest req) {
        Long userId = (Long) req.getAttribute("userId");
        return ApiResponse.success("领取成功", taskService.claimTask(id, userId));
    }

    @PutMapping("/{id}/progress")
    @Operation(summary = "更新任务进度和状态")
    public ApiResponse<DesignTask> updateProgress(
            @Parameter(description = "任务ID") @PathVariable Long id,
            @Parameter(description = "进度百分比") @RequestParam Integer progress,
            @Parameter(description = "任务状态") @RequestParam(required = false) TaskStatus status) {
        return ApiResponse.success("更新成功", taskService.updateProgress(id, progress, status));
    }

    @PostMapping("/{id}/submit-review")
    @Operation(summary = "提交校审（状态改为待校审）")
    public ApiResponse<DesignTask> submitForReview(@Parameter(description = "任务ID") @PathVariable Long id) {
        return ApiResponse.success("提交成功", taskService.updateProgress(id, 95, TaskStatus.REVIEWING));
    }

    @PostMapping("/{id}/complete")
    @Operation(summary = "标记任务已完成")
    public ApiResponse<DesignTask> complete(@Parameter(description = "任务ID") @PathVariable Long id) {
        return ApiResponse.success("完成", taskService.updateProgress(id, 100, TaskStatus.COMPLETED));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除任务")
    public ApiResponse<Void> delete(@Parameter(description = "任务ID") @PathVariable Long id) {
        if (taskService.delete(id)) {
            return ApiResponse.success("删除成功", null);
        }
        return ApiResponse.error("删除失败");
    }
}
