package com.heritage.entity;

import com.heritage.enums.MediaType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MediaFile {

    private String id;

    private String fileName;

    private MediaType type;

    private String fileUrl;

    private long fileSize;

    private String mimeType;

    private String description;

    private Map<String, Object> metadata;

    private LocalDateTime uploadedAt;

    private String uploadedBy;
}
