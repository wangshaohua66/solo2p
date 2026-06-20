package com.mw.scheduling.document;

import com.mw.common.document.BaseDocument;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "dispatch_order")
public class DispatchOrder extends BaseDocument {

    @Indexed
    private String orderNo;

    @Indexed
    private String manifestNo;

    @Indexed
    private String vehicleId;

    private String driverName;

    private List<StopNode> plannedRoute;

    private Double plannedWeightKg;

    private Double actualWeightKg;

    private String status;

    private String priority;

    private Integer estimatedDurationMin;

    private Double trafficFactor;

    private LocalDateTime dispatchTime;

    private LocalDateTime acceptTime;

    private LocalDateTime completeTime;
}
