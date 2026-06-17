package com.heritage.inspect.entity;

import com.heritage.inspect.enums.InspectTaskStatus;
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
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "inspect_tasks")
public class InspectTask {
    @Id
    private String id;
    private String title;
    private String description;
    @Indexed
    private String inspectorId;
    private String inspectorName;
    @Builder.Default
    private List<String> artifactIds = new ArrayList<>();
    private String location;
    private Double latitude;
    private Double longitude;
    private InspectTaskStatus status;
    private LocalDateTime scheduledTime;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String creatorId;
    private String creatorName;
    private String remark;
    @CreatedDate
    private LocalDateTime createTime;
    @LastModifiedDate
    private LocalDateTime updateTime;
}
