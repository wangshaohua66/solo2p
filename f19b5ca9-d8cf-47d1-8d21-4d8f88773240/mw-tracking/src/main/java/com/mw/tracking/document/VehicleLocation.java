package com.mw.tracking.document;

import com.mw.common.document.BaseDocument;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "vehicle_location")
public class VehicleLocation extends BaseDocument {

    @Indexed(unique = true)
    private String vehicleId;

    private Double lat;

    private Double lng;

    private Long lastTs;

    private String status;

    private String targetOrgId;

    private List<double[]> plannedRoute;

    private Integer etaMinutes;

    private Boolean deviated;
}
