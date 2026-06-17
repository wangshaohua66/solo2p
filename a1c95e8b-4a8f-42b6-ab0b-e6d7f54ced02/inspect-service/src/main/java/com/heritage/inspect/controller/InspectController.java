package com.heritage.inspect.controller;

import com.heritage.inspect.common.Result;
import com.heritage.inspect.entity.*;
import com.heritage.inspect.enums.AlertLevel;
import com.heritage.inspect.enums.DiseaseType;
import com.heritage.inspect.enums.InspectTaskStatus;
import com.heritage.inspect.service.InspectService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/inspect")
@RequiredArgsConstructor
public class InspectController {

    private final InspectService inspectService;

    @PostMapping("/tasks")
    public Result<InspectTask> createTask(@RequestBody InspectTask task) {
        return Result.success(inspectService.createTask(task));
    }

    @PutMapping("/tasks/{id}")
    public Result<InspectTask> updateTask(@PathVariable String id, @RequestBody InspectTask task) {
        return Result.success(inspectService.updateTask(id, task));
    }

    @DeleteMapping("/tasks/{id}")
    public Result<Void> deleteTask(@PathVariable String id) {
        inspectService.deleteTask(id);
        return Result.success(null);
    }

    @GetMapping("/tasks/{id}")
    public Result<InspectTask> getTaskById(@PathVariable String id) {
        return Result.success(inspectService.getTaskById(id));
    }

    @GetMapping("/tasks/inspector/{inspectorId}")
    public Result<List<InspectTask>> getTasksByInspector(@PathVariable String inspectorId) {
        return Result.success(inspectService.getTasksByInspector(inspectorId));
    }

    @GetMapping("/tasks/inspector/{inspectorId}/page")
    public Result<Page<InspectTask>> getTasksByInspectorPaged(
            @PathVariable String inspectorId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return Result.success(inspectService.getTasksByInspector(inspectorId,
                PageRequest.of(page, size, Sort.by("createTime").descending())));
    }

    @GetMapping("/tasks/status/{status}")
    public Result<Page<InspectTask>> getTasksByStatus(
            @PathVariable InspectTaskStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return Result.success(inspectService.getTasksByStatus(status,
                PageRequest.of(page, size, Sort.by("createTime").descending())));
    }

    @PostMapping("/tasks/{id}/start")
    public Result<InspectTask> startTask(@PathVariable String id) {
        return Result.success(inspectService.startTask(id));
    }

    @PostMapping("/tasks/{id}/complete")
    public Result<InspectTask> completeTask(@PathVariable String id) {
        return Result.success(inspectService.completeTask(id));
    }

    @PostMapping("/tasks/{id}/cancel")
    public Result<InspectTask> cancelTask(@PathVariable String id) {
        return Result.success(inspectService.cancelTask(id));
    }

    @PostMapping("/diseases")
    public Result<DiseaseRecord> createDiseaseRecord(@RequestBody DiseaseRecord record) {
        return Result.success(inspectService.createDiseaseRecord(record));
    }

    @GetMapping("/diseases/{id}")
    public Result<DiseaseRecord> getDiseaseRecordById(@PathVariable String id) {
        return Result.success(inspectService.getDiseaseRecordById(id));
    }

    @GetMapping("/diseases/artifact/{artifactId}")
    public Result<List<DiseaseRecord>> getDiseaseRecordsByArtifact(@PathVariable String artifactId) {
        return Result.success(inspectService.getDiseaseRecordsByArtifact(artifactId));
    }

    @GetMapping("/diseases/task/{taskId}")
    public Result<List<DiseaseRecord>> getDiseaseRecordsByTask(@PathVariable String taskId) {
        return Result.success(inspectService.getDiseaseRecordsByTask(taskId));
    }

    @GetMapping("/diseases/type/{type}")
    public Result<Page<DiseaseRecord>> getDiseaseRecordsByType(
            @PathVariable DiseaseType type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return Result.success(inspectService.getDiseaseRecordsByType(type,
                PageRequest.of(page, size, Sort.by("createTime").descending())));
    }

    @GetMapping("/diseases/level/{level}")
    public Result<Page<DiseaseRecord>> getDiseaseRecordsByLevel(
            @PathVariable AlertLevel level,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return Result.success(inspectService.getDiseaseRecordsByLevel(level,
                PageRequest.of(page, size, Sort.by("createTime").descending())));
    }

    @GetMapping("/diseases/unresolved")
    public Result<List<DiseaseRecord>> getUnresolvedDiseases() {
        return Result.success(inspectService.getUnresolvedDiseases());
    }

    @PostMapping("/diseases/{id}/resolve")
    public Result<DiseaseRecord> resolveDisease(
            @PathVariable String id,
            @RequestParam String resolution,
            @RequestParam String resolvedBy) {
        return Result.success(inspectService.resolveDisease(id, resolution, resolvedBy));
    }

    @GetMapping("/alerts/unacknowledged")
    public Result<List<InspectAlert>> getUnacknowledgedAlerts() {
        return Result.success(inspectService.getUnacknowledgedAlerts());
    }

    @GetMapping("/alerts/unacknowledged/page")
    public Result<Page<InspectAlert>> getUnacknowledgedAlertsPaged(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return Result.success(inspectService.getUnacknowledgedAlerts(
                PageRequest.of(page, size, Sort.by("createTime").descending())));
    }

    @PostMapping("/alerts/{id}/acknowledge")
    public Result<InspectAlert> acknowledgeAlert(@PathVariable String id, @RequestParam String userId) {
        return Result.success(inspectService.acknowledgeAlert(id, userId));
    }

    @PostMapping("/track")
    public Result<TrackPoint> addTrackPoint(@RequestBody TrackPoint point) {
        return Result.success(inspectService.addTrackPoint(point));
    }

    @GetMapping("/track/task/{taskId}")
    public Result<List<TrackPoint>> getTrackByTask(@PathVariable String taskId) {
        return Result.success(inspectService.getTrackByTask(taskId));
    }

    @GetMapping("/track/inspector/{inspectorId}")
    public Result<List<TrackPoint>> getTrackByInspectorAndTime(
            @PathVariable String inspectorId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        return Result.success(inspectService.getTrackByInspectorAndTime(inspectorId, start, end));
    }

    @GetMapping("/stats")
    public Result<Map<String, Object>> getStats() {
        return Result.success(inspectService.getStats());
    }
}
