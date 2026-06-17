package com.heritage.artifact.entity;

import com.heritage.artifact.enums.ArtifactLevel;
import com.heritage.artifact.enums.ArtifactStatus;
import com.heritage.artifact.enums.ArtifactType;
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

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "artifacts")
@CompoundIndexes({
    @CompoundIndex(name = "name_type_idx", def = "{'name': 1, 'type': 1}"),
    @CompoundIndex(name = "level_status_idx", def = "{'level': 1, 'status': 1}")
})
public class Artifact {

    @Id
    private String id;

    @Indexed(unique = true, sparse = true)
    private String artifactCode;

    @Indexed
    private String name;

    private String subtitle;

    private ArtifactType type;

    private ArtifactLevel level;

    private ArtifactStatus status;

    private String dynasty;

    private String era;

    private String origin;

    private String discoveryLocation;

    private String currentLocation;

    private String dimensions;

    private String weight;

    private String material;

    private String technique;

    private String inscription;

    private String description;

    private String historicalNote;

    private String bibliography;

    @Builder.Default
    private List<ArtifactImage> images = new ArrayList<>();

    @Builder.Default
    private List<ArtifactModel3D> models3d = new ArrayList<>();

    @Builder.Default
    private List<ArtifactDocument> documents = new ArrayList<>();

    @Indexed
    private String owner;

    private String custodian;

    @Indexed
    private String createdBy;

    private String updatedBy;

    @Indexed
    private Integer dataAccessLevel;

    @CreatedDate
    private LocalDateTime createTime;

    @LastModifiedDate
    private LocalDateTime updateTime;

    @Indexed
    private String qrCodeUrl;

    private String barcode;
}
