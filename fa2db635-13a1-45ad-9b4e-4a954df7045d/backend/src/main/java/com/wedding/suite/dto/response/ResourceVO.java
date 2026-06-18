package com.wedding.suite.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ResourceVO {
    private Long id;
    private String type;
    private String name;
    private Long storeId;
    private String meta;
}
