package com.notarization.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EvidenceVerifyRequest implements Serializable {

    private static final long serialVersionUID = 1L;

    @NotBlank(message = "证据ID不能为空")
    private String evidenceId;
}
