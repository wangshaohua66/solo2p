package com.gov.specialequipment.common;

import lombok.Data;

import java.io.Serializable;

@Data
public class PageQuery implements Serializable {

    private Long current = 1L;
    private Long size = 10L;
    private String orderBy;
    private String orderDirection = "desc";
}
