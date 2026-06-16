package com.carbon.service;

import com.carbon.common.response.PageResult;
import com.carbon.dto.emission.*;
import com.carbon.vo.emission.EmissionReportVO;
import com.carbon.vo.emission.EmissionWarningVO;

import java.util.List;

public interface EmissionService {

    EmissionReportVO report(EmissionReportDTO dto);

    List<EmissionReportVO> batchImport(List<EmissionReportDTO> dtoList);

    EmissionReportVO verify(EmissionVerifyDTO dto);

    EmissionReportVO getById(Long id);

    PageResult<EmissionReportVO> page(EmissionQueryDTO dto);

    EmissionWarningVO checkWarning(Long enterpriseId, Integer year);
}
