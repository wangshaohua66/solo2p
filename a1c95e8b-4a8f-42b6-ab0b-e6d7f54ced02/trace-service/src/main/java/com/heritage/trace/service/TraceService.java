package com.heritage.trace.service;

import com.heritage.trace.entity.TraceRecord;
import com.heritage.trace.enums.FlowType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public interface TraceService {
    TraceRecord createRecord(TraceRecord record);
    TraceRecord getRecordById(String id);
    List<TraceRecord> getTraceChain(String artifactId);
    List<TraceRecord> getTraceChainByCode(String artifactCode);
    Page<TraceRecord> getRecordsByArtifactId(String artifactId, Pageable pageable);
    Page<TraceRecord> getRecordsByFlowType(FlowType flowType, Pageable pageable);
    Page<TraceRecord> getRecordsByOperator(String operatorId, Pageable pageable);
    List<TraceRecord> getRecordsByTimeRange(LocalDateTime start, LocalDateTime end);
    boolean verifyChain(String artifactId);
    Map<String, Object> getTraceStats();
}
