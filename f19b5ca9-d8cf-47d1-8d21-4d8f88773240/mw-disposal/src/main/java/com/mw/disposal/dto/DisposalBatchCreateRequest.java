package com.mw.disposal.dto;

import com.mw.common.enums.DisposalMethod;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class DisposalBatchCreateRequest {

    @NotBlank(message = "联单号不能为空")
    private String manifestNo;

    private List<String> traceCodes;

    @NotNull(message = "处置方式不能为空")
    private DisposalMethod disposalMethod;

    private String operatorId;

    private String remark;
}
