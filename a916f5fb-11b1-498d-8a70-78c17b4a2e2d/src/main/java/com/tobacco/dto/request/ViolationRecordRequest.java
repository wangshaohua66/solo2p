package com.tobacco.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@Schema(description = "违规录入请求")
public class ViolationRecordRequest {

    @NotNull(message = "任务ID不能为空")
    @Schema(description = "稽查任务ID", example = "1")
    private Long taskId;

    @NotNull(message = "违规类型不能为空")
    @Schema(description = "违规类型：1无证经营 2超范围经营 3假冒卷烟 4未明码标价 5价格欺诈 6非法渠道进货 7向未成年人销售 8其他", example = "4")
    private Integer violationType;

    @Schema(description = "违规描述", example = "店内部分卷烟未明码标价")
    private String description;

    @Schema(description = "处理意见", example = "责令限期整改")
    private String disposalOpinion;
}
