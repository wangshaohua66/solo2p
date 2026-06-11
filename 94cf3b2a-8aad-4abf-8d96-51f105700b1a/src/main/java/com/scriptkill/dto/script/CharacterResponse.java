package com.scriptkill.dto.script;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "角色卡响应")
public class CharacterResponse {

    @Schema(description = "角色ID")
    private Long id;

    @Schema(description = "角色名称")
    private String name;

    @Schema(description = "性别")
    private String gender;

    @Schema(description = "年龄段")
    private String ageRange;

    @Schema(description = "角色描述")
    private String description;

    @Schema(description = "角色故事")
    private String characterStory;

    @Schema(description = "秘密信息（DM可见）")
    private String secretInfo;

    @Schema(description = "角色特质")
    private String characterTrait;

    @Schema(description = "排序")
    private Integer sortOrder;

    @Schema(description = "是否凶手")
    private Boolean isKiller;

    @Schema(description = "头像URL")
    private String avatarUrl;
}
