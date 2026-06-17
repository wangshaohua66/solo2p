package com.heritage.inspect.entity;

import com.heritage.inspect.enums.AlertLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "inspect_alerts")
public class InspectAlert {
    @Id
    private String id;
    @Indexed
    private String diseaseRecordId;
    @Indexed
    private String artifactId;
    private String artifactName;
    @Indexed
    private AlertLevel level;
    private String title;
    private String content;
    @Indexed
    private Boolean acknowledged;
    private String acknowledgedBy;
    private LocalDateTime acknowledgedTime;
    @Indexed
    @CreatedDate
    private LocalDateTime createTime;
}
