package com.heritage.inspect.repository;

import com.heritage.inspect.entity.DiseaseRecord;
import com.heritage.inspect.enums.AlertLevel;
import com.heritage.inspect.enums.DiseaseType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface DiseaseRecordRepository extends MongoRepository<DiseaseRecord, String> {
    List<DiseaseRecord> findByArtifactId(String artifactId);
    List<DiseaseRecord> findByTaskId(String taskId);
    List<DiseaseRecord> findByInspectorId(String inspectorId);
    Page<DiseaseRecord> findByDiseaseType(DiseaseType type, Pageable pageable);
    Page<DiseaseRecord> findByAlertLevel(AlertLevel level, Pageable pageable);
    List<DiseaseRecord> findByCreateTimeBetween(LocalDateTime start, LocalDateTime end);
    List<DiseaseRecord> findByResolvedFalse();
    long countByDiseaseType(DiseaseType type);
    long countByAlertLevel(AlertLevel level);
    long countByResolvedFalse();
}
