package com.heritage.inspect.repository;

import com.heritage.inspect.entity.InspectTask;
import com.heritage.inspect.enums.InspectTaskStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface InspectTaskRepository extends MongoRepository<InspectTask, String> {
    List<InspectTask> findByInspectorId(String inspectorId);
    Page<InspectTask> findByInspectorId(String inspectorId, Pageable pageable);
    Page<InspectTask> findByStatus(InspectTaskStatus status, Pageable pageable);
    List<InspectTask> findByScheduledTimeBetween(LocalDateTime start, LocalDateTime end);
    long countByStatus(InspectTaskStatus status);
    long countByInspectorIdAndStatus(String inspectorId, InspectTaskStatus status);
}
