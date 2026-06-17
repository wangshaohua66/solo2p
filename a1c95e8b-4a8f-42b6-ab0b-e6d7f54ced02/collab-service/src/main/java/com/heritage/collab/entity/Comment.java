package com.heritage.collab.entity;

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
@Document(collection = "comments")
public class Comment {
    @Id
    private String id;
    @Indexed
    private String appraisalId;
    @Indexed
    private String artifactId;
    private String expertId;
    private String expertName;
    private String content;
    private String parentId;
    @CreatedDate
    private LocalDateTime createTime;
}
