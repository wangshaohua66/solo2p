package com.heritage.artifact.dto;

import com.heritage.artifact.enums.ArtifactLevel;
import com.heritage.artifact.enums.ArtifactStatus;
import com.heritage.artifact.enums.ArtifactType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ArtifactSearchDTO {

    private String keyword;
    private ArtifactType type;
    private ArtifactLevel level;
    private ArtifactStatus status;
    private String dynasty;
    private String era;
    private String origin;
    private Integer dataAccessLevel;

    @Builder.Default
    private int page = 0;

    @Builder.Default
    private int size = 20;

    @Builder.Default
    private String sortBy = "createTime";

    @Builder.Default
    private String sortDir = "desc";
}
