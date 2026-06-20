package com.design.collaboration.entity;

import com.design.collaboration.enums.ReviewLevel;
import com.design.collaboration.enums.ReviewStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Schema(description = "校审记录")
public class ReviewRecord {

    @Schema(description = "校审ID")
    private Long id;

    @Schema(description = "任务ID")
    private Long taskId;

    @Schema(description = "项目ID")
    private Long projectId;

    @Schema(description = "版本ID")
    private Long versionId;

    @Schema(description = "校审级别")
    private ReviewLevel level;

    @Schema(description = "校审人ID")
    private Long reviewerId;

    @Schema(description = "校审人姓名")
    private transient String reviewerName;

    @Schema(description = "校审状态")
    private ReviewStatus status;

    @Schema(description = "校审意见列表")
    private transient List<ReviewComment> comments = new ArrayList<>();

    @Schema(description = "提交时间")
    private LocalDateTime submittedAt;

    @Schema(description = "完成时间")
    private LocalDateTime completedAt;
}
