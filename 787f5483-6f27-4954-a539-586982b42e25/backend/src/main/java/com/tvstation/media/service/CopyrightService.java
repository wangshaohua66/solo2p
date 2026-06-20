package com.tvstation.media.service;

import com.tvstation.media.common.PageResult;
import com.tvstation.media.entity.Copyright;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public interface CopyrightService {

    PageResult<Copyright> getCopyrights(Copyright.CopyrightStatus status, String keyword,
                                        int page, int pageSize);

    Copyright getCopyrightById(Long id);

    Copyright createCopyright(Copyright copyright, Long userId, String userName);

    Copyright updateCopyright(Long id, Copyright copyright, Long userId);

    void deleteCopyright(Long id, Long userId);

    List<Copyright> getExpiringCopyrights(int days);

    Map<String, Object> getCopyrightStats();

    Copyright assessRisk(Long id);

    List<Copyright> getHighRiskCopyrights();

    List<Copyright> assessAllRisks();

    Map<String, Object> getRiskStatistics();
}
