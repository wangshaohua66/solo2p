package com.scriptkill.dto.purchase;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Schema(description = "本子采购评审响应")
public class PurchaseResponse {

    @Schema(description = "评审ID")
    private Long id;

    @Schema(description = "剧本名称")
    private String scriptName;

    @Schema(description = "剧本描述")
    private String scriptDescription;

    @Schema(description = "作者")
    private String author;

    @Schema(description = "发行方")
    private String publisher;

    @Schema(description = "玩家人数")
    private String playerCount;

    @Schema(description = "预计时长")
    private String estimatedDuration;

    @Schema(description = "类型")
    private String genre;

    @Schema(description = "难度")
    private String difficulty;

    @Schema(description = "采购价格")
    private Integer purchasePrice;

    @Schema(description = "样章内容")
    private String sampleContent;

    @Schema(description = "状态: PENDING_REVIEW, APPROVED, REJECTED, CANDIDATE_POOL")
    private String status;

    @Schema(description = "提交者ID")
    private Long submitterId;

    @Schema(description = "提交者昵称")
    private String submitterName;

    @Schema(description = "评审人1ID")
    private Long reviewer1Id;

    @Schema(description = "评审人1评分")
    private Integer reviewer1Score;

    @Schema(description = "评审人1意见")
    private String reviewer1Comment;

    @Schema(description = "评审人2ID")
    private Long reviewer2Id;

    @Schema(description = "评审人2评分")
    private Integer reviewer2Score;

    @Schema(description = "评审人2意见")
    private String reviewer2Comment;

    @Schema(description = "评审人3ID")
    private Long reviewer3Id;

    @Schema(description = "评审人3评分")
    private Integer reviewer3Score;

    @Schema(description = "评审人3意见")
    private String reviewer3Comment;

    @Schema(description = "平均分")
    private Double averageScore;

    @Schema(description = "及格分")
    private Integer passingScore;

    @Schema(description = "入库后的剧本ID")
    private Long resultScriptId;

    @Schema(description = "备注")
    private String notes;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Schema(description = "更新时间")
    private LocalDateTime updatedAt;
}
