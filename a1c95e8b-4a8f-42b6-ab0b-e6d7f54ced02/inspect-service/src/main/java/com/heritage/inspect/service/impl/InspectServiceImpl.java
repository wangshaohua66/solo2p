package com.heritage.inspect.service.impl;

import com.heritage.inspect.entity.*;
import com.heritage.inspect.enums.AlertLevel;
import com.heritage.inspect.enums.DiseaseType;
import com.heritage.inspect.enums.InspectTaskStatus;
import com.heritage.inspect.repository.*;
import com.heritage.inspect.service.InspectService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class InspectServiceImpl implements InspectService {

    private final InspectTaskRepository taskRepository;
    private final DiseaseRecordRepository diseaseRepository;
    private final InspectAlertRepository alertRepository;
    private final TrackPointRepository trackRepository;

    @Override
    public InspectTask createTask(InspectTask task) {
        if (task.getStatus() == null) task.setStatus(InspectTaskStatus.PENDING);
        task.setCreateTime(LocalDateTime.now());
        return taskRepository.save(task);
    }

    @Override
    public InspectTask updateTask(String id, InspectTask task) {
        InspectTask existing = getTaskById(id);
        if (task.getTitle() != null) existing.setTitle(task.getTitle());
        if (task.getDescription() != null) existing.setDescription(task.getDescription());
        if (task.getInspectorId() != null) existing.setInspectorId(task.getInspectorId());
        if (task.getInspectorName() != null) existing.setInspectorName(task.getInspectorName());
        if (task.getArtifactIds() != null) existing.setArtifactIds(task.getArtifactIds());
        if (task.getLocation() != null) existing.setLocation(task.getLocation());
        if (task.getScheduledTime() != null) existing.setScheduledTime(task.getScheduledTime());
        if (task.getRemark() != null) existing.setRemark(task.getRemark());
        existing.setUpdateTime(LocalDateTime.now());
        return taskRepository.save(existing);
    }

    @Override
    public void deleteTask(String id) {
        trackRepository.deleteByTaskId(id);
        taskRepository.deleteById(id);
    }

    @Override
    public InspectTask getTaskById(String id) {
        return taskRepository.findById(id).orElseThrow(() -> new RuntimeException("巡查任务不存在"));
    }

    @Override
    public List<InspectTask> getTasksByInspector(String inspectorId) {
        return taskRepository.findByInspectorId(inspectorId);
    }

    @Override
    public Page<InspectTask> getTasksByInspector(String inspectorId, Pageable pageable) {
        return taskRepository.findByInspectorId(inspectorId, pageable);
    }

    @Override
    public Page<InspectTask> getTasksByStatus(InspectTaskStatus status, Pageable pageable) {
        return taskRepository.findByStatus(status, pageable);
    }

    @Override
    public InspectTask startTask(String id) {
        InspectTask task = getTaskById(id);
        task.setStatus(InspectTaskStatus.IN_PROGRESS);
        task.setStartTime(LocalDateTime.now());
        task.setUpdateTime(LocalDateTime.now());
        return taskRepository.save(task);
    }

    @Override
    public InspectTask completeTask(String id) {
        InspectTask task = getTaskById(id);
        task.setStatus(InspectTaskStatus.COMPLETED);
        task.setEndTime(LocalDateTime.now());
        task.setUpdateTime(LocalDateTime.now());
        return taskRepository.save(task);
    }

    @Override
    public InspectTask cancelTask(String id) {
        InspectTask task = getTaskById(id);
        task.setStatus(InspectTaskStatus.CANCELLED);
        task.setUpdateTime(LocalDateTime.now());
        return taskRepository.save(task);
    }

    @Override
    public DiseaseRecord createDiseaseRecord(DiseaseRecord record) {
        if (record.getResolved() == null) record.setResolved(false);
        record.setCreateTime(LocalDateTime.now());
        DiseaseRecord saved = diseaseRepository.save(record);

        if (record.getAlertLevel() == null ||
            record.getAlertLevel() == AlertLevel.HIGH ||
            record.getAlertLevel() == AlertLevel.CRITICAL) {
            InspectAlert alert = InspectAlert.builder()
                .diseaseRecordId(saved.getId())
                .artifactId(saved.getArtifactId())
                .artifactName(saved.getArtifactName())
                .level(saved.getAlertLevel() != null ? saved.getAlertLevel() : AlertLevel.HIGH)
                .title("文物病害预警: " + saved.getDiseaseName())
                .content(saved.getDescription())
                .acknowledged(false)
                .build();
            createAlert(alert);
        }
        return saved;
    }

    @Override
    public DiseaseRecord getDiseaseRecordById(String id) {
        return diseaseRepository.findById(id).orElseThrow(() -> new RuntimeException("病害记录不存在"));
    }

    @Override
    public List<DiseaseRecord> getDiseaseRecordsByArtifact(String artifactId) {
        return diseaseRepository.findByArtifactId(artifactId);
    }

    @Override
    public List<DiseaseRecord> getDiseaseRecordsByTask(String taskId) {
        return diseaseRepository.findByTaskId(taskId);
    }

    @Override
    public Page<DiseaseRecord> getDiseaseRecordsByType(DiseaseType type, Pageable pageable) {
        return diseaseRepository.findByDiseaseType(type, pageable);
    }

    @Override
    public Page<DiseaseRecord> getDiseaseRecordsByLevel(AlertLevel level, Pageable pageable) {
        return diseaseRepository.findByAlertLevel(level, pageable);
    }

    @Override
    public List<DiseaseRecord> getUnresolvedDiseases() {
        return diseaseRepository.findByResolvedFalse();
    }

    @Override
    public DiseaseRecord resolveDisease(String id, String resolution, String resolvedBy) {
        DiseaseRecord record = getDiseaseRecordById(id);
        record.setResolved(true);
        record.setResolution(resolution);
        record.setResolvedBy(resolvedBy);
        record.setResolvedTime(LocalDateTime.now());
        return diseaseRepository.save(record);
    }

    @Override
    public InspectAlert createAlert(InspectAlert alert) {
        if (alert.getAcknowledged() == null) alert.setAcknowledged(false);
        alert.setCreateTime(LocalDateTime.now());
        InspectAlert saved = alertRepository.save(alert);
        log.warn("Alert created: {} - {}", saved.getLevel(), saved.getTitle());
        return saved;
    }

    @Override
    public InspectAlert getAlertById(String id) {
        return alertRepository.findById(id).orElseThrow(() -> new RuntimeException("预警不存在"));
    }

    @Override
    public List<InspectAlert> getUnacknowledgedAlerts() {
        return alertRepository.findByAcknowledgedFalse();
    }

    @Override
    public Page<InspectAlert> getUnacknowledgedAlerts(Pageable pageable) {
        return alertRepository.findByAcknowledgedFalse(pageable);
    }

    @Override
    public InspectAlert acknowledgeAlert(String id, String userId) {
        InspectAlert alert = getAlertById(id);
        alert.setAcknowledged(true);
        alert.setAcknowledgedBy(userId);
        alert.setAcknowledgedTime(LocalDateTime.now());
        return alertRepository.save(alert);
    }

    @Override
    public TrackPoint addTrackPoint(TrackPoint point) {
        if (point.getTime() == null) point.setTime(LocalDateTime.now());
        return trackRepository.save(point);
    }

    @Override
    public List<TrackPoint> getTrackByTask(String taskId) {
        return trackRepository.findByTaskIdOrderByTimeAsc(taskId);
    }

    @Override
    public List<TrackPoint> getTrackByInspectorAndTime(String inspectorId, LocalDateTime start, LocalDateTime end) {
        return trackRepository.findByInspectorIdAndTimeBetweenOrderByTimeAsc(inspectorId, start, end);
    }

    @Override
    public Map<String, Object> getStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalTasks", taskRepository.count());
        Map<String, Long> taskByStatus = new HashMap<>();
        for (InspectTaskStatus status : InspectTaskStatus.values()) {
            taskByStatus.put(status.getName(), taskRepository.countByStatus(status));
        }
        stats.put("tasksByStatus", taskByStatus);

        stats.put("totalDiseases", diseaseRepository.count());
        stats.put("unresolvedDiseases", diseaseRepository.countByResolvedFalse());
        Map<String, Long> diseaseByType = new HashMap<>();
        for (DiseaseType type : DiseaseType.values()) {
            diseaseByType.put(type.getName(), diseaseRepository.countByDiseaseType(type));
        }
        stats.put("diseasesByType", diseaseByType);

        stats.put("totalAlerts", alertRepository.count());
        stats.put("unacknowledgedAlerts", alertRepository.countByAcknowledgedFalse());
        Map<String, Long> alertByLevel = new HashMap<>();
        for (AlertLevel level : AlertLevel.values()) {
            alertByLevel.put(level.getName(), alertRepository.countByLevelAndAcknowledgedFalse(level));
        }
        stats.put("unacknowledgedAlertsByLevel", alertByLevel);

        stats.put("totalTrackPoints", trackRepository.count());
        return stats;
    }
}
