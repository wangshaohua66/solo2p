package com.heritage.trace.service;

import cn.hutool.crypto.digest.DigestUtil;
import com.heritage.trace.entity.TraceRecord;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;

@Slf4j
@Service
public class BlockchainService {

    public String calculateHash(TraceRecord record) {
        String raw = String.join("|",
            record.getArtifactId(),
            record.getFlowType() != null ? record.getFlowType().name() : "",
            record.getOperatorId() != null ? record.getOperatorId() : "",
            record.getCreateTime() != null ? record.getCreateTime().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) : "",
            record.getRemark() != null ? record.getRemark() : "",
            record.getPreviousHash() != null ? record.getPreviousHash() : ""
        );
        String hash = DigestUtil.sha256Hex(raw.getBytes(StandardCharsets.UTF_8));
        log.debug("Calculated hash for artifact {}: {}", record.getArtifactId(), hash);
        return hash;
    }

    public boolean verifyHash(TraceRecord record) {
        String expected = calculateHash(record);
        boolean valid = expected.equals(record.getBlockchainHash());
        log.debug("Hash verification for {}: {}", record.getId(), valid);
        return valid;
    }
}
