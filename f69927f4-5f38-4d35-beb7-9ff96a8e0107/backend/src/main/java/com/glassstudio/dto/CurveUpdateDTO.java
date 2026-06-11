package com.glassstudio.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CurveUpdateDTO {

    private String name;

    private String segments;

    private Boolean isTemplate;
}
