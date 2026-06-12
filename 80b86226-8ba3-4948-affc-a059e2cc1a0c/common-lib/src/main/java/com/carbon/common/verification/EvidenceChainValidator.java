package com.carbon.common.verification;

import com.carbon.common.api.ErrorCode;
import com.carbon.common.exception.BusinessException;
import org.springframework.util.CollectionUtils;

import java.util.Collection;
import java.util.List;
import java.util.regex.Pattern;

public class EvidenceChainValidator {

    private static final Pattern EVIDENCE_ID_PATTERN = Pattern.compile(
            "^(EVD|DOC|IMG|PDF|XLS|REP)-[A-Z0-9-]+$");

    private static final List<String> VALID_EVIDENCE_PREFIXES = List.of(
            "EVD-", "DOC-", "IMG-", "PDF-", "XLS-", "REP-", "VOU-", "MTR-", "INS-"
    );

    public static void requireEvidence(Collection<String> evidenceIds, String resourceType) {
        if (CollectionUtils.isEmpty(evidenceIds)) {
            throw new BusinessException(ErrorCode.EVIDENCE_CHAIN_BROKEN,
                    String.format("%s 必须挂载至少1个证据", resourceType));
        }
        for (String id : evidenceIds) {
            if (id == null || id.isBlank()) {
                throw new BusinessException(ErrorCode.EVIDENCE_CHAIN_BROKEN,
                        String.format("%s 证据ID不能为空", resourceType));
            }
            if (!isValidEvidenceId(id)) {
                throw new BusinessException(ErrorCode.EVIDENCE_CHAIN_BROKEN,
                        String.format("%s 证据ID格式不合法: %s", resourceType, id));
            }
        }
    }

    public static boolean isValidEvidenceId(String id) {
        if (id == null) return false;
        for (String prefix : VALID_EVIDENCE_PREFIXES) {
            if (id.startsWith(prefix) && id.length() > prefix.length()) {
                return true;
            }
        }
        return false;
    }
}
