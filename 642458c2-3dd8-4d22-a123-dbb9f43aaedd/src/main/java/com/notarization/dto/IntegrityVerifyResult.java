package com.notarization.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IntegrityVerifyResult {

    private Boolean valid;
    private String message;
    private String chainId;
    private Long totalNodes;
    private Long errorIndex;
    private String expectedHash;
    private String actualHash;
}
