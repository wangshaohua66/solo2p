package com.mw.supervision.document;

import com.mw.common.document.BaseDocument;
import com.mw.common.enums.AlertLevel;
import com.mw.common.enums.AlertType;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "alert_rule")
public class AlertRule extends BaseDocument {

    private AlertType type;

    private AlertLevel level;

    private Boolean enabled = true;

    private Double threshold;

    private String description;
}
