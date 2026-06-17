package com.heritage.collab.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "annotations")
@CompoundIndexes({
    @CompoundIndex(name = "idx_appraisal_image", def = "{'appraisalId': 1, 'imageId': 1}"),
    @CompoundIndex(name = "idx_artifact_tool", def = "{'artifactId': 1, 'tool': 1}")
})
public class Annotation {

    @Id
    private String id;

    @Indexed private String appraisalId;
    @Indexed private String artifactId;
    @Indexed private String imageId;
    private String expertId;
    private String expertName;

    @Indexed
    private String tool;

    private Double x;
    private Double y;
    private Double width;
    private Double height;
    private Double radius;
    private Double radiusX;
    private Double radiusY;
    private Double rotation;

    private List<double[]> points;

    private Double startX;
    private Double startY;
    private Double endX;
    private Double endY;
    private Double arrowSize;

    private String content;
    private Integer fontSize;
    private String fontFamily;
    private String textAlign;

    private String measureUnit;
    private Double measureValue;
    private Double scaleRatio;

    private String strokeStyle;
    private String fillStyle;
    private Double lineWidth;
    private Double lineDash;
    private String lineCap;
    private Double globalAlpha;

    private Integer zIndex;
    private Boolean locked;
    private Boolean visible;
    private String groupId;

    @Builder.Default
    private List<String> tags = new ArrayList<>();

    @Builder.Default
    private List<String> replies = new ArrayList<>();

    private Map<String, Object> metadata;

    @Builder.Default
    private Integer version = 1;

    @CreatedDate
    @Indexed
    private LocalDateTime createTime;

    @LastModifiedDate
    private LocalDateTime updateTime;
}
