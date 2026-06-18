package com.wedding.suite.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class SignResultVO {
    private String flowId;
    private String signUrl;
    private String status;
    private String message;
}
