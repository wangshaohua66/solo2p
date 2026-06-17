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
@Document(collection = "restoration_photos")
@CompoundIndex(name = "idx_project_stage", def = "{'projectId':1, 'stage':1}")
public class RestorationPhoto {
    @Id
    private String id;

    @Indexed
    private String projectId;

    private String stage;

    private String artifactId;

    private String objectUrl;

    private String thumbnailUrl;

    private String fileName;

    private Long fileSize;

    private String description;

    private Double latitude;
    private Double longitude;

    private String uploaderId;
    private String uploaderName;

    private LocalDateTime createdAt;
}
