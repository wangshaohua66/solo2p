package com.crew.common;

import lombok.Data;

@Data
public class PageRequest {
    private int page = 1;
    private int size = 20;
}
