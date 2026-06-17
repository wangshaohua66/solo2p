package com.heritage.collab.entity;

import com.heritage.collab.enums.AppraisalStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "appraisal_tasks")
public class AppraisalTask {
    @Id
    private String id;
    private String title;
    private String description;
    @Indexed
    private String artifactId;
    private String artifactCode;
    private String artifactName;
    private String creatorId;
    private String creatorName;
    @Builder.Default
    private List<String> expertIds = new ArrayList<>();
    @Builder.Default
    private Map<String, String> expertOpinions = new HashMap<>();
    private String conclusion;
    private AppraisalStatus status;
    private LocalDateTime deadline;
    @Builder.Default
    private List<String> attachments = new ArrayList<>();
    @CreatedDate
    private LocalDateTime createTime;
    @LastModifiedDate
    private LocalDateTime updateTime;
    private LocalDateTime completedTime;
}
