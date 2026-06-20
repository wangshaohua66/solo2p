package com.tvstation.media.service;

import com.tvstation.media.entity.Copyright;

import java.util.List;

public interface CopyrightRiskAssessmentService {

    Copyright assessRisk(Copyright copyright);

    List<Copyright> assessAllRisks();

    int calculateRiskScore(Copyright copyright);

    Copyright.RiskLevel determineRiskLevel(int score);

    List<String> identifyRiskFactors(Copyright copyright);

    List<Copyright> getHighRiskCopyrights();
}
