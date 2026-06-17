package com.heritage.restoration.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "restoration_logs")
@CompoundIndex(name = "idx_project_time", def = "{'projectId':1, 'createdAt':-1}")
public class RestorationLog {
    @Id
    private String id;

    @Indexed
    private String projectId;

    private String stage;

    private String action;

    private String content;

    private Integer progressAfter;

    private String operatorId;
    private String operatorName;

    private String beforeStatus;
    private String afterStatus;

    private LocalDateTime createdAt;
}
