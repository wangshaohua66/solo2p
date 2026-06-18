package com.wedding.suite.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class FunnelDataVO {
    private String stage;
    private long count;
}
