package com.carbon.common.verification;

import com.carbon.common.api.ErrorCode;
import com.carbon.common.exception.BusinessException;
import org.springframework.util.CollectionUtils;

import java.util.Collection;
import java.util.List;
import java.util.regex.Pattern;

public class EvidenceChainValidator {

    public static List<String> getValidEvidencePrefixes() {
        return Config.EVIDENCE_PREFIXES;
    }

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
        if (id == null || id.isBlank() || id.length() < Config.MIN_ID_LENGTH) return false;
        if (Config.ALLOW_UUID && Config.UUID_PATTERN.matcher(id).matches()) return true;
        if (Config.ALLOW_OBJECT_ID && Config.OBJECT_ID_PATTERN.matcher(id).matches()) return true;
        if (Config.ALLOW_SNOWFLAKE && Config.SNOWFLAKE_PATTERN.matcher(id).matches()) return true;
        for (String prefix : Config.EVIDENCE_PREFIXES) {
            if (id.startsWith(prefix) && id.length() > prefix.length()) {
                String suffix = id.substring(prefix.length());
                if (Config.ID_BODY_PATTERN.matcher(suffix).matches()) return true;
            }
        }
        if (Config.ALLOW_ANY_PREFIX) {
            int dash = id.indexOf('-');
            if (dash > 0 && dash < id.length() - 1) {
                String prefix = id.substring(0, dash + 1);
                String suffix = id.substring(dash + 1);
                if (Config.ID_BODY_PATTERN.matcher(suffix).matches()
                        && prefix.length() >= 2 && prefix.length() <= 8) return true;
            }
        }
        return false;
    }

    public static final class Config {
        public static final List<String> EVIDENCE_PREFIXES = List.of(
                "EVD-", "DOC-", "IMG-", "PDF-", "XLS-", "XLSX-", "REP-",
                "VOU-", "MTR-", "INS-", "INV-", "ORD-", "REC-", "BIZ-"
        );
        public static final int MIN_ID_LENGTH = 3;
        public static final boolean ALLOW_UUID = true;
        public static final boolean ALLOW_OBJECT_ID = true;
        public static final boolean ALLOW_SNOWFLAKE = true;
        public static final boolean ALLOW_ANY_PREFIX = true;

        public static final Pattern UUID_PATTERN = Pattern.compile(
                "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");
        public static final Pattern OBJECT_ID_PATTERN = Pattern.compile("^[0-9a-fA-F]{24}$");
        public static final Pattern SNOWFLAKE_PATTERN = Pattern.compile("^\\d{13,20}$");
        public static final Pattern ID_BODY_PATTERN = Pattern.compile(
                "^[0-9a-zA-Z_-]{2,64}$");
    }
}
