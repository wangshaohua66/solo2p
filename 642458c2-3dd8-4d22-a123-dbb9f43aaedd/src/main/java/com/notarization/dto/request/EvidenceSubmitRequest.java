package com.notarization.dto.request;

import com.notarization.model.enums.EvidenceType;
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
public class EvidenceSubmitRequest implements Serializable {

    private static final long serialVersionUID = 1L;

    @NotBlank(message = "案件ID不能为空")
    private String caseId;

    @NotBlank(message = "提交人ID不能为空")
    private String submitterId;

    private String submitterName;

    @NotBlank(message = "证据名称不能为空")
    private String evidenceName;

    @NotNull(message = "证据类型不能为空")
    private EvidenceType evidenceType;

    @NotBlank(message = "证据URL不能为空")
    private String evidenceUrl;

    private String description;

    @NotBlank(message = "文件哈希不能为空")
    private String fileHash;
}
