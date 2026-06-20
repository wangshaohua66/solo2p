package com.notarization.dto.request;

import com.notarization.model.enums.HallId;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CrossHallAccessRequest implements Serializable {

    private static final long serialVersionUID = 1L;

    @NotBlank(message = "案件ID不能为空")
    private String caseId;

    @NotNull(message = "源大厅ID不能为空")
    private HallId fromHallId;

    @NotNull(message = "目标大厅ID不能为空")
    private HallId toHallId;

    @NotBlank(message = "申请人ID不能为空")
    private String applicantId;

    @NotBlank(message = "调阅原因不能为空")
    private String reason;
}
