package com.scriptkill.dto.purchase;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
@Schema(description = "创建本子采购评审请求")
public class PurchaseCreateRequest {

    @Schema(description = "剧本名称", requiredMode = Schema.RequiredMode.REQUIRED, example = "迷雾小镇")
    @NotBlank(message = "剧本名称不能为空")
    private String scriptName;

    @Schema(description = "剧本描述")
    private String scriptDescription;

    @Schema(description = "作者", example = "张三")
    private String author;

    @Schema(description = "发行方", example = "某某工作室")
    private String publisher;

    @Schema(description = "玩家人数", example = "5-7人")
    private String playerCount;

    @Schema(description = "预计时长", example = "4-5小时")
    private String estimatedDuration;

    @Schema(description = "类型", example = "恐怖/推理")
    private String genre;

    @Schema(description = "难度", example = "硬核")
    private String difficulty;

    @Schema(description = "采购价格", example = "598")
    private Integer purchasePrice;

    @Schema(description = "样章内容")
    private String sampleContent;

    @Schema(description = "提交者备注")
    private String notes;
}
