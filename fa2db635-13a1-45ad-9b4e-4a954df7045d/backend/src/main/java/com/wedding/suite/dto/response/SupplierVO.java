package com.wedding.suite.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class SupplierVO {
    private Long id;
    private String name;
    private String role;
    private String phone;
    private Long storeId;
}
