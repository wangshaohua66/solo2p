package com.gov.specialequipment.vo;

import com.gov.specialequipment.entity.EmergencyResource;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class EmergencyResourceVO extends EmergencyResource {

    private Double distance;
}
