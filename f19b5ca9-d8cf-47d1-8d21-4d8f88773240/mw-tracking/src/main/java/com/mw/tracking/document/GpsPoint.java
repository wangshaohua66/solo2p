package com.mw.tracking.document;

import com.mw.common.document.BaseDocument;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "gps_point")
public class GpsPoint extends BaseDocument {

    @Indexed
    private String vehicleId;

    private String manifestNo;

    @Indexed
    private Double lat;

    private Double lng;

    private Double speed;

    private Double heading;

    @Indexed
    private Long ts;

    private Boolean deviated;
}
