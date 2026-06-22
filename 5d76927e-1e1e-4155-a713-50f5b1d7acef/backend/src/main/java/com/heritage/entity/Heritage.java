package com.heritage.entity;

import com.heritage.enums.HeritageCategory;
import com.heritage.enums.HeritageLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "heritages")
@CompoundIndex(name = "category_level_idx", def = "{'category': 1, 'level': 1}")
public class Heritage {

    @Id
    private String id;

    @Indexed
    private String name;

    private HeritageCategory category;

    private HeritageLevel level;

    @Indexed
    private String region;

    private String summary;

    private String description;

    private String history;

    private String characteristics;

    private String coverImage;

    private List<String> inheritorIds = new ArrayList<>();

    private List<MediaFile> mediaFiles = new ArrayList<>();

    private List<VersionHistory> versionHistory = new ArrayList<>();

    private long viewCount;

    private long hotScore;

    private boolean published;

    private String createdBy;

    private String updatedBy;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;
}
