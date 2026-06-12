package com.carbon.verification.entity;

import com.carbon.common.entity.BaseEntity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.YearMonth;
import java.util.HashMap;
import java.util.Map;

@Data
@EqualsAndHashCode(callSuper = true)
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "disclosure_reports")
@CompoundIndex(name = "tenant_year_template_idx",
        def = "{'tenantId':1, 'periodYear':1, 'template':1}", unique = true)
public class DisclosureReport extends BaseEntity {

    public enum Template { CSRC, ISSB_S2, CDP, CBAM, CUSTOM }

    public enum Status { DRAFT, FILLED, SIGNED, PUBLISHED }

    private Integer periodYear;

    private Integer periodMonth;

    private String period;

    private Template template;

    @Builder.Default
    private Status status = Status.DRAFT;

    private String title;

    private Map<String, Object> filledData;

    private String htmlFileId;

    private String pdfFileId;

    private String pdfHash;

    private String signature;

    private String signedBy;

    private Instant signedAt;

    private String serialNumber;

    private String publishedUrl;

    @Builder.Default
    private Map<String, Object> extensions = new HashMap<>();
}
