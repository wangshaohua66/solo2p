package com.mw.scheduling.document;

import com.mw.common.document.BaseDocument;
import com.mw.common.enums.VehicleStatus;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "vehicle")
public class Vehicle extends BaseDocument {

    @Indexed(unique = true)
    private String plateNo;

    private String vehicleType;

    private Double capacityKg;

    private Double currentLoadKg;

    private Double lat;

    private Double lng;

    private VehicleStatus status;

    private String driverName;

    private String driverPhone;

    @Indexed
    private String orgId;
}
