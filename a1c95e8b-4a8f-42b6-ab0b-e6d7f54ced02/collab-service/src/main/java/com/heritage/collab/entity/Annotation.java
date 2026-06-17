package com.heritage.collab.entity;

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
@Document(collection = "annotations")
public class Annotation {
    @Id
    private String id;
    @Indexed
    private String appraisalId;
    @Indexed
    private String artifactId;
    @Indexed
    private String imageId;
    private String expertId;
    private String expertName;
    private String type;
    private Double x;
    private Double y;
    private Double width;
    private Double height;
    private String content;
    @Builder.Default
    private List<String> replies = new ArrayList<>();
    @CreatedDate
    private LocalDateTime createTime;
    @LastModifiedDate
    private LocalDateTime updateTime;
}
