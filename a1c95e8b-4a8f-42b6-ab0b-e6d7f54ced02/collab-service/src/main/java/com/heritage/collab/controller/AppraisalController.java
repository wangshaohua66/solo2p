package com.heritage.collab.controller;

import com.heritage.collab.common.Result;
import com.heritage.collab.entity.Annotation;
import com.heritage.collab.entity.AppraisalTask;
import com.heritage.collab.entity.Comment;
import com.heritage.collab.enums.AppraisalStatus;
import com.heritage.collab.service.AppraisalService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/collab")
@RequiredArgsConstructor
public class AppraisalController {

    private final AppraisalService appraisalService;

    @PostMapping("/tasks")
    public Result<AppraisalTask> createTask(@RequestBody AppraisalTask task) {
        return Result.success(appraisalService.createTask(task));
    }

    @PutMapping("/tasks/{id}")
    public Result<AppraisalTask> updateTask(@PathVariable String id, @RequestBody AppraisalTask task) {
        return Result.success(appraisalService.updateTask(id, task));
    }

    @DeleteMapping("/tasks/{id}")
    public Result<Void> deleteTask(@PathVariable String id) {
        appraisalService.deleteTask(id);
        return Result.success(null);
    }

    @GetMapping("/tasks/{id}")
    public Result<AppraisalTask> getTaskById(@PathVariable String id) {
        return Result.success(appraisalService.getTaskById(id));
    }

    @GetMapping("/tasks/artifact/{artifactId}")
    public Result<List<AppraisalTask>> getTasksByArtifact(@PathVariable String artifactId) {
        return Result.success(appraisalService.getTasksByArtifact(artifactId));
    }

    @GetMapping("/tasks/creator/{creatorId}")
    public Result<Page<AppraisalTask>> getTasksByCreator(
            @PathVariable String creatorId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return Result.success(appraisalService.getTasksByCreator(creatorId,
                PageRequest.of(page, size, Sort.by("createTime").descending())));
    }

    @GetMapping("/tasks/expert/{expertId}")
    public Result<Page<AppraisalTask>> getTasksByExpert(
            @PathVariable String expertId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return Result.success(appraisalService.getTasksByExpert(expertId,
                PageRequest.of(page, size, Sort.by("createTime").descending())));
    }

    @GetMapping("/tasks/status/{status}")
    public Result<Page<AppraisalTask>> getTasksByStatus(
            @PathVariable AppraisalStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return Result.success(appraisalService.getTasksByStatus(status,
                PageRequest.of(page, size, Sort.by("createTime").descending())));
    }

    @PostMapping("/tasks/{taskId}/invite")
    public Result<AppraisalTask> inviteExperts(@PathVariable String taskId, @RequestBody List<String> expertIds) {
        return Result.success(appraisalService.inviteExperts(taskId, expertIds));
    }

    @PostMapping("/tasks/{taskId}/opinion")
    public Result<AppraisalTask> submitOpinion(
            @PathVariable String taskId,
            @RequestParam String expertId,
            @RequestBody String opinion) {
        return Result.success(appraisalService.submitOpinion(taskId, expertId, opinion));
    }

    @PostMapping("/tasks/{taskId}/complete")
    public Result<AppraisalTask> completeTask(@PathVariable String taskId, @RequestBody String conclusion) {
        return Result.success(appraisalService.completeTask(taskId, conclusion));
    }

    @PostMapping("/tasks/{taskId}/cancel")
    public Result<AppraisalTask> cancelTask(@PathVariable String taskId) {
        return Result.success(appraisalService.cancelTask(taskId));
    }

    @PostMapping("/annotations")
    public Result<Annotation> addAnnotation(@RequestBody Annotation annotation) {
        return Result.success(appraisalService.addAnnotation(annotation));
    }

    @PutMapping("/annotations/{id}")
    public Result<Annotation> updateAnnotation(@PathVariable String id, @RequestBody Annotation annotation) {
        return Result.success(appraisalService.updateAnnotation(id, annotation));
    }

    @DeleteMapping("/annotations/{id}")
    public Result<Void> deleteAnnotation(@PathVariable String id) {
        appraisalService.deleteAnnotation(id);
        return Result.success(null);
    }

    @GetMapping("/annotations/appraisal/{appraisalId}")
    public Result<List<Annotation>> getAnnotationsByAppraisal(@PathVariable String appraisalId) {
        return Result.success(appraisalService.getAnnotationsByAppraisal(appraisalId));
    }

    @GetMapping("/annotations/image/{imageId}")
    public Result<List<Annotation>> getAnnotationsByImage(@PathVariable String imageId) {
        return Result.success(appraisalService.getAnnotationsByImage(imageId));
    }

    @PostMapping("/comments")
    public Result<Comment> addComment(@RequestBody Comment comment) {
        return Result.success(appraisalService.addComment(comment));
    }

    @DeleteMapping("/comments/{id}")
    public Result<Void> deleteComment(@PathVariable String id) {
        appraisalService.deleteComment(id);
        return Result.success(null);
    }

    @GetMapping("/comments/appraisal/{appraisalId}")
    public Result<List<Comment>> getCommentsByAppraisal(@PathVariable String appraisalId) {
        return Result.success(appraisalService.getCommentsByAppraisal(appraisalId));
    }

    @GetMapping("/tasks/{taskId}/report")
    public Result<Map<String, Object>> generateReport(@PathVariable String taskId) {
        return Result.success(appraisalService.generateReport(taskId));
    }

    @GetMapping("/stats")
    public Result<Map<String, Object>> getStats() {
        return Result.success(appraisalService.getStats());
    }
}
