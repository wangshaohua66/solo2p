package com.design.collaboration.entity;

import com.design.collaboration.enums.ChangeStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Schema(description = "设计变更申请")
public class ChangeRequest {

    @Schema(description = "变更ID")
    private Long id;

    @Schema(description = "项目ID")
    private Long projectId;

    @Schema(description = "项目名称")
    private transient String projectName;

    @Schema(description = "变更编号")
    private String changeNo;

    @Schema(description = "变更标题")
    private String title;

    @Schema(description = "变更原因")
    private String reason;

    @Schema(description = "变更内容")
    private String content;

    @Schema(description = "影响范围")
    private String impactScope;

    @Schema(description = "变更工作量（人天）")
    private Integer workload;

    @Schema(description = "追加费用")
    private BigDecimal additionalFee;

    @Schema(description = "变更状态")
    private ChangeStatus status;

    @Schema(description = "申请人ID")
    private Long applicantId;

    @Schema(description = "申请人姓名")
    private transient String applicantName;

    @Schema(description = "申请人类型：INTERNAL内部/CLIENT客户")
    private String applicantType;

    @Schema(description = "当前审批人ID")
    private Long currentApproverId;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Schema(description = "更新时间")
    private LocalDateTime updatedAt;

    @Schema(description = "审批记录列表")
    private transient List<ChangeApproval> approvalRecords = new ArrayList<>();
}
