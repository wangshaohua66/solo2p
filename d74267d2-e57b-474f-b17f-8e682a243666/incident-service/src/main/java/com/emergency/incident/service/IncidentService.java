package com.emergency.incident.service;

import com.emergency.common.dto.PageResult;
import com.emergency.common.enums.IncidentLevel;
import com.emergency.common.enums.IncidentStatus;
import com.emergency.common.enums.IncidentType;
import com.emergency.incident.dto.IncidentQueryRequest;
import com.emergency.incident.dto.IncidentReportRequest;
import com.emergency.incident.entity.Incident;
import com.emergency.incident.entity.IncidentOperationLog;
import com.emergency.incident.entity.ResponsePlan;

import java.util.List;
import java.util.Map;

public interface IncidentService {

    Incident reportIncident(IncidentReportRequest request);

    Incident getIncidentById(Long id);

    Incident getIncidentByNo(String incidentNo);

    PageResult<Incident> queryIncidents(IncidentQueryRequest request);

    List<Incident> getActiveIncidents();

    List<Incident> getNearbyIncidents(Double lng, Double lat, Double radius);

    Incident updateIncidentStatus(Long id, IncidentStatus status);

    Incident upgradeIncidentLevel(Long id, IncidentLevel level);

    IncidentLevel calculateIncidentLevel(IncidentReportRequest request);

    ResponsePlan getMatchingPlan(IncidentType type, IncidentLevel level);

    List<IncidentOperationLog> getOperationLogs(Long incidentId);

    Map<String, Long> getStatistics(String regionCode, List<Long> orgIds);

    void recordOperationLog(Long incidentId, String operationType, String detail,
                          String beforeStatus, String afterStatus, String remark);
}
