package com.heritage.artifact.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ArtifactDocument {

    private String id;
    private String fileName;
    private String originalName;
    private String fileUrl;
    private String mimeType;
    private Long fileSize;
    private String category;
    private String description;
    private LocalDateTime uploadTime;
    private String uploadedBy;
}
