package com.gov.specialequipment.vo;

import com.gov.specialequipment.entity.*;
import lombok.Data;

import java.util.List;

@Data
public class EmergencyArchiveVO {

    private AccidentReport accidentReport;

    private Device device;

    private List<InspectionRecord> latestInspection;

    private List<HazardRecord> hazards;

    private List<EmergencyResource> nearbyResources;

    private List<AccidentReport> relatedAccidents;

    private List<MaintenanceRecord> maintenanceHistory;
}
