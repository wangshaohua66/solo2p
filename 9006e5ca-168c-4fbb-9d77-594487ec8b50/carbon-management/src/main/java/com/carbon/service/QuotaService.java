package com.carbon.service;

import com.carbon.common.response.PageResult;
import com.carbon.dto.quota.*;
import com.carbon.vo.quota.QuotaVO;

public interface QuotaService {

    QuotaVO allocate(QuotaAllocateDTO dto);

    QuotaVO issue(QuotaIssueDTO dto);

    QuotaVO adjust(QuotaAdjustDTO dto);

    QuotaVO getById(Long id);

    PageResult<QuotaVO> page(QuotaQueryDTO dto);
}
