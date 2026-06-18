package com.wedding.suite.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class SupplierLoginVO {
    private String token;
    private SupplierVO supplier;
}
