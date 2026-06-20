package com.notarization.dto.request;

import com.notarization.model.enums.HallId;
import com.notarization.model.enums.NotarizationType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
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
public class NotarizationApplyRequest implements Serializable {

    private static final long serialVersionUID = 1L;

    @NotNull(message = "公证类型不能为空")
    private NotarizationType caseType;

    @NotBlank(message = "申请人姓名不能为空")
    private String applicantName;

    @NotBlank(message = "申请人身份证不能为空")
    private String applicantIdCard;

    @NotBlank(message = "联系电话不能为空")
    private String contactPhone;

    @NotEmpty(message = "材料清单不能为空")
    private List<MaterialItem> materials;

    @Builder.Default
    private Boolean urgent = false;

    @NotNull(message = "大厅ID不能为空")
    private HallId hallId;
}
