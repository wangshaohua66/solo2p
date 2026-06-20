package com.tvstation.media.entity;

import com.tvstation.media.common.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.*;

@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "materials", indexes = {
    @Index(name = "idx_material_type", columnList = "type"),
    @Index(name = "idx_material_uploader", columnList = "uploaderId"),
    @Index(name = "idx_material_file_hash", columnList = "fileHash"),
    @Index(name = "idx_material_created", columnList = "createdAt"),
    @Index(name = "idx_material_name", columnList = "name")
})
public class Material extends BaseEntity {

    @Column(nullable = false, length = 255)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MaterialType type;

    @Column(nullable = false)
    private Long fileSize;

    private Long duration;

    @Column(length = 20)
    private String resolution;

    @Column(length = 50)
    private String codec;

    @Column(nullable = false, length = 20)
    private String format;

    @Column(nullable = false, length = 500)
    private String path;

    @Column(length = 500)
    private String thumbnail;

    @Column(length = 200)
    private String fileHash;

    @ElementCollection
    @CollectionTable(name = "material_tags", joinColumns = @JoinColumn(name = "materialId"))
    @Column(name = "tag", length = 50)
    @Builder.Default
    private List<String> tags = new ArrayList<>();

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private Long uploaderId;

    @Column(nullable = false, length = 50)
    private String uploaderName;

    private Long copyrightId;

    @Column(name = "view_count")
    @Builder.Default
    private Integer viewCount = 0;

    @Column(name = "download_count")
    @Builder.Default
    private Integer downloadCount = 0;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> metadata = new HashMap<>();

    public enum MaterialType {
        video, audio, image, document
    }
}
