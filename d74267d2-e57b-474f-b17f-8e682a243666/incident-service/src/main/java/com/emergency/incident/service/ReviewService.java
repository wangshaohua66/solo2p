package com.emergency.incident.service;

import com.emergency.common.dto.PageResult;
import com.emergency.incident.dto.ArchiveIncidentRequest;
import com.emergency.incident.dto.CaseComparisonRequest;
import com.emergency.incident.dto.GenerateReviewRequest;
import com.emergency.incident.dto.HistoryCaseQueryRequest;
import com.emergency.incident.entity.*;

import java.util.List;
import java.util.Map;

public interface ReviewService {

    IncidentArchive archiveIncident(ArchiveIncidentRequest request);

    IncidentArchive getArchiveById(Long id);

    List<IncidentArchive> getArchivesByIncidentId(Long incidentId);

    IncidentReviewReport generateReviewReport(GenerateReviewRequest request);

    IncidentReviewReport getReviewReportById(Long id);

    List<IncidentReviewReport> getReviewReportsByIncidentId(Long incidentId);

    IncidentReviewReport approveReviewReport(Long id, Long reviewerId, String reviewRemark);

    IncidentHistoryCase createHistoryCase(IncidentReviewReport report);

    IncidentHistoryCase getHistoryCaseById(Long id);

    PageResult<IncidentHistoryCase> queryHistoryCases(HistoryCaseQueryRequest request);

    List<IncidentHistoryCase> getClassicCases();

    List<IncidentHistoryCase> findSimilarCases(Long incidentId, Integer limit);

    IncidentCaseComparison compareWithCase(CaseComparisonRequest request);

    List<IncidentCaseComparison> getComparisonsByIncidentId(Long sourceIncidentId);

    Map<String, Object> generateTimelineAnalysis(Long incidentId);

    Map<String, Object> calculateEfficiencyMetrics(Long incidentId);

    void autoArchiveCompletedIncidents();
}
