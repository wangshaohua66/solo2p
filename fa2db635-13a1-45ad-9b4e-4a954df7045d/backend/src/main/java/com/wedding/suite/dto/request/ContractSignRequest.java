package com.wedding.suite.dto.request;

import lombok.Data;

@Data
public class ContractSignRequest {
    private String signature;
    private String signer;
    private String signUrl;
}
