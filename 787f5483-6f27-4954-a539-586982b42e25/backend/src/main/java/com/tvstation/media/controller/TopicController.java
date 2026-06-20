package com.tvstation.media.controller;

import com.tvstation.media.common.ApiResponse;
import com.tvstation.media.common.PageResult;
import com.tvstation.media.entity.Task;
import com.tvstation.media.entity.Topic;
import com.tvstation.media.entity.TopicLog;
import com.tvstation.media.service.WorkflowService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/topics")
@RequiredArgsConstructor
@Tag(name = "选题管理", description = "选题策划相关接口")
public class TopicController {

    private final WorkflowService workflowService;

    @GetMapping
    @Operation(summary = "获取选题列表")
    public ApiResponse<PageResult<Topic>> getTopics(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) Topic.TopicStatus status,
            @RequestParam(required = false) Topic.ProgramType programType,
            @RequestParam(required = false) Topic.Channel channel,
            @RequestParam(required = false) String keyword) {

        Pageable pageable = PageRequest.of(page - 1, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        PageResult<Topic> result = workflowService.getTopics(status, programType, channel, keyword, pageable);
        return ApiResponse.success(result, result.getTotal());
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取选题详情")
    public ApiResponse<Topic> getTopicDetail(@PathVariable Long id) {
        return ApiResponse.success(workflowService.getTopicById(id));
    }

    @PostMapping
    @Operation(summary = "创建选题")
    public ApiResponse<Topic> createTopic(@RequestBody Topic topic,
                                             @RequestHeader("userId") Long userId,
                                             @RequestHeader("userName") String userName) {
        Topic created = workflowService.createTopic(topic, userId, userName);
        return ApiResponse.success("选题创建成功", created);
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新选题")
    public ApiResponse<Topic> updateTopic(@PathVariable Long id,
                                             @RequestBody Topic topic,
                                             @RequestHeader("userId") Long userId) {
        Topic updated = workflowService.updateTopic(id, topic, userId);
        return ApiResponse.success("选题更新成功", updated);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除选题")
    public ApiResponse<Void> deleteTopic(@PathVariable Long id,
                                           @RequestHeader("userId") Long userId) {
        workflowService.deleteTopic(id, userId);
        return ApiResponse.success("选题删除成功", null);
    }

    @PostMapping("/{id}/submit")
    @Operation(summary = "提交审核")
    public ApiResponse<Topic> submitTopic(@PathVariable Long id,
                                     @RequestHeader("userId") Long userId,
                                     @RequestHeader("userName") String userName) {
        Topic topic = workflowService.submitTopic(id, userId, userName);
        return ApiResponse.success("提交成功", topic);
    }

    @PostMapping("/{id}/review")
    @Operation(summary = "审核选题")
    public ApiResponse<Topic> reviewTopic(@PathVariable Long id,
                                             @RequestBody Map<String, String> reviewData,
                                             @RequestHeader("userId") Long userId,
                                             @RequestHeader("userName") String userName) {
        String status = reviewData.get("status");
        String remark = reviewData.get("remark");
        Topic topic = workflowService.reviewTopic(id, status, remark, userId, userName);
        return ApiResponse.success("审核完成", topic);
    }

    @GetMapping("/{id}/logs")
    @Operation(summary = "获取选题日志")
    public ApiResponse<List<TopicLog>> getTopicLogs(@PathVariable Long id) {
        return ApiResponse.success(workflowService.getTopicLogs(id));
    }

    @GetMapping("/{id}/tasks")
    @Operation(summary = "获取选题任务")
    public ApiResponse<List<Task>> getTopicTasks(@PathVariable Long id) {
        return ApiResponse.success(workflowService.getTopicTasks(id));
    }

    @PutMapping("/tasks/{taskId}/status")
    @Operation(summary = "更新任务状态")
    public ApiResponse<Task> updateTaskStatus(@PathVariable Long taskId,
                                           @RequestBody Map<String, String> data,
                                           @RequestHeader("userId") Long userId) {
        Task.TaskStatus status = Task.TaskStatus.valueOf(data.get("status"));
        Task task = workflowService.updateTaskStatus(taskId, status, userId);
        return ApiResponse.success("状态更新成功", task);
    }

    @PutMapping("/tasks/{taskId}/assign")
    @Operation(summary = "分配任务")
    public ApiResponse<Task> assignTask(@PathVariable Long taskId,
                                     @RequestBody Map<String, Long> data,
                                     @RequestHeader("userName") String userName,
                                     @RequestHeader("userId") Long userId) {
        Long assigneeId = data.get("assigneeId");
        Task task = workflowService.assignTask(taskId, assigneeId, "用户", userId);
        return ApiResponse.success("任务分配成功", task);
    }

    @GetMapping("/statistics")
    @Operation(summary = "获取选题统计")
    public ApiResponse<Map<String, Object>> getTopicStatistics() {
        return ApiResponse.success(workflowService.getTopicStatistics());
    }
}
