package com.notarization.dto.request;

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
public class TranslationSubmitRequest implements Serializable {

    private static final long serialVersionUID = 1L;

    @NotBlank(message = "案件ID不能为空")
    private String caseId;

    @NotBlank(message = "翻译人ID不能为空")
    private String translatorId;

    @NotBlank(message = "翻译文档URL不能为空")
    private String translationUrl;

    @NotBlank(message = "目标语言不能为空")
    private String language;

    @NotNull(message = "版本号不能为空")
    private Integer version;

    private String translationHash;

    @NotBlank(message = "原文材料ID不能为空")
    private String materialId;
}
