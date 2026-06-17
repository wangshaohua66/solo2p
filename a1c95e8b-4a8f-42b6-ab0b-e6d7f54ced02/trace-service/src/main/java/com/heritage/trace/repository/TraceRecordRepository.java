package com.heritage.trace.repository;

import com.heritage.trace.entity.TraceRecord;
import com.heritage.trace.enums.FlowType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface TraceRecordRepository extends MongoRepository<TraceRecord, String> {
    List<TraceRecord> findByArtifactIdOrderByCreateTimeDesc(String artifactId);
    List<TraceRecord> findByArtifactCodeOrderByCreateTimeDesc(String artifactCode);
    Page<TraceRecord> findByArtifactId(String artifactId, Pageable pageable);
    Page<TraceRecord> findByFlowType(FlowType flowType, Pageable pageable);
    Page<TraceRecord> findByOperatorId(String operatorId, Pageable pageable);
    List<TraceRecord> findByCreateTimeBetweenOrderByCreateTimeDesc(LocalDateTime start, LocalDateTime end);
    TraceRecord findFirstByArtifactIdOrderByCreateTimeDesc(String artifactId);
    long countByArtifactId(String artifactId);
    long countByFlowType(FlowType flowType);
}
