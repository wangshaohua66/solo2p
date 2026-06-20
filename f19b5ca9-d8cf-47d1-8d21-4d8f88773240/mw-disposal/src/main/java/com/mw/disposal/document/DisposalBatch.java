package com.mw.disposal.document;

import com.mw.common.document.BaseDocument;
import com.mw.common.enums.DisposalMethod;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "disposal_batch")
public class DisposalBatch extends BaseDocument {

    @Indexed(unique = true)
    private String batchNo;

    @Indexed
    private String manifestNo;

    private List<String> traceCodes;

    private DisposalMethod disposalMethod;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private Integer durationMinutes;

    private List<TimeValue> temperatureCurve;

    private List<TimeValue> pressureCurve;

    private Integer sterilizationDurationMinutes;

    private Boolean qualified;

    private EmissionData emissionData;

    private String remark;

    private String operatorId;

    private String reviewStatus;
}
