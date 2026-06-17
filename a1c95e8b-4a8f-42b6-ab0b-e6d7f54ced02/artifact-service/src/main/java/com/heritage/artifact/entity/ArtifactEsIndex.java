package com.heritage.artifact.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.*;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(indexName = "artifact", writeTypeHint = WriteTypeHint.FALSE, setting = Setting.Settings.class)
@Setting(replicas = 1, shards = 3, refreshInterval = "1s", sortFields = {"createTime"}, sortOrders = {SortOrder.DESC})
@Mapping(mappingPath = "es/artifact-mapping.json")
public class ArtifactEsIndex {

    @Id
    private String id;

    @Field(type = FieldType.Keyword)
    private String artifactCode;

    @MultiField(
        mainField = @Field(type = FieldType.Text, analyzer = "ik_max_word", searchAnalyzer = "ik_smart", termVector = TermVector.with_positions_offsets),
        otherFields = {
            @InnerField(suffix = "pinyin", type = FieldType.Text, analyzer = "pinyin_analyzer", searchAnalyzer = "pinyin_analyzer"),
            @InnerField(suffix = "keyword", type = FieldType.Keyword, ignoreAbove = 512)
        }
    )
    private String name;

    @Field(type = FieldType.Text, analyzer = "ik_max_word", searchAnalyzer = "ik_smart")
    private String subtitle;

    @Field(type = FieldType.Keyword)
    private String type;

    @Field(type = FieldType.Keyword)
    private String level;

    @Field(type = FieldType.Keyword)
    private String status;

    @MultiField(
        mainField = @Field(type = FieldType.Text, analyzer = "ik_max_word"),
        otherFields = @InnerField(suffix = "keyword", type = FieldType.Keyword)
    )
    private String dynasty;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String era;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String origin;

    @Field(type = FieldType.Text, analyzer = "ik_smart")
    private String discoveryLocation;

    @Field(type = FieldType.Keyword)
    private String currentLocation;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String material;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String technique;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String inscription;

    @Field(type = FieldType.Text, analyzer = "ik_max_word", termVector = TermVector.with_positions_offsets)
    private String description;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String historicalNote;

    @Field(type = FieldType.Keyword)
    private String owner;

    @Field(type = FieldType.Keyword)
    private String custodian;

    @Field(type = FieldType.Keyword)
    private String createdBy;

    @Field(type = FieldType.Integer)
    private Integer dataAccessLevel;

    @Field(type = FieldType.Date, format = DateFormat.date_hour_minute_second_millis)
    private LocalDateTime createTime;

    @Field(type = FieldType.Date, format = DateFormat.date_hour_minute_second_millis)
    private LocalDateTime updateTime;

    @Field(type = FieldType.Keyword)
    private List<String> imageUrls;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String allText;

    @Field(type = FieldType.Nested, includeInParent = true)
    private List<TagField> tags;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TagField {
        @Field(type = FieldType.Keyword) private String key;
        @Field(type = FieldType.Text, analyzer = "ik_max_word") private String value;
    }
}
