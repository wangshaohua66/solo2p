package com.notarization.dto.request;

import com.notarization.model.enums.WorkflowAction;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowActionRequest implements Serializable {

    private static final long serialVersionUID = 1L;

    @NotNull(message = "操作类型不能为空")
    private WorkflowAction action;

    @NotBlank(message = "操作人ID不能为空")
    private String operatorId;

    private String operatorName;

    private String opinion;

    private List<MaterialItem> materials;

    private Boolean urgent;
}
