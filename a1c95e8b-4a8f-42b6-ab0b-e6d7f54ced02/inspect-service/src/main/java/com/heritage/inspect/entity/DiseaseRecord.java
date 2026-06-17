package com.heritage.inspect.entity;

import com.heritage.inspect.enums.AlertLevel;
import com.heritage.inspect.enums.DiseaseType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "disease_records")
public class DiseaseRecord {
    @Id
    private String id;
    @Indexed
    private String artifactId;
    private String artifactCode;
    private String artifactName;
    @Indexed
    private String taskId;
    @Indexed
    private String inspectorId;
    private String inspectorName;
    @Indexed
    private DiseaseType diseaseType;
    private String diseaseName;
    @Indexed
    private AlertLevel alertLevel;
    private String description;
    private String location;
    private Double latitude;
    private Double longitude;
    @Builder.Default
    private List<String> photos = new ArrayList<>();
    private Boolean resolved;
    private String resolution;
    private LocalDateTime resolvedTime;
    private String resolvedBy;
    @CreatedDate
    private LocalDateTime createTime;
}
