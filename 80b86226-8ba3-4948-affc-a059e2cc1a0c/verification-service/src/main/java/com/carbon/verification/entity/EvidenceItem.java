package com.carbon.verification.entity;

import com.carbon.common.entity.BaseEntity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@EqualsAndHashCode(callSuper = true)
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "evidence_items")
@CompoundIndex(name = "tenant_bundle_idx", def = "{'tenantId':1, 'bundleId':1}")
@CompoundIndex(name = "tenant_ref_idx", def = "{'tenantId':1, 'refType':1, 'refId':1}")
public class EvidenceItem extends BaseEntity {

    public enum Type { VOUCHER, METER_LOG, MANUAL_LOG, TEST_REPORT, INVOICE, CONTRACT, OTHER }

    public enum RefType { ACTIVITY_DATA, EMISSION_SOURCE, CALCULATION, QUOTA, CCER }

    @Indexed
    private String bundleId;

    @Indexed
    private RefType refType;

    @Indexed
    private String refId;

    private Type type;

    private String title;

    private String description;

    private String fileId;

    private String fileName;

    private Long fileSize;

    private String fileHash;

    private String mimeType;

    private String sourceSystem;

    private Instant evidenceDate;

    @Builder.Default
    private List<String> tags = new ArrayList<>();

    @Builder.Default
    private Map<String, Object> meta = new HashMap<>();

    private String verifierNote;

    @Builder.Default
    private String verificationStatus = "PENDING";

    private Instant verifiedAt;

    private String verifiedBy;
}
