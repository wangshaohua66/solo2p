package com.glassstudio.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CurveSegment {

    private String phase;

    private Integer targetTemp;

    private Integer duration;

    private Double maxSlope;

    private String description;
}
