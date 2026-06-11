package com.scriptkill.dto.player;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDate;

@Data
@Schema(description = "玩家档案响应")
public class PlayerProfileResponse {

    @Schema(description = "档案ID")
    private Long id;

    @Schema(description = "用户ID")
    private Long userId;

    @Schema(description = "用户名")
    private String username;

    @Schema(description = "昵称")
    private String nickname;

    @Schema(description = "真实姓名")
    private String realName;

    @Schema(description = "年龄段")
    private String ageGroup;

    @Schema(description = "性别")
    private String gender;

    @Schema(description = "偏好类型")
    private String preferredGenre;

    @Schema(description = "游玩次数")
    private Integer playCount;

    @Schema(description = "平均评分")
    private Double averageRating;

    @Schema(description = "历史得分")
    private Integer historyScore;

    @Schema(description = "偏好标签")
    private String preferenceTags;

    @Schema(description = "恐怖耐受度（1-10）")
    private Integer horrorTolerance;

    @Schema(description = "情感敏感度（1-10）")
    private Integer emotionalSensitivity;

    @Schema(description = "推理能力（1-10）")
    private Integer reasoningAbility;

    @Schema(description = "社交能力（1-10）")
    private Integer socialLevel;

    @Schema(description = "生日")
    private LocalDate birthday;

    @Schema(description = "会员等级")
    private String memberLevel;

    @Schema(description = "累计消费")
    private Integer totalSpent;

    @Schema(description = "信用分")
    private Integer creditScore;

    @Schema(description = "爽约次数")
    private Integer noShowCount;
}
