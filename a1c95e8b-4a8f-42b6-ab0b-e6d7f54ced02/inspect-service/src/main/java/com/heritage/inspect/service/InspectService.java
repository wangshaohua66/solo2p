package com.heritage.inspect.service;

import com.heritage.inspect.entity.*;
import com.heritage.inspect.enums.AlertLevel;
import com.heritage.inspect.enums.DiseaseType;
import com.heritage.inspect.enums.InspectTaskStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public interface InspectService {
    InspectTask createTask(InspectTask task);
    InspectTask updateTask(String id, InspectTask task);
    void deleteTask(String id);
    InspectTask getTaskById(String id);
    List<InspectTask> getTasksByInspector(String inspectorId);
    Page<InspectTask> getTasksByInspector(String inspectorId, Pageable pageable);
    Page<InspectTask> getTasksByStatus(InspectTaskStatus status, Pageable pageable);
    InspectTask startTask(String id);
    InspectTask completeTask(String id);
    InspectTask cancelTask(String id);

    DiseaseRecord createDiseaseRecord(DiseaseRecord record);
    DiseaseRecord getDiseaseRecordById(String id);
    List<DiseaseRecord> getDiseaseRecordsByArtifact(String artifactId);
    List<DiseaseRecord> getDiseaseRecordsByTask(String taskId);
    Page<DiseaseRecord> getDiseaseRecordsByType(DiseaseType type, Pageable pageable);
    Page<DiseaseRecord> getDiseaseRecordsByLevel(AlertLevel level, Pageable pageable);
    List<DiseaseRecord> getUnresolvedDiseases();
    DiseaseRecord resolveDisease(String id, String resolution, String resolvedBy);

    InspectAlert createAlert(InspectAlert alert);
    InspectAlert getAlertById(String id);
    List<InspectAlert> getUnacknowledgedAlerts();
    Page<InspectAlert> getUnacknowledgedAlerts(Pageable pageable);
    InspectAlert acknowledgeAlert(String id, String userId);

    TrackPoint addTrackPoint(TrackPoint point);
    List<TrackPoint> getTrackByTask(String taskId);
    List<TrackPoint> getTrackByInspectorAndTime(String inspectorId, LocalDateTime start, LocalDateTime end);

    Map<String, Object> getStats();
}
