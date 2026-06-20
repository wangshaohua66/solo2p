package com.mw.scheduling.document;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class StopNode {

    private String orgId;
    private String orgName;
    private Double plannedWeightKg;
    private Integer sequence;
    private Double lat;
    private Double lng;
    private String address;
}
