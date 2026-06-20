package com.mw.supervision.document;

import com.mw.common.document.BaseDocument;
import com.mw.common.enums.AlertLevel;
import com.mw.common.enums.AlertType;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "alert")
public class Alert extends BaseDocument {

    private AlertType type;

    private AlertLevel level;

    @Indexed
    private String businessKey;

    private String orgId;

    private String detail;

    private String status = "PENDING";

    private String pushStatus = "NOT_PUSHED";

    private String pushedTo;

    private LocalDateTime pushTime;

    private LocalDateTime confirmTime;

    private String confirmUser;

    private String feedback;
}
