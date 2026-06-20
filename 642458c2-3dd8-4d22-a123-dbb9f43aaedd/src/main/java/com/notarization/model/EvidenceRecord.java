package com.notarization.model;

import com.notarization.model.enums.EvidenceType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "evidence_records")
public class EvidenceRecord {

    @Id
    private String id;

    @Indexed(unique = true)
    private String evidenceNumber;

    @Indexed
    private String caseId;

    @Indexed
    private String submitterId;

    private String evidenceName;

    @Indexed
    private EvidenceType evidenceType;

    private String evidenceUrl;

    private String fileHash;

    @Indexed
    private Long hashIndex;

    private String prevHash;

    private String currentHash;

    @Indexed
    private Instant timestamp;

    @Indexed
    private String chainId;

    private String description;

    private Boolean verified;
}
