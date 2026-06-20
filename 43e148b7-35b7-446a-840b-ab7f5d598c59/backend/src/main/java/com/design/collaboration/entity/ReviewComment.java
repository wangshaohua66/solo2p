package com.design.collaboration.entity;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Schema(description = "校审意见")
public class ReviewComment {

    @Schema(description = "意见ID")
    private Long id;

    @Schema(description = "校审记录ID")
    private Long reviewRecordId;

    @Schema(description = "意见内容")
    private String content;

    @Schema(description = "设计师回复")
    private String reply;

    @Schema(description = "图纸位置标注")
    private String location;

    @Schema(description = "是否已解决")
    private Boolean resolved;

    @Schema(description = "创建人ID")
    private Long createdBy;

    @Schema(description = "创建人姓名")
    private transient String createdByName;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Schema(description = "回复时间")
    private LocalDateTime repliedAt;
}
