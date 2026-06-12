package com.carbon.factor.entity;

import com.carbon.common.entity.BaseEntity;
import com.carbon.common.enums.FactorLibrary;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@EqualsAndHashCode(callSuper = true)
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "factor_versions")
@CompoundIndex(name = "lib_version_idx", def = "{'library':1, 'versionCode':1}", unique = true)
public class FactorVersion extends BaseEntity {

    @Indexed
    private FactorLibrary library;

    @Indexed
    private String versionCode;

    private String versionName;

    private String description;

    private LocalDate releaseDate;

    private LocalDate effectiveFrom;

    private LocalDate effectiveTo;

    private String baseVersion;

    @Builder.Default
    private List<String> changelogSummary = new ArrayList<>();

    private Long totalFactors;

    private Long addedCount;

    private Long updatedCount;

    private Long deprecatedCount;

    private Boolean locked;

    private String publisher;

    private String reviewStatus;

    @Builder.Default
    private Map<String, Object> extensions = new HashMap<>();
}
