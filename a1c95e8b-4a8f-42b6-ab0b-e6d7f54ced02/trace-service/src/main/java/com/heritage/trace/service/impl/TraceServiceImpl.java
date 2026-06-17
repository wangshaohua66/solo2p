package com.heritage.trace.service.impl;

import com.heritage.trace.entity.TraceRecord;
import com.heritage.trace.enums.FlowType;
import com.heritage.trace.repository.TraceRecordRepository;
import com.heritage.trace.service.BlockchainService;
import com.heritage.trace.service.TraceService;
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
public class TraceServiceImpl implements TraceService {

    private final TraceRecordRepository repository;
    private final BlockchainService blockchainService;

    @Override
    public TraceRecord createRecord(TraceRecord record) {
        TraceRecord last = repository.findFirstByArtifactIdOrderByCreateTimeDesc(record.getArtifactId());
        if (last != null) {
            record.setPreviousHash(last.getBlockchainHash());
        }
        if (record.getCreateTime() == null) {
            record.setCreateTime(LocalDateTime.now());
        }
        record.setBlockchainHash(blockchainService.calculateHash(record));
        TraceRecord saved = repository.save(record);
        log.info("Trace record created: {} for artifact {}", saved.getId(), saved.getArtifactId());
        return saved;
    }

    @Override
    public TraceRecord getRecordById(String id) {
        return repository.findById(id).orElseThrow(() -> new RuntimeException("溯源记录不存在"));
    }

    @Override
    public List<TraceRecord> getTraceChain(String artifactId) {
        return repository.findByArtifactIdOrderByCreateTimeDesc(artifactId);
    }

    @Override
    public List<TraceRecord> getTraceChainByCode(String artifactCode) {
        return repository.findByArtifactCodeOrderByCreateTimeDesc(artifactCode);
    }

    @Override
    public Page<TraceRecord> getRecordsByArtifactId(String artifactId, Pageable pageable) {
        return repository.findByArtifactId(artifactId, pageable);
    }

    @Override
    public Page<TraceRecord> getRecordsByFlowType(FlowType flowType, Pageable pageable) {
        return repository.findByFlowType(flowType, pageable);
    }

    @Override
    public Page<TraceRecord> getRecordsByOperator(String operatorId, Pageable pageable) {
        return repository.findByOperatorId(operatorId, pageable);
    }

    @Override
    public List<TraceRecord> getRecordsByTimeRange(LocalDateTime start, LocalDateTime end) {
        return repository.findByCreateTimeBetweenOrderByCreateTimeDesc(start, end);
    }

    @Override
    public boolean verifyChain(String artifactId) {
        List<TraceRecord> chain = getTraceChain(artifactId);
        for (int i = 0; i < chain.size(); i++) {
            TraceRecord record = chain.get(i);
            if (!blockchainService.verifyHash(record)) {
                log.warn("Hash verification failed at record {}", record.getId());
                return false;
            }
            if (i < chain.size() - 1) {
                TraceRecord prev = chain.get(i + 1);
                if (!record.getPreviousHash().equals(prev.getBlockchainHash())) {
                    log.warn("Chain broken between {} and {}", record.getId(), prev.getId());
                    return false;
                }
            }
        }
        return true;
    }

    @Override
    public Map<String, Object> getTraceStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalRecords", repository.count());
        Map<String, Long> byType = new HashMap<>();
        for (FlowType type : FlowType.values()) {
            byType.put(type.getName(), repository.countByFlowType(type));
        }
        stats.put("byFlowType", byType);
        return stats;
    }
}
